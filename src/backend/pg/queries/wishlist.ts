/**
 * @fileoverview The wishlist slice a briefing hands to an agent
 * (maestro cs-gap-wishlist).
 *
 * `cs-be-3-2`'s briefing tool does not exist yet, so this is the slice it will
 * compose rather than a change to a payload that is not there. Shipping the
 * table without it would be shipping a table nothing reads.
 *
 * **The slice is not goal-scoped, and that is the whole point of the task.**
 * The brief wants one list that several sweeps read: a Prime Day goal and a
 * Black Friday goal both want the slurpee machine, and before this the item
 * was a sentence inside ONE goal's instructions, so the second goal could only
 * have it by copying the sentence. `wishlistForBriefing` therefore takes an
 * optional category filter and nothing else — a goal id would reintroduce the
 * coupling the task exists to remove.
 *
 * Three things it reports that an agent cannot work out for itself:
 *
 * - **the best price ever seen for the matched entity**, so "worth buying now"
 *   has something to compare against. Null when nothing has been priced, which
 *   is not a price of zero.
 * - **whether the target has ever been met**, as a fact rather than a
 *   comparison the agent repeats. Null when there is no target or no price:
 *   "no target set" and "target never met" are different answers and a
 *   boolean would merge them.
 * - **how many times it has been seen**, so an item nobody has found reads
 *   differently from one found and rejected ten times.
 */

import { and, eq, inArray, sql, type SQL } from "drizzle-orm";

import type { PgDb } from "@/backend/pg/client";
import type { GoalCategory } from "@/shared/contracts/goals";
import type { WishlistStatus } from "@/shared/contracts/config";
import { priceObservations, sightings } from "@/backend/pg/schemas/catalog/sightings";
import { wishlistItems } from "@/backend/pg/schemas/config/wishlist";

/** One wishlist row as a briefing states it. */
export interface WishlistBriefingItem {
  id: string;
  label: string;
  category: string;
  status: string;
  for_person_id: string | null;
  target_price_cents: number | null;
  msrp_cents: number | null;
  currency: string;
  hard_requirements: unknown;
  notes: string;
  matched_entity_id: string | null;
  /** The lowest price ever observed for the matched entity. Null when none. */
  best_price_cents: number | null;
  /**
   * Whether `best_price_cents` has ever reached `target_price_cents`.
   * Null when there is no target, or nothing has been priced — "no target"
   * and "target never met" are different and must not both read as false.
   */
  target_met: boolean | null;
  /** How many sightings have been recorded against this row. */
  sighting_count: number;
  added_at: string;
}

/**
 * The wishlist a briefing should hand to an agent.
 *
 * Only `wanted` items by default. `acquired` and `dropped` rows are kept
 * rather than deleted precisely so a later sweep does not re-propose something
 * already bought or already turned down, so handing them to an agent would
 * undo that.
 *
 * @param db - A Drizzle client from `withPg`, or a transaction.
 * @param options - Optional category filter and status override.
 * @returns The items, newest first, with their price and match facts.
 * @example
 * ```typescript
 * // What a Prime Day goal's briefing gets.
 * await wishlistForBriefing(db, { categories: ["product", "gift"] });
 * // What a Black Friday goal's briefing gets: the same rows.
 * await wishlistForBriefing(db, { categories: ["product", "gift"] });
 * ```
 */
export async function wishlistForBriefing(
  db: PgDb,
  options: { categories?: readonly GoalCategory[]; statuses?: readonly WishlistStatus[] } = {},
): Promise<WishlistBriefingItem[]> {
  const statuses: WishlistStatus[] = [...(options.statuses ?? ["wanted"])];
  const where: SQL[] = [inArray(wishlistItems.status, statuses)];
  if (options.categories && options.categories.length > 0) {
    where.push(inArray(wishlistItems.category, [...options.categories]));
  }

  /**
   * Correlated on the OUTER row, so the reference must be written as
   * `"wishlist_items"."matched_entity_id"`. Drizzle writes a bare column name
   * for a column of the subselect's own single table, which inside
   * `select ... from price_observations` would bind to that table instead —
   * the defect fixed in maestro `067a29e7ed5b`, and the reason `qualified()`
   * exists in `routes/shopping/runs.ts`.
   */
  const outerMatchedEntity = sql`"wishlist_items"."matched_entity_id"`;
  const outerId = sql`"wishlist_items"."id"`;

  const bestPrice = sql<number | null>`(
    select min(${priceObservations.priceCents})::int
    from ${priceObservations}
    where ${priceObservations.entityId} = ${outerMatchedEntity}
  )`;
  const sightingCount = sql<number>`(
    select count(*)::int from ${sightings} where ${sightings.wishlistItemId} = ${outerId}
  )`;

  const rows = await db
    .select({
      id: wishlistItems.id,
      label: wishlistItems.label,
      category: wishlistItems.category,
      status: wishlistItems.status,
      forPersonId: wishlistItems.forPersonId,
      targetPriceCents: wishlistItems.targetPriceCents,
      msrpCents: wishlistItems.msrpCents,
      currency: wishlistItems.currency,
      hardRequirements: wishlistItems.hardRequirements,
      notes: wishlistItems.notes,
      matchedEntityId: wishlistItems.matchedEntityId,
      addedAt: wishlistItems.addedAt,
      bestPriceCents: bestPrice,
      sightingCount,
    })
    .from(wishlistItems)
    .where(and(...where))
    .orderBy(sql`${wishlistItems.addedAt} desc`);

  return rows.map((row) => {
    const best = row.bestPriceCents == null ? null : Number(row.bestPriceCents);
    const target = row.targetPriceCents;
    return {
      id: row.id,
      label: row.label,
      category: row.category,
      status: row.status,
      for_person_id: row.forPersonId,
      target_price_cents: target,
      msrp_cents: row.msrpCents,
      currency: row.currency,
      hard_requirements: row.hardRequirements,
      notes: row.notes,
      matched_entity_id: row.matchedEntityId,
      best_price_cents: best,
      // Both unknowns stay null: no target set, and nothing priced yet.
      target_met: target == null || best == null ? null : best <= target,
      sighting_count: Number(row.sightingCount),
      added_at: row.addedAt instanceof Date ? row.addedAt.toISOString() : String(row.addedAt),
    };
  });
}

/**
 * Record that a sighting IS a wishlist item.
 *
 * Separate from `recordSighting` because the match is a judgement an agent or
 * a person makes, not something a string comparison decides: a listing called
 * "Slushy Magic" may be the shark slurpee machine, and that call should be
 * made once and stored rather than re-derived by every reader. An `acquired`
 * item also gets its `matched_entity_id` from here when it has none.
 *
 * @param db - A Drizzle client from `withPg`, or a transaction.
 * @param sightingId - The sighting that matched.
 * @param wishlistItemId - The row it matched.
 * @returns The sighting's entity, and the item it was linked to.
 * @throws {Error} When either row does not exist, rather than linking an orphan.
 */
export async function linkSightingToWishlist(
  db: PgDb,
  sightingId: string,
  wishlistItemId: string,
): Promise<{ sighting_id: string; wishlist_item_id: string; entity_id: string }> {
  const [item] = await db
    .select({ id: wishlistItems.id, matchedEntityId: wishlistItems.matchedEntityId })
    .from(wishlistItems)
    .where(eq(wishlistItems.id, wishlistItemId))
    .limit(1);
  if (!item) throw new Error(`No wishlist item ${wishlistItemId}`);

  const [updated] = await db
    .update(sightings)
    .set({ wishlistItemId })
    .where(eq(sightings.id, sightingId))
    .returning({ id: sightings.id, entityId: sightings.entityId });
  if (!updated) throw new Error(`No sighting ${sightingId}`);

  // The first match also tells the item which entity it is, so a later
  // briefing can price it. A match already recorded is never overwritten: the
  // first identification stands until a person changes it.
  if (!item.matchedEntityId) {
    await db
      .update(wishlistItems)
      .set({ matchedEntityId: updated.entityId, updatedAt: new Date() })
      .where(eq(wishlistItems.id, wishlistItemId));
  }

  return {
    sighting_id: updated.id,
    wishlist_item_id: wishlistItemId,
    entity_id: updated.entityId,
  };
}
