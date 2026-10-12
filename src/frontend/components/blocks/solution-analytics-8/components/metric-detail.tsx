"use client"

import { useState } from "react"

import { MetricActivity } from "./metric-activity"
import { MetricBreakdown } from "./metric-breakdown"
import { MetricHeader } from "./metric-header"
import { MetricKpis } from "./metric-kpis"
import { MetricTrendChart } from "./metric-trend-chart"
import { type PeriodValue } from "./data"

// Metric Detail composition root: a content-level header, a KPI rail, the
// signature trend chart, and a balanced breakdown / recent-changes row. The
// reporting period is owned here and drives the trend chart window.
export function MetricDetail() {
  const [period, setPeriod] = useState<PeriodValue>("12w")

  return (
    <div className="flex w-full flex-col gap-6">
      <MetricHeader period={period} onPeriodChange={setPeriod} />
      <MetricKpis />
      <MetricTrendChart period={period} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <MetricBreakdown />
        <MetricActivity />
      </div>
    </div>
  )
}