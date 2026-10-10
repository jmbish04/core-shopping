/**
 * Run the Overview dashboard's REAL SQL against the REAL database, with data
 * seeded inside a transaction that is rolled back (maestro cs-be-2-9).
 *
 * `scripts/selfcheck-dashboard.mjs` pins the arithmetic. This pins the queries,
 * which is the half a green build and a green deploy cannot speak to: this
 * project currently holds one goal, zero runs and zero proposals, so curling
 * the live endpoint returns an all-zero payload that would look identical
 * whether the aggregates, the window functions and the revision lateral were
 * right or completely wrong.
 *
 * Needs the LAN and the owner password, so it is NOT part of `pnpm run
 * selfcheck`. Run it with `pnpm run verify:dashboard` from this Mac.
 *
 * Every assertion is a DELTA against a baseline measured in the same
 * transaction before seeding, so whatever real rows exist cannot make it pass
 * or fail by accident.
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
const { dashboardWindow } = await import("../src/shared/contracts/dashboard.ts");
const Q = await import("../src/backend/api/routes/shopping/dashboard-queries.ts");

const WINDOW_DAYS = 7;
const now = new Date();
const { windowStart, windowEnd, previousStart } = dashboardWindow(now, WINDOW_DAYS);
const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

/** `d(2, 1)` is 01:00 UTC two days ago — a deterministic day bucket. */
const d = (days, hours) => new Date(startOfToday - days * 86_400_000 + hours * 3_600_000);
const plus = (date, ms) => new Date(date.getTime() + ms);

const G1 = "f0000000-0000-4000-8000-000000000001";
const G2 = "f0000000-0000-4000-8000-000000000002";
const R = (n) => `f1000000-0000-4000-8000-00000000000${n}`;
const P = (n) => `f2000000-0000-4000-8000-00000000000${n}`;
const ENTITY = "f3000000-0000-4000-8000-000000000001";

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

/** Take every measure at once, so a baseline and a result are comparable. */
async function measure() {
  const [runs, outcomes, findings, lessons, accepted, backlog, goals, perDay, strips, proposals] =
    await Promise.all([
      Q.windowedCount(db, "agent_runs", "started_at", windowStart, windowEnd, previousStart),
      Q.runOutcomes(db, windowStart, windowEnd, previousStart),
      Q.windowedCount(db, "sightings", "seen_at", windowStart, windowEnd, previousStart),
      Q.windowedCount(
        db,
        "lessons",
        "created_at",
        windowStart,
        windowEnd,
        previousStart,
        (await import("drizzle-orm")).sql`lessons.status = 'active'`,
      ),
      Q.acceptance(db, windowStart, windowEnd, previousStart),
      Q.reviewBacklog(db, windowStart, windowEnd),
      Q.activeGoals(db, windowStart),
      Q.runsPerDay(db, windowStart, windowEnd, WINDOW_DAYS),
      Q.goalStrips(db, 50),
      Q.recentProposals(db, 50),
    ]);
  return { runs, outcomes, findings, lessons, accepted, backlog, goals, perDay, strips, proposals };
}

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

  const before = await measure();

  // ---------------------------------------------------------------- seed ----
  // G2 existed before the window and was already active then; G1 was created
  // inside it. That is the distinction the activeGoals lateral has to make.
  await client.query(
    `insert into goals (id, slug, title, category, status, last_run_at, expected_cadence_hours, created_at)
     values ($1,'vds-goal-one','VDS goal one','experience','active',$2,24,$3),
            ($4,'vds-goal-two','VDS goal two','travel','active',$5,24,$6)`,
    [G1, d(0, 2), d(1, 0), G2, d(7, 1), d(20, 0)],
  );
  await client.query(
    `insert into goal_revisions (goal_id, revision, author_kind, author, reason, changed_fields, snapshot, created_at)
     values ($1, 1, 'system', 'vds', 'created', '{}', $2, $3),
            ($4, 1, 'system', 'vds', 'created', '{}', $5, $6)`,
    [
      G1,
      JSON.stringify({ status: "active" }),
      d(1, 0),
      G2,
      JSON.stringify({ status: "active" }),
      d(10, 0),
    ],
  );

  // Four runs in the window (one still going), two in the window before it.
  const runs = [
    [R(1), "succeeded", d(0, 1), plus(d(0, 1), 1500), G1],
    [R(2), "failed", d(1, 1), plus(d(1, 1), 2000), G1],
    [R(3), "succeeded", d(2, 1), plus(d(2, 1), 3000), G1],
    [R(4), "running", d(0, 2), null, G1],
    [R(5), "succeeded", d(7, 1), plus(d(7, 1), 1000), G2],
    [R(6), "failed", d(8, 1), plus(d(8, 1), 1000), G2],
  ];
  for (const [id, status, started, finished, goal] of runs) {
    await client.query(
      `insert into agent_runs (id, client, model, status, started_at, finished_at) values ($1,'claude','m',$2,$3,$4)`,
      [id, status, started, finished],
    );
    await client.query(`insert into run_goals (run_id, goal_id) values ($1,$2)`, [id, goal]);
  }

  await client.query(
    `insert into entities (id, kind, fingerprint, title) values ($1,'event','vds-fp','VDS entity')`,
    [ENTITY],
  );
  // Two findings in the window, one before it.
  for (const seen of [d(1, 2), d(3, 2), d(9, 2)]) {
    await client.query(
      `insert into sightings (entity_id, goal_id, title, seen_at) values ($1,$2,'VDS sighting',$3)`,
      [ENTITY, G1, seen],
    );
  }

  // Two active lessons in the window, one before it, and a PROPOSED one that
  // must not count: a lesson nobody accepted is not a lesson learned.
  await client.query(
    `insert into lessons (scope, statement, polarity, status, created_at)
     values ('global','VDS a','positive','active',$1),
            ('global','VDS b','negative','active',$2),
            ('global','VDS c','positive','active',$3),
            ('global','VDS d','positive','proposed',$4)`,
    [d(1, 5), d(2, 5), d(9, 5), d(1, 6)],
  );

  await client.query(
    `insert into proposals (id, goal_id, kind, status, title, created_at, decided_at, expires_at)
     values ($1,$2,'item','queued','VDS queued recent',$3,null,$4),
            ($5,$2,'item','queued','VDS queued older',$6,null,null),
            ($7,$2,'item','reviewed_positive','VDS yes',$8,$9,null),
            ($10,$2,'item','reviewed_negative','VDS no',$11,$12,null),
            ($13,$2,'item','reviewed_positive','VDS yes last window',$14,$15,null),
            ($16,$2,'item','silent_update','VDS silent',$17,null,null),
            ($18,$2,'item','snoozed','VDS snoozed',$19,null,null)`,
    [
      P(1), G1, d(1, 3), plus(now, 24 * 3_600_000),
      P(2), d(5, 3),
      P(3), d(8, 3), d(1, 4),
      P(4), d(9, 3), d(2, 4),
      P(5), d(20, 3), d(8, 4),
      P(6), d(3, 4),
      P(7), d(4, 4),
    ],
  );

  const after = await measure();

  // ------------------------------------------------------------- assert ----
  console.log(`\nwindow ${windowStart.toISOString()} .. ${windowEnd.toISOString()}`);
  console.log(`previous window starts ${previousStart.toISOString()}\n`);

  console.log("runs:");
  check("4 runs started in the window, 2 in the one before", {
    current: after.runs.current - before.runs.current,
    previous: after.runs.previous - before.runs.previous,
  }, { current: 4, previous: 2 });
  check("3 finished in the window, 2 of them succeeded", {
    done: after.outcomes.doneCurrent - before.outcomes.doneCurrent,
    ok: after.outcomes.okCurrent - before.outcomes.okCurrent,
  }, { done: 3, ok: 2 });
  check("the running run is counted as started but not as finished", {
    startedMinusFinished:
      after.runs.current - before.runs.current - (after.outcomes.doneCurrent - before.outcomes.doneCurrent),
  }, { startedMinusFinished: 1 });
  check("2 finished in the previous window, 1 succeeded", {
    done: after.outcomes.donePrevious - before.outcomes.donePrevious,
    ok: after.outcomes.okPrevious - before.outcomes.okPrevious,
  }, { done: 2, ok: 1 });

  console.log("\nday series:");
  const delta = (date, key) => {
    const a = after.perDay.find((r) => r.date === date);
    const b = before.perDay.find((r) => r.date === date);
    return a[key] - b[key];
  };
  const dayOf = (k) => new Date(startOfToday - k * 86_400_000).toISOString().slice(0, 10);
  check("the series still has exactly one bucket per window day", after.perDay.length, WINDOW_DAYS);
  check("today holds the succeeded run and the running one", {
    succeeded: delta(dayOf(0), "succeeded"),
    running: delta(dayOf(0), "running"),
  }, { succeeded: 1, running: 1 });
  check("yesterday holds the failed run", delta(dayOf(1), "failed"), 1);
  check("two days ago holds the other success", delta(dayOf(2), "succeeded"), 1);
  check(
    "the run from BEFORE the window is not in the series",
    after.perDay.some((r) => r.date === dayOf(7)),
    false,
  );
  check("today's bucket is the LAST one, so nothing falls off the chart",
    after.perDay.at(-1).date, dayOf(0));

  console.log("\nfindings and lessons:");
  check("2 sightings in the window, 1 before", {
    current: after.findings.current - before.findings.current,
    previous: after.findings.previous - before.findings.previous,
  }, { current: 2, previous: 1 });
  check("2 ACTIVE lessons in the window — the proposed one does not count", {
    current: after.lessons.current - before.lessons.current,
    previous: after.lessons.previous - before.lessons.previous,
  }, { current: 2, previous: 1 });

  console.log("\nacceptance:");
  check("2 decided in the window, 1 positive", {
    decided: after.accepted.decidedCurrent - before.accepted.decidedCurrent,
    yes: after.accepted.yesCurrent - before.accepted.yesCurrent,
  }, { decided: 2, yes: 1 });
  check("1 decided in the previous window, and it was positive", {
    decided: after.accepted.decidedPrevious - before.accepted.decidedPrevious,
    yes: after.accepted.yesPrevious - before.accepted.yesPrevious,
  }, { decided: 1, yes: 1 });

  console.log("\nreview backlog:");
  check("2 queued, 1 snoozed, 1 silent update", {
    queued: after.backlog.backlog.queued - before.backlog.backlog.queued,
    snoozed: after.backlog.backlog.snoozed - before.backlog.backlog.snoozed,
    silent: after.backlog.backlog.silent_updates - before.backlog.backlog.silent_updates,
  }, { queued: 2, snoozed: 1, silent: 1 });
  check("the one expiring inside 48h is flagged",
    after.backlog.backlog.expiring_soon - before.backlog.backlog.expiring_soon, 1);
  check("oldest_queued_at is the OLDER of the two queued, not the newer",
    after.backlog.backlog.oldest_queued_at, d(5, 3).toISOString());
  check(
    "the baseline backlog counts the two proposals that were queued when the window opened",
    after.backlog.queuedAtWindowStart - before.backlog.queuedAtWindowStart,
    2,
  );

  console.log("\nactive goals:");
  check("both seeded goals are active now", after.goals.current - before.goals.current, 2);
  check(
    "only ONE of them was active when the window opened — the other had no revision yet",
    after.goals.previous - before.goals.previous,
    1,
  );

  console.log("\nper-goal strips:");
  const strip1 = after.strips.find((s) => s.goal_id === G1);
  const strip2 = after.strips.find((s) => s.goal_id === G2);
  check("the in-window goal has a strip", Boolean(strip1), true);
  check("its 4 runs are oldest first", strip1?.runs.map((r) => r.id), [R(3), R(2), R(1), R(4)]);
  check("runs_total matches", strip1?.runs_total, 4);
  check("durations are milliseconds, and a running run has none",
    strip1?.runs.map((r) => r.duration_ms), [3000, 2000, 1500, null]);
  check("a goal whose next run is overdue reads stale", strip2?.stale, true);
  check("a goal inside its cadence does not", strip1?.stale, false);

  console.log("\nrecent proposals:");
  check("newest first", after.proposals[0]?.id, P(1));
  check("the goal's title is resolved", after.proposals[0]?.goal_title, "VDS goal one");
  check("an expiry is carried through", after.proposals[0]?.expires_at !== null, true);
  check("a proposal with no expiry answers null",
    after.proposals.find((p) => p.id === P(2))?.expires_at, null);
} finally {
  await client.query("rollback");
  rolledBack = true;
  // Prove the rollback: nothing seeded may survive this script.
  const left = await client.query("select count(*)::int as n from goals where slug like 'vds-%'");
  console.log(`\nrolled back: ${rolledBack}; seeded goals left in the database: ${left.rows[0].n}`);
  assert.equal(left.rows[0].n, 0, "the transaction must leave nothing behind");
  await client.end();
}

if (fails.length) {
  console.error(`\n${fails.length} check(s) failed:\n - ${fails.join("\n - ")}`);
  process.exit(1);
}
console.log("\nverify-dashboard-sql: ok");
