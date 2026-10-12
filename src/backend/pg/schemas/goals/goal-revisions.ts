/**
 * @fileoverview `goal_revisions`: append-only history of every goal edit,
 * by a person or an agent, with a full snapshot (maestro cs-be-1-1).
 */

import { jsonb, pgTable, text, timestamp, integer, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { authorKind } from "@/backend/pg/schemas/enums";
import { goals } from "@/backend/pg/schemas/goals/goals";

export const goalRevisions = pgTable(
  "goal_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    authorKind: authorKind("author_kind").notNull(),
    author: text("author").notNull().default(""),
    reason: text("reason").notNull().default(""),
    changedFields: text("changed_fields").array().notNull().default(sql`'{}'::text[]`),
    /** The whole goal (with criteria) after this revision. */
    snapshot: jsonb("snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("goal_revisions_goal_revision_uq").on(t.goalId, t.revision)],
);
