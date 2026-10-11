import { z } from "zod";
import { AgentError } from "./errors";

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const instant = z.string().max(40).datetime({ offset: true });
const appointment = z
  .object({
    id,
    inquiryId: id,
    resourceId: id,
    start: instant,
    durationMinutes: z.number().int().min(15).max(120).multipleOf(15),
    status: z.enum(["CONFIRMED", "CANCELLED"]),
  })
  .strict();
const assignment = z
  .object({
    id,
    registrationId: id,
    shiftId: id,
    status: z.enum(["ASSIGNED", "COMPLETED", "CANCELLED"]),
    completedMinutes: z.number().int().min(0).max(1440).nullable(),
  })
  .strict();
const business = z
  .object({
    mode: z.literal("business"),
    record: z
      .object({
        id,
        service: z.string().min(1).max(120),
        notes: z.string().max(2000),
        requestedTime: z.string().max(300).nullable(),
        outcome: z.enum(["OPEN", "BOOKED", "WON", "LOST"]),
      })
      .strict(),
    appointments: z.array(appointment).max(40),
  })
  .strict();
const volunteers = z
  .object({
    mode: z.literal("volunteers"),
    record: z
      .object({
        id,
        roleInterests: z
          .array(z.enum(["welcome", "packing", "sorting"]))
          .max(3),
        availability: z
          .array(z.object({ start: instant, end: instant }).strict())
          .max(8),
        notes: z.string().max(2000),
        status: z.enum(["REGISTERED", "WITHDRAWN"]),
      })
      .strict(),
    assignments: z.array(assignment).max(60),
  })
  .strict();

export const identitySchema = z
  .object({
    mode: z.enum(["business", "volunteers"]),
    generation: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    intakeId: id,
    revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    recordId: id,
  })
  .strict();
export const analyzeSchema = identitySchema
  .extend({ snapshot: z.discriminatedUnion("mode", [business, volunteers]) })
  .strict()
  .superRefine((value, context) => {
    if (
      value.mode !== value.snapshot.mode ||
      value.recordId !== value.snapshot.record.id
    )
      context.addIssue({
        code: "custom",
        message: "The record and workspace must match.",
      });
    const rows =
      value.snapshot.mode === "business"
        ? value.snapshot.appointments
        : value.snapshot.assignments;
    if (new Set(rows.map((row) => row.id)).size !== rows.length)
      context.addIssue({
        code: "custom",
        message: "Record identifiers must be unique.",
      });
  });

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new AgentError(
      "INVALID_REQUEST",
      "Check the request details. Text is limited to 2,000 characters and the sample schedule must be valid.",
    );
  return parsed.data;
}

export function safeModelText(value: string): string {
  if (
    /(?:AKIA|ASIA)[A-Z0-9]{16}|(?:secret[_ -]?key|access[_ -]?token|password)\s*[:=]|Bearer\s+[\w.-]{15,}/i.test(
      value,
    )
  )
    throw new AgentError(
      "SENSITIVE_INPUT",
      "Use fictional request details only. Remove credentials before trying again.",
    );
  return value
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[contact detail omitted]")
    .replace(/\$\s*\d[\d,]*(?:\.\d+)?/g, "[amount omitted]");
}
