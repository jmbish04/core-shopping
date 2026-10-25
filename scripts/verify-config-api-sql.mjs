/**
 * Run the config API's REAL queries against the REAL database, with rows
 * seeded inside a transaction that is rolled back (maestro cs-be-2-8).
 *
 * Nothing here is provable on an empty table. A filter, a group, a sort and a
 * search all answer the same empty page whether the compiler is right or
 * wrong; a bulk save's `replace` mode deletes nothing when there is nothing to
 * delete; and a PATCH's cross-field rule cannot fire without a stored row to
 * merge onto. So the fixture is built to make every wrong answer visible:
 *
 * - THREE travel windows with three DIFFERENT stances and three different
 *   dates, so a filter that matches everything, a sort that ignores its field
 *   and a group that counts the whole table all fail
 * - a row whose `reason` holds the search term but whose `label` does not, so
 *   a search that reads only the first column fails
 * - a bulk save in `upsert` mode with one row left out, so a mode that deletes
 *   unconditionally fails
 * - a bulk save naming an id the table does not have, so an applier that
 *   silently inserts it under that id fails — and the surrounding rows must be
 *   unchanged afterwards, so an applier that writes before it checks fails
 * - a PATCH that sends only the LOW side of a pair, against a stored row whose
 *   HIGH side it would cross, so a patch validated without the stored row fails
 * - preferences read before anything is stored, so a reader that reports an
 *   empty table as saved choices fails
 *
 * NEVER wrap this in a manual `begin` and then call `db.transaction()` inside
 * it. Drizzle's node-postgres transaction issues `BEGIN` and `COMMIT` at the
 * top level, not a savepoint, so its COMMIT commits the surrounding manual
 * transaction and the closing `rollback` has nothing left to undo. Measured
 * here on 2026-10-25: five fixture rows reached the real database that way,
 * and the leftover assertion is the only reason it was noticed. The outer
 * transaction is therefore `db.transaction` itself, rolled back by throwing
 * ROLLBACK, and a nested `tx.transaction()` does use a savepoint — which is
 * what makes the missing-id rollback below a real test.
 *
 * Needs the LAN and the owner password, so it is NOT part of `pnpm run
 * selfcheck`. Run it with `pnpm run verify:config-api`.
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

const { Client } = await import("pg");
const { drizzle } = await import("drizzle-orm/node-postgres");
const { sql } = await import("drizzle-orm");
const { requireSecret } = await import("./tokens.mjs");
const { listConfig, applyBulk, readPreferences, validateBulkItems, BulkRowMissing } = await import(
  "../src/backend/api/routes/config/index.ts"
);
const { specFor, toWire, toRow } = await import("../src/backend/api/routes/config/resources.ts");
const { ListQuerySchema } = await import("../src/shared/contracts/common.ts");
const { PreferencesInputSchema } = await import("../src/shared/contracts/config.ts");

const TOKEN = `vca${Date.now().toString(36)}`;
const W = (n) => `fc000000-0000-4000-8000-00000000000${n}`;
const GHOST = "fc000000-0000-4000-8000-0000000000ff";

const client = new Client({
  host: process.env.PGHOST ?? "192.168.1.50",
  port: 5432,
  user: "core_shopping_owner",
  database: "core_shopping",
  password: process.env.PG_OWNER_PW || requireSecret("CORE_SHOPPING_PG_OWNER_PASSWORD"),
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const db = drizzle(client);

const fails = [];
function check(label, actual, expected) {
  try {
    assert.deepEqual(actual, expected);
    console.log(`  ok   ${label}`);
  } catch {
    fails.push(label);
    console.log(
      `  BAD  ${label}\n         got ${JSON.stringify(actual)}  want ${JSON.stringify(expected)}`,
    );
  }
}

const windows = specFor("travel-windows");
const people = specFor("people");
const accounts = specFor("loyalty-accounts");
assert.ok(windows && people && accounts, "a resource the verify needs is not declared");

const rule = (id, path, operator, value) => ({ id, type: "rule", path, operator, value });
const group = (id, combinator, rules) => ({ id, type: "group", combinator, rules });
const q = (extra = {}) => ListQuerySchema.parse({ page_size: 100, ...extra });
const filtered = (tree, extra = {}) => q({ filter: JSON.stringify(tree), ...extra });

const ROLLBACK = Symbol("rollback");

try {
  await db.transaction(async (tx) => {
  // Three stances, three date ranges. The frowned row carries the search term
  // in `reason` only, so a search that reads just the label misses it.
  await tx.execute(sql`
    insert into travel_windows (id, label, stance, starts_on, ends_on, recurs_yearly, reason) values
      (${W(1)}, ${`${TOKEN} spring`},   'ideal',   '2027-03-20', '2027-04-10', true,  'cherry blossom'),
      (${W(2)}, 'December',             'frowned', '2027-12-01', '2027-12-31', true,  ${`${TOKEN} year end crush`}),
      (${W(3)}, ${`${TOKEN} shoulder`}, 'neutral', '2027-06-01', '2027-06-30', false, 'persuade me')
  `);

  // --- the shared list engine, driven through the real route function -------

  const all = await listConfig(tx, windows, q({ q: TOKEN }));
  check("the list returns the seeded rows", all.total, 3);
  check(
    "and in the resource's own order, earliest window first",
    all.items.map((r) => r.stance),
    ["ideal", "neutral", "frowned"],
  );

  const onlyFrowned = await listConfig(
    db,
    windows,
    filtered(group("root", "and", [rule("r", ["stance"], "is", "frowned")]), { q: TOKEN }),
  );
  check("a filter on stance returns only that stance", onlyFrowned.total, 1);
  check("and the right row", onlyFrowned.items[0]?.label, "December");

  const recurring = await listConfig(
    db,
    windows,
    filtered(group("root", "and", [rule("r", ["recurs_yearly"], "is", true)]), { q: TOKEN }),
  );
  check("a boolean filter works, and the one-off window is excluded", recurring.total, 2);

  const newestFirst = await listConfig(tx, windows, q({ q: TOKEN, sort: "-starts_on" }));
  check(
    "a descending sort on a date reverses the order",
    newestFirst.items.map((r) => r.starts_on),
    ["2027-12-01", "2027-06-01", "2027-03-20"],
  );

  const grouped = await listConfig(tx, windows, q({ q: TOKEN, group_by: "stance" }));
  check(
    "grouping by stance counts each one",
    Object.fromEntries((grouped.groups ?? []).map((g) => [g.key, g.count])),
    { frowned: 1, ideal: 1, neutral: 1 },
  );

  const bySearch = await listConfig(tx, windows, q({ q: "year end crush" }));
  check("the search reads the reason, not just the label", bySearch.total, 1);
  check("and finds the row whose label does not match", bySearch.items[0]?.label, "December");

  const badField = await listConfig(tx, windows, filtered(group("r", "and", [rule("x", ["secret"], "is", 1)])))
    .then(() => "accepted")
    .catch((error) => error.name);
  check("an undeclared filter field is refused, not ignored", badField, "ListQueryError");

  // --- the derived row/wire mapping ----------------------------------------

  const mapped = toWire(people.table, { homeCountry: "Singapore", isActive: true, createdAt: null });
  check(
    "the wire shape is derived from the column names",
    [mapped.home_country, mapped.is_active],
    ["Singapore", true],
  );
  check("a null stays null rather than becoming a default", mapped.created_at, null);
  check(
    "a round trip through toRow restores the property names",
    toRow(people.table, { home_country: "Singapore" }),
    { homeCountry: "Singapore" },
  );
  check(
    "toRow copies only what the caller sent, so a patch touches nothing else",
    Object.keys(toRow(people.table, { display_name: "Jason" })),
    ["displayName"],
  );

  // --- bulk save: upsert leaves what it was not told about -----------------

  const upserted = await applyBulk(tx, windows, {
      mode: "upsert",
      items: [
        { id: W(1), label: `${TOKEN} spring`, stance: "ideal", starts_on: "2027-03-25", ends_on: "2027-04-15", recurs_yearly: true, reason: "cherry blossom" },
        { label: `${TOKEN} added`, stance: "neutral", starts_on: "2027-09-01", ends_on: "2027-09-20", recurs_yearly: false, reason: "" },
      ],
  });
  check("an upsert updates and inserts", [upserted.updated, upserted.created], [1, 1]);
  check("and deletes nothing", upserted.deleted, 0);
  const afterUpsert = await listConfig(tx, windows, q({ q: TOKEN }));
  check("so the rows it was not told about survive", afterUpsert.total, 4);
  check(
    "and the update landed",
    afterUpsert.items.find((r) => r.id === W(1))?.starts_on,
    "2027-03-25",
  );

  // --- bulk save: replace deletes what it was not told about ---------------

  const replaced = await applyBulk(tx, windows, {
      mode: "replace",
      items: [
        { id: W(2), label: "December", stance: "frowned", starts_on: "2027-12-01", ends_on: "2027-12-31", recurs_yearly: true, reason: `${TOKEN} year end crush` },
      ],
  });
  check("a replace keeps the one row it was given", replaced.updated, 1);
  check("and deletes the other three", replaced.deleted, 3);
  const afterReplace = await listConfig(tx, windows, q({ q: TOKEN }));
  check("so only that row is left", afterReplace.total, 1);

  // --- bulk save: an id the table does not have ---------------------------

  const before = await listConfig(tx, windows, q({ q: TOKEN }));
  let ghostError = "accepted";
  try {
    // A NESTED drizzle transaction issues a savepoint, so the insert this batch
    // makes before it hits the bad id must disappear with it.
    await tx.transaction((inner) =>
      applyBulk(inner, windows, {
        mode: "upsert",
        items: [
          { label: `${TOKEN} would be new`, stance: "ideal", starts_on: "2028-01-01", ends_on: "2028-01-10" },
          { id: GHOST, label: "resurrected", stance: "ideal", starts_on: "2028-02-01", ends_on: "2028-02-10" },
        ],
      }),
    );
  } catch (error) {
    ghostError = error instanceof BulkRowMissing ? "BulkRowMissing" : error.name;
  }
  check("an item naming a missing row is refused", ghostError, "BulkRowMissing");
  const after = await listConfig(tx, windows, q({ q: TOKEN }));
  check(
    "and the row it had already inserted is rolled back with it",
    after.total,
    before.total,
  );

  // --- validation reports a path per field, with the item's index ----------

  const bad = validateBulkItems(windows, [
    { label: "fine", stance: "ideal", starts_on: "2027-01-01", ends_on: "2027-01-10" },
    { label: "backwards", stance: "ideal", starts_on: "2027-05-10", ends_on: "2027-05-01" },
    { label: "", stance: "nonsense", starts_on: "2027-01-01", ends_on: "2027-01-10" },
  ]);
  check("a bad batch is refused", "issues" in bad, true);
  check(
    "and names the index and the field of the row that ends before it starts",
    bad.issues?.some((i) => i.path === "items.1.ends_on"),
    true,
  );
  check(
    "and names the bad enum on the third row",
    bad.issues?.some((i) => i.path === "items.2.stance"),
    true,
  );
  check(
    "and the valid first row is not reported",
    bad.issues?.some((i) => i.path.startsWith("items.0")),
    false,
  );
  check(
    "a non-uuid id is refused by path",
    validateBulkItems(windows, [{ id: "not-a-uuid", label: "x", stance: "ideal", starts_on: "2027-01-01", ends_on: "2027-01-02" }]).issues?.[0]?.path,
    "items.0.id",
  );

  // --- preferences: one household row, and absence is stated --------------

  const beforeSave = await readPreferences(tx);
  check("preferences read before anything is stored says so", beforeSave.persisted, false);
  check("and reports no id rather than inventing one", beforeSave.id, null);
  check(
    "while still giving the settings page real values",
    beforeSave.min_days_since_last_trip,
    120,
  );

  const values = toRow(
    (await import("../src/backend/pg/schemas/config/people.ts")).preferences,
    PreferencesInputSchema.parse({ min_trip_nights: 12, max_trip_nights: 24 }),
  );
  await tx.execute(sql`
    insert into preferences (scope, min_trip_nights, max_trip_nights)
    values ('household', ${values.minTripNights}, ${values.maxTripNights})
  `);
  const afterSave = await readPreferences(tx);
  check("once stored, the read says persisted", afterSave.persisted, true);
  check("and returns what was saved", [afterSave.min_trip_nights, afterSave.max_trip_nights], [12, 24]);

  // The cross-field rule must survive a patch that sends only one side.
  const { persisted, id, scope, updated_at, ...storedFields } = afterSave;
  check(
    "a patch raising the minimum past the stored maximum is refused",
    PreferencesInputSchema.safeParse({ ...storedFields, min_trip_nights: 30 }).success,
    false,
  );
  check(
    "and the refusal names the field",
    PreferencesInputSchema.safeParse({ ...storedFields, min_trip_nights: 30 })
      .error?.issues[0]?.path.join("."),
    "min_trip_nights",
  );
  check(
    "a patch inside the stored bounds is accepted",
    PreferencesInputSchema.safeParse({ ...storedFields, min_trip_nights: 14 }).success,
    true,
  );

  // --- an unmeasured balance survives the whole round trip ----------------

  const [person] = (
    await tx.execute(sql`
      insert into people (slug, display_name, relationship)
      values (${`${TOKEN}-probe`}, 'Probe', 'other') returning id
    `)
  ).rows;
  const [program] = (
    await tx.execute(sql`
      insert into loyalty_programs (code, name, kind)
      values (${`${TOKEN}-miles`}, 'Probe Miles', 'airline') returning id
    `)
  ).rows;
  await tx.execute(sql`
    insert into loyalty_accounts (person_id, program_id) values (${person.id}, ${program.id})
  `);
  const accountPage = await listConfig(tx, accounts, q());
  const probeAccount = accountPage.items.find((r) => r.person_id === person.id);
  check("an unmeasured balance reaches the wire as null, not 0", probeAccount?.points_balance, null);
  check("and so does its read date", probeAccount?.balance_as_of, null);

    throw ROLLBACK;
  });
} catch (error) {
  if (error !== ROLLBACK) {
    console.error(error);
    fails.push(`the fixture threw: ${error instanceof Error ? error.message : String(error)}`);
  }
} finally {
  const left = await client.query(
    `select (select count(*)::int from travel_windows where id::text like 'fc000000-%' or label like 'vca%')
          + (select count(*)::int from people where slug like 'vca%')
          + (select count(*)::int from loyalty_programs where code like 'vca%')
          + (select count(*)::int from preferences where scope = 'household' and min_trip_nights = 12) as n`,
  );
  console.log(`\nrolled back; seeded rows left in the database: ${left.rows[0].n}`);
  assert.equal(left.rows[0].n, 0, "the transaction must leave nothing behind");
  await client.end();
}

if (fails.length) {
  console.error(`\n${fails.length} check(s) failed:\n - ${fails.join("\n - ")}`);
  process.exit(1);
}
console.log("\nverify-config-api-sql: ok");
