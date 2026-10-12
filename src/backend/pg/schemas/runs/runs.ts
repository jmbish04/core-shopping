/**
 * @fileoverview Run trace tables (maestro cs-be-1-2): `agent_runs` (one agent
 * session), `run_goals` (which goals it worked), `run_events` (its trace) and
 * `mcp_tool_calls` (every MCP call, args hashed never stored).
 *
 * Retention: run_events and mcp_tool_calls are purged after 90 days by cron
 * (cs-be-1-7); the `at` indexes exist for that purge.
 */

import { index, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { agentClient, runEventLevel, runStatus, toolCallStatus } from "@/backend/pg/schemas/enums";
import { goals } from "@/backend/pg/schemas/goals/goals";

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    client: agentClient("client").notNull(),
    model: text("model").notNull().default(""),
    status: runStatus("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    summary: text("summary").notNull().default(""),
    qualityScore: real("quality_score"),
    uniquenessScore: real("uniqueness_score"),
    sightingsCount: integer("sightings_count").notNull().default(0),
    newEntitiesCount: integer("new_entities_count").notNull().default(0),
    proposalsCount: integer("proposals_count").notNull().default(0),
    sessionUrl: text("session_url"),
    error: text("error"),
  },
  (t) => [index("agent_runs_status_started_idx").on(t.status, t.startedAt), index("agent_runs_started_idx").on(t.startedAt)],
);

export const runGoals = pgTable(
  "run_goals",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.runId, t.goalId] }), index("run_goals_goal_idx").on(t.goalId)],
);

export const runEvents = pgTable(
  "run_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    level: runEventLevel("level").notNull().default("info"),
    kind: text("kind").notNull().default("note"),
    message: text("message").notNull(),
    data: jsonb("data"),
  },
  (t) => [index("run_events_run_at_idx").on(t.runId, t.at), index("run_events_at_idx").on(t.at)],
);

export const mcpToolCalls = pgTable(
  "mcp_tool_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    tool: text("tool").notNull(),
    operation: text("operation").notNull().default(""),
    argsDigest: text("args_digest").notNull().default(""),
    status: toolCallStatus("status").notNull(),
    latencyMs: integer("latency_ms").notNull().default(0),
    error: text("error"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("mcp_tool_calls_run_idx").on(t.runId), index("mcp_tool_calls_at_idx").on(t.at)],
);
