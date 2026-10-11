import { DateTime } from "luxon";
import { z } from "zod";
import type { ToolSpecification } from "@aws-sdk/client-bedrock-runtime";
import {
  applyAction,
  availableSlots,
  createInitialState,
  formatDate,
  formatTime,
} from "../demo/model";
import {
  applyVolunteerAction,
  createInitialVolunteerState,
  DEMO_NOW,
  shiftEligibility,
} from "../demo/volunteer-model";
import {
  canonicalSerialize,
  type AgentOption,
  type AnalyzeRequest,
} from "../domain/agent-types";
import type { DemoState, VolunteerState } from "../domain/demo-types";
import { AgentError } from "./errors";
import { sha256 } from "./repository";
import { parseInput, safeModelText } from "./validation";

const businessInput = z
  .object({
    date: z
      .string()
      .regex(/^2026-10-1[2-6]$/)
      .nullable(),
    time: z
      .string()
      .regex(/^(?:0[9]|1[0-6]):(?:00|15|30|45)$/)
      .nullable(),
    resourceId: z.enum(["maya", "theo"]).nullable(),
    durationMinutes: z.number().int().min(15).max(120).multipleOf(15),
  })
  .strict();
const volunteerInput = z
  .object({ shiftId: z.string().max(128).nullable() })
  .strict();
export interface ToolReadResult {
  options: AgentOption[];
  questions: string[];
}

export function reconstructSnapshot(
  request: AnalyzeRequest,
): DemoState | VolunteerState {
  const snapshot = request.snapshot;
  safeModelText(snapshot.record.notes);
  if (snapshot.mode === "business") {
    const initial = createInitialState();
    for (const appointment of snapshot.appointments) {
      const time = DateTime.fromISO(appointment.start, {
        setZone: true,
      }).setZone("America/New_York");
      if (
        !initial.resources.some(
          (resource) => resource.id === appointment.resourceId,
        ) ||
        !time.isValid ||
        !/^2026-10-1[2-6]$/.test(time.toISODate() ?? "") ||
        time.minute % 15 ||
        time.second ||
        time.millisecond ||
        time.hour < 9 ||
        time.plus({ minutes: appointment.durationMinutes }).hour > 17 ||
        time.plus({ minutes: appointment.durationMinutes }) >
          time.startOf("day").set({ hour: 17 })
      )
        throw new AgentError(
          "INVALID_SNAPSHOT",
          "The sample appointment schedule is invalid.",
        );
    }
    if (
      snapshot.appointments.filter(
        (item) =>
          item.inquiryId === snapshot.record.id && item.status === "CONFIRMED",
      ).length > 1
    )
      throw new AgentError(
        "INVALID_SNAPSHOT",
        "This inquiry has conflicting sample appointments.",
      );
    return {
      resources: initial.resources,
      activity: [],
      appointments: snapshot.appointments,
      inquiries: [
        {
          id: snapshot.record.id,
          name: "Sample customer",
          initials: "SC",
          email: "",
          service: snapshot.record.service,
          notes: snapshot.record.notes,
          requestedTime: snapshot.record.requestedTime ?? undefined,
          outcome: snapshot.record.outcome,
          receivedAt: DEMO_NOW,
          estimatedValue: 0,
          reportedValue: null,
          contactPermission: false,
          source: "message",
          followUp: "NONE",
          draft: "",
          approvedDraft: null,
          lastAction: "",
        },
      ],
    };
  }
  const initial = createInitialVolunteerState();
  for (const assignment of snapshot.assignments) {
    const shift = initial.shifts.find((item) => item.id === assignment.shiftId);
    if (!shift)
      throw new AgentError(
        "INVALID_SNAPSHOT",
        "A sample assignment references an unknown shift.",
      );
    const duration = (Date.parse(shift.end) - Date.parse(shift.start)) / 60000;
    if (
      assignment.status === "COMPLETED" &&
      (assignment.completedMinutes === null ||
        assignment.completedMinutes > duration ||
        Date.parse(shift.end) > Date.parse(DEMO_NOW))
    )
      throw new AgentError(
        "INVALID_SNAPSHOT",
        "Completed sample hours must match an ended shift.",
      );
    if (
      assignment.status !== "COMPLETED" &&
      assignment.completedMinutes !== null
    )
      throw new AgentError(
        "INVALID_SNAPSHOT",
        "Only completed shifts can have recorded minutes.",
      );
  }
  for (const window of snapshot.record.availability)
    if (Date.parse(window.end) <= Date.parse(window.start))
      throw new AgentError(
        "INVALID_SNAPSHOT",
        "Availability must end after it starts.",
      );
  return {
    shifts: initial.shifts,
    activity: [],
    assignments: snapshot.assignments,
    registrations: [
      {
        ...snapshot.record,
        name: "Sample volunteer",
        initials: "SV",
        email: "",
        contactPermission: false,
        source: "message",
        followUp: "NONE",
        draft: "",
        approvedDraft: null,
        lastAction: "",
      },
    ],
  };
}

export function toolFor(request: AnalyzeRequest): ToolSpecification {
  return request.mode === "business"
    ? {
        name: "businessAvailability",
        description:
          "Read available sample appointments. Use null for an unspecified date, time, or stylist. The sample default visit is 60 minutes. This cannot book anything.",
        inputSchema: {
          json: {
            type: "object",
            properties: {
              date: {
                type: ["string", "null"],
                description:
                  "Explicit requested date, YYYY-MM-DD, October 12–16, 2026; null if unknown.",
              },
              time: {
                type: ["string", "null"],
                description:
                  "Explicit requested 24-hour time HH:mm, or null if unknown.",
              },
              resourceId: {
                type: ["string", "null"],
                description:
                  "maya, theo, or null when no stylist was requested.",
              },
              durationMinutes: {
                type: "integer",
                description:
                  "15–120 minutes in 15-minute steps; 60 for an unspecified sample haircut.",
              },
            },
            required: ["date", "time", "resourceId", "durationMinutes"],
          },
        },
      }
    : {
        name: "volunteerShiftOptions",
        description:
          "Read eligible sample shifts using recorded role interests, availability, existing assignments, capacity, and the fixed sample clock. Null selects all shifts. This cannot assign anyone.",
        inputSchema: {
          json: {
            type: "object",
            properties: {
              shiftId: {
                type: ["string", "null"],
                description:
                  "An explicitly requested shift ID from the supplied shift list, or null.",
              },
            },
            required: ["shiftId"],
          },
        },
      };
}

export function agentContext(request: AnalyzeRequest): string {
  const state = reconstructSnapshot(request);
  const record = request.snapshot.record;
  return JSON.stringify({
    mode: request.mode,
    sampleClock: DEMO_NOW,
    timezone: "America/New_York",
    record: {
      ...record,
      notes: safeModelText(record.notes),
      ...(request.snapshot.mode === "business"
        ? {
            service: safeModelText(request.snapshot.record.service),
            requestedTime: safeModelText(
              request.snapshot.record.requestedTime ?? "",
            ),
          }
        : {}),
    },
    ...("resources" in state
      ? { resources: state.resources }
      : { shifts: state.shifts }),
  });
}

export function runReadTool(
  request: AnalyzeRequest,
  name: string,
  input: unknown,
): ToolReadResult {
  if (name !== toolFor(request).name)
    throw new AgentError(
      "INVALID_TOOL",
      "The assistant requested an unsupported tool.",
      502,
    );
  const state = reconstructSnapshot(request);
  const option = (
    action: AgentOption["action"],
    label: string,
  ): AgentOption => ({
    optionId: `option-${sha256(canonicalSerialize({ request, action })).slice(0, 24)}`,
    label,
    action,
  });
  if (request.mode === "business" && "inquiries" in state) {
    const query = parseInput(businessInput, input);
    if (!query.date)
      return {
        options: [],
        questions: ["Which calendar date would the customer prefer?"],
      };
    const inquiry = state.inquiries[0];
    const previous = state.appointments.find(
      (item) => item.inquiryId === inquiry.id && item.status === "CONFIRMED",
    );
    const options: AgentOption[] = [];
    for (const resource of state.resources.filter(
      (item) => !query.resourceId || item.id === query.resourceId,
    )) {
      for (const start of availableSlots(
        state,
        resource.id,
        query.date,
        query.durationMinutes,
        previous?.id,
      )) {
        if (Date.parse(start) < Date.parse(DEMO_NOW)) continue;
        if (
          query.time &&
          DateTime.fromISO(start)
            .setZone("America/New_York")
            .toFormat("HH:mm") !== query.time
        )
          continue;
        if (
          previous?.resourceId === resource.id &&
          Date.parse(previous.start) === Date.parse(start) &&
          previous.durationMinutes === query.durationMinutes
        )
          continue;
        const action: AgentOption["action"] = previous
          ? {
              type: "RESCHEDULE",
              appointmentId: previous.id,
              resourceId: resource.id,
              start,
              durationMinutes: query.durationMinutes,
            }
          : {
              type: "BOOK",
              inquiryId: inquiry.id,
              resourceId: resource.id,
              start,
              durationMinutes: query.durationMinutes,
            };
        if (!applyAction(state, action).error)
          options.push(
            option(
              action,
              `${formatDate(start)}, ${formatTime(start)} with ${resource.name} · ${query.durationMinutes} minutes`,
            ),
          );
        if (options.length >= 8) break;
      }
      if (options.length >= 8) break;
    }
    return {
      options,
      questions: options.length
        ? []
        : [
            "That request has no available sample slot. Would another time or stylist work?",
          ],
    };
  }
  if (!("registrations" in state))
    throw new AgentError(
      "INVALID_SNAPSHOT",
      "The workspace does not match the request.",
    );
  const query = parseInput(volunteerInput, input);
  if (
    query.shiftId &&
    !state.shifts.some((shift) => shift.id === query.shiftId)
  )
    throw new AgentError(
      "INVALID_TOOL_INPUT",
      "The assistant referenced an unknown shift.",
      502,
    );
  const registration = state.registrations[0];
  if (!registration.availability.length)
    return {
      options: [],
      questions: ["What days and times is this volunteer available?"],
    };
  if (!registration.roleInterests.length)
    return {
      options: [],
      questions: ["Which volunteer roles interest this person?"],
    };
  const previous = state.assignments.filter(
    (item) =>
      item.registrationId === registration.id && item.status === "ASSIGNED",
  );
  if (previous.length > 1)
    return {
      options: [],
      questions: ["Which existing assignment should change?"],
    };
  const options: AgentOption[] = [];
  const reasons = new Set<string>();
  for (const shift of state.shifts.filter(
    (item) => !query.shiftId || item.id === query.shiftId,
  )) {
    const eligibility = shiftEligibility(
      state,
      registration.id,
      shift.id,
      previous[0]?.id,
    );
    if (!eligibility.allowed) {
      if (eligibility.reason) reasons.add(eligibility.reason);
      continue;
    }
    const action: AgentOption["action"] = previous[0]
      ? { type: "MOVE", assignmentId: previous[0].id, shiftId: shift.id }
      : { type: "ASSIGN", registrationId: registration.id, shiftId: shift.id };
    if (!applyVolunteerAction(state, action).error)
      options.push(
        option(
          action,
          `${shift.task} · ${formatDate(shift.start)}, ${formatTime(shift.start)}–${formatTime(shift.end)} · ${eligibility.remainingPlaces} places available`,
        ),
      );
    if (options.length >= 8) break;
  }
  return {
    options,
    questions: options.length
      ? []
      : [...reasons].slice(0, 3).length
        ? [...reasons].slice(0, 3)
        : [
            "No eligible shift matches this request. Please check role interests and availability.",
          ],
  };
}
