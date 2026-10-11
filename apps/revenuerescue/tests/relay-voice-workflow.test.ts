import { describe, expect, it } from "vitest";
import { createRelayState } from "../src/relay/seed";
import { advanceOutbound } from "../src/relay/voice/workflow";
import { applyCommand, completeCall, coverage } from "../src/relay/engine";
import type { CallOutcome, RelayState } from "../src/relay/contracts";
const now = "2026-10-11T21:00:00.000Z";
function initial() {
  let state = createRelayState("voice-test", now);
  state.volunteers = state.volunteers.filter((v) =>
    ["vol-manager", "vol-taylor", "vol-avery"].includes(v.id),
  );
  state.shifts = state.shifts.slice(0, 1);
  state.assignments = state.assignments.slice(0, 1);
  state.settings.maxAttempts = 1;
  state = applyCommand(
    state,
    { type: "PUBLISH_SHIFT", shiftId: "shift-meals" },
    now,
  );
  state.phoneTest = {
    mode: "outbound",
    startedAt: now,
    closesAt: "2026-10-11T22:00:00.000Z",
    stage: "ready",
    detail: "Test",
    updatedAt: now,
    events: [],
  };
  return state;
}
function finish(state: RelayState, outcome: CallOutcome) {
  const call = state.calls.find((c) => c.status === "in_progress")!;
  const next = completeCall(
    state,
    call.id,
    {
      outcome,
      confidence: 1,
      summary: "Test",
      clarification: "",
      availableFrom: null,
      availableUntil: null,
    },
    "amazon-bedrock",
    "Fictional test",
    now,
  );
  return next;
}
describe("bounded real-call orchestration", () => {
  it("waits for disconnection, then calls the replacement only after explicit refusal", () => {
    let state = advanceOutbound(initial(), now);
    expect(state.calls[0].transport).toBe("amazon-connect");
    state.calls[0].contactId = "contact-1";
    state = finish(state, "declined");
    state = advanceOutbound(state, now);
    expect(state.calls.filter((c) => c.status === "in_progress")).toHaveLength(
      0,
    );
    state.calls[0].disconnectedAt = now;
    state = advanceOutbound(state, now);
    expect(
      state.calls.find((c) => c.status === "in_progress")?.volunteerId,
    ).toBe("vol-avery");
    state = advanceOutbound(finish(state, "confirmed"), now);
    expect(coverage(state, "shift-meals").confirmed).toBe(1);
    expect(state.paused).toBe(true);
    expect(state.phoneTest?.stage).toBe("completed");
    expect(advanceOutbound(state, now).calls).toHaveLength(2);
  });
  it.each(["uncertain", "no_answer", "partial"] as CallOutcome[])(
    "does not automatically replace the original for %s",
    (outcome) => {
      const state = advanceOutbound(
        finish(advanceOutbound(initial(), now), outcome),
        now,
      );
      expect(
        state.calls.filter(
          (c) => c.purpose === "replacement" && c.status === "in_progress",
        ),
      ).toHaveLength(0);
    },
  );
  it("does not dispatch when paused or expired", () => {
    const state = initial();
    state.paused = true;
    expect(advanceOutbound(state, now).calls).toHaveLength(0);
    state.paused = false;
    expect(advanceOutbound(state, "2026-10-11T23:00:00.000Z").paused).toBe(
      true,
    );
  });
  it("ends without an assignment when the only replacement refuses", () => {
    let state = advanceOutbound(
      finish(advanceOutbound(initial(), now), "declined"),
      now,
    );
    state = advanceOutbound(finish(state, "declined"), now);
    expect(state.paused).toBe(true);
    expect(coverage(state, "shift-meals").confirmed).toBe(0);
    expect(state.calls).toHaveLength(2);
  });
});
