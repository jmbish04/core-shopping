/**
 * @fileoverview `taste_artists`, `taste_genres` and `venue_stances`
 * (maestro cs-be-1-6) — what is wanted, and what is not.
 *
 * `source` is the field that keeps this honest. The brief asks for two
 * different things in one breath: "listing of some of our favoirte artist and
 * comedians like adele, pink, chelsea handler" (stated, `manual`) and
 * "flagging bands/comedians that we may like due to similialiarty with what we
 * are already listening to but may not have yet discovered" (a guess, `agent`
 * or `spotify`). A guess quoted back as a stated preference is how an agent
 * starts confidently recommending the wrong thing.
 *
 * All three tables key on a NAME with an OPTIONAL `entity_id`, because taste
 * is stated before anything has been seen. "japan may be played out" is config
 * that exists months before any `destination` entity does, so requiring a
 * foreign key would make the row unwritable at the only moment it is written.
 */

import { date, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { entities } from "@/backend/pg/schemas/catalog/entities";
import { performerType } from "@/backend/pg/schemas/enums";
import { placeKind, placeStance, tasteAffinity, tasteSource, tasteTier } from "@/backend/pg/schemas/enums-config";
import { people } from "@/backend/pg/schemas/config/people";

/**
 * A performer worth watching for.
 *
 * `affinity` of `would_travel` is a real, load-bearing case and not a
 * superlative: "I would fly my husband anywhere in the world to see sammy
 * cheng with him" means a Sammy Cheng date anywhere clears the location gate
 * that every other performer has to pass.
 */
export const tasteArtists = pgTable(
  "taste_artists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    performerType: performerType("performer_type").notNull().default("artist"),
    tier: tasteTier("tier").notNull().default("unknown"),
    affinity: tasteAffinity("affinity").notNull().default("like"),
    /** Whose favourite. Null means the household's. */
    forPersonId: uuid("for_person_id").references(() => people.id, { onDelete: "cascade" }),
    source: tasteSource("source").notNull().default("manual"),
    spotifyArtistId: text("spotify_artist_id").notNull().default(""),
    /** Linked once a sighting creates the performer entity. */
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "set null" }),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /**
     * `nulls not distinct` so a household row cannot be inserted twice. The
     * default Postgres behaviour treats every NULL as unique, which would let
     * "Adele" exist four times with a null `for_person_id` and each copy
     * carrying a different affinity.
     */
    unique("taste_artists_name_person_key").on(t.name, t.performerType, t.forPersonId).nullsNotDistinct(),
    index("taste_artists_affinity_idx").on(t.affinity, t.tier),
    index("taste_artists_source_idx").on(t.source),
    index("taste_artists_entity_idx").on(t.entityId),
  ],
);
export type TasteArtistRow = typeof tasteArtists.$inferSelect;

/** A genre, with how much it is wanted. Filled by hand and by the Spotify sync. */
export const tasteGenres = pgTable(
  "taste_genres",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    affinity: tasteAffinity("affinity").notNull().default("like"),
    forPersonId: uuid("for_person_id").references(() => people.id, { onDelete: "cascade" }),
    source: tasteSource("source").notNull().default("manual"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("taste_genres_name_person_key").on(t.name, t.forPersonId).nullsNotDistinct(),
    index("taste_genres_affinity_idx").on(t.affinity),
  ],
);
export type TasteGenreRow = typeof tasteGenres.$inferSelect;

/**
 * A stance toward a place.
 *
 * NAMED for venues, because cs-be-1-6 names it `venue_stances`, but it has to
 * hold countries to answer the brief — "japan may be played out at this piont
 * given my husband has been twice recently and i have been the 2nd leg with
 * him" is the clearest stance in the whole document and it is about a country.
 * `place_kind` therefore states what the row is about rather than leaving it
 * implied by the table name. Whether the table should be renamed
 * `place_stances` is a product call, raised with cs-be-1-6 rather than decided
 * here.
 *
 * `until` matters because `played_out` is temporary. Japan being played out in
 * 2026 says nothing about 2029, and a stance with no expiry quietly becomes
 * permanent — the agent would stop proposing Japan forever on the strength of
 * one sentence.
 */
export const venueStances = pgTable(
  "venue_stances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeName: text("place_name").notNull(),
    placeKind: placeKind("place_kind").notNull().default("destination"),
    stance: placeStance("stance").notNull(),
    reason: text("reason").notNull().default(""),
    /** When the stance stops applying. Null means it stands until changed. */
    until: date("until"),
    forPersonId: uuid("for_person_id").references(() => people.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("venue_stances_place_person_key").on(t.placeName, t.placeKind, t.forPersonId).nullsNotDistinct(),
    index("venue_stances_stance_idx").on(t.stance, t.placeKind),
    /** "Which stances are in force today" needs the expiry indexed. */
    index("venue_stances_until_idx").on(t.until),
    index("venue_stances_entity_idx").on(t.entityId),
  ],
);
export type VenueStanceRow = typeof venueStances.$inferSelect;
