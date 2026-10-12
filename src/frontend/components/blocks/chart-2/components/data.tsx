import { type ReactNode } from "react"
import { type BadgeProps } from "@/components/reui/badge"

import { type ChartConfig } from "@/components/ui/chart"
import { TrendingUp, TrendingDown } from "lucide-react"

export interface MetricPoint {
  period: string
  value: number
}

export interface MetricCard {
  title: string
  valueBold: string
  valueFaint: string
  trendLabel: string
  badge: string
  badgeVariant: BadgeProps["variant"]
  badgeIcon?: ReactNode
  chartLabel: string
  chartConfig: ChartConfig
  data: MetricPoint[]
  formatValue: (value: number) => string
}

const formatCompact = (value: number) => value.toLocaleString()
const formatCurrency = (value: number) => `$${value.toLocaleString()}k`

export const METRIC_CARDS: MetricCard[] = [
  {
    title: "Total Orders",
    valueBold: "1,246",
    valueFaint: "",
    trendLabel: "Annual trend",
    badge: "23.08%",
    badgeVariant: "success-light",
    badgeIcon: (
      <TrendingUp aria-hidden="true" className="size-3.5" />
    ),
    chartLabel: "Orders",
    chartConfig: {
      value: {
        label: "Orders",
        color: "var(--muted-foreground)",
      },
    },
    data: [
      { period: "Mon", value: 1120 },
      { period: "Tue", value: 1120 },
      { period: "Wed", value: 1185 },
      { period: "Thu", value: 1246 },
      { period: "Fri", value: 1188 },
      { period: "Sat", value: 1188 },
      { period: "Sun", value: 1232 },
      { period: "Now", value: 1197 },
    ],
    formatValue: formatCompact,
  },
  {
    title: "Cumulative Spend",
    valueBold: "$89.3",
    valueFaint: "k",
    trendLabel: "Monthly trend",
    badge: "3.82%",
    badgeVariant: "success-light",
    badgeIcon: (
      <TrendingUp aria-hidden="true" className="size-3.5" />
    ),
    chartLabel: "Spend",
    chartConfig: {
      value: {
        label: "Spend",
        color: "var(--muted-foreground)",
      },
    },
    data: [
      { period: "Mon", value: 91.2 },
      { period: "Tue", value: 87.5 },
      { period: "Wed", value: 83.1 },
      { period: "Thu", value: 86.9 },
      { period: "Fri", value: 87.4 },
      { period: "Sat", value: 91.8 },
      { period: "Sun", value: 90.5 },
      { period: "Now", value: 92.3 },
    ],
    formatValue: formatCurrency,
  },
  {
    title: "Avg. Order Value",
    valueBold: "$68",
    valueFaint: "",
    trendLabel: "Weekly trend",
    badge: "0.39%",
    badgeVariant: "destructive-light",
    badgeIcon: (
      <TrendingDown aria-hidden="true" className="size-3.5" />
    ),
    chartLabel: "AOV",
    chartConfig: {
      value: {
        label: "AOV",
        color: "var(--muted-foreground)",
      },
    },
    data: [
      { period: "Mon", value: 72 },
      { period: "Tue", value: 72 },
      { period: "Wed", value: 68 },
      { period: "Thu", value: 68 },
      { period: "Fri", value: 70 },
      { period: "Sat", value: 66 },
      { period: "Sun", value: 68 },
      { period: "Now", value: 65 },
    ],
    formatValue: formatCompact,
  },
  {
    title: "Account Balance",
    valueBold: "$2.3",
    valueFaint: "k",
    trendLabel: "Daily trend",
    badge: "1.04%",
    badgeVariant: "success-light",
    badgeIcon: (
      <TrendingUp aria-hidden="true" className="size-3.5" />
    ),
    chartLabel: "Balance",
    chartConfig: {
      value: {
        label: "Balance",
        color: "var(--muted-foreground)",
      },
    },
    data: [
      { period: "Mon", value: 2.1 },
      { period: "Tue", value: 1.9 },
      { period: "Wed", value: 1.8 },
      { period: "Thu", value: 1.8 },
      { period: "Fri", value: 2.0 },
      { period: "Sat", value: 2.3 },
      { period: "Sun", value: 2.2 },
      { period: "Now", value: 2.3 },
    ],
    formatValue: formatCurrency,
  },
]