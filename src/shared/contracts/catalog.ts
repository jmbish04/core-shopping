/**
 * @fileoverview Catalog contracts (maestro cs-c-04): canonical entities, the
 * sightings agents record against them, and price history. Read by the
 * Findings grid, the entity sheet and the Goal viewport's raking-in tab.
 *
 * An Entity is the thing (a show, a flight, a product); a Sighting is one
 * observation of it by one run from one source. Dedupe maps sightings onto
 * entities, so `sighting_count > 1` is how the UI shows "seen before".
 */

import { z } from "zod";

import { Id, IsoDate, IsoDateTime, type ListFields } from "./common";

export const ENTITY_KINDS = [
  "event",
  "performer",
  "venue",
  "product",
  "flight",
  /**
   * A scheduled service between two airports, with no dates: "STARLUX will fly
   * SFO-TPE nonstop". A `flight` is a dated, priced itinerary on such a route,
   * so the two dedupe differently and must not share a kind (cs-gap-route-watch).
   */
  "route",
  "hotel",
  "experience",
  "destination",
  "review_snippet",
] as const;
export const SOURCE_KINDS = ["web", "email", "api", "reddit", "review_site", "other"] as const;
export const VERDICTS = ["strong_no", "no", "somewhat", "strong_yes"] as const;

/**
 * Where a route is in its life. `announced` is the one the brief asks to watch
 * — the news that a nonstop is coming, months before a fare exists.
 */
export const ROUTE_STATUSES = ["announced", "scheduled", "flying", "discontinued"] as const;

export const EntityKindSchema = z.enum(ENTITY_KINDS).meta({ id: "EntityKind" });
export const RouteStatusSchema = z.enum(ROUTE_STATUSES).meta({ id: "RouteStatus" });

export const ImageRefSchema = z
  .object({
    id: Id,
    cf_image_id: z.string().nullable(),
    url: z.string(),
    alt: z.string(),
  })
  .meta({ id: "ImageRef" });

export const EntitySchema = z
  .object({
    id: Id,
    kind: EntityKindSchema,
    fingerprint: z.string(),
    title: z.string(),
    summary: z.string(),
    /** Kind-specific attributes (performer, venue, starts_at, brand, model, route, cabin...). */
    attrs: z.record(z.string(), z.unknown()),
    images: z.array(ImageRefSchema),
    first_seen_at: IsoDateTime,
    last_seen_at: IsoDateTime,
    sighting_count: z.number().int().nonnegative(),
  })
  .meta({ id: "Entity" });
export type Entity = z.infer<typeof EntitySchema>;

export const SightingSchema = z
  .object({
    id: Id,
    entity_id: Id,
    run_id: Id.nullable(),
    goal_id: Id.nullable(),
    source_kind: z.enum(SOURCE_KINDS).nullable(),
    source_domain: z.string().nullable(),
    url: z.string().nullable(),
    email_message_id: z.string().nullable(),
    title: z.string(),
    excerpt: z.string(),
    price_cents: z.number().int().nullable(),
    msrp_cents: z.number().int().nullable(),
    currency: z.string().nullable(),
    on_sale: z.boolean().nullable(),
    availability: z.string().nullable(),
    points_price: z.number().int().nullable(),
    points_program: z.string().nullable(),
    agent_score: z.number().min(0).max(1).nullable(),
    agent_rationale: z.string(),
    criteria_match: z.array(z.object({ label: z.string(), met: z.boolean() })),
    is_resighting: z.boolean(),
    seen_at: IsoDateTime,
  })
  .meta({ id: "Sighting" });
export type Sighting = z.infer<typeof SightingSchema>;

export const PricePointSchema = z
  .object({
    observed_at: IsoDateTime,
    seller: z.string(),
    price_cents: z.number().int(),
    currency: z.string(),
  })
  .meta({ id: "PricePoint" });
export type PricePoint = z.infer<typeof PricePointSchema>;

/** One row of the Findings grid: an entity with its latest sighting folded in. */
export const FindingRowSchema = z
  .object({
    entity_id: Id,
    kind: EntityKindSchema,
    title: z.string(),
    image_url: z.string().nullable(),
    goal_id: Id.nullable(),
    source_domain: z.string().nullable(),
    price_cents: z.number().int().nullable(),
    msrp_cents: z.number().int().nullable(),
    currency: z.string().nullable(),
    on_sale: z.boolean().nullable(),
    sighting_count: z.number().int().nonnegative(),
    first_seen_at: IsoDateTime,
    last_seen_at: IsoDateTime,
    /** Latest HITL verdict on any proposal carrying this entity. */
    verdict: z.enum(VERDICTS).nullable(),
    event_date: IsoDate.nullable(),
  })
  .meta({ id: "FindingRow" });
export type FindingRow = z.infer<typeof FindingRowSchema>;

export const FINDING_LIST_FIELDS = {
  title: { type: "text", label: "Title", sortable: true },
  kind: { type: "select", label: "Kind", groupable: true, sortable: true, options: ENTITY_KINDS },
  goal_id: { type: "select", label: "Goal", groupable: true },
  source_domain: { type: "text", label: "Source", groupable: true },
  verdict: { type: "select", label: "Verdict", groupable: true, options: VERDICTS },
  price_cents: { type: "number", label: "Price", sortable: true },
  on_sale: { type: "boolean", label: "On sale", groupable: true },
  sighting_count: { type: "number", label: "Sightings", sortable: true },
  last_seen_at: { type: "date", label: "Last seen", sortable: true },
} as const satisfies ListFields;
