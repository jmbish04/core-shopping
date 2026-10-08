import { type ReactNode } from "react"
import { type BadgeProps } from "@/components/reui/badge"

import { type ChartConfig } from "@/components/ui/chart"
import { CircleCheckIcon, InfoIcon, TargetIcon, BellIcon, PencilIcon, UsersIcon } from "lucide-react"

// Aster Insights world pack. Each person keeps one portrait across the block;
// Iris Vale is the deliberate initials-only fallback.
const PEOPLE = {
  mira: {
    id: "mira-stone",
    name: "Mira Stone",
    role: "Product analytics lead",
    initials: "MS",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
  },
  leo: {
    id: "leo-grant",
    name: "Leo Grant",
    role: "Growth product manager",
    initials: "LG",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
  },
  nora: {
    id: "nora-vale",
    name: "Nora Vale",
    role: "Lifecycle analyst",
    initials: "NV",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
  },
  sana: {
    id: "sana-qureshi",
    name: "Sana Qureshi",
    role: "Data quality engineer",
    initials: "SQ",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&dpr=2&q=80",
  },
  iris: {
    id: "iris-vale",
    name: "Iris Vale",
    role: "Support insights owner",
    initials: "IV",
  },
} as const

export const VIEWER = PEOPLE.leo

export type MetricOwner = {
  id: string
  name: string
  role: string
  initials: string
  avatar?: string
}

// ── Toast feedback icons ─────────────────────────────────────────────────────
export const TOAST_SUCCESS_ICON = (
  <CircleCheckIcon className="size-[18px] text-green-600" aria-hidden="true" />
)

export const TOAST_INFO_ICON = (
  <InfoIcon className="text-muted-foreground size-[18px]" aria-hidden="true" />
)

// ── Metric identity ──────────────────────────────────────────────────────────
export type MetricHealth = "On track" | "At risk" | "Behind"

export const metricHealthVariant: Record<MetricHealth, BadgeProps["variant"]> =
  {
    "On track": "success-light",
    "At risk": "warning-light",
    Behind: "destructive-light",
  }

export const METRIC = {
  id: "MET-609",
  name: "Activation rate",
  health: "On track" as MetricHealth,
  current: "62.4%",
  target: "70%",
  window: "Last 28 days",
  activationEvent: "template_applied",
  segment: "Trial workspaces over 20 seats",
  owners: [PEOPLE.mira, PEOPLE.leo, PEOPLE.nora, PEOPLE.iris] as MetricOwner[],
  leadOwnerId: PEOPLE.mira.id,
}

// ── KPI rail (stats-1 grammar) ───────────────────────────────────────────────
export type Kpi = {
  title: string
  value: string
  deltaLabel: string
  up: boolean
  positive: boolean
  prior: string
}

export const KPIS: Kpi[] = [
  {
    title: "Activation rate",
    value: "62.4%",
    deltaLabel: "3.1 pts",
    up: true,
    positive: true,
    prior: "59.3% prior 28 days",
  },
  {
    title: "Activated workspaces",
    value: "801",
    deltaLabel: "128",
    up: true,
    positive: true,
    prior: "673 prior 28 days",
  },
  {
    title: "New workspaces",
    value: "1,284",
    deltaLabel: "9.2%",
    up: true,
    positive: true,
    prior: "1,176 prior 28 days",
  },
  {
    title: "Time to first value",
    value: "3.8 d",
    deltaLabel: "0.6 d",
    up: false,
    positive: true,
    prior: "4.4 d prior 28 days",
  },
]

// ── Trend (ui/chart + chart-20 grammar) ──────────────────────────────────────
export const TARGET_VALUE = 70

export const chartConfig = {
  rate: {
    label: "Activation rate",
    color: "var(--color-teal-500)",
  },
} satisfies ChartConfig

export type TrendPoint = { week: string; rate: number; rateArea: number }

// 12 weeks ending at the current 62.4%; the line tracks under the 70% target.
export const TREND: TrendPoint[] = [
  { week: "Mar 24", rate: 51.8, rateArea: 51.8 },
  { week: "Mar 31", rate: 53.0, rateArea: 53.0 },
  { week: "Apr 7", rate: 54.6, rateArea: 54.6 },
  { week: "Apr 14", rate: 55.1, rateArea: 55.1 },
  { week: "Apr 21", rate: 56.8, rateArea: 56.8 },
  { week: "Apr 28", rate: 57.4, rateArea: 57.4 },
  { week: "May 5", rate: 58.2, rateArea: 58.2 },
  { week: "May 12", rate: 59.3, rateArea: 59.3 },
  { week: "May 19", rate: 59.9, rateArea: 59.9 },
  { week: "May 26", rate: 60.8, rateArea: 60.8 },
  { week: "Jun 2", rate: 61.5, rateArea: 61.5 },
  { week: "Jun 9", rate: 62.4, rateArea: 62.4 },
]

export type PeriodValue = "4w" | "8w" | "12w"

export const PERIODS: { value: PeriodValue; label: string; weeks: number }[] = [
  { value: "4w", label: "Last 4 weeks", weeks: 4 },
  { value: "8w", label: "Last 8 weeks", weeks: 8 },
  { value: "12w", label: "Last 12 weeks", weeks: 12 },
]

// ── Cohort breakdown ─────────────────────────────────────────────────────────
export type Cohort = {
  id: string
  code: string
  name: string
  rate: number
  activated: number
  total: number
}

export const COHORTS: Cohort[] = [
  {
    id: "sales-assisted",
    code: "COH-075",
    name: "Sales assisted accounts",
    rate: 80,
    activated: 168,
    total: 210,
  },
  {
    id: "invite-driven",
    code: "COH-071",
    name: "Invite driven teams",
    rate: 71,
    activated: 312,
    total: 440,
  },
  {
    id: "self-serve",
    code: "COH-076",
    name: "Self serve signups",
    rate: 65,
    activated: 402,
    total: 620,
  },
  {
    id: "may-activation",
    code: "COH-072",
    name: "May activation cohort",
    rate: 64,
    activated: 288,
    total: 450,
  },
  {
    id: "q3-onboarding",
    code: "COH-073",
    name: "Q3 onboarding accounts",
    rate: 58,
    activated: 174,
    total: 300,
  },
  {
    id: "dormant-admins",
    code: "COH-074",
    name: "Dormant admins",
    rate: 25,
    activated: 47,
    total: 188,
  },
]

// ── Alert rule ───────────────────────────────────────────────────────────────
export type AlertRuleStatus = "Armed" | "Firing" | "Muted"

export const alertRuleStatusVariant: Record<
  AlertRuleStatus,
  BadgeProps["variant"]
> = {
  Armed: "success-light",
  Firing: "destructive-light",
  Muted: "secondary",
}

export const ALERT_RULE = {
  id: "ALR-516",
  name: "Activation drop",
  threshold: "Fires below 55%",
  window: "2 day window",
  status: "Armed" as AlertRuleStatus,
  owner: PEOPLE.sana,
}

// ── Recent changes (timeline-1 grammar) ──────────────────────────────────────
export type ActivityKind = "target" | "alert" | "definition" | "owner"

export const activityKindIcon: Record<ActivityKind, ReactNode> = {
  target: (
    <TargetIcon className="size-3.5" aria-hidden="true" />
  ),
  alert: (
    <BellIcon className="size-3.5" aria-hidden="true" />
  ),
  definition: (
    <PencilIcon className="size-3.5" aria-hidden="true" />
  ),
  owner: (
    <UsersIcon className="size-3.5" aria-hidden="true" />
  ),
}

export const activityKindIndicatorClass: Record<ActivityKind, string> = {
  target: "border-primary/20 bg-primary/10 text-primary dark:bg-primary/15",
  alert: "border-warning/20 bg-warning/10 text-warning dark:bg-warning/15",
  definition: "border-info/20 bg-info/10 text-info dark:bg-info/15",
  owner: "border-success/20 bg-success/10 text-success dark:bg-success/15",
}

export type MetricActivity = {
  id: string
  kind: ActivityKind
  title: string
  detail: string
  author: MetricOwner
  timeLabel: string
}

export const METRIC_ACTIVITY: MetricActivity[] = [
  {
    id: "act-1",
    kind: "target",
    title: "Target raised to 70%",
    detail: "Leo Grant lifted the goal from 65% after the Q3 onboarding push.",
    author: PEOPLE.leo,
    timeLabel: "2 days ago",
  },
  {
    id: "act-2",
    kind: "alert",
    title: "Alert threshold set to 55%",
    detail: "Sana Qureshi widened the activation drop guard to a 2 day window.",
    author: PEOPLE.sana,
    timeLabel: "Jun 9",
  },
  {
    id: "act-3",
    kind: "definition",
    title: "Definition updated",
    detail:
      "template_applied (EVT-1842) replaced first_report_viewed as the activation event.",
    author: PEOPLE.mira,
    timeLabel: "Jun 2",
  },
]