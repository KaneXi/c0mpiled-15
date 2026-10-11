import type {
  Appointment,
  Assignment,
  AvailabilityWindow,
  DemoAction,
  DemoMode,
  DemoState,
  Outcome,
  VolunteerAction,
  VolunteerRole,
  VolunteerState,
} from "./demo-types";

export interface BusinessSnapshot {
  mode: "business";
  record: {
    id: string;
    service: string;
    notes: string;
    requestedTime: string | null;
    outcome: Outcome;
  };
  appointments: Appointment[];
}
export interface VolunteerSnapshot {
  mode: "volunteers";
  record: {
    id: string;
    roleInterests: VolunteerRole[];
    availability: AvailabilityWindow[];
    notes: string;
    status: "REGISTERED" | "WITHDRAWN";
  };
  assignments: Assignment[];
}
export type AgentSnapshot = BusinessSnapshot | VolunteerSnapshot;
export interface AgentIdentity {
  mode: DemoMode;
  generation: number;
  intakeId: string;
  revision: number;
  recordId: string;
}
export interface AnalyzeRequest extends AgentIdentity {
  snapshot: AgentSnapshot;
}
export interface AgentBinding extends AgentIdentity {
  snapshotDigest: string;
}
export type AgentAction =
  | Extract<DemoAction, { type: "BOOK" | "RESCHEDULE" }>
  | Extract<VolunteerAction, { type: "ASSIGN" | "MOVE" }>;
export interface AgentOption {
  optionId: string;
  label: string;
  action: AgentAction;
}
export interface AgentResult {
  kind: "proposal" | "clarification";
  summary: string;
  questions: string[];
  option?: AgentOption;
}
export interface AgentJob {
  jobId: string;
  binding: AgentBinding;
  status: "PENDING" | "READY" | "FAILED" | "LIMITED";
  result?: AgentResult;
  provenance?: {
    provider: "amazon-bedrock";
    modelId: string;
    toolNames: string[];
    modelCalls: number;
  };
  error?: { code: string; message: string };
}
export interface AgentSessionResponse {
  expiresAt: number;
}
export interface AgentErrorResponse {
  error: { code: string; message: string };
}

/** Only this projection may leave the fictional workspace for analysis. */
export function projectAgentSnapshot(
  mode: DemoMode,
  state: DemoState | VolunteerState,
  recordId: string,
): AgentSnapshot {
  if (mode === "business" && "inquiries" in state) {
    const record = state.inquiries.find((item) => item.id === recordId);
    if (!record) throw new Error("The inquiry is no longer available.");
    return {
      mode,
      record: {
        id: record.id,
        service: record.service,
        notes: record.notes,
        requestedTime: record.requestedTime ?? null,
        outcome: record.outcome,
      },
      appointments: state.appointments.map(
        ({ id, inquiryId, resourceId, start, durationMinutes, status }) => ({
          id,
          inquiryId,
          resourceId,
          start,
          durationMinutes,
          status,
        }),
      ),
    };
  }
  if (mode === "volunteers" && "registrations" in state) {
    const record = state.registrations.find((item) => item.id === recordId);
    if (!record) throw new Error("The registration is no longer available.");
    return {
      mode,
      record: {
        id: record.id,
        roleInterests: [...record.roleInterests],
        availability: record.availability.map(({ start, end }) => ({
          start,
          end,
        })),
        notes: record.notes,
        status: record.status,
      },
      assignments: state.assignments.map(
        ({ id, registrationId, shiftId, status, completedMinutes }) => ({
          id,
          registrationId,
          shiftId,
          status,
          completedMinutes,
        }),
      ),
    };
  }
  throw new Error("The workspace does not match this analysis.");
}

/** Shared by the browser digest and server; object order never changes identity. */
export function canonicalSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map(canonicalSerialize).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalSerialize(object[key])}`)
    .join(",")}}`;
}
