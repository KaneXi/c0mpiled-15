import type { Call, RelayState, Shift } from "@/relay/contracts";

/** Assignment records, not model sentiment, determine whether coverage exists. */
export function managerMessages(state: RelayState) {
  const describe = (call: Call, shift: Shift, accepted: boolean, previous: boolean) => {
    if (!["completed", "failed", "cancelled"].includes(call.status)) return [];
    const name = state.volunteers.find((person) => person.id === call.volunteerId)?.name || "Volunteer";
    const declined = call.result?.outcome === "declined" && call.result.confidence >= 0.8 && !call.result.clarification;
    const noAnswer = call.result?.outcome === "no_answer";
    return [{
      id: `${shift.id}-${call.id}`,
      at: call.completedAt || call.startedAt || call.createdAt,
      start: shift.start,
      end: shift.end,
      shiftTitle: shift.title,
      previous,
      kind: accepted ? "confirmed" : "attention",
      label: accepted ? "Confirmed" : declined ? "Unavailable" : noAnswer ? "No answer" : "Needs attention",
      title: accepted ? `${name} confirmed the shift` : declined ? `${name} cannot cover the shift` : `${name}'s shift is not confirmed`,
      message: accepted
        ? `${name} is saved as responsible for this full time slot.`
        : declined
          ? "The refusal is saved for the manager. Check the live schedule for replacement progress."
          : noAnswer
            ? "The call was not answered. No new assignment was made from this call."
            : "The call did not produce a confirmed assignment. Review the schedule before relying on coverage.",
    }];
  };
  const current = state.calls.flatMap((call) => {
    const shift = state.shifts.find((row) => row.id === call.shiftId);
    if (!shift) return [];
    const accepted = state.assignments.some((row) => row.shiftId === shift.id && row.volunteerId === call.volunteerId && row.status === "confirmed");
    return describe(call, shift, accepted, false);
  });
  const history = (state.phoneTest?.history || []).flatMap((run) => run.calls.flatMap((call) => {
    const name = state.volunteers.find((person) => person.id === call.volunteerId)?.name;
    return describe(call, run.shift, !!name && run.assignmentNames.includes(name), true);
  }));
  return [...current, ...history].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
