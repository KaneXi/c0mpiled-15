import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRelayState } from "../src/relay/seed";
import { applyCommand } from "../src/relay/engine";
import { advanceOutbound } from "../src/relay/voice/workflow";
import type { Interpretation, RelayState } from "../src/relay/contracts";
const mock = vi.hoisted(() => ({
  interpret: vi.fn(),
  state: undefined as RelayState | undefined,
}));
vi.mock("../src/relay/server/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/relay/server/store")>()),
  DynamoRelayStore: class {
    async read() {
      return structuredClone(mock.state!);
    }
    async reserveAnalysis() {}
    async mutate(
      _t: unknown,
      _r: unknown,
      _receipt: unknown,
      change: (s: RelayState) => RelayState,
    ) {
      mock.state = change(mock.state!);
      return mock.state;
    }
  },
}));
vi.mock("../src/relay/providers/agent", () => ({
  createAgentProvider: () => ({ interpret: mock.interpret }),
}));
vi.mock("../src/relay/voice/transport", () => ({ tickOutbound: vi.fn() }));
import { handler } from "../src/relay/voice/handler";
const now = "2026-10-11T21:00:00.000Z";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  vi.stubEnv("LEX_BOT_ID", "test-bot");
  vi.stubEnv("LEX_ALIAS_ID", "test-alias");
  vi.stubEnv("VOICE_DEMO_ENDS_AT", "2026-10-11T23:00:00Z");
  let state = createRelayState("test", now);
  state.shifts = state.shifts.slice(0, 1);
  state.assignments = state.assignments.slice(0, 1);
  state = applyCommand(
    state,
    { type: "PUBLISH_SHIFT", shiftId: state.shifts[0].id },
    now,
  );
  state.phoneTest = {
    mode: "outbound",
    runId: "test-run",
    startedAt: now,
    closesAt: "2026-10-11T22:00:00Z",
    stage: "calling",
    detail: "Test",
    updatedAt: now,
    events: [],
  };
  state = advanceOutbound(state, now);
  state.calls[0].contactId = "contact-1";
  mock.state = state;
  mock.interpret.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
function result(outcome: Interpretation["outcome"]): {
  interpretation: Interpretation;
  provider: string;
} {
  return {
    provider: "amazon-bedrock",
    interpretation: {
      outcome,
      confidence: 0.95,
      summary: "Fictional interpretation",
      clarification: outcome === "uncertain" ? "Please clarify" : "",
      availableFrom: null,
      availableUntil: null,
    },
  };
}
function event(text: string, attrs?: Record<string, string>) {
  return {
    bot: { id: "test-bot", aliasId: "test-alias" },
    sessionId: "session-1",
    inputTranscript: text,
    sessionState: {
      intent: { name: "RelayRequest" },
      sessionAttributes: attrs || {
        relayCallId: mock.state!.calls[0].id,
        relayContactId: "contact-1",
      },
    },
  };
}
it("supplies the full question for a short yes and immediately saves the responsible volunteer", async () => {
  mock.interpret.mockResolvedValue(result("confirmed"));
  const response = await handler(event("yes"));
  expect(mock.interpret.mock.calls[0][0].transcript).toContain(
    "Can you cover that entire time slot?",
  );
  expect(mock.state!.assignments[0].status).toBe("confirmed");
  expect(mock.state!.phoneTest!.events.at(-1)?.text).toContain(
    "Manager notified:",
  );
  expect(response).toHaveProperty("sessionState.dialogAction.type", "Close");
  expect(advanceOutbound(mock.state!, now).calls).toHaveLength(1);
});
it("clarifies contradictory transcription without swapping anyone, then applies a clear correction", async () => {
  mock.interpret
    .mockResolvedValueOnce(result("uncertain"))
    .mockResolvedValueOnce(result("confirmed"));
  const clarification = await handler(event("yes I can't"));
  expect(mock.state!.calls[0].status).toBe("in_progress");
  expect(mock.state!.assignments[0].status).toBe("assigned");
  expect(mock.state!.phoneTest!.events.at(-1)?.text).toContain("Clarifying");
  expect(clarification).toHaveProperty(
    "sessionState.dialogAction.type",
    "ElicitIntent",
  );
  if (!("sessionState" in clarification))
    throw new Error("Missing voice response");
  await handler(
    event("I am available", clarification.sessionState.sessionAttributes),
  );
  expect(mock.state!.assignments[0].status).toBe("confirmed");
  expect(mock.state!.calls).toHaveLength(1);
  expect(mock.interpret.mock.calls[1][0].transcript).toContain(
    "Volunteer: I am available",
  );
});
it("records a clear no for the manager before a replacement can start", async () => {
  mock.interpret.mockResolvedValue(result("declined"));
  await handler(event("no"));
  expect(mock.state!.assignments[0].status).toBe("cancelled");
  expect(mock.state!.phoneTest!.events.at(-1)?.text).toContain(
    "Manager notified:",
  );
  expect(mock.state!.calls).toHaveLength(1);
});
