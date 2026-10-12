/**
 * @fileoverview Proposal and trip-package contracts (maestro cs-c-06).
 *
 * A Proposal is the agent raising its hand: "this is worth your attention."
 * Everything else an agent finds stays a sighting in the catalog.
 *
 * The status vocabulary carries the quiet-by-default rule. A re-sighting of
 * something already decided becomes a `silent_update` chained to its
 * predecessor — it is recorded, it updates the price history, and it never
 * re-enters the review queue. That is what stops the same concert being
 * pitched every week as resale prices drift.
 *
 * A TripPackage is a Proposal with an itinerary: legs, days, forked choices,
 * flights, hotels, and the calendar check that says the dates are even
 * possible. It exists because a trip is only worth proposing when it is
 * already planned — an unplanned "you could go to Taiwan" is work, not a gift.
 */

import { z } from "zod";

import { Id, IsoDate, IsoDateTime, type ListFields } from "./common";
import { EntityKindSchema, ImageRefSchema } from "./catalog";

export const PROPOSAL_STATUSES = [
  "queued",
  "reviewed_positive",
  "reviewed_negative",
  "snoozed",
  "booked",
  "superseded",
  /** Recorded, never queued: a re-sighting of something already decided. */
  "silent_update",
] as const;
export const PROPOSAL_KINDS = ["item", "trip"] as const;
export const CABINS = ["economy", "premium_economy", "business", "first"] as const;
export const TRANSIT_MODES = ["walk", "metro", "train", "bus", "taxi", "rideshare", "car", "ferry", "flight"] as const;

export const ProposalStatusSchema = z.enum(PROPOSAL_STATUSES).meta({ id: "ProposalStatus" });
export const ProposalKindSchema = z.enum(PROPOSAL_KINDS).meta({ id: "ProposalKind" });

/** Why the agent thinks this clears the bar, in the user's own criteria. */
export const RationaleSchema = z
  .object({
    why_now: z.string().max(2_000),
    criteria_met: z.array(z.object({ label: z.string(), met: z.boolean(), note: z.string().default("") })),
    /** 0..1, the agent's own confidence before any human verdict. */
    match_score: z.number().min(0).max(1).nullable(),
    /** 0..1, value for effort and money. Drives trip ordering. */
    roi_score: z.number().min(0).max(1).nullable(),
    roi_note: z.string().max(2_000).default(""),
  })
  .meta({ id: "ProposalRationale" });

export const ProposalItemSchema = z
  .object({
    id: Id,
    entity_id: Id,
    kind: EntityKindSchema,
    title: z.string(),
    url: z.string().nullable(),
    image: ImageRefSchema.nullable(),
    price_cents: z.number().int().nullable(),
    msrp_cents: z.number().int().nullable(),
    currency: z.string().nullable(),
    /** Price when the prior proposal was raised, so a drop is visible at a glance. */
    prior_price_cents: z.number().int().nullable(),
    note: z.string().default(""),
  })
  .meta({ id: "ProposalItem" });

export const ProposalSchema = z
  .object({
    id: Id,
    goal_id: Id.nullable(),
    run_id: Id.nullable(),
    kind: ProposalKindSchema,
    status: ProposalStatusSchema,
    title: z.string(),
    summary: z.string(),
    rationale: RationaleSchema,
    items: z.array(ProposalItemSchema),
    /** The proposal this one supersedes or silently updates. */
    prior_proposal_id: Id.nullable(),
    /** Why it was filed silently instead of queued; empty when it was queued. */
    silent_reason: z.string().default(""),
    /** Set when the agent believes acting late loses the chance. */
    expires_at: IsoDateTime.nullable(),
    created_at: IsoDateTime,
    decided_at: IsoDateTime.nullable(),
  })
  .meta({ id: "Proposal" });
export type Proposal = z.infer<typeof ProposalSchema>;

// ---------------------------------------------------------------------------
// Trip packages
// ---------------------------------------------------------------------------

/**
 * One stop. `nights` carries the house rule — 2-3 nights a city, 4-5 in
 * Singapore — so a reviewer can see at a glance whether the shape is right.
 */
export const TripLegSchema = z
  .object({
    id: Id,
    position: z.number().int().min(0),
    city: z.string(),
    country: z.string(),
    arrive_on: IsoDate,
    depart_on: IsoDate,
    nights: z.number().int().min(0),
    /** The thing that makes this stop worth it: a concert, a festival, Pride. */
    special: z.string().default(""),
    shopping_note: z.string().default(""),
    scenery_note: z.string().default(""),
  })
  .meta({ id: "TripLeg" });

/**
 * One scheduled thing on a day.
 *
 * `depart_by` and the transit fields exist because the planning burden is the
 * barrier: knowing to leave at 09:10 and take the Ginza line is the difference
 * between a plan that gets used and a list of place names.
 */
export const ItineraryItemSchema = z
  .object({
    id: Id,
    position: z.number().int().min(0),
    kind: z.enum(["meal", "activity", "transit", "rest", "shopping", "checkin", "flight", "free"]),
    title: z.string(),
    detail: z.string().default(""),
    starts_at: z.string().nullable(),
    ends_at: z.string().nullable(),
    /** Leave by this time to make `starts_at`. */
    depart_by: z.string().nullable(),
    transit_mode: z.enum(TRANSIT_MODES).nullable(),
    transit_note: z.string().default(""),
    cost_cents: z.number().int().nullable(),
    currency: z.string().nullable(),
    /** Reddit and reputable-source tips, with their links. */
    tips: z.array(z.object({ text: z.string(), source_url: z.string().nullable() })).default([]),
    booking_url: z.string().nullable(),
    /** Items sharing a fork group are alternatives; exactly one is selected. */
    fork_group_id: z.string().nullable(),
    selected: z.boolean().default(true),
  })
  .meta({ id: "ItineraryItem" });

export const ItineraryDaySchema = z
  .object({
    id: Id,
    leg_id: Id,
    date: IsoDate,
    position: z.number().int().min(0),
    /** Explicit, so "you may sleep in" is a plan rather than an omission. */
    wake_at: z.string().nullable(),
    sleep_in: z.boolean().default(false),
    headline: z.string().default(""),
    items: z.array(ItineraryItemSchema),
  })
  .meta({ id: "ItineraryDay" });

export const FlightOptionSchema = z
  .object({
    id: Id,
    position: z.number().int().min(0),
    carrier: z.string(),
    origin: z.string(),
    destination: z.string(),
    depart_at: IsoDateTime.nullable(),
    arrive_at: IsoDateTime.nullable(),
    cabin: z.enum(CABINS),
    nonstop: z.boolean(),
    duration_minutes: z.number().int().nullable(),
    seat_product: z.string().default(""),
    cash_cents: z.number().int().nullable(),
    currency: z.string().nullable(),
    points_amount: z.number().int().nullable(),
    points_program: z.string().nullable(),
    /** How to get the points there, e.g. "Amex MR -> KrisFlyer 1:1". */
    transfer_path: z.string().default(""),
    note: z.string().default(""),
  })
  .meta({ id: "FlightOption" });

export const HotelOptionSchema = z
  .object({
    id: Id,
    leg_id: Id.nullable(),
    position: z.number().int().min(0),
    brand: z.string().default(""),
    property_name: z.string(),
    city: z.string().default(""),
    nightly_cents: z.number().int().nullable(),
    total_cents: z.number().int().nullable(),
    currency: z.string().nullable(),
    points_amount: z.number().int().nullable(),
    points_program: z.string().nullable(),
    /** Clean, safe, near transit — the stated bar, not a star rating. */
    why: z.string().default(""),
    transit_note: z.string().default(""),
    /** Set when a hotel_brand_rules row says avoid; the UI must flag it. */
    violates_rule: z.string().nullable(),
    booking_url: z.string().nullable(),
  })
  .meta({ id: "HotelOption" });

/**
 * Whether the dates are actually possible.
 *
 * Separate from the itinerary because this is the first thing that kills a
 * trip, and a conflict found after the plan is read is wasted reading.
 */
export const CalendarCheckSchema = z
  .object({
    checked_at: IsoDateTime,
    window_start: IsoDate,
    window_end: IsoDate,
    conflicts: z.array(
      z.object({
        person: z.string(),
        title: z.string(),
        starts_at: IsoDateTime,
        ends_at: IsoDateTime,
        source: z.string().default("google-calendar"),
      }),
    ),
    days_since_last_trip: z.number().int().nullable(),
    workdays_off_needed: z.number().int().nullable(),
    /** From travel_windows: ideal, frowned, or neutral for these dates. */
    window_stance: z.enum(["ideal", "frowned", "neutral", "unknown"]),
    verdict: z.enum(["clear", "conflict", "tight", "unknown"]),
    note: z.string().default(""),
  })
  .meta({ id: "CalendarCheck" });

/** GET /api/proposals/{id} for a trip: the whole package in one call. */
export const TripPackageSchema = ProposalSchema.extend({
  kind: z.literal("trip"),
  origin_airport: z.string().default(""),
  start_on: IsoDate.nullable(),
  end_on: IsoDate.nullable(),
  total_nights: z.number().int().nullable(),
  est_cash_cents: z.number().int().nullable(),
  est_points: z.array(z.object({ program: z.string(), amount: z.number().int() })).default([]),
  legs: z.array(TripLegSchema),
  days: z.array(ItineraryDaySchema),
  flights: z.array(FlightOptionSchema),
  hotels: z.array(HotelOptionSchema),
  calendar: CalendarCheckSchema.nullable(),
}).meta({ id: "TripPackage" });
export type TripPackage = z.infer<typeof TripPackageSchema>;

/** POST /api/proposals/{id}/forks — pick one alternative per fork group. */
export const ForkSelectionSchema = z
  .object({ selections: z.array(z.object({ fork_group_id: z.string(), item_id: Id })).min(1) })
  .meta({ id: "ForkSelection" });

/** PATCH /api/proposals/{id} — pipeline moves the board makes. */
export const ProposalPatchSchema = z
  .object({
    status: ProposalStatusSchema.optional(),
    snooze_until: IsoDateTime.nullish(),
    note: z.string().max(2_000).optional(),
  })
  .meta({ id: "ProposalPatch" });

export const PROPOSAL_LIST_FIELDS = {
  title: { type: "text", label: "Title", sortable: true },
  status: { type: "select", label: "Status", groupable: true, sortable: true, options: PROPOSAL_STATUSES },
  kind: { type: "select", label: "Kind", groupable: true, options: PROPOSAL_KINDS },
  goal_id: { type: "select", label: "Goal", groupable: true },
  match_score: { type: "number", label: "Match", sortable: true },
  roi_score: { type: "number", label: "ROI", sortable: true },
  created_at: { type: "date", label: "Raised", sortable: true },
  expires_at: { type: "date", label: "Expires", sortable: true },
} as const satisfies ListFields;
