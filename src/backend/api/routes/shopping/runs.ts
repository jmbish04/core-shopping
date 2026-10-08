/**
 * @fileoverview Runs REST API backed by PostgreSQL through Hyperdrive.
 *
 * Exposes the agent-run queue through the shared list engine and a one-query
 * detail view containing the run trace, MCP calls, sightings, and proposals.
 * Every response is normalized to the shared run contracts; the route-local
 * response shape additionally carries the UI's computed `duration_ms` field.
 *
 * Mount at `/api/runs` from the root API application.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { desc, eq, sql } from "drizzle-orm";

import {
  ListQueryError,
  runList,
  type ColumnMap,
  type ListSelectFactory,
} from "@/backend/api/list/index";
import { withPg, type PgDb } from "@/backend/pg/client";
import { sightings } from "@/backend/pg/schemas/catalog/sightings";
import { proposals } from "@/backend/pg/schemas/proposals/proposals";
import { agentRuns, mcpToolCalls, runEvents, runGoals } from "@/backend/pg/schemas/runs/runs";
import { ErrorEnvelopeSchema, ListQuerySchema, listEnvelope } from "@/shared/contracts/common";
import {
  McpToolCallSchema,
  RUN_LIST_FIELDS,
  RunDetailSchema,
  RunEventSchema,
  RunSchema,
} from "@/shared/contracts/runs";

const runIdentifierParam = z.object({ id: z.uuid() });
const durationSchema = z.number().int().nonnegative().nullable();
const runListRowSchema = RunSchema.extend({ duration_ms: durationSchema });
const runListEnvelopeSchema = listEnvelope(runListRowSchema);
const runDetailResponseSchema = RunDetailSchema.extend({ duration_ms: durationSchema });
const RUN_STATUS_ORDER = ["running", "failed", "succeeded", "abandoned"] as const;

type RunListItem = Record<string, unknown>;
type RunStatusGroup = { key: string | null; count: number; subtotals?: Record<string, number> };

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function nullableIso(value: Date | string | null): string | null {
  return value == null ? null : iso(value);
}

function errorBody(code: string, message: string, details?: unknown) {
  return ErrorEnvelopeSchema.parse({
    error: { code, message, ...(details === undefined ? {} : { details }) },
  });
}

/**
 * Compute a completed run's elapsed milliseconds.
 *
 * @param startedAt - Run start as a Date or ISO-compatible string.
 * @param finishedAt - Run finish, or null while the run is active.
 * @returns Elapsed milliseconds, clamped to zero for inverted timestamps, or null while active.
 * @example
 * ```typescript
 * computeRunDurationMs("2026-01-01T00:00:00Z", "2026-01-01T00:00:01Z"); // 1000
 * ```
 */
export function computeRunDurationMs(
  startedAt: Date | string,
  finishedAt: Date | string | null,
): number | null {
  if (finishedAt == null) return null;
  return Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime());
}

/**
 * Normalize an aggregated goal-id value into a stable, duplicate-free array.
 *
 * @param value - PostgreSQL array output or a nullable collection assembled by a caller.
 * @returns Unique non-empty goal ids in first-seen order.
 * @example
 * ```typescript
 * aggregateGoalIds(["a", null, "a", "b"]); // ["a", "b"]
 * ```
 */
export function aggregateGoalIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

/**
 * Put status summary groups in the Runs queue's operational order.
 *
 * @param groups - Group summaries returned by the shared list engine.
 * @returns A new array ordered running, failed, succeeded, abandoned, then unknown keys.
 * @example
 * ```typescript
 * orderRunStatusGroups([{ key: "succeeded", count: 1 }, { key: "running", count: 2 }]);
 * ```
 */
export function orderRunStatusGroups(groups: RunStatusGroup[]): RunStatusGroup[] {
  const rank = new Map<string, number>(RUN_STATUS_ORDER.map((status, index) => [status, index]));
  return [...groups].sort(
    (left, right) =>
      (rank.get(left.key ?? "") ?? RUN_STATUS_ORDER.length) -
      (rank.get(right.key ?? "") ?? RUN_STATUS_ORDER.length),
  );
}

const goalIds = sql<string[]>`coalesce(
  (select array_agg(${runGoals.goalId} order by ${runGoals.goalId})
   from ${runGoals}
   where ${runGoals.runId} = ${agentRuns.id}),
  array[]::uuid[]
)`;

const runListColumns: ColumnMap<typeof RUN_LIST_FIELDS> = {
  status: agentRuns.status,
  client: agentRuns.client,
  model: agentRuns.model,
  started_at: agentRuns.startedAt,
  goal_id: runGoals.goalId,
  quality_score: agentRuns.qualityScore,
};

const runListSelection = {
  id: agentRuns.id,
  client: agentRuns.client,
  model: agentRuns.model,
  status: agentRuns.status,
  goal_ids: goalIds,
  started_at: agentRuns.startedAt,
  finished_at: agentRuns.finishedAt,
  summary: agentRuns.summary,
  quality_score: agentRuns.qualityScore,
  uniqueness_score: agentRuns.uniquenessScore,
  sightings_count: agentRuns.sightingsCount,
  new_entities_count: agentRuns.newEntitiesCount,
  proposals_count: agentRuns.proposalsCount,
  session_url: agentRuns.sessionUrl,
  error: agentRuns.error,
};

function runListFrom(db: PgDb): ListSelectFactory {
  return (selection) => {
    const requested = selection ?? runListSelection;
    const countOnly = Object.keys(requested).length === 1 && "count" in requested;
    const grouped = "key" in requested && "count" in requested;
    const selected = countOnly
      ? { count: sql<number>`count(distinct ${agentRuns.id})` }
      : grouped
        ? { ...requested, count: sql<number>`count(distinct ${agentRuns.id})` }
        : requested;
    return db
      .selectDistinct(selected)
      .from(agentRuns)
      .leftJoin(runGoals, eq(runGoals.runId, agentRuns.id))
      .$dynamic();
  };
}

function normalizeRun(row: RunListItem) {
  const startedAt = row.started_at as Date | string;
  const finishedAt = row.finished_at as Date | string | null;
  return runListRowSchema.parse({
    ...row,
    goal_ids: aggregateGoalIds(row.goal_ids),
    started_at: iso(startedAt),
    finished_at: nullableIso(finishedAt),
    duration_ms: computeRunDurationMs(startedAt, finishedAt),
    sightings_count: Number(row.sightings_count),
    new_entities_count: Number(row.new_entities_count),
    proposals_count: Number(row.proposals_count),
  });
}

async function loadRunDetail(db: PgDb, id: string) {
  const [row] = await db
    .select({
      ...runListSelection,
      events: sql<Array<Record<string, unknown>>>`coalesce(
        (select jsonb_agg(jsonb_build_object(
          'id', ${runEvents.id}, 'run_id', ${runEvents.runId}, 'at', ${runEvents.at},
          'level', ${runEvents.level}, 'kind', ${runEvents.kind},
          'message', ${runEvents.message}, 'data', ${runEvents.data}
        ) order by ${runEvents.at}, ${runEvents.id})
        from ${runEvents} where ${runEvents.runId} = ${agentRuns.id}),
        '[]'::jsonb
      )`,
      tool_calls: sql<Array<Record<string, unknown>>>`coalesce(
        (select jsonb_agg(jsonb_build_object(
          'id', ${mcpToolCalls.id}, 'run_id', ${mcpToolCalls.runId},
          'tool', ${mcpToolCalls.tool}, 'operation', ${mcpToolCalls.operation},
          'args_digest', ${mcpToolCalls.argsDigest}, 'status', ${mcpToolCalls.status},
          'latency_ms', ${mcpToolCalls.latencyMs}, 'error', ${mcpToolCalls.error},
          'at', ${mcpToolCalls.at}
        ) order by ${mcpToolCalls.at}, ${mcpToolCalls.id})
        from ${mcpToolCalls} where ${mcpToolCalls.runId} = ${agentRuns.id}),
        '[]'::jsonb
      )`,
      sighting_ids: sql<string[]>`coalesce(
        (select array_agg(${sightings.id} order by ${sightings.seenAt}, ${sightings.id})
         from ${sightings} where ${sightings.runId} = ${agentRuns.id}),
        array[]::uuid[]
      )`,
      proposal_ids: sql<string[]>`coalesce(
        (select array_agg(${proposals.id} order by ${proposals.createdAt}, ${proposals.id})
         from ${proposals} where ${proposals.runId} = ${agentRuns.id}),
        array[]::uuid[]
      )`,
    })
    .from(agentRuns)
    .where(eq(agentRuns.id, id))
    .limit(1);
  if (!row) return null;

  const normalizedRun = normalizeRun(row);
  return runDetailResponseSchema.parse({
    ...normalizedRun,
    events: row.events.map((event) =>
      RunEventSchema.parse({ ...event, at: iso(event.at as Date | string) }),
    ),
    tool_calls: row.tool_calls.map((call) =>
      McpToolCallSchema.parse({
        ...call,
        latency_ms: Number(call.latency_ms),
        at: iso(call.at as Date | string),
      }),
    ),
    sighting_ids: aggregateGoalIds(row.sighting_ids),
    proposal_ids: aggregateGoalIds(row.proposal_ids),
  });
}

/** Runs API router. */
export const runsRouter = new OpenAPIHono<{ Bindings: Env }>();

runsRouter.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Runs"],
    summary: "List agent runs",
    operationId: "runsList",
    request: { query: ListQuerySchema },
    responses: {
      200: {
        description: "Paginated agent runs.",
        content: { "application/json": { schema: runListEnvelopeSchema } },
      },
      400: {
        description: "Invalid list query.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const query = c.req.valid("query");
    try {
      const result = await withPg(c.env, (db) =>
        runList<RunListItem, typeof RUN_LIST_FIELDS>(db, {
          fields: RUN_LIST_FIELDS,
          columns: runListColumns,
          query,
          from: runListFrom(db),
          fallback: desc(agentRuns.startedAt),
          searchColumns: [agentRuns.model],
        }),
      );
      const normalized = {
        ...result,
        items: result.items.map(normalizeRun),
        ...(result.groups
          ? {
              groups:
                query.group_by === "status" ? orderRunStatusGroups(result.groups) : result.groups,
            }
          : {}),
      };
      return c.json(runListEnvelopeSchema.parse(normalized), 200);
    } catch (error) {
      if (error instanceof ListQueryError) {
        return c.json(errorBody("invalid_list_query", error.message, error.problems), 400);
      }
      throw error;
    }
  },
);

runsRouter.openapi(
  createRoute({
    method: "get",
    path: "/{id}",
    tags: ["Runs"],
    summary: "Get an agent run with its complete trace and outputs",
    operationId: "runsGet",
    request: { params: runIdentifierParam },
    responses: {
      200: {
        description: "Agent run detail.",
        content: { "application/json": { schema: runDetailResponseSchema } },
      },
      404: {
        description: "Run not found.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const run = await withPg(c.env, (db) => loadRunDetail(db, id));
    if (!run) return c.json(errorBody("not_found", "Run not found"), 404);
    return c.json(runDetailResponseSchema.parse(run), 200);
  },
);
