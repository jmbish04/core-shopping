/**
 * @fileoverview Pure access rules for the edge gate (no value imports, so the
 * plain-Node self-check scripts/selfcheck-edge.mjs can load it).
 */

const PUBLIC_PREFIXES = ["/oauth/", "/.well-known/", "/_astro/"] as const;
const PUBLIC_EXACT = new Set([
  "/login",
  "/auth/login",
  "/auth/logout",
  "/favicon.ico",
  "/favicon.svg",
  "/favicon.png",
  "/icon-128.png",
  "/apple-touch-icon.png",
  "/logo.svg",
  "/og.png",
  "/robots.txt",
]);
const PUBLIC_API_GET = new Set(["/api/ping", "/api/health"]);

/** True for paths the Hono API owns (REST + OpenAPI doc surfaces). */
export function isApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname === "/mcp" ||
    pathname === "/openapi.json" ||
    pathname === "/swagger" ||
    pathname === "/scalar" ||
    pathname === "/scaler"
  );
}

/** Classify a request: what, if anything, it must prove. */
export function accessFor(method: string, pathname: string): "public" | "api" | "page" {
  if (PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return "public";
  if (method === "GET" && PUBLIC_API_GET.has(pathname)) return "public";
  return isApiPath(pathname) ? "api" : "page";
}

/**
 * The post-login redirect target, or "/" if it is not a same-origin path.
 * Rejects "//host" and "/\\host" (protocol-relative: an open redirect).
 *
 * @param raw - The `next` form or query value.
 * @returns A safe path starting with a single "/".
 */
export function safeNextPath(raw: unknown): string {
  return typeof raw === "string" && /^\/(?![\/\\])/.test(raw) ? raw : "/";
}
