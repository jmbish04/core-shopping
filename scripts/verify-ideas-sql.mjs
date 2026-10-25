/**
 * Run the idea bank against the REAL database, with rows seeded inside a
 * transaction that is rolled back (maestro cs-gap-idea-bank).
 *
 * The task's own bar is the LOOP: "declining a dated proposal can record an
 * idea, and the next briefing for that category returns it." That is asserted
 * end to end below — a decline writes the idea, and the very next briefing for
 * the proposal's own category hands it back.
 *
 * The fixture makes every wrong answer visible:
 *
 * - the declining proposal belongs to a TRAVEL goal while the default category
 *   is also travel, so a second proposal on a PRODUCT goal is included: a
 *   function that hardcodes the default instead of inheriting the goal's
 *   category files that one wrong and the next briefing never sees it
 * - a candidate, a promoted and a dropped idea, so a briefing that hands over
 *   everything re-proposes a decided thing
 * - an idea whose `revisit_after` is in the FUTURE and one whose is in the
 *   PAST, so a gate that ignores the date, or one that drops the nulls,
 *   both fail
 * - an idea with a NULL `revisit_after`, because "always eligible" and
 *   "revisit never" are different and an `is null` branch is what separates
 *   them
 * - two ideas with different confidences, so an unordered result fails
 * - entities attached by the join table, so a bare id that resolves to nothing
 *   is impossible and the titles must come back resolved
 * - a season that WRAPS the new year, asked about from inside it, which is the
 *   case that found a real defect in the first version of `projectSeason`
 *
 * Needs the LAN and the owner password. Run it with `pnpm run verify:ideas`.
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
const { ideasForBriefing, promoteIdeaToGoal, projectSeason, recordIdeaFromDecline, seasonLabel } =
  await import("../src/backend/pg/queries/ideas.ts");
const { IdeaInputSchema } = await import("../src/shared/contracts/config.ts");

const TOKEN = `vid${Date.now().toString(36)}`;
const G = (n) => `e3000000-0000-4000-8000-00000000000${n}`;
const P = (n) => `e4000000-0000-4000-8000-00000000000${n}`;
const E = (n) => `e5000000-0000-4000-8000-00000000000${n}`;
const I = (n) => `e6000000-0000-4000-8000-00000000000${n}`;

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

// ---------------------------------------------------------------------------
// The pure parts first: no database needed, so a failure here is unambiguous.
// ---------------------------------------------------------------------------

check("a one-month season reads as that month", seasonLabel(10, 10), "October");
check("a span reads as a span", seasonLabel(3, 4), "March to April");
check("a season that wraps the new year is NOT reordered", seasonLabel(11, 2), "November to February");
check("no season reads as null, not as an empty string", seasonLabel(null, null), null);

check(
  "a season projects into this year when it has not passed",
  projectSeason(10, 10, "2027-06-20"),
  { start: "2027-10-01", end: "2027-10-31" },
);
check(
  "and rolls to next year once it has",
  projectSeason(10, 10, "2027-11-20"),
  { start: "2028-10-01", end: "2028-10-31" },
);
check(
  "a wrapping season asked about from INSIDE it keeps the window that is open",
  projectSeason(11, 2, "2028-01-10"),
  { start: "2027-11-01", end: "2028-02-29" },
);
check(
  "and February lands on the 28th in a common year",
  projectSeason(11, 2, "2026-12-10"),
  { start: "2026-11-01", end: "2027-02-28" },
);
check("no season projects to null", projectSeason(null, null, AS_OF), null);
check(
  "a season needs both months or neither",
  IdeaInputSchema.safeParse({ title: "x", target_month_start: 10 }).success,
  false,
);
check(
  "and both is accepted",
  IdeaInputSchema.safeParse({ title: "x", target_month_start: 11, target_month_end: 2 }).success,
  true,
);

try {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into goals (id, slug, title, category, status) values
        (${G(1)}, ${`${TOKEN}-travel`},  ${`${TOKEN} travel goal`},  'travel',  'active'),
        (${G(2)}, ${`${TOKEN}-product`}, ${`${TOKEN} product goal`}, 'product', 'active')
    `);
    await tx.execute(sql`
      insert into entities (id, kind, fingerprint, title) values
        (${E(1)}, 'destination', ${`vid:taiwan-${TOKEN}`},  'Taiwan'),
        (${E(2)}, 'performer',   ${`vid:sammy-${TOKEN}`},   'Sammy Cheng')
    `);
    await tx.execute(sql`
      insert into proposals (id, goal_id, kind, status, title) values
        (${P(1)}, ${G(1)}, 'trip', 'reviewed_negative', ${`${TOKEN} Taiwan in April`}),
        (${P(2)}, ${G(2)}, 'item', 'reviewed_negative', ${`${TOKEN} a workstation`})
    `);

    // --- the task's own bar: decline records, next briefing returns ---------

    const kept = await recordIdeaFromDecline(tx, P(1), {
      title: `${TOKEN} Taiwan Pride, next year`,
      rationale: "Taiwan Pride is late October and worth targeting next year, ideally when Sammy Cheng tours.",
      target_month_start: 10,
      target_month_end: 10,
      confidence: 0.8,
      entities: [
        { entity_id: E(1), role: "destination" },
        { entity_id: E(2), role: "artist" },
      ],
    });
    check("declining a dated proposal records an idea", typeof kept.idea_id, "string");
    check("filed under the proposal's own goal category, not a default", kept.category, "travel");

    const travelBriefing = (await ideasForBriefing(tx, { categories: ["travel"], asOf: AS_OF })).filter(
      (i) => i.title.startsWith(TOKEN),
    );
    check(
      "and the NEXT briefing for that category returns it",
      travelBriefing.map((i) => i.id),
      [kept.idea_id],
    );
    check(
      "with its season in words",
      travelBriefing[0]?.season,
      "October",
    );
    check(
      "and its entities resolved, never bare ids",
      travelBriefing[0]?.entities.map((e) => `${e.role}:${e.title}`).sort(),
      ["artist:Sammy Cheng", "destination:Taiwan"],
    );
    check(
      "and the proposal it came from, so the reason is reachable",
      travelBriefing[0]?.source_proposal_id,
      P(1),
    );

    // The product proposal must file under PRODUCT, not the travel default.
    const fromProduct = await recordIdeaFromDecline(tx, P(2), {
      title: `${TOKEN} that workstation, on sale`,
      confidence: 0.3,
    });
    check("a proposal on a product goal files under product", fromProduct.category, "product");
    check(
      "so a travel briefing does not pick it up",
      (await ideasForBriefing(tx, { categories: ["travel"], asOf: AS_OF }))
        .filter((i) => i.title.startsWith(TOKEN))
        .some((i) => i.id === fromProduct.idea_id),
      false,
    );
    check(
      "and a product briefing does",
      (await ideasForBriefing(tx, { categories: ["product"], asOf: AS_OF }))
        .filter((i) => i.title.startsWith(TOKEN))
        .some((i) => i.id === fromProduct.idea_id),
      true,
    );

    // --- status and the revisit gate ---------------------------------------

    await tx.execute(sql`
      insert into ideas (id, title, category, status, confidence, revisit_after) values
        (${I(1)}, ${`${TOKEN} already promoted`}, 'travel', 'promoted',  0.9, null),
        (${I(2)}, ${`${TOKEN} turned down`},      'travel', 'dropped',   0.9, null),
        (${I(3)}, ${`${TOKEN} snoozed`},          'travel', 'candidate', 0.95, '2028-01-01'),
        (${I(4)}, ${`${TOKEN} snooze expired`},   'travel', 'candidate', 0.1, '2027-01-01')
    `);

    const gated = (await ideasForBriefing(tx, { categories: ["travel"], asOf: AS_OF })).filter((i) =>
      i.title.startsWith(TOKEN),
    );
    check(
      "a promoted and a dropped idea never reach a briefing",
      [gated.some((i) => i.id === I(1)), gated.some((i) => i.id === I(2))],
      [false, false],
    );
    check("an idea snoozed into the future is held back", gated.some((i) => i.id === I(3)), false);
    check("an expired snooze is eligible again", gated.some((i) => i.id === I(4)), true);
    check(
      "and a null revisit_after is always eligible, not never",
      gated.some((i) => i.id === kept.idea_id),
      true,
    );
    check(
      "highest confidence first",
      gated.map((i) => i.confidence),
      [0.8, 0.1],
    );
    check(
      "a dropped idea is kept in the table, not deleted",
      Number(
        (await tx.execute(sql`select count(*)::int as n from ideas where status = 'dropped' and title like ${`${TOKEN}%`}`))
          .rows[0].n,
      ),
      1,
    );
    check(
      "and is reachable when a surface asks for it",
      (await ideasForBriefing(tx, { statuses: ["dropped"], asOf: AS_OF }))
        .filter((i) => i.title.startsWith(TOKEN))
        .map((i) => i.id),
      [I(2)],
    );

    // --- promoting, which is the collection being drawn from ---------------

    const promoted = await promoteIdeaToGoal(tx, kept.idea_id, {
      asOf: AS_OF,
      slug: `${TOKEN}-promoted`,
    });
    check("promoting creates a goal", promoted.created, true);
    const [goal] = (
      await tx.execute(sql`
        select title, category, instructions, window_start::text, window_end::text, status
        from goals where id = ${promoted.goal_id}
      `)
    ).rows;
    check("the goal inherits the idea's title", goal.title, `${TOKEN} Taiwan Pride, next year`);
    check("and its category", goal.category, "travel");
    check("and its rationale becomes the instructions, not retyped", goal.instructions.startsWith("Taiwan Pride is late October"), true);
    check(
      "and the season becomes a real date window",
      [goal.window_start, goal.window_end],
      ["2027-10-01", "2027-10-31"],
    );
    check("the goal is active", goal.status, "active");

    const [after] = (
      await tx.execute(sql`select status, promoted_goal_id from ideas where id = ${kept.idea_id}`)
    ).rows;
    check("the idea is marked promoted", after.status, "promoted");
    check("and names the goal it became", String(after.promoted_goal_id), promoted.goal_id);
    check(
      "so it no longer reaches a briefing",
      (await ideasForBriefing(tx, { categories: ["travel"], asOf: AS_OF })).some(
        (i) => i.id === kept.idea_id,
      ),
      false,
    );

    const again = await promoteIdeaToGoal(tx, kept.idea_id, { asOf: AS_OF, slug: `${TOKEN}-second` });
    check("promoting twice returns the SAME goal rather than making a second", again.goal_id, promoted.goal_id);
    check("and says it did not create one", again.created, false);
    // The real claim: the second promotion's slug was never used, so no second
    // goal exists. (Counting `TOKEN-%` would also match the two seeded goals,
    // which is what this assertion got wrong on its first run.)
    check(
      "so the second promotion created no goal of its own",
      (await tx.execute(sql`select slug from goals where slug in (${`${TOKEN}-promoted`}, ${`${TOKEN}-second`})`)).rows.map(
        (r) => r.slug,
      ),
      [`${TOKEN}-promoted`],
    );

    // --- refusals -----------------------------------------------------------

    let noProposal = "accepted";
    try {
      await tx.transaction((inner) =>
        recordIdeaFromDecline(inner, "e4000000-0000-4000-8000-0000000000ff", { title: "x" }),
      );
    } catch (error) {
      noProposal = /^No proposal /.test(String(error.message)) ? "refused" : "other";
    }
    check("recording against a proposal that does not exist is refused", noProposal, "refused");

    let noEntity = "accepted";
    try {
      await tx.transaction((inner) =>
        recordIdeaFromDecline(inner, P(1), {
          title: "x",
          entities: [{ entity_id: "e5000000-0000-4000-8000-0000000000ff" }],
        }),
      );
    } catch (error) {
      noEntity = /No such entity/.test(String(error.message)) ? "refused" : "other";
    }
    check("attaching an entity that does not exist is refused, never stored as an orphan", noEntity, "refused");

    throw ROLLBACK;
  });
} catch (error) {
  if (error !== ROLLBACK) {
    console.error(error);
    fails.push(`the fixture threw: ${error instanceof Error ? error.message : String(error)}`);
  }
} finally {
  const left = await client.query(
    `select (select count(*)::int from ideas where title like 'vid%')
          + (select count(*)::int from goals where slug like 'vid%')
          + (select count(*)::int from entities where id::text like 'e5000000-%')
          + (select count(*)::int from proposals where id::text like 'e4000000-%') as n`,
  );
  console.log(`\nrolled back; seeded rows left in the database: ${left.rows[0].n}`);
  assert.equal(left.rows[0].n, 0, "the transaction must leave nothing behind");
  await client.end();
}

if (fails.length) {
  console.error(`\n${fails.length} check(s) failed:\n - ${fails.join("\n - ")}`);
  process.exit(1);
}
console.log("\nverify-ideas-sql: ok");
