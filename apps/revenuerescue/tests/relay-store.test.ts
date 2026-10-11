import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoRelayStore, SqliteRelayStore } from "../src/relay/server/store";
let stores: SqliteRelayStore[] = [];
let dirs: string[] = [];
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "relay-test-"));
  dirs.push(dir);
  const path = join(dir, "test.sqlite");
  const store = new SqliteRelayStore(path);
  stores.push(store);
  return { store, path };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  stores.forEach((s) => s.close());
  dirs.forEach((d) => rmSync(d, { recursive: true, force: true }));
  stores = [];
  dirs = [];
});
describe("durable manager workspace", () => {
  it("preserves sessions, pause and history after opening another database connection", async () => {
    const { store, path } = fixture();
    const { token, session } = await store.createSession();
    await store.mutate(
      session.tenantId,
      0,
      { id: "pause", fingerprint: "pause" },
      (s) => ({ ...s, paused: true }),
    );
    const reopened = new SqliteRelayStore(path);
    stores.push(reopened);
    expect(await reopened.session(token)).toEqual(session);
    expect((await reopened.read(session.tenantId)).paused).toBe(true);
  });
  it("creates isolated tenants and does not recognize invented session tokens", async () => {
    const { store } = fixture();
    const a = await store.createSession(),
      b = await store.createSession();
    await store.mutate(a.session.tenantId, 0, undefined, (s) => ({
      ...s,
      organization: "Only A",
    }));
    expect((await store.read(b.session.tenantId)).organization).not.toBe(
      "Only A",
    );
    expect(await store.session("invented")).toBeUndefined();
    expect(a.session.tenantId).not.toBe(b.session.tenantId);
  });
  it("deduplicates identical commands and rejects mismatched reuse", async () => {
    const { store } = fixture();
    const { session } = await store.createSession();
    let runs = 0;
    const change = (s: Awaited<ReturnType<typeof store.read>>) => {
      runs++;
      return { ...s, paused: true };
    };
    await store.mutate(
      session.tenantId,
      0,
      { id: "one", fingerprint: "pause" },
      change,
    );
    await store.mutate(
      session.tenantId,
      0,
      { id: "one", fingerprint: "pause" },
      change,
    );
    expect(runs).toBe(1);
    await expect(
      store.mutate(
        session.tenantId,
        1,
        { id: "one", fingerprint: "resume" },
        change,
      ),
    ).rejects.toThrow("already been used");
  });
  it("rejects a stale concurrent manager command without losing the winning change", async () => {
    const { store } = fixture();
    const { session } = await store.createSession();
    await store.mutate(session.tenantId, 0, undefined, (s) => ({
      ...s,
      paused: true,
    }));
    await expect(
      store.mutate(session.tenantId, 0, undefined, (s) => ({
        ...s,
        organization: "stale",
      })),
    ).rejects.toThrow("schedule changed");
    expect((await store.read(session.tenantId)).paused).toBe(true);
  });
  it("rolls back quota reservations when a tenant reaches its limit", async () => {
    const { store } = fixture();
    const { session } = await store.createSession();
    for (let i = 0; i < 20; i++) await store.reserveAnalysis(session.tenantId);
    await expect(store.reserveAnalysis(session.tenantId)).rejects.toThrow(
      "limit",
    );
    const b = await store.createSession();
    await expect(
      store.reserveAnalysis(b.session.tenantId),
    ).resolves.toBeUndefined();
  });
  it("renews only the designated live workspace's analysis allowance and keeps consumed usage", async () => {
    const { store } = fixture();
    const { session } = await store.createSession();
    for (let i = 0; i < 20; i++) await store.reserveAnalysis(session.tenantId);
    vi.stubEnv("RELAY_PUBLIC_TEST_TENANT", session.tenantId);
    vi.stubEnv("VOICE_ANALYSIS_LIMIT", "500");
    for (let i = 20; i < 500; i++)
      await store.reserveAnalysis(session.tenantId);
    await expect(store.reserveAnalysis(session.tenantId)).rejects.toThrow(
      "limit",
    );
  });
});

describe("cloud worker discovery", () => {
  it("uses renewed budgets only for the exact live tenant in DynamoDB", async () => {
    vi.stubEnv("RELAY_PUBLIC_TEST_TENANT", "live-tenant");
    vi.stubEnv("VOICE_ANALYSIS_LIMIT", "500");
    const send = vi
      .spyOn(DynamoDBDocumentClient.prototype, "send")
      .mockResolvedValue({} as never);
    const store = new DynamoRelayStore("test-table");
    await store.reserveAnalysis("live-tenant");
    await store.reserveAnalysis("guest-tenant");
    const limits = (index: number) =>
      (
        send.mock.calls[index][0].input as {
          TransactItems: {
            Update: { ExpressionAttributeValues: Record<string, number> };
          }[];
        }
      ).TransactItems.map(
        (item) => item.Update.ExpressionAttributeValues[":limit"],
      );
    expect(limits(0)).toEqual([500, 500, 500]);
    expect(limits(1)).toEqual([100, 500, 20]);
  });
  it("continues after a filtered page so active workspaces are not silently skipped", async () => {
    const send = vi
      .spyOn(DynamoDBDocumentClient.prototype, "send")
      .mockResolvedValueOnce({
        Items: [],
        LastEvaluatedKey: { PK: "expired-record" },
      } as never)
      .mockResolvedValueOnce({
        Items: [{ PK: "RELAY#TENANT#active" }],
      } as never);
    const store = new DynamoRelayStore("test-table");
    expect(await store.tenants()).toEqual(["active"]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0].input).toMatchObject({
      ExclusiveStartKey: { PK: "expired-record" },
    });
  });
});
