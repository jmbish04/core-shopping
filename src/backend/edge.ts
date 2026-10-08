/**
 * @fileoverview The front door (maestro cs-be-2-10). Every request passes
 * through here before the API or the Astro pages.
 *
 * One credential, WORKER_API_KEY, presented three ways (see `@/backend/auth`):
 * a Bearer key for agents and scripts, an OAuth access token for MCP clients,
 * or the 400-day session cookie set by the passcode page.
 *
 * - Auth surfaces (/login, /auth/*, /oauth/*, /.well-known/*) and static
 *   assets (icons, /_astro/*) are public: an MCP client fetches icons without
 *   credentials, and the passcode page must load before anyone has a cookie.
 * - GET /api/ping and GET /api/health are public so uptime probes work.
 * - Any other API path without a credential gets a 401 with the
 *   WWW-Authenticate header that starts an MCP client's OAuth flow.
 * - Any other page without a session redirects to /login?next=<path>.
 *
 * @example
 * export default { fetch: (req, env, ctx) => edge.fetch(req, env, ctx) };
 */

import { Hono, type MiddlewareHandler } from "hono";

import { type AppEnv, hasValidSession, requireAuth } from "@/backend/auth";
import { oauth } from "@/backend/api/routes/oauth";
import { accessFor, isApiPath } from "@/backend/edge-access";

export { accessFor, isApiPath };

const gate: MiddlewareHandler<AppEnv> = async (c, next) => {
  const url = new URL(c.req.url);
  const access = accessFor(c.req.method, url.pathname);
  if (access === "public") return next();
  if (access === "api") return requireAuth(c, next);
  if (await hasValidSession(c.env, c.req.raw)) return next();
  return c.redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`, 302);
};

/**
 * Build the edge app around the two downstream handlers.
 *
 * @param api - The Hono API (REST, OpenAPI docs, MCP).
 * @param pages - The Astro SSR handler.
 */
export function buildEdge(
  api: (req: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response>,
  pages: (req: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response>,
) {
  const edge = new Hono<AppEnv>();
  edge.use("*", gate);
  edge.route("/", oauth);
  edge.all("*", (c) => {
    const ctx = c.executionCtx as ExecutionContext;
    return isApiPath(new URL(c.req.url).pathname) ? api(c.req.raw, c.env, ctx) : pages(c.req.raw, c.env, ctx);
  });
  return edge;
}
