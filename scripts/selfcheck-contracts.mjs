/**
 * Self-check for src/shared/contracts/common.ts (maestro cs-c-01).
 *
 * Pins the list-query guard: an undeclared filter field, a wrong operator, an
 * ungroupable group_by, a too-deep tree and malformed JSON must all be refused,
 * while a valid nested AND/OR query passes. Each refusal is asserted on its own
 * so deleting one branch of validateListQuery turns this red.
 */
import assert from "node:assert/strict";

import { ListQuerySchema, validateListQuery } from "../src/shared/contracts/common.ts";

const FIELDS = {
  title: { type: "text", label: "Title", sortable: true },
  status: { type: "select", label: "Status", groupable: true, options: ["active", "paused"] },
  price: { type: "number", label: "Price", sortable: true },
};
const rule = (id, path, operator, value) => ({ id, type: "rule", path, operator, value });
const group = (id, combinator, rules) => ({ id, type: "group", combinator, rules });
const parse = (tree, extra = {}) => ListQuerySchema.parse({ filter: JSON.stringify(tree), ...extra });

// valid nested (A and B) or C
const ok = parse(
  group("root", "or", [
    group("g1", "and", [rule("r1", ["status"], "is", "active"), rule("r2", ["price"], "lt", 5000)]),
    rule("r3", ["title"], "contains", "Adele"),
  ]),
  { group_by: "status", sort: "-price" },
);
assert.deepEqual(validateListQuery(FIELDS, ok), []);
assert.equal(ok.page, 1);
assert.equal(ok.page_size, 50);

// unknown field
assert.match(validateListQuery(FIELDS, parse(group("root", "and", [rule("r", ["secret_col"], "is", 1)])))[0], /unknown filter field "secret_col"/);
// operator not valid for type
assert.match(validateListQuery(FIELDS, parse(group("root", "and", [rule("r", ["price"], "contains", "x")])))[0], /operator "contains" is not valid/);
// unfinished rule (no operator) is skipped, not an error
assert.deepEqual(validateListQuery(FIELDS, parse(group("root", "and", [rule("r", ["price"], "")]))), []);
// group_by and sort must be declared
assert.match(validateListQuery(FIELDS, ListQuerySchema.parse({ group_by: "title" }))[0], /cannot group by "title"/);
assert.match(validateListQuery(FIELDS, ListQuerySchema.parse({ sort: "status" }))[0], /cannot sort by "status"/);
// depth cap
let deep = rule("leaf", ["title"], "contains", "x");
for (let i = 0; i < 5; i++) deep = group(`g${i}`, "and", [deep]);
assert.ok(validateListQuery(FIELDS, parse(deep)).some((p) => /nests deeper/.test(p)));
// malformed JSON and non-group root are refused at parse time
assert.equal(ListQuerySchema.safeParse({ filter: "{not json" }).success, false);
assert.equal(ListQuerySchema.safeParse({ filter: JSON.stringify(rule("r", ["title"], "is", "x")) }).success, false);
// page_size cap
assert.equal(ListQuerySchema.safeParse({ page_size: "500" }).success, false);

console.log("selfcheck-contracts: ok");
