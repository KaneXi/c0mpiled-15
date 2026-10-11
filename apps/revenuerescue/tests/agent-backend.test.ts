import { describe, expect, it, vi } from "vitest";
import {
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type {
  ConverseCommandInput,
  ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { createInitialState } from "../src/demo/model";
import { createInitialVolunteerState } from "../src/demo/volunteer-model";
import {
  canonicalSerialize,
  projectAgentSnapshot,
  type AgentIdentity,
  type AgentJob,
  type AnalyzeRequest,
} from "../src/domain/agent-types";
import { createBedrockAgent } from "../src/server/bedrock-agent";
import { createHandler, type ProxyEvent } from "../src/server/handler";
import { DynamoAgentRepository, sha256 } from "../src/server/repository";
import { agentContext, runReadTool } from "../src/server/queries";

const NOW = Date.parse("2026-10-11T16:00:00Z");
const TOKEN = "a".repeat(64);
const SECRET = "test-origin-secret-32-characters";
const ORIGIN = "https://demo.example.test";
const identity: AgentIdentity = {
  mode: "business",
  generation: 0,
  revision: 0,
  intakeId: "incoming-1",
  recordId: "inquiry-lena",
};
const request = (): AnalyzeRequest => ({
  ...identity,
  snapshot: projectAgentSnapshot(
    "business",
    createInitialState(),
    identity.recordId,
  ),
});
const pending = (id = identity): AgentJob => ({
  jobId: sha256(canonicalSerialize(id)),
  binding: { ...id, snapshotDigest: "digest" },
  status: "PENDING",
});

// Atomic in-memory transport for the exact DynamoDB transaction contract, not a cloud substitute.
function dynamo() {
  const items = new Map<string, Record<string, unknown>>();
  let conflict = false;
  const send = vi.fn(async (command: unknown) => {
    if (command instanceof GetCommand)
      return { Item: items.get(command.input.Key!.PK) };
    if (command instanceof TransactWriteCommand) {
      if (conflict)
        throw Object.assign(new Error("conflict"), {
          name: "TransactionCanceledException",
          CancellationReasons: [{ Code: "TransactionConflict" }],
        });
      const entries = command.input.TransactItems!;
      for (const entry of entries) {
        const key = (entry.Put?.Item?.PK ?? entry.Update?.Key?.PK) as string;
        const current = items.get(key);
        const values = entry.Update?.ExpressionAttributeValues ?? {};
        const rejected = entry.Put
          ? !!current
          : key.startsWith("SESSION#")
            ? !current ||
              Number(current.expiresAt) <= Number(values[":now"]) ||
              Number(current.jobsUsed) >= Number(values[":limit"])
            : Number(current?.count ?? 0) >= Number(values[":limit"]);
        if (rejected)
          throw Object.assign(new Error("condition"), {
            name: "TransactionCanceledException",
            CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
          });
      }
      for (const entry of entries) {
        if (entry.Put)
          items.set(entry.Put.Item!.PK, structuredClone(entry.Put.Item!));
        else if (entry.Update) {
          const key = entry.Update.Key!.PK;
          const current = items.get(key) ?? {};
          const values = entry.Update.ExpressionAttributeValues!;
          items.set(
            key,
            key.startsWith("SESSION#")
              ? { ...current, jobsUsed: Number(current.jobsUsed) + 1 }
              : {
                  ...current,
                  count: Number(current.count ?? 0) + 1,
                  ...(values[":expiry"]
                    ? { expiresAt: values[":expiry"] }
                    : {}),
                },
          );
        }
      }
      return {};
    }
    if (command instanceof UpdateCommand) {
      const key = command.input.Key!.PK;
      const current = items.get(key)!;
      const values = command.input.ExpressionAttributeValues!;
      if (
        current.requestHash !== values[":hash"] ||
        (current.job as AgentJob).status !== "PENDING"
      )
        throw new Error("condition");
      items.set(key, { ...current, job: structuredClone(values[":job"]) });
      return {};
    }
    throw new Error("Unexpected DynamoDB command");
  });
  const repository = new DynamoAgentRepository("table", {
    send,
  } as unknown as Pick<DynamoDBDocumentClient, "send">);
  const session = (hash = sha256(TOKEN)) =>
    items.set(`SESSION#${hash}`, {
      expiresAt: Math.floor(NOW / 1000) + 7200,
      jobsUsed: 0,
    });
  return {
    items,
    send,
    repository,
    session,
    setConflict: () => {
      conflict = true;
    },
  };
}

function event(path = "/api/analyze", body: unknown = request()): ProxyEvent {
  return {
    rawPath: path,
    headers: {
      origin: ORIGIN,
      "x-origin-verify": SECRET,
      "content-type": "application/json",
    },
    cookies: [`__Host-rr-guest=${TOKEN}`],
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify(body),
  };
}
function setup() {
  const db = dynamo();
  db.session();
  const runAgent = vi.fn(async () => ({
    result: {
      kind: "clarification" as const,
      summary: "Please confirm the requested date.",
      questions: ["Which date works?"],
    },
    provenance: {
      provider: "amazon-bedrock" as const,
      modelId: "nova-test",
      toolNames: ["businessAvailability"],
      modelCalls: 2,
    },
  }));
  const config = {
    modelId: "nova-test",
    originSecret: SECRET,
    allowedOrigins: [ORIGIN],
    agentEnabled: true,
  };
  const handle = createHandler({
    repository: db.repository,
    runAgent,
    config,
    now: () => NOW,
  });
  return { ...db, runAgent, config, handle };
}

describe("public endpoint admission and isolation", () => {
  it("sets a secure opaque cookie and stores only its hash", async () => {
    const app = setup();
    const incoming = event("/api/session", {});
    incoming.cookies = [];
    const result = await app.handle(incoming);
    expect(result.statusCode).toBe(200);
    expect(result.cookies![0]).toMatch(
      /^__Host-rr-guest=[a-f0-9]{64}; Secure; HttpOnly; SameSite=Strict; Path=\/; Max-Age=7200$/,
    );
    const token = result.cookies![0].split(";")[0].split("=")[1];
    expect(app.items.has(`SESSION#${sha256(token)}`)).toBe(true);
    expect(JSON.stringify([...app.items])).not.toContain(token);
  });
  it.each([
    "missing secret",
    "foreign origin",
    "missing origin",
    "wrong method",
    "forged session",
    "expired session",
    "oversized utf8",
    "oversized base64",
    "large transcript",
    "credential text",
    "unknown fixture",
    "wrong mode",
    "wrong record",
  ])("rejects %s before any paid call", async (variant) => {
    const app = setup();
    const req = request();
    const incoming = event();
    if (variant === "missing secret")
      delete incoming.headers!["x-origin-verify"];
    if (variant === "foreign origin")
      incoming.headers!.origin = "https://other.test";
    if (variant === "missing origin") delete incoming.headers!.origin;
    if (variant === "wrong method")
      incoming.requestContext!.http!.method = "GET";
    if (variant === "forged session")
      incoming.cookies = [`__Host-rr-guest=${"b".repeat(64)}`];
    if (variant === "expired session")
      app.items.set(`SESSION#${sha256(TOKEN)}`, {
        expiresAt: Math.floor(NOW / 1000),
        jobsUsed: 0,
      });
    if (variant === "oversized utf8") incoming.body = "界".repeat(11000);
    if (variant === "oversized base64") {
      incoming.body = Buffer.from("x".repeat(32769)).toString("base64");
      incoming.isBase64Encoded = true;
    }
    if (variant === "large transcript")
      req.snapshot.record.notes = "x".repeat(2001);
    if (variant === "credential text")
      req.snapshot.record.notes = "password: sample-secret";
    if (variant === "unknown fixture" && req.snapshot.mode === "business")
      req.snapshot.appointments[0].resourceId = "unknown";
    if (variant === "wrong mode") req.mode = "volunteers";
    if (variant === "wrong record") req.recordId = "other-record";
    if (
      [
        "large transcript",
        "credential text",
        "unknown fixture",
        "wrong mode",
        "wrong record",
      ].includes(variant)
    )
      incoming.body = JSON.stringify(req);
    expect((await app.handle(incoming)).statusCode).toBeGreaterThanOrEqual(400);
    expect(app.runAgent).not.toHaveBeenCalled();
    expect(app.items.has("QUOTA#LIFETIME")).toBe(false);
  });
  it("replays duplicates without inference and scopes status by cookie/mode", async () => {
    const app = setup();
    const original = JSON.stringify(request());
    const first = await app.handle(event());
    const repeated = await app.handle(event());
    expect(first.body).toBe(repeated.body);
    expect(JSON.parse(first.body).status).toBe("READY");
    expect(app.runAgent).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(request())).toBe(original);
    expect(app.items.get("QUOTA#LIFETIME")!.count).toBe(1);
    expect((await app.handle(event("/api/status", identity))).body).toBe(
      first.body,
    );
    const other = event("/api/status", identity);
    other.cookies = [`__Host-rr-guest=${"b".repeat(64)}`];
    app.session(sha256("b".repeat(64)));
    expect((await app.handle(other)).statusCode).toBe(404);
    expect(
      (
        await app.handle(
          event("/api/status", { ...identity, mode: "volunteers" }),
        )
      ).statusCode,
    ).toBe(404);
    const changed = request();
    changed.snapshot.record.notes = "Changed after analysis";
    expect((await app.handle(event("/api/analyze", changed))).statusCode).toBe(
      409,
    );
    expect(app.runAgent).toHaveBeenCalledTimes(1);
  });
  it("fails closed for storage errors, conflict, and kill switch", async () => {
    const app = setup();
    app.config.agentEnabled = false;
    expect((await app.handle(event())).statusCode).toBe(503);
    app.config.agentEnabled = true;
    app.setConflict();
    expect(JSON.parse((await app.handle(event())).body).error.code).toBe(
      "BUSY",
    );
    app.send.mockRejectedValueOnce(new Error("Database unavailable"));
    expect((await app.handle(event())).statusCode).toBe(503);
    expect(app.runAgent).not.toHaveBeenCalled();
  });
  it("failed model calls consume their reservation and cannot be retried", async () => {
    const app = setup();
    app.runAgent.mockRejectedValue(new Error("Unknown network outcome"));
    const first = await app.handle(event());
    expect(JSON.parse(first.body).status).toBe("FAILED");
    expect((await app.handle(event())).body).toBe(first.body);
    expect(app.runAgent).toHaveBeenCalledTimes(1);
    expect(app.items.get("QUOTA#LIFETIME")!.count).toBe(1);
  });
  it("stale pending jobs time out without new paid calls", async () => {
    const app = setup();
    const req = request();
    await app.repository.reserve(
      sha256(TOKEN),
      identity,
      sha256(canonicalSerialize(req)),
      pending(),
      NOW - 19000,
    );
    expect(JSON.parse((await app.handle(event())).body).error.code).toBe(
      "TIMEOUT",
    );
    expect(app.runAgent).not.toHaveBeenCalled();
  });
});

describe("atomic durable budgets", () => {
  it.each(["day", "lifetime", "session"])(
    "admits only one concurrent request at the %s boundary",
    async (quota) => {
      const db = dynamo();
      const hash = sha256(TOKEN);
      db.session();
      if (quota === "day") db.items.set("QUOTA#DAY#2026-10-11", { count: 99 });
      if (quota === "lifetime") db.items.set("QUOTA#LIFETIME", { count: 499 });
      if (quota === "session") db.items.get(`SESSION#${hash}`)!.jobsUsed = 9;
      const results = await Promise.allSettled(
        [1, 2].map((n) => {
          const id = { ...identity, intakeId: `incoming-${n}` };
          return db.repository.reserve(hash, id, `hash-${n}`, pending(id), NOW);
        }),
      );
      expect(
        results.filter((item) => item.status === "fulfilled"),
      ).toHaveLength(1);
      expect(results.filter((item) => item.status === "rejected")).toHaveLength(
        1,
      );
      expect(db.items.get("QUOTA#LIFETIME")!.expiresAt).toBeUndefined();
    },
  );
  it("concurrent identical jobs reserve once and a different hash conflicts", async () => {
    const db = dynamo();
    const hash = sha256(TOKEN);
    db.session();
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        db.repository.reserve(hash, identity, "same", pending(), NOW),
      ),
    );
    expect(results.filter((result) => result.fresh)).toHaveLength(1);
    expect(db.items.get("QUOTA#LIFETIME")!.count).toBe(1);
    await expect(
      db.repository.reserve(hash, identity, "different", pending(), NOW),
    ).rejects.toMatchObject({ code: "REQUEST_CONFLICT" });
  });
});

describe("actual bounded tool loop", () => {
  const toolReply = (
    name = "businessAvailability",
    count = 1,
  ): ConverseCommandOutput => ({
    $metadata: {},
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    metrics: { latencyMs: 1 },
    stopReason: "tool_use",
    output: {
      message: {
        role: "assistant",
        content: Array.from({ length: count }, (_, n) => ({
          toolUse: {
            toolUseId: `call-${n}`,
            name,
            input: {
              date: "2026-10-13",
              time: "11:00",
              resourceId: "maya",
              durationMinutes: 60,
            },
          },
        })),
      },
    },
  });
  const finalReply = (optionId: string): ConverseCommandOutput => ({
    $metadata: {},
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    metrics: { latencyMs: 1 },
    stopReason: "end_turn",
    output: {
      message: {
        role: "assistant",
        content: [
          {
            text: JSON.stringify({
              kind: "proposal",
              optionId,
              summary: "This checked option is ready for staff confirmation.",
              questions: [],
            }),
          },
        ],
      },
    },
  });
  it("uses two model calls and returns only an option produced by shared rules", async () => {
    const req = request();
    const before = JSON.stringify(req);
    const option = runReadTool(req, "businessAvailability", {
      date: "2026-10-13",
      time: "11:00",
      resourceId: "maya",
      durationMinutes: 60,
    }).options[0];
    const transport = vi
      .fn<
        (
          ...args: [ConverseCommandInput, AbortSignal]
        ) => Promise<ConverseCommandOutput>
      >()
      .mockResolvedValueOnce(toolReply())
      .mockResolvedValueOnce(finalReply(option.optionId));
    const answer = await createBedrockAgent(transport)(
      req,
      "nova-test",
      new AbortController().signal,
    );
    expect(answer.result.option).toEqual(option);
    expect(answer.provenance.modelCalls).toBe(2);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(
      transport.mock.calls.every(
        ([input]) => input.inferenceConfig?.maxTokens === 800,
      ),
    ).toBe(true);
    expect(JSON.stringify(req)).toBe(before);
  });
  it.each(["unknown tool", "too many tools", "extra round", "invented option"])(
    "rejects %s",
    async (variant) => {
      const transport = vi
        .fn<
          (
            ...args: [ConverseCommandInput, AbortSignal]
          ) => Promise<ConverseCommandOutput>
        >()
        .mockResolvedValueOnce(
          toolReply(
            variant === "unknown tool" ? "sendEmail" : "businessAvailability",
            variant === "too many tools" ? 3 : 1,
          ),
        )
        .mockResolvedValueOnce(
          variant === "extra round" ? toolReply() : finalReply("invented"),
        );
      await expect(
        createBedrockAgent(transport)(
          request(),
          "nova-test",
          new AbortController().signal,
        ),
      ).rejects.toThrow();
      expect(transport.mock.calls.length).toBeLessThanOrEqual(2);
    },
  );
  it("honors an already aborted deadline with zero model calls", async () => {
    const transport = vi.fn();
    const controller = new AbortController();
    controller.abort();
    await expect(
      createBedrockAgent(transport)(request(), "nova-test", controller.signal),
    ).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it("redacts contacts and money and excludes credentials and customer names", () => {
    const req = request();
    req.snapshot.record.notes =
      "Reach lena@example.test about the $65 sample visit.";
    const context = agentContext(req);
    expect(context).not.toContain("lena@example.test");
    expect(context).not.toContain("$65");
    expect(context).not.toContain("Lena Brooks");
  });
  it("never proposes a business appointment before the fixed demonstration clock", () => {
    const choices = runReadTool(request(), "businessAvailability", {
      date: "2026-10-12",
      time: null,
      resourceId: "theo",
      durationMinutes: 60,
    });
    expect(choices.options.length).toBeGreaterThan(0);
    expect(
      choices.options.every(
        ({ action }) =>
          "start" in action &&
          Date.parse(action.start) >= Date.parse("2026-10-12T12:00:00-04:00"),
      ),
    ).toBe(true);
    expect(
      runReadTool(request(), "businessAvailability", {
        date: "2026-10-12",
        time: "09:00",
        resourceId: "theo",
        durationMinutes: 60,
      }).options,
    ).toEqual([]);
  });
  it("volunteer tools exclude full/ineligible shifts and clarify unknown availability", () => {
    const state = createInitialVolunteerState();
    const req: AnalyzeRequest = {
      ...identity,
      mode: "volunteers",
      recordId: "registration-eli",
      snapshot: projectAgentSnapshot("volunteers", state, "registration-eli"),
    };
    const choices = runReadTool(req, "volunteerShiftOptions", {
      shiftId: null,
    });
    expect(choices.options.length).toBeGreaterThan(0);
    expect(
      choices.options.some(
        ({ action }) =>
          "shiftId" in action && action.shiftId === "shift-monday-sorting",
      ),
    ).toBe(false);
    req.recordId = "registration-june";
    req.snapshot = projectAgentSnapshot("volunteers", state, req.recordId);
    expect(
      runReadTool(req, "volunteerShiftOptions", { shiftId: null }),
    ).toEqual({
      options: [],
      questions: ["What days and times is this volunteer available?"],
    });
  });
});
