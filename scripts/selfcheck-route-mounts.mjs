/**
 * Self-check: every route this project adds is actually MOUNTED and answers.
 *
 * **Why this exists, measured 2026-10-26.** A peer session reviewing PRs #19
 * to #24 deleted `app.route("/api/config", shopperConfigRouter)` from
 * `api/index.ts` entirely. `pnpm run typecheck` passed. All 29 self-check
 * suites passed. `pnpm run verify:config-api` — 38 checks against real
 * Postgres — passed. **Everything was green while every `/api/config/*` route
 * 404'd in production.**
 *
 * The reason is structural: every `verify:*` script in this repo drives the
 * QUERY LAYER directly (`listConfig`, `applyBulk`, `recordSighting`), because
 * that is where the SQL worth testing lives. None of them goes through Hono,
 * so none of them can tell whether a router is reachable. Nothing else did
 * either.
 *
 * That is the shape `docs/HANDOFF.md` already records from colby-maestro: a
 * migration applied, 44 tables, 448 files checked, 564 tests passing, Workers
 * Builds green and `/health` 200, while `GET /api/backups` returned 500 on
 * every request. Only curling the live route found it.
 *
 * **This check dispatches a real request through the real app.** It builds the
 * Hono application exactly as the Worker does and calls `app.request(path)`,
 * then asserts the answer is not a 404. No database is needed: with no
 * bindings a mounted handler fails somewhere other than routing, and routing
 * is the only thing being asserted.
 *
 * **The gate is NOT in this app, and an earlier draft of this file got that
 * wrong.** Auth lives in `edge.ts`, upstream of Hono, so `app.request()`
 * bypasses it entirely. A draft asserted "every new path is refused without
 * auth" and passed — on 500s from the missing Hyperdrive binding, not on
 * 401s, and `/api/integrations` answered 200 because it catches its own
 * errors. That assertion read as a security check and was measuring nothing.
 * It is replaced below by one against `accessFor`, which is where the rule
 * actually lives and is pure.
 *
 * Two things make it hard to satisfy by accident:
 *
 * - **Handler identity, not path and method.** Each router's own handler
 *   function references are collected and then looked for in the mounted
 *   app's route table. A different router answering the same path cannot
 *   satisfy that. `~/AGENTS-cloudflare-workers.md` has the measured case for
 *   why: core-remodel's admin-auth probe asserted a path and a method, and a
 *   lazy dispatcher registered `app.all("/api/admin/*")` with the same prefix
 *   and method — so the dispatcher satisfied the probe by itself while the
 *   auth middleware was gone.
 * - **A control.** A path that does not exist MUST answer 404. Without it, a
 *   bug that made everything answer 200 would read as a pass, which is this
 *   check being the instrument that cannot fail.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Resolve the repo's TypeScript path aliases from `tsconfig.json` itself,
 * rather than from a hand-written list.
 *
 * The hand-written lists in the `verify:*` scripts cover four prefixes. This
 * file imports the whole API, which reaches `@db/schemas`, `@/db/schema` and
 * `@/services/*` too — and a list that silently misses one fails as a module
 * resolution error, which looks like a broken check rather than a missing
 * alias. Reading the real config cannot drift from it.
 */
const tsconfig = JSON.parse(
  readFileSync(resolvePath(root, "tsconfig.json"), "utf8").replace(/^\s*\/\/.*$/gm, ""),
);
/** Longest prefix first, so `@/backend/db/*` wins over `@/*`. */
const ALIASES = Object.entries(tsconfig.compilerOptions.paths)
  .map(([pattern, targets]) => ({
    prefix: pattern.replace(/\*$/, ""),
    wildcard: pattern.endsWith("*"),
    targets: targets.map((target) => target.replace(/^\.\//, "").replace(/\*$/, "")),
  }))
  .sort((a, b) => b.prefix.length - a.prefix.length);

/** A module path, with `.ts` or `/index.ts` added if that is what exists. */
function withExtension(candidate) {
  if (/\.[cm]?[jt]sx?$/.test(candidate)) return existsSync(candidate) ? candidate : null;
  if (existsSync(`${candidate}.ts`)) return `${candidate}.ts`;
  if (existsSync(`${candidate}.tsx`)) return `${candidate}.tsx`;
  if (existsSync(resolvePath(candidate, "index.ts"))) return resolvePath(candidate, "index.ts");
  return null;
}

registerHooks({
  resolve(specifier, context, next) {
    for (const alias of ALIASES) {
      if (!specifier.startsWith(alias.prefix)) continue;
      if (!alias.wildcard && specifier !== alias.prefix.replace(/\/$/, "")) continue;
      const rest = alias.wildcard ? specifier.slice(alias.prefix.length) : "";
      for (const target of alias.targets) {
        const resolved = withExtension(resolvePath(root, target, rest));
        if (resolved) return next(pathToFileURL(resolved).href, context);
      }
    }
    // Relative, extensionless imports inside src/ — Node's strip-only mode
    // does no extension resolution for them.
    if (
      context.parentURL?.startsWith(pathToFileURL(resolvePath(root, "src")).href) &&
      /^\.\.?\//.test(specifier) &&
      !/\.[cm]?[jt]sx?$/.test(specifier)
    ) {
      const base = dirname(fileURLToPath(context.parentURL));
      const resolved = withExtension(resolvePath(base, specifier));
      if (resolved) return next(pathToFileURL(resolved).href, context);
    }
    return next(specifier, context);
  },
});

const appModule = await import(pathToFileURL(resolvePath(root, "src/backend/api/index.ts")).href);
const app = appModule.default ?? appModule.app;
assert.ok(app && typeof app.request === "function", "api/index.ts did not export a Hono app");

const { shopperConfigRouter } = await import(
  pathToFileURL(resolvePath(root, "src/backend/api/routes/config/index.ts")).href
);
const { integrationsRouter } = await import(
  pathToFileURL(resolvePath(root, "src/backend/api/routes/config/integrations.ts")).href
);
const { configSnapshotsRouter } = await import(
  pathToFileURL(resolvePath(root, "src/backend/api/routes/config/snapshots.ts")).href
);
const { goalOccasionsRouter } = await import(
  pathToFileURL(resolvePath(root, "src/backend/api/routes/config/goal-occasions.ts")).href
);
const { ideasRouter } = await import(
  pathToFileURL(resolvePath(root, "src/backend/api/routes/shopping/ideas.ts")).href
);
const { CONFIG_RESOURCE_SPECS } = await import(
  pathToFileURL(resolvePath(root, "src/backend/api/routes/config/resources.ts")).href
);
const { accessFor } = await import(
  pathToFileURL(resolvePath(root, "src/backend/edge-access.ts")).href
);

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}
async function checkAsync(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("selfcheck-route-mounts");

/** Every handler function the mounted app knows about. */
const mountedHandlers = new Set(app.routes.map((route) => route.handler));

/**
 * Assert a router is mounted BY HANDLER IDENTITY.
 *
 * A router's own `routes` carry its handler function references. If the mount
 * is deleted those references never reach the parent app, whatever else is
 * registered at the same path.
 */
function assertMountedByIdentity(label, router, mountedAt) {
  const own = router.routes.filter((route) => route.method !== "ALL");
  assert.ok(own.length > 0, `${label} declares no routes, so this assertion proves nothing`);
  const missing = own.filter((route) => !mountedHandlers.has(route.handler));
  assert.deepEqual(
    missing.map((route) => `${route.method} ${route.path}`),
    [],
    `${label} is not mounted: ${missing.length} of ${own.length} of its handlers are absent from the app`,
  );
  // And at the prefix it is supposed to be at, so a wrong mount point fails.
  const paths = app.routes
    .filter((route) => own.some((candidate) => candidate.handler === route.handler))
    .map((route) => route.path);
  assert.ok(
    paths.every((path) => path.startsWith(mountedAt)),
    `${label} is mounted somewhere other than ${mountedAt}: ${[...new Set(paths)].slice(0, 3).join(", ")}`,
  );
}

check("the config router is mounted at /api/config, by handler identity", () => {
  assertMountedByIdentity("shopperConfigRouter", shopperConfigRouter, "/api/config");
});

check("the integrations router is mounted at /api/integrations", () => {
  assertMountedByIdentity("integrationsRouter", integrationsRouter, "/api/integrations");
});

check("the config snapshot router is mounted at /api/config", () => {
  assertMountedByIdentity("configSnapshotsRouter", configSnapshotsRouter, "/api/config");
});

check("the goal-occasions router is mounted at /api/goals", () => {
  assertMountedByIdentity("goalOccasionsRouter", goalOccasionsRouter, "/api/goals");
});

check("the ideas router is mounted at /api/ideas", () => {
  assertMountedByIdentity("ideasRouter", ideasRouter, "/api/ideas");
});

// ---------------------------------------------------------------------------
// A real request through the real app. 401 proves mounted and gated; 404
// proves not mounted. No database is touched, because auth answers first.
// ---------------------------------------------------------------------------

/** Paths this session added, each with a method the router really declares. */
const EXPECTED = [
  ...CONFIG_RESOURCE_SPECS.flatMap((spec) => [
    ["GET", `/api/config/${spec.resource}`],
    ["POST", `/api/config/${spec.resource}`],
    ["PUT", `/api/config/${spec.resource}`],
    ["GET", `/api/config/${spec.resource}/00000000-0000-4000-8000-000000000000`],
    ["PATCH", `/api/config/${spec.resource}/00000000-0000-4000-8000-000000000000`],
    ["DELETE", `/api/config/${spec.resource}/00000000-0000-4000-8000-000000000000`],
  ]),
  ["GET", "/api/config/preferences"],
  ["PUT", "/api/config/preferences"],
  ["POST", "/api/config/bulk"],
  ["POST", "/api/config/snapshot"],
  ["GET", "/api/config/snapshot"],
  ["GET", "/api/config/snapshots/00000000-0000-4000-8000-000000000000"],
  ["GET", "/api/config/snapshots/00000000-0000-4000-8000-000000000000/diff"],
  ["GET", "/api/config/snapshot-for-proposal/00000000-0000-4000-8000-000000000000"],
  ["GET", "/api/integrations"],
  ["GET", "/api/goals/due"],
  ["GET", "/api/goals/some-slug/occasions"],
  ["PUT", "/api/goals/some-slug/occasions"],
  ["GET", "/api/ideas"],
  ["POST", "/api/ideas"],
  ["PATCH", "/api/ideas/00000000-0000-4000-8000-000000000000"],
  ["POST", "/api/ideas/from-proposal/00000000-0000-4000-8000-000000000000"],
  ["POST", "/api/ideas/00000000-0000-4000-8000-000000000000/promote"],
];

/**
 * No bindings. A mounted handler then fails on its missing Hyperdrive
 * binding, which is fine: routing is the only thing being asserted, and a
 * 500 from a handler is as good as a 200 for proving a route exists.
 */
const NO_ENV = {};

/**
 * Dispatch with the app's own logging silenced.
 *
 * The app registers Hono's `logger()` and an error handler that prints a full
 * stack for every 500, so dispatching ~90 paths with no bindings buries the
 * suite's own output in several hundred lines of expected noise. Restored in a
 * `finally`, so a throw cannot leave the console muted for later checks.
 */
async function quietly(fn) {
  /**
   * Silenced at the STREAM, not on `console`. Hono's `logger()` captures
   * `console.log` when the middleware is created — at `app.use("*", logger())`,
   * which runs on import, long before this function does — so reassigning
   * `console.log` here is too late and the request log still prints. Patching
   * `write` catches every writer however it got its handle. Restored in a
   * `finally`, so a throw cannot leave the suite's own output muted.
   */
  const out = process.stdout.write.bind(process.stdout);
  const err = process.stderr.write.bind(process.stderr);
  process.stdout.write = () => true;
  process.stderr.write = () => true;
  try {
    return await fn();
  } finally {
    process.stdout.write = out;
    process.stderr.write = err;
  }
}

async function statusOf(method, path) {
  const response = await app.request(
    path,
    { method, ...(method === "GET" || method === "DELETE" ? {} : { body: "{}", headers: { "Content-Type": "application/json" } }) },
    NO_ENV,
  );
  return response.status;
}

await checkAsync(
  `all ${EXPECTED.length} new paths answer something other than 404`,
  async () => {
    const notFound = await quietly(async () => {
      const out = [];
      for (const [method, path] of EXPECTED) {
        if ((await statusOf(method, path)) === 404) out.push(`${method} ${path}`);
      }
      return out;
    });
    assert.deepEqual(
      notFound,
      [],
      `${notFound.length} path(s) are not reachable:\n  ${notFound.join("\n  ")}`,
    );
  },
);

check("and every one of them is GATED by the edge, not public", () => {
  /**
   * Asserted against `accessFor`, the pure classifier `edge.ts` actually
   * calls, rather than by dispatching through Hono — which never sees the
   * gate. `"api"` means a credential is required; `"public"` would mean this
   * session had added an unauthenticated surface reporting binding health,
   * the guardian project name and core-browser's cost guard state.
   */
  const open = EXPECTED.filter(([method, path]) => accessFor(method, path) !== "api").map(
    ([method, path]) => `${method} ${path}`,
  );
  assert.deepEqual(open, [], `${open.length} new path(s) are not gated:\n  ${open.join("\n  ")}`);
  // The control: the classifier really can answer "public", so this is not
  // a check that says "api" to everything.
  assert.equal(accessFor("GET", "/api/ping"), "public");
  assert.equal(accessFor("GET", "/api/health"), "public");
  assert.equal(accessFor("GET", "/login"), "public");
  // And a GET-only exemption is not a licence for other methods.
  assert.equal(accessFor("POST", "/api/ping"), "api");
});

await checkAsync("THE CONTROL: a path that does not exist still answers 404", async () => {
  /**
   * Without this, a change that made every request answer 401 — a
   * catch-all gate, a misordered middleware — would turn the assertions above
   * green while nothing was mounted at all. This is the assertion that proves
   * this check can fail.
   */
  const controls = [
    "/api/config/not-a-real-resource",
    "/api/config/snapshots-typo/x",
    "/api/ideas-typo",
    "/api/definitely-not-mounted",
  ];
  const statuses = await quietly(async () => {
    const out = {};
    for (const path of controls) out[path] = await statusOf("GET", path);
    return out;
  });
  for (const path of controls) {
    assert.equal(statuses[path], 404, `${path} must answer 404, or this check is blind`);
  }
});

await checkAsync("a resource added to the descriptor table gets its routes for free", async () => {
  // The descriptor table is the single source of the resource list, so a
  // thirteenth resource must already be reachable rather than needing a route
  // written by hand. Asserted on the two added after the first twelve.
  for (const resource of ["wishlist", "occasions"]) {
    assert.ok(
      CONFIG_RESOURCE_SPECS.some((spec) => spec.resource === resource),
      `${resource} is not in CONFIG_RESOURCE_SPECS`,
    );
    const status = await quietly(() => statusOf("GET", `/api/config/${resource}`));
    assert.notEqual(status, 404, `/api/config/${resource} is not reachable`);
  }
});

check("the template's key/value config router kept its own routes under /api/lab", () => {
  // Moving it was deliberate (the shopper config owns /api/config), and
  // nothing in the frontend called it; this asserts it was MOVED and not lost.
  const lab = app.routes.filter((route) => route.path.startsWith("/api/lab/config"));
  assert.ok(lab.length > 0, "the template config router is not mounted anywhere");
});

// ---------------------------------------------------------------------------
// Mounted is not the same as reachable.
// ---------------------------------------------------------------------------
//
// **Measured 2026-10-26, on the deployed Worker, right after PRs #19 to #24
// merged.** `GET /api/goals/due` — the "which goals are due before their
// window" route from cs-gap-occasion-calendar — answered
// `404 {"error":{"code":"goal_not_found"}}`. The handler was mounted. It was
// in `/openapi.json`. It was unreachable, because `app.route("/api/goals",
// goalsRouter)` registered `/{id}` first and Hono resolves overlapping
// patterns in registration order, so `due` was read as a goal id.
//
// **Everything above this line passed while that was true**, and the reason is
// worth keeping. The dispatch check asserts each new path answers "something
// other than 404". With no bindings, the WRONG handler threw on its missing
// Hyperdrive binding and answered 500 — which is not 404, so it read as a
// pass. "Not 404" cannot tell "my handler ran" from "somebody else's handler
// ran", which is the same mistake as asserting a path and a method instead of
// a handler identity, one layer along.
//
// So this asserts the pattern that ANSWERS is the pattern that was
// REGISTERED, for every route in the table, by asking Hono's own router
// rather than reimplementing its precedence: a throwaway app is built with
// the same patterns in the same order, each answering with its own index.
const { Hono } = await import("hono");

/** A concrete path for a pattern. Deliberately unlike any static segment. */
const PROBE_SEGMENT = "zzprobezz";
const concretePath = (pattern) =>
  pattern.replace(/\{[^}]+\}/g, PROBE_SEGMENT).replace(/:[A-Za-z0-9_]+/g, PROBE_SEGMENT);

/**
 * Report every pattern whose own concrete path is answered by a different
 * pattern, or by nothing.
 *
 * Compares the PATTERN, never the index: `OpenAPIHono` registers a validator
 * middleware and a handler as separate entries for one route, so several
 * entries share a path and a method legitimately. `ALL` entries are the
 * global middleware (`cors`, `logger`), which do not terminate a request and
 * would swallow every probe.
 */
async function shadowedIn(routeTable) {
  const routes = routeTable.filter((route) => route.method !== "ALL");
  const probe = new Hono();
  routes.forEach((route, index) =>
    probe.on(route.method, route.path, () => new Response(String(index))),
  );
  const out = [];
  for (const route of routes) {
    const answer = await probe.request(concretePath(route.path), { method: route.method });
    const winner = answer.status === 404 ? null : routes[Number(await answer.text())];
    if (winner?.path !== route.path) {
      out.push(`${route.method} ${route.path} -> ${winner ? winner.path : "nothing (404)"}`);
    }
  }
  return out;
}

await checkAsync(
  `every one of the ${app.routes.filter((r) => r.method !== "ALL").length} registered routes is REACHABLE, not shadowed`,
  async () => {
    const shadowed = await shadowedIn(app.routes);
    assert.deepEqual(
      [...new Set(shadowed)],
      [],
      `${new Set(shadowed).size} route pattern(s) can never be reached:\n  ${[...new Set(shadowed)].join("\n  ")}`,
    );
  },
);

await checkAsync("THE CONTROL: the reachability probe really does catch shadowing", async () => {
  /**
   * The assertion above is a list being empty, which is exactly the shape
   * that reads green when the instrument is broken. This feeds it the bug it
   * exists to catch — a param registered before a static sibling — and
   * asserts it is reported. Without this, a probe that silently matched
   * nothing would pass forever.
   *
   * `:id`, not `{id}`: `OpenAPIHono` rewrites an OpenAPI `{id}` to Hono's
   * `:id` when it registers, so `:id` is what the real table holds. Written
   * with braces, Hono reads the segment as the literal text `{id}` and the
   * control passes for the wrong reason — which is how this comment got here.
   */
  const shadowed = await shadowedIn([
    { method: "GET", path: "/api/goals/:id", handler: () => {} },
    { method: "GET", path: "/api/goals/due", handler: () => {} },
  ]);
  assert.deepEqual(shadowed, ["GET /api/goals/due -> /api/goals/:id"]);
  // And the other order is clean, so it is not a check that calls everything shadowed.
  assert.deepEqual(
    await shadowedIn([
      { method: "GET", path: "/api/goals/due", handler: () => {} },
      { method: "GET", path: "/api/goals/:id", handler: () => {} },
    ]),
    [],
  );
});

console.log(`selfcheck-route-mounts: ok (${passed} checks)`);
