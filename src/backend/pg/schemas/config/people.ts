/**
 * @fileoverview `people` and `preferences` (maestro cs-be-1-6): who the
 * shopping is for, and the household's ROI gate as numbers.
 *
 * The split is deliberate. Person-specific facts — Jason's home country, what
 * he treats himself to — live on `people`, so `preferences` stays a single
 * household row and never needs a per-person copy. The brief's barriers are
 * all stated as "we": away at least a week and a half, enough time since the
 * last trip, business for at least one leg, a hotel that is clean and safe.
 */

import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { cabinClass } from "@/backend/pg/schemas/enums";
import { personRelationship } from "@/backend/pg/schemas/enums-config";

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    displayName: text("display_name").notNull(),
    relationship: personRelationship("relationship").notNull().default("other"),
    /** Drives the longer home leg; see `preferences.home_leg_days_*`. */
    homeCountry: text("home_country").notNull().default(""),
    /** What this person treats themself to: handbags, watches, shoes. */
    shoppingInterests: text("shopping_interests").array().notNull().default(sql`'{}'::text[]`),
    notes: text("notes").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("people_active_idx").on(t.isActive, t.displayName)],
);
export type PersonRow = typeof people.$inferSelect;

/**
 * The household's ROI gate. One row, keyed `household`.
 *
 * `scope` is unique rather than this being a bare singleton, so a second
 * household is a row instead of a migration, and so the row is addressable by
 * a name the settings page can use.
 */
export const preferences = pgTable(
  "preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: text("scope").notNull().default("household"),
    /** "we need to be away at least a week and a half". */
    minTripNights: integer("min_trip_nights").notNull().default(10),
    maxTripNights: integer("max_trip_nights").notNull().default(21),
    /** "2-3 days per leg". */
    legDaysMin: integer("leg_days_min").notNull().default(2),
    legDaysMax: integer("leg_days_max").notNull().default(3),
    /** "unless its signapore and then 4-5 days typically" — the home-country leg. */
    homeLegDaysMin: integer("home_leg_days_min").notNull().default(4),
    homeLegDaysMax: integer("home_leg_days_max").notNull().default(5),
    maxLegsPerTrip: integer("max_legs_per_trip").notNull().default(3),
    /** "we have not just returned from a trip ... enough time has passed". */
    minDaysSinceLastTrip: integer("min_days_since_last_trip").notNull().default(120),
    /** "far enough in advance that it would be appropriate to ask time off". */
    timeOffNoticeDays: integer("time_off_notice_days").notNull().default(60),
    maxWorkdaysOff: integer("max_workdays_off").notNull().default(15),
    /** "economgy plus is ok too" — the acceptable set, best first. */
    acceptableCabins: cabinClass("acceptable_cabins")
      .array()
      .notNull()
      .default(sql`'{business,premium_economy}'::cabin_class[]`),
    /** "ideally poitns with business class at least for 1 leg". */
    minPremiumLegs: integer("min_premium_legs").notNull().default(1),
    pointsPreferred: boolean("points_preferred").notNull().default(true),
    /** The stated bar, in Justin's words, for an agent to quote back. */
    hotelBar: text("hotel_bar")
      .notNull()
      .default("Clean, safe, near public transport. Not the Ritz; nothing that adds stress."),
    hotelMaxNightlyCents: integer("hotel_max_nightly_cents"),
    currency: text("currency").notNull().default("USD"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("preferences_scope_key").on(t.scope)],
);
export type PreferencesRow = typeof preferences.$inferSelect;
