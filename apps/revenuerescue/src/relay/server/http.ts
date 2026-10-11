import { controlPhoneTest } from "../voice/control";
import { commandEnvelopeSchema } from "../contracts";
import { getStore, ServiceError } from "./store";
import { getService } from "./service";
const origins = () =>
  (
    process.env.RELAY_ALLOWED_ORIGINS ??
    "http://localhost:3008,http://127.0.0.1:3008"
  ).split(",");
const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
async function body(request: Request) {
  const text = await request.text();
  if (Buffer.byteLength(text) > 32768)
    throw new ServiceError("Keep requests under 32 KiB.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new ServiceError("Send a valid JSON request.");
  }
}
export async function handleRelayRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const secure = url.protocol === "https:";
    const cookieName = secure ? "__Host-relay_guest" : "relay_guest";
    if (request.method === "POST") {
      if (!origins().includes(request.headers.get("origin") ?? ""))
        throw new ServiceError(
          "Open Relay from its configured website.",
          403,
          "FORBIDDEN",
        );
      if (
        !/^application\/json(?:;|$)/i.test(
          request.headers.get("content-type") ?? "",
        )
      )
        throw new ServiceError("Send this request as JSON.", 415);
    }
    const token = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    const session =
      token && /^[a-f0-9]{64}$/.test(token)
        ? await getStore().session(token)
        : undefined;
    if (url.pathname === "/api/relay/session" && request.method === "POST") {
      const input = await body(request);
      if (
        !input ||
        Array.isArray(input) ||
        typeof input !== "object" ||
        Object.keys(input).length
      )
        throw new ServiceError("The guest session request must be empty.");
      if (session) return json({ expiresAt: session.expiresAt });
      const fresh = await getStore().createSession();
      return json({ expiresAt: fresh.session.expiresAt }, 200, {
        "Set-Cookie": `${cookieName}=${fresh.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200${secure ? "; Secure" : ""}`,
      });
    }
    if (
      url.pathname === "/api/relay/state" &&
      request.method === "GET" &&
      url.searchParams.get("phone-test") === "1"
    ) {
      const tenant = process.env.RELAY_PUBLIC_TEST_TENANT;
      if (!tenant)
        throw new ServiceError(
          "The public phone test is not available yet.",
          404,
        );
      const view = await getService().view(tenant);
      if (!view.state.phoneTest)
        throw new ServiceError("The public phone test is not available.", 404);
      return json({
        ...view,
        state: {
          ...view.state,
          tenantId: "public-phone-test",
          phoneTest: {
            ...view.state.phoneTest,
            processedTurns: undefined,
            allocationNumber: undefined,
            allocationToken: undefined,
            phoneNumberId: undefined,
            history: view.state.phoneTest.history?.map((run) => ({
              ...run,
              calls: run.calls.map((call) => ({
                ...call,
                transcript: "",
                contactId: undefined,
              })),
            })),
          },
          calls: view.state.calls.map((call) => ({
            ...call,
            transcript: "",
            contactId: undefined,
          })),
          volunteers: view.state.volunteers.map((person) => ({
            ...person,
            phone: "••••" + person.phone.slice(-4),
          })),
        },
      });
    }
    if (url.pathname === "/api/relay/command" && request.method === "POST") {
      const input = await request
        .clone()
        .json()
        .catch(() => null);
      if (input && typeof input === "object" && "phoneTestAction" in input)
        return json(await controlPhoneTest(await body(request)));
    }
    if (!session)
      throw new ServiceError(
        "Your guest session has ended. Reload to start another demo.",
        401,
        "SESSION_EXPIRED",
      );
    if (session.role !== "manager")
      throw new ServiceError("Manager access is required.", 403, "FORBIDDEN");
    if (url.pathname === "/api/relay/state" && request.method === "GET")
      return json(await getService().view(session.tenantId));
    if (url.pathname === "/api/relay/command" && request.method === "POST") {
      const parsed = commandEnvelopeSchema.safeParse(await body(request));
      if (!parsed.success)
        throw new ServiceError(
          parsed.error.issues[0]?.message ?? "Check the form and try again.",
        );
      return json(await getService().command(session.tenantId, parsed.data));
    }
    return json({ error: "This endpoint does not exist." }, 404);
  } catch (error) {
    if (error instanceof ServiceError)
      return json({ error: error.message, code: error.code }, error.status);
    if (
      error instanceof Error &&
      !/credentials|token|AccessDenied|Dynamo|signature/i.test(error.message)
    )
      return json({ error: error.message }, 400);
    return json(
      {
        error:
          "Relay is temporarily unavailable. Your saved records have not been reset.",
      },
      503,
    );
  }
}
