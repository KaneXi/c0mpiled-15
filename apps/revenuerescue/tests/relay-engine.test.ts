import { describe, expect, it } from "vitest";
import {
  applyCommand,
  completeCall,
  coverage,
  createRelayState,
  eligibleCandidates,
  monitor,
  startNextCall,
} from "../src/relay/engine";
import type {
  CallOutcome,
  DomainCommand,
  Interpretation,
  RelayState,
  VolunteerInput,
} from "../src/relay/contracts";

const NOW = "2026-10-12T14:00:00.000Z";
const MEALS = "shift-meals";
const at = (minutes: number) =>
  new Date(Date.parse(NOW) + minutes * 60_000).toISOString();
const command = (state: RelayState, value: DomainCommand, now = NOW) =>
  applyCommand(state, value, now);
const publish = (state = createRelayState("tenant-one", NOW)) =>
  command(state, { type: "PUBLISH_SHIFT", shiftId: MEALS });
const tick = (state: RelayState, now = NOW) =>
  startNextCall(monitor(state, now), now);
const activeCall = (state: RelayState) => {
  const call = state.calls.find((row) => row.status === "in_progress");
  if (!call) throw new Error("Expected an active call.");
  return call;
};
const result = (
  outcome: CallOutcome,
  extra: Partial<Interpretation> = {},
): Interpretation => ({
  outcome,
  summary: `Structured simulator result: ${outcome}.`,
  confidence: 1,
  clarification: "",
  availableFrom: null,
  availableUntil: null,
  ...extra,
});
const respond = (
  state: RelayState,
  outcome: CallOutcome,
  now = NOW,
  extra: Partial<Interpretation> = {},
) =>
  completeCall(
    state,
    activeCall(state).id,
    result(outcome, extra),
    "manual-simulator",
    "A recorded fictional simulator response.",
    now,
  );
function gap() {
  return monitor(respond(tick(publish()), "declined"), NOW);
}
function approved() {
  const state = gap();
  return command(state, {
    type: "DECIDE_INCIDENT",
    incidentId: state.incidents[0].id,
    decision: "yes",
  });
}
function updatePerson(
  state: RelayState,
  volunteerId: string,
  changes: Partial<VolunteerInput>,
) {
  const { id: ignored, ...input } = state.volunteers.find(
    (row) => row.id === volunteerId,
  )!;
  void ignored;
  return command(state, {
    type: "SAVE_VOLUNTEER",
    id: volunteerId,
    volunteer: { ...input, ...changes },
  });
}
function deeplyFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) deeplyFreeze(child);
  }
  return value;
}

describe("manager schedule and constraints", () => {
  it("seeds unpublished drafts with fictional mandatory numbers; monitoring never publishes", () => {
    const state = createRelayState("tenant-one", NOW);
    expect(state.shifts.every((shift) => shift.status === "draft")).toBe(true);
    expect(
      state.volunteers.every((person) =>
        /^\+120255501\d{2}$/.test(person.phone),
      ),
    ).toBe(true);
    expect(monitor(state, NOW)).toBe(state);
    expect(startNextCall(state, NOW)).toBe(state);
  });
  it("plans ordinary check-ins automatically after human publication, with idempotent ticks", () => {
    const published = publish();
    expect(published.calls).toHaveLength(0);
    const queued = monitor(published, NOW);
    expect(queued.calls[0]).toMatchObject({
      status: "queued",
      purpose: "check_in",
      shiftVersion: 2,
      assignmentId: "assignment-taylor",
    });
    expect(monitor(queued, NOW)).toBe(queued);
    const started = startNextCall(queued, NOW);
    expect(activeCall(started).transport).toBe("simulated");
    expect(startNextCall(started, NOW)).toBe(started);
    expect(started.revision).toBe(0);
  });
  it("validates and normalizes phones; rejects unknown availability, missing roles and double assignments", () => {
    const state = createRelayState("tenant-one", NOW);
    expect(() => updatePerson(state, "vol-avery", { phone: "123" })).toThrow();
    expect(
      updatePerson(state, "vol-avery", {
        phone: "+1 (202) 555-0102",
      }).volunteers.find((row) => row.id === "vol-avery")?.phone,
    ).toBe("+12025550102");
    expect(() =>
      command(state, {
        type: "ASSIGN",
        shiftId: MEALS,
        volunteerId: "vol-taylor",
      }),
    ).toThrow(/overlapping/);
    expect(() =>
      command(state, {
        type: "ASSIGN",
        shiftId: MEALS,
        volunteerId: "vol-avery",
      }),
    ).toThrow(/coverage/);
    const empty = command(state, {
      type: "CANCEL_ASSIGNMENT",
      assignmentId: "assignment-taylor",
    });
    expect(() =>
      command(updatePerson(empty, "vol-avery", { availability: [] }), {
        type: "ASSIGN",
        shiftId: MEALS,
        volunteerId: "vol-avery",
      }),
    ).toThrow(/availability/);
    expect(() =>
      command(updatePerson(empty, "vol-avery", { roles: ["welcome"] }), {
        type: "ASSIGN",
        shiftId: MEALS,
        volunteerId: "vol-avery",
      }),
    ).toThrow(/role/);
  });
  it("allows back-to-back assignments and adjacent availability, but rejects one-minute overlap", () => {
    let state = updatePerson(
      createRelayState("tenant-one", NOW),
      "vol-taylor",
      {
        availability: [
          { start: at(45), end: at(105) },
          { start: at(105), end: at(300) },
        ],
      },
    );
    state = command(state, {
      type: "SAVE_SHIFT",
      shift: {
        title: "Adjacent",
        role: "meal-packing",
        start: at(165),
        end: at(200),
        required: 1,
      },
    });
    state = command(state, {
      type: "ASSIGN",
      shiftId: state.shifts.at(-1)!.id,
      volunteerId: "vol-taylor",
    });
    state = command(state, {
      type: "SAVE_SHIFT",
      shift: {
        title: "Overlapping",
        role: "meal-packing",
        start: at(164),
        end: at(190),
        required: 1,
      },
    });
    expect(() =>
      command(state, {
        type: "ASSIGN",
        shiftId: state.shifts.at(-1)!.id,
        volunteerId: "vol-taylor",
      }),
    ).toThrow(/overlapping/);
  });
  it("prevents published schedule edits and publication after start", () => {
    const state = publish();
    const { id, status, version, ...shift } = state.shifts[0];
    void status;
    void version;
    expect(() => command(state, { type: "SAVE_SHIFT", id, shift })).toThrow(
      /locked/,
    );
    expect(() =>
      command(
        createRelayState("tenant-one", NOW),
        { type: "PUBLISH_SHIFT", shiftId: id },
        at(46),
      ),
    ).toThrow(/before/);
  });
  it("never mutates its input, including failed commands, and never changes repository revision", () => {
    const original = deeplyFreeze(publish());
    const before = JSON.stringify(original);
    const next = tick(original);
    expect(JSON.stringify(original)).toBe(before);
    expect(next.revision).toBe(original.revision);
    const frozen = deeplyFreeze(next);
    expect(() =>
      command(frozen, {
        type: "ASSIGN",
        shiftId: MEALS,
        volunteerId: "vol-avery",
      }),
    ).toThrow();
    expect(JSON.stringify(original)).toBe(before);
  });
});

describe("calling policy and persistence recovery", () => {
  it.each([{ callingConsent: false }, { optedOut: true }, { active: false }])(
    "does not queue contacts blocked by %j",
    (changes) => {
      expect(
        tick(updatePerson(publish(), "vol-taylor", changes)).calls,
      ).toHaveLength(0);
    },
  );
  it("waits through cross-midnight quiet hours and resumes a persisted queue", () => {
    const night = "2026-10-13T02:00:00.000Z";
    let state = createRelayState("night-tenant", night);
    state.shifts[0].start = "2026-10-13T13:00:00.000Z";
    state.shifts[0].end = "2026-10-13T14:00:00.000Z";
    state.settings.checkInLeadMinutes = 1440;
    state = command(state, { type: "PUBLISH_SHIFT", shiftId: MEALS }, night);
    const queued = monitor(state, night);
    expect(queued.calls).toHaveLength(1);
    expect(startNextCall(queued, night)).toBe(queued);
    expect(
      activeCall(
        tick(
          JSON.parse(JSON.stringify(queued)) as RelayState,
          "2026-10-13T12:00:00.000Z",
        ),
      ).volunteerId,
    ).toBe("vol-taylor");
  });
  it("pauses new calls while monitoring continues and lets an active call finish safely", () => {
    let state = tick(command(publish(), { type: "SET_PAUSED", paused: true }));
    expect(state.calls[0].status).toBe("queued");
    expect(startNextCall(state, NOW)).toBe(state);
    state = tick(command(state, { type: "SET_PAUSED", paused: false }));
    state = respond(
      command(state, { type: "SET_PAUSED", paused: true }),
      "confirmed",
    );
    expect(state.assignments[0].status).toBe("confirmed");
    expect(state.paused).toBe(true);
    expect(startNextCall(state, NOW)).toBe(state);
  });
  it("cancels queued/active calls when consent is withdrawn and ignores late results", () => {
    for (const initial of [monitor(publish(), NOW), tick(publish())]) {
      const callId = initial.calls[0].id;
      const changed = updatePerson(initial, "vol-taylor", {
        callingConsent: false,
      });
      expect(changed.calls[0].status).toBe("cancelled");
      expect(
        completeCall(
          changed,
          callId,
          result("confirmed"),
          "manual-simulator",
          "Yes",
          NOW,
        ),
      ).toBe(changed);
      expect(
        changed.activity.some(
          (row) => row.callId === callId && row.outcome === "cancelled",
        ),
      ).toBe(true);
    }
  });
  it("bounds no-answer check-in retries without duplicate planning", () => {
    let state = tick(publish());
    for (let attempt = 1; attempt <= 3; attempt++) {
      expect(activeCall(state).attempt).toBe(attempt);
      const queued = monitor(
        respond(state, "no_answer", at((attempt - 1) * 5)),
        at((attempt - 1) * 5),
      );
      expect(monitor(queued, at((attempt - 1) * 5))).toBe(queued);
      expect(startNextCall(queued, at((attempt - 1) * 5))).toBe(queued);
      state = attempt < 3 ? startNextCall(queued, at(attempt * 5)) : queued;
    }
    expect(state.calls).toHaveLength(3);
    expect(monitor(state, at(30))).toBe(state);
    expect(state.incidents).toHaveLength(1);
  });
  it("stops ended shifts and rejects a confirmation for an old schedule version", () => {
    const active = tick(publish());
    const ended = monitor(active, at(166));
    expect(ended.calls[0].status).toBe("cancelled");
    expect(eligibleCandidates(ended, MEALS, at(166))).toEqual([]);
    const changed = structuredClone(active);
    changed.shifts[0].version++;
    const finished = respond(changed, "confirmed");
    expect(finished.assignments[0].status).toBe("assigned");
    expect(finished.activity.at(-1)?.nextAction).toMatch(/schedule changed/i);
  });
  it("does not turn provider failures into automatic new calls on every tick", () => {
    const failed = tick(publish());
    failed.calls[0].status = "failed";
    failed.calls[0].error =
      "The interpretation provider is unavailable. Retry this call explicitly.";
    expect(monitor(failed, NOW)).toBe(failed);
    expect(monitor(failed, at(10))).toBe(failed);
    expect(failed.calls).toHaveLength(1);
  });
});

describe("semantic results and deterministic risk", () => {
  it("uses structured interpretation, never matching keywords in transcript text", () => {
    const state = tick(publish());
    const finished = completeCall(
      state,
      activeCall(state).id,
      result("declined"),
      "amazon-bedrock",
      "Yes, I said I could earlier, but the train was cancelled and I cannot make it.",
      NOW,
    );
    expect(finished.assignments[0].status).toBe("cancelled");
    expect(coverage(finished, MEALS)).toMatchObject({
      assigned: 0,
      confirmed: 0,
      gap: 1,
      status: "Uncovered",
    });
  });
  it.each(["uncertain", "partial", "question", "late"] as CallOutcome[])(
    "does not invent availability from %s",
    (outcome) => {
      const finished = respond(tick(publish()), outcome);
      expect(finished.assignments[0].status).not.toBe("confirmed");
      expect(coverage(finished, MEALS)).toMatchObject({
        assigned: 1,
        confirmed: 0,
        gap: 1,
        status: "At risk",
      });
      expect(finished.volunteers[1].availability).toEqual(
        createRelayState("tenant-one", NOW).volunteers[1].availability,
      );
      expect(finished.activity.at(-1)?.nextAction).toMatch(/clarif/i);
    },
  );
  it("withholds confirmation for low confidence, clarification, and partial time windows", () => {
    for (const extra of [
      { confidence: 0.3 },
      { clarification: "Do you mean Monday?" },
      { availableFrom: at(70) },
      { availableUntil: at(120) },
    ]) {
      expect(
        respond(tick(publish()), "confirmed", NOW, extra).assignments[0].status,
      ).toBe("uncertain");
    }
    const state = tick(publish());
    expect(() =>
      completeCall(
        state,
        activeCall(state).id,
        {
          ...result("confirmed"),
          outcome: "unknown",
        } as unknown as Interpretation,
        "manual-simulator",
        "Unknown",
        NOW,
      ),
    ).toThrow();
    expect(state.assignments[0].status).toBe("assigned");
  });
  it("records opt-out separately from attendance and prevents future calls", () => {
    const finished = respond(tick(publish()), "opt_out");
    expect(
      finished.volunteers.find((row) => row.id === "vol-taylor"),
    ).toMatchObject({ optedOut: true, callingConsent: false });
    expect(finished.assignments[0].status).toBe("uncertain");
    expect(monitor(finished, at(5)).calls).toHaveLength(1);
  });
  it("ranks qualified available people with preferences and fair workload, excluding manager and original decliner", () => {
    let state = gap();
    expect(
      eligibleCandidates(state, MEALS, NOW).map((row) => row.volunteerId),
    ).toEqual(["vol-avery", "vol-samira", "vol-riley"]);
    state = command(state, {
      type: "SAVE_SHIFT",
      shift: {
        title: "Another duty",
        role: "meal-packing",
        start: at(200),
        end: at(500),
        required: 1,
      },
    });
    state = command(state, {
      type: "ASSIGN",
      shiftId: state.shifts.at(-1)!.id,
      volunteerId: "vol-avery",
    });
    expect(eligibleCandidates(state, MEALS, NOW)[0].volunteerId).toBe(
      "vol-samira",
    );
    state = updatePerson(state, "vol-samira", {
      availability: [{ start: at(46), end: at(165) }],
    });
    state = updatePerson(state, "vol-riley", { callingConsent: false });
    expect(
      eligibleCandidates(state, MEALS, NOW).map((row) => row.volunteerId),
    ).toEqual(["vol-avery"]);
  });
});

describe("manager-approved bounded replacement", () => {
  it("does not contact anyone before Yes and freezes the displayed candidate list", () => {
    const pending = gap();
    expect(
      tick(pending).calls.filter((row) => row.purpose === "replacement"),
    ).toHaveLength(0);
    const state = approved();
    expect(state.incidents[0].approvedCandidateIds).toEqual([
      "vol-avery",
      "vol-samira",
      "vol-riley",
    ]);
    expect(state.calls).toHaveLength(1);
    expect(activeCall(tick(state)).volunteerId).toBe("vol-avery");
  });
  it("executes decline then acceptance sequentially, commits one replacement, reports every call, and deduplicates completion", () => {
    let state = tick(approved());
    expect(activeCall(state).volunteerId).toBe("vol-avery");
    state = tick(respond(state, "declined"));
    expect(activeCall(state).volunteerId).toBe("vol-samira");
    const finalCallId = activeCall(state).id;
    state = respond(state, "confirmed");
    expect(coverage(state, MEALS)).toMatchObject({
      assigned: 1,
      confirmed: 1,
      gap: 0,
      status: "Covered",
    });
    expect(
      state.assignments
        .filter((row) => row.shiftId === MEALS && row.status !== "cancelled")
        .map((row) => row.volunteerId),
    ).toEqual(["vol-samira"]);
    expect(state.incidents[0]).toMatchObject({
      status: "covered",
      attemptedIds: ["vol-avery", "vol-samira"],
    });
    expect(monitor(state, NOW)).toBe(state);
    expect(
      completeCall(
        state,
        finalCallId,
        result("confirmed"),
        "manual-simulator",
        "Replay",
        NOW,
      ),
    ).toBe(state);
    for (const call of state.calls) {
      const report = state.activity.find(
        (row) => row.callId === call.id && row.outcome === call.result?.outcome,
      );
      expect(report).toMatchObject({
        at: NOW,
        volunteerId: call.volunteerId,
        transport: "simulated",
      });
      expect(report?.nextAction).toBeTruthy();
      expect(report?.text).toContain(
        state.volunteers.find((row) => row.id === call.volunteerId)!.name,
      );
    }
  });
  it("falls back after no answer and never exceeds the approved limit", () => {
    const pending = gap();
    pending.incidents[0].maxAttempts = 2;
    let state = tick(
      command(pending, {
        type: "DECIDE_INCIDENT",
        incidentId: pending.incidents[0].id,
        decision: "yes",
      }),
    );
    state = tick(respond(state, "no_answer"));
    expect(activeCall(state).volunteerId).toBe("vol-samira");
    state = tick(respond(state, "declined"));
    expect(state.incidents[0].status).toBe("exhausted");
    expect(
      state.calls.filter((row) => row.purpose === "replacement"),
    ).toHaveLength(2);
    expect(state.calls.some((row) => row.volunteerId === "vol-riley")).toBe(
      false,
    );
  });
  it("No stops a plan permanently without new calls on repeated monitoring", () => {
    const pending = gap();
    const rejected = command(pending, {
      type: "DECIDE_INCIDENT",
      incidentId: pending.incidents[0].id,
      decision: "no",
    });
    expect(rejected.incidents[0].status).toBe("rejected");
    expect(tick(rejected)).toBe(rejected);
    expect(() =>
      command(rejected, {
        type: "DECIDE_INCIDENT",
        incidentId: rejected.incidents[0].id,
        decision: "yes",
      }),
    ).toThrow(/no longer/);
  });
  it("Assign myself validates the manager and atomically replaces an uncertain original without requiring calling consent", () => {
    let pending = monitor(respond(tick(publish()), "uncertain"), NOW);
    pending = updatePerson(pending, "vol-manager", { callingConsent: false });
    const assigned = command(pending, {
      type: "DECIDE_INCIDENT",
      incidentId: pending.incidents[0].id,
      decision: "myself",
    });
    expect(
      assigned.assignments.find((row) => row.id === "assignment-taylor")
        ?.status,
    ).toBe("cancelled");
    expect(
      assigned.assignments.filter(
        (row) => row.shiftId === MEALS && row.status !== "cancelled",
      ),
    ).toEqual([
      expect.objectContaining({
        volunteerId: "vol-manager",
        status: "confirmed",
      }),
    ]);
    expect(assigned.calls).toHaveLength(pending.calls.length);
    expect(assigned.incidents[0].status).toBe("covered");
    expect(() =>
      command(updatePerson(pending, "vol-manager", { availability: [] }), {
        type: "DECIDE_INCIDENT",
        incidentId: pending.incidents[0].id,
        decision: "myself",
      }),
    ).toThrow(/availability/);
  });
  it("revalidates eligibility at both start and acceptance", () => {
    const state = approved();
    expect(
      activeCall(tick(updatePerson(state, "vol-avery", { availability: [] })))
        .volunteerId,
    ).toBe("vol-samira");
    const changed = tick(state);
    changed.volunteers.find((row) => row.id === "vol-avery")!.availability = [];
    const finished = respond(changed, "confirmed");
    expect(
      finished.assignments.filter(
        (row) => row.shiftId === MEALS && row.status !== "cancelled",
      ),
    ).toHaveLength(0);
    expect(finished.activity.at(-1)?.nextAction).toMatch(/no longer eligible/);
  });
  it("blocks stale acceptance after coverage, revocation, cancellation, or version changes", () => {
    const original = tick(approved());
    const callId = activeCall(original).id;
    for (const state of [
      command(original, {
        type: "ASSIGN",
        shiftId: MEALS,
        volunteerId: "vol-manager",
      }),
      command(original, {
        type: "REVOKE_INCIDENT",
        incidentId: original.incidents[0].id,
      }),
      command(original, { type: "CANCEL_SHIFT", shiftId: MEALS }),
    ]) {
      expect(state.calls.find((row) => row.id === callId)?.status).toBe(
        "cancelled",
      );
      expect(
        completeCall(
          state,
          callId,
          result("confirmed"),
          "manual-simulator",
          "Delayed response",
          NOW,
        ),
      ).toBe(state);
      expect(
        state.assignments.some(
          (row) =>
            row.volunteerId === "vol-avery" && row.status !== "cancelled",
        ),
      ).toBe(false);
    }
    const changed = structuredClone(original);
    changed.shifts[0].version++;
    expect(
      respond(changed, "confirmed").assignments.some(
        (row) => row.volunteerId === "vol-avery" && row.status !== "cancelled",
      ),
    ).toBe(false);
  });
  it("asks for clarification rather than assigning an uncertain replacement or continuing outreach", () => {
    const finished = respond(tick(approved()), "question", NOW, {
      clarification: "Which entrance should I use?",
    });
    expect(finished.incidents[0].status).toBe("cancelled");
    expect(
      finished.assignments.filter(
        (row) => row.shiftId === MEALS && row.status !== "cancelled",
      ),
    ).toHaveLength(0);
    expect(tick(finished).calls).toHaveLength(2);
    expect(finished.activity.at(-1)?.nextAction).toContain("Which entrance");
  });
  it("allows the current accepted replacement to finish safely while paused", () => {
    let state = command(tick(approved()), { type: "SET_PAUSED", paused: true });
    state = respond(state, "confirmed");
    expect(coverage(state, MEALS).gap).toBe(0);
    expect(state.paused).toBe(true);
    expect(tick(state)).toBe(state);
  });
});
