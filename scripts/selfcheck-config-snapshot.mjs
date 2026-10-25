/**
 * Self-check for the configuration snapshot's canonical rendering
 * (maestro cs-gap-config-asof).
 *
 * The whole mechanism rests on one property: **the same configuration must
 * always render to the same string.** If it does not, every read mints a new
 * snapshot, the table grows per run instead of per change, and the claim that
 * "a day of unchanged config costs one row" is false.
 *
 * Two things threaten that, and each has a test:
 *
 * - **Row order.** Postgres returns rows in whatever order it likes unless
 *   told otherwise, and object key order follows whatever the driver did. Both
 *   are sorted here, so the string is a function of the content alone.
 * - **`created_at` and `updated_at`.** They move on every write without
 *   changing what the configuration SAYS. Retyping the same hotel rule must
 *   not make a past proposal look as though it was judged against something
 *   else.
 *
 * The diff is tested too, because "the settings at the time, diffed against
 * now" is what makes a verdict explained by a since-changed rule explainable
 * again. A diff that reported nothing would read as "nothing has moved".
 */
import assert from "node:assert/strict";

const { SNAPSHOT_TABLES, VOLATILE_COLUMNS, canonicalPayload, canonicalString, diffSnapshots } =
  await import("../src/backend/config/canonical.ts");

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const rule = (over = {}) => ({
  id: "r-1",
  brand: "Hilton",
  stance: "avoid",
  reason: "Dead bugs in the sheets, Palm Springs",
  since: "2024-06-01",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

console.log("selfcheck-config-snapshot");

check("the same configuration renders identically whatever order rows arrive in", () => {
  const a = { people: [{ id: "b", slug: "jason" }, { id: "a", slug: "justin" }] };
  const b = { people: [{ id: "a", slug: "justin" }, { id: "b", slug: "jason" }] };
  assert.equal(canonicalString(a), canonicalString(b));
});

check("and whatever order the object keys arrive in", () => {
  const a = { people: [{ id: "a", slug: "justin", home_country: "US" }] };
  const b = { people: [{ home_country: "US", slug: "justin", id: "a" }] };
  assert.equal(canonicalString(a), canonicalString(b));
});

check("a row with no id is still ordered stably", () => {
  // goal_occasions has no id column; it is keyed by the pair.
  const a = {
    goal_occasions: [
      { goal_id: "g2", occasion_id: "o1", lead_days_override: null },
      { goal_id: "g1", occasion_id: "o1", lead_days_override: 7 },
    ],
  };
  const b = {
    goal_occasions: [
      { occasion_id: "o1", goal_id: "g1", lead_days_override: 7 },
      { occasion_id: "o1", goal_id: "g2", lead_days_override: null },
    ],
  };
  assert.equal(canonicalString(a), canonicalString(b));
});

check("retyping the same rule does NOT change the hash", () => {
  const before = { hotel_brand_rules: [rule()] };
  const after = {
    hotel_brand_rules: [rule({ updated_at: "2027-06-20T12:00:00.000Z" })],
  };
  assert.equal(
    canonicalString(before),
    canonicalString(after),
    "a touched updated_at must not look like a configuration change",
  );
  // And created_at, for a row restored from a backup.
  assert.equal(
    canonicalString(before),
    canonicalString({ hotel_brand_rules: [rule({ created_at: "2099-01-01T00:00:00.000Z" })] }),
  );
  assert.deepEqual(
    [...VOLATILE_COLUMNS],
    ["created_at", "updated_at", "createdAt", "updatedAt"],
    "both spellings must be listed; Drizzle returns camelCase",
  );
});

check("the camelCase spelling Drizzle actually returns is excluded too", () => {
  /**
   * This is the case that was missing, and its absence hid a real bug. Every
   * fixture here used snake_case by hand, while `db.select()` returns
   * `createdAt` and `updatedAt` — so the filter matched nothing against real
   * rows and every snapshot carried its timestamps. Measured 2026-10-25 by
   * planting the removal of the filter and watching this file stay green.
   */
  const camel = (over = {}) => ({
    id: "r-1",
    brand: "Hilton",
    stance: "avoid",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  });
  assert.equal(
    canonicalString({ hotel_brand_rules: [camel()] }),
    canonicalString({ hotel_brand_rules: [camel({ updatedAt: "2099-01-01T00:00:00.000Z" })] }),
    "a touched updatedAt must not look like a configuration change",
  );
  // And the stored payload must not carry them either.
  const stored = canonicalPayload({ hotel_brand_rules: [camel()] });
  assert.deepEqual(
    Object.keys(stored.hotel_brand_rules[0]).filter((key) => /^(created|updated)_?[Aa]t$/.test(key)),
    [],
  );
  // A Date object reaches here from a real row, not just a string.
  const withDate = canonicalPayload({
    hotel_brand_rules: [camel({ updatedAt: new Date("2030-01-01T00:00:00.000Z") })],
  });
  assert.deepEqual(
    Object.keys(withDate.hotel_brand_rules[0]).filter((key) => /^(created|updated)_?[Aa]t$/.test(key)),
    [],
  );
});

check("but changing what a rule SAYS does change it", () => {
  const before = canonicalString({ hotel_brand_rules: [rule()] });
  assert.notEqual(before, canonicalString({ hotel_brand_rules: [rule({ stance: "prefer" })] }));
  assert.notEqual(before, canonicalString({ hotel_brand_rules: [rule({ reason: "changed" })] }));
  assert.notEqual(before, canonicalString({ hotel_brand_rules: [rule({ since: "2025-01-01" })] }));
});

check("a non-volatile timestamp is part of the configuration", () => {
  // A loyalty balance's read date matters: a verdict about affording a seat
  // depended on when the balance was last known.
  const a = { loyalty_accounts: [{ id: "a-1", points_balance: 120000, balance_as_of: "2027-01-01T00:00:00.000Z" }] };
  const b = { loyalty_accounts: [{ id: "a-1", points_balance: 120000, balance_as_of: "2027-06-01T00:00:00.000Z" }] };
  assert.notEqual(canonicalString(a), canonicalString(b));
});

check("adding or removing a row changes it", () => {
  const one = canonicalString({ hotel_brand_rules: [rule()] });
  const two = canonicalString({ hotel_brand_rules: [rule(), rule({ id: "r-2", brand: "Hyatt" })] });
  assert.notEqual(one, two);
  assert.notEqual(one, canonicalString({ hotel_brand_rules: [] }));
});

check("an empty configuration still names every table, so a missing table is visible", () => {
  const rendered = canonicalString({});
  for (const table of SNAPSHOT_TABLES) {
    assert.match(rendered, new RegExp(`^${table}:0$`, "m"), `${table} is missing from the rendering`);
  }
  // A table omitted from the payload and a table that is empty are the same
  // thing, so the two must render identically.
  assert.equal(rendered, canonicalString({ people: [] }));
});

check("the table order is fixed, not the payload's key order", () => {
  const a = canonicalString({ people: [{ id: "p" }], occasions: [{ id: "o" }] });
  const b = canonicalString({ occasions: [{ id: "o" }], people: [{ id: "p" }] });
  assert.equal(a, b);
  // and `people` really does come before `occasions` in the output
  assert.ok(a.indexOf("people:") < a.indexOf("occasions:"));
});

check("the stored payload is canonicalised, so it is what was hashed", () => {
  const stored = canonicalPayload({
    hotel_brand_rules: [rule({ id: "r-2" }), rule({ id: "r-1" })],
  });
  assert.deepEqual(
    stored.hotel_brand_rules.map((row) => row.id),
    ["r-1", "r-2"],
    "stored rows must be sorted",
  );
  for (const row of stored.hotel_brand_rules) {
    assert.ok(!("updated_at" in row), "a stored row must not carry a volatile column");
    assert.ok(!("created_at" in row), "a stored row must not carry a volatile column");
  }
  // Every table is present, so a reader never has to guess whether a table was
  // empty or simply not captured.
  for (const table of SNAPSHOT_TABLES) assert.ok(Array.isArray(stored[table]));
});

// ---------------------------------------------------------------------------
// The diff, which is what makes a past verdict explainable.
// ---------------------------------------------------------------------------

check("an unchanged configuration diffs to nothing", () => {
  const payload = { hotel_brand_rules: [rule()] };
  assert.deepEqual(diffSnapshots(payload, payload), []);
});

check("a changed field is named, with both values", () => {
  const changes = diffSnapshots(
    { hotel_brand_rules: [rule({ stance: "avoid" })] },
    { hotel_brand_rules: [rule({ stance: "prefer" })] },
  );
  assert.equal(changes.length, 1);
  assert.equal(changes[0].table, "hotel_brand_rules");
  assert.equal(changes[0].change, "changed");
  assert.deepEqual(changes[0].fields, [{ field: "stance", before: "avoid", after: "prefer" }]);
});

check("a volatile column alone is NOT reported as a change", () => {
  assert.deepEqual(
    diffSnapshots(
      { hotel_brand_rules: [rule()] },
      { hotel_brand_rules: [rule({ updated_at: "2099-01-01T00:00:00.000Z" })] },
    ),
    [],
  );
});

check("an added and a removed row are each named", () => {
  const added = diffSnapshots({ hotel_brand_rules: [] }, { hotel_brand_rules: [rule()] });
  assert.deepEqual(
    added.map((c) => c.change),
    ["added"],
  );
  const removed = diffSnapshots({ hotel_brand_rules: [rule()] }, { hotel_brand_rules: [] });
  assert.deepEqual(
    removed.map((c) => c.change),
    ["removed"],
  );
  assert.equal(removed[0].row, "id:r-1", "the row must be identifiable");
});

check("several changes across several tables are all reported", () => {
  const changes = diffSnapshots(
    {
      hotel_brand_rules: [rule()],
      travel_windows: [{ id: "w-1", label: "December", stance: "frowned" }],
    },
    {
      hotel_brand_rules: [rule({ stance: "prefer" })],
      travel_windows: [{ id: "w-1", label: "December", stance: "neutral" }],
      home_airports: [{ id: "a-1", code: "SFO" }],
    },
  );
  assert.equal(changes.length, 3);
  assert.deepEqual(
    changes.map((c) => `${c.table}:${c.change}`).sort(),
    ["home_airports:added", "hotel_brand_rules:changed", "travel_windows:changed"],
  );
});

check("a field present on one side only is reported, not dropped", () => {
  const changes = diffSnapshots(
    { people: [{ id: "p-1", slug: "jason" }] },
    { people: [{ id: "p-1", slug: "jason", home_country: "Singapore" }] },
  );
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0].fields, [
    { field: "home_country", before: null, after: "Singapore" },
  ]);
});

console.log(`selfcheck-config-snapshot: ok (${passed} checks)`);
