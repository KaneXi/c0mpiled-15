import { getService } from "./service";
const runtime = globalThis as typeof globalThis & {
  relayWorker?: ReturnType<typeof setInterval>;
  relayWorkerBusy?: boolean;
};
export function startWorker() {
  if (
    process.env.RELAY_WORKER_ENABLED !== "true" ||
    runtime.relayWorker ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NEXT_PHASE === "phase-production-build"
  )
    return;
  const run = async () => {
    if (runtime.relayWorkerBusy) return;
    runtime.relayWorkerBusy = true;
    try {
      await getService().tickAll();
    } catch {
      /* Provider status is reported through the API; retry monitoring on the next pass. */
    } finally {
      runtime.relayWorkerBusy = false;
    }
  };
  runtime.relayWorker = setInterval(() => void run(), 5000);
  runtime.relayWorker.unref();
  void run();
}
