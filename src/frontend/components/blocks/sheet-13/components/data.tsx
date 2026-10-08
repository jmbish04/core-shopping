import { type ReactNode } from "react"
import { BanknoteIcon, DatabaseIcon, WebhookIcon, ShieldCheckIcon, WalletIcon, ListChecksIcon, SearchIcon, BellIcon } from "lucide-react"

// ── Reference time ──

// customize: the demo's "now"; every label and number hangs off it.
export const REFERENCE_ISO = "2026-09-29T14:20:00Z"
export const REFERENCE_MS = Date.parse(REFERENCE_ISO)

// customize: the workspace that the copy names.
export const WORKSPACE_NAME = "Harbor Ops"

const MINUTE_MS = 60_000

// ── Types ──

export type Environment = "production" | "staging" | "sandbox"
export type Cluster = "prod-us-east-1" | "prod-eu-west-1" | "staging-us-east-1"
export type ServiceId =
  | "payments-api"
  | "ledger-worker"
  | "webhook-dispatcher"
  | "fraud-scorer"
  | "payouts-scheduler"
  | "reconciliation"
  | "search-indexer"
  | "notifications"
export type Team = "Platform" | "Payments" | "Risk" | "Data" | "SRE"
export type PersonId =
  | "nina"
  | "omar"
  | "sarah"
  | "david"
  | "sofia"
  | "kenji"
  | "emma"
  | "michael"
  | "priya"
  | "alex"
export type TimezoneId = "UTC" | "America/New_York" | "Europe/Dublin"
export type ConcurrencyPolicy = "Allow" | "Forbid" | "Replace"
export type RunStatus =
  "succeeded" | "failed" | "timedOut" | "skipped" | "running"
export type RunTrigger = "scheduled" | "manual" | "retry"
export type FailureKind = "exit" | "timeout"

export type Person = {
  id: PersonId
  name: string
  role: string
  team: Team
  avatar: string
  initials: string
}

export type JobRun = {
  id: string
  status: RunStatus
  trigger: RunTrigger
  triggeredBy: PersonId | "scheduler"
  startedAt: number
  durationSec: number
  attempt: number
  maxAttempts: number
  exitCode: number | null
}

export type JobFailure = {
  kind: FailureKind
  exitCode: number | null
  label: string
  reason: string
  persistent: boolean
}

export type CronJob = {
  id: string
  name: string
  command: string
  schedule: string
  timezone: TimezoneId
  enabled: boolean
  service: ServiceId
  cluster: Cluster
  environment: Environment
  ownerId: PersonId
  concurrency: ConcurrencyPolicy
  timeoutMin: number
  retries: number
  notifyOnFailure: boolean
  baseDurationSec: number
  failure?: JobFailure
  pausedAt?: number
  pausedBy?: PersonId
  pauseNote?: string
  skipFireAt?: number
  runs: JobRun[]
}

export type JobDraft = Pick<
  CronJob,
  | "name"
  | "command"
  | "schedule"
  | "timezone"
  | "service"
  | "cluster"
  | "environment"
  | "ownerId"
  | "concurrency"
  | "timeoutMin"
  | "retries"
  | "notifyOnFailure"
  | "enabled"
>

// ── World ──

export const CURRENT_USER_ID: PersonId = "nina"

export const PEOPLE: Person[] = [
  {
    id: "nina",
    name: "Nina Santos",
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=96&h=96&dpr=2&q=80",
    role: "Staff SRE",
    team: "SRE",
    initials: "NS",
  },
  {
    id: "omar",
    name: "Omar Haddad",
    avatar:
      "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=96&h=96&dpr=2&q=80",
    role: "Platform lead",
    team: "Platform",
    initials: "OH",
  },
  {
    id: "sarah",
    name: "Sarah Chen",
    avatar:
      "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
    role: "Security and compliance lead",
    team: "Platform",
    initials: "SC",
  },
  {
    id: "david",
    name: "David Kim",
    avatar:
      "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
    role: "Payments engineer",
    team: "Payments",
    initials: "DK",
  },
  {
    id: "sofia",
    name: "Sofia Romero",
    avatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=96&h=96&dpr=2&q=80",
    role: "Data engineer",
    team: "Data",
    initials: "SR",
  },
  {
    id: "kenji",
    name: "Kenji Tan",
    avatar:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=96&h=96&dpr=2&q=80",
    role: "Risk engineer",
    team: "Risk",
    initials: "KT",
  },
  {
    id: "emma",
    name: "Emma Wilson",
    avatar:
      "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
    role: "Release manager",
    team: "Platform",
    initials: "EW",
  },
  {
    id: "michael",
    name: "Michael Rodriguez",
    avatar:
      "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
    role: "Infrastructure engineer",
    team: "SRE",
    initials: "MR",
  },
  {
    id: "priya",
    name: "Priya Patel",
    avatar:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=96&h=96&dpr=2&q=80",
    role: "Payments engineering manager",
    team: "Payments",
    initials: "PP",
  },
  {
    id: "alex",
    name: "Alex Johnson",
    avatar:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
    role: "Database reliability engineer",
    team: "SRE",
    initials: "AJ",
  },
]

export const PERSON_BY_ID = new Map<PersonId, Person>(
  PEOPLE.map((person) => [person.id, person])
)

export const PERSON_OPTIONS = PEOPLE.map((person) => ({
  value: person.id,
  label: person.name,
}))

// prettier-ignore
export const SERVICES: Record<ServiceId, { label: ServiceId; icon: ReactNode }> = {
  "payments-api":       { label: "payments-api",       icon: <BanknoteIcon aria-hidden="true" /> },
  "ledger-worker":      { label: "ledger-worker",      icon: <DatabaseIcon aria-hidden="true" /> },
  "webhook-dispatcher": { label: "webhook-dispatcher", icon: <WebhookIcon aria-hidden="true" /> },
  "fraud-scorer":       { label: "fraud-scorer",       icon: <ShieldCheckIcon aria-hidden="true" /> },
  "payouts-scheduler":  { label: "payouts-scheduler",  icon: <WalletIcon aria-hidden="true" /> },
  reconciliation:       { label: "reconciliation",     icon: <ListChecksIcon aria-hidden="true" /> },
  "search-indexer":     { label: "search-indexer",     icon: <SearchIcon aria-hidden="true" /> },
  notifications:        { label: "notifications",      icon: <BellIcon aria-hidden="true" /> },
}

export const SERVICE_IDS = Object.keys(SERVICES) as ServiceId[]

export const SERVICE_OPTIONS = SERVICE_IDS.map((id) => ({
  value: id,
  label: id,
}))

export const CLUSTER_OPTIONS: { value: Cluster; label: string }[] = [
  { value: "prod-us-east-1", label: "prod-us-east-1" },
  { value: "prod-eu-west-1", label: "prod-eu-west-1" },
  { value: "staging-us-east-1", label: "staging-us-east-1" },
]

export const ENVIRONMENT_OPTIONS: { value: Environment; label: string }[] = [
  { value: "production", label: "Production" },
  { value: "staging", label: "Staging" },
  { value: "sandbox", label: "Sandbox" },
]

/** Fixed offsets, exact for the reference date (inside summer time). */
export const TIMEZONES: {
  value: TimezoneId
  label: string
  short: string
  offsetMin: number
}[] = [
  { value: "UTC", label: "UTC", short: "UTC", offsetMin: 0 },
  {
    value: "America/New_York",
    label: "New York (UTC-4)",
    short: "New York",
    offsetMin: -240,
  },
  {
    value: "Europe/Dublin",
    label: "Dublin (UTC+1)",
    short: "Dublin",
    offsetMin: 60,
  },
]

export const TIMEZONE_BY_ID = new Map(
  TIMEZONES.map((zone) => [zone.value, zone])
)

export const offsetOf = (timezone: TimezoneId) =>
  TIMEZONE_BY_ID.get(timezone)?.offsetMin ?? 0

export const SCHEDULE_PRESETS = [
  { id: "5m", label: "Every 5 min", cron: "*/5 * * * *" },
  { id: "hourly", label: "Hourly", cron: "0 * * * *" },
  { id: "daily", label: "Daily", cron: "0 2 * * *" },
  { id: "weekdays", label: "Weekdays", cron: "0 9 * * 1-5" },
  { id: "weekly", label: "Weekly", cron: "0 3 * * 0" },
  { id: "monthly", label: "Monthly", cron: "0 5 1 * *" },
] as const

export const PRESET_BY_ID = new Map<string, (typeof SCHEDULE_PRESETS)[number]>(
  SCHEDULE_PRESETS.map((preset) => [preset.id, preset])
)

export const DEFAULT_EXECUTION = {
  concurrency: "Forbid",
  timeoutMin: 15,
  retries: 1,
  notifyOnFailure: true,
} satisfies Pick<
  CronJob,
  "concurrency" | "timeoutMin" | "retries" | "notifyOnFailure"
>

export const NEW_JOB_DRAFT: JobDraft = {
  name: "",
  command: "",
  schedule: "0 * * * *",
  timezone: "UTC",
  service: "payments-api",
  cluster: "prod-us-east-1",
  environment: "production",
  ownerId: CURRENT_USER_ID,
  enabled: true,
  ...DEFAULT_EXECUTION,
}

// ── Formatters (always UTC) ──

const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
})
const monthDayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
})

const pad = (value: number) => String(value).padStart(2, "0")

/** "14:25" */
export function formatClock(ms: number) {
  const date = new Date(ms)
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

/** "14:25 UTC" */
export const formatTime = (ms: number) => `${formatClock(ms)} UTC`

/** "Tue, Sep 29" */
export const formatDay = (ms: number) => dayFormat.format(ms)

/** "Tue, Sep 29, 14:25 UTC" */
export const formatDateTime = (ms: number) =>
  `${formatDay(ms)}, ${formatTime(ms)}`

/** "Sep 30, 02:00" */
export const formatShort = (ms: number) =>
  `${monthDayFormat.format(ms)}, ${formatClock(ms)}`

const isToday = (ms: number) =>
  Math.floor(ms / 86_400_000) === Math.floor(REFERENCE_MS / 86_400_000)

/** Today reads as a time; any other day carries its date. */
export const formatWhen = (ms: number) =>
  isToday(ms) ? formatTime(ms) : formatShort(ms)

/** "in 5m", "2h 10m ago", "3d ago", "just now" */
export function formatRelative(ms: number) {
  const diff = ms - REFERENCE_MS
  const minutes = Math.floor(Math.abs(diff) / MINUTE_MS)
  if (minutes < 1) return "just now"
  let span: string
  if (minutes < 60) span = `${minutes}m`
  else if (minutes < 1440) {
    const rest = minutes % 60
    span = rest ? `${Math.floor(minutes / 60)}h ${rest}m` : `${minutes / 60}h`
  } else span = `${Math.floor(minutes / 1440)}d`
  return diff > 0 ? `in ${span}` : `${span} ago`
}