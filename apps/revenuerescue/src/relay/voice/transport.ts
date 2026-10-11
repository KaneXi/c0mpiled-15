import { createHash } from "node:crypto";
import {
  ConnectClient,
  StartOutboundVoiceContactCommand,
  DescribeContactCommand,
  StopContactCommand,
} from "@aws-sdk/client-connect";
import { DynamoRelayStore } from "../server/store";
import { completeCall } from "../engine";
import { advanceOutbound } from "./workflow";
import { openingPrompt } from "./prompts";
import { prepareCaller, callerReady, releaseCaller } from "./number";
const connect = new ConnectClient({ region: "us-east-1", maxAttempts: 1 });
export async function tickOutbound() {
  const tenant = process.env.RELAY_PUBLIC_TEST_TENANT!;
  const db = new DynamoRelayStore();
  let state = await db.read(tenant);
  if (
    state.phoneTest?.mode !== "outbound" ||
    (!state.phoneTest.startedAt && !state.phoneTest.scheduledFor)
  )
    return;
  if (
    Date.now() >= Date.parse(state.phoneTest.closesAt || "1970-01-01") &&
    !state.paused
  )
    state = await db.mutate(tenant, undefined, undefined, (current) => ({
      ...current,
      paused: true,
      phoneTest: {
        ...current.phoneTest!,
        stage: "stopped",
        detail: "The authorized test window ended. Automatic calling stopped.",
        updatedAt: new Date().toISOString(),
      },
    }));
  const instance = process.env.VOICE_CONNECT_INSTANCE!;
  // Finish observing the previous contact before permitting the next telephone call.
  for (const call of state.calls.filter(
    (c) => c.contactId && !c.disconnectedAt,
  )) {
    const { Contact: contact } = await connect.send(
      new DescribeContactCommand({
        InstanceId: instance,
        ContactId: call.contactId,
      }),
    );
    const finished = contact?.DisconnectTimestamp;
    if (!finished) {
      if (
        Date.now() - Date.parse(call.startedAt!) > 100000 ||
        state.paused ||
        Date.now() > Date.parse(state.phoneTest!.closesAt!)
      )
        await connect.send(
          new StopContactCommand({
            InstanceId: instance,
            ContactId: call.contactId,
          }),
        );
      return;
    }
    state = await db.mutate(tenant, undefined, undefined, (current) => {
      let next = structuredClone(current);
      const row = next.calls.find((c) => c.id === call.id)!;
      row.disconnectedAt = finished.toISOString();
      if (["in_progress", "analyzing"].includes(row.status)) {
        const answered = !!contact?.ConnectedToSystemTimestamp;
        next = completeCall(
          next,
          row.id,
          {
            outcome: answered ? "uncertain" : "no_answer",
            confidence: 1,
            summary: answered
              ? "The phone call ended without a clear commitment."
              : "The phone call was not answered.",
            clarification: answered
              ? "Review the unanswered availability question."
              : "",
            availableFrom: null,
            availableUntil: null,
          },
          "amazon-connect",
          "[Telephone transport ended without a completed answer]",
          new Date().toISOString(),
        );
      }
      return next;
    });
  }
  // Do not provision a fresh caller after a missed start or after cancellation.
  if (
    !state.paused &&
    state.phoneTest?.scheduledFor &&
    !state.calls.some((c) => c.startedAt) &&
    Date.now() > Date.parse(state.phoneTest.scheduledFor) + 120_000
  ) {
    state = await db.mutate(tenant, undefined, undefined, (current) =>
      advanceOutbound(current, new Date().toISOString()),
    );
  }
  if (state.paused) {
    if (state.phoneTest?.allocationNumber && !state.phoneTest.phoneNumberId) {
      const recovered = await prepareCaller(connect, db, tenant, state);
      if (!recovered) return;
      state = recovered;
    }
    await releaseCaller(connect, db, tenant, state);
    return;
  }
  const prepared = await prepareCaller(connect, db, tenant, state);
  if (!prepared) return;
  state = prepared;
  if (state.paused) {
    await releaseCaller(connect, db, tenant, state);
    return;
  }
  if (!(await callerReady(connect, state))) return;
  state = await db.mutate(tenant, undefined, undefined, (current) =>
    advanceOutbound(current, new Date().toISOString()),
  );
  if (state.paused) {
    await releaseCaller(connect, db, tenant, state);
    return;
  }
  const call = state.calls.find(
    (c) =>
      c.status === "in_progress" &&
      c.transport === "amazon-connect" &&
      !c.contactId,
  );
  if (!call) return;
  const person = state.volunteers.find((v) => v.id === call.volunteerId)!;
  const allowed: string[] = JSON.parse(
    process.env.VOICE_ALLOWED_PHONES || "[]",
  );
  if (
    !allowed.includes(person.phone) ||
    !person.callingConsent ||
    person.optedOut
  )
    throw new Error("Destination is not on the consented test allowlist");
  const shift = state.shifts.find((s) => s.id === call.shiftId)!;
  const original = state.calls.find(
    (item) =>
      item.shiftId === shift.id &&
      item.purpose === "check_in" &&
      item.result?.outcome === "declined",
  );
  const originalName = state.volunteers.find(
    (item) => item.id === original?.volunteerId,
  )?.name;
  const prompt = openingPrompt(call, shift, person, originalName);
  const token = createHash("sha256")
    .update(`${tenant}:${call.id}:${call.startedAt}`)
    .digest("hex");
  try {
    const result = await connect.send(
      new StartOutboundVoiceContactCommand({
        InstanceId: instance,
        ContactFlowId: process.env.VOICE_CONNECT_FLOW!,
        SourcePhoneNumber: state.phoneTest!.callerNumber!,
        DestinationPhoneNumber: person.phone,
        ClientToken: token,
        TrafficType: "GENERAL",
        Attributes: { relayCallId: call.id, relayPrompt: prompt },
      }),
    );
    if (!result.ContactId) throw new Error("Missing contact id");
    await db.mutate(tenant, undefined, undefined, (current) => {
      const next = structuredClone(current);
      const row = next.calls.find((c) => c.id === call.id)!;
      row.contactId = result.ContactId;
      const now = new Date().toISOString();
      const detail = `Calling ${person.name}${call.purpose === "replacement" ? " to ask about replacement coverage" : " to check availability"}. AWS accepted the real outbound request.`;
      next.phoneTest = {
        ...next.phoneTest!,
        stage: "calling",
        detail,
        updatedAt: now,
        events: [...next.phoneTest!.events, { at: now, text: detail }].slice(
          -30,
        ),
      };
      return next;
    });
  } catch (error) {
    // Reuse the same stable client token on a later tick after an ambiguous network failure.
    if (
      error instanceof Error &&
      [
        "InvalidParameterException",
        "InvalidRequestException",
        "DestinationNotAllowedException",
        "OutboundContactNotPermittedException",
        "AccessDeniedException",
      ].includes(error.name)
    ) {
      await db.mutate(tenant, undefined, undefined, (current) => ({
        ...current,
        paused: true,
        phoneTest: {
          ...current.phoneTest!,
          stage: "failed",
          detail:
            "AWS refused the call request. The sequence is paused; no replacement was assigned.",
          updatedAt: new Date().toISOString(),
        },
      }));
    }
    throw error;
  }
}
