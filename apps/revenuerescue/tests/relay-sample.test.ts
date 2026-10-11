import { describe, expect, it } from "vitest";
import { createSampleSchedule } from "../src/relay/seed";
import {
  applyCommand,
  completeCall,
  coverage,
  eligibleCandidates,
  monitor,
  startNextCall,
} from "../src/relay/engine";
import type { CallOutcome, RelayState } from "../src/relay/contracts";

const NOW = "2026-10-11T21:10:00.000Z";
const MAIN = "shift-sample-meals";
function prepare(shiftId = MAIN) {
  let state = createSampleSchedule("sample-test", NOW);
  state = applyCommand(state, { type: "PUBLISH_SHIFT", shiftId }, NOW);
  return applyCommand(state, { type: "SET_PAUSED", paused: false }, NOW);
}
const tick = (state: RelayState) => startNextCall(monitor(state, NOW), NOW);
function respond(state: RelayState, outcome: CallOutcome) {
  state = tick(state);
  const call = state.calls.find((item) => item.status === "in_progress")!;
  expect(call).toBeDefined();
  return monitor(
    completeCall(
      state,
      call.id,
      {
        outcome,
        summary: `Fictional test result: ${outcome}`,
        confidence: outcome === "uncertain" ? 0.4 : 1,
        clarification:
          outcome === "uncertain" ? "Can you cover the full shift?" : "",
        availableFrom: null,
        availableUntil: null,
      },
      "manual-simulator",
      "Fictional test input",
      NOW,
    ),
    NOW,
  );
}
function approve(state: RelayState) {
  return applyCommand(
    state,
    {
      type: "DECIDE_INCIDENT",
      incidentId: state.incidents[0].id,
      decision: "yes",
    },
    NOW,
  );
}
describe("four-person sample schedule", () => {
  it.each([NOW, "2026-12-31T23:58:00.000Z", "2026-11-01T05:58:00.000Z"])(
    "creates future drafts without calls at %s",
    (now) => {
      const state = createSampleSchedule("sample", now);
      expect(state.paused).toBe(true);
      expect(state.shifts).toHaveLength(3);
      expect(state.volunteers).toHaveLength(5);
      expect(
        state.shifts.every(
          (shift) =>
            shift.status === "draft" &&
            Date.parse(shift.start) > Date.parse(now),
        ),
      ).toBe(true);
      expect(
        state.volunteers.every((p) => /^\+120255501\d{2}$/.test(p.phone)),
      ).toBe(true);
      expect(tick(state).calls).toEqual([]);
    },
  );
  it("excludes the busy volunteer and commits only the accepting second replacement", () => {
    let state = respond(prepare(), "declined");
    expect(
      eligibleCandidates(state, MAIN, NOW).map((c) => c.volunteerId),
    ).toEqual(["vol-avery", "vol-samira"]);
    state = respond(approve(state), "declined");
    state = respond(state, "confirmed");
    expect(
      state.assignments
        .filter((a) => a.shiftId === MAIN && a.status !== "cancelled")
        .map((a) => a.volunteerId),
    ).toEqual(["vol-samira"]);
    expect(coverage(state, MAIN).confirmed).toBe(1);
    expect(
      tick(state).calls.filter((c) => c.status === "in_progress"),
    ).toHaveLength(0);
    expect(state.calls.map((c) => c.volunteerId)).toEqual([
      "vol-taylor",
      "vol-avery",
      "vol-samira",
    ]);
  });
  it("stops after the original volunteer confirms", () => {
    const state = tick(respond(prepare(), "confirmed"));
    expect(state.calls).toHaveLength(1);
    expect(state.incidents).toHaveLength(0);
    expect(coverage(state, MAIN).confirmed).toBe(1);
  });
  it("does not invent confirmed coverage from uncertainty", () => {
    const state = respond(prepare(), "uncertain");
    expect(coverage(state, MAIN).confirmed).toBe(0);
    expect(state.calls.filter((c) => c.purpose === "replacement")).toHaveLength(
      0,
    );
  });
  it("leaves the shift uncovered when both eligible replacements refuse", () => {
    let state = approve(respond(prepare(), "declined"));
    state = respond(state, "declined");
    state = tick(respond(state, "declined"));
    expect(state.incidents[0].status).toBe("exhausted");
    expect(coverage(state, MAIN).status).toBe("Uncovered");
    expect(state.calls).toHaveLength(3);
  });
  it("does not suggest unqualified volunteers for the supply-lead shift", () => {
    const state = respond(prepare("shift-sample-supplies"), "declined");
    expect(eligibleCandidates(state, "shift-sample-supplies", NOW)).toEqual([]);
    expect(coverage(state, "shift-sample-supplies").status).toBe("Uncovered");
  });
});
