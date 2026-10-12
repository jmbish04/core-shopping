import type { ChartConfig } from "@/components/ui/chart"

// ── Types ──

export type PeriodKey = "30d" | "90d"

// ── Config ──

export const chartConfig = {
  sales: { label: "Sales", color: "var(--color-success)" },
  views: { label: "Views", color: "var(--color-warning)" },
} satisfies ChartConfig

export const PERIODS = {
  "30d": { key: "30d", label: "Last 30 days" },
  "90d": { key: "90d", label: "Last 90 days" },
} as const

// ── Data ──

export const salesViewsData: Record<
  string,
  { period: string; sales: number; views: number }[]
> = {
  "30d": [
    { period: "Week 1", sales: 5200, views: 4800 },
    { period: "Week 2", sales: 6400, views: 5200 },
    { period: "Week 3", sales: 5800, views: 4600 },
    { period: "Week 4", sales: 7200, views: 5800 },
    { period: "Week 5", sales: 6800, views: 5400 },
    { period: "Week 6", sales: 6200, views: 4900 },
  ],
  "90d": [
    { period: "Jan", sales: 22000, views: 18500 },
    { period: "Feb", sales: 24800, views: 20200 },
    { period: "Mar", sales: 21400, views: 17800 },
    { period: "Apr", sales: 26200, views: 21600 },
    { period: "May", sales: 25600, views: 20800 },
    { period: "Jun", sales: 27400, views: 22400 },
  ],
}