/**
 * @fileoverview Human-in-the-loop contracts: the review queue, the verdict and
 * its reasons, and the lessons those verdicts become (maestro cs-c-05, cs-c-07).
 *
 * This is the loop the whole product turns on. A swipe is cheap for the user
 * and expensive to waste, so a verdict carries structured REASONS from a
 * per-category vocabulary rather than a free-text note nobody can aggregate.
 * Those reasons are what later become {@link LessonSchema} entries — the
 * "brain" every agent reads before it proposes anything.
 *
 * Two distinctions the schemas enforce because getting them wrong is how this
 * loop quietly stops working:
 *
 * 1. A verdict has STRENGTH (`strong_no` … `strong_yes`), not just a sign. "I
 *    would go if it were cheaper" and "never this venue" must not collapse
 *    into the same signal.
 * 2. A lesson is PROPOSED until a person accepts it. An agent may write what it
 *    thinks it learned; it may not change its own instructions.
 */

import { z } from "zod";

import { Id, IsoDateTime, type ListFields } from "./common";
import { VERDICTS } from "./catalog";
import { GOAL_CATEGORIES } from "./goals";
import { ProposalSchema } from "./proposals";

export const VerdictSchema = z.enum(VERDICTS).meta({ id: "Verdict" });
/** Which way a reason points, so the UI shows only the relevant chips. */
export const REASON_POLARITIES = ["positive", "negative", "neutral"] as const;

export const ReasonCodeSchema = z
  .object({
    code: z.string().min(1).max(64),
    label: z.string().min(1).max(120),
    polarity: z.enum(REASON_POLARITIES),
    /** null means it applies to every category. */
    category: z.enum(GOAL_CATEGORIES).nullable(),
    sort_order: z.number().int().default(0),
    is_active: z.boolean().default(true),
  })
  .meta({ id: "ReasonCode" });
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;

/** One card in the swipe deck. */
export const ReviewQueueItemSchema = z
  .object({
    proposal: ProposalSchema,
    goal_title: z.string().nullable(),
    /** How many times this entity has been seen before, so "seen before" is visible. */
    prior_sightings: z.number().int().nonnegative(),
    /** A decided proposal for the same thing, if any — shown as context, never re-queued. */
    prior_verdict: VerdictSchema.nullable(),
    prior_reason_codes: z.array(z.string()).default([]),
    /** Ordering inputs: expiring soon and high-confidence first. */
    queued_at: IsoDateTime,
    expires_at: IsoDateTime.nullable(),
  })
  .meta({ id: "ReviewQueueItem" });
export type ReviewQueueItem = z.infer<typeof ReviewQueueItemSchema>;

/** POST /api/review/{proposalId} — what a swipe sends. */
export const ReviewSubmitSchema = z
  .object({
    verdict: VerdictSchema,
    reason_codes: z.array(z.string().min(1)).max(10).default([]),
    note: z.string().max(4_000).default(""),
    /** Milliseconds from card shown to swipe; a proxy for how obvious it was. */
    decided_in_ms: z.number().int().nonnegative().nullish(),
  })
  .meta({ id: "ReviewSubmit" });

export const ReviewSchema = z
  .object({
    id: Id,
    proposal_id: Id,
    goal_id: Id.nullable(),
    verdict: VerdictSchema,
    reason_codes: z.array(z.string()),
    note: z.string(),
    decided_in_ms: z.number().int().nullable(),
    created_at: IsoDateTime,
    /** Set when undone, so an undo is auditable rather than a deletion. */
    undone_at: IsoDateTime.nullable(),
  })
  .meta({ id: "Review" });
export type Review = z.infer<typeof ReviewSchema>;

// ---------------------------------------------------------------------------
// The brain
// ---------------------------------------------------------------------------

export const LESSON_SCOPES = ["global", "category", "goal"] as const;
export const LESSON_STATUSES = ["proposed", "active", "retired"] as const;

/**
 * One thing the system believes about what the user wants.
 *
 * `status` is the safety rail: synthesis writes `proposed`, and only a person
 * moves it to `active`. Nothing an agent writes can change what agents are
 * told without a human in between.
 */
export const LessonSchema = z
  .object({
    id: Id,
    scope: z.enum(LESSON_SCOPES),
    category: z.enum(GOAL_CATEGORIES).nullable(),
    goal_id: Id.nullable(),
    /** Written as an instruction an agent can act on, not an observation. */
    statement: z.string().min(1).max(2_000),
    polarity: z.enum(REASON_POLARITIES),
    /** 0..1 from the weight of evidence behind it. */
    confidence: z.number().min(0).max(1),
    status: z.enum(LESSON_STATUSES),
    evidence_count: z.number().int().nonnegative(),
    /** The lesson this one replaces, so the brain has a history. */
    supersedes_id: Id.nullable(),
    created_at: IsoDateTime,
    updated_at: IsoDateTime,
  })
  .meta({ id: "Lesson" });
export type Lesson = z.infer<typeof LessonSchema>;

/** A review that supports a lesson — the receipts behind the claim. */
export const LessonEvidenceSchema = z
  .object({
    review_id: Id,
    proposal_id: Id,
    proposal_title: z.string(),
    verdict: VerdictSchema,
    reason_codes: z.array(z.string()),
    note: z.string(),
    created_at: IsoDateTime,
  })
  .meta({ id: "LessonEvidence" });

/** PATCH /api/lessons/{id} — accept, reword, or retire. */
export const LessonPatchSchema = z
  .object({
    status: z.enum(LESSON_STATUSES).optional(),
    statement: z.string().min(1).max(2_000).optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .meta({ id: "LessonPatch" });

/**
 * Exactly what an agent is handed by MCP `briefing` — and what /brain previews,
 * from the same builder, so the preview can never drift from the real payload.
 */
export const BriefingPreviewSchema = z
  .object({
    generated_at: IsoDateTime,
    goals: z.array(
      z.object({
        id: Id,
        slug: z.string(),
        title: z.string(),
        category: z.enum(GOAL_CATEGORIES),
        revision: z.number().int(),
        system_prompt: z.string(),
        instructions: z.string(),
        criteria: z.array(z.object({ label: z.string(), kind: z.enum(["hard", "soft"]), weight: z.number() })),
        break_rules: z.array(z.string()),
        budget: z.object({ min_cents: z.number().int().nullable(), max_cents: z.number().int().nullable(), currency: z.string() }),
        due: z.boolean(),
      }),
    ),
    lessons: z.array(LessonSchema.pick({ id: true, scope: true, statement: true, polarity: true, confidence: true })),
    /** Past verdicts most similar to what this agent is about to pitch. */
    similar_reviews: z.array(
      z.object({ proposal_title: z.string(), verdict: VerdictSchema, reason_codes: z.array(z.string()), note: z.string() }),
    ),
    open_proposals: z.array(
      z.object({ id: Id, title: z.string(), status: z.string(), created_at: IsoDateTime }),
    ),
    config: z.record(z.string(), z.unknown()),
    playbook: z.string(),
    /** Set when the payload was trimmed to its byte budget, so nothing is silently lost. */
    truncated: z.array(z.string()).default([]),
  })
  .meta({ id: "BriefingPreview" });

export const LESSON_LIST_FIELDS = {
  statement: { type: "text", label: "Statement", sortable: true },
  scope: { type: "select", label: "Scope", groupable: true, sortable: true, options: LESSON_SCOPES },
  status: { type: "select", label: "Status", groupable: true, sortable: true, options: LESSON_STATUSES },
  polarity: { type: "select", label: "Polarity", groupable: true, options: REASON_POLARITIES },
  category: { type: "select", label: "Category", groupable: true, options: GOAL_CATEGORIES },
  goal_id: { type: "select", label: "Goal", groupable: true },
  confidence: { type: "number", label: "Confidence", sortable: true },
  evidence_count: { type: "number", label: "Evidence", sortable: true },
  updated_at: { type: "date", label: "Updated", sortable: true },
} as const satisfies ListFields;
