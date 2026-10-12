/**
 * Self-check for the Runs queue's pure logic (maestro cs-fe-10-1).
 *
 * Each block names the failure it prevents:
 *
 * - attention options compile to the RIGHT SQL against the real column map,
 *   not just to a tree that looks plausible: "unscored" must be a succeeded
 *   run with a NULL score, and several options are OR-ed, not AND-ed
 * - the toolbar filter validates against RUN_LIST_FIELDS, so the API will not
 *   400 on a combination the UI offers
 * - status groups follow triage order whatever order the page arrives in, and
 *   a header reports "N of M" from the server's count
 * - the URL round-trips, and a stale bookmark cannot send an unknown value
 * - an unscored run shows a dash, not 0%
 * - a session link with a javascript: scheme is never rendered
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const ALIASES = [
  ["@/backend/", "src/backend/"],
  ["@/components/", "src/frontend/components/"],
  ["@/lib/", "src/frontend/lib/"],
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

const {
  attentionNode,
  buildRunRows,
  formatScore,
  parseRunQueueView,
  runQueueFilter,
  safeSessionUrl,
  serializeRunQueueView,
  statusCount,
  RUN_ATTENTION,
  CLIENT_LABELS,
} = await import("../src/frontend/components/runs/run-rows.ts");
const { validateListQuery, RUN_LIST_FIELDS, AGENT_CLIENTS } = await import("../src/shared/contracts/index.ts");
const { compileFilter } = await import("../src/backend/api/list/index.ts");
const { runListColumns } = await import("../src/backend/api/routes/shopping/runs.ts");
const { buildListParams } = await import("../src/frontend/lib/list-query.ts");
const { PgDialect } = await import("drizzle-orm/pg-core");

const dialect = new PgDialect();
const toSql = (filter) => dialect.sqlToQuery(compileFilter(RUN_LIST_FIELDS, runListColumns, filter));

// --- attention compiles to the intended SQL ------------------------------
{
  const unscored = toSql(runQueueFilter({ attention: ["unscored"] }));
  assert.match(unscored.sql, /"agent_runs"\."status" = \$1/);
  assert.match(unscored.sql, /"agent_runs"\."quality_score" is null/);
  assert.match(unscored.sql, / and /, "unscored is status AND null score");
  assert.deepEqual(unscored.params, ["succeeded"]);

  const low = toSql(runQueueFilter({ attention: ["low_quality"] }));
  assert.match(low.sql, /"agent_runs"\."quality_score" < \$1/);
  assert.deepEqual(low.params, [0.5]);

  const either = toSql(runQueueFilter({ attention: ["failed", "running"] }));
  assert.match(either.sql, / or /, "several attention options widen the view (OR), never narrow it");
  assert.deepEqual(either.params.sort(), ["failed", "running"]);

  const scoped = toSql(runQueueFilter({ attention: ["failed"], client: "claude", goalId: "11111111-1111-4111-8111-111111111111" }));
  assert.match(scoped.sql, /"run_goals"\."goal_id" = /);
  assert.match(scoped.sql, /"agent_runs"\."client" = /);
  assert.deepEqual(scoped.params, ["failed", "claude", "11111111-1111-4111-8111-111111111111"]);
}

// --- every combination the toolbar can produce is a valid API query ------
{
  const subsets = [];
  for (let mask = 0; mask < 1 << RUN_ATTENTION.length; mask += 1) {
    subsets.push(RUN_ATTENTION.filter((_, i) => mask & (1 << i)));
  }
  for (const attention of subsets) {
    for (const client of [undefined, ...AGENT_CLIENTS]) {
      const filter = runQueueFilter({ attention, client, goalId: "11111111-1111-4111-8111-111111111111" });
      assert.deepEqual(validateListQuery(RUN_LIST_FIELDS, { filter, group_by: "status" }), [], JSON.stringify(attention));
      // pruning must not drop the value-less "empty" rule on its way to the wire
      const sent = JSON.parse(buildListParams({ filter }).filter);
      assert.equal(JSON.stringify(sent).includes('"empty"'), attention.includes("unscored"));
    }
  }
  assert.equal(runQueueFilter({ attention: [], client: undefined, goalId: undefined }), undefined);
  assert.equal(attentionNode("failed").type, "rule");
}

// --- grouping -------------------------------------------------------------
function run(id, status) {
  return { id, status, client: "claude", model: "m", goal_ids: [], started_at: "2026-10-10T00:00:00.000Z",
    finished_at: null, summary: "", quality_score: null, uniqueness_score: null, sightings_count: 0,
    new_entities_count: 0, proposals_count: 0, session_url: null, error: null, duration_ms: null };
}
{
  const page = [run("a", "succeeded"), run("b", "failed"), run("c", "running"), run("d", "succeeded")];
  const rows = buildRunRows(page, [
    { key: "running", count: 1 }, { key: "failed", count: 7 }, { key: "succeeded", count: 2 },
  ]);
  assert.deepEqual(rows.map((r) => r.status), ["running", "failed", "succeeded"], "triage order, failures before successes");
  assert.deepEqual(rows[2].children.map((c) => c.id), ["a", "d"], "server order kept inside a group");
  assert.equal(rows[1].total, 7, "a header carries the server's count, not the page's");
  assert.equal(rows.find((r) => r.status === "abandoned"), undefined, "no header for an empty status");
  assert.equal(buildRunRows(page).every((r) => r.total === null), true, "ungrouped means unknown, not zero");
  assert.equal(statusCount([{ key: "failed", count: 3 }], "failed"), 3);
  assert.equal(statusCount([{ key: "failed", count: 3 }], "running"), 0);
}

// --- URL view -------------------------------------------------------------
{
  const v = { q: "laptop", attention: ["low_quality", "failed"], client: "gpt", goalId: "g1", page: 3 };
  const s = serializeRunQueueView(v);
  const back = parseRunQueueView(new URLSearchParams(s), AGENT_CLIENTS);
  assert.deepEqual(back, { ...v, attention: ["failed", "low_quality"] });
  assert.equal(serializeRunQueueView({ q: "", attention: [], client: undefined, goalId: undefined, page: 1 }), "");
  const stale = parseRunQueueView(new URLSearchParams("attention=failed,bogus&client=nope&page=-2"), AGENT_CLIENTS);
  assert.deepEqual(stale, { q: "", attention: ["failed"], client: undefined, goalId: undefined, page: 1 });
}

// --- every agent client has a display name, with brand casing ----------
assert.deepEqual(Object.keys(CLIENT_LABELS).sort(), [...AGENT_CLIENTS].sort());
assert.equal(CLIENT_LABELS.gpt, "GPT");

// --- rendering values -----------------------------------------------------
assert.equal(formatScore(null), "—");
assert.equal(formatScore(0), "0%");
assert.equal(formatScore(0.724), "72%");
assert.equal(safeSessionUrl("https://claude.ai/chat/1"), "https://claude.ai/chat/1");
assert.equal(safeSessionUrl("javascript:alert(1)"), null);
assert.equal(safeSessionUrl("JaVaScRiPt:alert(1)"), null);
assert.equal(safeSessionUrl("data:text/html,x"), null);
assert.equal(safeSessionUrl("not a url"), null);
assert.equal(safeSessionUrl(null), null);

console.log("selfcheck-runs-queue: ok");
