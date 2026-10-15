/**
 * @fileoverview Run contracts (maestro cs-c-03): one agent session, its trace
 * of events, and the MCP tool calls it made. Read by Overview, Runs, Run
 * detail and the Goal viewport's Runs tab.
 */

import { z } from "zod";

import { Id, IsoDateTime, type ListFields } from "./common";
import { AGENT_CLIENTS, AgentClientSchema } from "./goals";
import { ProposalKindSchema, ProposalStatusSchema } from "./proposals";

export const RUN_STATUSES = ["running", "succeeded", "failed", "abandoned"] as const;
export const RUN_EVENT_LEVELS = ["debug", "info", "warn", "error"] as const;

export const RunStatusSchema = z.enum(RUN_STATUSES).meta({ id: "RunStatus" });

export const RunSchema = z
  .object({
    id: Id,
    client: AgentClientSchema,
    model: z.string(),
    status: RunStatusSchema,
    goal_ids: z.array(Id),
    started_at: IsoDateTime,
    finished_at: IsoDateTime.nullable(),
    summary: z.string(),
    /** 0..1; null until scored. */
    quality_score: z.number().min(0).max(1).nullable(),
    uniqueness_score: z.number().min(0).max(1).nullable(),
    sightings_count: z.number().int().nonnegative(),
    new_entities_count: z.number().int().nonnegative(),
    proposals_count: z.number().int().nonnegative(),
    session_url: z.string().nullable(),
    error: z.string().nullable(),
  })
  .meta({ id: "Run" });
export type Run = z.infer<typeof RunSchema>;

export const RunEventSchema = z
  .object({
    id: Id,
    run_id: Id,
    at: IsoDateTime,
    level: z.enum(RUN_EVENT_LEVELS),
    /** search, visit, tool, note, decision, ... — free vocabulary, shown as a badge. */
    kind: z.string().max(32),
    message: z.string(),
    data: z.unknown().nullable(),
  })
  .meta({ id: "RunEvent" });
export type RunEvent = z.infer<typeof RunEventSchema>;

export const McpToolCallSchema = z
  .object({
    id: Id,
    run_id: Id.nullable(),
    tool: z.string(),
    operation: z.string(),
    /** Hash of the arguments, never the arguments themselves. */
    args_digest: z.string(),
    status: z.enum(["ok", "error"]),
    latency_ms: z.number().int().nonnegative(),
    error: z.string().nullable(),
    at: IsoDateTime,
  })
  .meta({ id: "McpToolCall" });
export type McpToolCall = z.infer<typeof McpToolCallSchema>;

/** A sighting a run recorded, with enough to read it without a second request. */
export const RunSightingSchema = z
  .object({
    id: Id,
    entity_id: Id,
    title: z.string(),
    url: z.string().nullable(),
    price_cents: z.number().int().nullable(),
    currency: z.string().nullable(),
    agent_score: z.number().min(0).max(1).nullable(),
    is_resighting: z.boolean(),
    seen_at: IsoDateTime,
  })
  .meta({ id: "RunSighting" });
export type RunSighting = z.infer<typeof RunSightingSchema>;

/** A proposal a run produced. */
export const RunProposalSchema = z
  .object({
    id: Id,
    kind: ProposalKindSchema,
    status: ProposalStatusSchema,
    title: z.string(),
    match_score: z.number().nullable(),
    created_at: IsoDateTime,
  })
  .meta({ id: "RunProposal" });
export type RunProposal = z.infer<typeof RunProposalSchema>;

/** GET /api/runs/{id}: the run plus everything it produced. */
export const RunDetailSchema = RunSchema.extend({
  events: z.array(RunEventSchema),
  tool_calls: z.array(McpToolCallSchema),
  sighting_ids: z.array(Id),
  proposal_ids: z.array(Id),
  /** The run's goals with their titles, in goal_ids order. */
  goals: z.array(z.object({ id: Id, title: z.string() })),
  sightings: z.array(RunSightingSchema),
  proposals: z.array(RunProposalSchema),
}).meta({ id: "RunDetail" });
export type RunDetail = z.infer<typeof RunDetailSchema>;

export const RUN_LIST_FIELDS = {
  status: { type: "select", label: "Status", groupable: true, sortable: true, options: RUN_STATUSES },
  client: { type: "select", label: "Client", groupable: true, sortable: true, options: AGENT_CLIENTS },
  model: { type: "text", label: "Model", groupable: true },
  started_at: { type: "date", label: "Started", sortable: true },
  goal_id: { type: "select", label: "Goal", groupable: true },
  quality_score: { type: "number", label: "Quality", sortable: true },
} as const satisfies ListFields;
