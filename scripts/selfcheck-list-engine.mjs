/**
 * Plain-Node assertions for the shared PostgreSQL list engine.
 *
 *   pnpm run selfcheck
 *   node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON scripts/selfcheck-list-engine.mjs
 *
 * The checks compile Drizzle expressions with PgDialect, proving both SQL text
 * and bound parameters. To prove this suite detects regressions, change the
 * `contains` wildcards in compileRule, run this file (it fails), then restore.
 */
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/shared/")) {
      return next(
        pathToFileURL(resolve(root, "src/shared", `${specifier.slice("@/shared/".length)}.ts`))
          .href,
        context,
      );
    }
    if (specifier.startsWith("@/backend/")) {
      return next(
        pathToFileURL(resolve(root, "src/backend", `${specifier.slice("@/backend/".length)}.ts`))
          .href,
        context,
      );
    }
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});

const { asc } = await import("drizzle-orm");
const { boolean, integer, pgTable, text, timestamp } = await import("drizzle-orm/pg-core");
const { PgDialect } = await import("drizzle-orm/pg-core/dialect");
const { ListQueryError, compileFilter, compilePage, compileSearch, compileSort, runList } =
  await import("../src/backend/api/list/index.ts");

const rows = pgTable("list_rows", {
  title: text("title"),
  score: integer("score"),
  happenedAt: timestamp("happened_at", { mode: "string" }),
  status: text("status"),
  tags: text("tags").array(),
  active: boolean("active"),
});

const fields = {
  title: { type: "text", label: "Title", sortable: true },
  score: { type: "number", label: "Score", sortable: true },
  happened_at: { type: "date", label: "Date", sortable: true },
  status: { type: "select", label: "Status", groupable: true, sortable: true },
  tags: { type: "multiselect", label: "Tags" },
  active: { type: "boolean", label: "Active" },
};
const columns = {
  title: rows.title,
  score: rows.score,
  happened_at: rows.happenedAt,
  status: rows.status,
  tags: rows.tags,
  active: rows.active,
};
const dialect = new PgDialect();
const query = (expression) => dialect.sqlToQuery(expression);
const group = (combinator, rules) => ({ id: "g", type: "group", combinator, rules });
const rule = (path, operator, value, negated) => ({
  id: `${path}-${operator}`,
  type: "rule",
  path: [path],
  operator,
  value,
  negated,
});

function assertSql(expression, sql, params, label) {
  const compiled = query(expression);
  assert.equal(compiled.sql, sql, `${label}: SQL`);
  assert.deepEqual(compiled.params, params, `${label}: bound params`);
}

// Text family and LIKE wildcard escaping.
assertSql(
  compileFilter(fields, columns, group("and", [rule("title", "contains", "50%_off")])),
  '"list_rows"."title" ilike $1',
  ["%50\\%\\_off%"],
  "contains escapes percent and underscore",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("title", "not_contains", "x")])),
  '"list_rows"."title" not ilike $1',
  ["%x%"],
  "not contains",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("title", "starts_with", "x")])),
  '"list_rows"."title" ilike $1',
  ["x%"],
  "starts with",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("title", "ends_with", "x")])),
  '"list_rows"."title" ilike $1',
  ["%x"],
  "ends with",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("title", "is", "x")])),
  '"list_rows"."title" = $1',
  ["x"],
  "text is",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("title", "is_not", "x")])),
  '"list_rows"."title" <> $1',
  ["x"],
  "text is not",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("title", "empty")])),
  '("list_rows"."title" is null or "list_rows"."title" = $1)',
  [""],
  "text empty",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("title", "not_empty")])),
  '("list_rows"."title" is not null and "list_rows"."title" <> $1)',
  [""],
  "text not empty",
);

// Numeric/date comparisons and ranges.
for (const [operator, token] of [
  ["eq", "="],
  ["neq", "<>"],
  ["gt", ">"],
  ["gte", ">="],
  ["lt", "<"],
  ["lte", "<="],
]) {
  assertSql(
    compileFilter(fields, columns, group("and", [rule("score", operator, 7)])),
    `"list_rows"."score" ${token} $1`,
    [7],
    `number ${operator}`,
  );
}
assertSql(
  compileFilter(fields, columns, group("and", [rule("score", "between", [2, 8])])),
  '("list_rows"."score" >= $1 and "list_rows"."score" <= $2)',
  [2, 8],
  "between",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("score", "not_between", [2, 8])])),
  'not ("list_rows"."score" >= $1 and "list_rows"."score" <= $2)',
  [2, 8],
  "not between",
);
assertSql(
  compileFilter(
    fields,
    columns,
    group("and", [rule("happened_at", "gte", "2026-10-01T00:00:00Z")]),
  ),
  '"list_rows"."happened_at" >= $1',
  ["2026-10-01T00:00:00Z"],
  "date comparison",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("score", "empty")])),
  '"list_rows"."score" is null',
  [],
  "number empty",
);

// Select, multiselect-array, and boolean families.
assertSql(
  compileFilter(fields, columns, group("and", [rule("status", "is", "open")])),
  '"list_rows"."status" = $1',
  ["open"],
  "select is",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("status", "is_not", "open")])),
  '"list_rows"."status" <> $1',
  ["open"],
  "select is not",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("status", "is_any_of", ["open", "done"])])),
  '"list_rows"."status" in ($1, $2)',
  ["open", "done"],
  "select any",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("status", "is_none_of", ["open", "done"])])),
  '"list_rows"."status" not in ($1, $2)',
  ["open", "done"],
  "select none",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("tags", "has_any_of", ["a", "b"])])),
  '"list_rows"."tags" && $1',
  ['{"a","b"}'],
  "array overlaps",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("tags", "has_all_of", ["a", "b"])])),
  '"list_rows"."tags" @> $1',
  ['{"a","b"}'],
  "array contains",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("tags", "has_none_of", ["a"])])),
  'not "list_rows"."tags" && $1',
  ['{"a"}'],
  "array excludes",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("active", "is", true)])),
  '"list_rows"."active" = $1',
  [true],
  "boolean is",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("active", "is_not", false)])),
  '"list_rows"."active" <> $1',
  [false],
  "boolean is not",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("active", "not_empty")])),
  '"list_rows"."active" is not null',
  [],
  "boolean not empty",
);

// Tree composition, rule negation, unfinished rules, and whitelist rejection.
const nested = group("or", [
  group("and", [rule("status", "is", "open"), rule("score", "gte", 10)]),
  rule("active", "is", true),
]);
assertSql(
  compileFilter(fields, columns, nested),
  '(("list_rows"."status" = $1 and "list_rows"."score" >= $2) or "list_rows"."active" = $3)',
  ["open", 10, true],
  "nested (A and B) or C",
);
assertSql(
  compileFilter(fields, columns, group("and", [rule("active", "is", true, true)])),
  'not "list_rows"."active" = $1',
  [true],
  "negated rule",
);
assert.equal(
  compileFilter(fields, columns, group("and", [rule("title", "", undefined)])),
  undefined,
  "unfinished rule is skipped",
);
assert.throws(
  () => compileFilter(fields, columns, group("and", [rule("private", "is", "x")])),
  (error) =>
    error instanceof ListQueryError &&
    error.problems.some((problem) => problem.includes('unknown filter field "private"')),
  "unknown fields raise ListQueryError",
);

// Search, descending sort with stable fallback, and pagination.
assertSql(
  compileSearch([rows.title, rows.status], "50%_"),
  '("list_rows"."title" ilike $1 or "list_rows"."status" ilike $2)',
  ["%50\\%\\_%", "%50\\%\\_%"],
  "search escapes wildcards",
);
const sort = compileSort(fields, columns, "-score", asc(rows.title));
assertSql(sort[0], '"list_rows"."score" desc', [], "sort descending");
assertSql(sort[1], '"list_rows"."title" asc', [], "stable fallback sort");
assert.deepEqual(
  compilePage({ page: 3, page_size: 25 }),
  { limit: 25, offset: 50 },
  "page and offset",
);

// The executor converts node-postgres numeric strings in both totals and
// grouped subtotals while preserving the shared envelope shape.
{
  const calls = [];
  const from = (selection) => {
    const kind = selection?.key ? "groups" : selection?.count ? "total" : "items";
    const result =
      kind === "groups"
        ? [{ key: "open", count: "2", amount: "1250" }]
        : kind === "total"
          ? [{ count: "3" }]
          : [{ title: "First" }, { title: "Second" }];
    const builder = {
      $dynamic: () => builder,
      where: (value) => (calls.push([kind, "where", value]), builder),
      orderBy: (...value) => (calls.push([kind, "orderBy", value]), builder),
      limit: (value) => (calls.push([kind, "limit", value]), builder),
      offset: (value) => (calls.push([kind, "offset", value]), builder),
      groupBy: (...value) => (calls.push([kind, "groupBy", value]), builder),
      // oxlint-disable-next-line unicorn/no-thenable -- Drizzle builders are intentionally promise-like.
      then: (resolveValue, rejectValue) => Promise.resolve(result).then(resolveValue, rejectValue),
    };
    return builder;
  };
  const result = await runList(
    {},
    {
      fields,
      columns,
      query: { group_by: "status", page: 2, page_size: 2 },
      from,
      fallback: asc(rows.title),
      groupSubtotals: { amount: rows.score },
    },
  );
  assert.deepEqual(result, {
    items: [{ title: "First" }, { title: "Second" }],
    total: 3,
    page: 2,
    page_size: 2,
    groups: [{ key: "open", count: 2, subtotals: { amount: 1250 } }],
  });
  assert.ok(
    calls.some(([kind, method]) => kind === "groups" && method === "groupBy"),
    "groups are aggregated in SQL",
  );
}

console.log("selfcheck-list-engine: all list compiler assertions passed");
