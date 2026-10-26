/**
 * @fileoverview `ideas` and `idea_entities` (maestro cs-gap-idea-bank): a
 * dateless "worth targeting next year".
 *
 * The brief asks for accumulation, not just verdicts: "storing ideas for
 * future travel next year ...ideal date ranges vs. not so ideal date ranges
 * for travel so that overtime the agent is starting to capture some really
 * good ideas and can easily pull from this collection over time".
 *
 * **Measured 2026-10-17: none of the three stores that look like they could
 * hold this can.**
 *
 * - `proposals` carry DATED offers, and `snoozed` with a `snooze_until` is a
 *   defer on one dated offer, not a season. Snoozing a declined Taiwan trip to
 *   next October would re-raise that same itinerary at that same price.
 * - `lessons` are preference STATEMENTS an agent is told, with a polarity and
 *   a confidence. "Taiwan Pride is worth targeting" is not a preference about
 *   what Justin likes; it is a candidate plan, and storing it as a lesson
 *   would have an agent quote it back as a stated preference.
 * - `entities` of kind `destination` hold the PLACE, with no reason and no
 *   target season attached.
 *
 * So "Taiwan Pride is late October and worth targeting next year, ideally when
 * Sammy Cheng tours" was lost the moment its proposal was declined. This is
 * where it lives.
 *
 * **The season is MONTHS, not dates**, and that is the point of the table. An
 * idea with a date is a proposal; an idea with a season survives the year
 * turning over. A season may wrap the new year (November to February), so
 * `target_month_start` may exceed `target_month_end`.
 */

import { date, index, integer, pgTable, real, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

import { entities } from "@/backend/pg/schemas/catalog/entities";
import { goalCategory } from "@/backend/pg/schemas/enums";
import { ideaStatus } from "@/backend/pg/schemas/enums-config";
import { goals } from "@/backend/pg/schemas/goals/goals";
import { proposals } from "@/backend/pg/schemas/proposals/proposals";
import { reviews } from "@/backend/pg/schemas/hitl/reviews";

export const ideas = pgTable(
  "ideas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    category: goalCategory("category").notNull().default("travel"),
    /** Why it is worth doing, in words a briefing can hand to an agent. */
    rationale: text("rationale").notNull().default(""),
    /**
     * The season, as month numbers 1 to 12. A season that wraps the new year
     * has a start greater than its end (11 to 2), the same shape as a
     * recurring occasion window.
     */
    targetMonthStart: integer("target_month_start"),
    targetMonthEnd: integer("target_month_end"),
    confidence: real("confidence").notNull().default(0),
    status: ideaStatus("status").notNull().default("candidate"),
    /** Where it came from: the proposal whose decline recorded it. */
    sourceProposalId: uuid("source_proposal_id").references(() => proposals.id, { onDelete: "set null" }),
    /** And the verdict itself, so the reason is reachable from the idea. */
    sourceReviewId: uuid("source_review_id").references(() => reviews.id, { onDelete: "set null" }),
    /** Hidden from a briefing until this date. Null means always eligible. */
    revisitAfter: date("revisit_after"),
    /** Set when promoting the idea created a goal, so it is not retyped. */
    promotedGoalId: uuid("promoted_goal_id").references(() => goals.id, { onDelete: "set null" }),
    supersedesId: uuid("supersedes_id").references((): AnyPgColumn => ideas.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** The briefing reads exactly this: candidate ideas for a category, best first. */
    index("ideas_status_category_idx").on(t.status, t.category, t.confidence),
    index("ideas_revisit_idx").on(t.revisitAfter),
    index("ideas_source_proposal_idx").on(t.sourceProposalId),
    index("ideas_season_idx").on(t.targetMonthStart, t.targetMonthEnd),
  ],
);
export type IdeaRow = typeof ideas.$inferSelect;

/**
 * Which entities an idea is about: the destination, the performer, the venue.
 *
 * A join table rather than an `entity_ids uuid[]` column, although
 * cs-gap-idea-bank's description names an array. An array of uuids cannot be
 * foreign-key enforced, so a deleted entity would leave an id that resolves to
 * nothing and every reader would have to cope with it — the project's own rule
 * is that a reference which does not resolve is an error at WRITE time and an
 * orphan is never stored. `lesson_evidence` is the same shape for the same
 * reason.
 */
export const ideaEntities = pgTable(
  "idea_entities",
  {
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    /** What this entity is to the idea: "the festival", "the artist". */
    role: text("role").notNull().default(""),
  },
  (t) => [
    uniqueIndex("idea_entities_pk").on(t.ideaId, t.entityId),
    index("idea_entities_entity_idx").on(t.entityId),
  ],
);
export type IdeaEntityRow = typeof ideaEntities.$inferSelect;
