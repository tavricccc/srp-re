import { requireEnv } from "./env.ts";
import { textResponse } from "./http.ts";

function timingSafeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export function requireOriginSecret(request: Request) {
  const supplied = request.headers.get("x-novae-origin-secret") ?? "";
  const expected = requireEnv("EDGE_ORIGIN_SECRET");
  return timingSafeEqual(supplied, expected)
    ? null
    : textResponse("Unauthorized origin", { status: 401 });
}

export function edgeFunctionName(role: "api" | "sync" | "media" | "outbox" | "delete" | "maintenance") {
  return `n${requireEnv("EDGE_FUNCTION_NAMESPACE")}-${role}`;
}

export function edgeFunctionUrl(role: Parameters<typeof edgeFunctionName>[0]) {
  return `${requireEnv("SUPABASE_URL").replace(/\/+$/u, "")}/functions/v1/${edgeFunctionName(role)}`;
}
