"use client"

import { useState } from "react"
import { Frame, FramePanel } from "@/components/reui/frame"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { chartConfig, rangeOptions, socialMediaData } from "./data"
import type { PeriodKey } from "./data"

// ── Custom tooltip ──

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean
  payload?: {
    dataKey: string
    color: string
    value: number
    payload: unknown
  }[]
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="min-w-[120px] space-y-1.5 rounded-lg bg-zinc-900 p-3 text-white shadow-lg">
        {payload.map((item) => (
          <div key={item.dataKey}>
            <div className="text-[10px] font-medium tracking-wider uppercase opacity-70">
              {item.dataKey}:
            </div>
            <div className="text-sm font-semibold">
              {item.value.toLocaleString()}%
            </div>
          </div>
        ))}
      </div>
    )
  }
  return null
}

// ── Chart legend helper ──

const ChartLegendItem = ({
  label,
  color,
}: {
  label: string
  color: string
}) => (
  <div className="flex items-center gap-2">
    <div className="size-2 rounded-full" style={{ backgroundColor: color }} />
    <span className="text-muted-foreground text-xs font-medium">{label}</span>
  </div>
)

export function Chart() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("24h")
  const currentData = socialMediaData[selectedPeriod]

  return (
    <Frame className="w-full max-w-2xl">
      {/* Content */}
      <FramePanel className="space-y-8">
        <div className="flex items-center justify-between gap-2 p-2">
          <h3 className="text-base font-semibold">Social Media Activity</h3>
          <Select
            value={selectedPeriod}
            onValueChange={(value) => setSelectedPeriod(value as PeriodKey)}
            items={rangeOptions}
          >
            <SelectTrigger className="w-fit min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="w-40"
              align="start"
            >
              {rangeOptions.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-6">
          <ChartContainer
            config={chartConfig}
            className="-ms-4 h-[300px] w-full"
          >
            <LineChart
              data={currentData}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="4 8"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                tickMargin={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  selectedPeriod === "24h" ? `${v}%` : String(v)
                }
                tickMargin={10}
              />
              <ChartTooltip content={<CustomTooltip />} />
              <Line
                dataKey="facebook"
                type="monotone"
                stroke="var(--color-blue-600)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                dataKey="instagram"
                type="monotone"
                stroke="var(--color-orange-500)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                dataKey="linkedin"
                type="monotone"
                stroke="var(--color-slate-600)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>

          <div className="mb-2.5 flex items-center justify-center gap-6">
            <ChartLegendItem
              label="Facebook"
              color={chartConfig.facebook.color}
            />
            <ChartLegendItem
              label="Instagram"
              color={chartConfig.instagram.color}
            />
            <ChartLegendItem
              label="LinkedIn"
              color={chartConfig.linkedin.color}
            />
          </div>
        </div>
      </FramePanel>
    </Frame>
  )
}