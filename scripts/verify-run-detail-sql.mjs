/**
 * Run the Run detail's REAL query against the REAL database, with rows seeded
 * inside a transaction that is rolled back (maestro cs-fe-10-2).
 *
 * Production runs have no sightings or proposals yet, so `/api/runs/{id}`
 * answers empty lists whether the correlation to the outer run is right or
 * wrong. This seeds a run with goals, events, sightings and proposals, plus a
 * SECOND run with its own rows, and checks the detail returns exactly the
 * first run's rows. A subquery that binds to the inner table (the bug fixed in
 * PR #13) returns nothing or the wrong run's rows, and fails here.
 *
 * Needs the LAN and the owner password, so it is NOT part of `pnpm run
 * selfcheck`. Run it with `pnpm run verify:run-detail`.
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

const { Client } = await import("pg");
const { drizzle } = await import("drizzle-orm/node-postgres");
const { requireSecret } = await import("./tokens.mjs");
const { loadRunDetail } = await import("../src/backend/api/routes/shopping/runs.ts");

const G1 = "f6000000-0000-4000-8000-000000000001";
const G2 = "f6000000-0000-4000-8000-000000000002";
const R1 = "f7000000-0000-4000-8000-000000000001";
const R2 = "f7000000-0000-4000-8000-000000000002";
const E1 = "f8000000-0000-4000-8000-000000000001";
const S = (n) => `f9000000-0000-4000-8000-00000000000${n}`;
const P = (n) => `fa000000-0000-4000-8000-00000000000${n}`;

const client = new Client({
  host: process.env.PGHOST ?? "192.168.1.50",
  port: 5432,
  user: "core_shopping_owner",
  database: "core_shopping",
  password: requireSecret("CORE_SHOPPING_PG_OWNER_PASSWORD"),
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

try {
  await client.query("begin");
  await client.query(
    `insert into goals (id, slug, title, category, status) values
       ($1,'vrd-goal-b','VRD goal B','product','active'),
       ($2,'vrd-goal-a','VRD goal A','travel','active')`,
    [G1, G2],
  );
  for (const r of [R1, R2]) {
    await client.query(
      `insert into agent_runs (id, client, model, status, summary, started_at, finished_at)
       values ($1,'browser','core-browser','succeeded','vrd',now() - interval '5 minutes', now())`,
      [r],
    );
  }
  await client.query(`insert into run_goals (run_id, goal_id) values ($1,$2),($1,$3),($4,$2)`, [R1, G1, G2, R2]);
  await client.query(
    `insert into run_events (run_id, at, level, kind, message) values
       ($1, now() - interval '2 minutes', 'info', 'browser.ai_decision', 'second'),
       ($1, now() - interval '4 minutes', 'info', 'browser.job', 'first'),
       ($2, now(), 'error', 'browser.job', 'other run')`,
    [R1, R2],
  );
  await client.query(
    `insert into entities (id, kind, fingerprint, title) values ($1,'product','vrd-fp-1','VRD entity')`,
    [E1],
  );
  await client.query(
    `insert into sightings (id, entity_id, run_id, goal_id, url, title, price_cents, currency, agent_score, is_resighting, seen_at) values
       ($1,$4,$5,$6,'https://shop.example/a','Second sighting',12999,'USD',0.8,true, now() - interval '1 minute'),
       ($2,$4,$5,$6,null,'First sighting',null,null,null,false, now() - interval '3 minutes'),
       ($3,$4,$7,$6,null,'Other run sighting',100,'USD',null,false, now())`,
    [S(1), S(2), S(3), E1, R1, G1, R2],
  );
  await client.query(
    `insert into proposals (id, goal_id, run_id, title, match_score) values
       ($1,$3,$4,'VRD proposal',0.75),
       ($2,$3,$5,'Other run proposal',null)`,
    [P(1), P(2), G1, R1, R2],
  );

  const d = await loadRunDetail(db, R1);
  check("goals carry titles, in goal_ids order", d.goals, [
    { id: G1, title: "VRD goal B" },
    { id: G2, title: "VRD goal A" },
  ]);
  check("goal_ids and goals agree", d.goal_ids, d.goals.map((g) => g.id));
  check("events belong to this run only, oldest first", d.events.map((e) => e.message), ["first", "second"]);
  check("sightings belong to this run only, oldest first", d.sightings.map((s) => s.title), [
    "First sighting",
    "Second sighting",
  ]);
  const second = d.sightings[1];
  check(
    "a sighting carries its price, score, url and re-sighting flag",
    [second.price_cents, second.currency, second.agent_score, second.url, second.is_resighting, second.entity_id],
    [12999, "USD", 0.8, "https://shop.example/a", true, E1],
  );
  check("an unpriced sighting stays null, not 0", [d.sightings[0].price_cents, d.sightings[0].agent_score], [null, null]);
  check("seen_at is an ISO string", typeof second.seen_at === "string" && second.seen_at.endsWith("Z"), true);
  check("proposals belong to this run only", d.proposals.map((p) => [p.title, p.kind, p.status, p.match_score]), [
    ["VRD proposal", "item", "queued", 0.75],
  ]);
  check("the id lists still match the rich lists", [d.sighting_ids, d.proposal_ids], [[S(2), S(1)], [P(1)]]);

  const other = await loadRunDetail(db, R2);
  check("the other run sees one goal, one sighting, one proposal", [other.goals.length, other.sightings.length, other.proposals.length], [1, 1, 1]);
  check("an unknown run is null", await loadRunDetail(db, "f7000000-0000-4000-8000-0000000000ff"), null);
} finally {
  await client.query("rollback");
  const left = await client.query(
    "select (select count(*)::int from goals where slug like 'vrd-%') + (select count(*)::int from agent_runs where id::text like 'f7000000-%') + (select count(*)::int from entities where fingerprint like 'vrd-%') as n",
  );
  console.log(`\nseeded rows left in the database: ${left.rows[0].n}`);
  assert.equal(left.rows[0].n, 0, "the transaction must leave nothing behind");
  await client.end();
}

if (fails.length) {
  console.error(`\n${fails.length} check(s) failed:\n - ${fails.join("\n - ")}`);
  process.exit(1);
}
console.log("\nverify-run-detail-sql: ok");
