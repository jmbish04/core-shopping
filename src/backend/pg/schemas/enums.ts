/**
 * @fileoverview Postgres enums shared across core-shopping tables. Values come
 * from `@/shared/contracts` so the database and the API cannot disagree.
 */

import { pgEnum } from "drizzle-orm/pg-core";

import {
  AGENT_CLIENTS,
  ENTITY_KINDS,
  GOAL_CATEGORIES,
  GOAL_STATUSES,
  RUN_EVENT_LEVELS,
  RUN_STATUSES,
  SOURCE_KINDS,
} from "@/shared/contracts";

export const goalCategory = pgEnum("goal_category", GOAL_CATEGORIES);
export const goalStatus = pgEnum("goal_status", GOAL_STATUSES);
export const agentClient = pgEnum("agent_client", AGENT_CLIENTS);
export const criterionKind = pgEnum("criterion_kind", ["hard", "soft"]);
export const authorKind = pgEnum("author_kind", ["user", "agent", "system"]);
export const runStatus = pgEnum("run_status", RUN_STATUSES);
export const runEventLevel = pgEnum("run_event_level", RUN_EVENT_LEVELS);
export const toolCallStatus = pgEnum("tool_call_status", ["ok", "error"]);
export const entityKind = pgEnum("entity_kind", ENTITY_KINDS);
export const sourceKind = pgEnum("source_kind", SOURCE_KINDS);
export const performerType = pgEnum("performer_type", ["artist", "comedian", "band", "other"]);
export const cabinClass = pgEnum("cabin_class", ["economy", "premium_economy", "business", "first"]);
