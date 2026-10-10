/**
 * Self-check: the Runs contracts accept the rows PostgreSQL actually emits
 * (maestro cs-be-2-3).
 *
 * `scripts/selfcheck-runs-api.mjs` pins the pure helpers. This pins the other
 * half — the parse — because that is where this project's last green-deploy lie
 * lived: the Goals API typechecked, built and deployed while its revision diff
 * carried a field it should not have, and only a live probe found it.
 *
 * Every literal below is MEASURED psql output from core_shopping on LXC 109,
 * captured 2026-10-10 inside a transaction that was rolled back (no rows were
 * seeded). The shapes that matter and that a hand-written fixture gets wrong:
 *
 * - jsonb_agg renders a timestamptz as "+00:00", not "Z".
 * - run_events.data is null far more often than it is an object.
 * - a run with no goal links yields array[]::uuid[] -> [], never null.
 * - a running run has finished_at null, so duration_ms must be null, not 0.
 * - counts arrive as numbers from pg but as strings from some drivers, so the
 *   route coerces them; both forms must parse.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const ALIASES = [
  ["@/backend/", "src/backend/"],
  ["@/shared/", "src/shared/"],
];

registerHooks({
  resolve(specifier, context, next) {
    for (const [prefix, dir] of ALIASES) {
      if (specifier.startsWith(prefix)) {
        let target = resolvePath(root, dir, specifier.slice(prefix.length));
        if (!/\.[cm]?[jt]sx?$/.test(target)) {
          target = existsSync(`${target}.ts`) ? `${target}.ts` : resolvePath(target, "index.ts");
        }
        return next(pathToFileURL(target).href, context);
      }
    }
    if (
      context.parentURL?.startsWith(pathToFileURL(resolvePath(root, "src")).href) &&
      /^\.\.?\//.test(specifier) &&
      !/\.[cm]?[jt]sx?$/.test(specifier)
    ) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});

const { McpToolCallSchema, RunEventSchema } = await import("../src/shared/contracts/runs.ts");
const { normalizeRun } = await import("../src/backend/api/routes/shopping/runs.ts");

const RUN_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const GOAL_ID = "124bd0e6-acc6-4860-aa01-ae8f98d40a37";

// --- the finished run, exactly as the list query returned it -----------------
// Counts arrive as strings through node-postgres' int8/numeric handling and
// timestamps arrive in pg's own "+00" rendering, so the raw row is fed in
// untouched: the route's own coercions are what is under test.
const finished = normalizeRun({
  id: RUN_ID,
  client: "claude",
  model: "claude-opus-5",
  status: "succeeded",
  goal_ids: [GOAL_ID, GOAL_ID, null, ""],
  started_at: "2026-10-10 10:00:00+00",
  finished_at: "2026-10-10 10:00:01.25+00",
  summary: "probe run A",
  quality_score: 0.8,
  uniqueness_score: 0.4,
  sightings_count: "2",
  new_entities_count: "1",
  proposals_count: "1",
  session_url: null,
  error: null,
});
assert.deepEqual(finished.goal_ids, [GOAL_ID], "duplicate join rows collapse to one goal id");
assert.equal(finished.sightings_count, 2, "a count must reach the UI as a number, not a string");
assert.equal(finished.started_at, "2026-10-10T10:00:00.000Z", "pg's +00 becomes a Z offset");
assert.equal(
  finished.duration_ms,
  1250,
  "pg renders fractional seconds as .25, which is 250ms and not 25ms",
);

// --- the running run: no goal links, no finish -------------------------------
const running = normalizeRun({
  id: "aaaaaaaa-0000-4000-8000-000000000002",
  client: "browser",
  model: "",
  status: "running",
  goal_ids: [],
  started_at: "2026-10-10 11:00:00+00",
  finished_at: null,
  summary: "probe run B",
  quality_score: null,
  uniqueness_score: null,
  sightings_count: 0,
  new_entities_count: 0,
  proposals_count: 0,
  session_url: null,
  error: null,
});
assert.deepEqual(running.goal_ids, [], "array[]::uuid[] is an empty array, never null");
assert.equal(running.finished_at, null);
assert.equal(running.duration_ms, null, "a running run has no duration — null, not 0");

// A row the query cannot produce must still be refused rather than coerced:
// agent_runs.status is an enum in Postgres, and a value outside it means the
// enum and the contract have drifted apart.
assert.throws(
  () => normalizeRun({ ...running, status: "queued" }),
  /status|invalid/i,
  "a status outside the run_status enum must fail the parse, not pass through",
);

// --- the trace, as jsonb_agg renders it --------------------------------------
const iso = (v) => new Date(v).toISOString();
const events = [
  {
    at: "2026-10-10T10:00:00+00:00",
    id: "bbbbbbbb-0000-4000-8000-000000000001",
    data: null,
    kind: "start",
    level: "info",
    run_id: RUN_ID,
    message: "first",
  },
  {
    at: "2026-10-10T10:00:01+00:00",
    id: "bbbbbbbb-0000-4000-8000-000000000002",
    data: { k: 2 },
    kind: "note",
    level: "warn",
    run_id: RUN_ID,
    message: "second",
  },
];
const parsedEvents = events.map((e) => RunEventSchema.parse({ ...e, at: iso(e.at) }));
assert.equal(parsedEvents[0].data, null, "run_events.data is null on most rows and must parse");
assert.deepEqual(parsedEvents[1].data, { k: 2 });

const parsedCall = McpToolCallSchema.parse({
  at: iso("2026-10-10T10:00:00.5+00:00"),
  id: "cccccccc-0000-4000-8000-000000000001",
  tool: "browser",
  error: null,
  status: "ok",
  run_id: RUN_ID,
  operation: "navigate",
  latency_ms: Number("412"),
  args_digest: "deadbeef",
});
assert.equal(parsedCall.at, "2026-10-10T10:00:00.500Z", "a +00:00 offset normalizes to Z");
assert.equal(parsedCall.error, null);

console.log("selfcheck-runs-rows: ok");
