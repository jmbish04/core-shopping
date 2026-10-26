/**
 * @fileoverview `travel_windows`, `home_airports`, `hotel_brand_rules` and
 * `trip_history` (maestro cs-be-1-6) — the travel half of the configuration.
 *
 * `travel_windows` is the table the brief describes at length: "date ranges of
 * the year where travel is extra ideal and date rnages where travel is frowned
 * upon for whatever reason ... and all the other date ranges being an
 * opportunity for the agent to persuide us the ROI is there".
 *
 * That last clause is why `neutral` is a stored stance and not the absence of
 * a row. An explicit neutral window means "persuade me"; no window covering a
 * date means nothing has been said about it. A resolver must keep those apart
 * and return null for the second — `calendar_checks.window_stance` already
 * carries "unknown" for exactly that case.
 */

import { sql } from "drizzle-orm";
import { boolean, date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { brandStance, travelWindowStance, tripKind, tripSource } from "@/backend/pg/schemas/enums-config";
import { people } from "@/backend/pg/schemas/config/people";
import { proposals } from "@/backend/pg/schemas/proposals/proposals";

/**
 * A date range with a stance.
 *
 * When `recurs_yearly` is set the YEAR in `starts_on` and `ends_on` is ignored
 * and only month and day matter, so "December is frowned upon" is one row
 * rather than one row a year. A recurring window may therefore have `ends_on`
 * before `starts_on` (28 December to 4 January), which is why a resolver
 * compares month-day pairs instead of subtracting dates.
 */
export const travelWindows = pgTable(
  "travel_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    stance: travelWindowStance("stance").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    recursYearly: boolean("recurs_yearly").notNull().default(false),
    reason: text("reason").notNull().default(""),
    /** Whose constraint. Null means the household's. */
    personId: uuid("person_id").references(() => people.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("travel_windows_range_idx").on(t.startsOn, t.endsOn),
    index("travel_windows_stance_idx").on(t.stance, t.recursYearly),
    index("travel_windows_person_idx").on(t.personId),
  ],
);
export type TravelWindowRow = typeof travelWindows.$inferSelect;

/** "Keeping watch of SFO, OAK, and SJC". `rank` 1 is the preferred airport. */
export const homeAirports = pgTable(
  "home_airports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    city: text("city").notNull().default(""),
    rank: integer("rank").notNull().default(1),
    driveMinutes: integer("drive_minutes"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("home_airports_rank_idx").on(t.isActive, t.rank)],
);
export type HomeAirportRow = typeof homeAirports.$inferSelect;

/**
 * A hard-configured rule about a hotel brand: "hard configured rules like the
 * hotel brands we like".
 *
 * `reason` is load-bearing, not decoration. The Hilton rule exists because of
 * dead bugs in the sheets in Palm Springs, and `hotel_options.violates_rule`
 * has to be able to say which rule and why rather than just flagging a
 * property red.
 */
export const hotelBrandRules = pgTable(
  "hotel_brand_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brand: text("brand").notNull(),
    stance: brandStance("stance").notNull().default("neutral"),
    reason: text("reason").notNull().default(""),
    /** When the stance was taken, so "we cancelled the card" has a date. */
    since: date("since"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** Case-insensitive, so "Hilton" and "hilton" cannot hold opposite stances. */
    uniqueIndex("hotel_brand_rules_brand_key").on(sql`lower(${t.brand})`),
    index("hotel_brand_rules_stance_idx").on(t.stance),
  ],
);
export type HotelBrandRuleRow = typeof hotelBrandRules.$inferSelect;

/**
 * A trip that already happened. This is what
 * `calendar_checks.days_since_last_trip` is derived from, and without it the
 * brief's "we have not just returned from a trip ... enough time has passed
 * since our last vacation" gate cannot be evaluated at all.
 *
 * `person_id` is null for a trip the household took together and set for one
 * person's trip: Jason flying home to Singapore alone does not reset the
 * household's clock, so a query for the household's last trip must not count
 * it. `kind` separates that further — a work trip is time away, not goodwill
 * spent on a holiday.
 */
export const tripHistory = pgTable(
  "trip_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    destination: text("destination").notNull().default(""),
    startedOn: date("started_on").notNull(),
    endedOn: date("ended_on").notNull(),
    kind: tripKind("kind").notNull().default("vacation"),
    /** Null for a trip the household took together. */
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    legs: integer("legs").notNull().default(0),
    workdaysOff: integer("workdays_off"),
    source: tripSource("source").notNull().default("manual"),
    /** Set when the trip happened because a proposal was accepted. */
    sourceProposalId: uuid("source_proposal_id").references(() => proposals.id, { onDelete: "set null" }),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** The access pattern is "the most recent trip that ended before date D". */
    index("trip_history_ended_idx").on(t.endedOn),
    index("trip_history_person_ended_idx").on(t.personId, t.endedOn),
    index("trip_history_kind_idx").on(t.kind),
  ],
);
export type TripHistoryRow = typeof tripHistory.$inferSelect;
