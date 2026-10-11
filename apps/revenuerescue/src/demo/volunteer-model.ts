import { DateTime } from "luxon";
import type { Assignment, Registration, RegistrationInput, Shift, VolunteerAction, VolunteerActionResult, VolunteerRole, VolunteerState } from "../domain/demo-types";
import { formatDate, formatTime } from "./model";

export const DEMO_NOW = "2026-10-12T12:00:00-04:00";
export const VOLUNTEER_DEMO_NOW = DEMO_NOW;
const ROLES: VolunteerRole[] = ["welcome", "packing", "sorting"];

export function createInitialVolunteerState(): VolunteerState {
  const base = { status: "REGISTERED" as const, followUp: "NONE" as const, draft: "", approvedDraft: null, contactPermission: true, source: "message" as const };
  const monday = [{ start: "2026-10-12T09:00:00-04:00", end: "2026-10-12T17:00:00-04:00" }];
  return {
    registrations: [
      { ...base, id: "registration-olivia", name: "Olivia Cruz", initials: "OC", email: "olivia@example.test", roleInterests: ["welcome", "packing"], availability: monday.map((item) => ({ ...item })), notes: "Helped at the morning welcome desk. The coordinator can now record completed time.", lastAction: "Morning shift ended. Completion has not been recorded." },
      { ...base, id: "registration-ben", name: "Ben Turner", initials: "BT", email: "ben@example.test", roleInterests: ["welcome", "packing"], availability: monday.map((item) => ({ ...item })), notes: "Available Monday. Completed 90 minutes this morning and is assigned to the afternoon packing shift.", lastAction: "Afternoon packing assignment confirmed." },
      { ...base, id: "registration-noor", name: "Noor Ali", initials: "NA", email: "noor@example.test", roleInterests: ["sorting"], availability: monday.map((item) => ({ ...item })), notes: "Can help sort donations Monday afternoon.", lastAction: "Donation sorting assignment confirmed." },
      { ...base, id: "registration-eli", name: "Eli Brooks", initials: "EB", email: "eli@example.test", roleInterests: ["packing", "sorting"], availability: [{ start: "2026-10-12T13:00:00-04:00", end: "2026-10-12T17:00:00-04:00" }], notes: "Interested in packing or sorting on Monday afternoon. No assignment yet.", lastAction: "Registered interest. Choose a suitable shift before confirming." },
      { ...base, id: "registration-june", name: "June Patel", initials: "JP", email: "", roleInterests: ["welcome"], availability: [], contactPermission: false, source: "voice", notes: "Sample caller: I might be able to help next week. Exact availability and contact details need clarification.", lastAction: "Voice example recorded. Availability is unknown; no shift is assigned." },
    ],
    shifts: [
      { id: "shift-morning-welcome", task: "Morning welcome desk", role: "welcome", start: "2026-10-12T09:00:00-04:00", end: "2026-10-12T11:00:00-04:00", capacity: 2 },
      { id: "shift-monday-packing", task: "Pack community meal kits", role: "packing", start: "2026-10-12T13:00:00-04:00", end: "2026-10-12T15:00:00-04:00", capacity: 2 },
      { id: "shift-monday-late-packing", task: "Pack the final meal kits", role: "packing", start: "2026-10-12T15:00:00-04:00", end: "2026-10-12T17:00:00-04:00", capacity: 1 },
      { id: "shift-monday-sorting", task: "Sort donated supplies", role: "sorting", start: "2026-10-12T14:00:00-04:00", end: "2026-10-12T16:00:00-04:00", capacity: 1 },
      { id: "shift-tuesday-welcome", task: "Welcome community visitors", role: "welcome", start: "2026-10-13T10:00:00-04:00", end: "2026-10-13T12:00:00-04:00", capacity: 2 },
      { id: "shift-tuesday-sorting", task: "Prepare donated supplies", role: "sorting", start: "2026-10-13T13:00:00-04:00", end: "2026-10-13T15:00:00-04:00", capacity: 2 },
    ],
    assignments: [
      { id: "assignment-olivia-morning", registrationId: "registration-olivia", shiftId: "shift-morning-welcome", status: "ASSIGNED", completedMinutes: null },
      { id: "assignment-ben-morning", registrationId: "registration-ben", shiftId: "shift-morning-welcome", status: "COMPLETED", completedMinutes: 90 },
      { id: "assignment-ben-packing", registrationId: "registration-ben", shiftId: "shift-monday-packing", status: "ASSIGNED", completedMinutes: null },
      { id: "assignment-noor-sorting", registrationId: "registration-noor", shiftId: "shift-monday-sorting", status: "ASSIGNED", completedMinutes: null },
    ],
    activity: [{ id: "volunteer-activity-1", text: "Community Table sample workspace opened. The demonstration clock is Monday at noon.", at: DEMO_NOW }],
  };
}

function instant(value: string): number {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  return DateTime.fromISO(value, { setZone: true }).toMillis();
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function registrationError(input: RegistrationInput): string | null {
  if (!input.name.trim() || input.name.trim().length > 80) return "Add a volunteer name of at most 80 characters.";
  if ((input.email && !validEmail(input.email.trim())) || (input.contactPermission && !input.email.trim())) return "Add a valid sample email, or leave contact permission off when no email is known.";
  if (input.notes.length > 2000) return "Keep the volunteer notes under 2,000 characters.";
  if (input.roleInterests.length > ROLES.length || new Set(input.roleInterests).size !== input.roleInterests.length || input.roleInterests.some((role) => !ROLES.includes(role))) return "Choose the sample welcome, packing, or sorting roles.";
  if (input.availability.length > 10 || input.availability.some((window) => !Number.isFinite(instant(window.start)) || !Number.isFinite(instant(window.end)) || instant(window.end) <= instant(window.start))) return "Use at most ten availability windows, each with a valid start before its end.";
  return null;
}

function coversShift(registration: Registration, shift: Shift): boolean {
  return registration.roleInterests.includes(shift.role) && registration.availability.some((window) => instant(window.start) <= instant(shift.start) && instant(window.end) >= instant(shift.end));
}

export function shiftEligibility(
  state: VolunteerState, registrationId: string, shiftId: string, ignoreAssignmentId?: string, nowISO = DEMO_NOW,
): { allowed: boolean; reason: string | null; remainingPlaces: number } {
  const registration = state.registrations.find((item) => item.id === registrationId);
  const shift = state.shifts.find((item) => item.id === shiftId);
  const counted = state.assignments.filter((item) => item.id !== ignoreAssignmentId && item.status !== "CANCELLED");
  const remainingPlaces = shift ? Math.max(0, shift.capacity - counted.filter((item) => item.shiftId === shiftId).length) : 0;
  const blocked = (reason: string) => ({ allowed: false, reason, remainingPlaces });
  if (!registration || !shift) return blocked("Choose a known volunteer and sample shift.");
  if (registration.status !== "REGISTERED") return blocked("This volunteer has withdrawn.");
  if (!Number.isFinite(instant(nowISO))) return blocked("The demonstration clock is invalid. No assignment was changed.");
  if (!Number.isInteger(shift.capacity) || shift.capacity <= 0 || !Number.isFinite(instant(shift.start)) || !Number.isFinite(instant(shift.end)) || instant(shift.end) <= instant(shift.start)) return blocked("This shift's configuration is invalid.");
  if (instant(shift.end) <= instant(nowISO)) return blocked("This shift has ended. Choose an upcoming shift.");
  if (!registration.roleInterests.includes(shift.role)) return blocked("This role is not among the volunteer's selected interests.");
  if (!registration.availability.length) return blocked("Availability is unknown. Confirm it before assigning a shift.");
  if (!coversShift(registration, shift)) return blocked("The volunteer is not available for the whole shift.");
  if (counted.some((item) => item.registrationId === registrationId && item.shiftId === shiftId)) return blocked("This volunteer already has a place on this shift.");
  const overlap = counted.some((item) => {
    if (item.registrationId !== registrationId) return false;
    const other = state.shifts.find((candidate) => candidate.id === item.shiftId);
    return !!other && instant(shift.start) < instant(other.end) && instant(shift.end) > instant(other.start);
  });
  if (overlap) return blocked("This shift overlaps another assignment for this volunteer.");
  if (remainingPlaces <= 0) return blocked("This shift is full. Choose another shift.");
  return { allowed: true, reason: null, remainingPlaces };
}

export function volunteerResults(state: VolunteerState) {
  const completed = state.assignments.filter((item) => item.status === "COMPLETED");
  const completedMinutes = completed.reduce((total, item) => total + (item.completedMinutes ?? 0), 0);
  return {
    registrations: state.registrations.filter((item) => item.status === "REGISTERED").length,
    simulatedFollowUps: state.registrations.filter((item) => item.followUp === "SENT").length,
    assigned: state.assignments.filter((item) => item.status === "ASSIGNED").length,
    completed: completed.length, completedMinutes, completedHours: completedMinutes / 60,
  };
}

function fail(state: VolunteerState, message: string): VolunteerActionResult {
  return { state, message, error: true };
}
function nextCounter(state: VolunteerState): number {
  return Math.max(0, ...state.activity.map((item) => Number(item.id.split("-").at(-1)) || 0)) + 1;
}
function succeed(state: VolunteerState, message: string, changes: Partial<VolunteerState>): VolunteerActionResult {
  return {
    state: { ...state, ...changes, activity: [{ id: `volunteer-activity-${nextCounter(state)}`, text: message, at: DEMO_NOW }, ...state.activity].slice(0, 50) },
    message,
  };
}
function replaceRegistration(state: VolunteerState, next: Registration): Registration[] {
  return state.registrations.map((item) => item.id === next.id ? next : item);
}

export function applyVolunteerAction(state: VolunteerState, action: VolunteerAction, nowISO = DEMO_NOW): VolunteerActionResult {
  if (action.type === "RESET") return { state: createInitialVolunteerState(), message: "Volunteer sample data reset. Business records are unchanged." };
  if (action.type === "REGISTER") {
    const input = action.registration;
    const error = registrationError(input);
    if (error) return fail(state, error);
    const name = input.name.trim();
    const registration: Registration = {
      ...input, id: `registration-${nextCounter(state)}`, name, email: input.email.trim(),
      roleInterests: [...input.roleInterests], availability: input.availability.map((item) => ({ ...item })),
      initials: name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
      status: "REGISTERED", followUp: "NONE", draft: "", approvedDraft: null,
      lastAction: "Interest registered. No shift has been assigned.",
    };
    return succeed(state, `${name} registered interest. No shift has been assigned.`, { registrations: [registration, ...state.registrations] });
  }
  if (action.type === "ASSIGN" || action.type === "MOVE") {
    const previous = action.type === "MOVE" ? state.assignments.find((item) => item.id === action.assignmentId) : undefined;
    if (action.type === "MOVE" && (!previous || previous.status !== "ASSIGNED")) return fail(state, "Only an assigned, uncompleted place can be moved.");
    if (previous?.shiftId === action.shiftId) return fail(state, "Choose a different shift. The original assignment is unchanged.");
    const registrationId = action.type === "ASSIGN" ? action.registrationId : previous!.registrationId;
    const eligibility = shiftEligibility(state, registrationId, action.shiftId, previous?.id, nowISO);
    if (!eligibility.allowed) return fail(state, eligibility.reason!);
    const registration = state.registrations.find((item) => item.id === registrationId)!;
    const shift = state.shifts.find((item) => item.id === action.shiftId)!;
    const assignment: Assignment = { id: previous?.id ?? `assignment-${nextCounter(state)}`, registrationId, shiftId: shift.id, status: "ASSIGNED", completedMinutes: null };
    const message = `${registration.name} ${previous ? "moved to" : "assigned to"} ${shift.task}, ${formatDate(shift.start)} at ${formatTime(shift.start)}. No message was sent.`;
    return succeed(state, message, {
      assignments: previous ? state.assignments.map((item) => item.id === previous.id ? assignment : item) : [...state.assignments, assignment],
      registrations: replaceRegistration(state, { ...registration, lastAction: message }),
    });
  }
  if (action.type === "CANCEL" || action.type === "COMPLETE") {
    const assignment = state.assignments.find((item) => item.id === action.assignmentId);
    if (!assignment || assignment.status !== "ASSIGNED") return fail(state, "Only an assigned, uncompleted place can be changed.");
    const registration = state.registrations.find((item) => item.id === assignment.registrationId);
    const shift = state.shifts.find((item) => item.id === assignment.shiftId);
    if (!registration || !shift) return fail(state, "The volunteer or shift could not be found.");
    if (action.type === "COMPLETE") {
      if (!Number.isFinite(instant(nowISO)) || !Number.isFinite(instant(shift.end)) || instant(shift.end) > instant(nowISO)) return fail(state, "This shift has not ended in the demonstration. Completion cannot be recorded yet.");
      const scheduledMinutes = (instant(shift.end) - instant(shift.start)) / 60_000;
      if (!Number.isInteger(action.completedMinutes) || action.completedMinutes < 0 || action.completedMinutes > scheduledMinutes) return fail(state, `Record whole minutes from 0 to ${scheduledMinutes}.`);
    }
    const completedMinutes = action.type === "COMPLETE" ? action.completedMinutes : null;
    const message = action.type === "CANCEL" ? `${registration.name}'s place on ${shift.task} was cancelled. Capacity is available again.` : completedMinutes === 0 ? `${registration.name}: No time recorded for ${shift.task}.` : `${registration.name}: ${completedMinutes} sample minutes recorded for ${shift.task}.`;
    return succeed(state, message, {
      assignments: state.assignments.map((item) => item.id === assignment.id ? { ...item, status: action.type === "COMPLETE" ? "COMPLETED" : "CANCELLED", completedMinutes } : item),
      registrations: replaceRegistration(state, { ...registration, lastAction: message }),
    });
  }
  const registration = state.registrations.find((item) => item.id === action.id);
  if (!registration) return fail(state, "This volunteer could not be found.");
  if (registration.status !== "REGISTERED") return fail(state, "This volunteer has withdrawn. Their completed history is preserved.");
  let next = { ...registration };
  let message: string;
  if (action.type === "UPDATE_REGISTRATION") {
    const candidate = { ...registration, ...action.changes };
    const error = registrationError(candidate);
    if (error) return fail(state, error);
    const invalidatesAssignment = state.assignments.some((item) => {
      if (item.registrationId !== registration.id || item.status !== "ASSIGNED") return false;
      const shift = state.shifts.find((itemShift) => itemShift.id === item.shiftId);
      return !shift || !coversShift(candidate, shift);
    });
    if (invalidatesAssignment) return fail(state, "Cancel or move the affected assignment before changing its required role or availability.");
    next = { ...candidate, name: candidate.name.trim(), email: candidate.email.trim(), roleInterests: [...candidate.roleInterests], availability: candidate.availability.map((item) => ({ ...item })), initials: candidate.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(), approvedDraft: null, followUp: candidate.followUp === "APPROVED" ? "DRAFT" : candidate.followUp };
    message = `${next.name}'s details updated. Any unsent draft needs a new review.`;
  } else if (action.type === "WITHDRAW") {
    if (state.assignments.some((item) => item.registrationId === registration.id && item.status === "ASSIGNED")) return fail(state, "Cancel this volunteer's assigned shifts before withdrawing their registration.");
    next.status = "WITHDRAWN";
    next.approvedDraft = null;
    if (next.followUp === "APPROVED") next.followUp = "DRAFT";
    message = `${registration.name} withdrew. Completed shifts and recorded hours remain in the history.`;
  } else {
    if (registration.followUp === "SENT") return fail(state, "This sample follow-up has already been sent. A second send is not available.");
    if (action.type === "APPROVE" || action.type === "SEND") {
      if (!registration.contactPermission || !validEmail(registration.email)) return fail(state, "A valid sample email and contact permission are required before approval or sending.");
    }
    if (action.type === "DRAFT") {
      next.draft = `Hi ${registration.name.split(/\s+/)[0]}, thank you for offering to help Community Table. Could you confirm the days and times you are available${registration.roleInterests.length ? ` for ${registration.roleInterests.join(" or ")}` : ""}? A coordinator will review the options before confirming a shift. — Community Table`;
      next.followUp = "DRAFT"; next.approvedDraft = null;
      message = `Local sample draft prepared for ${registration.name}. No AI service or message was used.`;
    } else if (action.type === "EDIT_DRAFT") {
      if (registration.followUp === "NONE" || action.text.length > 2000) return fail(state, "Prepare a draft first, then keep it under 2,000 characters.");
      next.draft = action.text; next.followUp = "DRAFT"; next.approvedDraft = null;
      message = `${registration.name}'s draft changed. Approval must be repeated.`;
    } else if (action.type === "APPROVE") {
      if (registration.followUp !== "DRAFT" || !registration.draft.trim()) return fail(state, "Prepare a nonempty draft before approving it.");
      next.approvedDraft = registration.draft; next.followUp = "APPROVED";
      message = `${registration.name}'s exact sample draft is approved. No message has been sent.`;
    } else if (action.type === "SEND") {
      if (registration.followUp !== "APPROVED" || !registration.draft.trim() || registration.approvedDraft !== registration.draft) return fail(state, "Approve this exact draft before simulating a send.");
      next.followUp = "SENT";
      message = `Sample follow-up completed for ${registration.name}. No real message or shift confirmation was sent.`;
    } else return fail(state, "Choose a supported volunteer action.");
  }
  next.lastAction = message;
  return succeed(state, message, { registrations: replaceRegistration(state, next) });
}
