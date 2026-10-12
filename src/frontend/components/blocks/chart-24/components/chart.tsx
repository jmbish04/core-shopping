"use client"

import { useState } from "react"
import { Badge } from "@/components/reui/badge"
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

import { PERIODS, salesViewsData } from "./data"
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
              {item.dataKey === "sales" ? "£" : ""}
              {item.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function Chart() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("30d")
  const currentData = salesViewsData[selectedPeriod] || []
  const totalSales = currentData.reduce((sum, item) => sum + item.sales, 0)
  const totalViews = currentData.reduce((sum, item) => sum + item.views, 0)

  const rangeOptions = Object.values(PERIODS).map((p) => ({
    label: p.label,
    value: p.key,
  }))

  return (
    <Frame className="w-full max-w-3xl">
      {/* Content */}
      <FramePanel className="space-y-8">
        <div className="flex items-center justify-between gap-2 p-2">
          <h3 className="text-base font-semibold">E-commerce Sales</h3>
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
          <div className="flex flex-wrap items-center gap-10 px-2.5">
            <div className="flex items-center gap-3">
              <div className="bg-success size-2 rounded-full" />
              <div>
                <div className="text-muted-foreground text-xs tracking-wide uppercase">
                  Sales
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">
                    £{totalSales.toLocaleString()}
                  </span>
                  <Badge variant="success-light">+8%</Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-warning size-2 rounded-full" />
              <div>
                <div className="text-muted-foreground text-xs tracking-wide uppercase">
                  Views
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">
                    {totalViews.toLocaleString()}
                  </span>
                  <Badge variant="warning-light">+5%</Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ChartContainer
              config={{
                sales: { label: "Sales", color: "var(--color-success)" },
                views: { label: "Views", color: "var(--color-warning)" },
              }}
              className="h-full w-full"
            >
              <LineChart
                data={currentData}
                margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="4 12"
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="period"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11 }}
                  tickMargin={10}
                  interval={0}
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis yAxisId="sales" orientation="left" hide />
                <YAxis yAxisId="views" orientation="right" hide />
                <ChartTooltip content={<CustomTooltip />} />
                <Line
                  yAxisId="sales"
                  dataKey="sales"
                  stroke="var(--color-success)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="views"
                  dataKey="views"
                  stroke="var(--color-warning)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </div>
        </div>
      </FramePanel>
    </Frame>
  )
}