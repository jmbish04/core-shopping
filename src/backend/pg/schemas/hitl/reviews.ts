/**
 * @fileoverview The HITL loop: verdicts, their reason vocabulary, and the
 * lessons they become (maestro cs-be-1-5).
 *
 * `reviews.undone_at` rather than a delete: an undo must stay auditable, or
 * the brain can be trained by a swipe nobody can find afterwards.
 *
 * `lessons.status` is the safety rail. Synthesis writes `proposed`; only a
 * person moves a lesson to `active`. Nothing an agent writes reaches another
 * agent's briefing without a human in between.
 */

import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, real, text, timestamp, uuid, vector, type AnyPgColumn } from "drizzle-orm/pg-core";

import { lessonScope, lessonStatus, reasonPolarity, verdict } from "@/backend/pg/schemas/enums-m3";
import { goalCategory } from "@/backend/pg/schemas/enums";
import { goals } from "@/backend/pg/schemas/goals/goals";
import { proposals } from "@/backend/pg/schemas/proposals/proposals";

/** Operator-editable vocabulary; seeded idempotently, never hardcoded in the UI. */
export const reviewReasonCodes = pgTable(
  "review_reason_codes",
  {
    code: text("code").primaryKey(),
    label: text("label").notNull(),
    polarity: reasonPolarity("polarity").notNull(),
    /** null applies to every category. */
    category: goalCategory("category"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("reason_codes_category_idx").on(t.category, t.sortOrder)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    verdict: verdict("verdict").notNull(),
    reasonCodes: text("reason_codes").array().notNull().default(sql`'{}'::text[]`),
    note: text("note").notNull().default(""),
    /** Card shown to swipe; a proxy for how obvious the call was. */
    decidedInMs: integer("decided_in_ms"),
    /** What the agent was told at the time, so a lesson can cite its context. */
    embedding: vector("embedding", { dimensions: 384 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** An undo is recorded, never deleted. */
    undoneAt: timestamp("undone_at", { withTimezone: true }),
  },
  (t) => [
    index("reviews_proposal_idx").on(t.proposalId),
    index("reviews_goal_created_idx").on(t.goalId, t.createdAt),
    index("reviews_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: lessonScope("scope").notNull().default("global"),
    category: goalCategory("category"),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "cascade" }),
    /** Written as an instruction an agent can act on, not an observation. */
    statement: text("statement").notNull(),
    polarity: reasonPolarity("polarity").notNull(),
    confidence: real("confidence").notNull().default(0),
    status: lessonStatus("status").notNull().default("proposed"),
    embedding: vector("embedding", { dimensions: 384 }),
    supersedesId: uuid("supersedes_id").references((): AnyPgColumn => lessons.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The briefing reads exactly this: active lessons for a scope, best first.
    index("lessons_status_scope_idx").on(t.status, t.scope, t.confidence),
    index("lessons_goal_idx").on(t.goalId),
    index("lessons_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

/** The receipts: which reviews support a lesson. */
export const lessonEvidence = pgTable(
  "lesson_evidence",
  {
    lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
    weight: real("weight").notNull().default(1),
  },
  (t) => [index("lesson_evidence_lesson_idx").on(t.lessonId), index("lesson_evidence_review_idx").on(t.reviewId)],
);
