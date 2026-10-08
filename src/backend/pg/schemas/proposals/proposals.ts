/**
 * @fileoverview Proposals: the agent raising its hand (maestro cs-be-1-4).
 *
 * `prior_proposal_id` is the chain that keeps the review queue quiet. A
 * re-sighting of something already decided is stored as a `silent_update`
 * pointing at its predecessor: the price history grows, the user is not asked
 * again. `silent_reason` records WHICH rule filed it silently, so a queue that
 * seems too quiet can be explained rather than guessed at.
 */

import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, real, text, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

import { proposalKind, proposalStatus } from "@/backend/pg/schemas/enums-m3";
import { entities } from "@/backend/pg/schemas/catalog/entities";
import { goals } from "@/backend/pg/schemas/goals/goals";
import { agentRuns } from "@/backend/pg/schemas/runs/runs";

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    runId: uuid("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    kind: proposalKind("kind").notNull().default("item"),
    status: proposalStatus("status").notNull().default("queued"),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    whyNow: text("why_now").notNull().default(""),
    criteriaMet: jsonb("criteria_met").notNull().default(sql`'[]'::jsonb`),
    matchScore: real("match_score"),
    roiScore: real("roi_score"),
    roiNote: text("roi_note").notNull().default(""),
    priorProposalId: uuid("prior_proposal_id").references((): AnyPgColumn => proposals.id, { onDelete: "set null" }),
    silentReason: text("silent_reason").notNull().default(""),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    snoozeUntil: timestamp("snooze_until", { withTimezone: true }),
  },
  (t) => [
    // The review queue reads exactly this: queued, not snoozed, soonest expiry.
    index("proposals_status_created_idx").on(t.status, t.createdAt),
    index("proposals_goal_idx").on(t.goalId, t.createdAt),
    index("proposals_prior_idx").on(t.priorProposalId),
    index("proposals_expires_idx").on(t.expiresAt),
  ],
);

export const proposalItems = pgTable(
  "proposal_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    priceCents: integer("price_cents"),
    msrpCents: integer("msrp_cents"),
    currency: text("currency"),
    /** Price when the PRIOR proposal was raised, so a drop is visible at a glance. */
    priorPriceCents: integer("prior_price_cents"),
    note: text("note").notNull().default(""),
  },
  (t) => [index("proposal_items_proposal_idx").on(t.proposalId, t.position), index("proposal_items_entity_idx").on(t.entityId)],
);
