import { randomUUID } from "node:crypto";
import {
  volunteerInputSchema,
  type RelayState,
  type Volunteer,
} from "../contracts";
import { ServiceError } from "../server/store";

export function voiceParticipantAllowed(person: Volunteer) {
  const allowed: string[] = JSON.parse(
    process.env.VOICE_ALLOWED_PHONES || "[]",
  );
  return (
    person.active &&
    person.callingConsent &&
    !person.optedOut &&
    (allowed.includes(person.phone) ||
      (person.callingApprovedByManager === true &&
        /^\+1\d{10}$/.test(person.phone)))
  );
}

/** Called only after the shared manager-code check; never schedules a call. */
export function addVoiceVolunteer(
  state: RelayState,
  input: unknown,
  now: string,
): RelayState {
  if (!state.paused)
    throw new ServiceError(
      "Stop the current inquiry before adding a volunteer.",
      409,
    );
  const parsed = volunteerInputSchema.safeParse(input);
  if (!parsed.success)
    throw new ServiceError(
      parsed.error.issues[0]?.message || "Check the volunteer details.",
    );
  const person = parsed.data;
  if (!/^\+1\d{10}$/.test(person.phone))
    throw new ServiceError(
      "Use a US phone number with +1 for this calling workspace.",
    );
  if (state.volunteers.some((row) => row.phone === person.phone))
    throw new ServiceError(
      "This phone number is already in the volunteer roster.",
      409,
    );
  const id = randomUUID();
  return {
    ...state,
    volunteers: [
      ...state.volunteers,
      {
        ...person,
        id,
        callingApprovedByManager: person.callingConsent && !person.optedOut,
      },
    ],
    activity: [
      ...state.activity,
      {
        id: randomUUID(),
        at: now,
        kind: "schedule",
        volunteerId: id,
        text: `${person.name} was added to the volunteer roster.`,
        nextAction:
          "Select this volunteer when preparing the next task. No call has been started.",
      },
    ],
  };
}
