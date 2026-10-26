/**
 * @fileoverview `wishlist_items` (maestro cs-gap-wishlist): a wanted thing as
 * a row.
 *
 * From the brief: "anticipating upcoming sales like Amazon Prime Day and
 * starting to pull out the most valuable and fun gifts that get burried in all
 * the noise and are perhaps even things on our wish list for a time coming (I
 * want a shark slurpee machine for example)".
 *
 * Before this, `cs-be-7-5` seeded "Prime Day wishlist" as a single GOAL, so a
 * wanted item was a sentence inside one goal's instruction text. Three things
 * followed from that, and all three are why this table exists rather than a
 * longer `goals.instructions`:
 *
 * - no run could match a sighting against an item, so nothing recorded that a
 *   find WAS the slurpee machine
 * - there was no per-item price history and no target price, so "worth buying
 *   now" could not be computed
 * - a second goal — Black Friday, a birthday sweep — could not read the same
 *   list without the sentences being copied into it
 *
 * **There is deliberately no goal link.** A wishlist row belongs to the
 * household, not to one goal, and the briefing slice hands the whole active
 * list to whichever goal is running. A `goal_wishlist_items` table would
 * reintroduce exactly the coupling that made the list prose inside one goal.
 * Filter by `category` when a goal only wants part of it.
 */

import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { entities } from "@/backend/pg/schemas/catalog/entities";
import { goalCategory } from "@/backend/pg/schemas/enums";
import { wishlistStatus } from "@/backend/pg/schemas/enums-config";
import { people } from "@/backend/pg/schemas/config/people";

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    /** Who it is for. Null means the household's. */
    forPersonId: uuid("for_person_id").references(() => people.id, { onDelete: "set null" }),
    /** Reuses the goal vocabulary, so a product goal can ask for product items. */
    category: goalCategory("category").notNull().default("product"),
    /**
     * What it is worth buying at. Null means no target has been set, which is
     * not a target of zero and must never read as "any price will do".
     */
    targetPriceCents: integer("target_price_cents"),
    /** List price, for the discount a sighting represents. */
    msrpCents: integer("msrp_cents"),
    currency: text("currency").notNull().default("USD"),
    /**
     * Requirements that disqualify a find, validated against
     * `WishlistRequirementSchema` at the write boundary. jsonb rather than a
     * table because it is a short list owned by one row, the same shape as
     * `sightings.criteria_match` and `itinerary_items.tips`.
     */
    hardRequirements: jsonb("hard_requirements").notNull().default(sql`'[]'::jsonb`),
    notes: text("notes").notNull().default(""),
    /** Set when a sighting is confirmed to BE this thing. */
    matchedEntityId: uuid("matched_entity_id").references(() => entities.id, { onDelete: "set null" }),
    status: wishlistStatus("status").notNull().default("wanted"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** The briefing asks for "the wanted items, newest first, by category". */
    index("wishlist_items_status_category_idx").on(t.status, t.category),
    index("wishlist_items_added_idx").on(t.addedAt),
    index("wishlist_items_person_idx").on(t.forPersonId),
    index("wishlist_items_matched_idx").on(t.matchedEntityId),
  ],
);
export type WishlistItemRow = typeof wishlistItems.$inferSelect;
