/**
 * @fileoverview record_sighting contract (maestro cs-be-3-4): what an agent
 * sends when it sees something, and the dedupe answer it gets back.
 *
 * The answer tells the agent whether this is new or a re-sighting, how many
 * times the entity has been seen, how the price moved, and every earlier
 * proposal that carried the entity with its verdict and reasons, so the agent
 * knows it already proposed this and what the person said.
 *
 * `POST /api/sightings` takes this body; browser runs and the MCP server call
 * the same `recordSighting` function inside the Worker.
 */

import { z } from "zod";

import { EntityKindSchema, SOURCE_KINDS, VERDICTS } from "./catalog";
import { Id, IsoDateTime } from "./common";
import { ProposalStatusSchema } from "./proposals";

export const EntityHintsSchema = z
  .object({
    performer: z.string().max(200),
    venue: z.string().max(200),
    city: z.string().max(200),
    starts_at: z.string().max(40),
    brand: z.string().max(200),
    model: z.string().max(200),
    variant: z.string().max(200),
    origin: z.string().max(10),
    destination: z.string().max(10),
    carrier: z.string().max(100),
    cabin: z.string().max(40),
    depart_on: z.string().max(40),
    return_on: z.string().max(40),
    property_name: z.string().max(200),
  })
  .partial()
  .strict()
  .meta({ id: "EntityHints" });
export type EntityHintsBody = z.infer<typeof EntityHintsSchema>;

export const RecordSightingSchema = z
  .object({
    kind: EntityKindSchema,
    title: z.string().trim().min(1).max(500),
    url: z.string().max(2_000).nullish(),
    email_message_id: z.string().max(500).nullish(),
    source_kind: z.enum(SOURCE_KINDS).nullish(),
    excerpt: z.string().max(2_000).nullish(),
    price_cents: z.number().int().nonnegative().nullish(),
    msrp_cents: z.number().int().nonnegative().nullish(),
    currency: z.string().length(3).toUpperCase().nullish(),
    on_sale: z.boolean().nullish(),
    availability: z.string().max(100).nullish(),
    seller: z.string().max(200).nullish(),
    agent_score: z.number().min(0).max(1).nullish(),
    agent_rationale: z.string().max(2_000).nullish(),
    hints: EntityHintsSchema.optional(),
    run_id: Id.nullish(),
    goal_id: Id.nullish(),
  })
  .strict()
  .meta({ id: "RecordSighting" });
export type RecordSightingBody = z.infer<typeof RecordSightingSchema>;

export const PriorProposalSchema = z
  .object({
    proposal_id: Id,
    status: ProposalStatusSchema,
    title: z.string(),
    created_at: IsoDateTime,
    decided_at: IsoDateTime.nullable(),
    /** Latest verdict that was not undone; null while the proposal is undecided. */
    verdict: z.enum(VERDICTS).nullable(),
    reason_codes: z.array(z.string()),
    note: z.string(),
  })
  .meta({ id: "PriorProposal" });

export const SightingDedupeSchema = z
  .object({
    status: z.enum(["new", "resighting"]),
    /** How the entity was found: its fingerprint, an earlier sighting of the same canonical URL, or created now. */
    matched_by: z.enum(["fingerprint", "url", "created"]),
    entity_id: Id,
    sighting_id: Id,
    fingerprint: z.string(),
    fingerprint_basis: z.enum(["attrs", "url", "email", "title"]),
    sighting_count: z.number().int().positive(),
    price_delta: z
      .object({
        previous_cents: z.number().int(),
        current_cents: z.number().int(),
        delta_cents: z.number().int(),
        delta_pct: z.number().nullable(),
        currency: z.string().nullable(),
        previous_seen_at: IsoDateTime,
      })
      .nullable(),
    prior_proposals: z.array(PriorProposalSchema),
  })
  .meta({ id: "SightingDedupe" });
export type SightingDedupe = z.infer<typeof SightingDedupeSchema>;
