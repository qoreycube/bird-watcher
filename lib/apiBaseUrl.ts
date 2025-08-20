import type { NextRequest } from "next/server";

/**
 * Returns the base URL for the backend API (including protocol and port).
 * - If the incoming request is from localhost, returns the local backend URL.
 * - Otherwise, returns the remote backend URL.
 *
 * preferHttps controls the remote scheme only (local is always http).
 */
export function getApiBaseUrl(request: NextRequest): string {
  const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(hostHeader);
  const envLocal = process.env.LOCAL_API_BASE || "http://127.0.0.1:9000";
  const envRemote = process.env.REMOTE_API_BASE || "http://some.server.com:9000";

  const sanitize = (u: string) => u.replace(/\/$/, "");
  if (isLocal) return sanitize(envLocal);
  return sanitize(envRemote);
}
