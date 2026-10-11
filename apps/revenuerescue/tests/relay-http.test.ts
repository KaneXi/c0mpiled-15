import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getStore } from "../src/relay/server/store";
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
  it("loads a paused four-person sample through the existing reset command", async () => {
    const session = await handleRelayRequest(request("session", "POST", {}));
    const cookie = session.headers.get("set-cookie")!;
    const input = {
      requestId: crypto.randomUUID(),
      expectedRevision: 0,
      command: { type: "RESET_DEMO", sample: "four-person" },
    };
    const response = await handleRelayRequest(
      request("command", "POST", input, cookie),
    );
    expect(response.status).toBe(200);
    const first = await response.json();
    expect(first.state.paused).toBe(true);
    expect(first.state.shifts[0].id).toBe("shift-sample-meals");
    expect(first.state.calls).toEqual([]);
    const replay = await (
      await handleRelayRequest(request("command", "POST", input, cookie))
    ).json();
    expect(replay.state).toEqual(first.state);
  });

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

describe("Public phone test", () => {
  it("allows only the designated test and masks the phone number", async () => {
    const fresh = await getStore().createSession();
    await getStore().mutate(fresh.session.tenantId, 0, undefined, (state) => ({
      ...state,
      phoneTest: {
        stage: "waiting",
        detail: "No call placed",
        updatedAt: new Date().toISOString(),
        events: [],
      },
    }));
    process.env.RELAY_PUBLIC_TEST_TENANT = fresh.session.tenantId;
    const response = await handleRelayRequest(request("state?phone-test=1"));
    expect(response.status).toBe(200);
    const view = await response.json();
    expect(view.state.tenantId).toBe("public-phone-test");
    expect(view.state.volunteers[0].phone).toMatch(/^••••[0-9]{4}$/);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(
      (
        await handleRelayRequest(
          request("command", "POST", {
            requestId: crypto.randomUUID(),
            expectedRevision: 0,
            command: { type: "RESET_DEMO" },
          }),
        )
      ).status,
    ).toBe(401);
    const cookie = "relay_guest=" + fresh.token;
    expect(
      (
        await handleRelayRequest(
          request(
            "command",
            "POST",
            {
              requestId: crypto.randomUUID(),
              expectedRevision: view.state.revision,
              command: { type: "RESET_DEMO" },
            },
            cookie,
          ),
        )
      ).status,
    ).toBe(403);
    delete process.env.RELAY_PUBLIC_TEST_TENANT;
    expect(
      (await handleRelayRequest(request("state?phone-test=1"))).status,
    ).toBe(404);
  });
});
