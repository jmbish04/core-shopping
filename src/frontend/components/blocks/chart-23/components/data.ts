import type { ChartConfig } from "@/components/ui/chart"

// ── Types ──

export type PeriodKey = "24h" | "7d" | "30d"

// ── Config ──

export const chartConfig = {
  facebook: { label: "Facebook", color: "var(--color-blue-600)" },
  instagram: { label: "Instagram", color: "var(--color-orange-500)" },
  linkedin: { label: "LinkedIn", color: "var(--color-slate-600)" },
} satisfies ChartConfig

export const rangeOptions = [
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
]

// ── Data ──

export const socialMediaData: Record<
  string,
  { time: string; facebook: number; instagram: number; linkedin: number }[]
> = {
  "24h": [
    { time: "6AM", facebook: 2, instagram: 8, linkedin: 5 },
    { time: "9AM", facebook: 12, instagram: 25, linkedin: 22 },
    { time: "12PM", facebook: 22, instagram: 38, linkedin: 35 },
    { time: "3PM", facebook: 30, instagram: 52, linkedin: 38 },
    { time: "6PM", facebook: 22, instagram: 40, linkedin: 28 },
    { time: "9PM", facebook: 15, instagram: 30, linkedin: 18 },
  ],
  "7d": [
    { time: "Mon", facebook: 15, instagram: 25, linkedin: 18 },
    { time: "Tue", facebook: 22, instagram: 35, linkedin: 28 },
    { time: "Wed", facebook: 18, instagram: 30, linkedin: 22 },
    { time: "Thu", facebook: 25, instagram: 45, linkedin: 35 },
    { time: "Fri", facebook: 28, instagram: 52, linkedin: 38 },
    { time: "Sat", facebook: 20, instagram: 38, linkedin: 25 },
    { time: "Sun", facebook: 12, instagram: 25, linkedin: 15 },
  ],
  "30d": [
    { time: "W1", facebook: 115, instagram: 185, linkedin: 145 },
    { time: "W2", facebook: 142, instagram: 210, linkedin: 168 },
    { time: "W3", facebook: 128, instagram: 195, linkedin: 152 },
    { time: "W4", facebook: 155, instagram: 235, linkedin: 188 },
  ],
}