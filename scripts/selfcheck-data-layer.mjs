/**
 * Self-check for the frontend data layer (maestro cs-fe-0-4):
 * src/frontend/lib/{filters,list-query,format}.ts.
 *
 * What it pins, each on its own assertion so deleting one branch turns it red:
 *  - an UNFINISHED filter rule never reaches the wire (the server refuses the
 *    whole query over one half-picked rule, so the UI must drop it);
 *  - a nested (A and B) or C survives buildListParams -> parseListParams;
 *  - a mangled pasted `filter` yields an unfiltered list, not a thrown screen;
 *  - money is integer cents with separators at 0, negative and millions;
 *  - "no ratio yet" renders differently from 0%.
 *
 * Node strips `import type` but cannot resolve the `@/*` tsconfig aliases, so
 * they are mapped here — the same registerHooks approach as
 * scripts/selfcheck-guardian-surface.mjs.
 */
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const ALIASES = [
  ["@/shared/", "src/shared/"],
  ["@/lib/", "src/frontend/lib/"],
  ["@/components/", "src/frontend/components/"],
];

registerHooks({
  resolve(specifier, context, next) {
    for (const [prefix, dir] of ALIASES) {
      if (specifier.startsWith(prefix)) {
        let target = resolvePath(root, dir, specifier.slice(prefix.length));
        if (!/\.[cm]?[jt]sx?$/.test(target)) target += ".ts";
        return next(pathToFileURL(target).href, context);
      }
    }
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});

const { toFilterFields, countRules, isEmptyQuery, pruneQuery, optionLabel } =
  await import("../src/frontend/lib/filters.ts");
const { buildListParams, parseListParams, parseSort, toSort, DEFAULT_PAGE_SIZE } =
  await import("../src/frontend/lib/list-query.ts");
const { money, moneyRange, points, duration, percent } =
  await import("../src/frontend/lib/format.ts");

const rule = (id, path, operator, value) => ({ id, type: "rule", path, operator, value });
const group = (id, combinator, rules) => ({ id, type: "group", combinator, rules });

// toFilterFields
const fields = toFilterFields({
  title: { type: "text", label: "Title", sortable: true },
  status: { type: "select", label: "Status", groupable: true, options: ["active", "in_progress"] },
  "goal.title": { type: "text", label: "Goal title" },
});
assert.equal(fields.length, 3, "two roots plus one nested branch");
assert.deepEqual(fields.find((f) => f.id === "status").options, [
  { value: "active", label: "Active" },
  { value: "in_progress", label: "In progress" },
]);
const branch = fields.find((f) => f.id === "goal");
assert.equal(branch.fields.length, 1);
assert.equal(branch.fields[0].id, "title", "a nested field drops its parent prefix, matching ReUI's path array");
assert.equal(optionLabel("strong_yes"), "Strong yes");

// an unfinished rule must never filter
const halfBuilt = group("root", "and", [rule("r1", ["status"], "", undefined)]);
assert.equal(countRules(halfBuilt), 0, "a rule with no operator is not a rule yet");
assert.equal(isEmptyQuery(halfBuilt), true);
assert.equal(pruneQuery(halfBuilt), undefined, "pruning an all-unfinished tree yields nothing");
assert.equal(buildListParams({ filter: halfBuilt }).filter, undefined, "it must not reach the wire");

const mixed = group("root", "and", [rule("a", ["status"], "is", "active"), rule("b", ["title"], "", undefined)]);
assert.equal(countRules(mixed), 1);
assert.equal(JSON.parse(buildListParams({ filter: mixed }).filter).rules.length, 1, "only the complete rule survives");

// round trip, parentheses included
const nested = group("root", "or", [
  group("g1", "and", [rule("r1", ["status"], "is", "active"), rule("r2", ["price_cents"], "lt", 5000)]),
  rule("r3", ["title"], "contains", "Adele"),
]);
const params = buildListParams({ q: "  adele  ", filter: nested, group_by: "status", sort: "-last_run_at", page: 3 });
assert.equal(params.q, "adele", "q is trimmed");
assert.equal(params.page, "3");
const back = parseListParams(new URLSearchParams(params));
assert.deepEqual(back.filter, nested, "the whole tree round-trips");
assert.equal(back.group_by, "status");
assert.equal(back.page, 3);

assert.deepEqual(buildListParams({ page: 1, page_size: DEFAULT_PAGE_SIZE }), {}, "defaults stay out of the URL");
assert.deepEqual(buildListParams(), {});

const broken = parseListParams(new URLSearchParams({ filter: "{not json" }));
assert.equal(broken.filter, undefined, "a mangled link filters nothing rather than throwing");
assert.equal(broken.page, 1);
assert.equal(
  parseListParams(new URLSearchParams({ filter: JSON.stringify(rule("r", ["t"], "is", 1)) })).filter,
  undefined,
  "a bare rule at the root is not a query",
);

// sort
assert.deepEqual(parseSort("-price_cents"), { field: "price_cents", desc: true });
assert.deepEqual(parseSort("title"), { field: "title", desc: false });
assert.equal(parseSort(undefined), null);
assert.equal(toSort("title", true), "-title");

// money and friends
assert.equal(money(0, "USD"), "$0.00");
assert.equal(money(-25000, "USD"), "-$250.00");
assert.equal(money(123456789, "USD"), "$1,234,567.89", "millions carry separators");
assert.equal(money(250000, "USD", { whole: true }), "$2,500");
assert.equal(money(250050, "USD", { whole: true }), "$2,500.50", "not a round unit, so decimals stay");
assert.equal(money(null), "—");
assert.equal(moneyRange(2500, 2500, "USD"), "$25");
assert.equal(moneyRange(2500, 10000, "USD"), "$25–$100");
assert.equal(moneyRange(null, 10000, "USD"), "up to $100");
assert.equal(moneyRange(null, null), "—");
assert.equal(points(1200000, "chase-ur"), "1,200,000 chase-ur");
assert.equal(points(0), "0");
assert.equal(points(null), "—");
assert.equal(duration(840), "840ms");
assert.equal(duration(1400), "1.4s");
assert.equal(duration(130000), "2m 10s");
assert.equal(duration(120000), "2m");
assert.equal(duration(11040000), "3h 04m");
assert.equal(duration(-1), "—");
assert.equal(percent(0.724), "72%");
assert.equal(percent(0), "0%");
assert.equal(percent(null), "—", "no reviews yet is not the same as a 0% accept rate");

console.log("selfcheck-data-layer: ok");
