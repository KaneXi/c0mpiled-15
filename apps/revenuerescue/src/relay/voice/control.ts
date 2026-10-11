import { wakeVoiceWorker } from "./dispatch";
import { addVoiceVolunteer, voiceParticipantAllowed } from "./participants";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { getStore, ServiceError } from "../server/store";
import { z } from "zod";
import type { RelayState } from "../contracts";

export function phoneTestRunLimit() {
  if (process.env.VOICE_TEST_RUN_LIMIT === "unlimited") return null;
  const value = Number(process.env.VOICE_TEST_RUN_LIMIT || "3");
  return Number.isInteger(value) && value >= 3 && value <= 50 ? value : 3;
}
export function schedulePhoneTest(
  state: RelayState,
  scheduledFor: unknown,
  now: string,
  immediate = false,
): RelayState {
  const due = immediate
    ? Date.parse(now)
    : typeof scheduledFor === "string"
      ? Date.parse(scheduledFor)
      : NaN;
  const test = state.phoneTest;
  if (
    test?.mode !== "outbound" ||
    !test.runId ||
    test.startedAt ||
    test.armedAt
  )
    throw new ServiceError(
      "This single-run test has already been scheduled or started.",
      409,
    );
  const limit = phoneTestRunLimit();
  if (limit !== null && (test.runsScheduled || 0) >= limit)
    throw new ServiceError(
      "This demo has reached its authorized test-run limit.",
      409,
    );
  if (!Number.isFinite(due) || due < Date.parse(now) + (immediate ? 0 : 10_000))
    throw new ServiceError(
      "Choose an inquiry time at least ten seconds in the future.",
    );
  if (
    !Number.isFinite(Date.parse(test.closesAt || "")) ||
    due + 180_000 >= Date.parse(test.closesAt!)
  )
    throw new ServiceError(
      "Phone service must remain active for at least three minutes after the inquiry time.",
      409,
    );
  const shift = state.shifts.find((item) => item.status === "published");
  if (
    !shift ||
    due >= Date.parse(shift.start) ||
    due < Date.parse(shift.start) - state.settings.checkInLeadMinutes * 60_000
  )
    throw new ServiceError(
      "Choose an inquiry time within the check-in window before the published shift.",
    );
  return {
    ...state,
    paused: false,
    phoneTest: {
      ...test,
      scheduledFor: new Date(due).toISOString(),
      armedAt: now,
      runsScheduled: (test.runsScheduled || 0) + 1,
      stage: "waiting",
      updatedAt: now,
      detail: immediate
        ? "Start requested on the website. Preparing the caller and confirming the saved shift hours."
        : "Inquiry scheduled. No call will be placed before the selected time.",
    },
  };
}

const setupSchema = z
  .object({
    originalId: z.string(),
    replacementId: z.string(),
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
  })
  .strict();
export function preparePhoneTest(
  state: RelayState,
  input: unknown,
  now: string,
): RelayState {
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success)
    throw new ServiceError(
      "Choose two participants and valid dated shift times.",
    );
  const { originalId, replacementId, start, end } = parsed.data;
  const old = state.phoneTest;
  if (
    !old ||
    !state.paused ||
    old.phoneNumberId ||
    old.allocationNumber ||
    state.calls.some((c) => c.contactId && !c.disconnectedAt)
  )
    throw new ServiceError(
      "Wait until the previous test has stopped and its caller number has been released.",
      409,
    );
  const limit = phoneTestRunLimit();
  if (
    limit !== null &&
    (old.runsScheduled ??
      (old.history?.length || 0) + (old.startedAt ? 1 : 0)) >= limit
  )
    throw new ServiceError(
      "This demo has reached its authorized test-run limit. Calling is disabled until the owner renews the test allowance.",
      409,
    );
  const people = [originalId, replacementId].map((id) =>
    state.volunteers.find((v) => v.id === id),
  );
  if (
    originalId === replacementId ||
    people.some((p) => !p || !voiceParticipantAllowed(p))
  )
    throw new ServiceError(
      "Select two distinct consenting participants from the authorized test roster.",
    );
  if (
    Date.parse(start) < Date.parse(now) + 5 * 60_000 ||
    Date.parse(start) > Date.parse(now) + 2 * 60 * 60_000 ||
    Date.parse(end) <= Date.parse(start) ||
    Date.parse(end) - Date.parse(start) > 2 * 60 * 60_000
  )
    throw new ServiceError(
      "Choose a future shift starting in 5–120 minutes and lasting no more than two hours.",
    );
  const serviceEnd = Date.parse(process.env.VOICE_SERVICE_ENDS_AT || "");
  const closesAt = Math.min(
    Date.parse(now) + 40 * 60_000,
    Number.isFinite(serviceEnd) ? serviceEnd : Infinity,
  );
  if (closesAt <= Date.parse(now) + 5 * 60_000)
    throw new ServiceError(
      "The authorized phone service window has ended.",
      409,
    );
  const history = [...(old.history || [])];
  if (state.calls.length)
    history.push({
      endedAt: now,
      shift: state.shifts[0],
      calls: state.calls,
      assignmentNames: state.assignments
        .filter((a) => a.status === "confirmed")
        .map((a) => state.volunteers.find((v) => v.id === a.volunteerId)!.name),
    });
  return {
    ...state,
    paused: true,
    volunteers: state.volunteers.map((v) =>
      [originalId, replacementId].includes(v.id)
        ? {
            ...v,
            roles: [...new Set([...v.roles, "welcome"])],
            availability: [{ start: now, end }],
          }
        : v,
    ),
    shifts: [
      {
        id: "live-shift",
        title: "Volunteer check-in desk",
        role: "welcome",
        start,
        end,
        required: 1,
        status: "published",
        version: 1,
      },
    ],
    assignments: [
      {
        id: randomUUID(),
        shiftId: "live-shift",
        volunteerId: originalId,
        status: "assigned",
        note: "Manager prepared this test on the website; attendance awaits a spoken answer.",
      },
    ],
    calls: [],
    incidents: [],
    settings: { checkInLeadMinutes: 120, maxAttempts: 1, retryMinutes: 5 },
    phoneTest: {
      mode: "outbound",
      runId: randomUUID(),
      runLimit: phoneTestRunLimit(),
      originalVolunteerId: originalId,
      replacementVolunteerId: replacementId,
      runsScheduled:
        old.runsScheduled ??
        (old.history?.length || 0) + (old.startedAt ? 1 : 0),
      stage: "ready",
      detail:
        "Test prepared on the website. Authorize the two-call sequence, then call now or schedule an inquiry.",
      updatedAt: now,
      closesAt: new Date(closesAt).toISOString(),
      history,
      events: [
        {
          at: now,
          text: "The presenter saved the roster order and shift on the website. No call has been scheduled.",
        },
      ],
    },
  };
}

export async function controlPhoneTest(input: unknown) {
  if (!input || typeof input !== "object")
    throw new ServiceError("Invalid phone control.");
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (k) =>
        ![
          "phoneTestAction",
          "code",
          "scheduledFor",
          "setup",
          "authorizeCalls",
          "volunteer",
        ].includes(k),
    ) ||
    !["prepare", "schedule", "start_now", "stop", "save_volunteer"].includes(
      String(value.phoneTestAction),
    ) ||
    typeof value.code !== "string"
  )
    throw new ServiceError("Invalid phone control.");
  const expected = Buffer.from(process.env.RELAY_PHONE_CONTROL_CODE || "");
  const provided = Buffer.from(value.code);
  if (
    expected.length < 12 ||
    provided.length !== expected.length ||
    !timingSafeEqual(expected, provided)
  )
    throw new ServiceError(
      "Enter the presenter code to control real calls.",
      403,
      "FORBIDDEN",
    );
  const tenant = process.env.RELAY_PUBLIC_TEST_TENANT;
  if (!tenant) throw new ServiceError("Phone demo is not configured.", 503);
  await getStore().mutate(tenant, undefined, undefined, (state) => {
    if (state.phoneTest?.mode !== "outbound")
      throw new ServiceError("This is not an outbound phone demo.");
    const now = new Date().toISOString();
    if (value.phoneTestAction === "save_volunteer")
      return addVoiceVolunteer(state, value.volunteer, now);
    if (value.phoneTestAction === "prepare")
      return preparePhoneTest(state, value.setup, now);
    if (
      value.phoneTestAction === "schedule" ||
      value.phoneTestAction === "start_now"
    ) {
      if (value.authorizeCalls !== true)
        throw new ServiceError(
          "Confirm authorization for the two real test calls.",
        );
      if (process.env.VOICE_SERVICE_READY !== "true")
        throw new ServiceError("Automatic calling is not enabled.", 503);
      if (
        value.phoneTestAction === "start_now" &&
        !process.env.VOICE_FUNCTION_NAME
      )
        throw new ServiceError(
          "Immediate calling is not configured. Use a scheduled inquiry.",
          503,
        );
      return schedulePhoneTest(
        state,
        value.scheduledFor,
        now,
        value.phoneTestAction === "start_now",
      );
    }
    return {
      ...state,
      paused: true,
      phoneTest: {
        ...state.phoneTest,
        stage: "stopped",
        updatedAt: now,
        detail: "Presenter stopped the sequence. No further calls will start.",
      },
    };
  });
  // Persist first. An ambiguous dispatch timeout must never disarm or create a second run.
  const dispatch =
    value.phoneTestAction === "start_now" ? await wakeVoiceWorker() : undefined;
  return { ok: true, dispatch };
}
