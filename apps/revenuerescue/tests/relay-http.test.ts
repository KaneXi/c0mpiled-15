import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleRelayRequest } from "../src/relay/server/http";
const dir = mkdtempSync(join(tmpdir(), "relay-http-"));
beforeAll(() => {
  process.env.RELAY_DB_PATH = join(dir, "http.sqlite");
  process.env.RELAY_ALLOWED_ORIGINS = "http://localhost:3008";
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.RELAY_DB_PATH;
});
function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  origin = "http://localhost:3008",
) {
  return new Request("http://localhost:3008/api/relay/" + path, {
    method,
    headers: {
      origin,
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
describe("Relay API authorization boundary", () => {
  it("requires an actual guest session and denies a cross-origin write", async () => {
    expect((await handleRelayRequest(request("state"))).status).toBe(401);
    expect(
      (
        await handleRelayRequest(
          request("session", "POST", {}, undefined, "https://unknown.example"),
        )
      ).status,
    ).toBe(403);
  });
  it("creates HttpOnly manager sessions and ignores query-based tenant impersonation", async () => {
    const a = await handleRelayRequest(request("session", "POST", {})),
      b = await handleRelayRequest(request("session", "POST", {}));
    const cookie = a.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    const va = await (
      await handleRelayRequest(request("state", "GET", undefined, cookie))
    ).json();
    const vb = await (
      await handleRelayRequest(
        request("state", "GET", undefined, b.headers.get("set-cookie")!),
      )
    ).json();
    expect(va.state.tenantId).not.toBe(vb.state.tenantId);
    const spoof = await (
      await handleRelayRequest(
        request(
          "state?tenantId=" + vb.state.tenantId,
          "GET",
          undefined,
          cookie,
        ),
      )
    ).json();
    expect(spoof.state.tenantId).toBe(va.state.tenantId);
  });
  it("rejects an invalid phone and unexpected identity fields", async () => {
    const s = await handleRelayRequest(request("session", "POST", {}));
    const cookie = s.headers.get("set-cookie")!;
    const bad = await handleRelayRequest(
      request(
        "command",
        "POST",
        {
          requestId: crypto.randomUUID(),
          expectedRevision: 0,
          tenantId: "another",
          command: { type: "SET_PAUSED", paused: true },
        },
        cookie,
      ),
    );
    expect(bad.status).toBe(400);
  });
  it("does not advance the workflow on a read-only state request", async () => {
    const s = await handleRelayRequest(request("session", "POST", {}));
    const cookie = s.headers.get("set-cookie")!;
    const a = await (
      await handleRelayRequest(request("state", "GET", undefined, cookie))
    ).json();
    const b = await (
      await handleRelayRequest(request("state", "GET", undefined, cookie))
    ).json();
    expect(a.state).toEqual(b.state);
    expect(a.state.calls).toHaveLength(0);
  });
});
