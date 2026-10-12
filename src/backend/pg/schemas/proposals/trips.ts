/**
 * @fileoverview Trip packages: a proposal that is already planned
 * (maestro cs-be-1-4).
 *
 * `fork_group_id` on an itinerary item is the choose-your-own-adventure
 * mechanism: items sharing a group are alternatives and exactly one carries
 * `selected`. `depart_by` and the transit columns exist because the planning
 * burden is the barrier — knowing to leave at 09:10 and take the Ginza line is
 * what turns a list of place names into a trip someone actually takes.
 */

import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgTable, text, time, timestamp, uuid } from "drizzle-orm/pg-core";

import { flightCabin, itineraryItemKind, transitMode } from "@/backend/pg/schemas/enums-m3";
import { proposals } from "@/backend/pg/schemas/proposals/proposals";

export const tripPackages = pgTable("trip_packages", {
  proposalId: uuid("proposal_id").primaryKey().references(() => proposals.id, { onDelete: "cascade" }),
  originAirport: text("origin_airport").notNull().default(""),
  startOn: date("start_on"),
  endOn: date("end_on"),
  totalNights: integer("total_nights"),
  estCashCents: integer("est_cash_cents"),
  currency: text("currency").notNull().default("USD"),
  /** [{program, amount}] — points are per programme, so never a single number. */
  estPoints: jsonb("est_points").notNull().default(sql`'[]'::jsonb`),
});

export const tripLegs = pgTable(
  "trip_legs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    city: text("city").notNull(),
    country: text("country").notNull().default(""),
    arriveOn: date("arrive_on"),
    departOn: date("depart_on"),
    nights: integer("nights").notNull().default(0),
    special: text("special").notNull().default(""),
    shoppingNote: text("shopping_note").notNull().default(""),
    sceneryNote: text("scenery_note").notNull().default(""),
  },
  (t) => [index("trip_legs_proposal_idx").on(t.proposalId, t.position)],
);

export const itineraryDays = pgTable(
  "itinerary_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legId: uuid("leg_id").notNull().references(() => tripLegs.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    position: integer("position").notNull().default(0),
    wakeAt: time("wake_at"),
    /** Explicit, so "you may sleep in" reads as a plan rather than an omission. */
    sleepIn: boolean("sleep_in").notNull().default(false),
    headline: text("headline").notNull().default(""),
  },
  (t) => [index("itinerary_days_leg_idx").on(t.legId, t.position)],
);

export const itineraryItems = pgTable(
  "itinerary_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dayId: uuid("day_id").notNull().references(() => itineraryDays.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    kind: itineraryItemKind("kind").notNull().default("activity"),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    startsAt: time("starts_at"),
    endsAt: time("ends_at"),
    departBy: time("depart_by"),
    transitMode: transitMode("transit_mode"),
    transitNote: text("transit_note").notNull().default(""),
    costCents: integer("cost_cents"),
    currency: text("currency"),
    tips: jsonb("tips").notNull().default(sql`'[]'::jsonb`),
    bookingUrl: text("booking_url"),
    /** Items sharing a group are alternatives; exactly one is selected. */
    forkGroupId: text("fork_group_id"),
    selected: boolean("selected").notNull().default(true),
  },
  (t) => [index("itinerary_items_day_idx").on(t.dayId, t.position), index("itinerary_items_fork_idx").on(t.forkGroupId)],
);

export const flightOptions = pgTable(
  "flight_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    carrier: text("carrier").notNull().default(""),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    departAt: timestamp("depart_at", { withTimezone: true }),
    arriveAt: timestamp("arrive_at", { withTimezone: true }),
    cabin: flightCabin("cabin"),
    nonstop: boolean("nonstop"),
    durationMinutes: integer("duration_minutes"),
    seatProduct: text("seat_product").notNull().default(""),
    cashCents: integer("cash_cents"),
    currency: text("currency"),
    pointsAmount: integer("points_amount"),
    pointsProgram: text("points_program"),
    /** How the points get there, e.g. "Amex MR -> KrisFlyer 1:1". */
    transferPath: text("transfer_path").notNull().default(""),
    note: text("note").notNull().default(""),
  },
  (t) => [index("flight_options_proposal_idx").on(t.proposalId, t.position)],
);

export const hotelOptions = pgTable(
  "hotel_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
    legId: uuid("leg_id").references(() => tripLegs.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    brand: text("brand").notNull().default(""),
    propertyName: text("property_name").notNull(),
    city: text("city").notNull().default(""),
    nightlyCents: integer("nightly_cents"),
    totalCents: integer("total_cents"),
    currency: text("currency"),
    pointsAmount: integer("points_amount"),
    pointsProgram: text("points_program"),
    /** The stated bar — clean, safe, near transit — not a star rating. */
    why: text("why").notNull().default(""),
    transitNote: text("transit_note").notNull().default(""),
    /** Set when a hotel_brand_rules row says avoid; the UI must flag it. */
    violatesRule: text("violates_rule"),
    bookingUrl: text("booking_url"),
  },
  (t) => [index("hotel_options_proposal_idx").on(t.proposalId, t.position)],
);

export const calendarChecks = pgTable("calendar_checks", {
  proposalId: uuid("proposal_id").primaryKey().references(() => proposals.id, { onDelete: "cascade" }),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  windowStart: date("window_start").notNull(),
  windowEnd: date("window_end").notNull(),
  conflicts: jsonb("conflicts").notNull().default(sql`'[]'::jsonb`),
  daysSinceLastTrip: integer("days_since_last_trip"),
  workdaysOffNeeded: integer("workdays_off_needed"),
  windowStance: text("window_stance").notNull().default("unknown"),
  verdict: text("verdict").notNull().default("unknown"),
  note: text("note").notNull().default(""),
});
