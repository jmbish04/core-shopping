import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const SHOPPING_GOALS_TABLE_DESCRIPTION =
  "Core shopping and experience goals monitored by scheduled AI agents and browser sessions.";

export const SHOPPING_GOALS_COLUMN_DESCRIPTIONS: Record<string, string> = {
  id: "Unique goal identifier.",
  title: "Short descriptive goal title.",
  category: "Goal category: concert, travel_asia, hardware, gift, etc.",
  systemPrompt: "Detailed instructions and constraints for the AI agent.",
  budgetMin: "Minimum budget threshold in USD.",
  budgetMax: "Maximum budget threshold in USD.",
  pointsPrograms: "JSON array of applicable loyalty/points programs (e.g. Chase, Amex).",
  emergencyTriggers: "JSON array of 'Break the Rules' emergency buy triggers.",
  isActive: "1 if goal is actively monitored by scheduled agents, 0 if paused.",
  runScheduleCron: "Cron schedule for agent execution (e.g. '0 8 * * *').",
  lastRunAt: "Unix timestamp of the last agent execution.",
  createdAt: "Creation timestamp.",
  updatedAt: "Last modification timestamp.",
};

export const shoppingGoals = sqliteTable("shopping_goals", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  pointsPrograms: text("points_programs", { mode: "json" }).$type<string[]>(),
  emergencyTriggers: text("emergency_triggers", { mode: "json" }).$type<string[]>(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  runScheduleCron: text("run_schedule_cron").notNull(),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertShoppingGoalSchema = createInsertSchema(shoppingGoals);
export const selectShoppingGoalSchema = createSelectSchema(shoppingGoals);
export type ShoppingGoalRow = typeof shoppingGoals.$inferSelect;
export type NewShoppingGoalRow = typeof shoppingGoals.$inferInsert;
