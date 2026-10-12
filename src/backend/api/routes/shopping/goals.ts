/**
 * @fileoverview Goals REST API backed by PostgreSQL through Hyperdrive.
 *
 * This router is the reference consumer of the shared list engine. It exposes
 * goal listing, creation, revisioned updates, pause/resume actions, revision
 * history, and gap-free daily statistics. All wire shapes come from the shared
 * goal contracts and every mutation records a full snapshot transactionally.
 *
 * Mount at `/api/goals` from the root API application.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { desc, eq, or, sql, type SQL } from "drizzle-orm";

import { ListQueryError, runList, type ColumnMap } from "@/backend/api/list/index";
import { withPg, type PgDb } from "@/backend/pg/client";
import { sightings } from "@/backend/pg/schemas/catalog/sightings";
import { goalCriteria } from "@/backend/pg/schemas/goals/goal-criteria";
import { goalRevisions } from "@/backend/pg/schemas/goals/goal-revisions";
import { goals, type GoalRow } from "@/backend/pg/schemas/goals/goals";
import { agentRuns, runGoals } from "@/backend/pg/schemas/runs/runs";
import { ErrorEnvelopeSchema, ListQuerySchema, listEnvelope } from "@/shared/contracts/common";
import {
  CriterionSchema,
  GOAL_LIST_FIELDS,
  GoalInputSchema,
  GoalListRowSchema,
  GoalPatchSchema,
  GoalRevisionSchema,
  GoalSchema,
  GoalStatsPointSchema,
  type Criterion,
  type Goal,
} from "@/shared/contracts/goals";

const goalIdentifierParam = z.object({ id: z.string().min(1).max(200) });
const statsQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });
const goalListEnvelopeSchema = listEnvelope(GoalListRowSchema);
const goalRevisionListSchema = z.array(GoalRevisionSchema);
const goalStatsListSchema = z.array(GoalStatsPointSchema);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Snapshot = Record<string, unknown>;

/** One field-level change between two revision snapshots. */
export interface RevisionDiffEntry {
  field: string;
  before: unknown;
  after: unknown;
}

/**
 * Generate a URL-safe, unique goal slug.
 *
 * @param title - Human-readable goal title.
 * @param existingSlugs - Slugs already allocated in the relevant namespace.
 * @returns A normalized slug, with `-2`, `-3`, and so on added on collision.
 * @example
 * ```typescript
 * generateGoalSlug("Summer in Montréal!", ["summer-in-montreal"]);
 * // "summer-in-montreal-2"
 * ```
 */
export function generateGoalSlug(title: string, existingSlugs: Iterable<string> = []): string {
  const base =
    title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "goal";
  const taken = new Set(existingSlugs);
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/**
 * Compare two complete revision snapshots at the top-level field boundary.
 *
 * @param before - Previous snapshot, or null/undefined for revision one.
 * @param after - New complete snapshot.
 * @returns Changed fields with their prior and next values; revision one is empty.
 * @example
 * ```typescript
 * revisionDiff({ status: "active" }, { status: "paused" });
 * // [{ field: "status", before: "active", after: "paused" }]
 * ```
 */
/**
 * Fields that change on every write and so say nothing about what a person or
 * an agent decided. They stay in the snapshot; they are only hidden from the
 * diff, because a diff that always lists `updated_at` buries the one field that
 * actually changed.
 */
const DIFF_IGNORED_FIELDS = new Set(["current_revision", "updated_at", "created_at", "last_run_at"]);

export function revisionDiff(
  before: Snapshot | null | undefined,
  after: Snapshot,
): RevisionDiffEntry[] {
  if (!before) return [];
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...fields]
    .filter((field) => !DIFF_IGNORED_FIELDS.has(field))
    .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .sort()
    .map((field) => ({ field, before: before[field], after: after[field] }));
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function nullableIso(value: Date | string | null): string | null {
  return value == null ? null : iso(value);
}

function criterionFromRow(row: typeof goalCriteria.$inferSelect): Criterion {
  return CriterionSchema.parse({
    id: row.id,
    label: row.label,
    kind: row.kind,
    weight: row.weight,
    attribute: row.attribute,
    operator: row.operator,
    value: row.value,
  });
}

function goalFromRows(row: GoalRow, criteria: Array<typeof goalCriteria.$inferSelect>): Goal {
  return GoalSchema.parse({
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    status: row.status,
    system_prompt: row.systemPrompt,
    instructions: row.instructions,
    budget_min_cents: row.budgetMinCents,
    budget_max_cents: row.budgetMaxCents,
    currency: row.currency,
    window_start: row.windowStart,
    window_end: row.windowEnd,
    time_notes: row.timeNotes,
    break_rules: row.breakRules,
    schedule_hint: row.scheduleHint,
    expected_cadence_hours: row.expectedCadenceHours,
    agent_clients: row.agentClients,
    criteria: criteria.map(criterionFromRow),
    current_revision: row.currentRevision,
    last_run_at: nullableIso(row.lastRunAt),
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
  });
}

function identifierWhere(identifier: string): SQL {
  return uuidPattern.test(identifier)
    ? or(eq(goals.id, identifier), eq(goals.slug, identifier))!
    : eq(goals.slug, identifier);
}

async function loadGoal(db: PgDb, identifier: string): Promise<Goal | null> {
  const [row] = await db
    .select({
      id: goals.id,
      slug: goals.slug,
      title: goals.title,
      category: goals.category,
      status: goals.status,
      systemPrompt: goals.systemPrompt,
      instructions: goals.instructions,
      budgetMinCents: goals.budgetMinCents,
      budgetMaxCents: goals.budgetMaxCents,
      currency: goals.currency,
      windowStart: goals.windowStart,
      windowEnd: goals.windowEnd,
      timeNotes: goals.timeNotes,
      breakRules: goals.breakRules,
      scheduleHint: goals.scheduleHint,
      expectedCadenceHours: goals.expectedCadenceHours,
      agentClients: goals.agentClients,
      currentRevision: goals.currentRevision,
      lastRunAt: goals.lastRunAt,
      createdAt: goals.createdAt,
      updatedAt: goals.updatedAt,
    })
    .from(goals)
    .where(identifierWhere(identifier))
    .limit(1);
  if (!row) return null;
  const criteria = await db
    .select({
      id: goalCriteria.id,
      goalId: goalCriteria.goalId,
      label: goalCriteria.label,
      kind: goalCriteria.kind,
      weight: goalCriteria.weight,
      attribute: goalCriteria.attribute,
      operator: goalCriteria.operator,
      value: goalCriteria.value,
      position: goalCriteria.position,
    })
    .from(goalCriteria)
    .where(eq(goalCriteria.goalId, row.id))
    .orderBy(goalCriteria.position);
  return goalFromRows(row, criteria);
}

async function lockGoalId(db: PgDb, identifier: string): Promise<string | null> {
  const result = await db.execute(sql`
    select ${goals.id} as id
    from ${goals}
    where ${goals.id}::text = ${identifier} or ${goals.slug} = ${identifier}
    for update
  `);
  return result.rows[0] ? String(result.rows[0].id) : null;
}

function goalValues(input: z.infer<typeof GoalInputSchema>) {
  return {
    title: input.title,
    category: input.category,
    status: input.status,
    systemPrompt: input.system_prompt,
    instructions: input.instructions,
    budgetMinCents: input.budget_min_cents ?? null,
    budgetMaxCents: input.budget_max_cents ?? null,
    currency: input.currency,
    windowStart: input.window_start ?? null,
    windowEnd: input.window_end ?? null,
    timeNotes: input.time_notes,
    breakRules: input.break_rules,
    scheduleHint: input.schedule_hint,
    expectedCadenceHours: input.expected_cadence_hours ?? null,
    agentClients: input.agent_clients,
  };
}

async function insertCriteria(db: PgDb, goalId: string, criteria: Criterion[]): Promise<void> {
  if (criteria.length === 0) return;
  await db.insert(goalCriteria).values(
    criteria.map((criterion, position) => ({
      goalId,
      label: criterion.label,
      kind: criterion.kind,
      weight: criterion.weight,
      attribute: criterion.attribute ?? null,
      operator: criterion.operator ?? null,
      value: criterion.value ?? null,
      position,
    })),
  );
}

function errorBody(code: string, message: string, details?: unknown) {
  return ErrorEnvelopeSchema.parse({
    error: { code, message, ...(details === undefined ? {} : { details }) },
  });
}

async function setGoalStatus(
  db: PgDb,
  identifier: string,
  status: "active" | "paused",
  reason: string,
): Promise<Goal | null> {
  return db.transaction(async (tx) => {
    const goalId = await lockGoalId(tx, identifier);
    const current = goalId ? await loadGoal(tx, goalId) : null;
    if (!current) return null;
    const nextRevision = current.current_revision + 1;
    await tx
      .update(goals)
      .set({ status, currentRevision: nextRevision, updatedAt: new Date() })
      .where(eq(goals.id, current.id));
    const updated = await loadGoal(tx, current.id);
    if (!updated) throw new Error("Goal disappeared during status update");
    await tx.insert(goalRevisions).values({
      goalId: current.id,
      revision: nextRevision,
      authorKind: "user",
      reason,
      changedFields: ["status"],
      snapshot: updated,
    });
    return updated;
  });
}

const nextExpectedAt = sql<Date | null>`case
  when ${goals.lastRunAt} is null or ${goals.expectedCadenceHours} is null then null
  else ${goals.lastRunAt} + (${goals.expectedCadenceHours} * interval '1 hour')
end`;
const stale = sql<boolean>`coalesce((${nextExpectedAt}) < now(), false)`;
const runsCount = sql<number>`(select count(*)::int from ${runGoals} where ${runGoals.goalId} = ${goals.id})`;
const findingsCount = sql<number>`(select count(distinct ${sightings.entityId})::int from ${sightings} where ${sightings.goalId} = ${goals.id})`;
// ponytail: cs-be-1-5 will replace this literal with reviewed positive verdicts / all reviewed proposals.
const acceptRate = sql<number | null>`null::real`;

const goalListColumns: ColumnMap<typeof GOAL_LIST_FIELDS> = {
  title: goals.title,
  category: goals.category,
  status: goals.status,
  last_run_at: goals.lastRunAt,
  budget_max_cents: goals.budgetMaxCents,
  stale,
};

const goalListSelection = {
  id: goals.id,
  slug: goals.slug,
  title: goals.title,
  category: goals.category,
  status: goals.status,
  schedule_hint: goals.scheduleHint,
  budget_min_cents: goals.budgetMinCents,
  budget_max_cents: goals.budgetMaxCents,
  currency: goals.currency,
  last_run_at: goals.lastRunAt,
  expected_cadence_hours: goals.expectedCadenceHours,
  next_expected_at: nextExpectedAt,
  stale,
  runs_count: runsCount,
  findings_count: findingsCount,
  accept_rate: acceptRate,
};

/** Goals API router. */
export const goalsRouter = new OpenAPIHono<{ Bindings: Env }>();

goalsRouter.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Goals"],
    summary: "List goals",
    operationId: "goalsList",
    request: { query: ListQuerySchema },
    responses: {
      200: {
        description: "Paginated goals.",
        content: { "application/json": { schema: goalListEnvelopeSchema } },
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
        runList<Record<string, unknown>, typeof GOAL_LIST_FIELDS>(db, {
          fields: GOAL_LIST_FIELDS,
          columns: goalListColumns,
          query,
          from: (selection) =>
            db
              .select(selection ?? goalListSelection)
              .from(goals)
              .$dynamic(),
          fallback: desc(goals.updatedAt),
          searchColumns: [goals.title],
        }),
      );
      const normalized = {
        ...result,
        items: result.items.map((item) => ({
          ...item,
          last_run_at: nullableIso(item.last_run_at as Date | string | null),
          next_expected_at: nullableIso(item.next_expected_at as Date | string | null),
          runs_count: Number(item.runs_count),
          findings_count: Number(item.findings_count),
          accept_rate: item.accept_rate == null ? null : Number(item.accept_rate),
        })),
      };
      return c.json(goalListEnvelopeSchema.parse(normalized), 200);
    } catch (error) {
      if (error instanceof ListQueryError) {
        return c.json(errorBody("invalid_list_query", error.message, error.problems), 400);
      }
      throw error;
    }
  },
);

goalsRouter.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Goals"],
    summary: "Create goal",
    operationId: "goalsCreate",
    request: { body: { content: { "application/json": { schema: GoalInputSchema } } } },
    responses: {
      201: {
        description: "Created goal.",
        content: { "application/json": { schema: GoalSchema } },
      },
    },
  }),
  async (c) => {
    const input = c.req.valid("json");
    const goal = await withPg(c.env, (db) =>
      db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('goals:slug'))`);
        const base = generateGoalSlug(input.title);
        const existing = await tx
          .select({ slug: goals.slug })
          .from(goals)
          .where(sql`${goals.slug} = ${base} or ${goals.slug} like ${`${base}-%`}`);
        const slug = generateGoalSlug(
          input.title,
          existing.map((row) => row.slug),
        );
        const [row] = await tx
          .insert(goals)
          .values({ slug, ...goalValues(input) })
          .returning({ id: goals.id });
        if (!row) throw new Error("Goal insert returned no row");
        await insertCriteria(tx, row.id, input.criteria);
        const created = await loadGoal(tx, row.id);
        if (!created) throw new Error("Created goal could not be reloaded");
        await tx.insert(goalRevisions).values({
          goalId: row.id,
          revision: 1,
          authorKind: "user",
          changedFields: [],
          snapshot: created,
        });
        return created;
      }),
    );
    return c.json(GoalSchema.parse(goal), 201);
  },
);

goalsRouter.openapi(
  createRoute({
    method: "get",
    path: "/{id}",
    tags: ["Goals"],
    summary: "Get goal",
    operationId: "goalsGet",
    request: { params: goalIdentifierParam },
    responses: {
      200: {
        description: "Goal with criteria.",
        content: { "application/json": { schema: GoalSchema } },
      },
      404: {
        description: "Goal not found.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const goal = await withPg(c.env, (db) => loadGoal(db, c.req.valid("param").id));
    if (!goal) return c.json(errorBody("goal_not_found", "Goal not found."), 404);
    return c.json(GoalSchema.parse(goal), 200);
  },
);

goalsRouter.openapi(
  createRoute({
    method: "patch",
    path: "/{id}",
    tags: ["Goals"],
    summary: "Update goal",
    operationId: "goalsPatch",
    request: {
      params: goalIdentifierParam,
      body: { content: { "application/json": { schema: GoalPatchSchema } } },
    },
    responses: {
      200: {
        description: "Updated goal.",
        content: { "application/json": { schema: GoalSchema } },
      },
      400: {
        description: "Invalid changes.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
      404: {
        description: "Goal not found.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const identifier = c.req.valid("param").id;
    const { changes, reason } = c.req.valid("json");
    const allowed = new Set(Object.keys(GoalInputSchema.shape));
    const unknown = Object.keys(changes).filter((key) => !allowed.has(key));
    if (unknown.length > 0)
      return c.json(
        errorBody("invalid_goal_patch", "Patch contains unknown fields.", unknown),
        400,
      );

    const result = await withPg(c.env, (db) =>
      db.transaction(async (tx) => {
        const goalId = await lockGoalId(tx, identifier);
        const current = goalId ? await loadGoal(tx, goalId) : null;
        if (!current) return { kind: "missing" as const };
        const parsed = GoalInputSchema.safeParse({
          title: current.title,
          category: current.category,
          status: current.status,
          system_prompt: current.system_prompt,
          instructions: current.instructions,
          budget_min_cents: current.budget_min_cents,
          budget_max_cents: current.budget_max_cents,
          currency: current.currency,
          window_start: current.window_start,
          window_end: current.window_end,
          time_notes: current.time_notes,
          break_rules: current.break_rules,
          schedule_hint: current.schedule_hint,
          expected_cadence_hours: current.expected_cadence_hours,
          agent_clients: current.agent_clients,
          criteria: current.criteria,
          ...changes,
        });
        if (!parsed.success) return { kind: "invalid" as const, details: parsed.error.issues };
        const changedFields = revisionDiff(current as unknown as Snapshot, {
          ...current,
          ...changes,
        }).map((entry) => entry.field);
        const nextRevision = current.current_revision + 1;
        await tx
          .update(goals)
          .set({ ...goalValues(parsed.data), currentRevision: nextRevision, updatedAt: new Date() })
          .where(eq(goals.id, current.id));
        if (Object.hasOwn(changes, "criteria")) {
          await tx.delete(goalCriteria).where(eq(goalCriteria.goalId, current.id));
          await insertCriteria(tx, current.id, parsed.data.criteria);
        }
        const updated = await loadGoal(tx, current.id);
        if (!updated) throw new Error("Goal disappeared during update");
        await tx.insert(goalRevisions).values({
          goalId: current.id,
          revision: nextRevision,
          authorKind: "user",
          reason,
          changedFields,
          snapshot: updated,
        });
        return { kind: "ok" as const, goal: updated };
      }),
    );
    if (result.kind === "missing")
      return c.json(errorBody("goal_not_found", "Goal not found."), 404);
    if (result.kind === "invalid")
      return c.json(
        errorBody("invalid_goal_patch", "Patch changes are invalid.", result.details),
        400,
      );
    return c.json(GoalSchema.parse(result.goal), 200);
  },
);

for (const action of [
  {
    path: "/{id}/pause" as const,
    operationId: "goalsPause",
    status: "paused" as const,
    reason: "paused",
  },
  {
    path: "/{id}/resume" as const,
    operationId: "goalsResume",
    status: "active" as const,
    reason: "resumed",
  },
]) {
  goalsRouter.openapi(
    createRoute({
      method: "post",
      path: action.path,
      tags: ["Goals"],
      summary: `${action.reason[0]!.toUpperCase()}${action.reason.slice(1)} goal`,
      operationId: action.operationId,
      request: { params: goalIdentifierParam },
      responses: {
        200: {
          description: "Updated goal.",
          content: { "application/json": { schema: GoalSchema } },
        },
        404: {
          description: "Goal not found.",
          content: { "application/json": { schema: ErrorEnvelopeSchema } },
        },
      },
    }),
    async (c) => {
      const goal = await withPg(c.env, (db) =>
        setGoalStatus(db, c.req.valid("param").id, action.status, action.reason),
      );
      if (!goal) return c.json(errorBody("goal_not_found", "Goal not found."), 404);
      return c.json(GoalSchema.parse(goal), 200);
    },
  );
}

goalsRouter.openapi(
  createRoute({
    method: "get",
    path: "/{id}/revisions",
    tags: ["Goals"],
    summary: "List goal revisions",
    operationId: "goalsRevisions",
    request: { params: goalIdentifierParam },
    responses: {
      200: {
        description: "Newest-first revision history.",
        content: { "application/json": { schema: goalRevisionListSchema } },
      },
      404: {
        description: "Goal not found.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const result = await withPg(c.env, async (db) => {
      const goal = await loadGoal(db, c.req.valid("param").id);
      if (!goal) return null;
      const rows = await db
        .select({
          id: goalRevisions.id,
          goalId: goalRevisions.goalId,
          revision: goalRevisions.revision,
          authorKind: goalRevisions.authorKind,
          author: goalRevisions.author,
          reason: goalRevisions.reason,
          changedFields: goalRevisions.changedFields,
          snapshot: goalRevisions.snapshot,
          createdAt: goalRevisions.createdAt,
        })
        .from(goalRevisions)
        .where(eq(goalRevisions.goalId, goal.id))
        .orderBy(goalRevisions.revision);
      return rows
        .map((row, index) => ({
          id: row.id,
          goal_id: row.goalId,
          revision: row.revision,
          author_kind: row.authorKind,
          author: row.author,
          reason: row.reason,
          changed_fields: row.changedFields,
          diff: revisionDiff(
            index === 0 ? null : (rows[index - 1]!.snapshot as Snapshot),
            row.snapshot as Snapshot,
          ),
          created_at: iso(row.createdAt),
        }))
        .reverse();
    });
    if (!result) return c.json(errorBody("goal_not_found", "Goal not found."), 404);
    return c.json(goalRevisionListSchema.parse(result), 200);
  },
);

goalsRouter.openapi(
  createRoute({
    method: "get",
    path: "/{id}/stats",
    tags: ["Goals"],
    summary: "Get daily goal stats",
    operationId: "goalsStats",
    request: { params: goalIdentifierParam, query: statsQuerySchema },
    responses: {
      200: {
        description: "Gap-free daily goal statistics.",
        content: { "application/json": { schema: goalStatsListSchema } },
      },
      404: {
        description: "Goal not found.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const { days } = c.req.valid("query");
    const result = await withPg(c.env, async (db) => {
      const goal = await loadGoal(db, id);
      if (!goal) return null;
      const query = await db.execute(sql`
        with dates as (
          select generate_series(current_date - (${days}::int - 1), current_date, interval '1 day')::date as date
        ), run_daily as (
          select ${agentRuns.startedAt}::date as date,
                 count(distinct ${agentRuns.id})::int as runs,
                 avg(${agentRuns.qualityScore})::real as quality,
                 avg(${agentRuns.uniquenessScore})::real as uniqueness
          from ${agentRuns}
          inner join ${runGoals} on ${runGoals.runId} = ${agentRuns.id}
          where ${runGoals.goalId} = ${goal.id}
            and ${agentRuns.startedAt} >= current_date - (${days}::int - 1)
          group by ${agentRuns.startedAt}::date
        ), finding_daily as (
          select ${agentRuns.startedAt}::date as date, count(distinct ${sightings.entityId})::int as findings
          from ${agentRuns}
          inner join ${runGoals} on ${runGoals.runId} = ${agentRuns.id}
          left join ${sightings} on ${sightings.runId} = ${agentRuns.id}
          where ${runGoals.goalId} = ${goal.id}
            and ${agentRuns.startedAt} >= current_date - (${days}::int - 1)
          group by ${agentRuns.startedAt}::date
        )
        select dates.date::text as date,
               coalesce(run_daily.runs, 0)::int as runs,
               run_daily.quality,
               run_daily.uniqueness,
               coalesce(finding_daily.findings, 0)::int as findings,
               0::int as reviewed,
               0::int as accepted
               -- ponytail: cs-be-1-5 will replace reviewed/accepted with proposal-review aggregates.
        from dates
        left join run_daily using (date)
        left join finding_daily using (date)
        order by dates.date
      `);
      return query.rows.map((row) => ({
        date: String(row.date),
        runs: Number(row.runs),
        quality: row.quality == null ? null : Number(row.quality),
        uniqueness: row.uniqueness == null ? null : Number(row.uniqueness),
        findings: Number(row.findings),
        reviewed: Number(row.reviewed),
        accepted: Number(row.accepted),
      }));
    });
    if (!result) return c.json(errorBody("goal_not_found", "Goal not found."), 404);
    return c.json(goalStatsListSchema.parse(result), 200);
  },
);
