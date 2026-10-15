/**
 * @fileoverview Overview dashboard contract (maestro cs-c-09).
 *
 * One payload behind `GET /api/dashboard/overview`, read by the Overview
 * screen's KPI strip, its throughput chart, the per-goal run strips, the
 * review-backlog call to action and the recent-proposals list (FE-1).
 *
 * Plain `zod` and sibling contracts only — no Hono, no Drizzle — so the browser
 * bundle stays clean and the plain-Node self-checks can load it through the
 * same alias hook the other contract checks use.
 *
 * Three rules this schema exists to enforce, because the alternative in each
 * case is a dashboard that states something untrue:
 *
 * - **A figure that cannot be computed is `null`, never `0`.** A success rate
 *   with no finished runs, an accept rate with nothing reviewed, and a delta
 *   with no previous window are all unknown. Zero is a measurement.
 * - **A delta is only a delta when both sides exist.** `delta` is
 *   `value - previous`, and it is `null` the moment either end is `null`, so
 *   the UI cannot draw a green arrow off a missing baseline.
 * - **Every series is dense.** `runs_per_day` carries one row per day in the
 *   window including the zero days, so a gap in the data cannot be mistaken
 *   for a gap in time by whatever draws it.
 */

import { z } from "zod";

import { Id, IsoDate, IsoDateTime } from "./common";
import { AgentClientSchema, GoalCategorySchema } from "./goals";
import { RunStatusSchema } from "./runs";
import { ProposalKindSchema, ProposalStatusSchema } from "./proposals";

/** How many runs a per-goal health strip carries. Both sides read this. */
export const DASHBOARD_STRIP_RUNS = 20;

/** Default and maximum size of the dashboard's trailing window, in days. */
export const DASHBOARD_WINDOW_DAYS = 7;
export const DASHBOARD_MAX_WINDOW_DAYS = 90;

/** How many goals get a run strip, and how many proposals are listed. */
export const DASHBOARD_STRIP_GOALS = 8;
export const DASHBOARD_RECENT_PROPOSALS = 8;
/** How many recent runs the Overview's incident list, queue preview and feed share. */
export const DASHBOARD_RECENT_RUNS = 10;

export const KPI_IDS = [
  "active_goals",
  "runs",
  "run_success_rate",
  "new_findings",
  "review_backlog",
  "accept_rate",
  "lessons_learned",
] as const;
export type KpiId = (typeof KPI_IDS)[number];

/** `count` is a whole number; `ratio` is 0..1 and renders as a percentage. */
export const KPI_UNITS = ["count", "ratio"] as const;

/**
 * One KPI tile.
 *
 * `value` and `previous` are the same measure over this window and the window
 * immediately before it. Both are nullable because "nothing to divide by" and
 * "no earlier window" are real states, and `delta` is null whenever either is.
 */
export const KpiSchema = z
  .object({
    id: z.enum(KPI_IDS),
    label: z.string(),
    unit: z.enum(KPI_UNITS),
    value: z.number().nullable(),
    previous: z.number().nullable(),
    delta: z.number().nullable(),
    /**
     * Whether a rise is good. The review backlog is the one that is not, and
     * the tile needs to know before it picks a colour.
     */
    higher_is_better: z.boolean(),
    /** Why this is null, when it is — shown instead of a number. */
    unavailable_reason: z.string().nullable(),
  })
  .meta({ id: "DashboardKpi" });
export type Kpi = z.infer<typeof KpiSchema>;

/**
 * One day of run outcomes. Dense: a day with no runs is present with zeros,
 * so the chart's x-axis is time rather than a list of days that had activity.
 */
export const RunsPerDaySchema = z
  .object({
    date: IsoDate,
    succeeded: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    abandoned: z.number().int().nonnegative(),
    running: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    /** How many of `total` were core-browser runs. A subset, not a fifth outcome. */
    browser: z.number().int().nonnegative(),
  })
  .meta({ id: "DashboardRunsPerDay" });
export type RunsPerDay = z.infer<typeof RunsPerDaySchema>;

/** One run in a goal's health strip, oldest first. */
export const StripRunSchema = z
  .object({
    id: Id,
    status: RunStatusSchema,
    started_at: IsoDateTime,
    /** Null while the run is still going — not zero. */
    duration_ms: z.number().int().nonnegative().nullable(),
    quality_score: z.number().nullable(),
    /** What the run says it did, for the strip's hover card. */
    summary: z.string(),
    /** Sightings the run recorded (the "findings" a strip bar reports). */
    sightings_count: z.number().int().nonnegative(),
  })
  .meta({ id: "DashboardStripRun" });

/** One recent run, for the incident list, the queue preview and the activity feed. */
export const RecentRunSchema = z
  .object({
    id: Id,
    client: AgentClientSchema,
    status: RunStatusSchema,
    summary: z.string(),
    /** Why it failed, when it did. */
    error: z.string().nullable(),
    started_at: IsoDateTime,
    finished_at: IsoDateTime.nullable(),
    sightings_count: z.number().int().nonnegative(),
    /** The first of the run's goals by title, or null for a run no goal owns. */
    goal_title: z.string().nullable(),
  })
  .meta({ id: "DashboardRecentRun" });
export type RecentRun = z.infer<typeof RecentRunSchema>;

/**
 * A goal's last {@link DASHBOARD_STRIP_RUNS} runs.
 *
 * `runs` may be shorter than that, and empty for a goal that has never run.
 * An empty strip is drawn as an empty strip; it is not a goal in trouble.
 */
export const GoalRunStripSchema = z
  .object({
    goal_id: Id,
    slug: z.string(),
    title: z.string(),
    category: GoalCategorySchema,
    stale: z.boolean(),
    runs: z.array(StripRunSchema).max(DASHBOARD_STRIP_RUNS),
    /** Total runs ever, which may exceed the strip. */
    runs_total: z.number().int().nonnegative(),
  })
  .meta({ id: "DashboardGoalRunStrip" });
export type GoalRunStrip = z.infer<typeof GoalRunStripSchema>;

/** What is waiting for a person, and how long it has waited. */
export const ReviewBacklogSchema = z
  .object({
    queued: z.number().int().nonnegative(),
    snoozed: z.number().int().nonnegative(),
    /** Queued proposals whose `expires_at` is inside the next 48 hours. */
    expiring_soon: z.number().int().nonnegative(),
    /** Null when nothing is queued — not the epoch, and not "now". */
    oldest_queued_at: IsoDateTime.nullable(),
    /** Proposals recorded without ever being queued, in this window. */
    silent_updates: z.number().int().nonnegative(),
  })
  .meta({ id: "DashboardReviewBacklog" });
export type ReviewBacklog = z.infer<typeof ReviewBacklogSchema>;

/** A recent proposal, with enough of its goal to be clickable. */
export const RecentProposalSchema = z
  .object({
    id: Id,
    kind: ProposalKindSchema,
    status: ProposalStatusSchema,
    title: z.string(),
    /** Null for a proposal no goal owns. */
    goal_id: Id.nullable(),
    goal_title: z.string().nullable(),
    match_score: z.number().nullable(),
    created_at: IsoDateTime,
    expires_at: IsoDateTime.nullable(),
  })
  .meta({ id: "DashboardRecentProposal" });
export type RecentProposal = z.infer<typeof RecentProposalSchema>;

/** The whole Overview payload. */
export const DashboardOverviewSchema = z
  .object({
    /** When the server computed this, so the screen can say how fresh it is. */
    generated_at: IsoDateTime,
    /** The trailing window every windowed figure in here used. */
    window_days: z.number().int().min(1).max(DASHBOARD_MAX_WINDOW_DAYS),
    /** The window's bounds, so the client never re-derives them from a clock. */
    window_start: IsoDateTime,
    window_end: IsoDateTime,
    kpis: z.array(KpiSchema),
    runs_per_day: z.array(RunsPerDaySchema),
    goal_strips: z.array(GoalRunStripSchema),
    review_backlog: ReviewBacklogSchema,
    recent_proposals: z.array(RecentProposalSchema),
    /** The newest {@link DASHBOARD_RECENT_RUNS} runs, newest first, any goal. */
    recent_runs: z.array(RecentRunSchema),
  })
  .meta({ id: "DashboardOverview" });
export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;

/** `GET /api/dashboard/overview` query. */
export const DashboardOverviewQuerySchema = z
  .object({
    window_days: z.coerce
      .number()
      .int()
      .min(1)
      .max(DASHBOARD_MAX_WINDOW_DAYS)
      .default(DASHBOARD_WINDOW_DAYS),
    strip_goals: z.coerce.number().int().min(1).max(50).default(DASHBOARD_STRIP_GOALS),
    recent_proposals: z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .default(DASHBOARD_RECENT_PROPOSALS),
  })
  .meta({ id: "DashboardOverviewQuery" });
export type DashboardOverviewQuery = z.infer<typeof DashboardOverviewQuerySchema>;

/**
 * Build a KPI tile, deriving the delta so no call site can get it wrong.
 *
 * Shared rather than server-only: the Overview's own tests and any client that
 * recomputes a tile must agree with the server about what a missing baseline
 * means, which is "no delta" rather than "no change".
 *
 * @param input - The measured figure, its previous-window counterpart, and the
 *   tile's identity.
 * @returns A tile whose `delta` is null unless both ends are known.
 * @example
 * ```typescript
 * makeKpi({ id: "runs", label: "Runs", unit: "count", value: 12, previous: 8 });
 * // delta 4
 * makeKpi({ id: "run_success_rate", label: "Success", unit: "ratio", value: null, previous: 0.5,
 *           unavailableReason: "no finished runs in this window" });
 * // value null, delta null
 * ```
 */
export function makeKpi(input: {
  id: KpiId;
  label: string;
  unit: (typeof KPI_UNITS)[number];
  value: number | null;
  previous: number | null;
  higherIsBetter?: boolean;
  unavailableReason?: string | null;
}): Kpi {
  const { value, previous } = input;
  return KpiSchema.parse({
    id: input.id,
    label: input.label,
    unit: input.unit,
    value,
    previous,
    delta: value === null || previous === null ? null : value - previous,
    higher_is_better: input.higherIsBetter ?? true,
    unavailable_reason: value === null ? (input.unavailableReason ?? "not measurable yet") : null,
  });
}

/**
 * A rate, or null when there is nothing to divide by.
 *
 * The whole point: 0 successes out of 0 runs is not a 0% success rate, and
 * every rate on this dashboard goes through here so none of them can claim it.
 *
 * @param numerator - Events that happened.
 * @param denominator - Events that could have happened.
 * @returns The ratio, or null when the denominator is zero.
 * @example
 * ```typescript
 * ratioOrNull(0, 0); // null — nothing ran
 * ratioOrNull(0, 4); // 0 — four ran and none succeeded
 * ```
 */
export function ratioOrNull(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/**
 * Close the dashboard's window, day-aligned, so the series and the counts agree.
 *
 * The window **ends now** and **starts at midnight UTC** on the first of its
 * `window_days` calendar days. Day-aligning the start is not cosmetic: a window
 * that simply started `window_days * 24h` ago would span `window_days + 1`
 * calendar days, the dense series would hold one bucket too few, and the runs
 * that happened today would fall off the end of the chart while still counting
 * toward the "runs in 7d" tile. The two would disagree and the chart would be
 * the one that was wrong.
 *
 * The previous window is the same number of whole days immediately before, so
 * a delta compares like with like.
 *
 * @param now - The instant the dashboard was asked for.
 * @param windowDays - How many calendar days the window spans, including today.
 * @returns The window bounds and the start of the preceding window.
 * @example
 * ```typescript
 * dashboardWindow(new Date("2026-10-10T18:30:00Z"), 7);
 * // start 2026-10-04T00:00:00Z, end 2026-10-10T18:30:00Z,
 * // previousStart 2026-09-27T00:00:00Z
 * ```
 */
export function dashboardWindow(
  now: Date,
  windowDays: number,
): { windowStart: Date; windowEnd: Date; previousStart: Date } {
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const windowStart = new Date(startOfToday - (windowDays - 1) * 86_400_000);
  return {
    windowStart,
    windowEnd: now,
    previousStart: new Date(windowStart.getTime() - windowDays * 86_400_000),
  };
}

/**
 * Fill a day-bucketed series out to every day in the window.
 *
 * @param start - First day of the window, as YYYY-MM-DD.
 * @param days - How many days the window spans, inclusive of `start`.
 * @param byDate - Sparse buckets keyed by YYYY-MM-DD.
 * @returns One row per day, oldest first, zero-filled.
 * @example
 * ```typescript
 * denseDays("2026-10-08", 3, { "2026-10-09": { succeeded: 2 } });
 * // 2026-10-08 all zero, 2026-10-09 succeeded 2, 2026-10-10 all zero
 * ```
 */
export function denseDays(
  start: string,
  days: number,
  byDate: Record<string, Partial<Omit<RunsPerDay, "date" | "total">>>,
): RunsPerDay[] {
  const out: RunsPerDay[] = [];
  const first = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < days; i += 1) {
    const day = new Date(first.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    const bucket = byDate[day] ?? {};
    const succeeded = bucket.succeeded ?? 0;
    const failed = bucket.failed ?? 0;
    const abandoned = bucket.abandoned ?? 0;
    const running = bucket.running ?? 0;
    out.push({
      date: day,
      succeeded,
      failed,
      abandoned,
      running,
      total: succeeded + failed + abandoned + running,
      browser: bucket.browser ?? 0,
    });
  }
  return out;
}
