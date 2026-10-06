import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const USER_PREFERENCE_RULES_TABLE_DESCRIPTION =
  "Self-serve user rules and taste guidelines, including hotel whitelists/blacklists, loyalty point balances, and travel sweet spots.";

export const USER_PREFERENCE_RULES_COLUMN_DESCRIPTIONS: Record<string, string> = {
  id: "Unique rule identifier.",
  ruleType: "Rule category: hotel_whitelist, hotel_blacklist, airline_preference, travel_season, loyalty_balance.",
  targetEntity: "Entity name or pattern (e.g. 'Hilton Palm Springs', 'STARLUX', 'Chase Sapphire Reserve').",
  sentimentScore: "Preference weight or score (-1.0 strongly negative to +1.0 strongly positive).",
  reasoning: "Rationale behind the rule (e.g. cleanliness issues at Hilton Palm Springs).",
  metadata: "JSON object for extra metadata (e.g. point balance, transfer ratios, walk distances).",
  updatedAt: "Last modification timestamp.",
};

export const userPreferenceRules = sqliteTable("user_preference_rules", {
  id: text("id").primaryKey(),
  ruleType: text("rule_type").notNull(),
  targetEntity: text("target_entity").notNull(),
  sentimentScore: real("sentiment_score"),
  reasoning: text("reasoning").notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertUserPreferenceRuleSchema = createInsertSchema(userPreferenceRules);
export const selectUserPreferenceRuleSchema = createSelectSchema(userPreferenceRules);
export type UserPreferenceRuleRow = typeof userPreferenceRules.$inferSelect;
export type NewUserPreferenceRuleRow = typeof userPreferenceRules.$inferInsert;
