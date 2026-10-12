/**
 * @fileoverview `goals`: the standing shopping briefs scheduled agents work
 * (maestro cs-be-1-1). Every write also inserts a `goal_revisions` row.
 */

import { sql } from "drizzle-orm";
import { date, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { agentClient, goalCategory, goalStatus } from "@/backend/pg/schemas/enums";

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    category: goalCategory("category").notNull(),
    status: goalStatus("status").notNull().default("active"),
    systemPrompt: text("system_prompt").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    budgetMinCents: integer("budget_min_cents"),
    budgetMaxCents: integer("budget_max_cents"),
    currency: text("currency").notNull().default("USD"),
    windowStart: date("window_start"),
    windowEnd: date("window_end"),
    timeNotes: text("time_notes").notNull().default(""),
    breakRules: text("break_rules").array().notNull().default(sql`'{}'::text[]`),
    scheduleHint: text("schedule_hint").notNull().default(""),
    expectedCadenceHours: integer("expected_cadence_hours"),
    agentClients: agentClient("agent_clients").array().notNull().default(sql`'{}'::agent_client[]`),
    currentRevision: integer("current_revision").notNull().default(1),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("goals_status_category_idx").on(t.status, t.category), index("goals_last_run_idx").on(t.lastRunAt)],
);
export type GoalRow = typeof goals.$inferSelect;
