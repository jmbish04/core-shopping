/**
 * Run the Goals list's REAL query against the REAL database, with rows seeded
 * inside a transaction that is rolled back (maestro `067a29e7ed5b`).
 *
 * `runs_count` and `findings_count` are correlated subselects. Drizzle writes a
 * bare `"id"` for a column of the subselect's own single table, so
 * `${goals.id}` inside `select ... from sightings` bound to `sightings.id` and
 * the predicate compared a goal id with a sighting id: always 0. An empty
 * `sightings` table answers 0 either way, which is why this seeds rows.
 *
 * The fixture is built so every wrong answer is visible:
 * - TWO goals with DIFFERENT counts, so a query that returns one goal's numbers
 *   for both fails
 * - one goal has THREE sightings of TWO entities, so `count(*)` instead of
 *   `count(distinct entity_id)` fails
 * - one goal has NO sightings and NO runs, so a correlation that leaks the
 *   other goal's rows fails
 * - a sighting with a NULL `goal_id` exists, so a predicate that drops the
 *   `where` fails
 *
 * Needs the LAN and the owner password, so it is NOT part of `pnpm run
 * selfcheck`. Run it with `pnpm run verify:goal-counts`.
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
const { listGoals } = await import("../src/backend/api/routes/shopping/goals.ts");
const { ListQuerySchema } = await import("../src/shared/contracts/common.ts");

const TOKEN = `vgc${Date.now().toString(36)}`;
const G1 = "f6000000-0000-4000-8000-000000000001";
const G2 = "f6000000-0000-4000-8000-000000000002";
const E = (n) => `f7000000-0000-4000-8000-00000000000${n}`;
const R = (n) => `f8000000-0000-4000-8000-00000000000${n}`;

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
    console.log(`  BAD  ${label}\n         got ${JSON.stringify(actual)}  want ${JSON.stringify(expected)}`);
  }
}

let rolledBack = false;
try {
  await client.query("begin");

  await client.query(
    `insert into goals (id, slug, title, category, status) values
       ($1, 'vgc-goal-one', $3, 'experience', 'active'),
       ($2, 'vgc-goal-two', $4, 'travel', 'active')`,
    [G1, G2, `${TOKEN} one`, `${TOKEN} two`],
  );

  // Two entities, so count(*) over three sightings is visibly wrong.
  await client.query(
    `insert into entities (id, kind, fingerprint, title) values
       ($1, 'event', $4, 'VGC entity one'),
       ($2, 'event', $5, 'VGC entity two'),
       ($3, 'product', $6, 'VGC entity three')`,
    [E(1), E(2), E(3), `vgc:fp-1-${TOKEN}`, `vgc:fp-2-${TOKEN}`, `vgc:fp-3-${TOKEN}`],
  );

  await client.query(
    `insert into agent_runs (id, client, status) values
       ($1, 'claude', 'succeeded'), ($2, 'claude', 'succeeded'), ($3, 'browser', 'failed')`,
    [R(1), R(2), R(3)],
  );
  // Goal one has three runs; goal two has none.
  await client.query(
    `insert into run_goals (run_id, goal_id) values ($1,$4), ($2,$4), ($3,$4)`,
    [R(1), R(2), R(3), G1],
  );

  await client.query(
    `insert into sightings (entity_id, goal_id, title) values
       ($1, $4, 'first sighting of entity one'),
       ($1, $4, 'second sighting of entity one'),
       ($2, $4, 'only sighting of entity two'),
       ($3, null, 'a sighting that belongs to no goal')`,
    [E(1), E(2), E(3), G1],
  );

  const page = await listGoals(db, ListQuerySchema.parse({ q: TOKEN, sort: "title" }));
  const rows = page.items;
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

  check("both seeded goals are returned", rows.length, 2);
  check(
    "findings_count counts DISTINCT entities of that goal",
    byId[G1]?.findings_count,
    2,
  );
  check("runs_count counts that goal's runs", byId[G1]?.runs_count, 3);
  check("a goal with no sightings reports 0, not the other goal's count", byId[G2]?.findings_count, 0);
  check("a goal with no runs reports 0", byId[G2]?.runs_count, 0);
  check(
    "the counts are numbers, not strings",
    [typeof byId[G1]?.findings_count, typeof byId[G1]?.runs_count],
    ["number", "number"],
  );
  // The goal-less sighting must not reach either goal: 2 + 0 = 2, not 3.
  check(
    "a sighting with no goal reaches neither goal",
    (byId[G1]?.findings_count ?? 0) + (byId[G2]?.findings_count ?? 0),
    2,
  );
} finally {
  await client.query("rollback");
  rolledBack = true;
  const left = await client.query(
    `select (select count(*)::int from goals where slug like 'vgc-%')
          + (select count(*)::int from entities where id::text like 'f7000000-%')
          + (select count(*)::int from agent_runs where id::text like 'f8000000-%') as n`,
  );
  console.log(`\nrolled back: ${rolledBack}; seeded rows left in the database: ${left.rows[0].n}`);
  assert.equal(left.rows[0].n, 0, "the transaction must leave nothing behind");
  await client.end();
}

if (fails.length) {
  console.error(`\n${fails.length} check(s) failed:\n - ${fails.join("\n - ")}`);
  process.exit(1);
}
console.log("\nverify-goal-counts-sql: ok");
