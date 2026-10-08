import { useMemo, useState } from "react"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { cn } from "@/lib/utils"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts"

import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  THROUGHPUT_PERIODS,
  THROUGHPUT_RANGE_OPTIONS,
  throughputChartConfig,
  type ThroughputPeriodKey,
} from "./data"
import { TrendingUp, TrendingDown } from "lucide-react"

// ── Run throughput chart (reused from application/chart/chart-21) ──
// Reuses chart-21's "Cashflow line chart" composition: a FrameHeader with the
// title and a period Select, a total-with-trend stat, and a ComposedChart of a
// faint gradient Area under a Line with dots. Adapted to agent run throughput.
// Matches incident-timeline's Frame → FrameHeader(FrameTitle) → FramePanel
// (flex grow flex-col) so the side-by-side row reads balanced and equal height;
// the chart wrapper uses mt-auto to stick to the bottom of the panel.

function ThroughputTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover min-w-[150px] rounded-lg border p-4 shadow-lg backdrop-blur-sm">
        <div className="text-popover-foreground border-border/50 mb-3.5 border-b pb-2 text-sm font-semibold">
          {label}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: "var(--color-violet-500)" }}
            />
            <span className="text-muted-foreground text-xs font-medium">
              Runs
            </span>
          </div>
          <span className="text-popover-foreground text-sm font-semibold">
            {payload[0].value.toLocaleString()}
          </span>
        </div>
      </div>
    )
  }
  return null
}

export function RunThroughputChart({ className }: { className?: string }) {
  const [period, setPeriod] = useState<ThroughputPeriodKey>("24H")
  const currentPeriod = THROUGHPUT_PERIODS[period]
  const total = useMemo(
    () => currentPeriod.data.reduce((sum, point) => sum + point.runs, 0),
    [currentPeriod]
  )

  return (
    <Frame spacing="sm" className={cn("w-full", className)}>
      <FrameHeader className="flex-row items-center justify-between gap-2">
        <FrameTitle>Run Throughput</FrameTitle>
        <Select
          value={period}
          onValueChange={(value) => setPeriod(value as ThroughputPeriodKey)}
          items={THROUGHPUT_RANGE_OPTIONS}
        >
          <SelectTrigger size="sm" className="w-fit min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            alignItemWithTrigger={false}
            className="w-40"
            align="end"
          >
            {THROUGHPUT_RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FrameHeader>

      <FramePanel className="flex grow flex-col">
        {/* Stat: total runs + trend */}
        <div className="flex flex-col gap-1">
          <div className="text-muted-foreground text-xs font-medium">
            Total ({currentPeriod.dateRange})
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl leading-none font-semibold tabular-nums">
              {total.toLocaleString()}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium [&_svg]:size-4",
                currentPeriod.positive ? "text-emerald-500" : "text-rose-500"
              )}
            >
              {currentPeriod.positive ? (
                <TrendingUp aria-hidden="true" />
              ) : (
                <TrendingDown aria-hidden="true" />
              )}
              {currentPeriod.delta}
            </span>
          </div>
        </div>

        {/* Chart sticks to the bottom of the panel */}
        <div className="mt-auto pt-4">
          <ChartContainer
            config={throughputChartConfig}
            className="h-[240px] w-full"
          >
            <ComposedChart
              accessibilityLayer
              data={currentPeriod.data}
              margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <defs>
                <linearGradient
                  id="throughputGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={throughputChartConfig.runs.color}
                    stopOpacity={0.15}
                  />
                  <stop
                    offset="100%"
                    stopColor={throughputChartConfig.runs.color}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="var(--border)"
              />
              <XAxis
                dataKey="bucket"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tick={{ fontSize: 12 }}
              />
              <YAxis hide />
              <ChartTooltip content={<ThroughputTooltip />} />
              <Area
                type="linear"
                dataKey="runs"
                fill="url(#throughputGradient)"
                stroke="transparent"
              />
              <Line
                type="linear"
                dataKey="runs"
                stroke={throughputChartConfig.runs.color}
                strokeWidth={3}
                dot={{
                  r: 4,
                  fill: "var(--background)",
                  stroke: throughputChartConfig.runs.color,
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill: throughputChartConfig.runs.color,
                  stroke: "white",
                  strokeWidth: 2,
                }}
              />
            </ComposedChart>
          </ChartContainer>
        </div>
      </FramePanel>
    </Frame>
  )
}