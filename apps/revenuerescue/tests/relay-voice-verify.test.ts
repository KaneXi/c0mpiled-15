import { describe, expect, it, vi } from "vitest";
import type { ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import type { Interpretation } from "../src/relay/contracts";
import type { BedrockTransport } from "../src/relay/providers/agent";
import { verifyVoiceDecision } from "../src/relay/voice/verify";

const question =
  "Can you cover the entire welcome shift on October 11, from 8:00 PM to 9:00 PM EDT?";
const decision: Interpretation = {
  outcome: "confirmed",
  confidence: 0.95,
  summary: "The volunteer confirmed availability for the whole shift.",
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
const signal = () => new AbortController().signal;

describe("independent voice decision verification", () => {
  it("accepts a supported full-shift confirmation and clears stale clarification", async () => {
    const original = {
      ...decision,
      clarification: "Can you confirm whether you can cover the whole shift?",
    };
    const before = structuredClone(original);
    const transcript = `Relay: ${question}\nVolunteer: Yes, I can cover that entire time.`;
    const transport = vi
      .fn<BedrockTransport>()
      .mockResolvedValue(response({ supported: true }));

    const verified = await verifyVoiceDecision(
      original,
      transcript,
      question,
      signal(),
      transport,
    );

    expect(verified).toEqual({ ...original, clarification: "" });
    expect(original).toEqual(before);
    expect(transport).toHaveBeenCalledTimes(1);
    const prompt = transport.mock.calls[0][0]
      .messages![0].content!.map((block) => block.text || "")
      .join("");
    expect(prompt).toContain(question);
    expect(prompt).toContain("Yes, I can cover that entire time.");
  });

  it("withholds a high-confidence decline rejected because the ASR answer is contradictory", async () => {
    const transport = vi
      .fn<BedrockTransport>()
      .mockResolvedValue(response({ supported: false }));
    const verified = await verifyVoiceDecision(
      {
        ...decision,
        outcome: "declined",
        confidence: 0.99,
        summary: "The transcript was interpreted as a refusal.",
      },
      `Relay: ${question}\nVolunteer: yes i can't`,
      question,
      signal(),
      transport,
    );

    expect(verified.outcome).toBe("uncertain");
    expect(verified.clarification.trim().length).toBeGreaterThan(0);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("checks the whole conversation including the latest clarification answer", async () => {
    const transcript = `Relay: ${question}\nVolunteer: yes i can't\nRelay: ${question}\nVolunteer: Yes, I can cover the entire shift.`;
    const transport = vi
      .fn<BedrockTransport>()
      .mockResolvedValue(response({ supported: true }));

    expect(
      (
        await verifyVoiceDecision(
          decision,
          transcript,
          question,
          signal(),
          transport,
        )
      ).outcome,
    ).toBe("confirmed");
    const prompt = transport.mock.calls[0][0]
      .messages![0].content!.map((block) => block.text || "")
      .join("");
    expect(prompt).toContain("yes i can't");
    expect(prompt).toContain("Yes, I can cover the entire shift.");
  });

  it("fails closed when the verification call times out", async () => {
    const transport = vi
      .fn<BedrockTransport>()
      .mockRejectedValue(new DOMException("Request timed out", "TimeoutError"));
    const verified = await verifyVoiceDecision(
      decision,
      `Relay: ${question}\nVolunteer: Yes, I can.`,
      question,
      signal(),
      transport,
    );

    expect(verified.outcome).toBe("uncertain");
    expect(verified.clarification.trim().length).toBeGreaterThan(0);
  });

  it.each([
    "invalid JSON",
    "missing supported",
    "string supported",
    "truncated",
  ])("fails closed for a %s verification response", async (variant) => {
    const reply = response(
      variant === "missing supported" ? {} : { supported: "true" },
    );
    if (variant === "invalid JSON")
      reply.output!.message!.content = [{ text: "not JSON" }];
    if (variant === "truncated") {
      reply.output!.message!.content = [{ text: '{"supported":true}' }];
      reply.stopReason = "max_tokens";
    }
    const transport = vi.fn<BedrockTransport>().mockResolvedValue(reply);
    const verified = await verifyVoiceDecision(
      decision,
      `Relay: ${question}\nVolunteer: Yes, I can.`,
      question,
      signal(),
      transport,
    );

    expect(verified.outcome).toBe("uncertain");
    expect(verified.clarification.trim().length).toBeGreaterThan(0);
  });

  it.each([
    { ...decision, outcome: "uncertain" as const, clarification: question },
    { ...decision, confidence: 0.79 },
  ])(
    "does not spend another model call on an already withheld decision",
    async (answer) => {
      const transport = vi.fn<BedrockTransport>();
      expect(
        await verifyVoiceDecision(
          answer,
          `Relay: ${question}\nVolunteer: Maybe.`,
          question,
          signal(),
          transport,
        ),
      ).toEqual(answer);
      expect(transport).not.toHaveBeenCalled();
    },
  );
});
