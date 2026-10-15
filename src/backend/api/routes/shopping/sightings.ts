/**
 * @fileoverview `POST /api/sightings` — record_sighting over HTTP (maestro cs-be-3-4).
 *
 * Stores one sighting through `recordSighting` and returns the dedupe answer:
 * new or re-sighting, the entity, its sighting count, the price change, and
 * earlier proposals with their verdicts and reasons. Browser runs call the same
 * function from `POST /api/runs/{id}/sync`; the MCP server (cs-be-3-1) will too.
 *
 * Mount `sightingsRouter` at `/api/sightings`.
 */

import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import { recordSighting, SightingError } from "@/backend/catalog";
import { withPg } from "@/backend/pg/client";
import { ErrorEnvelopeSchema } from "@/shared/contracts/common";
import {
  RecordSightingSchema,
  SightingDedupeSchema,
  type RecordSightingBody,
} from "@/shared/contracts/sightings";

function errorBody(code: string, message: string) {
  return ErrorEnvelopeSchema.parse({ error: { code, message } });
}

function errorResponse(description: string) {
  return { description, content: { "application/json": { schema: ErrorEnvelopeSchema } } };
}

/**
 * The wire body as `recordSighting` input.
 *
 * @param b - The validated body.
 * @returns The input.
 */
export function sightingInputFromBody(b: RecordSightingBody) {
  const h = b.hints ?? {};
  return {
    kind: b.kind,
    title: b.title,
    url: b.url,
    emailMessageId: b.email_message_id,
    sourceKind: b.source_kind,
    excerpt: b.excerpt,
    priceCents: b.price_cents,
    msrpCents: b.msrp_cents,
    currency: b.currency,
    onSale: b.on_sale,
    availability: b.availability,
    seller: b.seller,
    agentScore: b.agent_score,
    agentRationale: b.agent_rationale,
    hints: {
      performer: h.performer,
      venue: h.venue,
      city: h.city,
      startsAt: h.starts_at,
      brand: h.brand,
      model: h.model,
      variant: h.variant,
      origin: h.origin,
      destination: h.destination,
      carrier: h.carrier,
      cabin: h.cabin,
      departOn: h.depart_on,
      returnOn: h.return_on,
      propertyName: h.property_name,
    },
    runId: b.run_id,
    goalId: b.goal_id,
  };
}

export const sightingsRouter = new OpenAPIHono<{ Bindings: Env }>();

sightingsRouter.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Findings"],
    summary: "Record a sighting and get the dedupe answer",
    description:
      "Maps the sighting onto a canonical entity (fingerprint, then canonical URL), stores it with its price, and answers new or re-sighting, the sighting count, the price change since the last priced sighting, and earlier proposals for the entity with their verdicts and reasons.",
    operationId: "sightingsRecord",
    request: {
      body: { required: true, content: { "application/json": { schema: RecordSightingSchema } } },
    },
    responses: {
      201: {
        description: "Sighting recorded.",
        content: { "application/json": { schema: SightingDedupeSchema } },
      },
      400: errorResponse("Nothing identifies the sighting."),
      404: errorResponse("The goal or run does not exist."),
    },
  }),
  async (c) => {
    const input = sightingInputFromBody(c.req.valid("json"));
    try {
      const answer = await withPg(c.env, (db) => recordSighting(db, input));
      return c.json(SightingDedupeSchema.parse(answer), 201);
    } catch (error) {
      if (error instanceof SightingError) {
        return c.json(errorBody(error.code, error.message), error.status);
      }
      throw error;
    }
  },
);
