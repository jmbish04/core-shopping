/**
 * Run the wishlist briefing slice and the match link against the REAL
 * database, with rows seeded inside a transaction that is rolled back
 * (maestro cs-gap-wishlist).
 *
 * The task's own bar is "one wishlist row is reachable from two goals'
 * briefings", and that is the first thing asserted here: the SAME row is
 * returned to a Prime Day sweep and to a Black Friday sweep, because the slice
 * is not goal-scoped. An empty table satisfies that vacuously, so the fixture
 * is built to make every wrong answer visible:
 *
 * - a `wanted`, an `acquired` and a `dropped` item, so a slice that hands the
 *   whole table to an agent re-proposes something already bought or already
 *   turned down
 * - items in two categories, so a category filter that matches everything fails
 * - THREE price observations for the matched entity with the LOWEST in the
 *   middle, so a query taking the first or the latest price instead of the
 *   minimum fails
 * - an item with a target the best price BEATS and one with a target it does
 *   NOT, so a comparison written the wrong way round fails
 * - an item with NO target and an item with no priced entity, so
 *   `target_met` must be null for both rather than false — "no target set" and
 *   "target never met" are different answers
 * - two sightings against one item and none against another, so a count that
 *   leaks across rows fails (a correlated subselect on `wishlist_items.id`,
 *   the same defect shape as maestro `067a29e7ed5b`)
 *
 * Needs the LAN and the owner password, so it is NOT part of `pnpm run
 * selfcheck`. Run it with `pnpm run verify:wishlist`.
 *
 * As in `verify-config-api-sql.mjs`: the outer transaction is `db.transaction`
 * itself, never a manual `begin` with a nested `db.transaction` inside it,
 * which commits the outer one.
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
const { wishlistForBriefing, linkSightingToWishlist } = await import(
  "../src/backend/pg/queries/wishlist.ts"
);
const { WishlistItemInputSchema } = await import("../src/shared/contracts/config.ts");

const TOKEN = `vwl${Date.now().toString(36)}`;
const I = (n) => `fd000000-0000-4000-8000-00000000000${n}`;
const E = (n) => `fe000000-0000-4000-8000-00000000000${n}`;

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
    // Two entities: the slurpee machine (priced three times) and a gift with
    // no prices at all.
    await tx.execute(sql`
      insert into entities (id, kind, fingerprint, title) values
        (${E(1)}, 'product', ${`vwl:slurpee-${TOKEN}`}, 'Shark slurpee machine'),
        (${E(2)}, 'product', ${`vwl:gift-${TOKEN}`},    'An unpriced gift')
    `);

    // The LOWEST price is in the middle, so first-row and latest-row both fail.
    await tx.execute(sql`
      insert into price_observations (entity_id, seller, price_cents, observed_at) values
        (${E(1)}, 'seller-a', 24900, now() - interval '30 days'),
        (${E(1)}, 'seller-b', 17900, now() - interval '15 days'),
        (${E(1)}, 'seller-c', 21900, now() - interval '1 day')
    `);

    await tx.execute(sql`
      insert into wishlist_items (id, label, category, status, target_price_cents, msrp_cents, matched_entity_id) values
        (${I(1)}, ${`${TOKEN} shark slurpee machine`}, 'product', 'wanted',   19900, 29900, ${E(1)}),
        (${I(2)}, ${`${TOKEN} target not met`},        'product', 'wanted',   9900,  29900, ${E(1)}),
        (${I(3)}, ${`${TOKEN} no target set`},         'product', 'wanted',   null,  4900,  ${E(1)}),
        (${I(4)}, ${`${TOKEN} unpriced gift`},         'gift',    'wanted',   5000,  9900,  ${E(2)}),
        (${I(5)}, ${`${TOKEN} already bought`},        'product', 'acquired', 19900, 29900, ${E(1)}),
        (${I(6)}, ${`${TOKEN} turned down`},           'product', 'dropped',  19900, 29900, ${E(1)})
    `);

    // Two sightings on item 1, none on item 2, so a leaking count is visible.
    await tx.execute(sql`
      insert into sightings (entity_id, title, wishlist_item_id) values
        (${E(1)}, 'slurpee on sale at seller-b', ${I(1)}),
        (${E(1)}, 'slurpee again at seller-c',   ${I(1)})
    `);

    // --- the task's own bar: one row, two goals' briefings ------------------

    const primeDay = await wishlistForBriefing(tx, { categories: ["product", "gift"] });
    const blackFriday = await wishlistForBriefing(tx, { categories: ["product", "gift"] });
    const mine = (page) => page.filter((i) => i.label.startsWith(TOKEN));

    check(
      "one wishlist row is reachable from TWO goals' briefings",
      [
        mine(primeDay).some((i) => i.id === I(1)),
        mine(blackFriday).some((i) => i.id === I(1)),
      ],
      [true, true],
    );
    check(
      "and both briefings get the identical set, because the slice is not goal-scoped",
      mine(primeDay).map((i) => i.id).sort(),
      mine(blackFriday).map((i) => i.id).sort(),
    );

    // --- status: a briefing never re-proposes what is bought or dropped -----

    check(
      "only the wanted items reach an agent",
      mine(primeDay).map((i) => i.id).sort(),
      [I(1), I(2), I(3), I(4)].sort(),
    );
    check(
      "the acquired and dropped rows are kept, not deleted",
      Number(
        (await tx.execute(sql`select count(*)::int as n from wishlist_items where status in ('acquired','dropped') and label like ${`${TOKEN}%`}`))
          .rows[0].n,
      ),
      2,
    );
    check(
      "and are reachable when a surface asks for them explicitly",
      mine(await wishlistForBriefing(tx, { statuses: ["acquired"] })).map((i) => i.label.replace(`${TOKEN} `, "")),
      ["already bought"],
    );

    // --- category filter ----------------------------------------------------

    const giftsOnly = mine(await wishlistForBriefing(tx, { categories: ["gift"] }));
    check("a category filter returns only that category", giftsOnly.map((i) => i.id), [I(4)]);
    check("an unfiltered slice returns every category", mine(await wishlistForBriefing(tx)).length, 4);

    // --- price facts --------------------------------------------------------

    const byId = Object.fromEntries(mine(primeDay).map((i) => [i.id, i]));
    check("the best price is the MINIMUM ever seen, not the first or the latest", byId[I(1)]?.best_price_cents, 17900);
    check("a target the best price beats reads met", byId[I(1)]?.target_met, true);
    check("a target the best price does NOT beat reads not met", byId[I(2)]?.target_met, false);
    check("no target set reads null, never false", byId[I(3)]?.target_met, null);
    check("and its best price is still reported", byId[I(3)]?.best_price_cents, 17900);
    check("an entity with no prices reports a null best price, not 0", byId[I(4)]?.best_price_cents, null);
    check("and a null target_met, because nothing has been priced", byId[I(4)]?.target_met, null);
    check("the money is integer cents", typeof byId[I(1)]?.best_price_cents, "number");

    // --- sighting counts, which are a correlated subselect ------------------

    check("sightings are counted per item", byId[I(1)]?.sighting_count, 2);
    check("an item nobody has found counts 0, not the other item's count", byId[I(2)]?.sighting_count, 0);

    // --- recording a match --------------------------------------------------

    const [fresh] = (
      await tx.execute(sql`
        insert into sightings (entity_id, title) values (${E(2)}, 'a gift listing nobody has matched')
        returning id
      `)
    ).rows;
    const linked = await linkSightingToWishlist(tx, fresh.id, I(4));
    check("a match is recorded against the row", linked.wishlist_item_id, I(4));
    check(
      "and the sighting now carries it, so no reader has to infer it from the title",
      String(
        (await tx.execute(sql`select wishlist_item_id from sightings where id = ${fresh.id}`)).rows[0]
          .wishlist_item_id,
      ),
      I(4),
    );

    // An item with no match yet learns which entity it is from the first match.
    await tx.execute(sql`update wishlist_items set matched_entity_id = null where id = ${I(3)}`);
    const [second] = (
      await tx.execute(sql`insert into sightings (entity_id, title) values (${E(1)}, 'first ever match') returning id`)
    ).rows;
    await linkSightingToWishlist(tx, second.id, I(3));
    check(
      "a first match tells the item which entity it is, so a briefing can price it",
      String(
        (await tx.execute(sql`select matched_entity_id from wishlist_items where id = ${I(3)}`)).rows[0]
          .matched_entity_id,
      ),
      E(1),
    );

    // An existing match is never overwritten by a later one.
    const [third] = (
      await tx.execute(sql`insert into sightings (entity_id, title) values (${E(2)}, 'a different thing') returning id`)
    ).rows;
    await linkSightingToWishlist(tx, third.id, I(1));
    check(
      "an identification already recorded is not overwritten by a later sighting",
      String(
        (await tx.execute(sql`select matched_entity_id from wishlist_items where id = ${I(1)}`)).rows[0]
          .matched_entity_id,
      ),
      E(1),
    );

    let orphan = "accepted";
    try {
      await tx.transaction((inner) => linkSightingToWishlist(inner, fresh.id, I(9)));
    } catch (error) {
      orphan = error instanceof Error && /No wishlist item/.test(error.message) ? "refused" : "other";
    }
    check("linking to a wishlist row that does not exist is refused", orphan, "refused");

    // --- the contract's own rules ------------------------------------------

    check(
      "a target above the list price is refused",
      WishlistItemInputSchema.safeParse({ label: "x", target_price_cents: 40000, msrp_cents: 29900 }).success,
      false,
    );
    check(
      "an acquired item with no matched entity is refused",
      WishlistItemInputSchema.safeParse({ label: "x", status: "acquired" }).success,
      false,
    );
    check(
      "an acquired item that names its entity is accepted",
      WishlistItemInputSchema.safeParse({ label: "x", status: "acquired", matched_entity_id: E(1) }).success,
      true,
    );
    check(
      "a wanted item with no target at all is accepted",
      WishlistItemInputSchema.parse({ label: "a shark slurpee machine" }).target_price_cents ?? null,
      null,
    );
    check(
      "a hard requirement must carry a label an agent can act on",
      WishlistItemInputSchema.safeParse({ label: "x", hard_requirements: [{ attribute: "size" }] }).success,
      false,
    );

    throw ROLLBACK;
  });
} catch (error) {
  if (error !== ROLLBACK) {
    console.error(error);
    fails.push(`the fixture threw: ${error instanceof Error ? error.message : String(error)}`);
  }
} finally {
  const left = await client.query(
    `select (select count(*)::int from wishlist_items where label like 'vwl%')
          + (select count(*)::int from entities where id::text like 'fe000000-%') as n`,
  );
  console.log(`\nrolled back; seeded rows left in the database: ${left.rows[0].n}`);
  assert.equal(left.rows[0].n, 0, "the transaction must leave nothing behind");
  await client.end();
}

if (fails.length) {
  console.error(`\n${fails.length} check(s) failed:\n - ${fails.join("\n - ")}`);
  process.exit(1);
}
console.log("\nverify-wishlist-sql: ok");
