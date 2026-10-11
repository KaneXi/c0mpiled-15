import { describe, expect, it, vi } from "vitest";
import type { ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import {
  createAgentProvider,
  type BedrockTransport,
} from "../src/relay/providers/agent";
import type { AgentProvider, Interpretation } from "../src/relay/contracts";

const result: Interpretation = {
  outcome: "confirmed",
  confidence: 0.95,
  summary:
    "The volunteer confirmed the full shift after correcting an earlier concern.",
  clarification: "",
  availableFrom: null,
  availableUntil: null,
};
const response = (value: unknown): ConverseCommandOutput => ({
  $metadata: {},
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  metrics: { latencyMs: 1 },
  stopReason: "end_turn",
  output: {
    message: { role: "assistant", content: [{ text: JSON.stringify(value) }] },
  },
});
const input = (): Parameters<AgentProvider["interpret"]>[0] => ({
  transcript:
    "Coordinator: Can you cover the packing shift? Volunteer: I cannot... wait, my other appointment has moved. Yes, I can cover the entire shift.",
  call: {
    id: "call-1",
    shiftId: "shift-1",
    volunteerId: "volunteer-1",
    purpose: "check_in",
    status: "analyzing",
    dueAt: "2026-10-12T12:00:00-04:00",
    createdAt: "2026-10-12T11:00:00-04:00",
    attempt: 1,
    transport: "simulated",
    transcript: "",
  },
  shift: {
    id: "shift-1",
    title: "Pack meal kits",
    role: "packing",
    start: "2026-10-12T13:00:00-04:00",
    end: "2026-10-12T15:00:00-04:00",
    required: 2,
    status: "published",
    version: 1,
  },
  volunteer: {
    id: "volunteer-1",
    name: "Sample Volunteer",
    phone: "+12025550101",
    roles: ["packing"],
    preferredRoles: [],
    availability: [],
    callingConsent: true,
    recordingConsent: false,
    optedOut: false,
    active: true,
    timezone: "America/New_York",
    quietHours: { start: 20, end: 8 },
  },
});
const signal = () => new AbortController().signal;

describe("Relay Bedrock semantic provider", () => {
  it("sends the complete conversation in one bounded model call, without contact details", async () => {
    const transport = vi
      .fn<BedrockTransport>()
      .mockResolvedValue(response(result));
    const provider = createAgentProvider({ enabled: true, transport });
    expect(provider.status().status).toBe("blocked");
    const request = input();
    const original = JSON.stringify(request);
    expect(await provider.interpret(request, signal())).toEqual({
      interpretation: result,
      provider: "amazon-bedrock",
    });
    expect(provider.status().status).toBe("live");
    expect(transport).toHaveBeenCalledTimes(1);
    const command = transport.mock.calls[0][0];
    expect(command.modelId).toBe("amazon.nova-lite-v1:0");
    expect(command.inferenceConfig?.maxTokens).toBe(800);
    const prompt = command.messages![0].content![0].text!;
    expect(JSON.parse(prompt).conversation).toBe(request.transcript);
    expect(prompt).not.toContain(request.volunteer.phone);
    expect(prompt).not.toContain(request.volunteer.name);
    expect(JSON.stringify(request)).toBe(original);
  });
  it.each([0, 0.3, 0.79])(
    "requires clarification for a commitment at confidence %s",
    async (confidence) => {
      const provider = createAgentProvider({
        enabled: true,
        transport: vi
          .fn<BedrockTransport>()
          .mockResolvedValue(response({ ...result, confidence })),
      });
      const actual = await provider.interpret(input(), signal());
      expect(actual.interpretation.outcome).toBe("uncertain");
      expect(actual.interpretation.clarification.length).toBeGreaterThan(0);
    },
  );
  it.each(["late", "partial", "no_answer"])(
    "requires clarification for unsupported %s evidence",
    async (outcome) => {
      const provider = createAgentProvider({
        enabled: true,
        transport: vi
          .fn<BedrockTransport>()
          .mockResolvedValue(response({ ...result, outcome })),
      });
      expect(
        (await provider.interpret(input(), signal())).interpretation.outcome,
      ).toBe("uncertain");
    },
  );
  it("preserves valid partial-availability bounds and opt-outs", async () => {
    for (const answer of [
      {
        ...result,
        outcome: "partial",
        availableFrom: "2026-10-12T14:00:00-04:00",
        availableUntil: "2026-10-12T15:00:00-04:00",
      },
      {
        ...result,
        outcome: "opt_out",
        summary: "The volunteer asked not to receive further calls.",
      },
    ]) {
      const provider = createAgentProvider({
        enabled: true,
        transport: vi
          .fn<BedrockTransport>()
          .mockResolvedValue(response(answer)),
      });
      expect(
        (await provider.interpret(input(), signal())).interpretation,
      ).toEqual(answer);
    }
  });
  it.each([
    "extra fields",
    "invalid outcome",
    "invalid window",
    "truncated",
    "malformed",
    "AWS failure",
  ])(
    "rejects %s without falling back to simulated success",
    async (variant) => {
      const transport = vi.fn<BedrockTransport>();
      if (variant === "AWS failure")
        transport.mockRejectedValue(
          new Error("Private provider failure details"),
        );
      else if (variant === "extra fields")
        transport.mockResolvedValue(response({ ...result, assign: true }));
      else if (variant === "invalid outcome")
        transport.mockResolvedValue(
          response({ ...result, outcome: "maybe_booked" }),
        );
      else if (variant === "invalid window")
        transport.mockResolvedValue(
          response({
            ...result,
            availableFrom: "2026-10-12T15:00:00Z",
            availableUntil: "2026-10-12T14:00:00Z",
          }),
        );
      else if (variant === "truncated")
        transport.mockResolvedValue({
          ...response(result),
          stopReason: "max_tokens",
        });
      else
        transport.mockResolvedValue({
          ...response(result),
          output: {
            message: {
              role: "assistant",
              content: [{ text: "```json\ninvalid\n```" }],
            },
          },
        });
      const provider = createAgentProvider({ enabled: true, transport });
      await expect(provider.interpret(input(), signal())).rejects.toMatchObject(
        { code: "AI_UNAVAILABLE" },
      );
      expect(provider.status().status).toBe("unavailable");
      expect(provider.status().detail).not.toContain(
        "Private provider failure details",
      );
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );
  it("makes no call when disabled, cancelled, oversized, or identity-mismatched", async () => {
    for (const variant of ["disabled", "cancelled", "oversized", "mismatch"]) {
      const transport = vi.fn<BedrockTransport>();
      const provider = createAgentProvider({
        enabled: variant !== "disabled",
        transport,
      });
      const request = input();
      const controller = new AbortController();
      if (variant === "cancelled") controller.abort();
      if (variant === "oversized") request.transcript = "x".repeat(8001);
      if (variant === "mismatch") request.call.volunteerId = "different-person";
      await expect(
        provider.interpret(request, controller.signal),
      ).rejects.toThrow();
      expect(transport).not.toHaveBeenCalled();
    }
  });
});
