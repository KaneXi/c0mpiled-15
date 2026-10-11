import { createHash } from "node:crypto";
import type {
  AgentProvider,
  CommandEnvelope,
  Interpretation,
  RelayView,
} from "../contracts";
import { applyCommand, completeCall, monitor, startNextCall } from "../engine";
import { createRelayState, createSampleSchedule } from "../seed";
import {
  createAgentProvider,
  AgentProviderUnavailable,
} from "../providers/agent";
import { getStore, ServiceError, type RelayStore } from "./store";

export class RelayService {
  constructor(
    private store: RelayStore,
    private ai: AgentProvider,
  ) {}
  async view(tenantId: string): Promise<RelayView> {
    return {
      state: await this.store.read(tenantId),
      now: new Date().toISOString(),
      session: { role: "manager", demo: true },
      providers: {
        ai: this.ai.status(),
        calling: {
          status: "simulated",
          label: "Call simulator",
          detail:
            "No real phone calls are placed. Enter the volunteer's full conversation to test the same workflow.",
        },
        storage: {
          status: "live",
          label: process.env.RELAY_TABLE_NAME
            ? "AWS DynamoDB"
            : "Saved on this server",
          detail:
            "Workspace, call history and pause state survive browser refresh and server restart.",
        },
        payments: {
          status: "blocked",
          label: "Payments not connected",
          detail:
            "Organizer-approved AWS App Monetization test access is still required. No charges are made.",
        },
      },
    };
  }
  async command(
    tenantId: string,
    envelope: CommandEnvelope,
  ): Promise<RelayView> {
    if ((await this.store.read(tenantId)).phoneTest)
      throw new ServiceError(
        "This phone test is read-only. Calling is controlled separately.",
        403,
        "FORBIDDEN",
      );
    const { command, expectedRevision, requestId } = envelope;
    const receipt = {
      id: requestId,
      fingerprint: createHash("sha256")
        .update(JSON.stringify(command))
        .digest("hex"),
    };
    if (command.type !== "SUBMIT_CALL") {
      await this.store.mutate(tenantId, expectedRevision, receipt, (state) =>
        command.type === "RESET_DEMO"
          ? {
              ...(command.sample === "four-person"
                ? createSampleSchedule
                : createRelayState)(tenantId, new Date().toISOString()),
              revision: state.revision,
            }
          : applyCommand(state, command, new Date().toISOString()),
      );
      await this.tick(tenantId);
      return this.view(tenantId);
    }
    let claimed = false;
    const claimedState = await this.store.mutate(
      tenantId,
      expectedRevision,
      receipt,
      (state) => {
        const call = state.calls.find((c) => c.id === command.callId);
        if (!call || !["in_progress", "failed"].includes(call.status))
          throw new ServiceError(
            "This call is no longer waiting for a response.",
            409,
            "CALL_CHANGED",
          );
        if (call.transport !== "simulated")
          throw new ServiceError(
            "Only the call simulator accepts manual transcripts.",
          );
        if (
          state.calls.some(
            (c) =>
              c.id !== call.id &&
              ["in_progress", "analyzing"].includes(c.status),
          )
        )
          throw new ServiceError(
            "Another conversation is being analyzed. Please wait.",
            409,
            "BUSY",
          );
        claimed = true;
        return {
          ...state,
          calls: state.calls.map((c) =>
            c.id === call.id
              ? {
                  ...c,
                  status: "analyzing",
                  analysisStartedAt: new Date().toISOString(),
                  analysisId: requestId,
                  transcript: command.transcript,
                  error: undefined,
                }
              : c,
          ),
        };
      },
    );
    if (!claimed) return this.view(tenantId);
    const call = claimedState.calls.find((c) => c.id === command.callId)!;
    const shift = claimedState.shifts.find((s) => s.id === call.shiftId)!,
      volunteer = claimedState.volunteers.find(
        (v) => v.id === call.volunteerId,
      )!;
    try {
      let result: {
        interpretation: Interpretation;
        provider: "amazon-bedrock" | "manual-simulator";
      };
      if (command.simulatedOutcome) {
        if (
          process.env.RELAY_AI_ENABLED === "true" &&
          command.simulatedOutcome !== "no_answer"
        )
          throw new ServiceError(
            "Live AI is enabled. Submit the conversation without a manual outcome.",
          );
        result = {
          provider: "manual-simulator",
          interpretation: {
            outcome: command.simulatedOutcome,
            summary: `Manually selected simulator outcome: ${command.simulatedOutcome.replaceAll("_", " ")}.`,
            confidence: command.simulatedOutcome === "uncertain" ? 0 : 1,
            clarification: [
              "uncertain",
              "partial",
              "question",
              "late",
            ].includes(command.simulatedOutcome)
              ? "Ask the volunteer to confirm availability for the whole shift."
              : "",
            availableFrom: null,
            availableUntil: null,
          },
        };
      } else {
        if (process.env.RELAY_AI_ENABLED !== "true")
          throw new ServiceError(
            "AWS AI is disabled. Choose an explicit simulator outcome.",
            503,
            "AI_UNAVAILABLE",
          );
        await this.store.reserveAnalysis(tenantId);
        result = await this.ai.interpret(
          { transcript: command.transcript, call, shift, volunteer },
          AbortSignal.timeout(18000),
        );
      }
      await this.store.mutate(tenantId, undefined, undefined, (state) => {
        const current = state.calls.find((c) => c.id === call.id);
        if (current?.status !== "analyzing" || current.analysisId !== requestId)
          return state;
        return completeCall(
          state,
          call.id,
          result.interpretation,
          result.provider,
          command.transcript,
          new Date().toISOString(),
        );
      });
    } catch (error) {
      await this.store.mutate(tenantId, undefined, undefined, (state) => ({
        ...state,
        calls: state.calls.map((c) =>
          c.id === call.id &&
          c.status === "analyzing" &&
          c.analysisId === requestId
            ? {
                ...c,
                status: "failed",
                error:
                  error instanceof ServiceError
                    ? error.message
                    : "Conversation analysis is unavailable. No assignment was changed. Retry when the service is available.",
              }
            : c,
        ),
      }));
      throw error instanceof ServiceError
        ? error
        : new ServiceError(
            error instanceof AgentProviderUnavailable
              ? error.message
              : "Conversation analysis is unavailable. The call is saved and no assignment was changed.",
            503,
            "AI_UNAVAILABLE",
          );
    }
    await this.tick(tenantId);
    return this.view(tenantId);
  }
  async tick(tenantId: string) {
    await this.store.mutate(tenantId, undefined, undefined, (state) => {
      if (state.phoneTest) return state;
      const now = new Date().toISOString();
      let next = state;
      const stalled = state.calls.some(
        (c) =>
          c.status === "analyzing" &&
          Date.now() - Date.parse(c.analysisStartedAt ?? c.createdAt) > 120000,
      );
      if (stalled)
        next = {
          ...state,
          calls: state.calls.map((c) =>
            c.status === "analyzing" &&
            Date.now() - Date.parse(c.analysisStartedAt ?? c.createdAt) > 120000
              ? {
                  ...c,
                  status: "failed",
                  error:
                    "Analysis was interrupted. The saved conversation can be retried.",
                }
              : c,
          ),
        };
      return startNextCall(monitor(next, now), now);
    });
  }
  async tickAll() {
    for (const id of await this.store.tenants()) {
      try {
        await this.tick(id);
      } catch {
        /* A conflicting manager command wins; the next scheduled pass revalidates. */
      }
    }
  }
}
let singleton: RelayService | undefined;
export function getService() {
  return (singleton ??= new RelayService(getStore(), createAgentProvider()));
}
