import { type ReactNode } from "react"

import { type ChartConfig } from "@/components/ui/chart"
import { CircleCheckIcon, InfoIcon, ZapIcon, UserCheckIcon, WrenchIcon, TriangleAlertIcon, RotateCcwIcon, DatabaseIcon } from "lucide-react"

// ── Toast feedback icons ──
// Success toasts use a green check; info toasts use a muted icon. A destructive
// toast would use the same alert glyph with text-destructive.

export const TOAST_SUCCESS_ICON = (
  <CircleCheckIcon className="size-[18px] text-green-600" aria-hidden="true" />
)

export const TOAST_INFO_ICON = (
  <InfoIcon className="text-muted-foreground size-[18px]" aria-hidden="true" />
)

// ── Run status ──────────────────────────────────────────────────────────────

export type RunStatus =
  | "running"
  | "completed"
  | "failed"
  | "waiting"
  | "queued"

export const RUN_STATUS_ORDER: RunStatus[] = [
  "running",
  "waiting",
  "queued",
  "failed",
  "completed",
]

// Status dot tone, mirrored from data-grid-5 StatusBadge grammar.
export const runStatusToneClass: Record<RunStatus, string> = {
  running: "bg-sky-500",
  completed: "bg-emerald-500",
  failed: "bg-rose-500",
  waiting: "bg-amber-500",
  queued: "bg-zinc-400",
}

export const runStatusLabel: Record<RunStatus, string> = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  waiting: "Waiting",
  queued: "Queued",
}

// ── Summary cards (reused verbatim from application/card/card-3) ──────────────
// Re-declares card-3's ICard shape: colored icon box (iconBg) + title link +
// description. Each description carries a concrete agent-ops stat.

export interface ICard {
  title: string
  description: string
  icon: ReactNode
  iconBg: string
}

export const SUMMARY_CARDS: ICard[] = [
  {
    title: "Autonomous Runs",
    description: "1,284 runs, 96% clean",
    icon: (
      <ZapIcon aria-hidden="true" />
    ),
    iconBg: "bg-indigo-600",
  },
  {
    title: "Approval Backlog",
    description: "12 pending, oldest 38m",
    icon: (
      <UserCheckIcon aria-hidden="true" />
    ),
    iconBg: "bg-amber-600",
  },
  {
    title: "Tool Reliability",
    description: "96.2% of calls succeeded",
    icon: (
      <WrenchIcon aria-hidden="true" />
    ),
    iconBg: "bg-emerald-600",
  },
  {
    title: "Open Incidents",
    description: "1 active, 2 resolved today",
    icon: (
      <TriangleAlertIcon aria-hidden="true" />
    ),
    iconBg: "bg-rose-600",
  },
]

// ── Run throughput chart (reused from application/chart/chart-21) ──────────────
// Re-declares chart-21's shape: a single value series feeding a ComposedChart
// (faint Area + Line with dots), a period Select in the FrameHeader, and a
// total-with-trend stat above the chart. Adapted to agent run throughput,
// period-keyed (12H / 24H / 7D / 30D), each period carrying its own series.

export const throughputChartConfig = {
  runs: {
    label: "Runs",
    color: "var(--color-violet-500)",
  },
} satisfies ChartConfig

export type ThroughputPeriodKey = "12H" | "24H" | "7D" | "30D"

export interface IThroughputPoint {
  bucket: string
  runs: number
}

export interface IThroughputPeriod {
  key: ThroughputPeriodKey
  label: string
  dateRange: string
  delta: string
  positive: boolean
  data: IThroughputPoint[]
}

export const THROUGHPUT_PERIODS: Record<
  ThroughputPeriodKey,
  IThroughputPeriod
> = {
  "12H": {
    key: "12H",
    label: "Last 12 hours",
    dateRange: "Last 12 hours",
    delta: "+8.2%",
    positive: true,
    data: [
      { bucket: "00:00", runs: 74 },
      { bucket: "02:00", runs: 61 },
      { bucket: "04:00", runs: 48 },
      { bucket: "06:00", runs: 69 },
      { bucket: "08:00", runs: 116 },
      { bucket: "10:00", runs: 154 },
      { bucket: "12:00", runs: 166 },
      { bucket: "14:00", runs: 161 },
    ],
  },
  "24H": {
    key: "24H",
    label: "Last 24 hours",
    dateRange: "Last 24 hours",
    delta: "+12.4%",
    positive: true,
    data: [
      { bucket: "00:00", runs: 142 },
      { bucket: "04:00", runs: 96 },
      { bucket: "08:00", runs: 228 },
      { bucket: "12:00", runs: 312 },
      { bucket: "16:00", runs: 287 },
      { bucket: "20:00", runs: 198 },
    ],
  },
  "7D": {
    key: "7D",
    label: "Last 7 days",
    dateRange: "Last 7 days",
    delta: "+6.1%",
    positive: true,
    data: [
      { bucket: "Mon", runs: 1180 },
      { bucket: "Tue", runs: 1442 },
      { bucket: "Wed", runs: 1356 },
      { bucket: "Thu", runs: 1607 },
      { bucket: "Fri", runs: 1894 },
      { bucket: "Sat", runs: 1123 },
      { bucket: "Sun", runs: 987 },
    ],
  },
  "30D": {
    key: "30D",
    label: "Last 30 days",
    dateRange: "Last 30 days",
    delta: "-2.3%",
    positive: false,
    data: [
      { bucket: "W1", runs: 7245 },
      { bucket: "W2", runs: 8187 },
      { bucket: "W3", runs: 7654 },
      { bucket: "W4", runs: 9892 },
    ],
  },
}

export const THROUGHPUT_RANGE_OPTIONS: {
  value: ThroughputPeriodKey
  label: string
}[] = [
  { value: "12H", label: "Last 12 hours" },
  { value: "24H", label: "Last 24 hours" },
  { value: "7D", label: "Last 7 days" },
  { value: "30D", label: "Last 30 days" },
]

// ── Incident timeline (reused from application/timeline/timeline-1) ────────────

export type IncidentStatus = "completed" | "active" | "pending"

export interface IIncidentEvent {
  id: number
  title: string
  meta: string
  description: string
  status: IncidentStatus
  severity: "Critical" | "Major" | "Minor"
  icon: ReactNode
}

export const INCIDENT_EVENTS: IIncidentEvent[] = [
  {
    id: 1,
    title: "Payment Tool Timeout",
    meta: "Refund Resolver / 09:12",
    description:
      "The billing API exceeded its 8s budget on 6 consecutive calls, holding 4 runs at the charge step.",
    status: "active",
    severity: "Critical",
    icon: (
      <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
    ),
  },
  {
    id: 2,
    title: "Retry Storm Contained",
    meta: "Invoice Reconciler / 08:47",
    description:
      "Backoff was applied after a vendor 503 spike, capping retries and clearing the queued run backlog.",
    status: "completed",
    severity: "Major",
    icon: (
      <RotateCcwIcon className="size-3.5" aria-hidden="true" />
    ),
  },
  {
    id: 3,
    title: "Vector Store Degraded",
    meta: "Lead Enricher / 08:05",
    description:
      "Read latency on the embeddings index rose to 1.9s, slowing enrichment lookups before it recovered.",
    status: "completed",
    severity: "Minor",
    icon: (
      <DatabaseIcon className="size-3.5" aria-hidden="true" />
    ),
  },
]

export const incidentSeverityDotClass: Record<
  IIncidentEvent["severity"],
  string
> = {
  Critical: "bg-rose-500",
  Major: "bg-amber-500",
  Minor: "bg-sky-500",
}

// ── Run queue ────────────────────────────────────────────────────────────────

export type RunEnvironment = "Production" | "Staging" | "Sandbox"

export interface IRun {
  id: string
  agent: string
  runKey: string
  status: RunStatus
  statusOrder: number
  environment: RunEnvironment
  latencyMs: number
  latencyLabel: string
  startedLabel: string
}

export const RUNS: IRun[] = [
  {
    id: "run-1",
    agent: "Refund Resolver",
    runKey: "RUN-4821",
    status: "running",
    statusOrder: RUN_STATUS_ORDER.indexOf("running"),
    environment: "Production",
    latencyMs: 1840,
    latencyLabel: "1.84s",
    startedLabel: "2 min ago",
  },
  {
    id: "run-2",
    agent: "Invoice Reconciler",
    runKey: "RUN-4820",
    status: "waiting",
    statusOrder: RUN_STATUS_ORDER.indexOf("waiting"),
    environment: "Production",
    latencyMs: 3120,
    latencyLabel: "3.12s",
    startedLabel: "6 min ago",
  },
  {
    id: "run-3",
    agent: "Lead Enricher",
    runKey: "RUN-4817",
    status: "failed",
    statusOrder: RUN_STATUS_ORDER.indexOf("failed"),
    environment: "Staging",
    latencyMs: 5460,
    latencyLabel: "5.46s",
    startedLabel: "11 min ago",
  },
  {
    id: "run-4",
    agent: "Contract Summarizer",
    runKey: "RUN-4815",
    status: "completed",
    statusOrder: RUN_STATUS_ORDER.indexOf("completed"),
    environment: "Production",
    latencyMs: 2210,
    latencyLabel: "2.21s",
    startedLabel: "18 min ago",
  },
  {
    id: "run-5",
    agent: "Ticket Triager",
    runKey: "RUN-4812",
    status: "queued",
    statusOrder: RUN_STATUS_ORDER.indexOf("queued"),
    environment: "Sandbox",
    latencyMs: 0,
    latencyLabel: "Queued",
    startedLabel: "Not started",
  },
  {
    id: "run-6",
    agent: "Churn Predictor",
    runKey: "RUN-4809",
    status: "completed",
    statusOrder: RUN_STATUS_ORDER.indexOf("completed"),
    environment: "Staging",
    latencyMs: 1530,
    latencyLabel: "1.53s",
    startedLabel: "27 min ago",
  },
  {
    id: "run-7",
    agent: "Onboarding Guide",
    runKey: "RUN-4804",
    status: "running",
    statusOrder: RUN_STATUS_ORDER.indexOf("running"),
    environment: "Production",
    latencyMs: 2680,
    latencyLabel: "2.68s",
    startedLabel: "33 min ago",
  },
  {
    id: "run-8",
    agent: "Fraud Screener",
    runKey: "RUN-4798",
    status: "failed",
    statusOrder: RUN_STATUS_ORDER.indexOf("failed"),
    environment: "Production",
    latencyMs: 6920,
    latencyLabel: "6.92s",
    startedLabel: "41 min ago",
  },
]

// ── Toolbar options ──────────────────────────────────────────────────────────

export interface IOption {
  value: string
  label: string
}

export const RANGE_OPTIONS: IOption[] = [
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
]

export const STATUS_FILTER_OPTIONS: IOption[] = [
  { value: "all", label: "All Statuses" },
  { value: "running", label: "Running" },
  { value: "waiting", label: "Waiting" },
  { value: "queued", label: "Queued" },
  { value: "failed", label: "Failed" },
  { value: "completed", label: "Completed" },
]