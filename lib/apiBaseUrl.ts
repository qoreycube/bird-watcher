import type { NextRequest } from "next/server";

/**
 * Returns the base URL for the backend API (including protocol and port).
 * - If the incoming request is from localhost, returns the local backend URL.
 * - Otherwise, returns the remote backend URL.
 *
 * preferHttps controls the remote scheme only (local is always http).
 */
export function getApiBaseUrl(request: NextRequest, preferHttps = false): string {
  const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(hostHeader);
  if (isLocal) return "http://127.0.0.1:9000";
  const scheme = preferHttps ? "https" : "http";
  return `${scheme}://qorey.webredirect.org:9000`;
}
