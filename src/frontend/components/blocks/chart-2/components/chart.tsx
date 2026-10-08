import { Badge } from "@/components/reui/badge"
import { Frame, FramePanel } from "@/components/reui/frame"
import { cn } from "@/lib/utils"
import { Line, LineChart, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip } from "@/components/ui/chart"

import { METRIC_CARDS, type MetricCard } from "./data"

type TooltipPayload = {
  dataKey?: string
  value?: number | string
}[]

function MetricTooltip({
  active,
  payload,
  label,
  card,
}: {
  active?: boolean
  payload?: TooltipPayload
  label?: string
  card: MetricCard
}) {
  if (!active || !payload?.length) {
    return null
  }

  const current = payload.find((entry) => entry.dataKey === "value")
  const currentValue = Number(current?.value ?? 0)

  return (
    <div className="bg-popover w-[108px] rounded-lg border px-2 py-1.5 shadow-sm">
      <div className="text-muted-foreground mb-1 text-[10px] leading-none font-medium tracking-wide uppercase">
        {label}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] leading-none">
        <span className="text-muted-foreground">{card.chartLabel}</span>
        <span className="text-popover-foreground font-semibold tabular-nums">
          {card.formatValue(currentValue)}
        </span>
      </div>
    </div>
  )
}

function MetricMiniChart({ card }: { card: MetricCard }) {
  return (
    <ChartContainer
      config={card.chartConfig}
      className="absolute top-5 right-4 z-10 aspect-auto h-8 w-[76px]"
      initialDimension={{ width: 76, height: 32 }}
    >
      <LineChart
        accessibilityLayer
        data={card.data}
        margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
      >
        <XAxis dataKey="period" hide />
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <ChartTooltip
          allowEscapeViewBox={{ x: true, y: true }}
          content={<MetricTooltip card={card} />}
          cursor={false}
          position={{ x: -70, y: 32 }}
          wrapperStyle={{ zIndex: 30 }}
        />
        <Line
          type="linear"
          dataKey="value"
          stroke="var(--color-value)"
          strokeWidth={2}
          strokeOpacity={0.45}
          dot={false}
          activeDot={{
            r: 2.5,
            fill: "var(--background)",
            stroke: "var(--color-value)",
            strokeWidth: 1.5,
          }}
        />
      </LineChart>
    </ChartContainer>
  )
}

function MetricCardItem({
  card,
  index,
  total,
}: {
  card: MetricCard
  index: number
  total: number
}) {
  const isLast = index === total - 1
  const isEvenColumn = index % 2 === 1
  const isInTopTabletRow = index < total - 2

  return (
    <div
      className={cn(
        "border-border/60 relative min-h-[102px] overflow-hidden p-4",
        !isLast && "border-b",
        !isEvenColumn && "md:border-r",
        isInTopTabletRow ? "md:border-b" : "md:border-b-0",
        index < total - 1 ? "@4xl:border-r" : "@4xl:border-r-0",
        "@4xl:border-b-0"
      )}
    >
      <MetricMiniChart card={card} />

      <div className="flex min-h-[70px] flex-col justify-between gap-5">
        <div className="flex flex-col gap-0.5 pr-24">
          <div className="text-xl font-semibold">
            {card.valueBold}
            <span className="text-muted-foreground/40 ps-0.5">
              {card.valueFaint}
            </span>
          </div>
          <h3 className="text-muted-foreground text-xs leading-none">
            {card.title}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <Badge size="sm" variant={card.badgeVariant} className="border-0">
            {card.badgeIcon != null && card.badgeIcon}
            <span>{card.badge}</span>
          </Badge>
          <span className="text-muted-foreground text-xs">
            {card.trendLabel}
          </span>
        </div>
      </div>
    </div>
  )
}

export function Chart() {
  return (
    <div className="@container w-full">
      <Frame className="w-full">
        <FramePanel className="p-0!">
          <div className="grid overflow-hidden @2xl:grid-cols-2 @4xl:grid-cols-4">
            {METRIC_CARDS.map((card, index) => (
              <MetricCardItem
                key={card.title}
                card={card}
                index={index}
                total={METRIC_CARDS.length}
              />
            ))}
          </div>
        </FramePanel>
      </Frame>
    </div>
  )
}