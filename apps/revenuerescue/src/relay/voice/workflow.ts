import { applyCommand, coverage, monitor, startNextCall } from "../engine";
import type { RelayState } from "../contracts";

/** The website authorizes one bounded replacement sequence when starting this demo. */
export function advanceOutbound(state: RelayState, now: string): RelayState {
  if (state.phoneTest?.mode !== "outbound" || state.paused) return state;
  if (Date.parse(state.phoneTest.closesAt || "1970-01-01") <= Date.parse(now))
    return { ...state, paused: true };
  if (
    state.phoneTest.scheduledFor &&
    !state.calls.some((call) => call.startedAt) &&
    Date.parse(now) - Date.parse(state.phoneTest.scheduledFor) > 120_000
  )
    return {
      ...state,
      paused: true,
      phoneTest: {
        ...state.phoneTest,
        stage: "stopped",
        detail: "The scheduled start window was missed. No calls were placed.",
        updatedAt: now,
      },
    };
  if (!state.phoneTest.startedAt) {
    const due = Date.parse(state.phoneTest.scheduledFor || "");
    if (!Number.isFinite(due) || Date.parse(now) < due) return state;
    if (Date.parse(now) - due > 120_000)
      return {
        ...state,
        paused: true,
        phoneTest: {
          ...state.phoneTest,
          stage: "stopped",
          detail:
            "The scheduled start window was missed. No calls were placed.",
          updatedAt: now,
        },
      };
    state = {
      ...state,
      phoneTest: {
        ...state.phoneTest,
        startedAt: now,
        detail: "The scheduled inquiry time has arrived.",
        updatedAt: now,
      },
    };
  }
  let next = monitor(state, now);
  for (const incident of next.incidents.filter(
    (i) => i.status === "pending" && i.candidates.length,
  )) {
    // Only an explicit check-in refusal starts automatic substitution. Ambiguous speech never does.
    if (
      !next.calls.some(
        (c) =>
          c.shiftId === incident.shiftId &&
          c.purpose === "check_in" &&
          c.status === "completed" &&
          c.result?.outcome === "declined" &&
          c.result.confidence >= 0.8 &&
          !c.result.clarification,
      )
    )
      continue;
    next = applyCommand(
      next,
      { type: "DECIDE_INCIDENT", incidentId: incident.id, decision: "yes" },
      now,
    );
  }
  next = monitor(next, now);
  const finished =
    next.calls.length > 0 &&
    next.calls.every((c) => !["in_progress", "analyzing"].includes(c.status));
  const covered = next.shifts
    .filter((s) => s.status === "published")
    .every((s) => coverage(next, s.id).confirmed >= s.required);
  if (finished && covered)
    return {
      ...next,
      paused: true,
      phoneTest: {
        ...next.phoneTest!,
        stage: "completed",
        detail:
          "Attendance confirmed and the schedule saved. No further calls will be placed.",
        updatedAt: now,
      },
    };
  if (
    finished &&
    next.incidents.some(
      (i) =>
        i.status === "exhausted" ||
        (i.status === "pending" && !i.candidates.length),
    )
  )
    return {
      ...next,
      paused: true,
      phoneTest: {
        ...next.phoneTest!,
        stage: "failed",
        detail:
          "No eligible replacement accepted. The shift remains uncovered.",
        updatedAt: now,
      },
    };
  if (
    next.calls.filter((c) => c.startedAt).length >=
      Number(process.env.VOICE_MAX_CALLS || "2") &&
    !next.calls.some(
      (c) => c.status === "in_progress" || c.status === "analyzing",
    )
  )
    return {
      ...next,
      paused: true,
      phoneTest: {
        ...next.phoneTest!,
        stage: "stopped",
        detail: "The authorized call limit was reached. Review the schedule.",
        updatedAt: now,
      },
    };
  if (finished && !next.calls.some((call) => call.status === "queued"))
    return {
      ...next,
      paused: true,
      phoneTest: {
        ...next.phoneTest!,
        stage: "stopped",
        detail:
          "The answer did not confirm full coverage. Automatic outreach stopped for review.",
        updatedAt: now,
      },
    };
  if (next.calls.some((c) => c.contactId && !c.disconnectedAt)) return next;
  return startNextCall(next, now, "amazon-connect");
}
