/**
 * @fileoverview Overview dashboard API (maestro cs-be-2-9), per contract
 * cs-c-09.
 *
 * One request answers the whole Overview screen: the KPI strip with deltas
 * against the preceding window, runs per day by outcome, each goal's last 20
 * runs, the review backlog, and the most recent proposals.
 *
 * Mount at `/api/dashboard` alongside the template's own dashboard router —
 * their paths do not overlap.
 *
 * Every figure comes from Postgres. The honesty rules are in the contract and
 * enforced by the helpers it exports:
 *
 * - a rate with a zero denominator is `null`, never `0` — `ratioOrNull`
 * - a delta needs both ends, or it is `null` — `makeKpi`
 * - the day series is zero-filled across the window — `denseDays`
 *
 * **Point-in-time KPIs get a real baseline rather than a null one.** "Active
 * goals" and "review backlog" are states, not events, so their previous values
 * are reconstructed as of the window's start: the backlog from each proposal's
 * `created_at`/`decided_at` pair, and the goal count from the newest
 * `goal_revisions` snapshot that predates the window. Both are exact, and both
 * are cheaper than they look because the tables are small.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";

import { withPg, type PgDb } from "@/backend/pg/client";
import {
  DASHBOARD_STRIP_RUNS,
  DashboardOverviewQuerySchema,
  DashboardOverviewSchema,
  ErrorEnvelopeSchema,
  denseDays,
  makeKpi,
  ratioOrNull,
  type RunsPerDay,
} from "@/shared/contracts";

/** One row of the single aggregate query, all counts already integers. */
type Counts = Record<string, number | null>;

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const num = (value: unknown): number => (value == null ? 0 : Number(value));
const maybeNum = (value: unknown): number | null => (value == null ? null : Number(value));

/**
 * Count events in a window and in the window immediately before it.
 *
 * Written as one query per measure rather than one giant query, because a
 * dashboard that is wrong in one tile should be debuggable in one tile.
 *
 * @param db - The Postgres handle.
 * @param table - Table to count.
 * @param column - Timestamp column that places a row in a window.
 * @param windowStart - Start of the current window.
 * @param windowEnd - End of the current window.
 * @param previousStart - Start of the preceding window.
 * @param extra - Optional additional predicate, already parameterised.
 * @returns `{ current, previous }` counts.
 */
async function windowedCount(
  db: PgDb,
  table: string,
  column: string,
  windowStart: Date,
  windowEnd: Date,
  previousStart: Date,
  extra = sql`true`,
): Promise<{ current: number; previous: number }> {
  const identifier = sql.raw(`${table}.${column}`);
  const rows = (await db.execute(sql`
    select
      count(*) filter (where ${identifier} >= ${windowStart} and ${identifier} < ${windowEnd})::int as current,
      count(*) filter (where ${identifier} >= ${previousStart} and ${identifier} < ${windowStart})::int as previous
    from ${sql.raw(table)}
    where ${identifier} >= ${previousStart} and ${identifier} < ${windowEnd} and ${extra}
  `)) as unknown as { rows: Counts[] };
  const row = rows.rows[0] ?? {};
  return { current: num(row.current), previous: num(row.previous) };
}

/** Runs finished in each window, split into successes and failures. */
async function runOutcomes(db: PgDb, windowStart: Date, windowEnd: Date, previousStart: Date) {
  const rows = (await db.execute(sql`
    select
      count(*) filter (where finished_at >= ${windowStart} and finished_at < ${windowEnd})::int as done_current,
      count(*) filter (where finished_at >= ${windowStart} and finished_at < ${windowEnd} and status = 'succeeded')::int as ok_current,
      count(*) filter (where finished_at >= ${previousStart} and finished_at < ${windowStart})::int as done_previous,
      count(*) filter (where finished_at >= ${previousStart} and finished_at < ${windowStart} and status = 'succeeded')::int as ok_previous
    from agent_runs
    where finished_at >= ${previousStart} and finished_at < ${windowEnd}
  `)) as unknown as { rows: Counts[] };
  const row = rows.rows[0] ?? {};
  return {
    doneCurrent: num(row.done_current),
    okCurrent: num(row.ok_current),
    donePrevious: num(row.done_previous),
    okPrevious: num(row.ok_previous),
  };
}

/**
 * Reviewed proposals and how many were positive, per window.
 *
 * `decided_at` is when a verdict landed, so a proposal reviewed today counts
 * today even if the agent raised it last week.
 */
async function acceptance(db: PgDb, windowStart: Date, windowEnd: Date, previousStart: Date) {
  const rows = (await db.execute(sql`
    select
      count(*) filter (where decided_at >= ${windowStart} and decided_at < ${windowEnd})::int as decided_current,
      count(*) filter (where decided_at >= ${windowStart} and decided_at < ${windowEnd} and status = 'reviewed_positive')::int as yes_current,
      count(*) filter (where decided_at >= ${previousStart} and decided_at < ${windowStart})::int as decided_previous,
      count(*) filter (where decided_at >= ${previousStart} and decided_at < ${windowStart} and status = 'reviewed_positive')::int as yes_previous
    from proposals
    where decided_at is not null
      and status in ('reviewed_positive', 'reviewed_negative')
      and decided_at >= ${previousStart} and decided_at < ${windowEnd}
  `)) as unknown as { rows: Counts[] };
  const row = rows.rows[0] ?? {};
  return {
    decidedCurrent: num(row.decided_current),
    yesCurrent: num(row.yes_current),
    decidedPrevious: num(row.decided_previous),
    yesPrevious: num(row.yes_previous),
  };
}

/**
 * The review backlog now, and what it was when the window opened.
 *
 * A proposal was queued at instant T when it existed at T and had not yet been
 * decided at T — which is why the baseline is exact rather than null.
 */
async function reviewBacklog(db: PgDb, windowStart: Date, windowEnd: Date) {
  const rows = (await db.execute(sql`
    select
      count(*) filter (where status = 'queued')::int as queued,
      count(*) filter (where status = 'snoozed')::int as snoozed,
      count(*) filter (where status = 'queued' and expires_at is not null
                         and expires_at < ${windowEnd} + interval '48 hours')::int as expiring_soon,
      min(created_at) filter (where status = 'queued') as oldest_queued_at,
      count(*) filter (where status = 'silent_update'
                         and created_at >= ${windowStart} and created_at < ${windowEnd})::int as silent_updates,
      count(*) filter (where created_at < ${windowStart}
                         and (decided_at is null or decided_at >= ${windowStart}))::int as queued_at_window_start
    from proposals
  `)) as unknown as { rows: Array<Counts & { oldest_queued_at: Date | string | null }> };
  const row = rows.rows[0] ?? ({} as never);
  return {
    backlog: {
      queued: num(row.queued),
      snoozed: num(row.snoozed),
      expiring_soon: num(row.expiring_soon),
      oldest_queued_at: row.oldest_queued_at == null ? null : iso(row.oldest_queued_at),
      silent_updates: num(row.silent_updates),
    },
    queuedAtWindowStart: num(row.queued_at_window_start),
  };
}

/**
 * Active goals now, and active goals as of the window's start.
 *
 * The baseline reads each goal's newest revision snapshot from before the
 * window; a goal with no such revision did not exist yet and is not counted,
 * which is the difference between "we had fewer goals" and "we have no data".
 */
async function activeGoals(db: PgDb, windowStart: Date) {
  const rows = (await db.execute(sql`
    select
      (select count(*) from goals where status = 'active')::int as current,
      (
        select count(*)::int
        from goals g
        join lateral (
          select r.snapshot
          from goal_revisions r
          where r.goal_id = g.id and r.created_at < ${windowStart}
          order by r.revision desc
          limit 1
        ) prior on true
        where prior.snapshot ->> 'status' = 'active'
      ) as previous
  `)) as unknown as { rows: Counts[] };
  const row = rows.rows[0] ?? {};
  return { current: num(row.current), previous: num(row.previous) };
}

/** Runs per day by outcome, bucketed on the run's start in UTC. */
async function runsPerDay(
  db: PgDb,
  windowStart: Date,
  windowEnd: Date,
  windowDays: number,
): Promise<RunsPerDay[]> {
  const rows = (await db.execute(sql`
    select
      to_char(date_trunc('day', started_at at time zone 'UTC'), 'YYYY-MM-DD') as day,
      count(*) filter (where status = 'succeeded')::int as succeeded,
      count(*) filter (where status = 'failed')::int as failed,
      count(*) filter (where status = 'abandoned')::int as abandoned,
      count(*) filter (where status = 'running')::int as running
    from agent_runs
    where started_at >= ${windowStart} and started_at < ${windowEnd}
    group by 1
  `)) as unknown as { rows: Array<Counts & { day: string }> };

  const byDate: Record<string, Partial<Omit<RunsPerDay, "date" | "total">>> = {};
  for (const row of rows.rows) {
    byDate[row.day] = {
      succeeded: num(row.succeeded),
      failed: num(row.failed),
      abandoned: num(row.abandoned),
      running: num(row.running),
    };
  }
  return denseDays(windowStart.toISOString().slice(0, 10), windowDays, byDate);
}

/**
 * Each goal's last {@link DASHBOARD_STRIP_RUNS} runs, oldest first.
 *
 * Goals come back whether or not they have runs: a goal with an empty strip is
 * drawn as an empty strip, which is a different statement from a goal missing
 * from the dashboard.
 */
async function goalStrips(db: PgDb, limit: number) {
  const rows = (await db.execute(sql`
    with ranked as (
      select
        rg.goal_id,
        r.id, r.status, r.started_at, r.finished_at, r.quality_score,
        row_number() over (partition by rg.goal_id order by r.started_at desc, r.id desc) as rn,
        count(*) over (partition by rg.goal_id) as runs_total
      from run_goals rg
      join agent_runs r on r.id = rg.run_id
    )
    select
      g.id as goal_id, g.slug, g.title, g.category,
      coalesce((
        case
          when g.last_run_at is null or g.expected_cadence_hours is null then false
          else (g.last_run_at + (g.expected_cadence_hours * interval '1 hour')) < now()
        end
      ), false) as stale,
      coalesce(max(ranked.runs_total), 0)::int as runs_total,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', ranked.id, 'status', ranked.status, 'started_at', ranked.started_at,
            'finished_at', ranked.finished_at, 'quality_score', ranked.quality_score
          ) order by ranked.started_at
        ) filter (where ranked.id is not null),
        '[]'::jsonb
      ) as runs
    from goals g
    left join ranked on ranked.goal_id = g.id and ranked.rn <= ${DASHBOARD_STRIP_RUNS}
    where g.status <> 'retired'
    group by g.id, g.slug, g.title, g.category, g.last_run_at, g.expected_cadence_hours
    order by g.last_run_at desc nulls last, g.title asc
    limit ${limit}
  `)) as unknown as {
    rows: Array<{
      goal_id: string;
      slug: string;
      title: string;
      category: string;
      stale: boolean;
      runs_total: number | string;
      runs: Array<Record<string, unknown>>;
    }>;
  };

  return rows.rows.map((row) => ({
    goal_id: row.goal_id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    stale: Boolean(row.stale),
    runs_total: num(row.runs_total),
    runs: row.runs.map((run) => {
      const startedAt = run.started_at as string;
      const finishedAt = run.finished_at as string | null;
      return {
        id: run.id as string,
        status: run.status as string,
        started_at: iso(startedAt),
        duration_ms:
          finishedAt == null
            ? null
            : Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
        quality_score: maybeNum(run.quality_score),
      };
    }),
  }));
}

/** The most recent proposals, newest first, with their goal's title. */
async function recentProposals(db: PgDb, limit: number) {
  const rows = (await db.execute(sql`
    select p.id, p.kind, p.status, p.title, p.goal_id, g.title as goal_title,
           p.match_score, p.created_at, p.expires_at
    from proposals p
    left join goals g on g.id = p.goal_id
    order by p.created_at desc, p.id desc
    limit ${limit}
  `)) as unknown as {
    rows: Array<Record<string, unknown>>;
  };
  return rows.rows.map((row) => ({
    id: row.id as string,
    kind: row.kind as string,
    status: row.status as string,
    title: row.title as string,
    goal_id: (row.goal_id as string | null) ?? null,
    goal_title: (row.goal_title as string | null) ?? null,
    match_score: maybeNum(row.match_score),
    created_at: iso(row.created_at as string),
    expires_at: row.expires_at == null ? null : iso(row.expires_at as string),
  }));
}

/** Dashboard API router (the shopper's Overview). */
export const shoppingDashboardRouter = new OpenAPIHono<{ Bindings: Env }>();

shoppingDashboardRouter.openapi(
  createRoute({
    method: "get",
    path: "/overview",
    tags: ["Dashboard"],
    summary: "Everything the Overview screen shows, in one payload",
    operationId: "dashboardOverview",
    request: { query: DashboardOverviewQuerySchema },
    responses: {
      200: {
        description: "KPIs with deltas, runs per day, per-goal run strips, backlog, proposals.",
        content: { "application/json": { schema: DashboardOverviewSchema } },
      },
      400: {
        description: "Invalid query.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const { window_days: windowDays, strip_goals, recent_proposals } = c.req.valid("query");

    // The window is closed on the server and shipped to the client, so nothing
    // downstream re-derives it from a different clock.
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - windowDays * 86_400_000);
    const previousStart = new Date(windowStart.getTime() - windowDays * 86_400_000);

    const payload = await withPg(c.env, async (db) => {
      const [runs, outcomes, findings, lessons, accepted, backlog, goals, perDay, strips, proposals] =
        await Promise.all([
          windowedCount(db, "agent_runs", "started_at", windowStart, windowEnd, previousStart),
          runOutcomes(db, windowStart, windowEnd, previousStart),
          windowedCount(db, "sightings", "seen_at", windowStart, windowEnd, previousStart),
          windowedCount(
            db,
            "lessons",
            "created_at",
            windowStart,
            windowEnd,
            previousStart,
            sql`lessons.status = 'active'`,
          ),
          acceptance(db, windowStart, windowEnd, previousStart),
          reviewBacklog(db, windowStart, windowEnd),
          activeGoals(db, windowStart),
          runsPerDay(db, windowStart, windowEnd, windowDays),
          goalStrips(db, strip_goals),
          recentProposals(db, recent_proposals),
        ]);

      return {
        generated_at: windowEnd.toISOString(),
        window_days: windowDays,
        window_start: windowStart.toISOString(),
        window_end: windowEnd.toISOString(),
        kpis: [
          makeKpi({
            id: "active_goals",
            label: "Active goals",
            unit: "count",
            value: goals.current,
            previous: goals.previous,
          }),
          makeKpi({
            id: "runs",
            label: `Runs in ${windowDays}d`,
            unit: "count",
            value: runs.current,
            previous: runs.previous,
          }),
          makeKpi({
            id: "run_success_rate",
            label: "Success rate",
            unit: "ratio",
            value: ratioOrNull(outcomes.okCurrent, outcomes.doneCurrent),
            previous: ratioOrNull(outcomes.okPrevious, outcomes.donePrevious),
            unavailableReason: "no run has finished in this window",
          }),
          makeKpi({
            id: "new_findings",
            label: "New findings",
            unit: "count",
            value: findings.current,
            previous: findings.previous,
          }),
          makeKpi({
            id: "review_backlog",
            label: "Awaiting review",
            unit: "count",
            value: backlog.backlog.queued,
            previous: backlog.queuedAtWindowStart,
            // The one tile where up is bad.
            higherIsBetter: false,
          }),
          makeKpi({
            id: "accept_rate",
            label: "Accept rate",
            unit: "ratio",
            value: ratioOrNull(accepted.yesCurrent, accepted.decidedCurrent),
            previous: ratioOrNull(accepted.yesPrevious, accepted.decidedPrevious),
            unavailableReason: "nothing has been reviewed in this window",
          }),
          makeKpi({
            id: "lessons_learned",
            label: "Lessons learned",
            unit: "count",
            value: lessons.current,
            previous: lessons.previous,
          }),
        ],
        runs_per_day: perDay,
        goal_strips: strips,
        review_backlog: backlog.backlog,
        recent_proposals: proposals,
      };
    });

    return c.json(DashboardOverviewSchema.parse(payload), 200);
  },
);
