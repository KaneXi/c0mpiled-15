import type { Call, Shift, Volunteer } from "../contracts";

/** The same explicit local window is used in the question, follow-up and receipt. */
export function spokenShiftWindow(shift: Shift, timezone: string) {
  const start = new Date(shift.start),
    end = new Date(shift.end);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "long",
  })
    .formatToParts(start)
    .find((part) => part.type === "timeZoneName")!.value;
  const endZone = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "long",
  })
    .formatToParts(end)
    .find((part) => part.type === "timeZoneName")!.value;
  return `${day.format(start)}, from ${clock.format(start)}${zone !== endZone ? ` ${zone}` : ""} to ${day.format(start) === day.format(end) ? "" : `${day.format(end)} at `}${clock.format(end)} ${endZone}`;
}
export function availabilityQuestion(shift: Shift, person: Volunteer) {
  return `The shift is ${shift.title}, ${spokenShiftWindow(shift, person.timezone)}. Can you cover that entire time slot? Please tell me whether those hours work for you.`;
}
export function openingPrompt(
  call: Call,
  shift: Shift,
  person: Volunteer,
  originalName?: string,
) {
  const context =
    call.purpose === "replacement"
      ? `${originalName || "The original volunteer"} cannot attend, so I am asking whether you can fill in.`
      : "I am checking whether your scheduled time still works for you.";
  return `Hi ${person.name}. This is Relay, your automated volunteer scheduling assistant. Your answer will be transcribed; no audio recording is saved. ${context} ${availabilityQuestion(shift, person)}`;
}
