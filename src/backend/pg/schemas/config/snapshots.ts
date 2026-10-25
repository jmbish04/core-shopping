/**
 * @fileoverview `config_snapshots` (maestro cs-gap-config-asof): the
 * configuration as it stood when something was decided.
 *
 * The brief asks for exactly this: "HITL the review package prepared by the
 * agent upon delivery and/or asking for settings of that time period", in the
 * same breath as making the agents smarter from past logs.
 *
 * **Measured 2026-10-17:** `proposals` stored no config reference and the
 * thirteen config tables carry no version or history, so cs-be-3-2's briefing
 * would return whatever config is current. A proposal reviewed in March reads
 * today against today's budget, today's hotel brand rules and today's travel
 * windows — and a verdict explained by a rule since changed is unexplainable.
 *
 * **One snapshot table keyed by a content hash, not `valid_from` and
 * `valid_to` on thirteen tables.** That was the recommendation in the task and
 * it is the right one: a day of unchanged configuration costs ONE row rather
 * than thirteen pairs of bounds, a reader gets the whole configuration in one
 * read instead of thirteen as-of queries, and adding a fourteenth config table
 * does not need a migration on the history mechanism.
 *
 * The cost of that choice, stated: a snapshot is a copy, so a configuration
 * that changes often produces many rows. The hash is what keeps that bounded —
 * an identical configuration is the same row however many runs read it.
 */

import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const configSnapshots = pgTable(
  "config_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * sha256 of the canonical rendering. Unique, so reading unchanged
     * configuration a thousand times stores it once.
     */
    hash: text("hash").notNull().unique(),
    /** The configuration itself, canonicalised exactly as it was hashed. */
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    /** How many rows each table held, so a reader can see the shape at a glance. */
    tableCounts: jsonb("table_counts").notNull().default(sql`'{}'::jsonb`),
    /** When this configuration was FIRST seen. */
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("config_snapshots_captured_idx").on(t.capturedAt)],
);
export type ConfigSnapshotRow = typeof configSnapshots.$inferSelect;
