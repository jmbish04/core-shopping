import { type ReactNode } from "react"
import { type BadgeProps } from "@/components/reui/badge"
import { TargetIcon, BellIcon, PencilIcon, UsersIcon } from "lucide-react"

// Aster Insights world pack. Each person keeps one portrait across the block so
// the owner avatars and activity authors stay one identity (Iris Vale is the
// deliberate initials-only fallback).
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

// ── Metric health ────────────────────────────────────────────────────────────
export type MetricHealth = "On track" | "At risk" | "Behind"

export const metricHealthVariant: Record<MetricHealth, BadgeProps["variant"]> =
  {
    "On track": "success-light",
    "At risk": "warning-light",
    Behind: "destructive-light",
  }

// ── Definition facts ─────────────────────────────────────────────────────────
export type MetricFact = {
  label: string
  value: string
  mono?: boolean
}

// ── Owners ───────────────────────────────────────────────────────────────────
export type MetricOwner = {
  id: string
  name: string
  role: string
  initials: string
  avatar?: string
}

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

export type AlertRule = {
  id: string
  name: string
  threshold: string
  window: string
  status: AlertRuleStatus
  owner: MetricOwner
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
  detail?: string
  author: MetricOwner
  timeLabel: string
}

// ── The metric on the drawer ─────────────────────────────────────────────────
export type MetricDetail = {
  id: string
  name: string
  health: MetricHealth
  current: string
  target: string
  progress: number
  delta: string
  prior: string
  sampleLine: string
  facts: MetricFact[]
  readout: MetricFact[]
  owners: MetricOwner[]
  leadOwnerId: string
  alertRule: AlertRule
}

export const METRIC: MetricDetail = {
  id: "MET-609",
  name: "Activation rate",
  health: "On track",
  current: "62.4%",
  target: "70%",
  progress: 89,
  delta: "+3.1 pts",
  prior: "vs 59.3% prior 28 days",
  sampleLine: "801 of 1,284 new workspaces activated",
  facts: [
    { label: "Activation event", value: "template_applied", mono: true },
    { label: "Source feature", value: "Template gallery (FEA-118)" },
    { label: "Segment", value: "Trial workspaces over 20 seats" },
    { label: "Window", value: "Last 28 days" },
    { label: "Definition", value: "activated / new workspaces", mono: true },
    { label: "Refreshed", value: "Hourly · 2h ago" },
  ],
  readout: [
    { label: "Decision", value: "Keep rollout at 50%" },
    { label: "Next review", value: "Jun 18, 9:00 AM" },
    { label: "Guardrail", value: "+1.6% ticket volume" },
    { label: "Export", value: "Ready for June report" },
  ],
  owners: [PEOPLE.mira, PEOPLE.leo, PEOPLE.nora, PEOPLE.iris],
  leadOwnerId: PEOPLE.mira.id,
  alertRule: {
    id: "ALR-516",
    name: "Activation drop",
    threshold: "Fires below 55%",
    window: "2 day window",
    status: "Armed",
    owner: PEOPLE.sana,
  },
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
  {
    id: "act-4",
    kind: "owner",
    title: "Nora Vale added as owner",
    detail: "Lifecycle analyst joined the week four retention review.",
    author: PEOPLE.nora,
    timeLabel: "May 28",
  },
]