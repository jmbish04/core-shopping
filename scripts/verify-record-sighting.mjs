/**
 * Run `recordSighting` (maestro cs-be-3-4) against the REAL database, inside a
 * transaction that is rolled back.
 *
 * `scripts/selfcheck-sightings.mjs` pins the pure rules. This pins what the
 * SQL does: the fingerprint match, the canonical-URL match, the merge chain,
 * the price delta against the latest priced sighting, the prior proposals with
 * the latest verdict that was NOT undone, and the whole write set.
 *
 * Needs the LAN and the owner password, so it is NOT part of `pnpm run
 * selfcheck`. Run it with `pnpm run verify:sightings`.
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
const { recordSighting, SightingError } = await import("../src/backend/catalog/index.ts");

const ROLLBACK = new Error("rollback");
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
let passed = 0;
const ok = (n) => {
  passed++;
  console.log("  ok  " + n);
};
const count = async (tx, t) =>
  Number((await tx.execute(sql.raw(`select count(*)::int as n from ${t}`))).rows[0].n);
try {
  await db.transaction(async (tx) => {
    const before = {};
    const tables = [
      "entities",
      "events",
      "sources",
      "sightings",
      "price_observations",
      "proposals",
      "proposal_items",
      "reviews",
      "goals",
      "agent_runs",
      "run_events",
    ];
    for (const t of tables) before[t] = await count(tx, t);
    const [goal] = (await tx.execute(sql`select id from goals limit 1`)).rows;
    assert.ok(goal, "need one goal");
    const show = {
      performer: "Chelsea Handler",
      venue: "The Masonic",
      startsAt: "2026-11-14T20:00:00-08:00",
      city: "San Francisco",
    };

    const a = await recordSighting(tx, {
      kind: "event",
      title: "Chelsea Handler",
      url: "https://www.seatgeek.com/ch?utm_source=x",
      priceCents: 10000,
      currency: "USD",
      seller: "SeatGeek",
      hints: show,
      goalId: goal.id,
    });
    assert.equal(a.status, "new");
    assert.equal(a.matched_by, "created");
    assert.equal(a.sighting_count, 1);
    assert.equal(a.price_delta, null);
    assert.deepEqual(a.prior_proposals, []);
    assert.equal(a.fingerprint_basis, "attrs");
    ok("first sighting is new, count 1, no delta, no prior proposals");

    const b = await recordSighting(tx, {
      kind: "event",
      title: "Chelsea Handler Live",
      url: "https://ticketmaster.com/ch-1",
      priceCents: 7525,
      currency: "USD",
      seller: "Ticketmaster",
      hints: show,
      goalId: goal.id,
    });
    assert.equal(b.status, "resighting");
    assert.equal(b.matched_by, "fingerprint");
    assert.equal(b.entity_id, a.entity_id);
    assert.equal(b.sighting_count, 2);
    assert.equal(b.price_delta?.delta_cents, -2475);
    assert.equal(b.price_delta?.delta_pct, -24.8);
    ok("same show from another seller is a re-sighting with a -$24.75 delta");

    const c = await recordSighting(tx, {
      kind: "event",
      title: "CH tickets",
      url: "https://seatgeek.com/ch/?fbclid=zz",
    });
    assert.equal(c.fingerprint_basis, "url");
    assert.equal(c.matched_by, "url");
    assert.equal(c.entity_id, a.entity_id);
    assert.equal(c.sighting_count, 3);
    assert.equal(c.price_delta, null, "no price on this sighting");
    ok("a thin sighting of a known canonical URL maps to the entity by URL");

    // A proposal for the entity: one live verdict, and a NEWER verdict that was undone.
    const [p] = (
      await tx.execute(
        sql`insert into proposals (goal_id, title, status, decided_at) values (${goal.id}, 'Chelsea Handler at The Masonic', 'reviewed_negative', now()) returning id`,
      )
    ).rows;
    await tx.execute(
      sql`insert into proposal_items (proposal_id, entity_id, price_cents) values (${p.id}, ${a.entity_id}, 10000)`,
    );
    await tx.execute(
      sql`insert into reviews (proposal_id, goal_id, verdict, reason_codes, note, created_at) values (${p.id}, ${goal.id}, 'strong_no', '{too_expensive}', 'over budget', now() - interval '1 hour')`,
    );
    await tx.execute(
      sql`insert into reviews (proposal_id, goal_id, verdict, reason_codes, created_at, undone_at) values (${p.id}, ${goal.id}, 'strong_yes', '{}', now(), now())`,
    );
    const [other] = (
      await tx.execute(sql`insert into proposals (title) values ('unrelated') returning id`)
    ).rows;
    const d = await recordSighting(tx, {
      kind: "event",
      title: "Chelsea Handler",
      url: "https://vividseats.com/ch",
      priceCents: 6900,
      currency: "USD",
      hints: show,
    });
    assert.equal(d.prior_proposals.length, 1);
    assert.equal(d.prior_proposals[0].proposal_id, p.id);
    assert.equal(d.prior_proposals[0].verdict, "strong_no", "the undone strong_yes must not count");
    assert.deepEqual(d.prior_proposals[0].reason_codes, ["too_expensive"]);
    assert.equal(d.prior_proposals[0].note, "over budget");
    assert.equal(d.prior_proposals[0].status, "reviewed_negative");
    assert.equal(
      d.price_delta?.previous_cents,
      7525,
      "delta is against the latest priced sighting",
    );
    assert.ok(other.id);
    ok(
      "prior proposals carry the latest verdict that was not undone, and only this entity's proposals",
    );

    // Merge: a second entity folded into the first.
    const [m] = (
      await tx.execute(
        sql`insert into entities (kind, fingerprint, title, merged_into_id) values ('event', 'event:handler|masonic|2026-11-14', 'dup', ${a.entity_id}) returning id`,
      )
    ).rows;
    const e = await recordSighting(tx, {
      kind: "event",
      title: "Handler",
      hints: { performer: "Handler", venue: "Masonic", startsAt: "2026-11-14" },
    });
    assert.equal(e.entity_id, a.entity_id, "a merged entity resolves to the survivor");
    assert.notEqual(e.entity_id, m.id);
    ok("a fingerprint of a merged entity resolves to the entity it was merged into");

    await assert.rejects(
      recordSighting(tx, {
        kind: "event",
        title: "x",
        goalId: "00000000-0000-4000-8000-000000000000",
      }),
      (err) => err instanceof SightingError && err.code === "goal_not_found" && err.status === 404,
    );
    await assert.rejects(
      recordSighting(tx, { kind: "event", title: "  ", url: "ftp://x" }),
      (err) => err instanceof SightingError && err.code === "unidentifiable",
    );
    ok("an unknown goal is a 404 and an unidentifiable sighting is refused");

    const after = {};
    for (const t of tables) after[t] = await count(tx, t);
    const diff = Object.fromEntries(tables.map((t) => [t, after[t] - before[t]]));
    assert.deepEqual(diff, {
      entities: 2,
      events: 1,
      sources: 3,
      sightings: 5,
      price_observations: 3,
      proposals: 2,
      proposal_items: 1,
      reviews: 2,
      goals: 0,
      agent_runs: 0,
      run_events: 0,
    });
    const [ent] = (
      await tx.execute(sql`select sighting_count from entities where id = ${a.entity_id}`)
    ).rows;
    assert.equal(ent.sighting_count, 5);
    ok(
      "write set: 1 entity (+1 merged fixture), 1 event row, 3 sources, 5 sightings, 3 prices; nothing in goals or runs",
    );
    throw ROLLBACK;
  });
} catch (err) {
  if (err !== ROLLBACK) {
    console.error(err);
    process.exitCode = 1;
  }
}
const left = (
  await client.query("select (select count(*) from entities) e, (select count(*) from sightings) s")
).rows[0];
console.log(`rolled back: entities=${left.e} sightings=${left.s}`);
await client.end();
console.log(`verify-record-sighting: ${passed} checks passed`);
