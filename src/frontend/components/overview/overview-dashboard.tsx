/**
 * @fileoverview `/` — the shopper Overview island (maestro epic cs-fe-1).
 *
 * Reads one payload, `GET /api/dashboard/overview`, and hands each FE-1
 * section its slice. Today that is the KPI strip (cs-fe-1-1); the throughput
 * chart, per-goal run strips, review backlog and recent proposals read the
 * same payload and land beside it.
 *
 * The template's own landing island lives on at `/lab` as `overview-view.tsx`.
 */

"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorState } from "@/components/common/shared";
import { ApiError, apiGet } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { DashboardOverview } from "@/shared/contracts";

import { KpiStrip } from "./kpi-strip";
import { buildKpiTiles } from "./kpi-tiles";

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

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorState message={error} onRetry={() => setReloadToken((n) => n + 1)} /> : null}
      {error && !overview ? null : <KpiStrip tiles={tiles} />}
      {overview ? (
        <p className="text-muted-foreground text-xs">
          Last {overview.window_days} days · updated {relativeTime(overview.generated_at)}
        </p>
      ) : null}
    </div>
  );
}
