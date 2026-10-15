/**
 * @fileoverview Pure logic for the Overview's run sections (maestro cs-fe-1-2,
 * cs-fe-1-3, cs-fe-1-4).
 *
 * Split from the islands so `scripts/selfcheck-overview-sections.mjs` can load
 * it under plain Node. Every figure here comes out of the one
 * `GET /api/dashboard/overview` payload; nothing is refetched or invented.
 *
 * - **Incidents are failed runs and stale goals.** A failed run is an incident
 *   at its start time, with its own error as the detail. A stale goal is an
 *   incident at its last run, because that is when the cadence started
 *   slipping. A goal that never ran is not stale (the server says so) and is
 *   not listed.
 * - **The activity feed merges runs and proposals by time**, newest first. A
 *   run is placed at its finish when it has one, otherwise at its start.
 * - **The review call to action counts queued proposals only.** Snoozed ones
 *   are waiting on time, not on a person; they are mentioned, not counted.
 */

import type { DashboardOverview, GoalRunStrip, RecentProposal, RecentRun, RunsPerDay } from "@/shared/contracts";

/** One row of the incident list. */
export interface Incident {
  id: string;
  kind: "failed_run" | "stale_goal";
  title: string;
  detail: string;
  /** ISO time the incident is placed at; null sorts last. */
  at: string | null;
  href: string;
  /** For a failed run, whether core-browser ran it. */
  browser: boolean;
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : Number.NEGATIVE_INFINITY);
const byNewest = <T extends { at: string | null }>(a: T, b: T) => time(b.at) - time(a.at);

/**
 * Build the incident list.
 *
 * @param runs - `recent_runs` from the overview.
 * @param strips - `goal_strips` from the overview.
 * @returns Failed runs and stale goals, newest first.
 */
export function buildIncidents(runs: RecentRun[], strips: GoalRunStrip[]): Incident[] {
  const failed: Incident[] = runs
    .filter((run) => run.status === "failed")
    .map((run) => ({
      id: `run:${run.id}`,
      kind: "failed_run",
      title: run.goal_title ?? (run.summary || "Run failed"),
      detail: run.error ?? "Failed without a recorded reason.",
      at: run.started_at,
      href: `/runs/${encodeURIComponent(run.id)}`,
      browser: run.client === "browser",
    }));
  const stale: Incident[] = strips
    .filter((strip) => strip.stale)
    .map((strip) => {
      const last = strip.runs.at(-1)?.started_at ?? null;
      return {
        id: `goal:${strip.goal_id}`,
        kind: "stale_goal",
        title: strip.title,
        detail: "Overdue: no run inside its expected cadence.",
        at: last,
        href: `/runs?goal=${encodeURIComponent(strip.goal_id)}`,
        browser: false,
      };
    });
  return [...failed, ...stale].sort(byNewest);
}

/** One row of the activity feed. */
export type ActivityItem =
  | { kind: "run"; id: string; at: string; run: RecentRun }
  | { kind: "proposal"; id: string; at: string; proposal: RecentProposal };

/**
 * Merge recent runs and proposals into one feed.
 *
 * @param overview - The overview payload.
 * @param limit - How many rows to keep.
 * @returns Newest first.
 */
export function buildActivity(
  overview: Pick<DashboardOverview, "recent_runs" | "recent_proposals">,
  limit = 10,
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...overview.recent_runs.map((run) => ({
      kind: "run" as const,
      id: `run:${run.id}`,
      at: run.finished_at ?? run.started_at,
      run,
    })),
    ...overview.recent_proposals.map((proposal) => ({
      kind: "proposal" as const,
      id: `proposal:${proposal.id}`,
      at: proposal.created_at,
      proposal,
    })),
  ];
  return items.sort(byNewest).slice(0, limit);
}

/**
 * The review call to action's label, or null when nothing is queued.
 *
 * @param backlog - `review_backlog` from the overview.
 * @returns e.g. "Review 3 items", or null.
 */
export function reviewCtaLabel(backlog: DashboardOverview["review_backlog"]): string | null {
  if (backlog.queued <= 0) return null;
  return `Review ${backlog.queued.toLocaleString("en-US")} ${backlog.queued === 1 ? "item" : "items"}`;
}

/**
 * Label a UTC calendar day. The series is bucketed in UTC, so it is labelled in
 * UTC: a local-time formatter puts "2026-10-15" on Oct 14 west of Greenwich.
 *
 * @param date - `YYYY-MM-DD`.
 * @returns e.g. "Oct 15".
 */
export function utcDayLabel(date: string): string {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(ms)) return date;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Window totals for the throughput chart's header. */
export function throughputTotals(days: RunsPerDay[]): {
  total: number;
  failed: number;
  browser: number;
  running: number;
} {
  return days.reduce(
    (acc, day) => ({
      total: acc.total + day.total,
      failed: acc.failed + day.failed,
      browser: acc.browser + day.browser,
      running: acc.running + day.running,
    }),
    { total: 0, failed: 0, browser: 0, running: 0 },
  );
}

/**
 * A goal strip's share of finished runs that succeeded.
 *
 * @param strip - One goal's strip.
 * @returns 0..1, or null when no run in the strip has finished.
 */
export function stripSuccessRate(strip: GoalRunStrip): number | null {
  const finished = strip.runs.filter((run) => run.status !== "running");
  if (finished.length === 0) return null;
  return finished.filter((run) => run.status === "succeeded").length / finished.length;
}
