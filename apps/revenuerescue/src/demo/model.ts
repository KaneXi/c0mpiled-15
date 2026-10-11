import { DateTime } from "luxon";
import type {
  ActionResult,
  Appointment,
  DemoAction,
  DemoState,
  Inquiry,
} from "../domain/demo-types";

export const DEMO_TODAY = "2026-10-12";
const DEMO_LAST_DAY = "2026-10-16";
const TIMEZONE = "America/New_York";

export function formatTime(iso: string): string {
  const time = DateTime.fromISO(iso, { zone: TIMEZONE }).setZone(TIMEZONE);
  return time.isValid ? time.toFormat("h:mm a") : "Choose a time";
}

export function formatDate(iso: string): string {
  const time = DateTime.fromISO(iso, { zone: TIMEZONE }).setZone(TIMEZONE);
  return time.isValid ? time.toFormat("ccc, LLL d") : "Choose a date";
}

export function createInitialState(): DemoState {
  const base = {
    followUp: "NONE" as const,
    draft: "",
    approvedDraft: null,
    reportedValue: null,
    contactPermission: true,
    outcome: "OPEN" as const,
  };
  return {
    resources: [
      { id: "maya", name: "Maya", role: "Stylist" },
      { id: "theo", name: "Theo", role: "Stylist" },
    ],
    inquiries: [
      {
        ...base,
        id: "inquiry-lena",
        name: "Lena Brooks",
        initials: "LB",
        email: "lena@example.test",
        service: "Cut & finish",
        estimatedValue: 65,
        receivedAt: "2026-10-10T13:20:00-04:00",
        source: "message",
        notes:
          "Asked about a cut and finish. Has not picked an appointment yet.",
        lastAction: "Asked about a cut and finish. Ready for a follow-up.",
      },
      {
        ...base,
        id: "inquiry-marcus",
        name: "Marcus Reed",
        initials: "MR",
        email: "marcus@example.test",
        service: "Color consultation",
        estimatedValue: 40,
        receivedAt: "2026-10-11T15:40:00-04:00",
        source: "voice",
        notes:
          "Sample voice inquiry: interested in a color consultation; Tuesday morning preferred. Exact time still needs confirmation.",
        requestedTime: "Tuesday morning; exact time unconfirmed",
        lastAction:
          "Voice example reviewed. Appointment time still needs confirmation.",
      },
      {
        ...base,
        id: "inquiry-priya",
        name: "Priya Shah",
        initials: "PS",
        email: "priya@example.test",
        service: "Blowout",
        estimatedValue: 45,
        receivedAt: "2026-10-10T11:10:00-04:00",
        source: "message",
        notes:
          "Asked about a blowout for an event. One sample follow-up has been sent; waiting for a reply.",
        followUp: "SENT",
        draft:
          "Hi Priya, are you still interested in a blowout? Reply with a day that works for you. — Juniper Studio",
        approvedDraft:
          "Hi Priya, are you still interested in a blowout? Reply with a day that works for you. — Juniper Studio",
        lastAction:
          "Sample follow-up sent. Waiting for a reply; no real email was sent.",
      },
      {
        ...base,
        id: "inquiry-jamie",
        name: "Jamie Park",
        initials: "JP",
        email: "jamie@example.test",
        service: "Cut & finish",
        estimatedValue: 65,
        receivedAt: "2026-10-09T09:20:00-04:00",
        source: "message",
        outcome: "BOOKED",
        notes:
          "Confirmed with Maya on Monday at 11 AM. Jamie now asks to move to Tuesday around the same time. Keep the original appointment until a replacement is confirmed.",
        requestedTime: "Tuesday around 11 AM, awaiting confirmation",
        lastAction:
          "Reschedule requested. Monday's appointment remains confirmed.",
      },
      {
        ...base,
        id: "inquiry-alex",
        name: "Alex Morgan",
        initials: "AM",
        email: "alex@example.test",
        service: "Hair treatment",
        estimatedValue: 80,
        receivedAt: "2026-10-11T10:05:00-04:00",
        source: "message",
        contactPermission: false,
        notes:
          "Walk-in inquiry. Permission to contact has not been recorded. Do not send a follow-up.",
        lastAction: "Contact permission is missing. Follow-up is paused.",
      },
    ],
    appointments: [
      {
        id: "appointment-jamie",
        inquiryId: "inquiry-jamie",
        resourceId: "maya",
        start: "2026-10-12T11:00:00-04:00",
        durationMinutes: 60,
        status: "CONFIRMED",
      },
    ],
    activity: [
      {
        id: "activity-3",
        text: "Jamie requested a new time. The original appointment is still held.",
        at: "2026-10-12T09:10:00-04:00",
      },
      {
        id: "activity-2",
        text: "Priya's sample follow-up is waiting for a reply. No real email was sent.",
        at: "2026-10-12T09:05:00-04:00",
      },
      {
        id: "activity-1",
        text: "Juniper Studio guest demo opened with fictional inquiries.",
        at: "2026-10-12T09:00:00-04:00",
      },
    ],
  };
}

function validDuration(duration: number): boolean {
  return (
    Number.isInteger(duration) &&
    duration >= 15 &&
    duration <= 120 &&
    duration % 15 === 0
  );
}

function sampleDate(dateISO: string): DateTime | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateISO) ||
    dateISO < DEMO_TODAY ||
    dateISO > DEMO_LAST_DAY
  )
    return null;
  const day = DateTime.fromISO(dateISO, { zone: TIMEZONE });
  return day.isValid && day.weekday <= 5 ? day : null;
}

function slotError(
  state: DemoState,
  resourceId: string,
  startISO: string,
  duration: number,
  ignoreId?: string,
): string | null {
  if (!state.resources.some((resource) => resource.id === resourceId))
    return "Choose a stylist from the sample schedule.";
  if (!validDuration(duration))
    return "Choose 15 to 120 minutes, in 15-minute steps.";
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(startISO))
    return "Choose a valid appointment time with a timezone.";
  const start = DateTime.fromISO(startISO, { setZone: true }).setZone(TIMEZONE);
  if (!start.isValid || !sampleDate(start.toISODate() ?? ""))
    return "Choose a weekday from October 12 to 16 in this sample schedule.";
  if (start.minute % 15 !== 0 || start.second !== 0 || start.millisecond !== 0)
    return "Appointments start on a 15-minute boundary.";
  const end = start.plus({ minutes: duration });
  const open = start.startOf("day").set({ hour: 9 });
  const close = start.startOf("day").set({ hour: 17 });
  if (start < open || end > close)
    return "Choose an appointment within the sample hours, 9 AM to 5 PM.";
  const conflict = state.appointments.some((appointment) => {
    if (
      appointment.id === ignoreId ||
      appointment.status !== "CONFIRMED" ||
      appointment.resourceId !== resourceId
    )
      return false;
    const existingStart = DateTime.fromISO(appointment.start, {
      setZone: true,
    });
    const existingEnd = existingStart.plus({
      minutes: appointment.durationMinutes,
    });
    return (
      start.toMillis() < existingEnd.toMillis() &&
      end.toMillis() > existingStart.toMillis()
    );
  });
  return conflict
    ? "That time is already taken. Choose another available time."
    : null;
}

export function availableSlots(
  state: DemoState,
  resourceId: string,
  dateISO: string,
  durationMinutes: number,
  ignoreAppointmentId?: string,
): string[] {
  const day = sampleDate(dateISO);
  if (
    !day ||
    !validDuration(durationMinutes) ||
    !state.resources.some((resource) => resource.id === resourceId)
  )
    return [];
  const slots: string[] = [];
  for (let minute = 9 * 60; minute + durationMinutes <= 17 * 60; minute += 15) {
    const start = day
      .startOf("day")
      .plus({ minutes: minute })
      .toISO({ suppressMilliseconds: true });
    if (
      start &&
      !slotError(state, resourceId, start, durationMinutes, ignoreAppointmentId)
    )
      slots.push(start);
  }
  return slots;
}

function failure(state: DemoState, message: string): ActionResult {
  return { state, message, error: true };
}

function nextCounter(state: DemoState): number {
  return (
    Math.max(
      0,
      ...state.activity.map((item) => Number(item.id.split("-").at(-1)) || 0),
    ) + 1
  );
}

function success(
  state: DemoState,
  message: string,
  changes: Partial<DemoState>,
): ActionResult {
  const counter = nextCounter(state);
  const at = DateTime.fromISO(`${DEMO_TODAY}T09:00:00`, { zone: TIMEZONE })
    .plus({ minutes: counter * 5 })
    .toISO()!;
  return {
    state: {
      ...state,
      ...changes,
      activity: [
        { id: `activity-${counter}`, text: message, at },
        ...state.activity,
      ].slice(0, 50),
    },
    message,
  };
}

function replaceInquiry(state: DemoState, next: Inquiry): Inquiry[] {
  return state.inquiries.map((inquiry) =>
    inquiry.id === next.id ? next : inquiry,
  );
}

function validMoney(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100_000 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}

function validEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function applyAction(
  state: DemoState,
  action: DemoAction,
): ActionResult {
  if (action.type === "RESET")
    return {
      state: createInitialState(),
      message:
        "Sample data reset. Nothing was sent or saved outside this page.",
    };

  if (action.type === "ADD_INQUIRY") {
    const input = action.inquiry;
    const name = input.name.trim();
    const email = input.email.trim();
    const service = input.service.trim();
    if (!name || name.length > 80 || !service || service.length > 120)
      return failure(
        state,
        "Add a customer name and a short service description.",
      );
    if ((email && !validEmail(email)) || (input.contactPermission && !email))
      return failure(
        state,
        "Enter a valid sample email address, or leave email empty with contact permission off.",
      );
    if (!validMoney(input.estimatedValue))
      return failure(
        state,
        "Enter an estimated value from $0 to $100,000, with at most two decimal places.",
      );
    if (
      !DateTime.fromISO(input.receivedAt).isValid ||
      input.notes.length > 2000
    )
      return failure(
        state,
        "Check the received date and keep notes under 2,000 characters.",
      );
    if (input.outcome !== "OPEN")
      return failure(
        state,
        "Add an inquiry first, then confirm its appointment or record its result.",
      );
    const inquiry: Inquiry = {
      ...input,
      name,
      email,
      service,
      id: `inquiry-${nextCounter(state)}`,
      initials: name
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
      followUp: "NONE",
      draft: "",
      approvedDraft: null,
      reportedValue: null,
      lastAction: "Sample inquiry added. No real customer was contacted.",
    };
    return success(state, `${name}'s sample inquiry was added.`, {
      inquiries: [inquiry, ...state.inquiries],
    });
  }

  if (action.type === "BOOK" || action.type === "RESCHEDULE") {
    const previous =
      action.type === "RESCHEDULE"
        ? state.appointments.find((item) => item.id === action.appointmentId)
        : undefined;
    if (
      action.type === "RESCHEDULE" &&
      (!previous || previous.status !== "CONFIRMED")
    )
      return failure(state, "Choose a confirmed appointment to move.");
    const inquiryId =
      action.type === "BOOK" ? action.inquiryId : previous!.inquiryId;
    const inquiry = state.inquiries.find((item) => item.id === inquiryId);
    if (!inquiry)
      return failure(
        state,
        "This inquiry is no longer available. Reset the sample to start again.",
      );
    if (
      inquiry.outcome === "LOST" ||
      (action.type === "BOOK" && inquiry.outcome === "WON")
    )
      return failure(
        state,
        "Reopen this inquiry before making a new appointment.",
      );
    if (
      action.type === "BOOK" &&
      state.appointments.some(
        (item) => item.inquiryId === inquiryId && item.status === "CONFIRMED",
      )
    )
      return failure(
        state,
        "This customer already has an appointment. Use Change time to move it.",
      );
    const error = slotError(
      state,
      action.resourceId,
      action.start,
      action.durationMinutes,
      previous?.id,
    );
    if (error) return failure(state, error);
    const appointment: Appointment = {
      id: previous?.id ?? `appointment-${nextCounter(state)}`,
      inquiryId,
      resourceId: action.resourceId,
      start: DateTime.fromISO(action.start, { setZone: true })
        .setZone(TIMEZONE)
        .toISO({ suppressMilliseconds: true })!,
      durationMinutes: action.durationMinutes,
      status: "CONFIRMED",
    };
    const message = `${inquiry.name}'s sample appointment ${previous ? "moved to" : "confirmed for"} ${formatDate(appointment.start)} at ${formatTime(appointment.start)}.`;
    return success(state, message, {
      appointments: previous
        ? state.appointments.map((item) =>
            item.id === previous.id ? appointment : item,
          )
        : [...state.appointments, appointment],
      inquiries: replaceInquiry(state, {
        ...inquiry,
        outcome: inquiry.outcome === "WON" ? "WON" : "BOOKED",
        requestedTime: undefined,
        approvedDraft: null,
        followUp: inquiry.followUp === "APPROVED" ? "DRAFT" : inquiry.followUp,
        lastAction: message,
      }),
    });
  }

  if (action.type === "CANCEL_APPOINTMENT") {
    const appointment = state.appointments.find(
      (item) => item.id === action.appointmentId,
    );
    if (!appointment || appointment.status !== "CONFIRMED")
      return failure(state, "Choose a confirmed appointment to cancel.");
    const inquiry = state.inquiries.find(
      (item) => item.id === appointment.inquiryId,
    );
    if (!inquiry)
      return failure(state, "The appointment's inquiry could not be found.");
    const message = `${inquiry.name}'s sample appointment was cancelled. The time is available again.`;
    return success(state, message, {
      appointments: state.appointments.map((item) =>
        item.id === appointment.id ? { ...item, status: "CANCELLED" } : item,
      ),
      inquiries: replaceInquiry(state, {
        ...inquiry,
        outcome: inquiry.outcome === "BOOKED" ? "OPEN" : inquiry.outcome,
        approvedDraft: null,
        followUp: inquiry.followUp === "APPROVED" ? "DRAFT" : inquiry.followUp,
        lastAction: message,
      }),
    });
  }

  const inquiry = state.inquiries.find((item) => item.id === action.id);
  if (!inquiry)
    return failure(
      state,
      "This inquiry is no longer available. Reset the sample to start again.",
    );
  let next: Inquiry = { ...inquiry };
  let message: string;

  if (action.type === "OUTCOME") {
    const confirmed = state.appointments.some(
      (item) => item.inquiryId === inquiry.id && item.status === "CONFIRMED",
    );
    if (action.outcome === "BOOKED" && !confirmed)
      return failure(
        state,
        "Choose and confirm an available appointment time first.",
      );
    if ((action.outcome === "LOST" || action.outcome === "OPEN") && confirmed)
      return failure(
        state,
        "Cancel the confirmed appointment before changing this result.",
      );
    if (
      action.outcome === "WON" &&
      (action.value === undefined || !validMoney(action.value))
    )
      return failure(
        state,
        "Enter the amount you are reporting, from $0 to $100,000 with at most two decimal places.",
      );
    next = {
      ...next,
      outcome: action.outcome,
      reportedValue: action.outcome === "WON" ? action.value! : null,
      approvedDraft: null,
      followUp: inquiry.followUp === "APPROVED" ? "DRAFT" : inquiry.followUp,
    };
    message =
      action.outcome === "WON"
        ? `${inquiry.name}: $${action.value!.toFixed(2)} marked as staff-reported revenue. No payment was processed.`
        : `${inquiry.name}'s result changed to ${action.outcome.toLowerCase()}.`;
  } else {
    if (inquiry.followUp === "SENT")
      return failure(
        state,
        "This sample follow-up was already sent. Each inquiry can be contacted once in the demo.",
      );
    if (inquiry.outcome !== "OPEN")
      return failure(
        state,
        "This inquiry already has a result. Reopen it before preparing a follow-up.",
      );
    if (action.type === "APPROVE" || action.type === "SEND") {
      if (!inquiry.contactPermission)
        return failure(
          state,
          "Contact permission is missing. This sample follow-up cannot be approved or sent.",
        );
      if (!validEmail(inquiry.email))
        return failure(
          state,
          "Add a valid sample email address before approving or sending a follow-up.",
        );
    }
    if (action.type === "DRAFT") {
      const firstName = inquiry.name.split(/\s+/)[0];
      next.draft = `Hi ${firstName}, thanks for asking about ${inquiry.service.toLowerCase()} at Juniper Studio. Are you still interested? Reply with a day that works for you, and we'll help find a time. — Juniper Studio`;
      next.followUp = "DRAFT";
      next.approvedDraft = null;
      message = `Sample template prepared for ${inquiry.name}. Review it before approving.`;
    } else if (action.type === "EDIT_DRAFT") {
      if (inquiry.followUp === "NONE")
        return failure(state, "Prepare a sample draft before editing it.");
      if (action.text.length > 2000)
        return failure(state, "Keep the follow-up under 2,000 characters.");
      next.draft = action.text;
      next.followUp = "DRAFT";
      next.approvedDraft = null;
      message = `Draft updated for ${inquiry.name}. Review and approve this version before sending.`;
    } else if (action.type === "APPROVE") {
      if (inquiry.followUp !== "DRAFT" || !inquiry.draft.trim())
        return failure(state, "Prepare a nonempty draft before approving it.");
      next.approvedDraft = inquiry.draft;
      next.followUp = "APPROVED";
      message = `Follow-up approved for ${inquiry.name}. Choose Simulate send to see the next step.`;
    } else if (action.type === "SEND") {
      if (
        inquiry.followUp !== "APPROVED" ||
        !inquiry.draft.trim() ||
        inquiry.approvedDraft !== inquiry.draft
      )
        return failure(
          state,
          "Review and approve this exact message before simulating a send.",
        );
      next.followUp = "SENT";
      message = `Sample follow-up sent to ${inquiry.name}. No real email was sent.`;
    } else {
      return failure(state, "Choose an available demo action.");
    }
  }
  next.lastAction = message;
  return success(state, message, { inquiries: replaceInquiry(state, next) });
}
