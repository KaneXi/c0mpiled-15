import { timingSafeEqual } from "node:crypto";
import { handleRelayRequest } from "./http";
import { getService } from "./service";
interface Event {
  source?: string;
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string>;
  cookies?: string[];
  body?: string;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string } };
}
export async function handler(event: Event) {
  if (event.source === "relay.worker") {
    await getService().tickAll();
    return { statusCode: 200, body: '{"ok":true}' };
  }
  const headers = Object.fromEntries(
    Object.entries(event.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const expected = Buffer.from(process.env.ORIGIN_SECRET ?? ""),
    actual = Buffer.from(headers["x-origin-verify"] ?? "");
  if (
    expected.length < 32 ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return {
      statusCode: 403,
      body: '{"error":"Open Relay from its configured website."}',
    };
  const origin = (process.env.RELAY_ALLOWED_ORIGINS ?? "").split(",")[0];
  if (!origin)
    return { statusCode: 503, body: '{"error":"Relay is not configured."}' };
  if ((event.body?.length ?? 0) > 45000)
    return { statusCode: 413, body: '{"error":"Request too large."}' };
  const body = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64")
    : Buffer.from(event.body ?? "");
  if (body.byteLength > 32768)
    return { statusCode: 413, body: '{"error":"Request too large."}' };
  if (event.cookies?.length) headers.cookie = event.cookies.join("; ");
  const method = event.requestContext?.http?.method ?? "GET";
  const response = await handleRelayRequest(
    new Request(
      `${origin}${event.rawPath ?? "/"}${event.rawQueryString ? "?" + event.rawQueryString : ""}`,
      {
        method,
        headers,
        ...(method !== "GET" && method !== "HEAD" ? { body } : {}),
      },
    ),
  );
  const outgoing = Object.fromEntries(response.headers.entries());
  const cookie = outgoing["set-cookie"];
  delete outgoing["set-cookie"];
  return {
    statusCode: response.status,
    headers: outgoing,
    body: await response.text(),
    ...(cookie ? { cookies: [cookie] } : {}),
  };
}
