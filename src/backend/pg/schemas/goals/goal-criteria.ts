/**
 * @fileoverview `goal_criteria`: hard (disqualifying) and soft (weighted)
 * criteria for a goal, in display order (maestro cs-be-1-1).
 */

import { index, integer, jsonb, pgTable, real, text, uuid } from "drizzle-orm/pg-core";

import { criterionKind } from "@/backend/pg/schemas/enums";
import { goals } from "@/backend/pg/schemas/goals/goals";

export const goalCriteria = pgTable(
  "goal_criteria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    kind: criterionKind("kind").notNull(),
    weight: real("weight").notNull().default(1),
    attribute: text("attribute"),
    operator: text("operator"),
    value: jsonb("value"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("goal_criteria_goal_idx").on(t.goalId, t.position)],
);
