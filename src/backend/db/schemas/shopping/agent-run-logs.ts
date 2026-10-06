import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const AGENT_RUN_LOGS_TABLE_DESCRIPTION =
  "Execution telemetry and step-by-step tool trace logs for scheduled AI shopper runs.";

export const AGENT_RUN_LOGS_COLUMN_DESCRIPTIONS: Record<string, string> = {
  id: "Unique run log ID.",
  goalId: "Referenced shopping goal ID.",
  agentName: "Executing agent name or worker type.",
  status: "Run status: executing, completed, attention_required, idle.",
  stepTrace: "JSON array of step traces (tool invoked, latency, status, details).",
  uniquenessIndex: "Yield uniqueness score for this run (0-100).",
  qualityScore: "Yield quality score for this run (0-100).",
  createdAt: "Run execution timestamp.",
};

export type StepTraceItem = {
  step: string;
  tool: string;
  durationMs: number;
  status: "success" | "warning" | "error";
  details?: string;
};

export const agentRunLogs = sqliteTable("agent_run_logs", {
  id: text("id").primaryKey(),
  goalId: text("goal_id").notNull(),
  agentName: text("agent_name").notNull(),
  status: text("status", {
    enum: ["executing", "completed", "attention_required", "idle"],
  })
    .default("completed")
    .notNull(),
  stepTrace: text("step_trace", { mode: "json" }).$type<StepTraceItem[]>(),
  uniquenessIndex: integer("uniqueness_index").default(85),
  qualityScore: integer("quality_score").default(90),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertAgentRunLogSchema = createInsertSchema(agentRunLogs);
export const selectAgentRunLogSchema = createSelectSchema(agentRunLogs);
export type AgentRunLogRow = typeof agentRunLogs.$inferSelect;
export type NewAgentRunLogRow = typeof agentRunLogs.$inferInsert;
