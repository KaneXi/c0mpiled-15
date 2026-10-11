import { z } from "zod";

export const isoDate = z.string().datetime({ offset: true });
export const windowSchema = z
  .object({ start: isoDate, end: isoDate })
  .strict()
  .refine(
    (v) => Date.parse(v.end) > Date.parse(v.start),
    "End must follow start.",
  );
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s().-]/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^\+[1-9]\d{7,14}$/,
        "Use an international phone number, such as +12025550101.",
      ),
  );
const roleSchema = z.string().trim().min(1).max(60);
export const volunteerInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    phone: phoneSchema,
    roles: z.array(roleSchema).min(1).max(10),
    preferredRoles: z.array(roleSchema).max(10),
    availability: z.array(windowSchema).max(20),
    callingConsent: z.boolean(),
    recordingConsent: z.boolean(),
    optedOut: z.boolean(),
    active: z.boolean(),
    timezone: z
      .string()
      .max(64)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Choose a valid timezone."),
    quietHours: z
      .object({
        start: z.number().int().min(0).max(23),
        end: z.number().int().min(0).max(23),
      })
      .strict(),
  })
  .strict();
export type VolunteerInput = z.infer<typeof volunteerInputSchema>;
export interface Volunteer extends VolunteerInput {
  id: string;
}
export const shiftInputSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    role: roleSchema,
    start: isoDate,
    end: isoDate,
    required: z.number().int().min(1).max(20),
  })
  .strict()
  .refine(
    (v) => Date.parse(v.end) > Date.parse(v.start),
    "End must follow start.",
  );
export type ShiftInput = z.infer<typeof shiftInputSchema>;
export interface Shift extends ShiftInput {
  id: string;
  status: "draft" | "published" | "cancelled";
  version: number;
}
export interface Assignment {
  id: string;
  shiftId: string;
  volunteerId: string;
  status: "assigned" | "confirmed" | "uncertain" | "late" | "cancelled";
  note: string;
}
export type CallOutcome =
  | "confirmed"
  | "declined"
  | "uncertain"
  | "late"
  | "partial"
  | "question"
  | "no_answer"
  | "opt_out";
export const interpretationSchema = z
  .object({
    outcome: z.enum([
      "confirmed",
      "declined",
      "uncertain",
      "late",
      "partial",
      "question",
      "no_answer",
      "opt_out",
    ]),
    summary: z.string().min(1).max(600),
    confidence: z.number().min(0).max(1),
    clarification: z.string().max(300),
    availableFrom: isoDate.nullable(),
    availableUntil: isoDate.nullable(),
  })
  .strict();
export type Interpretation = z.infer<typeof interpretationSchema>;
export interface Call {
  id: string;
  shiftId: string;
  volunteerId: string;
  assignmentId?: string;
  incidentId?: string;
  purpose: "check_in" | "replacement";
  status:
    | "queued"
    | "in_progress"
    | "analyzing"
    | "completed"
    | "cancelled"
    | "failed";
  dueAt: string;
  createdAt: string;
  startedAt?: string;
  analysisStartedAt?: string;
  analysisId?: string;
  completedAt?: string;
  attempt: number;
  transport: "simulated" | "amazon-connect";
  transcript: string;
  result?: Interpretation;
  interpretationProvider?: "amazon-bedrock" | "manual-simulator";
  error?: string;
}
export interface Candidate {
  volunteerId: string;
  score: number;
  reasons: string[];
}
export interface Incident {
  id: string;
  shiftId: string;
  status:
    "pending" | "approved" | "rejected" | "covered" | "exhausted" | "cancelled";
  reason: string;
  candidates: Candidate[];
  approvedCandidateIds: string[];
  attemptedIds: string[];
  createdAt: string;
  approvedAt?: string;
  maxAttempts: number;
  shiftVersion: number;
}
export interface Activity {
  id: string;
  at: string;
  kind: "schedule" | "call" | "approval" | "system";
  text: string;
  callId?: string;
  volunteerId?: string;
  outcome?: string;
  nextAction?: string;
  transport?: "simulated" | "amazon-connect";
}
export interface RelayState {
  schemaVersion: 1;
  tenantId: string;
  revision: number;
  organization: string;
  managerVolunteerId: string;
  volunteers: Volunteer[];
  shifts: Shift[];
  assignments: Assignment[];
  calls: Call[];
  incidents: Incident[];
  activity: Activity[];
  paused: boolean;
  settings: {
    checkInLeadMinutes: number;
    maxAttempts: number;
    retryMinutes: number;
  };
}
const id = z.string().min(1).max(100);
export const commandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("SAVE_VOLUNTEER"),
      id: id.optional(),
      volunteer: volunteerInputSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("SAVE_SHIFT"),
      id: id.optional(),
      shift: shiftInputSchema,
    })
    .strict(),
  z.object({ type: z.literal("PUBLISH_SHIFT"), shiftId: id }).strict(),
  z.object({ type: z.literal("CANCEL_SHIFT"), shiftId: id }).strict(),
  z
    .object({ type: z.literal("ASSIGN"), shiftId: id, volunteerId: id })
    .strict(),
  z.object({ type: z.literal("CANCEL_ASSIGNMENT"), assignmentId: id }).strict(),
  z
    .object({
      type: z.literal("DECIDE_INCIDENT"),
      incidentId: id,
      decision: z.enum(["yes", "no", "myself"]),
    })
    .strict(),
  z.object({ type: z.literal("REVOKE_INCIDENT"), incidentId: id }).strict(),
  z.object({ type: z.literal("SET_PAUSED"), paused: z.boolean() }).strict(),
  z
    .object({
      type: z.literal("SUBMIT_CALL"),
      callId: id,
      transcript: z.string().trim().min(1).max(8000),
      simulatedOutcome: z
        .enum([
          "confirmed",
          "declined",
          "uncertain",
          "late",
          "partial",
          "question",
          "no_answer",
          "opt_out",
        ])
        .optional(),
    })
    .strict(),
  z.object({ type: z.literal("RESET_DEMO") }).strict(),
]);
export type RelayCommand = z.infer<typeof commandSchema>;
export type DomainCommand = Exclude<
  RelayCommand,
  { type: "SUBMIT_CALL" } | { type: "RESET_DEMO" }
>;
export const commandEnvelopeSchema = z
  .object({
    requestId: z.string().uuid(),
    expectedRevision: z.number().int().nonnegative(),
    command: commandSchema,
  })
  .strict();
export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>;
export interface ProviderStatus {
  status: "live" | "simulated" | "unavailable" | "blocked";
  label: string;
  detail: string;
}
export interface RelayView {
  state: RelayState;
  now: string;
  providers: {
    ai: ProviderStatus;
    calling: ProviderStatus;
    storage: ProviderStatus;
    payments: ProviderStatus;
  };
  session: { role: "manager"; demo: true };
}
export interface AgentProvider {
  interpret(
    input: {
      transcript: string;
      call: Call;
      shift: Shift;
      volunteer: Volunteer;
    },
    signal: AbortSignal,
  ): Promise<{
    interpretation: Interpretation;
    provider: "amazon-bedrock" | "manual-simulator";
  }>;
  status(): ProviderStatus;
}
export interface CallingProvider {
  status(): ProviderStatus;
}
export interface VolunteerRepository {
  read(tenantId: string): Promise<RelayState | undefined>;
}
export type ShiftRepository = VolunteerRepository;
export type IncidentRepository = VolunteerRepository;
export interface WorkflowProvider {
  tick(tenantId: string): Promise<void>;
}
export interface NotificationProvider {
  record(state: RelayState, activity: Activity): void;
}
export interface EntitlementProvider {
  enabled(tenantId: string, feature: string): Promise<boolean>;
}
export interface UsageMeteringProvider {
  reserve(tenantId: string, requestId: string): Promise<void>;
}
