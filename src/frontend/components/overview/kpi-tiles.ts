/**
 * @fileoverview Pure tile logic for the Overview KPI strip (maestro cs-fe-1-1).
 *
 * Split from the island so `scripts/selfcheck-overview-kpis.mjs` can load it
 * under plain Node: type-only imports, no `.tsx`, no React. The decisions
 * worth pinning all live here —
 *
 * - **Five tiles, from the task.** Active goals, runs (with the success rate
 *   as its secondary figure), new findings, the review backlog and lessons
 *   learned. The payload also carries `accept_rate`; the strip does not draw it,
 *   because FE-1 did not ask for it there.
 * - **Unknown is not zero.** A null value renders as an em dash with the
 *   server's reason, and a null delta draws no badge at all — never a "0".
 * - **Colour follows `higher_is_better`.** A rising review backlog is bad
 *   news, so its up arrow is the destructive tone, not the success tone.
 * - **A ratio's delta is in percentage points.** 40% → 50% is "+10 pts", not
 *   "+0.1" and not "+25%".
 * - **Only real series get a sparkline.** `runs_per_day` is the one dense
 *   daily series in the payload, so only the runs tile has one. No other tile
 *   is given an invented trend line.
 */

import type { DashboardOverview, Kpi, KpiId, RunsPerDay } from "@/shared/contracts";

/** The tiles the strip draws, in order. */
export const STRIP_KPI_IDS: readonly KpiId[] = [
  "active_goals",
  "runs",
  "new_findings",
  "review_backlog",
  "lessons_learned",
];

/** How a delta badge is coloured. `flat` is a measured zero change. */
export type DeltaTone = "good" | "bad" | "flat";

/** One sparkline point: a day and its run total. */
export interface SparkPoint {
  date: string;
  value: number;
}

/** Everything the tile component needs, already formatted. */
export interface KpiTile {
  id: KpiId;
  title: string;
  /** The headline figure, or an em dash when the server could not compute it. */
  value: string;
  /** Why `value` is a dash; null when it is a number. */
  unavailableReason: string | null;
  /** Null when either side of the comparison is unknown — no badge then. */
  delta: { text: string; tone: DeltaTone; direction: "up" | "down" | "none" } | null;
  /** Caption under the badge, e.g. "vs previous 7 days". */
  comparison: string;
  /** A secondary figure on the same tile, e.g. the runs tile's success rate. */
  secondary: { label: string; value: string; reason: string | null } | null;
  /** A dense daily series, or null when the payload has none for this tile. */
  sparkline: SparkPoint[] | null;
}

const COUNT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * Format a KPI's value for display.
 *
 * @param unit - `count` or `ratio`.
 * @param value - The measured figure, or null when unknown.
 * @returns A thousands-separated count, a whole percentage, or an em dash.
 * @example
 * ```typescript
 * formatKpiValue("count", 12345); // "12,345"
 * formatKpiValue("ratio", 0.5);   // "50%"
 * formatKpiValue("ratio", null);  // "—"
 * ```
 */
export function formatKpiValue(unit: Kpi["unit"], value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return unit === "ratio" ? `${Math.round(value * 100)}%` : COUNT.format(value);
}

/**
 * Format a KPI delta and pick its tone.
 *
 * @param kpi - A tile from the payload.
 * @returns The badge text and tone, or null when the delta is unknown.
 * @example
 * ```typescript
 * formatKpiDelta({ unit: "count", delta: 4, higher_is_better: true, ... });
 * // { text: "+4", tone: "good", direction: "up" }
 * formatKpiDelta({ unit: "count", delta: 3, higher_is_better: false, ... });
 * // { text: "+3", tone: "bad", direction: "up" }
 * ```
 */
export function formatKpiDelta(kpi: Kpi): KpiTile["delta"] {
  const { delta } = kpi;
  if (delta === null || !Number.isFinite(delta)) return null;
  const magnitude =
    kpi.unit === "ratio"
      ? `${Math.round(Math.abs(delta) * 100)} pts`
      : COUNT.format(Math.abs(delta));
  // A ratio delta that rounds to 0 pts is a flat change as far as a reader can see.
  const shown = kpi.unit === "ratio" ? Math.round(delta * 100) : delta;
  if (shown === 0) return { text: kpi.unit === "ratio" ? "0 pts" : "0", tone: "flat", direction: "none" };
  const up = shown > 0;
  return {
    text: `${up ? "+" : "−"}${magnitude}`,
    tone: up === kpi.higher_is_better ? "good" : "bad",
    direction: up ? "up" : "down",
  };
}

/**
 * Build the strip's tiles from the Overview payload.
 *
 * A tile whose KPI is missing from the payload is left out rather than drawn
 * as zero — the server decides which measures exist.
 *
 * @param overview - `GET /api/dashboard/overview`.
 * @returns The tiles, in {@link STRIP_KPI_IDS} order.
 */
export function buildKpiTiles(overview: Pick<DashboardOverview, "kpis" | "runs_per_day" | "window_days">): KpiTile[] {
  const byId = new Map(overview.kpis.map((k) => [k.id, k]));
  const comparison = `vs previous ${overview.window_days} ${overview.window_days === 1 ? "day" : "days"}`;
  const tiles: KpiTile[] = [];
  for (const id of STRIP_KPI_IDS) {
    const kpi = byId.get(id);
    if (!kpi) continue;
    let secondary: KpiTile["secondary"] = null;
    let sparkline: KpiTile["sparkline"] = null;
    if (id === "runs") {
      const rate = byId.get("run_success_rate");
      if (rate) {
        secondary = {
          label: rate.label,
          value: formatKpiValue(rate.unit, rate.value),
          reason: rate.value === null ? rate.unavailable_reason : null,
        };
      }
      sparkline = runSparkline(overview.runs_per_day);
    }
    tiles.push({
      id,
      title: kpi.label,
      value: formatKpiValue(kpi.unit, kpi.value),
      unavailableReason: kpi.value === null ? kpi.unavailable_reason : null,
      delta: formatKpiDelta(kpi),
      comparison,
      secondary,
      sparkline,
    });
  }
  return tiles;
}

/**
 * The runs tile's sparkline: one point per day, oldest first.
 *
 * Returns null for an empty series. A window with days but no runs still gets
 * a (flat) line, because "no runs on these days" is a measurement.
 *
 * @param days - The dense `runs_per_day` series.
 * @returns Daily totals, or null when there are no days at all.
 */
export function runSparkline(days: readonly RunsPerDay[]): SparkPoint[] | null {
  if (days.length === 0) return null;
  return days.map((d) => ({ date: d.date, value: d.total }));
}
