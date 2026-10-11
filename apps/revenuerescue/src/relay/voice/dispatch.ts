import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

export async function wakeVoiceWorker(): Promise<"queued" | "scheduled_retry"> {
  try {
    const client = new LambdaClient({
      region: process.env.VOICE_FUNCTION_REGION || "us-east-1",
      maxAttempts: 1,
    });
    const result = await client.send(
      new InvokeCommand({
        FunctionName: process.env.VOICE_FUNCTION_NAME!,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify({ source: "relay.voice.tick" })),
      }),
      { abortSignal: AbortSignal.timeout(5000) },
    );
    return result.StatusCode === 202 ? "queued" : "scheduled_retry";
  } catch {
    // The minute worker observes the same persisted run, including cancellation.
    return "scheduled_retry";
  }
}
