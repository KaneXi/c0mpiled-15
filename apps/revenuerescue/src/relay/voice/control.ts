import { timingSafeEqual } from "node:crypto";
import { getStore, ServiceError } from "../server/store";
export async function controlPhoneTest(input: unknown) {
  if (!input || typeof input !== "object")
    throw new ServiceError("Invalid phone control.");
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).some((k) => !["phoneTestAction", "code"].includes(k)) ||
    !["start", "stop"].includes(String(value.phoneTestAction)) ||
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
    if (value.phoneTestAction === "start") {
      if (state.phoneTest.startedAt)
        throw new ServiceError(
          "This single-run test has already started.",
          409,
        );
      if (
        !state.phoneTest.callerNumber ||
        Date.now() >= Date.parse(state.phoneTest.closesAt || "1970-01-01")
      )
        throw new ServiceError("Phone service is not active.", 409);
      return {
        ...state,
        paused: false,
        phoneTest: {
          ...state.phoneTest,
          startedAt: now,
          stage: "ready",
          updatedAt: now,
          detail:
            "Presenter started the bounded availability and replacement sequence.",
        },
      };
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
  return { ok: true };
}
