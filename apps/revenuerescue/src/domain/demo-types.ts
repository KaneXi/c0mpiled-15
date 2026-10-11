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
