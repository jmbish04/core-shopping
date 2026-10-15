/**
 * @fileoverview The Overview dashboard's Postgres queries (maestro cs-be-2-9).
 *
 * Split from `./dashboard`, which holds the route, so that
 * `scripts/verify-dashboard-sql.mjs` can run this SQL against the real
 * database inside a transaction it rolls back. The route builds an
 * `OpenAPIHono` at module load, and the point of the split is that the
 * verifier never has to.
 *
 * Every function is one measure. A dashboard that is wrong in one tile should
 * be debuggable in one tile, which is worth more here than one clever query.
 *
 * **Point-in-time measures get a real baseline rather than a null one.**
 * "Active goals" and "review backlog" are states, not events, so their
 * previous values are reconstructed as of the window's start: the backlog from
 * each proposal's `created_at`/`decided_at` pair, and the goal count from the
 * newest `goal_revisions` snapshot that predates the window. A goal with no
 * such revision did not exist yet, which is not the same as being inactive.
 */

import { sql } from "drizzle-orm";

import type { PgDb } from "@/backend/pg/client";
import { DASHBOARD_STRIP_RUNS, denseDays, type RunsPerDay } from "@/shared/contracts";

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
export async function windowedCount(
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
export async function runOutcomes(db: PgDb, windowStart: Date, windowEnd: Date, previousStart: Date) {
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
export async function acceptance(db: PgDb, windowStart: Date, windowEnd: Date, previousStart: Date) {
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
export async function reviewBacklog(db: PgDb, windowStart: Date, windowEnd: Date) {
  const rows = (await db.execute(sql`
    select
      count(*) filter (where status = 'queued')::int as queued,
      count(*) filter (where status = 'snoozed')::int as snoozed,
      -- The cast is load-bearing: an untyped parameter next to an interval is
      -- parsed as interval + interval, which fails with 42883 on every call.
      count(*) filter (where status = 'queued' and expires_at is not null
                         and expires_at < (${windowEnd}::timestamptz + interval '48 hours'))::int as expiring_soon,
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
export async function activeGoals(db: PgDb, windowStart: Date) {
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
export async function runsPerDay(
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
      count(*) filter (where status = 'running')::int as running,
      count(*) filter (where client = 'browser')::int as browser
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
      browser: num(row.browser),
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
export async function goalStrips(db: PgDb, limit: number) {
  const rows = (await db.execute(sql`
    with ranked as (
      select
        rg.goal_id,
        r.id, r.status, r.started_at, r.finished_at, r.quality_score, r.summary, r.sightings_count,
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
            'finished_at', ranked.finished_at, 'quality_score', ranked.quality_score,
            'summary', ranked.summary, 'sightings_count', ranked.sightings_count
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
        summary: (run.summary as string | null) ?? "",
        sightings_count: num(run.sightings_count),
      };
    }),
  }));
}

/**
 * The newest runs across every goal, newest first.
 *
 * A run with several goals is one row, named by its first goal title; a run
 * with no goal has a null title rather than being dropped.
 */
export async function recentRuns(db: PgDb, limit: number) {
  const rows = (await db.execute(sql`
    select r.id, r.client, r.status, r.summary, r.error, r.started_at, r.finished_at, r.sightings_count,
           (select g.title from run_goals rg join goals g on g.id = rg.goal_id
             where rg.run_id = r.id order by g.title limit 1) as goal_title
    from agent_runs r
    order by r.started_at desc, r.id desc
    limit ${limit}
  `)) as unknown as { rows: Array<Record<string, unknown>> };
  return rows.rows.map((row) => ({
    id: row.id as string,
    client: row.client as string,
    status: row.status as string,
    summary: (row.summary as string | null) ?? "",
    error: (row.error as string | null) ?? null,
    started_at: iso(row.started_at as string),
    finished_at: row.finished_at == null ? null : iso(row.finished_at as string),
    sightings_count: num(row.sightings_count),
    goal_title: (row.goal_title as string | null) ?? null,
  }));
}

/** The most recent proposals, newest first, with their goal's title. */
export async function recentProposals(db: PgDb, limit: number) {
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

