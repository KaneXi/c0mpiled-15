import type { VoiceExample } from "../domain/demo-types";

export const voiceExamples: VoiceExample[] = [
  {
    id: "equivalent-time",
    title: "Equivalent wording",
    transcript:
      "Hi, I'm Maya. Could I get a trim next Tuesday at half past ten? Ten thirty in the morning works for me.",
    intent: "Request a haircut appointment",
    customerName: "Maya",
    service: "Haircut / trim",
    requestedTime: "Tuesday, 10:30 a.m. — calendar date to confirm",
    uncertainty: [
      "Confirm the calendar date meant by next Tuesday.",
      "Check availability before offering an appointment.",
      "Ask for contact details and permission to follow up.",
    ],
    explanation:
      "“Half past ten” and “ten thirty in the morning” describe the same requested time. This is a request, not a booking.",
  },
  {
    id: "corrected-time",
    title: "A corrected time",
    transcript:
      "I'm Sam. I'd like a haircut on Friday at ten. Sorry, I mean eleven, not ten. Please check eleven in the morning.",
    intent: "Request an appointment at the corrected time",
    customerName: "Sam",
    service: "Haircut",
    requestedTime: "Friday, 11:00 a.m. — calendar date to confirm",
    uncertainty: [
      "Confirm which Friday and check stylist availability.",
      "Use 11:00 a.m.; the customer corrected the earlier 10:00 a.m. request.",
      "Ask for contact details and permission to follow up.",
    ],
    explanation:
      "The later correction replaces the earlier time. Keep the original words visible so the shop can verify the request.",
  },
  {
    id: "unclear-negation",
    title: "An unclear answer",
    transcript:
      "Hi, it's Alex. I [unclear: can / can't] make it at three on Thursday. Could we move my haircut?",
    intent: "Possible reschedule — clarification needed",
    customerName: "Alex",
    service: "Haircut — existing appointment to verify",
    requestedTime: "Thursday, 3:00 p.m. — attendance is unclear",
    uncertainty: [
      "Ask: Can you attend at 3:00 p.m., or do you need a different time?",
      "Verify the customer and existing appointment before making changes.",
      "Leave the appointment unchanged until the request is clear.",
    ],
    explanation:
      "“Can” and “can’t” would lead to different actions. This example deliberately keeps the uncertainty instead of guessing.",
  },
];
