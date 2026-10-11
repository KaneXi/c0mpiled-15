import { createHash } from "node:crypto";
import {
  ConnectClient,
  ReleasePhoneNumberCommand,
  StopContactCommand,
} from "@aws-sdk/client-connect";
import { DynamoRelayStore } from "../server/store";
import { createAgentProvider } from "../providers/agent";
import { completeCall } from "../engine";
import { tickOutbound } from "./transport";
import { availabilityQuestion, spokenShiftWindow } from "./prompts";
interface LexEvent {
  source?: string;
  sessionId?: string;
  inputTranscript?: string;
  bot?: { id: string; aliasId: string };
  sessionState?: {
    originatingRequestId?: string;
    sessionAttributes?: Record<string, string>;
    intent?: { name: string };
  };
}
export async function handler(event: LexEvent) {
  const db = new DynamoRelayStore();
  const tenant = process.env.RELAY_PUBLIC_TEST_TENANT!;
  if (event.source === "relay.voice.tick" || event.source === "aws.connect") {
    await tickOutbound();
    return { ok: true };
  }
  if (event.source === "relay.voice.close") {
    const connect = new ConnectClient({ region: "us-east-1", maxAttempts: 2 });
    const before = await db.read(tenant);
    await db.mutate(tenant, undefined, undefined, (state) => ({
      ...state,
      paused: true,
    }));
    for (const call of before.calls.filter(
      (call) => call.contactId && !call.disconnectedAt,
    )) {
      try {
        await connect.send(
          new StopContactCommand({
            InstanceId: process.env.VOICE_CONNECT_INSTANCE!,
            ContactId: call.contactId!,
          }),
        );
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !["ContactNotFoundException", "InvalidRequestException"].includes(
            error.name,
          )
        )
          throw error;
      }
    }
    try {
      await connect.send(
        new ReleasePhoneNumberCommand({
          PhoneNumberId: process.env.VOICE_PHONE_NUMBER_ID!,
        }),
      );
    } catch (e) {
      if (!(e instanceof Error) || e.name !== "ResourceNotFoundException")
        throw e;
    }
    await db.mutate(tenant, undefined, undefined, (s) => ({
      ...s,
      paused: true,
      phoneTest: {
        ...s.phoneTest!,
        stage: s.phoneTest?.stage === "completed" ? "completed" : "stopped",
        callerNumber: undefined,
        closesAt: new Date().toISOString(),
        detail:
          "The phone test has ended and its caller number was released. Check the saved call results and schedule below.",
        updatedAt: new Date().toISOString(),
      },
    }));
    return { closed: true };
  }
  if (
    event.bot?.id !== process.env.LEX_BOT_ID ||
    event.bot?.aliasId !== process.env.LEX_ALIAS_ID
  )
    throw new Error("Unrecognized bot");
  const attrs = { ...event.sessionState?.sessionAttributes };
  const turn = Number(attrs.relayTurn || "0");
  const respond = (text: string, close = true) => ({
    sessionState: {
      sessionAttributes: attrs,
      dialogAction: { type: close ? "Close" : "ElicitIntent" },
      ...(close
        ? {
            intent: {
              name: event.sessionState?.intent?.name || "RelayRequest",
              state: "Fulfilled",
            },
          }
        : {}),
    },
    messages: [{ contentType: "PlainText", content: text.slice(0, 900) }],
  });
  if (
    turn >= 2 ||
    Date.now() >= Date.parse(process.env.VOICE_DEMO_ENDS_AT || "1970-01-01")
  )
    return respond(
      "This test has reached its limit. Your availability has not been confirmed. Goodbye.",
    );
  const state = await db.read(tenant);
  const call = state.calls.find(
    (c) =>
      c.id === attrs.relayCallId &&
      c.contactId === attrs.relayContactId &&
      c.transport === "amazon-connect",
  );
  if (!call || state.paused || state.phoneTest?.mode !== "outbound")
    return respond(
      "This call is no longer associated with an active scheduling test. Goodbye.",
    );
  if (call.status === "completed")
    return respond("Your answer has already been saved. Thank you. Goodbye.");
  if (call.status !== "in_progress")
    return respond("This scheduling request has stopped. Goodbye.");
  const volunteer = state.volunteers.find((v) => v.id === call.volunteerId)!;
  const shift = state.shifts.find((s) => s.id === call.shiftId)!;
  const text = event.inputTranscript?.trim().slice(0, 3000);
  if (!text) {
    attrs.relayTurn = String(turn + 1);
    return respond(availabilityQuestion(shift, volunteer), false);
  }
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        event.sessionId,
        event.sessionState?.originatingRequestId || turn,
        text,
      ]),
    )
    .digest("hex");
  const cached = state.phoneTest.processedTurns?.find((r) => r.key === key);
  if (cached) return respond(cached.reply, cached.close);
  const history = (attrs.relayHistory || "").slice(-4500);
  const transcript = (history + "\nVolunteer: " + text).trim();
  try {
    await db.reserveAnalysis(tenant);
    const result = await createAgentProvider({
      enabled: true,
      region: "us-east-2",
    }).interpret(
      { call, volunteer, shift, transcript },
      AbortSignal.timeout(14000),
    );
    const interpretation = result.interpretation;
    const explicitQuestion = availabilityQuestion(shift, volunteer);
    const clarify =
      interpretation.confidence < 0.8 ||
      !!interpretation.clarification ||
      ["uncertain", "question", "partial", "late"].includes(
        interpretation.outcome,
      );
    if (clarify && turn < 1) {
      attrs.relayTurn = String(turn + 1);
      attrs.relayHistory = (transcript + "\nRelay: " + explicitQuestion).slice(
        -5000,
      );
      return respond(explicitQuestion, false);
    }
    let reply = "";
    await db.mutate(
      tenant,
      state.revision,
      { id: key, fingerprint: key },
      (current) => {
        const next = completeCall(
          current,
          call.id,
          interpretation,
          "amazon-bedrock",
          transcript,
          new Date().toISOString(),
        );
        const assignment = next.assignments.find(
          (a) =>
            a.shiftId === shift.id &&
            a.volunteerId === volunteer.id &&
            a.status === "confirmed",
        );
        reply = assignment
          ? call.purpose === "replacement"
            ? `Thank you. You are confirmed as the replacement for ${shift.title}, ${spokenShiftWindow(shift, volunteer.timezone)}.`
            : `Thank you. You are confirmed for ${shift.title}, ${spokenShiftWindow(shift, volunteer.timezone)}.`
          : interpretation.outcome === "declined"
            ? call.purpose === "check_in"
              ? "Thank you for letting me know. I will look for an eligible replacement."
              : "Thank you. I will ask the next eligible person."
            : "Thank you. Your answer was saved, but the full shift is not confirmed. The schedule needs review.";
        const now = new Date().toISOString();
        const detail = `${volunteer.name}: ${reply}`;
        next.phoneTest = {
          ...next.phoneTest!,
          detail,
          updatedAt: now,
          events: [...next.phoneTest!.events, { at: now, text: detail }].slice(
            -30,
          ),
          processedTurns: [
            ...(next.phoneTest!.processedTurns || []),
            { key, reply, close: true },
          ].slice(-30),
        };
        return next;
      },
    );
    return respond(reply || "Your answer has already been saved. Thank you.");
  } catch {
    return respond(
      "I could not safely confirm the update. Your schedule has not been confirmed from this response. Please check the website. Goodbye.",
    );
  }
}
