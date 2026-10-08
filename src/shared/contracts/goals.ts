/**
 * @fileoverview Goal contracts (maestro cs-c-02): the standing shopping briefs
 * scheduled agents work, their revision history, and their stats series.
 *
 * Read by the Goals list, the Goal viewport, the goal wizard and the MCP
 * goal-management operations. Every write to a goal produces a
 * {@link GoalRevision}, whether a person or an agent made it.
 */

import { z } from "zod";

import { Id, IsoDate, IsoDateTime, type ListFields } from "./common";

export const GOAL_CATEGORIES = ["experience", "travel", "product", "gift", "deal", "research"] as const;
export const GOAL_STATUSES = ["active", "paused", "retired"] as const;
export const AGENT_CLIENTS = ["claude", "gpt", "gemini", "browser", "other"] as const;

export const GoalCategorySchema = z.enum(GOAL_CATEGORIES).meta({ id: "GoalCategory" });
export const GoalStatusSchema = z.enum(GOAL_STATUSES).meta({ id: "GoalStatus" });
export const AgentClientSchema = z.enum(AGENT_CLIENTS).meta({ id: "AgentClient" });

/** One criterion: hard ones disqualify, soft ones are weighted preferences. */
export const CriterionSchema = z
  .object({
    id: Id.optional(),
    label: z.string().min(1).max(300),
    kind: z.enum(["hard", "soft"]),
    weight: z.number().min(0).max(10).default(1),
    /** Optional machine-readable form, e.g. attribute "venue", operator "is_none_of". */
    attribute: z.string().max(64).nullish(),
    operator: z.string().max(32).nullish(),
    value: z.unknown().optional(),
  })
  .meta({ id: "GoalCriterion" });
export type Criterion = z.infer<typeof CriterionSchema>;

/** Fields a person or agent can write. */
export const GoalInputSchema = z
  .object({
    title: z.string().min(1).max(200),
    category: GoalCategorySchema,
    status: GoalStatusSchema.default("active"),
    system_prompt: z.string().max(20_000).default(""),
    instructions: z.string().max(50_000).default(""),
    budget_min_cents: z.number().int().nonnegative().nullish(),
    budget_max_cents: z.number().int().nonnegative().nullish(),
    currency: z.string().length(3).default("USD"),
    window_start: IsoDate.nullish(),
    window_end: IsoDate.nullish(),
    time_notes: z.string().max(2_000).default(""),
    /** "If you see this anywhere, break the rules and tell us." */
    break_rules: z.array(z.string().min(1).max(500)).max(50).default([]),
    schedule_hint: z.string().max(200).default(""),
    /** How often a run is expected; drives the stale-goal detector. */
    expected_cadence_hours: z.number().int().min(1).max(24 * 90).nullish(),
    agent_clients: z.array(AgentClientSchema).default([]),
    criteria: z.array(CriterionSchema).max(100).default([]),
  })
  .refine((g) => g.budget_min_cents == null || g.budget_max_cents == null || g.budget_min_cents <= g.budget_max_cents, {
    message: "budget_min_cents must not exceed budget_max_cents",
    path: ["budget_min_cents"],
  })
  .meta({ id: "GoalInput" });
export type GoalInput = z.input<typeof GoalInputSchema>;

/** Partial update; `reason` is recorded on the revision. */
export const GoalPatchSchema = z
  .object({
    changes: z.record(z.string(), z.unknown()),
    reason: z.string().max(1_000).default(""),
  })
  .meta({ id: "GoalPatch" });

export const GoalSchema = z
  .object({
    id: Id,
    slug: z.string(),
    title: z.string(),
    category: GoalCategorySchema,
    status: GoalStatusSchema,
    system_prompt: z.string(),
    instructions: z.string(),
    budget_min_cents: z.number().int().nullable(),
    budget_max_cents: z.number().int().nullable(),
    currency: z.string(),
    window_start: IsoDate.nullable(),
    window_end: IsoDate.nullable(),
    time_notes: z.string(),
    break_rules: z.array(z.string()),
    schedule_hint: z.string(),
    expected_cadence_hours: z.number().int().nullable(),
    agent_clients: z.array(AgentClientSchema),
    criteria: z.array(CriterionSchema),
    current_revision: z.number().int(),
    last_run_at: IsoDateTime.nullable(),
    created_at: IsoDateTime,
    updated_at: IsoDateTime,
  })
  .meta({ id: "Goal" });
export type Goal = z.infer<typeof GoalSchema>;

/** One row of the Goals console. */
export const GoalListRowSchema = GoalSchema.pick({
  id: true,
  slug: true,
  title: true,
  category: true,
  status: true,
  schedule_hint: true,
  budget_min_cents: true,
  budget_max_cents: true,
  currency: true,
  last_run_at: true,
  expected_cadence_hours: true,
})
  .extend({
    /** last_run_at + expected cadence; null when either is unknown. */
    next_expected_at: IsoDateTime.nullable(),
    stale: z.boolean(),
    runs_count: z.number().int().nonnegative(),
    findings_count: z.number().int().nonnegative(),
    /** Share of reviewed proposals with a positive verdict; null before any review. */
    accept_rate: z.number().min(0).max(1).nullable(),
  })
  .meta({ id: "GoalListRow" });
export type GoalListRow = z.infer<typeof GoalListRowSchema>;

export const GoalRevisionSchema = z
  .object({
    id: Id,
    goal_id: Id,
    revision: z.number().int().min(1),
    author_kind: z.enum(["user", "agent", "system"]),
    author: z.string(),
    reason: z.string(),
    changed_fields: z.array(z.string()),
    /** Field-level diff against the previous revision. */
    diff: z.array(z.object({ field: z.string(), before: z.unknown(), after: z.unknown() })),
    created_at: IsoDateTime,
  })
  .meta({ id: "GoalRevision" });
export type GoalRevision = z.infer<typeof GoalRevisionSchema>;

/** One day of the quality-versus-uniqueness series. */
export const GoalStatsPointSchema = z
  .object({
    date: IsoDate,
    runs: z.number().int().nonnegative(),
    quality: z.number().min(0).max(1).nullable(),
    uniqueness: z.number().min(0).max(1).nullable(),
    findings: z.number().int().nonnegative(),
    reviewed: z.number().int().nonnegative(),
    accepted: z.number().int().nonnegative(),
  })
  .meta({ id: "GoalStatsPoint" });
export type GoalStatsPoint = z.infer<typeof GoalStatsPointSchema>;

/** Filterable, groupable, sortable fields of GET /api/goals. */
export const GOAL_LIST_FIELDS = {
  title: { type: "text", label: "Title", sortable: true },
  category: { type: "select", label: "Category", groupable: true, sortable: true, options: GOAL_CATEGORIES },
  status: { type: "select", label: "Status", groupable: true, sortable: true, options: GOAL_STATUSES },
  last_run_at: { type: "date", label: "Last run", sortable: true },
  budget_max_cents: { type: "number", label: "Budget max", sortable: true },
  stale: { type: "boolean", label: "Stale", groupable: true },
} as const satisfies ListFields;
