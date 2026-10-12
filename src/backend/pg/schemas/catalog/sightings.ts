/**
 * @fileoverview Observations (maestro cs-be-1-3): `sightings` (one entity seen
 * once by one run from one source), `price_observations` (price over time per
 * seller) and `images` (Cloudflare Images refs, deduped by source URL hash).
 */

import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { entities, sources } from "@/backend/pg/schemas/catalog/entities";
import { goals } from "@/backend/pg/schemas/goals/goals";
import { agentRuns } from "@/backend/pg/schemas/runs/runs";

export const sightings = pgTable(
  "sightings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    url: text("url"),
    urlCanonical: text("url_canonical"),
    urlHash: text("url_hash"),
    emailMessageId: text("email_message_id"),
    title: text("title").notNull(),
    /** Trimmed after 180 days by the retention cron. */
    excerpt: text("excerpt").notNull().default(""),
    priceCents: integer("price_cents"),
    msrpCents: integer("msrp_cents"),
    currency: text("currency"),
    onSale: boolean("on_sale"),
    availability: text("availability"),
    pointsPrice: integer("points_price"),
    pointsProgram: text("points_program"),
    agentScore: real("agent_score"),
    agentRationale: text("agent_rationale").notNull().default(""),
    criteriaMatch: jsonb("criteria_match").notNull().default(sql`'[]'::jsonb`),
    isResighting: boolean("is_resighting").notNull().default(false),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sightings_entity_seen_idx").on(t.entityId, t.seenAt),
    index("sightings_goal_seen_idx").on(t.goalId, t.seenAt),
    index("sightings_run_idx").on(t.runId),
    index("sightings_url_hash_idx").on(t.urlHash),
    index("sightings_email_idx").on(t.emailMessageId),
  ],
);

export const priceObservations = pgTable(
  "price_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    sightingId: uuid("sighting_id").references(() => sightings.id, { onDelete: "set null" }),
    seller: text("seller").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_obs_entity_at_idx").on(t.entityId, t.observedAt)],
);

export const images = pgTable(
  "images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "cascade" }),
    sightingId: uuid("sighting_id").references(() => sightings.id, { onDelete: "set null" }),
    sourceUrl: text("source_url").notNull(),
    sourceUrlHash: text("source_url_hash").notNull().unique(),
    cfImageId: text("cf_image_id"),
    variants: jsonb("variants").notNull().default(sql`'{}'::jsonb`),
    alt: text("alt").notNull().default(""),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("images_entity_idx").on(t.entityId)],
);
