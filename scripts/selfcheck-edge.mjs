/**
 * Self-check for src/backend/edge-access.ts (maestro cs-be-2-10): which paths
 * are public, which need an API credential, which need a session, and that the
 * login redirect cannot be pointed off-site.
 */
import assert from "node:assert/strict";

import { accessFor, safeNextPath } from "../src/backend/edge-access.ts";

assert.equal(accessFor("GET", "/login"), "public");
assert.equal(accessFor("POST", "/auth/login"), "public");
assert.equal(accessFor("GET", "/.well-known/oauth-protected-resource"), "public");
assert.equal(accessFor("GET", "/icon-128.png"), "public");
assert.equal(accessFor("GET", "/_astro/app.js"), "public");
assert.equal(accessFor("GET", "/api/health"), "public");
assert.equal(accessFor("GET", "/api/ping"), "public");
// what must NOT be public
assert.equal(accessFor("POST", "/api/health/run"), "api");
assert.equal(accessFor("POST", "/api/health"), "api");
assert.equal(accessFor("GET", "/api/goals"), "api");
assert.equal(accessFor("POST", "/mcp"), "api");
assert.equal(accessFor("GET", "/openapi.json"), "api");
assert.equal(accessFor("GET", "/"), "page");
assert.equal(accessFor("GET", "/goals"), "page");
assert.equal(accessFor("GET", "/notifications/abc"), "page");
assert.equal(accessFor("GET", "/loginx"), "page");
// redirect target
assert.equal(safeNextPath("/notifications/abc?x=1"), "/notifications/abc?x=1");
assert.equal(safeNextPath("//evil.example/x"), "/");
assert.equal(safeNextPath("/\\evil.example"), "/");
assert.equal(safeNextPath("https://evil.example"), "/");
assert.equal(safeNextPath(undefined), "/");

console.log("selfcheck-edge: ok");
