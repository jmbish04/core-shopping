/**
 * Run the due-goal query against the REAL database, with rows seeded inside a
 * transaction that is rolled back (maestro cs-gap-occasion-calendar).
 *
 * The date arithmetic is already proven by `scripts/selfcheck-occasions.mjs`
 * (20 assertions, 9 planted regressions). What that cannot prove is the JOIN:
 * which goals are reached, whether a goal with four links is decided once, and
 * whether a per-link override actually comes out of `goal_occasions` rather
 * than the occasion's own column. An empty table answers all of those
 * identically however wrong the query is, so the fixture is built to make
 * every wrong answer visible:
 *
 * - TWO goals linked to the SAME occasion, so a join that fans out or drops
 *   one fails
 * - ONE goal linked to THREE occasions with different leads, so a query that
 *   returns a row per link instead of per goal fails, and the governing one
 *   must be the already-due one rather than the first by id
 * - a link with a `lead_days_override` DIFFERENT from the occasion's own lead,
 *   so reading the occasion's column instead of the link's fails
 * - an override of 0, so a `||` fallback fails where `??` does not
 * - a PAUSED goal linked to a due occasion, so a query that ignores status
 *   puts work on the board nobody asked for
 * - a goal with NO links at all, so it must be absent rather than present
 *   with a null verdict
 * - an INACTIVE occasion as a goal's only link, so the goal appears with a
 *   null verdict rather than being silently dropped
 *
 * Needs the LAN and the owner password. Run it with
 * `pnpm run verify:occasions`.
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
const { goalsDueByOccasion, occasionsForGoal, setGoalOccasions } = await import(
  "../src/backend/pg/queries/occasions.ts"
);

const TOKEN = `voc${Date.now().toString(36)}`;
const G = (n) => `e1000000-0000-4000-8000-00000000000${n}`;
const O = (n) => `e2000000-0000-4000-8000-00000000000${n}`;

/** Fixed, so the expected dates below are arithmetic rather than today. */
const AS_OF = "2027-06-20";

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

const ROLLBACK = Symbol("rollback");

try {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into goals (id, slug, title, category, status) values
        (${G(1)}, ${`${TOKEN}-gift-sweep`},  ${`${TOKEN} gift sweep`},   'gift',    'active'),
        (${G(2)}, ${`${TOKEN}-workstation`}, ${`${TOKEN} workstation`},  'product', 'active'),
        (${G(3)}, ${`${TOKEN}-paused`},      ${`${TOKEN} paused goal`},  'product', 'paused'),
        (${G(4)}, ${`${TOKEN}-unlinked`},    ${`${TOKEN} no occasions`}, 'product', 'active'),
        (${G(5)}, ${`${TOKEN}-silent`},      ${`${TOKEN} silent link`},  'product', 'active')
    `);

    await tx.execute(sql`
      insert into occasions (id, label, kind, starts_on, ends_on, recurs_yearly, lead_days, is_active) values
        (${O(1)}, ${`${TOKEN} Prime Day`},       'sale_event', '2024-07-08', '2024-07-09', true,  21, true),
        (${O(2)}, ${`${TOKEN} Birthday`},        'personal',   '2024-08-02', '2024-08-02', true,  30, true),
        (${O(3)}, ${`${TOKEN} Restaurant Week`}, 'festival',   '2028-01-20', '2028-01-31', false, 14, true),
        (${O(4)}, ${`${TOKEN} Retired sale`},    'sale_event', '2024-07-08', '2024-07-09', true,  21, false)
    `);

    await tx.execute(sql`
      insert into goal_occasions (goal_id, occasion_id, lead_days_override) values
        (${G(1)}, ${O(1)}, null),
        (${G(1)}, ${O(2)}, null),
        (${G(1)}, ${O(3)}, 45),
        (${G(2)}, ${O(1)}, 0),
        (${G(3)}, ${O(1)}, null),
        (${G(5)}, ${O(4)}, null)
    `);

    const mine = (rows) => rows.filter((r) => r.title.startsWith(TOKEN));

    // --- the join -----------------------------------------------------------

    const all = mine(await goalsDueByOccasion(db, AS_OF, { statuses: ["active", "paused"] }));
    check(
      "every linked goal appears exactly once, however many links it has",
      all.map((r) => r.slug).sort(),
      [`${TOKEN}-gift-sweep`, `${TOKEN}-paused`, `${TOKEN}-silent`, `${TOKEN}-workstation`],
    );
    check(
      "a goal with no links at all is absent, not present with a null verdict",
      all.some((r) => r.slug === `${TOKEN}-unlinked`),
      false,
    );

    const byslug = Object.fromEntries(all.map((r) => [r.slug, r]));

    // --- two goals, one occasion -------------------------------------------

    check(
      "two goals linked to the SAME occasion both get it",
      [
        byslug[`${TOKEN}-gift-sweep`]?.due?.label,
        byslug[`${TOKEN}-workstation`]?.due?.label,
      ],
      [`${TOKEN} Prime Day`, `${TOKEN} Prime Day`],
    );

    // --- the governing link among three ------------------------------------

    // Prime Day 2027-07-08 with a lead of 21 is due 2027-06-17, before AS_OF.
    // The birthday 2027-08-02 with a lead of 30 is due 2027-07-03, after it.
    // Restaurant Week 2028-01-20 with an override of 45 is due 2027-12-06.
    const sweep = byslug[`${TOKEN}-gift-sweep`];
    check("the already-due occasion governs, not the first by id", sweep?.due?.label, `${TOKEN} Prime Day`);
    check("and its due date is the lead ahead of the window", sweep?.due?.due_on, "2027-06-17");
    check("and it reads as due", sweep?.due?.is_due, true);
    check("and the reason names it", sweep?.due?.reason.includes("Prime Day"), true);

    // --- the per-link override actually comes from goal_occasions ----------

    const station = byslug[`${TOKEN}-workstation`];
    check("an override of 0 is honoured, not treated as absent", station?.due?.lead_days, 0);
    check("so the goal is due on the day the window opens", station?.due?.due_on, "2027-07-08");
    check("and is NOT due three weeks early like the other goal", station?.due?.is_due, false);

    const links = await occasionsForGoal(db, G(1), AS_OF);
    const byOccasion = Object.fromEntries(links.map((l) => [l.label, l]));
    check(
      "a non-zero override is read from the link, not the occasion",
      byOccasion[`${TOKEN} Restaurant Week`]?.lead_days_override,
      45,
    );
    check(
      "and it changes the due date accordingly",
      byOccasion[`${TOKEN} Restaurant Week`]?.due?.due_on,
      "2027-12-06",
    );
    check(
      "a null override falls back to the occasion's own lead",
      [byOccasion[`${TOKEN} Prime Day`]?.lead_days_override, byOccasion[`${TOKEN} Prime Day`]?.due?.lead_days],
      [null, 21],
    );
    check("every link is returned, not only the governing one", links.length, 3);
    check(
      "soonest first",
      links.map((l) => l.due?.due_on),
      ["2027-06-17", "2027-07-03", "2027-12-06"],
    );

    // --- status and inactivity ---------------------------------------------

    const activeOnly = mine(await goalsDueByOccasion(db, AS_OF));
    check(
      "a paused goal is not woken by default",
      activeOnly.some((r) => r.slug === `${TOKEN}-paused`),
      false,
    );
    check(
      "but is reachable when a caller asks for it",
      byslug[`${TOKEN}-paused`]?.due?.is_due,
      true,
    );

    const silent = byslug[`${TOKEN}-silent`];
    check(
      "a goal whose only occasion is inactive appears with a NULL verdict, not dropped",
      silent?.due,
      null,
    );
    check(
      "and null is not 'not due': it is absent from the due-only list",
      mine(await goalsDueByOccasion(db, AS_OF, { onlyDue: true })).some(
        (r) => r.slug === `${TOKEN}-silent`,
      ),
      false,
    );

    const dueNow = mine(await goalsDueByOccasion(db, AS_OF, { onlyDue: true }));
    check(
      "only_due returns exactly the goals a cron should wake",
      dueNow.map((r) => r.slug),
      [`${TOKEN}-gift-sweep`],
    );

    // --- the task's own bar, through the database ---------------------------

    const early = mine(await goalsDueByOccasion(db, "2027-06-16", { onlyDue: true }));
    check(
      "the day before the lead, nothing is due",
      early.map((r) => r.slug),
      [],
    );
    const onTheDay = mine(await goalsDueByOccasion(db, "2027-06-17", { onlyDue: true }));
    check(
      "on the day 21 days ahead of the window, the goal is due",
      onTheDay.map((r) => r.slug),
      [`${TOKEN}-gift-sweep`],
    );

    // --- setting the links --------------------------------------------------

    const replaced = await setGoalOccasions(tx, G(4), [
      { occasion_id: O(1), lead_days_override: 7 },
      { occasion_id: O(2) },
    ]);
    check("linking a previously unlinked goal writes both", replaced.linked, 2);
    check("and removed nothing, because it had none", replaced.removed, 0);
    check(
      "the goal now appears, with the override applied",
      (await occasionsForGoal(db, G(4), AS_OF)).find((l) => l.label === `${TOKEN} Prime Day`)?.due?.lead_days,
      7,
    );

    const shrunk = await setGoalOccasions(tx, G(4), [{ occasion_id: O(2) }]);
    check("replacing with a shorter set removes the rest", [shrunk.linked, shrunk.removed], [1, 2]);
    check("and the goal keeps only what was named", (await occasionsForGoal(db, G(4), AS_OF)).length, 1);

    const cleared = await setGoalOccasions(tx, G(4), []);
    check("an empty set unlinks everything", [cleared.linked, cleared.removed], [0, 1]);

    let orphan = "accepted";
    try {
      await tx.transaction((inner) =>
        setGoalOccasions(inner, G(4), [{ occasion_id: "e2000000-0000-4000-8000-0000000000ff" }]),
      );
    } catch (error) {
      orphan = /No such occasion/.test(String(error.message)) ? "refused" : "other";
    }
    check("linking an occasion that does not exist is refused", orphan, "refused");

    throw ROLLBACK;
  });
} catch (error) {
  if (error !== ROLLBACK) {
    console.error(error);
    fails.push(`the fixture threw: ${error instanceof Error ? error.message : String(error)}`);
  }
} finally {
  const left = await client.query(
    `select (select count(*)::int from goals where slug like 'voc%')
          + (select count(*)::int from occasions where label like 'voc%')
          + (select count(*)::int from goal_occasions where goal_id::text like 'e1000000-%') as n`,
  );
  console.log(`\nrolled back; seeded rows left in the database: ${left.rows[0].n}`);
  assert.equal(left.rows[0].n, 0, "the transaction must leave nothing behind");
  await client.end();
}

if (fails.length) {
  console.error(`\n${fails.length} check(s) failed:\n - ${fails.join("\n - ")}`);
  process.exit(1);
}
console.log("\nverify-occasions-sql: ok");
