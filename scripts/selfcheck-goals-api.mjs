/**
 * Self-check for the pure Goals API helpers (maestro cs-be-2-2).
 *
 * The alias hook lets plain Node load the Worker route without teaching Node
 * about the repository's TypeScript path aliases. No database is contacted.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      let target = resolvePath(root, "src", specifier.slice(2));
      if (!/\.[cm]?[jt]sx?$/.test(target)) {
        target = existsSync(`${target}.ts`) ? `${target}.ts` : resolvePath(target, "index.ts");
      }
      return next(pathToFileURL(target).href, context);
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

const { generateGoalSlug, revisionDiff } =
  await import("../src/backend/api/routes/shopping/goals.ts");

assert.equal(generateGoalSlug("Summer trip", []), "summer-trip");
assert.equal(generateGoalSlug("Summer trip", ["summer-trip"]), "summer-trip-2");
assert.equal(generateGoalSlug("Summer trip", ["summer-trip", "summer-trip-2"]), "summer-trip-3");
assert.equal(
  generateGoalSlug("  ¡Crème brûlée — 東京!  "),
  "creme-brulee",
  "unicode and punctuation leave a usable slug",
);

assert.deepEqual(
  revisionDiff(null, { title: "First" }),
  [],
  "revision one has no predecessor and no diff",
);
assert.deepEqual(
  revisionDiff(
    { title: "Trip", status: "active", budget_max_cents: 50000 },
    { title: "Trip", status: "paused", budget_max_cents: 50000 },
  ),
  [{ field: "status", before: "active", after: "paused" }],
  "only changed fields appear with before and after values",
);
assert.deepEqual(
  revisionDiff({ window_end: "2027-01-01" }, { window_end: null }),
  [{ field: "window_end", before: "2027-01-01", after: null }],
  "a value changed to null is still a change",
);

console.log("selfcheck-goals-api: ok");
