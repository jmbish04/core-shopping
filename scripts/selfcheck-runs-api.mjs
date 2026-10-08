/**
 * Self-check for the Runs API pure helpers (maestro cs-be-2-3).
 *
 * Pins completed/running/inverted duration handling, stable goal-id
 * aggregation, and the queue's explicit status-group ordering. Node cannot
 * resolve the repository aliases itself, so this uses the registerHooks alias
 * pattern from scripts/selfcheck-data-layer.mjs.
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

const { aggregateGoalIds, computeRunDurationMs, orderRunStatusGroups } =
  await import("../src/backend/api/routes/shopping/runs.ts");

assert.equal(computeRunDurationMs("2026-10-08T10:00:00.000Z", "2026-10-08T10:00:01.250Z"), 1250);
assert.equal(
  computeRunDurationMs("2026-10-08T10:00:00.000Z", null),
  null,
  "a running run has no duration",
);
assert.equal(
  computeRunDurationMs("2026-10-08T10:00:01.000Z", "2026-10-08T10:00:00.000Z"),
  0,
  "clock skew must never expose a negative duration",
);

assert.deepEqual(aggregateGoalIds(null), []);
assert.deepEqual(
  aggregateGoalIds(["goal-b", null, "goal-a", "goal-b", ""]),
  ["goal-b", "goal-a"],
  "aggregation removes nulls, empties, and duplicates without changing first-seen order",
);

const groups = [
  { key: "succeeded", count: 3 },
  { key: "abandoned", count: 1 },
  { key: "running", count: 2 },
  { key: "future", count: 9 },
  { key: "failed", count: 4 },
];
assert.deepEqual(
  orderRunStatusGroups(groups).map(({ key }) => key),
  ["running", "failed", "succeeded", "abandoned", "future"],
);
assert.equal(groups[0].key, "succeeded", "ordering does not mutate the caller's array");

console.log("selfcheck-runs-api: ok");
