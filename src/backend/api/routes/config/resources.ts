/**
 * @fileoverview The twelve configuration resources, described once
 * (maestro cs-be-2-8).
 *
 * Every resource is the same shape — a table, a Zod input schema, a declared
 * list field set and a stable order — so the router builds its routes from
 * this table rather than repeating twelve near-identical handlers. Twelve
 * identical consumers is the case a factory is actually for; one would be an
 * abstraction waiting for a second user.
 *
 * The row-to-wire mapping is DERIVED from the Drizzle column metadata rather
 * than hand-written. `getTableColumns` gives the TypeScript name and the SQL
 * name of every column, so `homeCountry` becomes `home_country` mechanically
 * and a renamed column cannot leave a stale mapper behind. Twelve hand-written
 * mappers would have been twelve chances to drop a field silently.
 */

import { asc, desc, getTableColumns, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { z } from "@hono/zod-openapi";

import { loyaltyAccounts, loyaltyPrograms, transferPartners } from "@/backend/pg/schemas/config/loyalty";
import { people, preferences } from "@/backend/pg/schemas/config/people";
import { tasteArtists, tasteGenres, venueStances } from "@/backend/pg/schemas/config/taste";
import { homeAirports, hotelBrandRules, travelWindows, tripHistory } from "@/backend/pg/schemas/config/travel";
import { occasions } from "@/backend/pg/schemas/config/occasions";
import { wishlistItems } from "@/backend/pg/schemas/config/wishlist";
import {
  HOME_AIRPORT_LIST_FIELDS,
  HomeAirportPatchSchema,
  HomeAirportSchema,
  HotelBrandRulePatchSchema,
  HotelBrandRuleSchema,
  LoyaltyAccountPatchSchema,
  LoyaltyAccountSchema,
  LoyaltyProgramPatchSchema,
  LoyaltyProgramSchema,
  PersonPatchSchema,
  PersonSchema,
  TasteArtistPatchSchema,
  TasteArtistSchema,
  TasteGenrePatchSchema,
  TasteGenreSchema,
  TransferPartnerPatchSchema,
  TransferPartnerSchema,
  TravelWindowPatchSchema,
  TravelWindowSchema,
  TripHistoryPatchSchema,
  TripHistorySchema,
  VenueStancePatchSchema,
  VenueStanceSchema,
  HOTEL_BRAND_RULE_LIST_FIELDS,
  HomeAirportInputSchema,
  HotelBrandRuleInputSchema,
  LOYALTY_ACCOUNT_LIST_FIELDS,
  LOYALTY_PROGRAM_LIST_FIELDS,
  LoyaltyAccountInputSchema,
  LoyaltyProgramInputSchema,
  PEOPLE_LIST_FIELDS,
  PersonInputSchema,
  TASTE_ARTIST_LIST_FIELDS,
  TASTE_GENRE_LIST_FIELDS,
  TRANSFER_PARTNER_LIST_FIELDS,
  TRAVEL_WINDOW_LIST_FIELDS,
  TRIP_HISTORY_LIST_FIELDS,
  TasteArtistInputSchema,
  TasteGenreInputSchema,
  TransferPartnerInputSchema,
  TravelWindowInputSchema,
  TripHistoryInputSchema,
  VENUE_STANCE_LIST_FIELDS,
  VenueStanceInputSchema,
  OCCASION_LIST_FIELDS,
  OccasionInputSchema,
  OccasionPatchSchema,
  OccasionSchema,
  WISHLIST_LIST_FIELDS,
  WishlistItemInputSchema,
  WishlistItemPatchSchema,
  WishlistItemSchema,
} from "@/shared/contracts/config";
import type { ListFields } from "@/shared/contracts/common";

/** One configuration resource, everything the router needs to serve it. */
export interface ConfigResourceSpec {
  /** The `/api/config/{resource}` path segment. */
  resource: string;
  /** For OpenAPI operationIds: `configPeopleList`, `configPeopleCreate`, … */
  operation: string;
  /** Human label for OpenAPI summaries. */
  label: string;
  table: PgTable;
  /** What a person or an agent may write, cross-field rules included. */
  input: z.ZodType;
  /**
   * The same fields, all optional, for PATCH. Its refinements are gone, so a
   * route merges the patch onto the stored row and re-validates with `input`.
   */
  patch: z.ZodType;
  /** The full stored row, for OpenAPI responses. */
  row: z.ZodType;
  fields: ListFields;
  /** Trusted SQL per declared field id. */
  columns: Record<string, AnyPgColumn | SQL>;
  /** Stable ordering, so pagination cannot repeat or skip a row. */
  fallback: SQL;
  /** Columns `?q=` searches. */
  search: AnyPgColumn[];
}

/**
 * Every resource, in the order a settings shell should show them.
 *
 * `preferences` is deliberately absent: it is one household row, not a
 * collection, so it gets its own two routes rather than being bent into a list
 * that is always length one.
 */
export const CONFIG_RESOURCE_SPECS: readonly ConfigResourceSpec[] = [
  {
    resource: "people",
    operation: "People",
    label: "people",
    table: people,
    input: PersonInputSchema,
    patch: PersonPatchSchema,
    row: PersonSchema,
    fields: PEOPLE_LIST_FIELDS,
    columns: {
      display_name: people.displayName,
      slug: people.slug,
      relationship: people.relationship,
      home_country: people.homeCountry,
      is_active: people.isActive,
    },
    fallback: asc(people.displayName),
    search: [people.displayName, people.slug, people.notes],
  },
  {
    resource: "hotel-brand-rules",
    operation: "HotelBrandRules",
    label: "hotel brand rules",
    table: hotelBrandRules,
    input: HotelBrandRuleInputSchema,
    patch: HotelBrandRulePatchSchema,
    row: HotelBrandRuleSchema,
    fields: HOTEL_BRAND_RULE_LIST_FIELDS,
    columns: {
      brand: hotelBrandRules.brand,
      stance: hotelBrandRules.stance,
      since: hotelBrandRules.since,
    },
    fallback: asc(hotelBrandRules.brand),
    search: [hotelBrandRules.brand, hotelBrandRules.reason],
  },
  {
    resource: "loyalty-programs",
    operation: "LoyaltyPrograms",
    label: "loyalty programmes",
    table: loyaltyPrograms,
    input: LoyaltyProgramInputSchema,
    patch: LoyaltyProgramPatchSchema,
    row: LoyaltyProgramSchema,
    fields: LOYALTY_PROGRAM_LIST_FIELDS,
    columns: {
      name: loyaltyPrograms.name,
      code: loyaltyPrograms.code,
      kind: loyaltyPrograms.kind,
      alliance: loyaltyPrograms.alliance,
    },
    fallback: asc(loyaltyPrograms.name),
    search: [loyaltyPrograms.name, loyaltyPrograms.code, loyaltyPrograms.alliance],
  },
  {
    resource: "loyalty-accounts",
    operation: "LoyaltyAccounts",
    label: "loyalty accounts",
    table: loyaltyAccounts,
    input: LoyaltyAccountInputSchema,
    patch: LoyaltyAccountPatchSchema,
    row: LoyaltyAccountSchema,
    fields: LOYALTY_ACCOUNT_LIST_FIELDS,
    columns: {
      account_label: loyaltyAccounts.accountLabel,
      elite_tier: loyaltyAccounts.eliteTier,
      points_balance: loyaltyAccounts.pointsBalance,
      balance_as_of: loyaltyAccounts.balanceAsOf,
    },
    fallback: asc(loyaltyAccounts.id),
    search: [loyaltyAccounts.accountLabel, loyaltyAccounts.eliteTier],
  },
  {
    resource: "transfer-partners",
    operation: "TransferPartners",
    label: "transfer partners",
    table: transferPartners,
    input: TransferPartnerInputSchema,
    patch: TransferPartnerPatchSchema,
    row: TransferPartnerSchema,
    fields: TRANSFER_PARTNER_LIST_FIELDS,
    columns: {
      ratio_from: transferPartners.ratioFrom,
      ratio_to: transferPartners.ratioTo,
      is_active: transferPartners.isActive,
      last_verified_on: transferPartners.lastVerifiedOn,
    },
    fallback: asc(transferPartners.id),
    search: [transferPartners.bonusNote],
  },
  {
    resource: "travel-windows",
    operation: "TravelWindows",
    label: "travel windows",
    table: travelWindows,
    input: TravelWindowInputSchema,
    patch: TravelWindowPatchSchema,
    row: TravelWindowSchema,
    fields: TRAVEL_WINDOW_LIST_FIELDS,
    columns: {
      label: travelWindows.label,
      stance: travelWindows.stance,
      starts_on: travelWindows.startsOn,
      ends_on: travelWindows.endsOn,
      recurs_yearly: travelWindows.recursYearly,
    },
    fallback: asc(travelWindows.startsOn),
    search: [travelWindows.label, travelWindows.reason],
  },
  {
    resource: "home-airports",
    operation: "HomeAirports",
    label: "home airports",
    table: homeAirports,
    input: HomeAirportInputSchema,
    patch: HomeAirportPatchSchema,
    row: HomeAirportSchema,
    fields: HOME_AIRPORT_LIST_FIELDS,
    columns: {
      code: homeAirports.code,
      name: homeAirports.name,
      city: homeAirports.city,
      rank: homeAirports.rank,
      is_active: homeAirports.isActive,
    },
    fallback: asc(homeAirports.rank),
    search: [homeAirports.code, homeAirports.name, homeAirports.city],
  },
  {
    resource: "taste-artists",
    operation: "TasteArtists",
    label: "taste artists",
    table: tasteArtists,
    input: TasteArtistInputSchema,
    patch: TasteArtistPatchSchema,
    row: TasteArtistSchema,
    fields: TASTE_ARTIST_LIST_FIELDS,
    columns: {
      name: tasteArtists.name,
      performer_type: tasteArtists.performerType,
      tier: tasteArtists.tier,
      affinity: tasteArtists.affinity,
      source: tasteArtists.source,
    },
    fallback: asc(tasteArtists.name),
    search: [tasteArtists.name, tasteArtists.notes],
  },
  {
    resource: "taste-genres",
    operation: "TasteGenres",
    label: "taste genres",
    table: tasteGenres,
    input: TasteGenreInputSchema,
    patch: TasteGenrePatchSchema,
    row: TasteGenreSchema,
    fields: TASTE_GENRE_LIST_FIELDS,
    columns: {
      name: tasteGenres.name,
      affinity: tasteGenres.affinity,
      source: tasteGenres.source,
    },
    fallback: asc(tasteGenres.name),
    search: [tasteGenres.name, tasteGenres.notes],
  },
  {
    resource: "venue-stances",
    operation: "VenueStances",
    label: "place stances",
    table: venueStances,
    input: VenueStanceInputSchema,
    patch: VenueStancePatchSchema,
    row: VenueStanceSchema,
    fields: VENUE_STANCE_LIST_FIELDS,
    columns: {
      place_name: venueStances.placeName,
      place_kind: venueStances.placeKind,
      stance: venueStances.stance,
      until: venueStances.until,
    },
    fallback: asc(venueStances.placeName),
    search: [venueStances.placeName, venueStances.reason],
  },
  {
    resource: "trip-history",
    operation: "TripHistory",
    label: "trip history",
    table: tripHistory,
    input: TripHistoryInputSchema,
    patch: TripHistoryPatchSchema,
    row: TripHistorySchema,
    fields: TRIP_HISTORY_LIST_FIELDS,
    columns: {
      label: tripHistory.label,
      destination: tripHistory.destination,
      started_on: tripHistory.startedOn,
      ended_on: tripHistory.endedOn,
      kind: tripHistory.kind,
      source: tripHistory.source,
    },
    /** Newest first: the question asked of this table is always "most recent". */
    fallback: desc(tripHistory.endedOn),
    search: [tripHistory.label, tripHistory.destination, tripHistory.notes],
  },
  {
    resource: "wishlist",
    operation: "Wishlist",
    label: "wishlist items",
    table: wishlistItems,
    input: WishlistItemInputSchema,
    patch: WishlistItemPatchSchema,
    row: WishlistItemSchema,
    fields: WISHLIST_LIST_FIELDS,
    columns: {
      label: wishlistItems.label,
      category: wishlistItems.category,
      status: wishlistItems.status,
      target_price_cents: wishlistItems.targetPriceCents,
      msrp_cents: wishlistItems.msrpCents,
      added_at: wishlistItems.addedAt,
    },
    /** Newest first: a briefing reads the most recently wanted things first. */
    fallback: desc(wishlistItems.addedAt),
    search: [wishlistItems.label, wishlistItems.notes],
  },
  {
    resource: "occasions",
    operation: "Occasions",
    label: "occasions",
    table: occasions,
    input: OccasionInputSchema,
    patch: OccasionPatchSchema,
    row: OccasionSchema,
    fields: OCCASION_LIST_FIELDS,
    columns: {
      label: occasions.label,
      kind: occasions.kind,
      starts_on: occasions.startsOn,
      ends_on: occasions.endsOn,
      lead_days: occasions.leadDays,
      recurs_yearly: occasions.recursYearly,
      is_active: occasions.isActive,
    },
    fallback: asc(occasions.startsOn),
    search: [occasions.label, occasions.notes],
  },
];

/** Look a resource up by its path segment. */
export function specFor(resource: string): ConfigResourceSpec | undefined {
  return CONFIG_RESOURCE_SPECS.find((spec) => spec.resource === resource);
}

/**
 * The SQL column name for each TypeScript property, read from the table.
 *
 * @param table - Any Drizzle Postgres table.
 * @returns Pairs of `[tsName, sqlName]`.
 */
function columnNames(table: PgTable): Array<[string, string]> {
  return Object.entries(getTableColumns(table)).map(([tsName, column]) => [
    tsName,
    (column as AnyPgColumn).name,
  ]);
}

/**
 * Convert a database row to the wire shape, using the table's own column names.
 *
 * Timestamps become ISO-8601 strings with a zone; `date` columns already arrive
 * as `YYYY-MM-DD` text from `pg` and are passed through. Null stays null — this
 * function never substitutes a zero or an empty string for an absent value,
 * because an unmeasured points balance is not a balance of zero.
 *
 * @param table - The table the row came from.
 * @param row - A row as Drizzle returned it, keyed by TypeScript names.
 * @returns The row keyed by SQL column names, JSON-safe.
 * @example
 * ```typescript
 * toWire(people, { homeCountry: "Singapore" }); // { home_country: "Singapore" }
 * ```
 */
export function toWire(table: PgTable, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [tsName, sqlName] of columnNames(table)) {
    const value = row[tsName];
    out[sqlName] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

/**
 * Convert a validated wire object to the values Drizzle writes.
 *
 * Only columns the table actually has are copied, and only keys the caller
 * sent, so a PATCH touches nothing it did not name. Timestamp columns are
 * given real `Date` objects, because drizzle-zod maps a `timestamp` column to
 * a bare `z.date()` with no coercion and a string would be rejected at the
 * driver (see `jsonDate` in `routes/tasks.ts` for the same trap).
 *
 * @param table - The table being written.
 * @param wire - A parsed input object keyed by SQL column names.
 * @returns Values keyed by TypeScript property names.
 */
export function toRow(table: PgTable, wire: Record<string, unknown>): Record<string, unknown> {
  const columns = getTableColumns(table) as Record<string, AnyPgColumn>;
  const out: Record<string, unknown> = {};
  for (const [tsName, sqlName] of columnNames(table)) {
    if (!Object.hasOwn(wire, sqlName)) continue;
    const value = wire[sqlName];
    const isTimestamp = columns[tsName]?.columnType === "PgTimestamp";
    out[tsName] = isTimestamp && typeof value === "string" ? new Date(value) : value;
  }
  return out;
}

