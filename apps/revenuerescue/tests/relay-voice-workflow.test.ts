import { describe, expect, it } from "vitest";
import { createRelayState } from "../src/relay/seed";
import { schedulePhoneTest } from "../src/relay/voice/control";
import { saveVoiceAnswer } from "../src/relay/voice/decision";
import { verifyVoiceDecision } from "../src/relay/voice/verify";
import { advanceOutbound } from "../src/relay/voice/workflow";
import { applyCommand, coverage } from "../src/relay/engine";
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
    runId: "fictional-run",
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
  const next = saveVoiceAnswer(
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
    "Fictional test",
    now,
  );
  return next.state;
}
describe("bounded real-call orchestration", () => {
  it("assigns the saved shift after a natural acceptance despite model timezone errors", async () => {
    let state = advanceOutbound(initial(), now);
    state = finish(state, "declined");
    state = advanceOutbound(state, now);
    const call = state.calls.find((item) => item.status === "in_progress")!;
    const shift = structuredClone(state.shifts[0]);
    const interpretation = await verifyVoiceDecision(
      {
        outcome: "confirmed",
        confidence: 0.95,
        summary: "The hours work.",
        clarification: "",
        availableFrom: shift.start.replace("Z", "-04:00"),
        availableUntil: shift.end.replace("Z", "-04:00"),
      },
      "Volunteer: yes it will work",
      `Can you cover the entire shift from ${shift.start} to ${shift.end}?`,
      new AbortController().signal,
      async () => ({
        $metadata: {},
        stopReason: "end_turn",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        metrics: { latencyMs: 1 },
        output: {
          message: {
            role: "assistant",
            content: [{ text: '{"supported":true}' }],
          },
        },
      }),
    );
    state = saveVoiceAnswer(
      state,
      call.id,
      interpretation,
      "yes it will work",
      now,
    ).state;
    expect(
      state.assignments
        .filter((item) => item.status === "confirmed")
        .map((item) => item.volunteerId),
    ).toEqual([call.volunteerId]);
    expect(state.shifts[0]).toEqual(shift);
    expect(advanceOutbound(state, now).calls).toHaveLength(2);
  });
  it("confirms an original yes immediately and never calls a replacement", () => {
    let s = advanceOutbound(initial(), now);
    const shift = structuredClone(s.shifts[0]);
    const original = s.calls[0].volunteerId;
    s = finish(s, "confirmed");
    expect(s.assignments.find((a) => a.volunteerId === original)?.status).toBe(
      "confirmed",
    );
    expect(s.phoneTest?.stage).toBe("completed");
    expect(s.phoneTest?.events.at(-1)?.text).toContain("Manager notified:");
    expect(s.shifts[0]).toEqual(shift);
    s = advanceOutbound(s, now);
    expect(s.calls).toHaveLength(1);
    expect(s.paused).toBe(true);
  });
  it("persists the manager refusal notice before starting a replacement, then saves its acceptance", () => {
    let s = advanceOutbound(initial(), now);
    s.phoneTest!.originalVolunteerId = s.calls[0].volunteerId;
    const shift = structuredClone(s.shifts[0]);
    s.calls[0].contactId = "original-contact";
    s = finish(s, "declined");
    expect(s.calls).toHaveLength(1);
    expect(s.phoneTest?.events.at(-1)?.text).toContain("declined");
    expect(s.activity.at(-1)?.nextAction).not.toContain("manager decision");
    s = advanceOutbound(s, now);
    expect(s.calls.filter((c) => c.status === "in_progress")).toHaveLength(0);
    s.calls[0].disconnectedAt = now;
    s = advanceOutbound(s, now);
    const replacement = s.calls.find((c) => c.status === "in_progress")!;
    s = finish(s, "confirmed");
    expect(
      s.assignments
        .filter((a) => a.status === "confirmed")
        .map((a) => a.volunteerId),
    ).toEqual([replacement.volunteerId]);
    expect(s.phoneTest?.events.at(-1)?.text).toContain(
      "Responsible volunteer changed from",
    );
    expect(s.shifts[0]).toEqual(shift);
    s = advanceOutbound(s, now);
    expect(s.calls).toHaveLength(2);
    expect(s.paused).toBe(true);
  });
  it("waits until the scheduled instant and starts exactly one original inquiry", () => {
    let state = initial();
    delete state.phoneTest!.startedAt;
    state.phoneTest!.callerNumber = "+12025550109";
    state.paused = true;
    state = schedulePhoneTest(state, "2026-10-11T21:02:00.000Z", now);
    expect(state.phoneTest!.stage).toBe("waiting");
    expect(
      advanceOutbound(state, "2026-10-11T21:01:59.999Z").calls,
    ).toHaveLength(0);
    state = advanceOutbound(state, "2026-10-11T21:02:00.000Z");
    expect(
      state.calls.filter((call) => call.status === "in_progress"),
    ).toHaveLength(1);
    expect(
      advanceOutbound(state, "2026-10-11T21:02:10.000Z").calls,
    ).toHaveLength(1);
  });
  it("rejects past times, expiry overflow and re-arming, and honors cancellation", () => {
    const state = initial();
    delete state.phoneTest!.startedAt;
    state.phoneTest!.callerNumber = "+12025550109";
    expect(() => schedulePhoneTest(state, now, now)).toThrow();
    expect(() =>
      schedulePhoneTest(state, "2026-10-11T21:58:00.000Z", now),
    ).toThrow();
    const scheduled = schedulePhoneTest(state, "2026-10-11T21:02:00.000Z", now);
    expect(() =>
      schedulePhoneTest(scheduled, "2026-10-11T21:03:00.000Z", now),
    ).toThrow();
    scheduled.paused = true;
    expect(
      advanceOutbound(scheduled, "2026-10-11T21:02:00.000Z").calls,
    ).toHaveLength(0);
    scheduled.paused = false;
    const stale = advanceOutbound(scheduled, "2026-10-11T21:04:01.000Z");
    expect(stale.paused).toBe(true);
    expect(stale.calls).toHaveLength(0);
  });

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
