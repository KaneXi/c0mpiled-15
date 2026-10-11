import type { Interpretation, RelayState } from "../contracts";
import { completeCall } from "../engine";
import { spokenShiftWindow } from "./prompts";

/** Save assignment and manager notification together, before any subsequent dispatch. */
export function saveVoiceAnswer(
  state: RelayState,
  callId: string,
  interpretation: Interpretation,
  transcript: string,
  now: string,
) {
  const call = state.calls.find((row) => row.id === callId)!;
  if (call.status === "completed")
    return {
      state,
      reply: "Your answer has already been saved. Thank you. Goodbye.",
    };
  const next = completeCall(
    state,
    callId,
    interpretation,
    "amazon-bedrock",
    transcript,
    now,
  );
  const person = next.volunteers.find((row) => row.id === call.volunteerId)!;
  const shift = next.shifts.find((row) => row.id === call.shiftId)!;
  const window = spokenShiftWindow(shift, person.timezone);
  const confirmed = next.assignments.some(
    (row) =>
      row.shiftId === shift.id &&
      row.volunteerId === person.id &&
      row.status === "confirmed",
  );
  const declined =
    interpretation.outcome === "declined" &&
    interpretation.confidence >= 0.8 &&
    !interpretation.clarification;
  const previous =
    state.volunteers.find(
      (row) => row.id === state.phoneTest?.originalVolunteerId,
    )?.name || "Original volunteer";
  const notice = confirmed
    ? `${person.name} confirmed ${shift.title}, ${window}. ${call.purpose === "replacement" ? `Responsible volunteer changed from ${previous} to ${person.name}.` : `${person.name} remains the responsible volunteer.`} No further candidates will be called.`
    : declined
      ? `${person.name} declined ${shift.title}, ${window}. The slot is not confirmed. After this call ends, Relay will ask the next eligible person within the authorized limit; if none remain, manager action is required.`
      : `${person.name}'s full availability for ${shift.title}, ${window}, is not confirmed. No replacement is assigned from this answer; manager review is needed.`;
  const reply = confirmed
    ? `Thank you, ${person.name}. You are confirmed for ${shift.title}, ${window}. The manager has been notified. Goodbye.`
    : declined
      ? "Thank you. I have notified the manager that you cannot cover this time. I will check for an eligible replacement. Goodbye."
      : "Your full availability is still unclear. I have notified the manager for review. Goodbye.";
  next.activity = next.activity.map((row) =>
    row.callId === callId && row.at === now
      ? { ...row, nextAction: notice }
      : row,
  );
  next.phoneTest = {
    ...next.phoneTest!,
    ...(confirmed ? { stage: "completed" as const } : {}),
    detail: notice,
    updatedAt: now,
    events: [
      ...next.phoneTest!.events,
      { at: now, text: `Manager notified: ${notice}` },
    ].slice(-30),
  };
  return { state: next, reply };
}
