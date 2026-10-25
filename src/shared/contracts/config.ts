/**
 * @fileoverview Self-serve configuration contracts (maestro cs-c-08, cs-be-1-6).
 *
 * The brief asks for these outright: "Need to have self serve configuration
 * tables in postgres: hard configured rules like the hotel brands we like;
 * where our loyalty points were with hotels and airlines; date ranges of the
 * year where travel is extra ideal and date ranges where travel is frowned
 * upon". Twelve tables answer that, and every settings page maps 1:1 to one of
 * the schemas below.
 *
 * Three conventions worth stating because the brief depends on them:
 *
 * - **`neutral` is a stance, not an absence.** The brief calls the space
 *   between the ideal and the frowned-upon ranges "an opportunity for the agent
 *   to persuade us the ROI is there". So an explicit `neutral` window means
 *   "persuade me", while no window covering a date at all means nothing has
 *   been said. {@link TravelWindowStanceSchema} carries the first; the resolver
 *   returns `null` for the second.
 * - **A balance nobody has measured is not zero.** `points_balance` and
 *   `balance_as_of` are both nullable on a loyalty account, and a null balance
 *   must never render as 0 points.
 * - **Ratios are two integers.** "Amex MR -> KrisFlyer 1:1" is
 *   `ratio_from: 1, ratio_to: 1`, never a float, for the same reason money is
 *   integer cents.
 *
 * Plain `zod` only (no Hono, no Drizzle) so the browser bundle stays clean and
 * plain-Node self-checks can load this file.
 */

import { z } from "zod";

import { CABINS } from "./proposals";
import { Id, IsoDate, IsoDateTime, type ListFields } from "./common";

// ---------------------------------------------------------------------------
// Vocabularies. Closed sets, so each one is also a Postgres enum
// (`@/backend/pg/schemas/enums-config`) and the two cannot disagree.
// ---------------------------------------------------------------------------

/** Who a person is to the household. `self` is the operator. */
export const PERSON_RELATIONSHIPS = ["self", "spouse", "partner", "family", "friend", "other"] as const;

/** What a hard-configured brand rule says. `avoid` is why the rule exists. */
export const BRAND_STANCES = ["prefer", "neutral", "avoid"] as const;

/** What kind of loyalty currency a programme issues. */
export const LOYALTY_PROGRAM_KINDS = ["airline", "hotel", "card", "rail", "other"] as const;

/**
 * A travel window's stance. `neutral` is the brief's "space between" — stated
 * deliberately, and different from no window at all.
 */
export const TRAVEL_WINDOW_STANCES = ["ideal", "neutral", "frowned"] as const;

/**
 * How well known a performer is. The brief wants both ends flagged: "flagging
 * big name artists and flagging small time new up and coming artist (like
 * odessa)".
 */
export const TASTE_TIERS = ["big_name", "rising", "unknown"] as const;

/**
 * How much a performer or genre is wanted. `would_travel` is the strongest and
 * it is a real case: "I would fly my husband anywhere in the world to see
 * sammy cheng with him".
 */
export const TASTE_AFFINITIES = ["would_travel", "love", "like", "curious", "avoid"] as const;

/**
 * Where a taste row came from. An agent-suggested artist ("bands we may like
 * due to similarity with what we are already listening to but may not have yet
 * discovered") is not a stated preference and must not be read as one.
 */
export const TASTE_SOURCES = ["manual", "spotify", "agent"] as const;

/**
 * What a stance is held about. `venue_stances` is named for venues but must
 * hold countries to answer the brief ("japan may be played out at this piont"),
 * so the kind is explicit rather than implied by the table name.
 */
export const PLACE_KINDS = ["venue", "city", "destination", "country", "region"] as const;

/**
 * A stance toward a place. `played_out` is the brief's own word and the reason
 * this table earns its keep — it is a temporary verdict, so it carries an
 * `until` date rather than being permanent.
 */
export const PLACE_STANCES = ["love", "fine", "avoid", "played_out"] as const;

/** Why a past trip happened. Only `vacation` and `family` spend goodwill. */
export const TRIP_KINDS = ["vacation", "work", "family", "other"] as const;

/** How a trip-history row was recorded. */
export const TRIP_SOURCES = ["manual", "calendar", "proposal"] as const;

export const PersonRelationshipSchema = z.enum(PERSON_RELATIONSHIPS).meta({ id: "PersonRelationship" });
export const BrandStanceSchema = z.enum(BRAND_STANCES).meta({ id: "BrandStance" });
export const LoyaltyProgramKindSchema = z.enum(LOYALTY_PROGRAM_KINDS).meta({ id: "LoyaltyProgramKind" });
export const TravelWindowStanceSchema = z.enum(TRAVEL_WINDOW_STANCES).meta({ id: "TravelWindowStance" });
export const TasteTierSchema = z.enum(TASTE_TIERS).meta({ id: "TasteTier" });
export const TasteAffinitySchema = z.enum(TASTE_AFFINITIES).meta({ id: "TasteAffinity" });
export const TasteSourceSchema = z.enum(TASTE_SOURCES).meta({ id: "TasteSource" });
export const PlaceKindSchema = z.enum(PLACE_KINDS).meta({ id: "PlaceKind" });
export const PlaceStanceSchema = z.enum(PLACE_STANCES).meta({ id: "PlaceStance" });
export const TripKindSchema = z.enum(TRIP_KINDS).meta({ id: "TripKind" });
export const TripSourceSchema = z.enum(TRIP_SOURCES).meta({ id: "TripSource" });

/** A three-letter IATA code, upper-cased. */
export const IataCode = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Za-z]{3}$/, "An IATA code is three letters")
  .transform((value) => value.toUpperCase());

const slug = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "A slug is lower-case words joined by single hyphens");

// ---------------------------------------------------------------------------
// people
// ---------------------------------------------------------------------------

/**
 * A person the shopping is for. Jason and Justin are two people with different
 * home countries and different shopping interests, and the brief leans on both:
 * "Jason is Singaporean and so he tries to get home once or twice a year", and
 * "ideally some luxury shopping for jason".
 */
export const PersonInputSchema = z
  .object({
    slug,
    display_name: z.string().trim().min(1).max(120),
    relationship: PersonRelationshipSchema.default("other"),
    /** Drives the longer home leg; see `preferences.home_leg_days_*`. */
    home_country: z.string().trim().max(80).default(""),
    /** What this person treats themself to: handbags, watches, shoes. */
    shopping_interests: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
    notes: z.string().max(4_000).default(""),
    is_active: z.boolean().default(true),
  })
  .meta({ id: "PersonInput" });
export type PersonInput = z.infer<typeof PersonInputSchema>;

export const PersonSchema = PersonInputSchema.extend({
  id: Id,
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
}).meta({ id: "Person" });
export type Person = z.infer<typeof PersonSchema>;

// ---------------------------------------------------------------------------
// preferences
// ---------------------------------------------------------------------------

/**
 * The household's ROI gate, as numbers rather than prose. These are the
 * barriers the brief sets before a trip proposal is worth reading: long
 * enough, far enough from the last trip, a decent cabin on at least one leg,
 * and a hotel that is clean and safe without being the Ritz.
 *
 * One row, keyed `household`. Person-specific facts live on {@link PersonSchema}
 * instead, so this table never needs a per-person copy.
 */
const preferencesFields = {
    /** "we need to be away at least a week and a half". */
    min_trip_nights: z.number().int().min(1).max(120).default(10),
    max_trip_nights: z.number().int().min(1).max(120).default(21),
    /** "2-3 days per leg". */
    leg_days_min: z.number().int().min(1).max(30).default(2),
    leg_days_max: z.number().int().min(1).max(30).default(3),
    /** "unless its signapore and then 4-5 days typically" — the home-country leg. */
    home_leg_days_min: z.number().int().min(1).max(30).default(4),
    home_leg_days_max: z.number().int().min(1).max(30).default(5),
    max_legs_per_trip: z.number().int().min(1).max(10).default(3),
    /** "we have not just returned from a trip ... enough time has passed". */
    min_days_since_last_trip: z.number().int().min(0).max(730).default(120),
    /** "far enough in advance that it would be appropriate to ask time off". */
    time_off_notice_days: z.number().int().min(0).max(730).default(60),
    max_workdays_off: z.number().int().min(1).max(60).default(15),
    /** "economgy plus is ok too" — the acceptable set, best first. */
    acceptable_cabins: z.array(z.enum(CABINS)).min(1).max(CABINS.length).default(["business", "premium_economy"]),
    /** "ideally poitns with business class at least for 1 leg". */
    min_premium_legs: z.number().int().min(0).max(10).default(1),
    /** "flying business ideally on points would be the dream". */
    points_preferred: z.boolean().default(true),
    /** The stated bar, in Justin's words, for an agent to quote back. */
    hotel_bar: z
      .string()
      .max(2_000)
      .default("Clean, safe, near public transport. Not the Ritz; nothing that adds stress."),
    hotel_max_nightly_cents: z.number().int().nonnegative().nullish(),
    currency: z.string().length(3).default("USD"),
} as const;

export const PreferencesInputSchema = z
  .object(preferencesFields)
  .refine((p) => p.min_trip_nights <= p.max_trip_nights, {
    message: "min_trip_nights must not exceed max_trip_nights",
    path: ["min_trip_nights"],
  })
  .refine((p) => p.leg_days_min <= p.leg_days_max, {
    message: "leg_days_min must not exceed leg_days_max",
    path: ["leg_days_min"],
  })
  .refine((p) => p.home_leg_days_min <= p.home_leg_days_max, {
    message: "home_leg_days_min must not exceed home_leg_days_max",
    path: ["home_leg_days_min"],
  })
  .meta({ id: "PreferencesInput" });
export type PreferencesInput = z.infer<typeof PreferencesInputSchema>;

export const PreferencesSchema = z
  .object({
    id: Id,
    scope: z.string().min(1).max(40),
    ...preferencesFields,
    updated_at: IsoDateTime,
  })
  .meta({ id: "Preferences" });
export type Preferences = z.infer<typeof PreferencesSchema>;

// ---------------------------------------------------------------------------
// hotel_brand_rules
// ---------------------------------------------------------------------------

/**
 * A hard-configured rule about a hotel brand. `reason` is not decoration: the
 * Hilton rule exists because of dead bugs in the sheets in Palm Springs, and a
 * proposal that violates a rule has to say which rule and why
 * (`hotel_options.violates_rule`).
 */
export const HotelBrandRuleInputSchema = z
  .object({
    brand: z.string().trim().min(1).max(120),
    stance: BrandStanceSchema.default("neutral"),
    reason: z.string().max(2_000).default(""),
    /** When the stance was taken, so "we cancelled the card" has a date. */
    since: IsoDate.nullish(),
  })
  .meta({ id: "HotelBrandRuleInput" });
export type HotelBrandRuleInput = z.infer<typeof HotelBrandRuleInputSchema>;

export const HotelBrandRuleSchema = HotelBrandRuleInputSchema.extend({
  id: Id,
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
}).meta({ id: "HotelBrandRule" });
export type HotelBrandRule = z.infer<typeof HotelBrandRuleSchema>;

// ---------------------------------------------------------------------------
// loyalty_programs, loyalty_accounts, transfer_partners
// ---------------------------------------------------------------------------

/** A loyalty currency: KrisFlyer, Hilton Honors, Amex MR, Chase UR. */
export const LoyaltyProgramInputSchema = z
  .object({
    /** The id other tables' `points_program` text columns carry. */
    code: slug,
    name: z.string().trim().min(1).max(120),
    kind: LoyaltyProgramKindSchema,
    alliance: z.string().trim().max(80).default(""),
    notes: z.string().max(2_000).default(""),
  })
  .meta({ id: "LoyaltyProgramInput" });
export type LoyaltyProgramInput = z.infer<typeof LoyaltyProgramInputSchema>;

export const LoyaltyProgramSchema = LoyaltyProgramInputSchema.extend({
  id: Id,
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
}).meta({ id: "LoyaltyProgram" });
export type LoyaltyProgram = z.infer<typeof LoyaltyProgramSchema>;

/**
 * One person's standing in one programme. "where our loyalty points were with
 * hotels and airlines", from the brief.
 *
 * Both `points_balance` and `balance_as_of` are nullable, and they are nullable
 * together: a programme nobody has checked has an unknown balance, which is not
 * a balance of zero. A surface that renders null as "0 points" would tell the
 * agent it cannot afford a seat it can afford.
 */
const loyaltyAccountFields = {
    person_id: Id,
    program_id: Id,
    account_label: z.string().trim().max(120).default(""),
    points_balance: z.number().int().nonnegative().nullish(),
    /** When the balance was last read. Null means never. */
    balance_as_of: IsoDateTime.nullish(),
    elite_tier: z.string().trim().max(80).default(""),
    notes: z.string().max(2_000).default(""),
} as const;

export const LoyaltyAccountInputSchema = z
  .object(loyaltyAccountFields)
  .refine((a) => a.points_balance == null || a.balance_as_of != null, {
    message: "A points_balance needs a balance_as_of; an unmeasured balance must stay null",
    path: ["balance_as_of"],
  })
  .meta({ id: "LoyaltyAccountInput" });
export type LoyaltyAccountInput = z.infer<typeof LoyaltyAccountInputSchema>;

export const LoyaltyAccountSchema = z
  .object({
    id: Id,
    ...loyaltyAccountFields,
    created_at: IsoDateTime,
    updated_at: IsoDateTime,
  })
  .meta({ id: "LoyaltyAccount" });
export type LoyaltyAccount = z.infer<typeof LoyaltyAccountSchema>;

/**
 * A transfer route between two programmes: "bonus poitns if with points we can
 * convert from our sapphire reserve or amex plat cards".
 *
 * The ratio is two integers so "1,000 Amex MR becomes 1,000 KrisFlyer" is
 * `1:1` and a 5:4 devaluation is exact rather than 0.8.
 */
const transferPartnerFields = {
    from_program_id: Id,
    to_program_id: Id,
    ratio_from: z.number().int().min(1).max(1_000_000).default(1),
    ratio_to: z.number().int().min(1).max(1_000_000).default(1),
    transfer_days_min: z.number().int().min(0).max(120).nullish(),
    transfer_days_max: z.number().int().min(0).max(120).nullish(),
    bonus_note: z.string().max(1_000).default(""),
    is_active: z.boolean().default(true),
    /** A transfer ratio goes stale; null means it has never been checked. */
    last_verified_on: IsoDate.nullish(),
} as const;

export const TransferPartnerInputSchema = z
  .object(transferPartnerFields)
  .refine((t) => t.from_program_id !== t.to_program_id, {
    message: "A programme does not transfer to itself",
    path: ["to_program_id"],
  })
  .meta({ id: "TransferPartnerInput" });
export type TransferPartnerInput = z.infer<typeof TransferPartnerInputSchema>;

export const TransferPartnerSchema = z
  .object({
    id: Id,
    ...transferPartnerFields,
    created_at: IsoDateTime,
    updated_at: IsoDateTime,
  })
  .meta({ id: "TransferPartner" });
export type TransferPartner = z.infer<typeof TransferPartnerSchema>;

// ---------------------------------------------------------------------------
// travel_windows, home_airports, trip_history
// ---------------------------------------------------------------------------

/**
 * A date range with a stance: ideal, frowned upon, or deliberately neutral.
 *
 * When `recurs_yearly` is set the year in `starts_on` and `ends_on` is ignored
 * and only the month and day matter, so "December is frowned upon" is one row
 * rather than one row a year. A window that crosses the new year (28 December
 * to 4 January) is allowed and is why the resolver compares month-day pairs
 * rather than subtracting dates.
 */
const travelWindowFields = {
    label: z.string().trim().min(1).max(160),
    stance: TravelWindowStanceSchema,
    starts_on: IsoDate,
    ends_on: IsoDate,
    recurs_yearly: z.boolean().default(false),
    reason: z.string().max(2_000).default(""),
    /** Whose constraint this is. Null means the household's. */
    person_id: Id.nullish(),
} as const;

export const TravelWindowInputSchema = z
  .object(travelWindowFields)
  .refine((w) => w.recurs_yearly || w.starts_on <= w.ends_on, {
    message: "ends_on must not precede starts_on unless the window recurs yearly",
    path: ["ends_on"],
  })
  .meta({ id: "TravelWindowInput" });
export type TravelWindowInput = z.infer<typeof TravelWindowInputSchema>;

export const TravelWindowSchema = z
  .object({
    id: Id,
    ...travelWindowFields,
    created_at: IsoDateTime,
    updated_at: IsoDateTime,
  })
  .meta({ id: "TravelWindow" });
export type TravelWindow = z.infer<typeof TravelWindowSchema>;

/** "Keeping watch of SFO, OAK, and SJC". `rank` 1 is the preferred airport. */
export const HomeAirportInputSchema = z
  .object({
    code: IataCode,
    name: z.string().trim().min(1).max(160),
    city: z.string().trim().max(120).default(""),
    rank: z.number().int().min(1).max(50).default(1),
    drive_minutes: z.number().int().min(0).max(600).nullish(),
    is_active: z.boolean().default(true),
    notes: z.string().max(1_000).default(""),
  })
  .meta({ id: "HomeAirportInput" });
export type HomeAirportInput = z.infer<typeof HomeAirportInputSchema>;

export const HomeAirportSchema = HomeAirportInputSchema.extend({
  id: Id,
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
}).meta({ id: "HomeAirport" });
export type HomeAirport = z.infer<typeof HomeAirportSchema>;

/**
 * A trip that already happened. This is what `calendar_checks.days_since_last_trip`
 * is derived from, which is the only reason the brief's "we have not just
 * returned from a trip" gate can be evaluated at all.
 *
 * `person_id` is null for a trip the household took together, and set for one
 * person's trip — Jason flying home to Singapore alone does not reset the
 * household's clock.
 */
const tripHistoryFields = {
    label: z.string().trim().min(1).max(200),
    destination: z.string().trim().max(200).default(""),
    started_on: IsoDate,
    ended_on: IsoDate,
    kind: TripKindSchema.default("vacation"),
    /** Null for a trip the household took together. */
    person_id: Id.nullish(),
    legs: z.number().int().min(0).max(30).default(0),
    workdays_off: z.number().int().min(0).max(120).nullish(),
    source: TripSourceSchema.default("manual"),
    /** Set when the trip happened because a proposal was accepted. */
    source_proposal_id: Id.nullish(),
    notes: z.string().max(4_000).default(""),
} as const;

export const TripHistoryInputSchema = z
  .object(tripHistoryFields)
  .refine((t) => t.started_on <= t.ended_on, {
    message: "ended_on must not precede started_on",
    path: ["ended_on"],
  })
  .meta({ id: "TripHistoryInput" });
export type TripHistoryInput = z.infer<typeof TripHistoryInputSchema>;

export const TripHistorySchema = z
  .object({
    id: Id,
    ...tripHistoryFields,
    created_at: IsoDateTime,
    updated_at: IsoDateTime,
  })
  .meta({ id: "TripHistory" });
export type TripHistory = z.infer<typeof TripHistorySchema>;

// ---------------------------------------------------------------------------
// taste_artists, taste_genres, venue_stances
// ---------------------------------------------------------------------------

/**
 * A performer worth watching for: "listing of some of our favoirte artist and
 * comedians like adele, pink, chelsea handler", plus the ones an agent
 * suggests from listening history.
 *
 * `source` separates the two. A `manual` row is something Justin said; an
 * `agent` row is a guess, and a guess must not be quoted back as a stated
 * preference.
 */
export const TasteArtistInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    performer_type: z.enum(["artist", "comedian", "band", "other"]).default("artist"),
    tier: TasteTierSchema.default("unknown"),
    affinity: TasteAffinitySchema.default("like"),
    /** Whose favourite. Sammy Cheng is Jason's; null means the household's. */
    for_person_id: Id.nullish(),
    source: TasteSourceSchema.default("manual"),
    spotify_artist_id: z.string().trim().max(64).default(""),
    /** Linked once a sighting creates the performer entity. */
    entity_id: Id.nullish(),
    notes: z.string().max(2_000).default(""),
  })
  .meta({ id: "TasteArtistInput" });
export type TasteArtistInput = z.infer<typeof TasteArtistInputSchema>;

export const TasteArtistSchema = TasteArtistInputSchema.extend({
  id: Id,
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
}).meta({ id: "TasteArtist" });
export type TasteArtist = z.infer<typeof TasteArtistSchema>;

/** A genre, with how much it is wanted. Filled by hand and by the Spotify sync. */
export const TasteGenreInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    affinity: TasteAffinitySchema.default("like"),
    for_person_id: Id.nullish(),
    source: TasteSourceSchema.default("manual"),
    notes: z.string().max(1_000).default(""),
  })
  .meta({ id: "TasteGenreInput" });
export type TasteGenreInput = z.infer<typeof TasteGenreInputSchema>;

export const TasteGenreSchema = TasteGenreInputSchema.extend({
  id: Id,
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
}).meta({ id: "TasteGenre" });
export type TasteGenre = z.infer<typeof TasteGenreSchema>;

/**
 * A stance toward a place, keyed by NAME rather than by an entity.
 *
 * "japan may be played out at this piont given my husband has been twice
 * recently" is config, stated before any `destination` entity exists, so this
 * table cannot require one — `entity_id` links to it later if a sighting
 * creates it.
 *
 * `until` matters because `played_out` is temporary. Japan being played out in
 * 2026 says nothing about 2029, and a stance with no expiry would quietly
 * become permanent.
 */
export const VenueStanceInputSchema = z
  .object({
    place_name: z.string().trim().min(1).max(200),
    place_kind: PlaceKindSchema.default("destination"),
    stance: PlaceStanceSchema,
    reason: z.string().max(2_000).default(""),
    /** When the stance stops applying. Null means it stands until changed. */
    until: IsoDate.nullish(),
    for_person_id: Id.nullish(),
    entity_id: Id.nullish(),
  })
  .meta({ id: "VenueStanceInput" });
export type VenueStanceInput = z.infer<typeof VenueStanceInputSchema>;

export const VenueStanceSchema = VenueStanceInputSchema.extend({
  id: Id,
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
}).meta({ id: "VenueStance" });
export type VenueStance = z.infer<typeof VenueStanceSchema>;


/**
 * A wishlist item's status. `wanted` is the only one a briefing hands to an
 * agent; `dropped` is kept rather than deleted, so a later sweep does not
 * re-propose something that was already turned down.
 */
export const WISHLIST_STATUSES = ["wanted", "acquired", "dropped"] as const;
export const WishlistStatusSchema = z.enum(WISHLIST_STATUSES).meta({ id: "WishlistStatus" });

/**
 * One requirement that disqualifies a find.
 *
 * Stored as validated jsonb rather than a table: it is a short list owned by
 * one row, the same shape `sightings.criteria_match` and `itinerary_items.tips`
 * already use. `label` is what an agent is told; `attribute`, `operator` and
 * `value` are the optional machine-readable form, exactly as a goal criterion
 * carries both.
 */
export const WishlistRequirementSchema = z
  .object({
    label: z.string().trim().min(1).max(300),
    attribute: z.string().max(64).nullish(),
    operator: z.string().max(32).nullish(),
    value: z.unknown().optional(),
  })
  .meta({ id: "WishlistRequirement" });
export type WishlistRequirement = z.infer<typeof WishlistRequirementSchema>;

/**
 * A wanted thing, as a row: "I want a shark slurpee machine for example".
 *
 * `target_price_cents` is nullable and a null is NOT a target of zero and not
 * "any price will do" — it means no target has been set, and a surface that
 * reads it as either would either never flag a good price or flag every price.
 */
const wishlistItemFields = {
  label: z.string().trim().min(1).max(300),
  /** Who it is for. Null means the household's. */
  for_person_id: Id.nullish(),
  /** The goal vocabulary, so a product goal can ask for the product items. */
  category: z.enum(["experience", "travel", "product", "gift", "deal", "research"]).default("product"),
  target_price_cents: z.number().int().nonnegative().nullish(),
  msrp_cents: z.number().int().nonnegative().nullish(),
  currency: z.string().length(3).default("USD"),
  hard_requirements: z.array(WishlistRequirementSchema).max(50).default([]),
  notes: z.string().max(4_000).default(""),
  /** Set when a sighting is confirmed to BE this thing. */
  matched_entity_id: Id.nullish(),
  status: WishlistStatusSchema.default("wanted"),
} as const;

export const WishlistItemInputSchema = z
  .object(wishlistItemFields)
  .refine(
    (w) =>
      w.target_price_cents == null || w.msrp_cents == null || w.target_price_cents <= w.msrp_cents,
    {
      message: "target_price_cents must not exceed msrp_cents",
      path: ["target_price_cents"],
    },
  )
  .refine((w) => w.status !== "acquired" || w.matched_entity_id != null, {
    message: "An acquired item must name the entity it was matched to",
    path: ["matched_entity_id"],
  })
  .meta({ id: "WishlistItemInput" });
export type WishlistItemInput = z.infer<typeof WishlistItemInputSchema>;

export const WishlistItemPatchSchema = z
  .object(wishlistItemFields)
  .partial()
  .meta({ id: "WishlistItemPatch" });

export const WishlistItemSchema = z
  .object({
    id: Id,
    ...wishlistItemFields,
    added_at: IsoDateTime,
    created_at: IsoDateTime,
    updated_at: IsoDateTime,
  })
  .meta({ id: "WishlistItem" });
export type WishlistItem = z.infer<typeof WishlistItemSchema>;

export const WISHLIST_LIST_FIELDS = {
  label: { type: "text", label: "Item", sortable: true },
  category: {
    type: "select",
    label: "Category",
    groupable: true,
    sortable: true,
    options: ["experience", "travel", "product", "gift", "deal", "research"],
  },
  status: { type: "select", label: "Status", groupable: true, sortable: true, options: WISHLIST_STATUSES },
  target_price_cents: { type: "number", label: "Target", sortable: true },
  msrp_cents: { type: "number", label: "List price", sortable: true },
  added_at: { type: "date", label: "Added", sortable: true },
} as const satisfies ListFields;

// ---------------------------------------------------------------------------
// PATCH schemas.
//
// A partial loses the cross-field rules (a minimum cannot be checked against a
// maximum the request did not send), so a route must merge the patch onto the
// stored row and re-validate with the FULL input schema. That is what
// `routes/shopping/goals.ts` does, and these exist so a PATCH still reports a
// field path for every unknown or malformed key.
// ---------------------------------------------------------------------------

export const PersonPatchSchema = PersonInputSchema.partial().meta({ id: "PersonPatch" });
export const PreferencesPatchSchema = z.object(preferencesFields).partial().meta({ id: "PreferencesPatch" });
export const HotelBrandRulePatchSchema = HotelBrandRuleInputSchema.partial().meta({ id: "HotelBrandRulePatch" });
export const LoyaltyProgramPatchSchema = LoyaltyProgramInputSchema.partial().meta({ id: "LoyaltyProgramPatch" });
export const LoyaltyAccountPatchSchema = z.object(loyaltyAccountFields).partial().meta({ id: "LoyaltyAccountPatch" });
export const TransferPartnerPatchSchema = z.object(transferPartnerFields).partial().meta({ id: "TransferPartnerPatch" });
export const TravelWindowPatchSchema = z.object(travelWindowFields).partial().meta({ id: "TravelWindowPatch" });
export const HomeAirportPatchSchema = HomeAirportInputSchema.partial().meta({ id: "HomeAirportPatch" });
export const TasteArtistPatchSchema = TasteArtistInputSchema.partial().meta({ id: "TasteArtistPatch" });
export const TasteGenrePatchSchema = TasteGenreInputSchema.partial().meta({ id: "TasteGenrePatch" });
export const VenueStancePatchSchema = VenueStanceInputSchema.partial().meta({ id: "VenueStancePatch" });
export const TripHistoryPatchSchema = z.object(tripHistoryFields).partial().meta({ id: "TripHistoryPatch" });

/**
 * How a bulk save treats rows the request did not mention.
 *
 * `upsert` is the default and leaves them alone. `replace` DELETES them, which
 * is what a settings grid showing the whole list means by "save", and is
 * destructive if a client sends a partial list — so it has to be asked for by
 * name rather than being what happens when the field is left out.
 */
export const BULK_SAVE_MODES = ["upsert", "replace"] as const;
export const BulkSaveModeSchema = z.enum(BULK_SAVE_MODES).default("upsert").meta({ id: "BulkSaveMode" });

/** One resource's bulk save. An item with an `id` is an update. */
export function bulkSaveBody<T extends z.ZodType>(item: T) {
  return z.object({
    mode: BulkSaveModeSchema,
    items: z.array(z.object({ id: Id.optional() }).and(item)).max(500),
  });
}

/** What a bulk save reports back, per resource. */
export const BulkSaveResultSchema = z
  .object({
    resource: z.string(),
    created: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    deleted: z.number().int().nonnegative(),
  })
  .meta({ id: "BulkSaveResult" });
export type BulkSaveResult = z.infer<typeof BulkSaveResultSchema>;

// ---------------------------------------------------------------------------
// List field declarations, for the settings surfaces that use the list engine.
// ---------------------------------------------------------------------------

export const PEOPLE_LIST_FIELDS = {
  display_name: { type: "text", label: "Name", sortable: true },
  slug: { type: "text", label: "Slug", sortable: true },
  relationship: {
    type: "select",
    label: "Relationship",
    groupable: true,
    sortable: true,
    options: PERSON_RELATIONSHIPS,
  },
  home_country: { type: "text", label: "Home country", groupable: true, sortable: true },
  is_active: { type: "boolean", label: "Active", groupable: true },
} as const satisfies ListFields;

export const HOTEL_BRAND_RULE_LIST_FIELDS = {
  brand: { type: "text", label: "Brand", sortable: true },
  stance: { type: "select", label: "Stance", groupable: true, sortable: true, options: BRAND_STANCES },
  since: { type: "date", label: "Since", sortable: true },
} as const satisfies ListFields;

export const LOYALTY_PROGRAM_LIST_FIELDS = {
  name: { type: "text", label: "Name", sortable: true },
  code: { type: "text", label: "Code", sortable: true },
  kind: { type: "select", label: "Kind", groupable: true, sortable: true, options: LOYALTY_PROGRAM_KINDS },
  alliance: { type: "text", label: "Alliance", groupable: true, sortable: true },
} as const satisfies ListFields;

export const LOYALTY_ACCOUNT_LIST_FIELDS = {
  account_label: { type: "text", label: "Account", sortable: true },
  elite_tier: { type: "text", label: "Tier", groupable: true, sortable: true },
  /** Sortable, and nullable: an unmeasured balance sorts as unknown, not as 0. */
  points_balance: { type: "number", label: "Balance", sortable: true },
  balance_as_of: { type: "date", label: "Read on", sortable: true },
} as const satisfies ListFields;

export const TRANSFER_PARTNER_LIST_FIELDS = {
  ratio_from: { type: "number", label: "From", sortable: true },
  ratio_to: { type: "number", label: "To", sortable: true },
  is_active: { type: "boolean", label: "Active", groupable: true },
  last_verified_on: { type: "date", label: "Verified", sortable: true },
} as const satisfies ListFields;

export const HOME_AIRPORT_LIST_FIELDS = {
  code: { type: "text", label: "Code", sortable: true },
  name: { type: "text", label: "Name", sortable: true },
  city: { type: "text", label: "City", groupable: true, sortable: true },
  rank: { type: "number", label: "Rank", sortable: true },
  is_active: { type: "boolean", label: "Active", groupable: true },
} as const satisfies ListFields;

export const TASTE_GENRE_LIST_FIELDS = {
  name: { type: "text", label: "Genre", sortable: true },
  affinity: { type: "select", label: "Affinity", groupable: true, sortable: true, options: TASTE_AFFINITIES },
  source: { type: "select", label: "Source", groupable: true, sortable: true, options: TASTE_SOURCES },
} as const satisfies ListFields;

export const VENUE_STANCE_LIST_FIELDS = {
  place_name: { type: "text", label: "Place", sortable: true },
  place_kind: { type: "select", label: "Kind", groupable: true, sortable: true, options: PLACE_KINDS },
  stance: { type: "select", label: "Stance", groupable: true, sortable: true, options: PLACE_STANCES },
  until: { type: "date", label: "Until", sortable: true },
} as const satisfies ListFields;

export const TRAVEL_WINDOW_LIST_FIELDS = {
  label: { type: "text", label: "Label", sortable: true },
  stance: { type: "select", label: "Stance", groupable: true, sortable: true, options: TRAVEL_WINDOW_STANCES },
  starts_on: { type: "date", label: "Starts", sortable: true },
  ends_on: { type: "date", label: "Ends", sortable: true },
  recurs_yearly: { type: "boolean", label: "Recurs yearly", groupable: true },
} as const satisfies ListFields;

export const TASTE_ARTIST_LIST_FIELDS = {
  name: { type: "text", label: "Name", sortable: true },
  performer_type: {
    type: "select",
    label: "Type",
    groupable: true,
    sortable: true,
    options: ["artist", "comedian", "band", "other"],
  },
  tier: { type: "select", label: "Tier", groupable: true, sortable: true, options: TASTE_TIERS },
  affinity: { type: "select", label: "Affinity", groupable: true, sortable: true, options: TASTE_AFFINITIES },
  source: { type: "select", label: "Source", groupable: true, sortable: true, options: TASTE_SOURCES },
} as const satisfies ListFields;

export const TRIP_HISTORY_LIST_FIELDS = {
  label: { type: "text", label: "Label", sortable: true },
  destination: { type: "text", label: "Destination", sortable: true },
  started_on: { type: "date", label: "Started", sortable: true },
  ended_on: { type: "date", label: "Ended", sortable: true },
  kind: { type: "select", label: "Kind", groupable: true, sortable: true, options: TRIP_KINDS },
  source: { type: "select", label: "Source", groupable: true, sortable: true, options: TRIP_SOURCES },
} as const satisfies ListFields;

/**
 * Every config resource the API exposes, in the order a settings shell should
 * show them. The key is the `/api/config/{resource}` path segment.
 */
export const CONFIG_RESOURCES = [
  "people",
  "preferences",
  "hotel-brand-rules",
  "loyalty-programs",
  "loyalty-accounts",
  "transfer-partners",
  "travel-windows",
  "home-airports",
  "taste-artists",
  "taste-genres",
  "venue-stances",
  "trip-history",
  "wishlist",
] as const;
export type ConfigResource = (typeof CONFIG_RESOURCES)[number];
