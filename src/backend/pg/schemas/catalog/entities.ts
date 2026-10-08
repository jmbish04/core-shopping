/**
 * @fileoverview Canonical catalog (maestro cs-be-1-3): `sources`, `entities`
 * (the thing itself, deduplicated by fingerprint and, semantically, by a
 * 384-dim embedding from core-guardian bge-small) and the 1:1 kind tables.
 *
 * Embeddings are written only when `content_hash` changes (cs-be-4-2) — the
 * hash column is how a re-sighting skips paying for another embed.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
  vector,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { cabinClass, entityKind, performerType, sourceKind } from "@/backend/pg/schemas/enums";

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: sourceKind("kind").notNull(),
    domain: text("domain").notNull(),
    label: text("label").notNull().default(""),
    /** 0..1, how much a tip from here is worth; null until rated. */
    reputation: real("reputation"),
  },
  (t) => [unique("sources_kind_domain_uq").on(t.kind, t.domain)],
);

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: entityKind("kind").notNull(),
    fingerprint: text("fingerprint").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    attrs: jsonb("attrs").notNull().default(sql`'{}'::jsonb`),
    contentHash: text("content_hash"),
    embedding: vector("embedding", { dimensions: 384 }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    sightingCount: integer("sighting_count").notNull().default(0),
    /** Set when a merge folds this entity into another. */
    mergedIntoId: uuid("merged_into_id").references((): AnyPgColumn => entities.id, { onDelete: "set null" }),
  },
  (t) => [
    index("entities_kind_last_seen_idx").on(t.kind, t.lastSeenAt),
    index("entities_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

const entityPk = () =>
  uuid("entity_id")
    .primaryKey()
    .references(() => entities.id, { onDelete: "cascade" });

export const performers = pgTable("performers", {
  entityId: entityPk(),
  name: text("name").notNull(),
  performerType: performerType("performer_type").notNull().default("artist"),
  spotifyId: text("spotify_id"),
  genres: text("genres").array().notNull().default(sql`'{}'::text[]`),
});

export const venues = pgTable("venues", {
  entityId: entityPk(),
  name: text("name").notNull(),
  city: text("city").notNull().default(""),
  region: text("region").notNull().default(""),
  country: text("country").notNull().default(""),
  lat: real("lat"),
  lng: real("lng"),
});

export const events = pgTable(
  "events",
  {
    entityId: entityPk(),
    performerEntityId: uuid("performer_entity_id").references(() => entities.id, { onDelete: "set null" }),
    venueEntityId: uuid("venue_entity_id").references(() => entities.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    city: text("city").notNull().default(""),
    /** When ticket sales close, for "deal ending soon" alerts. */
    salesEndAt: timestamp("sales_end_at", { withTimezone: true }),
  },
  (t) => [index("events_starts_idx").on(t.startsAt), index("events_performer_idx").on(t.performerEntityId)],
);

export const products = pgTable("products", {
  entityId: entityPk(),
  brand: text("brand").notNull().default(""),
  model: text("model").notNull().default(""),
  variant: text("variant").notNull().default(""),
  msrpCents: integer("msrp_cents"),
  currency: text("currency").notNull().default("USD"),
  specs: jsonb("specs").notNull().default(sql`'{}'::jsonb`),
});

export const flights = pgTable(
  "flights",
  {
    entityId: entityPk(),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    carrier: text("carrier").notNull().default(""),
    cabin: cabinClass("cabin"),
    departOn: date("depart_on"),
    returnOn: date("return_on"),
    nonstop: boolean("nonstop"),
    /** e.g. "Mint Suite", "Mint Studio". */
    seatProduct: text("seat_product").notNull().default(""),
  },
  (t) => [index("flights_route_idx").on(t.origin, t.destination, t.departOn)],
);

export const hotels = pgTable("hotels", {
  entityId: entityPk(),
  brand: text("brand").notNull().default(""),
  propertyName: text("property_name").notNull(),
  city: text("city").notNull().default(""),
  country: text("country").notNull().default(""),
  starRating: real("star_rating"),
  transitNote: text("transit_note").notNull().default(""),
});
