"use client"

import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
  ALERT_RULE,
  TREND,
  alertRuleStatusVariant,
  chartConfig,
  PERIODS,
  type PeriodValue,
} from "./data"
import { BellIcon } from "lucide-react"

// Trend tooltip: the compact popover card grammar from the chart donors,
// showing the week and the activation rate for the hovered point.
function TrendTooltip({
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
      <div className="bg-popover min-w-[140px] rounded-lg border p-3 shadow-sm">
        <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          {label}
        </div>
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: chartConfig.rate.color }}
            />
            <span className="text-muted-foreground">Activation rate</span>
          </span>
          <span className="text-popover-foreground font-semibold tabular-nums">
            {payload[0].value}%
          </span>
        </div>
      </div>
    )
  }
  return null
}

// Signature surface: the metric trend built from the ui/chart composition
// (ChartContainer + ComposedChart) using application/chart/chart-20 grammar
// (area gradient, metric line with dots, a dashed target ReferenceLine), wrapped
// in a Frame to keep the page's container family. The attached alert rule sits
// in the FrameFooter as the metric's guard rail.
export function MetricTrendChart({ period }: { period: PeriodValue }) {
  const weeks = PERIODS.find((option) => option.value === period)?.weeks ?? 12
  const data = TREND.slice(-weeks)

  return (
    <Frame className="h-full">
      <FrameHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <FrameTitle>Activation Rate Trend</FrameTitle>
          <FrameDescription>Weekly rate tracked against target</FrameDescription>
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-0.5">
          <span className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: chartConfig.rate.color }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground text-xs">Activation rate</span>
          </span>
        </div>
      </FrameHeader>

      <FramePanel className="flex grow flex-col">
        <div className="mt-auto">
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ComposedChart
              accessibilityLayer
              data={data}
              margin={{ top: 10, right: 12, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={chartConfig.rate.color}
                    stopOpacity={0.18}
                  />
                  <stop
                    offset="100%"
                    stopColor={chartConfig.rate.color}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="4 4"
                stroke="var(--border)"
              />
              <XAxis
                dataKey="week"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                tickMargin={12}
              />
              <YAxis
                domain={[40, 80]}
                ticks={[40, 50, 60, 70, 80]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `${value}%`}
                tickMargin={8}
                width={36}
              />
              <ChartTooltip content={<TrendTooltip />} />
              <Area
                type="monotone"
                dataKey="rateArea"
                fill="url(#rateGradient)"
                stroke="transparent"
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke={chartConfig.rate.color}
                strokeWidth={2}
                dot={{
                  r: 3,
                  fill: "var(--background)",
                  stroke: chartConfig.rate.color,
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 5,
                  fill: chartConfig.rate.color,
                  stroke: "var(--background)",
                  strokeWidth: 2,
                }}
              />
            </ComposedChart>
          </ChartContainer>
        </div>
      </FramePanel>

      {/* Guard rail: the alert rule attached to this metric */}
      <FrameFooter className="flex-row flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="text-warning grid size-5 shrink-0 place-items-center [&_svg]:size-4">
          <BellIcon aria-hidden="true" />
        </span>
        <span className="text-foreground text-sm font-medium">
          {ALERT_RULE.name}
        </span>
        <Badge variant={alertRuleStatusVariant[ALERT_RULE.status]}>
          {ALERT_RULE.status}
        </Badge>
        <span className="text-muted-foreground inline-flex flex-wrap items-center gap-x-1.5 text-xs">
          <span>{ALERT_RULE.threshold}</span>
          <span
            className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
            aria-hidden="true"
          />
          <span>{ALERT_RULE.window}</span>
        </span>
        <span className="text-muted-foreground ms-auto flex items-center gap-1.5 text-xs">
          <Avatar className="size-5">
            {ALERT_RULE.owner.avatar ? (
              <AvatarImage
                src={ALERT_RULE.owner.avatar}
                alt={ALERT_RULE.owner.name}
              />
            ) : null}
            <AvatarFallback className="text-[9px]">
              {ALERT_RULE.owner.initials}
            </AvatarFallback>
          </Avatar>
          {ALERT_RULE.owner.name}
        </span>
      </FrameFooter>
    </Frame>
  )
}