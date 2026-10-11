import { handleRelayRequest } from "@/relay/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handleRelayRequest;
export const POST = handleRelayRequest;
