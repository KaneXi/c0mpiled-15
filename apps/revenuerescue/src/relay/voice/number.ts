import { createHash } from "node:crypto";
import {
  ConnectClient,
  SearchAvailablePhoneNumbersCommand,
  ClaimPhoneNumberCommand,
  DescribePhoneNumberCommand,
  ReleasePhoneNumberCommand,
} from "@aws-sdk/client-connect";
import type { RelayState } from "../contracts";
import type { RelayStore } from "../server/store";

export async function provisionCaller(
  connect: ConnectClient,
  db: RelayStore,
  tenant: string,
  state: RelayState,
): Promise<RelayState> {
  const test = state.phoneTest!;
  if (
    test.phoneNumberId ||
    (state.paused && !test.allocationNumber) ||
    !test.runId ||
    !test.armedAt
  )
    return state;
  const runId = test.runId;
  if (!test.allocationNumber) {
    const result = await connect.send(
      new SearchAvailablePhoneNumbersCommand({
        TargetArn: process.env.VOICE_CONNECT_INSTANCE_ARN!,
        PhoneNumberCountryCode: "US",
        PhoneNumberType: "DID",
        MaxResults: 5,
      }),
    );
    const number = result.AvailableNumbersList?.[0]?.PhoneNumber;
    if (!number) throw new Error("No temporary caller number is available.");
    state = await db.mutate(tenant, undefined, undefined, (current) => {
      if (
        current.paused ||
        current.phoneTest?.runId !== runId ||
        current.phoneTest.allocationNumber
      )
        return current;
      return {
        ...current,
        phoneTest: {
          ...current.phoneTest,
          allocationNumber: number,
          allocationToken: createHash("sha256").update(runId).digest("hex"),
          detail:
            "Preparing the temporary caller number. The first inquiry will wait for its scheduled time.",
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }
  if (state.phoneTest?.runId !== runId || !state.phoneTest.allocationNumber)
    return state;
  const result = await connect.send(
    new ClaimPhoneNumberCommand({
      TargetArn: process.env.VOICE_CONNECT_INSTANCE_ARN!,
      PhoneNumber: state.phoneTest.allocationNumber,
      ClientToken: state.phoneTest.allocationToken,
      PhoneNumberDescription: "Website-authorized two-call Relay demonstration",
      Tags: { RelayDemo: "website-outbound" },
    }),
  );
  if (!result.PhoneNumberId)
    throw new Error("AWS did not return a caller number identifier.");
  return db.mutate(tenant, undefined, undefined, (current) => ({
    ...current,
    phoneTest: {
      ...current.phoneTest!,
      phoneNumberId: result.PhoneNumberId,
      callerNumber: state.phoneTest!.allocationNumber,
      detail: "Caller number prepared. Waiting for the scheduled inquiry time.",
      updatedAt: new Date().toISOString(),
    },
  }));
}
export async function callerReady(connect: ConnectClient, state: RelayState) {
  if (!state.phoneTest?.phoneNumberId) return false;
  const result = await connect.send(
    new DescribePhoneNumberCommand({
      PhoneNumberId: state.phoneTest.phoneNumberId,
    }),
  );
  return (
    result.ClaimedPhoneNumberSummary?.PhoneNumberStatus?.Status === "CLAIMED"
  );
}
export async function releaseCaller(
  connect: ConnectClient,
  db: RelayStore,
  tenant: string,
  state: RelayState,
) {
  const id = state.phoneTest?.phoneNumberId;
  if (!id) return;
  try {
    await connect.send(new ReleasePhoneNumberCommand({ PhoneNumberId: id }));
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "ResourceNotFoundException")
      throw error;
  }
  await db.mutate(tenant, undefined, undefined, (current) => {
    if (current.phoneTest?.phoneNumberId !== id) return current;
    const now = new Date().toISOString();
    return {
      ...current,
      paused: true,
      phoneTest: {
        ...current.phoneTest,
        callerNumber: undefined,
        phoneNumberId: undefined,
        allocationNumber: undefined,
        allocationToken: undefined,
        updatedAt: now,
        events: [
          ...current.phoneTest.events,
          {
            at: now,
            text: "AWS automatically released the temporary caller number. No more calls will be placed in this run.",
          },
        ],
      },
    };
  });
}

/** Retry an uncertain claim with the same saved token, including after cancellation. */
export async function prepareCaller(
  connect: ConnectClient,
  db: RelayStore,
  tenant: string,
  state: RelayState,
): Promise<RelayState | undefined> {
  try {
    return await provisionCaller(connect, db, tenant, state);
  } catch (error) {
    const definitive =
      error instanceof Error &&
      [
        "InvalidParameterException",
        "InvalidRequestException",
        "AccessDeniedException",
        "ResourceNotFoundException",
        "ResourceNotFound",
        "ResourceConflictException",
        "ServiceQuotaExceededException",
        "LimitExceededException",
      ].includes(error.name);
    await db.mutate(tenant, undefined, undefined, (current) => ({
      ...current,
      paused: definitive || current.paused,
      phoneTest: {
        ...current.phoneTest!,
        ...(definitive
          ? {
              allocationNumber: undefined,
              allocationToken: undefined,
              stage: "failed" as const,
            }
          : {}),
        detail: definitive
          ? "AWS could not reserve a caller number. This test stopped without placing a call."
          : "AWS caller-number confirmation is delayed. Recovering the same request; no new number or call will be requested.",
        updatedAt: new Date().toISOString(),
      },
    }));
    return undefined;
  }
}
