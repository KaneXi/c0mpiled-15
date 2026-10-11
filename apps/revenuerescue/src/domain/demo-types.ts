export type Screen = "today" | "customers" | "appointments" | "results";
export type Outcome = "OPEN" | "BOOKED" | "WON" | "LOST";
export type FollowUpState = "NONE" | "DRAFT" | "APPROVED" | "SENT";
export interface Inquiry {
  id: string;
  name: string;
  initials: string;
  email: string;
  service: string;
  receivedAt: string;
  notes: string;
  estimatedValue: number;
  outcome: Outcome;
  followUp: FollowUpState;
  draft: string;
  approvedDraft: string | null;
  contactPermission: boolean;
  source: "message" | "voice";
  requestedTime?: string;
  reportedValue: number | null;
  lastAction: string;
}
export interface Appointment {
  id: string;
  inquiryId: string;
  resourceId: string;
  start: string;
  durationMinutes: number;
  status: "CONFIRMED" | "CANCELLED";
}
export interface Resource {
  id: string;
  name: string;
  role: string;
}
export interface Activity {
  id: string;
  text: string;
  at: string;
}
export interface DemoState {
  inquiries: Inquiry[];
  appointments: Appointment[];
  resources: Resource[];
  activity: Activity[];
}
export interface VoiceExample {
  id: string;
  title: string;
  transcript: string;
  intent: string;
  customerName: string;
  service: string;
  requestedTime: string;
  uncertainty: string[];
  explanation: string;
}
export type DemoAction =
  | {
      type: "ADD_INQUIRY";
      inquiry: Omit<
        Inquiry,
        | "id"
        | "initials"
        | "followUp"
        | "draft"
        | "approvedDraft"
        | "reportedValue"
        | "lastAction"
      >;
    }
  | { type: "DRAFT"; id: string }
  | { type: "EDIT_DRAFT"; id: string; text: string }
  | { type: "APPROVE"; id: string }
  | { type: "SEND"; id: string }
  | { type: "OUTCOME"; id: string; outcome: Outcome; value?: number }
  | {
      type: "BOOK";
      inquiryId: string;
      resourceId: string;
      start: string;
      durationMinutes: number;
    }
  | {
      type: "RESCHEDULE";
      appointmentId: string;
      resourceId: string;
      start: string;
      durationMinutes: number;
    }
  | { type: "CANCEL_APPOINTMENT"; appointmentId: string }
  | { type: "RESET" };
export interface ActionResult {
  state: DemoState;
  message: string;
  error?: boolean;
}

export type DemoMode = "business" | "volunteers";
export type VolunteerScreen = "today" | "volunteers" | "shifts" | "results";
export type VolunteerRole = "welcome" | "packing" | "sorting";
export interface AvailabilityWindow { start: string; end: string }
export interface Registration {
  id: string;
  name: string;
  initials: string;
  email: string;
  roleInterests: VolunteerRole[];
  availability: AvailabilityWindow[];
  notes: string;
  contactPermission: boolean;
  source: "message" | "voice";
  status: "REGISTERED" | "WITHDRAWN";
  followUp: FollowUpState;
  draft: string;
  approvedDraft: string | null;
  lastAction: string;
}
export interface Shift {
  id: string; task: string; role: VolunteerRole;
  start: string; end: string; capacity: number;
}
export interface Assignment {
  id: string; registrationId: string; shiftId: string;
  status: "ASSIGNED" | "COMPLETED" | "CANCELLED";
  completedMinutes: number | null;
}
export interface VolunteerState {
  registrations: Registration[];
  shifts: Shift[];
  assignments: Assignment[];
  activity: Activity[];
}
export type RegistrationInput = Pick<Registration,
  "name" | "email" | "roleInterests" | "availability" | "notes" |
  "contactPermission" | "source">;
export type VolunteerAction =
  | { type: "REGISTER"; registration: RegistrationInput }
  | { type: "UPDATE_REGISTRATION"; id: string; changes: Partial<Omit<RegistrationInput, "source">> }
  | { type: "DRAFT"; id: string }
  | { type: "EDIT_DRAFT"; id: string; text: string }
  | { type: "APPROVE"; id: string }
  | { type: "SEND"; id: string }
  | { type: "ASSIGN"; registrationId: string; shiftId: string }
  | { type: "MOVE"; assignmentId: string; shiftId: string }
  | { type: "CANCEL"; assignmentId: string }
  | { type: "COMPLETE"; assignmentId: string; completedMinutes: number }
  | { type: "WITHDRAW"; id: string }
  | { type: "RESET" };
export interface VolunteerActionResult { state: VolunteerState; message: string; error?: boolean }
export interface ModeVersion { revision: number; generation: number }
export interface WorkspaceState {
  activeMode: DemoMode;
  business: DemoState;
  volunteers: VolunteerState;
  versions: Record<DemoMode, ModeVersion>;
}
export type WorkspaceAction =
  | { type: "SWITCH_MODE"; mode: DemoMode }
  | { type: "BUSINESS_ACTION"; mode: "business"; action: DemoAction; expected?: ModeVersion }
  | { type: "VOLUNTEER_ACTION"; mode: "volunteers"; action: VolunteerAction; expected?: ModeVersion };
export interface WorkspaceActionResult { state: WorkspaceState; message: string; error?: boolean }
