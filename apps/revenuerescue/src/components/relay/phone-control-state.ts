export function inquiryStartBlocker(input: {
  busy: boolean;
  paused: boolean;
  hasCode: boolean;
  waitingForSave: boolean;
  hasRun: boolean;
  planChanged: boolean;
  alreadyStarted: boolean;
  remainingRuns: number;
  authorized: boolean;
}): string {
  if (input.busy) return "Please wait for the current request to finish.";
  if (!input.paused)
    return "An inquiry is already scheduled or running. Cancel / stop calling before starting another.";
  if (!input.hasCode) return "Enter your manager access code above.";
  if (input.waitingForSave)
    return "Task saved. Waiting for the saved plan to appear (usually a few seconds).";
  if (input.remainingRuns <= 0)
    return "The calling allowance is used up. Ask the owner to renew it.";
  if (!input.hasRun || input.planChanged || input.alreadyStarted)
    return "Choose your next shift hours, then select Save task above. Each inquiry needs a newly saved task.";
  if (!input.authorized)
    return "Tick the authorization box above, then call now or schedule your inquiry.";
  return "";
}
