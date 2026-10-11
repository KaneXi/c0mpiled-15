import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { relayApi, RelayApiError } from "./api";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("polling reads state without issuing a workflow command", async () => {
  let called = false;
  globalThis.fetch = async (input, init) => {
    assert.equal(input, "/api/relay/state");
    assert.equal(init?.method, undefined);
    assert.equal(init?.body, undefined);
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    called = true;
    return Response.json({ state: { revision: 7 } });
  };
  const view = await relayApi.read();
  assert.equal(view.state.revision, 7);
  assert.ok(called);
});

test("mutations carry the displayed revision, UUID and explicit manual outcome", async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(input, "/api/relay/command");
    assert.equal(init?.method, "POST");
    const envelope = JSON.parse(String(init?.body));
    assert.match(envelope.requestId, /^[a-f0-9-]{36}$/);
    assert.equal(envelope.expectedRevision, 12);
    assert.deepEqual(envelope.command, {
      type: "SUBMIT_CALL",
      callId: "call-1",
      transcript: "I can help after lunch.",
      simulatedOutcome: "partial",
    });
    return Response.json({ state: { revision: 13 } });
  };
  await relayApi.command(
    {
      type: "SUBMIT_CALL",
      callId: "call-1",
      transcript: "I can help after lunch.",
      simulatedOutcome: "partial",
    },
    12,
  );
});

test("conflicts preserve the server error and never turn into success", async () => {
  globalThis.fetch = async () =>
    Response.json({ error: "The schedule changed." }, { status: 409 });
  await assert.rejects(
    () => relayApi.command({ type: "SET_PAUSED", paused: true }, 2),
    (error) => {
      assert.ok(error instanceof RelayApiError);
      assert.equal(error.status, 409);
      assert.equal(error.message, "The schedule changed.");
      return true;
    },
  );
});

for (const [search, path] of [
  ["?phone-test=1", "/api/relay/state?phone-test=1"],
  ["?phone-test=2", "/api/relay/state"],
]) {
  test(`browser query ${search} selects only its intended read endpoint`, async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { search } },
    });
    try {
      globalThis.fetch = async (input, init) => {
        assert.equal(input, path);
        assert.equal(init?.method, undefined);
        assert.equal(init?.body, undefined);
        return Response.json({ state: { revision: 8 } });
      };
      await relayApi.read();
    } finally {
      if (previous) Object.defineProperty(globalThis, "window", previous);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });
}
