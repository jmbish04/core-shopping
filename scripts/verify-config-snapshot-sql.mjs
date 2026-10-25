/**
 * Run the configuration snapshot against the REAL database, with rows seeded
 * inside a transaction that is rolled back (maestro cs-gap-config-asof).
 *
 * The task's own bar is three clauses, and each is a check below:
 *
 * 1. "a run records the snapshot it read"
 * 2. "changing a hotel brand rule does not change what a past proposal is
 *    shown against"
 * 3. "a test that makes the snapshot lookup return current config goes red"
 *
 * The third is the one that matters, because a lookup that quietly falls back
 * to current configuration satisfies every type and is exactly the bug this
 * table exists to prevent. It is planted at the end of the plant-break run and
 * watched go red.
 *
 * None of this is provable on empty tables: with no configuration there is
 * nothing to change, and a snapshot of nothing equals a snapshot of nothing
 * however broken the hashing is. So the fixture writes real configuration,
 * snapshots it, changes it, and snapshots it again.
 *
 * Needs the LAN and the owner password. Run it with
 * `pnpm run verify:config-snapshot`.
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
const {
  captureConfigSnapshot,
  configSnapshotForProposal,
  diffConfigSnapshotAgainstNow,
  readConfigSnapshot,
} = await import("../src/backend/pg/queries/config-snapshot.ts");

const TOKEN = `vcs${Date.now().toString(36)}`;
const R = (n) => `e7000000-0000-4000-8000-00000000000${n}`;
const GOAL = "e8000000-0000-4000-8000-000000000001";
const RUN = "e9000000-0000-4000-8000-000000000001";
const PROP = "ea000000-0000-4000-8000-000000000001";

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
    // Real configuration: a hotel rule, a travel window, a preference row.
    await tx.execute(sql`
      insert into hotel_brand_rules (id, brand, stance, reason) values
        (${R(1)}, ${`${TOKEN}-Hilton`}, 'avoid',   'Dead bugs in the sheets, Palm Springs'),
        (${R(2)}, ${`${TOKEN}-Hyatt`},  'prefer',  'Clean and near transit')
    `);
    await tx.execute(sql`
      insert into travel_windows (label, stance, starts_on, ends_on, recurs_yearly)
      values (${`${TOKEN} December`}, 'frowned', '2024-12-01', '2024-12-31', true)
    `);
    await tx.execute(sql`
      insert into preferences (scope, min_trip_nights, max_trip_nights)
      values (${`${TOKEN}-household`}, 12, 24)
    `);

    // --- capture, and the dedupe that makes the table affordable -----------

    const first = await captureConfigSnapshot(tx);
    check("capturing stores a snapshot", first.created, true);
    check("with a sha256 hash", first.snapshot.hash.length, 64);
    check(
      "and the rows it captured, counted per table",
      [first.snapshot.table_counts.hotel_brand_rules >= 2, first.snapshot.table_counts.travel_windows >= 1],
      [true, true],
    );

    const again = await captureConfigSnapshot(tx);
    check("capturing UNCHANGED configuration reuses the row", again.created, false);
    check("so the id is the same", again.snapshot.id, first.snapshot.id);
    check("and the hash is the same", again.snapshot.hash, first.snapshot.hash);
    check(
      "so a day of unchanged config costs one row, not one per read",
      Number(
        (await tx.execute(sql`select count(*)::int as n from config_snapshots where hash = ${first.snapshot.hash}`))
          .rows[0].n,
      ),
      1,
    );

    /**
     * Touching updated_at alone must not mint a snapshot.
     *
     * NOT `now()`: that is the TRANSACTION's timestamp and is constant inside
     * one, so `set updated_at = now()` is a no-op here and the assertion below
     * could never fail. A literal far from the insert time makes the touch
     * real. Measured 2026-10-25 — written with `now()`, this check was
     * pre-satisfied and hid a genuine bug in the volatile-column filter.
     */
    await tx.execute(
      sql`update hotel_brand_rules set updated_at = '2099-12-31T00:00:00Z'::timestamptz where id = ${R(1)}`,
    );
    const touched = await captureConfigSnapshot(tx);
    check("touching updated_at alone does not make a new snapshot", touched.snapshot.id, first.snapshot.id);
    check(
      "and the stored payload carries no timestamp columns at all",
      touched.snapshot.payload.hotel_brand_rules.flatMap((row) =>
        Object.keys(row).filter((key) => /^(created|updated)_?[Aa]t$/.test(key)),
      ),
      [],
    );

    // --- clause 1: a run records the snapshot it read ----------------------

    await tx.execute(sql`
      insert into goals (id, slug, title, category, status)
      values (${GOAL}, ${`${TOKEN}-goal`}, ${`${TOKEN} goal`}, 'travel', 'active')
    `);
    await tx.execute(sql`
      insert into agent_runs (id, client, status, config_snapshot_id)
      values (${RUN}, 'claude', 'succeeded', ${first.snapshot.id})
    `);
    check(
      "a run records the snapshot it read",
      String(
        (await tx.execute(sql`select config_snapshot_id::text as id from agent_runs where id = ${RUN}`))
          .rows[0].id,
      ),
      first.snapshot.id,
    );

    await tx.execute(sql`
      insert into proposals (id, goal_id, run_id, kind, status, title, config_snapshot_id)
      values (${PROP}, ${GOAL}, ${RUN}, 'trip', 'reviewed_negative', ${`${TOKEN} a trip`}, ${first.snapshot.id})
    `);
    const forProposal = await configSnapshotForProposal(tx, PROP);
    check("and so does a proposal", forProposal?.id, first.snapshot.id);

    // --- clause 2: changing a rule does not change the past ----------------

    const storedStanceBefore = forProposal.payload.hotel_brand_rules.find((r) => r.id === R(1))?.stance;
    check("the stored snapshot holds the rule as it was", storedStanceBefore, "avoid");

    await tx.execute(sql`update hotel_brand_rules set stance = 'prefer' where id = ${R(1)}`);

    const afterChange = await configSnapshotForProposal(tx, PROP);
    check(
      "changing the rule does NOT change what the past proposal is shown against",
      afterChange.payload.hotel_brand_rules.find((r) => r.id === R(1))?.stance,
      "avoid",
    );
    check("and the snapshot is still the same row", afterChange.id, first.snapshot.id);
    check(
      "while the live table really did change",
      String(
        (await tx.execute(sql`select stance::text as s from hotel_brand_rules where id = ${R(1)}`)).rows[0].s,
      ),
      "prefer",
    );

    const second = await captureConfigSnapshot(tx);
    check("capturing now mints a NEW snapshot", second.created, true);
    check("with a different hash", second.snapshot.hash === first.snapshot.hash, false);
    check(
      "and it holds the new stance",
      second.snapshot.payload.hotel_brand_rules.find((r) => r.id === R(1))?.stance,
      "prefer",
    );

    // --- the diff, which is what makes the verdict explainable again -------

    const diff = await diffConfigSnapshotAgainstNow(tx, first.snapshot.id);
    check("a past snapshot is not unchanged once config has moved", diff.unchanged, false);
    const ruleChange = diff.changes.find(
      (c) => c.table === "hotel_brand_rules" && c.row === `id:${R(1)}`,
    );
    check("the diff names the rule that changed", ruleChange?.change, "changed");
    check(
      "and shows both values, so a verdict explained by it is explainable again",
      ruleChange?.fields,
      [{ field: "stance", before: "avoid", after: "prefer" }],
    );
    check(
      "and reports nothing about the rule that did not change",
      diff.changes.some((c) => c.row === `id:${R(2)}`),
      false,
    );

    const selfDiff = await diffConfigSnapshotAgainstNow(tx, second.snapshot.id);
    check("the newest snapshot diffs clean against now", selfDiff.unchanged, true);
    check("with no changes listed", selfDiff.changes, []);

    // --- absence is never a verdict ----------------------------------------

    check(
      "a proposal that recorded no snapshot reports null, not today's config",
      await configSnapshotForProposal(tx, PROP).then(async () => {
        await tx.execute(sql`update proposals set config_snapshot_id = null where id = ${PROP}`);
        return configSnapshotForProposal(tx, PROP);
      }),
      null,
    );
    await tx.execute(sql`update proposals set config_snapshot_id = ${first.snapshot.id} where id = ${PROP}`);

    check(
      "an unknown snapshot id reads as null, not as an empty config",
      await readConfigSnapshot(tx, "e7000000-0000-4000-8000-0000000000ff"),
      null,
    );

    let missingDiff = "diffed";
    try {
      await diffConfigSnapshotAgainstNow(tx, "e7000000-0000-4000-8000-0000000000ff");
    } catch (error) {
      missingDiff = /No config snapshot/.test(String(error.message)) ? "refused" : "other";
    }
    check(
      "diffing a snapshot that does not exist is refused, never reported as 'no changes'",
      missingDiff,
      "refused",
    );

    // --- a referenced snapshot cannot be deleted ---------------------------

    let deleteRefused = "deleted";
    try {
      await tx.transaction((inner) =>
        inner.execute(sql`delete from config_snapshots where id = ${first.snapshot.id}`),
      );
    } catch (error) {
      /**
       * Drizzle WRAPS the pg error, so the constraint message is on
       * `error.cause`, not `error.message` — `error.message` is only "Failed
       * query: ..." plus the params. Matching on `error.message` alone made
       * this assertion fail while the restrict was working perfectly, which is
       * a check reporting its own blindness as a defect in the code.
       */
      const message = `${error?.message ?? ""} ${error?.cause?.message ?? ""}`;
      deleteRefused = /violates foreign key constraint/.test(message) ? "refused" : "other";
    }
    check(
      "a snapshot a proposal depends on cannot be deleted",
      deleteRefused,
      "refused",
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
    `select (select count(*)::int from hotel_brand_rules where brand like 'vcs%')
          + (select count(*)::int from travel_windows where label like 'vcs%')
          + (select count(*)::int from preferences where scope like 'vcs%')
          + (select count(*)::int from goals where slug like 'vcs%')
          + (select count(*)::int from config_snapshots) as n`,
  );
  console.log(`\nrolled back; seeded rows left in the database: ${left.rows[0].n}`);
  assert.equal(left.rows[0].n, 0, "the transaction must leave nothing behind");
  await client.end();
}

if (fails.length) {
  console.error(`\n${fails.length} check(s) failed:\n - ${fails.join("\n - ")}`);
  process.exit(1);
}
console.log("\nverify-config-snapshot-sql: ok");
