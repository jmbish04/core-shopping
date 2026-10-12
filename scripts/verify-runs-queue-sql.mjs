/**
 * Run the Runs queue's REAL list query against the REAL database, with runs
 * seeded inside a transaction that is rolled back (maestro cs-fe-10-1).
 *
 * `scripts/selfcheck-runs-queue.mjs` pins that each attention option compiles
 * to the intended SQL. This pins what that SQL RETURNS, which is the half a
 * live probe cannot speak to: `agent_runs` is empty in production, so
 * `/api/runs` answers `[]` whether the filters, the run_goals join and the
 * status grouping are right or wrong.
 *
 * The query goes through exactly the wire path: the toolbar state becomes URL
 * parameters (`buildListParams`), those are parsed by the route's own schema
 * (`ListQuerySchema`) and handed to the route's own `listRuns`.
 *
 * Every query searches a token unique to this run, so whatever real rows exist
 * cannot be counted. The token sits in the seeded runs' SUMMARY, which also
 * proves `?q=` reaches the summary column.
 *
 * Needs the LAN and the owner password, so it is NOT part of `pnpm run
 * selfcheck`. Run it with `pnpm run verify:runs`.
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
const { listRuns } = await import("../src/backend/api/routes/shopping/runs.ts");
const { ListQuerySchema } = await import("../src/shared/contracts/common.ts");
const { buildListParams } = await import("../src/frontend/lib/list-query.ts");
const { runQueueFilter, buildRunRows } = await import("../src/frontend/components/runs/run-rows.ts");

const TOKEN = `vrq${Date.now().toString(36)}`;
const MODEL_TOKEN = `vrqm${Date.now().toString(36)}`;
const G1 = "f4000000-0000-4000-8000-000000000001";
const G2 = "f4000000-0000-4000-8000-000000000002";
const R = (n) => `f5000000-0000-4000-8000-00000000000${n}`;

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

/** The queue's toolbar state, sent the way the browser sends it. */
async function queue(view, q = TOKEN) {
  const params = buildListParams({ q, filter: runQueueFilter({ attention: [], ...view }), group_by: "status" });
  return listRuns(db, ListQuerySchema.parse(params));
}
const ids = (env) => env.items.map((r) => r.id).sort();
const short = (list) => list.map((id) => `R${id.slice(-1)}`);

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
       ($1,'vrq-goal-one','VRQ goal one','product','active'),
       ($2,'vrq-goal-two','VRQ goal two','travel','active')`,
    [G1, G2],
  );
  // status, client, score, goals — each row exists to make one wrong answer visible.
  const seeds = [
    [1, "running", "claude", null, [G1]],        // running: no score, not "unscored"
    [2, "failed", "gpt", null, [G1]],            // failed: no score, not "unscored"
    [3, "succeeded", "claude", 0.9, [G2]],       // good run: in no attention bucket
    [4, "succeeded", "gemini", 0.3, [G2]],       // low quality
    [5, "succeeded", "claude", null, [G1, G2]],  // unscored, and two goals: the join must not double it
    [6, "abandoned", "other", 0.2, []],          // low quality, and no goal at all
    [7, "succeeded", "claude", 0.5, [G1]],       // exactly at the threshold: NOT low quality
  ];
  for (const [n, status, agent, score, goals] of seeds) {
    await client.query(
      `insert into agent_runs (id, client, model, status, summary, quality_score, started_at, finished_at, error)
       values ($1,$2,'m',$3,$4,$5,$6,$7,$8)`,
      [
        R(n), agent, status, `Looked for laptops ${TOKEN}`, score,
        new Date(Date.now() - n * 600_000),
        status === "running" ? null : new Date(),
        status === "failed" ? "boom" : null,
      ],
    );
    for (const g of goals) await client.query(`insert into run_goals (run_id, goal_id) values ($1,$2)`, [R(n), g]);
  }
  await client.query(
    `insert into agent_runs (id, client, model, status, summary) values ($1,'gpt',$2,'succeeded','no token here')`,
    [R(8), `model-${MODEL_TOKEN}`],
  );

  console.log(`token ${TOKEN}\n`);
  const all = await queue({});
  check("search on the summary finds all seven seeded runs", short(ids(all)), short([1, 2, 3, 4, 5, 6, 7].map(R)));
  check("total counts DISTINCT runs: the two-goal run is not counted twice", all.total, 7);
  check("groups arrive in triage order with whole-set counts", all.groups.map((g) => [g.key, g.count]),
    [["running", 1], ["failed", 1], ["succeeded", 4], ["abandoned", 1]]);
  check("the two-goal run keeps both goals through the join",
    all.items.find((r) => r.id === R(5)).goal_ids, [G1, G2]);
  check("a running run has no duration; a finished one does",
    [all.items.find((r) => r.id === R(1)).duration_ms, all.items.find((r) => r.id === R(3)).duration_ms >= 0],
    [null, true]);
  check("the grouped rows the UI builds match the groups", buildRunRows(all.items, all.groups).map((r) => [r.status, r.children.length, r.total]),
    [["running", 1, 1], ["failed", 1, 1], ["succeeded", 4, 4], ["abandoned", 1, 1]]);

  console.log("\nattention:");
  check("failed", short(ids(await queue({ attention: ["failed"] }))), ["R2"]);
  check("still running", short(ids(await queue({ attention: ["running"] }))), ["R1"]);
  check("low quality is under 0.5, excludes unscored and the 0.5 run",
    short(ids(await queue({ attention: ["low_quality"] }))), ["R4", "R6"]);
  check("unscored is a SUCCEEDED run with no score, not any null score",
    short(ids(await queue({ attention: ["unscored"] }))), ["R5"]);
  check("two options widen the view", short(ids(await queue({ attention: ["failed", "low_quality"] }))), ["R2", "R4", "R6"]);

  console.log("\nclient and goal:");
  check("client", short(ids(await queue({ client: "claude" }))), ["R1", "R3", "R5", "R7"]);
  const byGoal = await queue({ goalId: G2 });
  check("goal", short(ids(byGoal)), ["R3", "R4", "R5"]);
  check("a goal filter still reports every goal of a matching run",
    byGoal.items.find((r) => r.id === R(5)).goal_ids, [G1, G2]);
  check("goal AND attention AND client together",
    short(ids(await queue({ goalId: G1, attention: ["unscored", "failed"], client: "claude" }))), ["R5"]);

  console.log("\nsearch:");
  check("the model is still searched", short(ids(await queue({}, MODEL_TOKEN))), ["R8"]);
  check("a LIKE wildcard in the search is literal", (await queue({}, `${TOKEN}%`)).total, 0);
} finally {
  await client.query("rollback");
  rolledBack = true;
  const left = await client.query(
    "select (select count(*)::int from goals where slug like 'vrq-%') + (select count(*)::int from agent_runs where id::text like 'f5000000-%') as n",
  );
  console.log(`\nrolled back: ${rolledBack}; seeded rows left in the database: ${left.rows[0].n}`);
  assert.equal(left.rows[0].n, 0, "the transaction must leave nothing behind");
  await client.end();
}

if (fails.length) {
  console.error(`\n${fails.length} check(s) failed:\n - ${fails.join("\n - ")}`);
  process.exit(1);
}
console.log("\nverify-runs-queue-sql: ok");
