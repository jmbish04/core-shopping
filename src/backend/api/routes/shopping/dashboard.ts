/**
 * @fileoverview Overview dashboard API (maestro cs-be-2-9), per contract
 * cs-c-09.
 *
 * One request answers the whole Overview screen: the KPI strip with deltas
 * against the preceding window, runs per day by outcome, each goal's last 20
 * runs, the review backlog, and the most recent proposals.
 *
 * Mount at `/api/dashboard` alongside the template's own dashboard router —
 * their paths do not overlap (`/overview` vs `/stats`, `/charts`, `/insights`).
 *
 * Every figure comes from Postgres, through `./dashboard-queries`. The honesty
 * rules are in the contract and enforced by the helpers it exports:
 *
 * - a rate with a zero denominator is `null`, never `0` — `ratioOrNull`
 * - a delta needs both ends, or it is `null` — `makeKpi`
 * - the day series is zero-filled across the window — `denseDays`
 */

import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";

import { withPg } from "@/backend/pg/client";
import {
  DASHBOARD_RECENT_RUNS,
  DashboardOverviewQuerySchema,
  DashboardOverviewSchema,
  ErrorEnvelopeSchema,
  dashboardWindow,
  makeKpi,
  ratioOrNull,
} from "@/shared/contracts";

import {
  acceptance,
  activeGoals,
  goalStrips,
  recentProposals,
  recentRuns,
  reviewBacklog,
  runOutcomes,
  runsPerDay,
  windowedCount,
} from "./dashboard-queries";

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
    // downstream re-derives it from a different clock. It is day-aligned, so
    // the dense series and the windowed counts describe the same span.
    const { windowStart, windowEnd, previousStart } = dashboardWindow(new Date(), windowDays);

    const payload = await withPg(c.env, async (db) => {
      const [runs, outcomes, findings, lessons, accepted, backlog, goals, perDay, strips, proposals, latestRuns] =
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
          recentRuns(db, DASHBOARD_RECENT_RUNS),
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
        recent_runs: latestRuns,
      };
    });

    return c.json(DashboardOverviewSchema.parse(payload), 200);
  },
);
