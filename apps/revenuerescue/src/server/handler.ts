import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  canonicalSerialize,
  type AgentIdentity,
  type AgentJob,
  type AnalyzeRequest,
} from "../domain/agent-types";
import { createBedrockAgent, type AgentRun } from "./bedrock-agent";
import { AgentError } from "./errors";
import { agentContext } from "./queries";
import {
  DynamoAgentRepository,
  jobKey,
  sha256,
  type AgentRepository,
  type StoredJob,
} from "./repository";
import { analyzeSchema, identitySchema, parseInput } from "./validation";

export interface ProxyEvent {
  rawPath?: string;
  headers?: Record<string, string | undefined>;
  cookies?: string[];
  requestContext?: { http?: { method?: string } };
  body?: string | null;
  isBase64Encoded?: boolean;
}
export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  cookies?: string[];
}
export interface HandlerConfig {
  modelId: string;
  originSecret: string;
  allowedOrigins: string[];
  agentEnabled: boolean;
}
export interface HandlerDependencies {
  repository: AgentRepository;
  runAgent: (
    request: AnalyzeRequest,
    modelId: string,
    signal: AbortSignal,
  ) => Promise<AgentRun>;
  config: HandlerConfig;
  now?: () => number;
}
const COOKIE = "__Host-rr-guest";
const MAX_BODY_BYTES = 32768;
const DEADLINE_MS = 18000;
const emptySchema = z.object({}).strict();

function response(
  statusCode: number,
  body: unknown,
  cookies?: string[],
): ProxyResponse {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
    body: JSON.stringify(body),
    ...(cookies ? { cookies } : {}),
  };
}
function failure(error: unknown): ProxyResponse {
  const known =
    error instanceof AgentError
      ? error
      : new AgentError(
          "UNAVAILABLE",
          "The assistant is temporarily unavailable. No changes were made.",
          503,
        );
  return response(known.status, {
    error: { code: known.code, message: known.message },
  });
}
function sameSecret(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return b.length >= 16 && a.length === b.length && timingSafeEqual(a, b);
}
function decodeBody(event: ProxyEvent): unknown {
  const raw = event.body ?? "";
  // HTTP API has already buffered the body. Bound the proxy representation before decoding.
  if (event.isBase64Encoded) {
    if (
      raw.length > Math.ceil(MAX_BODY_BYTES / 3) * 4 ||
      raw.length % 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(raw)
    )
      throw new AgentError(
        "BODY_TOO_LARGE",
        "The request must be valid JSON smaller than 32 KiB.",
        413,
      );
  } else if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES)
    throw new AgentError(
      "BODY_TOO_LARGE",
      "The request must be smaller than 32 KiB.",
      413,
    );
  const bytes = event.isBase64Encoded
    ? Buffer.from(raw, "base64")
    : Buffer.from(raw, "utf8");
  if (bytes.length > MAX_BODY_BYTES)
    throw new AgentError(
      "BODY_TOO_LARGE",
      "The request must be smaller than 32 KiB.",
      413,
    );
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new AgentError("INVALID_JSON", "Send a valid JSON request.");
  }
}
function identityOf(request: AgentIdentity): AgentIdentity {
  return {
    mode: request.mode,
    generation: request.generation,
    intakeId: request.intakeId,
    revision: request.revision,
    recordId: request.recordId,
  };
}
function timedOut(job: AgentJob): AgentJob {
  return {
    ...job,
    status: "FAILED",
    error: {
      code: "TIMEOUT",
      message: "This analysis did not finish in time. No changes were made.",
    },
  };
}
function visibleJob(record: StoredJob, now: number): AgentJob {
  return record.job.status === "PENDING" &&
    now - record.createdAt >= DEADLINE_MS
    ? timedOut(record.job)
    : record.job;
}

export function createHandler({
  repository,
  runAgent,
  config,
  now = Date.now,
}: HandlerDependencies) {
  return async (event: ProxyEvent): Promise<ProxyResponse> => {
    const started = now();
    const deadline = new AbortController();
    const timeout = setTimeout(
      () => deadline.abort(new Error("Deadline exceeded")),
      DEADLINE_MS,
    );
    const signal = deadline.signal;
    try {
      const headers = Object.fromEntries(
        Object.entries(event.headers ?? {}).map(([key, value]) => [
          key.toLowerCase(),
          value ?? "",
        ]),
      );
      if (
        !sameSecret(headers["x-origin-verify"] ?? "", config.originSecret) ||
        !config.allowedOrigins.includes(headers.origin ?? "")
      )
        throw new AgentError(
          "FORBIDDEN",
          "Open this demo from its public website.",
          403,
        );
      if (event.requestContext?.http?.method !== "POST")
        throw new AgentError(
          "METHOD_NOT_ALLOWED",
          "Use POST for this request.",
          405,
        );
      const route = event.rawPath;
      if (
        !["/api/session", "/api/analyze", "/api/status"].includes(route ?? "")
      )
        throw new AgentError("NOT_FOUND", "This endpoint does not exist.", 404);
      if (!/^application\/json(?:\s*;|$)/i.test(headers["content-type"] ?? ""))
        throw new AgentError("CONTENT_TYPE", "Send this request as JSON.", 415);
      const input = decodeBody(event);
      const token = [...(event.cookies ?? []), headers.cookie ?? ""]
        .join(";")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${COOKIE}=`))
        ?.slice(COOKIE.length + 1);
      const sessionHash =
        token && /^[a-f0-9]{64}$/.test(token) ? sha256(token) : undefined;
      const session = sessionHash
        ? await repository.session(sessionHash, signal)
        : undefined;
      const validSession =
        session && session.expiresAt > Math.floor(now() / 1000);
      if (route === "/api/session") {
        parseInput(emptySchema, input);
        if (validSession)
          return response(200, { expiresAt: session.expiresAt });
        const freshToken = randomBytes(32).toString("hex");
        const created = await repository.createSession(
          sha256(freshToken),
          now(),
          signal,
        );
        return response(200, { expiresAt: created.expiresAt }, [
          `${COOKIE}=${freshToken}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200`,
        ]);
      }
      if (!validSession || !sessionHash)
        throw new AgentError(
          "SESSION_EXPIRED",
          "This guest session has ended. Start a new session to continue.",
          401,
        );
      if (route === "/api/status") {
        const identity = parseInput(identitySchema, input);
        const record = await repository.job(sessionHash, identity, signal);
        if (!record || record.expiresAt <= Math.floor(now() / 1000))
          throw new AgentError(
            "NOT_FOUND",
            "This analysis was not found in your guest session.",
            404,
          );
        return response(200, visibleJob(record, now()));
      }
      if (!config.agentEnabled)
        throw new AgentError(
          "DISABLED",
          "The live assistant is paused. You can still use the sample workspace.",
          503,
        );
      const request = parseInput(analyzeSchema, input);
      agentContext(request); // Validate fixture references and sensitive text before consuming quota.
      const identity = identityOf(request);
      const requestHash = sha256(canonicalSerialize(request));
      const pending: AgentJob = {
        jobId: sha256(jobKey(sessionHash, identity)),
        binding: {
          ...identity,
          snapshotDigest: sha256(canonicalSerialize(request.snapshot)),
        },
        status: "PENDING",
      };
      const admission = await repository.reserve(
        sessionHash,
        identity,
        requestHash,
        pending,
        now(),
        signal,
      );
      if (!admission.fresh)
        return response(200, visibleJob(admission.record, now()));
      let completed: AgentJob;
      try {
        const remaining = DEADLINE_MS - (now() - started) - 2000;
        if (remaining <= 0)
          throw new AgentError(
            "TIMEOUT",
            "This analysis did not finish in time. No changes were made.",
            504,
          );
        const modelSignal = AbortSignal.any([
          signal,
          AbortSignal.timeout(remaining),
        ]);
        const answer = await runAgent(request, config.modelId, modelSignal);
        modelSignal.throwIfAborted();
        completed = { ...pending, status: "READY", ...answer };
      } catch (error) {
        const known =
          error instanceof AgentError
            ? error
            : new AgentError(
                "ANALYSIS_FAILED",
                "The assistant could not finish this analysis. No changes were made.",
                502,
              );
        completed = {
          ...pending,
          status: "FAILED",
          error: { code: known.code, message: known.message },
        };
        if (
          signal.aborted ||
          (error as Error)?.name === "TimeoutError" ||
          (error as Error)?.name === "AbortError"
        )
          completed = timedOut(pending);
      }
      // A result is never published unless its durable terminal state has been saved.
      await repository.finish(
        sessionHash,
        identity,
        requestHash,
        completed,
        signal,
      );
      return response(200, completed);
    } catch (error) {
      return failure(error);
    } finally {
      clearTimeout(timeout);
    }
  };
}

let productionHandler: ReturnType<typeof createHandler> | undefined;
export async function handler(event: ProxyEvent): Promise<ProxyResponse> {
  try {
    if (!productionHandler) {
      const {
        TABLE_NAME,
        MODEL_ID,
        ORIGIN_SECRET,
        ALLOWED_ORIGINS,
        AGENT_ENABLED,
      } = process.env;
      if (!TABLE_NAME || !MODEL_ID || !ORIGIN_SECRET || !ALLOWED_ORIGINS)
        throw new Error("Missing service configuration");
      productionHandler = createHandler({
        repository: new DynamoAgentRepository(TABLE_NAME),
        runAgent: createBedrockAgent(),
        config: {
          modelId: MODEL_ID,
          originSecret: ORIGIN_SECRET,
          allowedOrigins: ALLOWED_ORIGINS.split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          agentEnabled: AGENT_ENABLED === "true",
        },
      });
    }
    return await productionHandler(event);
  } catch (error) {
    return failure(error);
  }
}
