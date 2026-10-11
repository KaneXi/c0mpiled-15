import { afterEach, expect, it, vi } from "vitest";
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: class {
    send = send;
  },
  InvokeCommand: class {
    constructor(public input: unknown) {}
  },
}));
import { wakeVoiceWorker } from "../src/relay/voice/dispatch";
afterEach(() => {
  vi.unstubAllEnvs();
  send.mockReset();
});
it("queues only the configured worker without passing recipient data", async () => {
  vi.stubEnv("VOICE_FUNCTION_NAME", "test-worker");
  send.mockResolvedValue({ StatusCode: 202 });
  expect(await wakeVoiceWorker()).toBe("queued");
  expect(send.mock.calls[0][0].input).toEqual({
    FunctionName: "test-worker",
    InvocationType: "Event",
    Payload: Buffer.from('{"source":"relay.voice.tick"}'),
  });
});
it("keeps the saved run available to the minute worker when dispatch times out", async () => {
  send.mockRejectedValue(new Error("timeout"));
  expect(await wakeVoiceWorker()).toBe("scheduled_retry");
});
