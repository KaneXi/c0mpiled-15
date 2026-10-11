import type {
  CommandEnvelope,
  RelayCommand,
  RelayView,
} from "@/relay/contracts";

export class RelayApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "RelayApiError";
  }
}

async function request(
  path: string,
  init: RequestInit = {},
): Promise<RelayView> {
  const response = await fetch(`/api/relay/${path}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(35_000),
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new RelayApiError(
      data?.error || "Relay could not complete this request. Please try again.",
      response.status,
    );
  }
  return data as RelayView;
}

export const relayApi = {
  read: (signal?: AbortSignal) => request("state", { signal }),
  session: (signal?: AbortSignal) =>
    request("session", { method: "POST", body: "{}", signal }),
  command: (command: RelayCommand, expectedRevision: number) => {
    const envelope: CommandEnvelope = {
      requestId: crypto.randomUUID(),
      expectedRevision,
      command,
    };
    return request("command", {
      method: "POST",
      body: JSON.stringify(envelope),
    });
  },
};
