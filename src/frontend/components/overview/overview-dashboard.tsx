/**
 * @fileoverview `/` — the shopper Overview island (maestro epic cs-fe-1).
 *
 * Reads one payload, `GET /api/dashboard/overview`, and hands each FE-1
 * section its slice: the KPI strip (cs-fe-1-1), run throughput and incidents
 * (cs-fe-1-2), per-goal run strips (cs-fe-1-3), and the activity feed with the
 * review call to action (cs-fe-1-4). No section refetches.
 *
 * The template's own landing island lives on at `/lab` as `overview-view.tsx`.
 */

"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorState } from "@/components/common/shared";
import { ApiError, apiGet } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { DashboardOverview } from "@/shared/contracts";

import { ActivityFeed } from "./activity-feed";
import { GoalStrips } from "./goal-strips";
import { KpiStrip } from "./kpi-strip";
import { buildKpiTiles } from "./kpi-tiles";
import { buildIncidents } from "./overview-sections";
import { IncidentList, RunThroughput } from "./run-throughput";

/** The Overview screen: KPI strip first, sections below it as they ship. */
export function OverviewDashboard() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    apiGet<DashboardOverview>("dashboard/overview")
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Could not load the overview.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const tiles = useMemo(() => (overview ? buildKpiTiles(overview) : null), [overview]);
  const incidents = useMemo(
    () => (overview ? buildIncidents(overview.recent_runs, overview.goal_strips) : []),
    [overview],
  );

  return (
    <div className="@container flex flex-col gap-4">
      {error ? <ErrorState message={error} onRetry={() => setReloadToken((n) => n + 1)} /> : null}
      {error && !overview ? null : <KpiStrip tiles={tiles} />}
      {overview ? (
        <>
          <p className="text-muted-foreground text-xs">
            Last {overview.window_days} days · updated {relativeTime(overview.generated_at)}
          </p>
          <div className="grid grid-cols-1 items-start gap-4 @4xl:grid-cols-3">
            <div className="flex min-w-0 @4xl:col-span-2">
              <RunThroughput days={overview.runs_per_day} windowDays={overview.window_days} />
            </div>
            <div className="flex min-w-0">
              <IncidentList incidents={incidents} />
            </div>
          </div>
          <GoalStrips strips={overview.goal_strips} />
          <ActivityFeed overview={overview} />
        </>
      ) : null}
    </div>
  );
}
