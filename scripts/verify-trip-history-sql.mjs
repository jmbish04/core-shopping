/**
 * Run `daysSinceLastTrip` against the REAL database, with rows seeded inside a
 * transaction that is rolled back (maestro cs-be-1-6).
 *
 * `calendar_checks.days_since_last_trip` has had no writer since cs-be-1-4.
 * This is its source, and it is the only way the brief's gate — "enough time
 * has passed since our last vacation or trip or time off" — can be evaluated.
 *
 * An empty `trip_history` answers "no trip on record" however wrong the query
 * is, so the fixture is built to make every wrong answer visible:
 *
 * - a HOUSEHOLD trip and a PERSON-ONLY trip, with the person-only one MORE
 *   RECENT, so a query that ignores `person_id` reports Jason's solo trip as
 *   the household's and under-counts the days by 30
 * - TWO household trips, so a query that orders ascending returns the older one
 * - a FUTURE trip, so a query that drops the `ended_on <= as_of` bound returns
 *   a trip that has not happened
 * - a trip ending exactly ON `as_of`, so a strict `<` bound reports the
 *   previous trip instead of zero days — the one case the gate exists to catch
 * - an `as_of` before every trip, so "no trip on record" is reached and must
 *   come back as null with a reason rather than 0
 *
 * Needs the LAN and the owner password, so it is NOT part of `pnpm run
 * selfcheck`. Run it with `pnpm run verify:trip-history`.
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
const { requireSecret } = await import("./tokens.mjs");
const { daysSinceLastTrip } = await import("../src/backend/pg/queries/trip-history.ts");
const { TripHistoryInputSchema, LoyaltyAccountInputSchema, PreferencesInputSchema } = await import(
  "../src/shared/contracts/config.ts"
);

const TOKEN = `vth${Date.now().toString(36)}`;
const JASON = "fa000000-0000-4000-8000-000000000001";
const JUSTIN = "fa000000-0000-4000-8000-000000000002";
const T = (n) => `fb000000-0000-4000-8000-00000000000${n}`;

const AS_OF = "2026-10-25";

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

let rolledBack = false;
try {
  await client.query("begin");

  await client.query(
    `insert into people (id, slug, display_name, relationship, home_country) values
       ($1, $3, 'Jason', 'spouse', 'Singapore'),
       ($2, $4, 'Justin', 'self', 'United States')`,
    [JASON, JUSTIN, `${TOKEN}-jason`, `${TOKEN}-justin`],
  );

  await client.query(
    `insert into trip_history (id, label, destination, started_on, ended_on, kind, person_id) values
       ($1, 'household, older',  'Mexico City', '2026-05-20', '2026-06-01', 'vacation', null),
       ($2, 'household, newer',  'Vancouver',   '2026-08-24', '2026-09-01', 'vacation', null),
       ($3, 'Jason solo home',   'Singapore',   '2026-09-18', '2026-10-01', 'family',   $5),
       ($4, 'not yet taken',     'Taipei',      '2026-12-10', '2026-12-20', 'vacation', null)`,
    [T(1), T(2), T(3), T(4), JASON],
  );

  const household = await daysSinceLastTrip(db, { asOf: AS_OF });
  const jason = await daysSinceLastTrip(db, { asOf: AS_OF, personId: JASON });
  const justin = await daysSinceLastTrip(db, { asOf: AS_OF, personId: JUSTIN });

  // 2026-09-01 -> 2026-10-25 is 54 days.
  check("the household's clock reads its own most recent trip", household.days, 54);
  check("and names it", household.last_trip?.label, "household, newer");
  // 2026-10-01 -> 2026-10-25 is 24 days.
  check("Jason's own solo trip counts for Jason", jason.days, 24);
  check("and names it", jason.last_trip?.label, "Jason solo home");
  check("Jason's solo trip does NOT reset Justin's clock", justin.days, 54);
  check("so Justin reads the household trip", justin.last_trip?.label, "household, newer");
  check(
    "a future trip is never the answer to 'how long since'",
    [household.last_trip?.destination, justin.last_trip?.destination],
    ["Vancouver", "Vancouver"],
  );
  check("the days are a number, not a string", typeof household.days, "number");

  // A trip that ends ON as_of must read zero days, not the previous trip's 54.
  await client.query(
    `insert into trip_history (label, destination, started_on, ended_on, kind, person_id)
     values ('landed this morning', 'Honolulu', '2026-10-18', $1, 'vacation', null)`,
    [AS_OF],
  );
  const justLanded = await daysSinceLastTrip(db, { asOf: AS_OF });
  check("a trip ending today reads 0 days, not the trip before it", justLanded.days, 0);
  check("and names it", justLanded.last_trip?.label, "landed this morning");

  // Before every trip there is nothing to report, and nothing is not zero.
  const nothingYet = await daysSinceLastTrip(db, { asOf: "2026-01-01" });
  check("no trip on record reports null, never 0", nothingYet.days, null);
  check("and says what is missing", nothingYet.reason, "no_trip_on_record");
  check("with no trip attached", nothingYet.last_trip, null);

  // The contracts refuse the shapes the schema cannot express.
  check(
    "a trip that ends before it starts is refused",
    TripHistoryInputSchema.safeParse({
      label: "backwards",
      started_on: "2026-06-10",
      ended_on: "2026-06-01",
    }).success,
    false,
  );
  check(
    "a points balance with no measurement date is refused",
    LoyaltyAccountInputSchema.safeParse({
      person_id: JASON,
      program_id: JUSTIN,
      points_balance: 120_000,
    }).success,
    false,
  );
  check(
    "a points balance WITH a measurement date is accepted",
    LoyaltyAccountInputSchema.safeParse({
      person_id: JASON,
      program_id: JUSTIN,
      points_balance: 120_000,
      balance_as_of: "2026-10-25T00:00:00Z",
    }).success,
    true,
  );
  check(
    "an unmeasured account is accepted and stays null",
    LoyaltyAccountInputSchema.parse({ person_id: JASON, program_id: JUSTIN }).points_balance ?? null,
    null,
  );
  check(
    "a minimum trip longer than the maximum is refused",
    PreferencesInputSchema.safeParse({ min_trip_nights: 30, max_trip_nights: 10 }).success,
    false,
  );
  check(
    "the household defaults parse, so the settings page has real starting values",
    PreferencesInputSchema.parse({}).min_days_since_last_trip,
    120,
  );
} finally {
  await client.query("rollback");
  rolledBack = true;
  const left = await client.query(
    `select (select count(*)::int from people where slug like 'vth%')
          + (select count(*)::int from trip_history where id::text like 'fb000000-%')
          + (select count(*)::int from trip_history where destination = 'Honolulu') as n`,
  );
  console.log(`\nrolled back: ${rolledBack}; seeded rows left in the database: ${left.rows[0].n}`);
  assert.equal(left.rows[0].n, 0, "the transaction must leave nothing behind");
  await client.end();
}

if (fails.length) {
  console.error(`\n${fails.length} check(s) failed:\n - ${fails.join("\n - ")}`);
  process.exit(1);
}
console.log("\nverify-trip-history-sql: ok");
