/**
 * @fileoverview Capturing and reading a configuration snapshot
 * (maestro cs-gap-config-asof).
 *
 * `captureConfigSnapshot` reads the thirteen configuration tables, renders
 * them canonically, hashes that, and stores the row only if the hash is new.
 * So reading unchanged configuration a thousand times stores it once, and
 * `cs-be-3-2`'s briefing can record the snapshot id it used on every run
 * without the table growing per run.
 *
 * `readConfigSnapshot` returns what was STORED. That is the whole point: a
 * proposal reviewed in March must read against March's hotel brand rules, not
 * today's. A lookup that quietly fell back to current configuration would
 * satisfy every type and be exactly the bug this table exists to prevent,
 * which is why `pnpm run verify:config-snapshot` plants that fallback and
 * watches it go red.
 */

import { asc, desc, eq, sql } from "drizzle-orm";

import type { PgDb } from "@/backend/pg/client";
import { sha256Hex } from "@/backend/catalog/canonical";
import {
  canonicalPayload,
  canonicalString,
  diffSnapshots,
  SNAPSHOT_TABLES,
  type SnapshotDiffEntry,
  type SnapshotPayload,
} from "@/backend/config/canonical";
import { configSnapshots } from "@/backend/pg/schemas/config/snapshots";
import { loyaltyAccounts, loyaltyPrograms, transferPartners } from "@/backend/pg/schemas/config/loyalty";
import { goalOccasions, occasions } from "@/backend/pg/schemas/config/occasions";
import { people, preferences } from "@/backend/pg/schemas/config/people";
import { tasteArtists, tasteGenres, venueStances } from "@/backend/pg/schemas/config/taste";
import { homeAirports, hotelBrandRules, travelWindows } from "@/backend/pg/schemas/config/travel";
import { wishlistItems } from "@/backend/pg/schemas/config/wishlist";

/** A stored snapshot, as a surface reads it. */
export interface ConfigSnapshot {
  id: string;
  hash: string;
  captured_at: string;
  table_counts: Record<string, number>;
  payload: SnapshotPayload;
}

/**
 * Read every configuration table.
 *
 * Ordered by id so the result is already stable before canonicalisation —
 * belt and braces, since `canonicalString` sorts too, but an ordered read also
 * makes the stored payload readable rather than arbitrary.
 *
 * @param db - A Drizzle client from `withPg`, or a transaction.
 * @returns Rows keyed by table name.
 */
export async function readConfigTables(db: PgDb): Promise<SnapshotPayload> {
  const [
    preferencesRows,
    peopleRows,
    brandRules,
    programs,
    accounts,
    partners,
    windows,
    airports,
    artists,
    genres,
    stances,
    wishlist,
    occasionRows,
    links,
  ] = await Promise.all([
    db.select().from(preferences).orderBy(asc(preferences.scope)),
    db.select().from(people).orderBy(asc(people.id)),
    db.select().from(hotelBrandRules).orderBy(asc(hotelBrandRules.id)),
    db.select().from(loyaltyPrograms).orderBy(asc(loyaltyPrograms.id)),
    db.select().from(loyaltyAccounts).orderBy(asc(loyaltyAccounts.id)),
    db.select().from(transferPartners).orderBy(asc(transferPartners.id)),
    db.select().from(travelWindows).orderBy(asc(travelWindows.id)),
    db.select().from(homeAirports).orderBy(asc(homeAirports.id)),
    db.select().from(tasteArtists).orderBy(asc(tasteArtists.id)),
    db.select().from(tasteGenres).orderBy(asc(tasteGenres.id)),
    db.select().from(venueStances).orderBy(asc(venueStances.id)),
    db.select().from(wishlistItems).orderBy(asc(wishlistItems.id)),
    db.select().from(occasions).orderBy(asc(occasions.id)),
    db.select().from(goalOccasions).orderBy(asc(goalOccasions.goalId)),
  ]);

  return {
    preferences: preferencesRows as Array<Record<string, unknown>>,
    people: peopleRows as Array<Record<string, unknown>>,
    hotel_brand_rules: brandRules as Array<Record<string, unknown>>,
    loyalty_programs: programs as Array<Record<string, unknown>>,
    loyalty_accounts: accounts as Array<Record<string, unknown>>,
    transfer_partners: partners as Array<Record<string, unknown>>,
    travel_windows: windows as Array<Record<string, unknown>>,
    home_airports: airports as Array<Record<string, unknown>>,
    taste_artists: artists as Array<Record<string, unknown>>,
    taste_genres: genres as Array<Record<string, unknown>>,
    venue_stances: stances as Array<Record<string, unknown>>,
    wishlist_items: wishlist as Array<Record<string, unknown>>,
    occasions: occasionRows as Array<Record<string, unknown>>,
    goal_occasions: links as Array<Record<string, unknown>>,
  };
}

function toView(row: {
  id: string;
  hash: string;
  capturedAt: Date | string;
  tableCounts: unknown;
  payload: unknown;
}): ConfigSnapshot {
  return {
    id: row.id,
    hash: row.hash,
    captured_at: row.capturedAt instanceof Date ? row.capturedAt.toISOString() : String(row.capturedAt),
    table_counts: (row.tableCounts ?? {}) as Record<string, number>,
    payload: (row.payload ?? {}) as SnapshotPayload,
  };
}

/**
 * Capture the current configuration, reusing the row when nothing has changed.
 *
 * @param tx - An open transaction. This function never opens its own, so a
 *   caller can record the snapshot id on the run it is already writing.
 * @returns The snapshot and whether this call was the first to see it.
 * @example
 * ```typescript
 * const { snapshot, created } = await captureConfigSnapshot(tx);
 * await tx.update(agentRuns).set({ configSnapshotId: snapshot.id })...
 * ```
 */
export async function captureConfigSnapshot(
  tx: PgDb,
): Promise<{ snapshot: ConfigSnapshot; created: boolean }> {
  const raw = await readConfigTables(tx);
  const payload = canonicalPayload(raw);
  const hash = await sha256Hex(canonicalString(raw));
  const tableCounts = Object.fromEntries(
    SNAPSHOT_TABLES.map((table) => [table, (payload[table] ?? []).length]),
  );

  const existing = await tx
    .select({
      id: configSnapshots.id,
      hash: configSnapshots.hash,
      capturedAt: configSnapshots.capturedAt,
      tableCounts: configSnapshots.tableCounts,
      payload: configSnapshots.payload,
    })
    .from(configSnapshots)
    .where(eq(configSnapshots.hash, hash))
    .limit(1);
  if (existing[0]) return { snapshot: toView(existing[0]), created: false };

  const [inserted] = await tx
    .insert(configSnapshots)
    .values({ hash, payload, tableCounts })
    .onConflictDoNothing({ target: configSnapshots.hash })
    .returning({
      id: configSnapshots.id,
      hash: configSnapshots.hash,
      capturedAt: configSnapshots.capturedAt,
      tableCounts: configSnapshots.tableCounts,
      payload: configSnapshots.payload,
    });
  if (inserted) return { snapshot: toView(inserted), created: true };

  // Another writer inserted the same hash between the select and the insert.
  // Reading it back is correct rather than an error: the row they wrote is the
  // row this call wanted.
  const [raced] = await tx
    .select({
      id: configSnapshots.id,
      hash: configSnapshots.hash,
      capturedAt: configSnapshots.capturedAt,
      tableCounts: configSnapshots.tableCounts,
      payload: configSnapshots.payload,
    })
    .from(configSnapshots)
    .where(eq(configSnapshots.hash, hash))
    .limit(1);
  if (!raced) throw new Error("Config snapshot vanished between insert and read");
  return { snapshot: toView(raced), created: false };
}

/**
 * Read a stored snapshot by id.
 *
 * Returns what was STORED, never current configuration. A null means no such
 * snapshot, which a caller must not read as "use today's" — that is the defect
 * this whole table exists to prevent.
 *
 * @param db - A Drizzle client or transaction.
 * @param id - The snapshot id.
 * @returns The snapshot, or null when there is none.
 */
export async function readConfigSnapshot(db: PgDb, id: string): Promise<ConfigSnapshot | null> {
  const [row] = await db
    .select({
      id: configSnapshots.id,
      hash: configSnapshots.hash,
      capturedAt: configSnapshots.capturedAt,
      tableCounts: configSnapshots.tableCounts,
      payload: configSnapshots.payload,
    })
    .from(configSnapshots)
    .where(eq(configSnapshots.id, id))
    .limit(1);
  return row ? toView(row) : null;
}

/** The newest snapshot, or null when none has been captured. */
export async function latestConfigSnapshot(db: PgDb): Promise<ConfigSnapshot | null> {
  const [row] = await db
    .select({
      id: configSnapshots.id,
      hash: configSnapshots.hash,
      capturedAt: configSnapshots.capturedAt,
      tableCounts: configSnapshots.tableCounts,
      payload: configSnapshots.payload,
    })
    .from(configSnapshots)
    .orderBy(desc(configSnapshots.capturedAt))
    .limit(1);
  return row ? toView(row) : null;
}

/**
 * What has changed between a stored snapshot and the configuration now.
 *
 * This is what turns "the settings at the time" into an answer rather than two
 * JSON blobs side by side: a verdict explained by a rule since changed becomes
 * explainable again, with the rule named and both values shown.
 *
 * @param db - A Drizzle client or transaction.
 * @param id - The stored snapshot to compare against.
 * @returns The snapshot, the current hash, and every difference.
 * @throws {Error} When the snapshot does not exist, rather than diffing
 *   against nothing and reporting "no changes".
 */
export async function diffConfigSnapshotAgainstNow(
  db: PgDb,
  id: string,
): Promise<{
  snapshot: ConfigSnapshot;
  current_hash: string;
  unchanged: boolean;
  changes: SnapshotDiffEntry[];
}> {
  const snapshot = await readConfigSnapshot(db, id);
  // Diffing a missing snapshot against current config would report "no
  // changes", which reads as "nothing has moved" when the truth is "we never
  // recorded what it was".
  if (!snapshot) throw new Error(`No config snapshot ${id}`);

  const raw = await readConfigTables(db);
  const currentHash = await sha256Hex(canonicalString(raw));
  return {
    snapshot,
    current_hash: currentHash,
    unchanged: currentHash === snapshot.hash,
    changes: diffSnapshots(snapshot.payload, canonicalPayload(raw)),
  };
}

/**
 * The snapshot a proposal was judged against, by proposal id.
 *
 * Null when the proposal predates this mechanism, which a surface must show as
 * "not recorded" rather than silently rendering today's settings beside an old
 * verdict.
 *
 * @param db - A Drizzle client or transaction.
 * @param proposalId - The proposal.
 * @returns The snapshot, or null when the proposal recorded none.
 */
export async function configSnapshotForProposal(
  db: PgDb,
  proposalId: string,
): Promise<ConfigSnapshot | null> {
  const [row] = await db.execute(
    sql`select config_snapshot_id::text as id from proposals where id = ${proposalId}`,
  ).then((result) => result.rows as Array<{ id: string | null }>);
  if (!row?.id) return null;
  return readConfigSnapshot(db, row.id);
}
