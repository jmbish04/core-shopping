/**
 * Self-check for the Goals console's pure logic (maestro cs-fe-2-1).
 *
 * The console's grid, switches and filters are React; what is worth pinning is
 * underneath them, in `goal-rows.ts`:
 *
 * - a never-run goal is HEALTHY, not stale, and status beats staleness
 * - a category header's count comes from the server's `groups`, not from the
 *   page in `items`, so a partially-loaded category can say "N of M"
 * - a health tab is a real API filter tree, ANDed with the user's own, so the
 *   envelope's `total` describes the view on screen
 * - the optimistic switch and its rollback go through one function
 *
 * `accept_rate` is deliberately absent from the assertions about zero: the
 * em-dash rendering lives in `percent()` and is pinned by
 * scripts/selfcheck-data-layer.mjs. What is pinned here is that nothing in the
 * row logic turns a null into a number on the way past.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const ALIASES = [
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
  buildGoalRows,
  expandAllCategories,
  goalHealth,
  healthFilterQuery,
  mergeFilterQueries,
  rollUpGoals,
  withGoalStatus,
} = await import("../src/frontend/components/goals/goal-rows.ts");
const { buildListParams } = await import("../src/frontend/lib/list-query.ts");
const { validateListQuery } = await import("../src/shared/contracts/common.ts");
const { GOAL_LIST_FIELDS } = await import("../src/shared/contracts/goals.ts");

/** A goal row with only the fields the logic under test reads. */
function goal(over = {}) {
  return {
    id: over.id ?? "11111111-1111-4111-8111-111111111111",
    slug: "a-goal",
    title: "A goal",
    category: "experience",
    status: "active",
    schedule_hint: "",
    budget_min_cents: null,
    budget_max_cents: null,
    currency: "USD",
    last_run_at: null,
    expected_cadence_hours: null,
    next_expected_at: null,
    stale: false,
    runs_count: 0,
    findings_count: 0,
    accept_rate: null,
    ...over,
  };
}

// --- health: absence is not a verdict ---------------------------------------
assert.equal(
  goalHealth(goal({ status: "active", stale: false, last_run_at: null, runs_count: 0 })),
  "healthy",
  "a goal that has never run is not stale — the server said stale:false and that stands",
);
assert.equal(goalHealth(goal({ status: "active", stale: true })), "stale");
assert.equal(
  goalHealth(goal({ status: "paused", stale: true })),
  "paused",
  "status beats staleness: a paused goal is switched off, not failing to run",
);
assert.equal(
  goalHealth(goal({ status: "retired", stale: true })),
  "retired",
  "a retired goal is neither paused nor stale, which is why the console keeps an All tab",
);

// --- health tabs are real API filters ---------------------------------------
assert.equal(healthFilterQuery("all"), undefined, "the All tab sends no filter");
for (const tab of ["healthy", "stale", "paused"]) {
  const query = healthFilterQuery(tab);
  assert.equal(query.type, "group");
  assert.deepEqual(
    validateListQuery(GOAL_LIST_FIELDS, { filter: query }),
    [],
    `the ${tab} tab must be a filter the goals API accepts`,
  );
}
assert.deepEqual(
  healthFilterQuery("stale").rules.map((r) => [r.path[0], r.operator, r.value]),
  [
    ["status", "is", "active"],
    ["stale", "is", true],
  ],
  "stale means an ACTIVE goal that is overdue — a paused goal is not in the stale tab",
);
assert.equal(
  healthFilterQuery("healthy").rules.find((r) => r.path[0] === "stale").value,
  false,
  "healthy is stale:false, not the absence of a stale rule",
);

// --- merging the tab with the user's own query -------------------------------
const userQuery = {
  id: "u",
  type: "group",
  combinator: "and",
  rules: [{ id: "u1", type: "rule", path: ["category"], operator: "is", value: "travel" }],
};
assert.equal(mergeFilterQueries(undefined, undefined), undefined);
assert.equal(
  mergeFilterQueries(undefined, { id: "e", type: "group", combinator: "and", rules: [] }),
  undefined,
  "an empty builder query must not reach the wire as a filter",
);
assert.deepEqual(mergeFilterQueries(undefined, userQuery), userQuery, "one query is not re-wrapped");
const merged = mergeFilterQueries(healthFilterQuery("paused"), userQuery);
assert.equal(merged.combinator, "and");
assert.equal(merged.rules.length, 2, "both halves survive the merge");
assert.deepEqual(
  validateListQuery(GOAL_LIST_FIELDS, { filter: merged, group_by: "category" }),
  [],
  "the merged query and the console's grouping must both be accepted by the API",
);
assert.equal(
  JSON.parse(buildListParams({ filter: merged }).filter).rules.length,
  2,
  "the merged query is what buildListParams puts on the wire",
);

// --- grouping: the header count is the server's -----------------------------
const items = [
  goal({ id: "g1", category: "travel", runs_count: 4, findings_count: 9 }),
  goal({ id: "g2", category: "travel", status: "paused", runs_count: 1, findings_count: 2 }),
  goal({ id: "g3", category: "experience", stale: true, runs_count: 7, findings_count: 3 }),
];
const rows = buildGoalRows(items, [
  { key: "travel", count: 40 },
  { key: "experience", count: 1 },
]);
assert.deepEqual(
  rows.map((r) => r.category),
  ["experience", "travel"],
  "categories come back in declaration order, not in the order the page happened to list them",
);
const travel = rows.find((r) => r.category === "travel");
assert.equal(travel.children.length, 2, "only the goals on this page are children");
assert.equal(
  travel.total,
  40,
  "the header carries the SERVER's count for the category, so a partial page can say '2 of 40'",
);
assert.equal(travel.runs, 5, "rolled-up runs are summed from the loaded children");
assert.equal(travel.findings, 11);
assert.equal(travel.paused, 1);
assert.equal(rows.find((r) => r.category === "experience").stale, 1);

const ungrouped = buildGoalRows(items);
assert.equal(
  ungrouped.find((r) => r.category === "travel").total,
  null,
  "with no groups in the envelope the count is UNKNOWN, not the page's length",
);
assert.deepEqual(buildGoalRows([], []), [], "no goals means no category headers");
assert.deepEqual(
  buildGoalRows([], [{ key: "travel", count: 12 }]),
  [],
  "a group with no loaded goals draws no header: it would claim a section that is not there",
);

assert.deepEqual(rollUpGoals(rows), { goals: 3, runs: 12, findings: 14, paused: 1, stale: 1 });
assert.deepEqual(expandAllCategories(rows), {
  "category:experience": true,
  "category:travel": true,
});

// --- the optimistic switch and its rollback ---------------------------------
const paused = withGoalStatus(items, "g1", "paused");
assert.equal(paused.find((g) => g.id === "g1").status, "paused");
assert.equal(items.find((g) => g.id === "g1").status, "active", "the input array is not mutated");
assert.equal(
  paused.find((g) => g.id === "g2").status,
  "paused",
  "no other goal is touched by a status change",
);
assert.equal(
  withGoalStatus(paused, "g1", "active").find((g) => g.id === "g1").status,
  "active",
  "rollback is the same function in the other direction",
);
assert.deepEqual(
  withGoalStatus(items, "not-a-goal", "paused"),
  items,
  "an id the page does not hold changes nothing",
);

console.log("selfcheck-goals-console: ok");
