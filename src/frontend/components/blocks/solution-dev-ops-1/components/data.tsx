import { type ReactNode } from "react"
import { type BadgeProps } from "@/components/reui/badge"
import {
  firesBetween,
  frequencyOf,
  nextFires,
  parseCron,
  previousFires,
  type Frequency,
} from "./cron"
import { BanknoteIcon, DatabaseIcon, WebhookIcon, ShieldCheckIcon, WalletIcon, ListChecksIcon, SearchIcon, BellIcon } from "lucide-react"

// ── Reference time ──

// customize: the demo's "now"; every label and number hangs off it.
export const REFERENCE_ISO = "2026-09-29T14:20:00Z"
export const REFERENCE_MS = Date.parse(REFERENCE_ISO)
export const SUCCESS_SLO = 0.995

// customize: the workspace, scheduler and alert channel that the copy names.
export const WORKSPACE_NAME = "Harbor Ops"
export const SCHEDULER_NAME = "Harbor scheduler"
export const ALERT_CHANNEL = "#sre-oncall"

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000

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
export type JobHealth = "healthy" | "failing" | "paused"
export type JobTab = "all" | JobHealth
export type SheetTab = "overview" | "runs" | "settings"
export type EnvironmentScope = "all" | Environment
export type FailureKind = "exit" | "timeout"
export type { Frequency }

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

export const TEAM_OPTIONS: { value: Team; label: string }[] = [
  { value: "Platform", label: "Platform" },
  { value: "Payments", label: "Payments" },
  { value: "Risk", label: "Risk" },
  { value: "Data", label: "Data" },
  { value: "SRE", label: "SRE" },
]

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

export const ENVIRONMENT_SCOPE_OPTIONS: {
  value: EnvironmentScope
  label: string
}[] = [{ value: "all", label: "All Environments" }, ...ENVIRONMENT_OPTIONS]

/** Fixed offsets, exact for the seed's windows (all inside summer time). */
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

export const CONCURRENCY_OPTIONS: {
  value: ConcurrencyPolicy
  label: string
  description: string
}[] = [
  { value: "Allow", label: "Allow", description: "Runs may overlap" },
  { value: "Forbid", label: "Forbid", description: "Skip if still running" },
  { value: "Replace", label: "Replace", description: "Cancel the running one" },
]

export const CONCURRENCY_BY_ID = new Map(
  CONCURRENCY_OPTIONS.map((option) => [option.value, option])
)

// customize: one face per run status, shared by badges, bars, ticks, glyphs and
// charts. `tick` is the full tone the KPI strips use beside JOB_HEALTH ticks.
export const RUN_STATUS: Record<
  RunStatus,
  {
    label: string
    variant: BadgeProps["variant"]
    bar: string
    tick: string
    text: string
    color: string
  }
> = {
  succeeded: {
    label: "Succeeded",
    variant: "success-light",
    bar: "bg-success/40",
    tick: "bg-success",
    text: "text-success",
    color: "var(--success)",
  },
  failed: {
    label: "Failed",
    variant: "destructive-light",
    bar: "bg-destructive",
    tick: "bg-destructive",
    text: "text-destructive",
    color: "var(--destructive)",
  },
  timedOut: {
    label: "Timed Out",
    variant: "warning-light",
    bar: "bg-warning",
    tick: "bg-warning",
    text: "text-warning",
    color: "var(--warning)",
  },
  skipped: {
    label: "Skipped",
    variant: "info-light",
    bar: "bg-info/40",
    tick: "bg-info",
    text: "text-info",
    color: "var(--info)",
  },
  running: {
    label: "Running",
    variant: "primary-light",
    bar: "bg-primary",
    tick: "bg-primary",
    text: "text-primary",
    color: "var(--primary)",
  },
}

export const RUN_STATUS_OPTIONS = (Object.keys(RUN_STATUS) as RunStatus[]).map(
  (status) => ({ value: status, label: RUN_STATUS[status].label })
)

export const JOB_HEALTH: Record<
  JobHealth,
  { label: string; variant: BadgeProps["variant"]; tick: string }
> = {
  healthy: { label: "Healthy", variant: "success-light", tick: "bg-success" },
  failing: {
    label: "Failing",
    variant: "destructive-light",
    tick: "bg-destructive",
  },
  paused: { label: "Paused", variant: "info-light", tick: "bg-info" },
}

export const JOB_HEALTH_ORDER: JobHealth[] = ["healthy", "failing", "paused"]

export const TRIGGER_LABEL: Record<RunTrigger, string> = {
  scheduled: "Scheduled",
  manual: "Manual",
  retry: "Retry",
}

export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "minutes", label: "Every few minutes" },
  { value: "hourly", label: "Hourly" },
  { value: "hours", label: "Every few hours" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
]

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

export const JOB_TABS: { value: JobTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "healthy", label: "Healthy" },
  { value: "failing", label: "Failing" },
  { value: "paused", label: "Paused" },
]

export type Density = "compact" | "comfortable"

export const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
]

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

export const draftOf = (job: CronJob): JobDraft => ({
  name: job.name,
  command: job.command,
  schedule: job.schedule,
  timezone: job.timezone,
  service: job.service,
  cluster: job.cluster,
  environment: job.environment,
  ownerId: job.ownerId,
  concurrency: job.concurrency,
  timeoutMin: job.timeoutMin,
  retries: job.retries,
  notifyOnFailure: job.notifyOnFailure,
  enabled: job.enabled,
})

// ── Seed ──

type SeedHistory = {
  /** 20 chars, oldest to newest: s ok, r ok on attempt 2, f failed, t timed out, k skipped. */
  pattern: string
  extraRuns?: { at: string; status: RunStatus; by: PersonId }[]
}

type RawJob = Omit<CronJob, "runs"> & { history: SeedHistory }

const paused = (iso: string, by: PersonId, note: string) => ({
  pausedAt: Date.parse(iso),
  pausedBy: by,
  pauseNote: note,
})

const ALL_OK = "ssssssssssssssssssss"

// customize: the newest run of the first seeded job; each job owns a block of ids.
const FIRST_RUN_ID = "RUN-58213"
const FIRST_RUN_NUMBER = Number(FIRST_RUN_ID.slice("RUN-".length))
const RUN_ID_BLOCK = 41

// customize: the job fleet. Health, KPIs and charts all derive from it.
// prettier-ignore
const RAW_JOBS: RawJob[] = [
  { id: "JOB-214", name: "Nightly ledger reconciliation", command: "harbor run reconciliation -- ledger:reconcile --window=24h", schedule: "0 2 * * *", timezone: "UTC", enabled: true, service: "reconciliation", cluster: "prod-us-east-1", environment: "production", ownerId: "sofia", concurrency: "Forbid", timeoutMin: 30, retries: 2, notifyOnFailure: true, baseDurationSec: 134, history: { pattern: "sssssssssrssssssssss" } },
  { id: "JOB-219", name: "Import bank settlement files", command: "harbor run ledger-worker -- settlements:import --banks=all", schedule: "30 * * * *", timezone: "UTC", enabled: true, service: "ledger-worker", cluster: "prod-us-east-1", environment: "production", ownerId: "alex", concurrency: "Forbid", timeoutMin: 15, retries: 3, notifyOnFailure: true, baseDurationSec: 252, failure: { kind: "exit", exitCode: 137, label: "Exit 137", reason: "OOMKilled at the 2Gi memory limit", persistent: true }, history: { pattern: "sssssssssssssssssfff", extraRuns: [{ at: "2026-09-29T12:05:00Z", status: "failed", by: "alex" }] } },
  { id: "JOB-221", name: "Rotate webhook signing keys", command: "harbor run webhook-dispatcher -- keys:rotate --grace=48h", schedule: "0 4 * * 1", timezone: "UTC", enabled: true, service: "webhook-dispatcher", cluster: "prod-us-east-1", environment: "production", ownerId: "sarah", concurrency: "Forbid", timeoutMin: 15, retries: 1, notifyOnFailure: true, baseDurationSec: 41, history: { pattern: ALL_OK } },
  { id: "JOB-226", name: "Expire stale payout holds", command: "harbor run payouts-scheduler -- holds:expire --older-than=72h", schedule: "*/15 * * * *", timezone: "UTC", enabled: true, service: "payouts-scheduler", cluster: "prod-us-east-1", environment: "production", ownerId: "priya", concurrency: "Forbid", timeoutMin: 10, retries: 2, notifyOnFailure: true, baseDurationSec: 18, history: { pattern: "ssssssssskssssssssss" } },
  { id: "JOB-233", name: "Drain webhook retry queue", command: "harbor run webhook-dispatcher -- retries:drain --max=5000", schedule: "*/5 * * * *", timezone: "UTC", enabled: true, service: "webhook-dispatcher", cluster: "prod-eu-west-1", environment: "production", ownerId: "omar", concurrency: "Replace", timeoutMin: 4, retries: 1, notifyOnFailure: true, baseDurationSec: 52, failure: { kind: "exit", exitCode: 1, label: "Exit 1", reason: "Partner endpoint returned 503 for 212 deliveries", persistent: false }, history: { pattern: "ssssssssssssssssssff" } },
  { id: "JOB-237", name: "Refresh fraud model features", command: "harbor run fraud-scorer -- features:refresh --model=fs-v7", schedule: "0 * * * *", timezone: "UTC", enabled: true, service: "fraud-scorer", cluster: "prod-us-east-1", environment: "production", ownerId: "kenji", concurrency: "Forbid", timeoutMin: 20, retries: 1, notifyOnFailure: true, baseDurationSec: 400, failure: { kind: "timeout", exitCode: null, label: "Timed Out", reason: "Deadline exceeded at the 20m timeout", persistent: false }, history: { pattern: "sssssstsssssssssssss" } },
  { id: "JOB-240", name: "Rebuild merchant search index", command: "harbor run search-indexer -- reindex merchants --shards=12", schedule: "30 3 * * *", timezone: "UTC", enabled: true, service: "search-indexer", cluster: "prod-eu-west-1", environment: "production", ownerId: "sofia", concurrency: "Forbid", timeoutMin: 60, retries: 0, notifyOnFailure: true, baseDurationSec: 2860, failure: { kind: "timeout", exitCode: null, label: "Timed Out", reason: "Deadline exceeded at the 60m timeout", persistent: true }, history: { pattern: "sssssssssssssssssstt" } },
  { id: "JOB-244", name: "Send payout digest emails", command: "harbor run notifications -- digest:payouts --locale=all", schedule: "0 9 * * 1-5", timezone: "America/New_York", enabled: true, service: "notifications", cluster: "prod-us-east-1", environment: "production", ownerId: "michael", concurrency: "Allow", timeoutMin: 15, retries: 2, notifyOnFailure: false, baseDurationSec: 185, history: { pattern: ALL_OK } },
  { id: "JOB-248", name: "Compact ledger partitions", command: "harbor run ledger-worker -- partitions:compact --keep=90d", schedule: "0 3 * * 0", timezone: "UTC", enabled: false, service: "ledger-worker", cluster: "prod-us-east-1", environment: "production", ownerId: "alex", concurrency: "Forbid", timeoutMin: 120, retries: 0, notifyOnFailure: true, baseDurationSec: 2820, ...paused("2026-09-26T10:12:00Z", "alex", "Held for the Postgres 16 upgrade window"), history: { pattern: ALL_OK } },
  { id: "JOB-252", name: "Prune staging preview releases", command: "harbor run payments-api -- releases:prune --env=staging --keep=20", schedule: "0 */6 * * *", timezone: "UTC", enabled: true, service: "payments-api", cluster: "staging-us-east-1", environment: "staging", ownerId: "emma", concurrency: "Allow", timeoutMin: 10, retries: 1, notifyOnFailure: false, baseDurationSec: 72, history: { pattern: ALL_OK, extraRuns: [{ at: "2026-09-29T09:12:00Z", status: "succeeded", by: "emma" }] } },
  { id: "JOB-257", name: "Reset sandbox test merchants", command: "harbor run payments-api -- sandbox:reset --merchants=fixtures", schedule: "0 5 * * *", timezone: "Europe/Dublin", enabled: true, service: "payments-api", cluster: "staging-us-east-1", environment: "sandbox", ownerId: "david", concurrency: "Replace", timeoutMin: 15, retries: 1, notifyOnFailure: false, baseDurationSec: 260, history: { pattern: ALL_OK } },
  { id: "JOB-261", name: "Recalculate risk thresholds", command: "harbor run fraud-scorer -- thresholds:recalc --segment=all", schedule: "15 */4 * * *", timezone: "UTC", enabled: false, service: "fraud-scorer", cluster: "prod-eu-west-1", environment: "production", ownerId: "kenji", concurrency: "Forbid", timeoutMin: 30, retries: 1, notifyOnFailure: true, baseDurationSec: 610, ...paused("2026-09-28T16:40:00Z", "kenji", "Paused while model fs-v7 is under review"), history: { pattern: ALL_OK } },
  { id: "JOB-263", name: "Sync FX reference rates", command: "harbor run payments-api -- fx:sync --source=central-banks", schedule: "*/10 * * * *", timezone: "UTC", enabled: true, service: "payments-api", cluster: "prod-us-east-1", environment: "production", ownerId: "david", concurrency: "Forbid", timeoutMin: 5, retries: 2, notifyOnFailure: true, baseDurationSec: 9, history: { pattern: ALL_OK } },
  { id: "JOB-266", name: "Archive delivered webhooks", command: "harbor run webhook-dispatcher -- deliveries:archive --older-than=30d", schedule: "0 1 * * *", timezone: "UTC", enabled: true, service: "webhook-dispatcher", cluster: "prod-eu-west-1", environment: "production", ownerId: "omar", concurrency: "Forbid", timeoutMin: 45, retries: 1, notifyOnFailure: true, baseDurationSec: 845, history: { pattern: ALL_OK } },
  { id: "JOB-270", name: "Vacuum ledger replicas", command: "harbor run ledger-worker -- replicas:vacuum --analyze", schedule: "30 4 * * *", timezone: "UTC", enabled: true, service: "ledger-worker", cluster: "prod-us-east-1", environment: "production", ownerId: "alex", concurrency: "Forbid", timeoutMin: 60, retries: 1, notifyOnFailure: true, baseDurationSec: 1350, history: { pattern: "sssssssssssssssssrss" } },
  { id: "JOB-272", name: "Export daily settlement report", command: "harbor run reconciliation -- reports:settlement --format=csv", schedule: "0 6 * * *", timezone: "UTC", enabled: true, service: "reconciliation", cluster: "prod-us-east-1", environment: "production", ownerId: "sofia", concurrency: "Forbid", timeoutMin: 20, retries: 2, notifyOnFailure: true, baseDurationSec: 230, history: { pattern: ALL_OK } },
  { id: "JOB-275", name: "Score dormant accounts", command: "harbor run fraud-scorer -- accounts:score --dormant-days=90", schedule: "0 0 * * *", timezone: "UTC", enabled: true, service: "fraud-scorer", cluster: "prod-us-east-1", environment: "production", ownerId: "kenji", concurrency: "Forbid", timeoutMin: 45, retries: 1, notifyOnFailure: true, baseDurationSec: 680, history: { pattern: ALL_OK } },
  { id: "JOB-279", name: "Release scheduled payouts", command: "harbor run payouts-scheduler -- payouts:release --window=4h", schedule: "0 13,17,21 * * 1-5", timezone: "UTC", enabled: true, service: "payouts-scheduler", cluster: "prod-us-east-1", environment: "production", ownerId: "priya", concurrency: "Forbid", timeoutMin: 30, retries: 3, notifyOnFailure: true, baseDurationSec: 375, history: { pattern: ALL_OK } },
  { id: "JOB-281", name: "Retry failed payouts", command: "harbor run payouts-scheduler -- payouts:retry --max-attempts=3", schedule: "*/30 * * * *", timezone: "UTC", enabled: true, service: "payouts-scheduler", cluster: "prod-eu-west-1", environment: "production", ownerId: "priya", concurrency: "Forbid", timeoutMin: 10, retries: 2, notifyOnFailure: true, baseDurationSec: 100, failure: { kind: "exit", exitCode: 1, label: "Exit 1", reason: "Payout provider rejected 3 batches", persistent: false }, history: { pattern: "ssssssssfsssssssssss" } },
  { id: "JOB-284", name: "Warm merchant search cache", command: "harbor run search-indexer -- cache:warm merchants", schedule: "*/20 * * * *", timezone: "UTC", enabled: true, service: "search-indexer", cluster: "prod-eu-west-1", environment: "production", ownerId: "sofia", concurrency: "Replace", timeoutMin: 5, retries: 0, notifyOnFailure: true, baseDurationSec: 38, history: { pattern: ALL_OK } },
  { id: "JOB-288", name: "Purge expired idempotency keys", command: "harbor run payments-api -- idempotency:purge --ttl=24h", schedule: "45 * * * *", timezone: "UTC", enabled: true, service: "payments-api", cluster: "prod-us-east-1", environment: "production", ownerId: "nina", concurrency: "Forbid", timeoutMin: 10, retries: 1, notifyOnFailure: true, baseDurationSec: 125, history: { pattern: ALL_OK } },
  { id: "JOB-290", name: "Rotate database credentials", command: "harbor run ledger-worker -- credentials:rotate --vault=prod", schedule: "0 5 1 * *", timezone: "UTC", enabled: true, service: "ledger-worker", cluster: "prod-us-east-1", environment: "production", ownerId: "sarah", concurrency: "Forbid", timeoutMin: 30, retries: 1, notifyOnFailure: true, baseDurationSec: 92, history: { pattern: ALL_OK } },
  { id: "JOB-293", name: "Expire push notification tokens", command: "harbor run notifications -- tokens:expire --platform=all", schedule: "0 2 * * *", timezone: "Europe/Dublin", enabled: true, service: "notifications", cluster: "prod-eu-west-1", environment: "production", ownerId: "michael", concurrency: "Allow", timeoutMin: 20, retries: 1, notifyOnFailure: true, baseDurationSec: 310, history: { pattern: ALL_OK } },
  { id: "JOB-296", name: "Rebuild disputes index", command: "harbor run search-indexer -- reindex disputes --shards=4", schedule: "15 2 * * *", timezone: "UTC", enabled: false, service: "search-indexer", cluster: "prod-us-east-1", environment: "production", ownerId: "sofia", concurrency: "Forbid", timeoutMin: 90, retries: 0, notifyOnFailure: true, baseDurationSec: 2040, ...paused("2026-09-27T09:05:00Z", "sofia", "Waiting on the disputes schema migration"), history: { pattern: ALL_OK } },
  { id: "JOB-301", name: "Send failed charge alerts", command: "harbor run notifications -- alerts:failed-charges --batch=500", schedule: "*/5 * * * *", timezone: "UTC", enabled: true, service: "notifications", cluster: "prod-us-east-1", environment: "production", ownerId: "michael", concurrency: "Allow", timeoutMin: 3, retries: 1, notifyOnFailure: true, baseDurationSec: 11, history: { pattern: ALL_OK } },
  { id: "JOB-304", name: "Reconcile card network fees", command: "harbor run reconciliation -- fees:reconcile --networks=all", schedule: "0 7 * * 1-5", timezone: "UTC", enabled: true, service: "reconciliation", cluster: "prod-eu-west-1", environment: "production", ownerId: "sofia", concurrency: "Forbid", timeoutMin: 30, retries: 2, notifyOnFailure: true, baseDurationSec: 525, history: { pattern: ALL_OK } },
  { id: "JOB-308", name: "Seed staging ledger", command: "harbor run ledger-worker -- fixtures:seed --env=staging", schedule: "0 6 * * 1", timezone: "UTC", enabled: true, service: "ledger-worker", cluster: "staging-us-east-1", environment: "staging", ownerId: "alex", concurrency: "Replace", timeoutMin: 60, retries: 0, notifyOnFailure: false, baseDurationSec: 1080, history: { pattern: ALL_OK } },
  { id: "JOB-311", name: "Replay sandbox webhooks", command: "harbor run webhook-dispatcher -- deliveries:replay --env=sandbox", schedule: "0 */3 * * *", timezone: "UTC", enabled: false, service: "webhook-dispatcher", cluster: "staging-us-east-1", environment: "sandbox", ownerId: "david", concurrency: "Allow", timeoutMin: 15, retries: 1, notifyOnFailure: false, baseDurationSec: 160, ...paused("2026-09-24T18:30:00Z", "david", "Partner sandbox is offline until Oct 1"), history: { pattern: ALL_OK } },
  { id: "JOB-315", name: "Check certificate expiry", command: "harbor run notifications -- certs:check --warn-days=21", schedule: "0 8 * * *", timezone: "UTC", enabled: true, service: "notifications", cluster: "prod-us-east-1", environment: "production", ownerId: "nina", concurrency: "Forbid", timeoutMin: 5, retries: 1, notifyOnFailure: true, baseDurationSec: 24, history: { pattern: ALL_OK } },
  { id: "JOB-318", name: "Load test fraud scorer", command: "harbor run fraud-scorer -- loadtest --rps=400 --duration=30m", schedule: "0 22 * * 2", timezone: "UTC", enabled: false, service: "fraud-scorer", cluster: "staging-us-east-1", environment: "staging", ownerId: "kenji", concurrency: "Forbid", timeoutMin: 60, retries: 0, notifyOnFailure: false, baseDurationSec: 2460, ...paused("2026-09-22T11:00:00Z", "kenji", "Paused until the fs-v7 rollout lands"), history: { pattern: "ssssssssssssssssstss" } },
  { id: "JOB-322", name: "Clean orphaned payout batches", command: "harbor run payouts-scheduler -- batches:clean --env=staging", schedule: "0 4 * * *", timezone: "UTC", enabled: true, service: "payouts-scheduler", cluster: "staging-us-east-1", environment: "staging", ownerId: "priya", concurrency: "Forbid", timeoutMin: 15, retries: 1, notifyOnFailure: false, baseDurationSec: 65, history: { pattern: ALL_OK } },
  { id: "JOB-325", name: "Refresh sandbox API docs index", command: "harbor run search-indexer -- reindex api-docs --env=sandbox", schedule: "0 */12 * * *", timezone: "UTC", enabled: true, service: "search-indexer", cluster: "staging-us-east-1", environment: "sandbox", ownerId: "emma", concurrency: "Allow", timeoutMin: 10, retries: 0, notifyOnFailure: false, baseDurationSec: 140, history: { pattern: ALL_OK } },
]

/** The step line a failing or timed-out log prints before its error. */
const LOG_STEPS: Record<string, string> = {
  "JOB-237": "Refreshing 48 feature tables for model fs-v7",
  "JOB-240": "Reindexing 12 shards for merchants",
  "JOB-281": "Resubmitting 46 failed payouts in 5 batches",
  "JOB-318": "Replaying 400 requests per second against fs-v7",
}

// ── Derivations ──

export function parseSchedule(job: Pick<CronJob, "schedule">) {
  const result = parseCron(job.schedule)
  return result.ok ? result.cron : null
}

/** Sum of the id's char codes: a stable per-job seed for demo variation. */
function idSeed(id: string) {
  let total = 0
  for (const char of id) total += char.charCodeAt(0)
  return total
}

export function succeededDuration(
  job: Pick<CronJob, "id" | "baseDurationSec">,
  index: number
) {
  const seed = idSeed(job.id)
  return Math.round(
    job.baseDurationSec * (0.82 + ((seed * 7 + index * 13) % 37) / 100)
  )
}

function scheduledRun(
  raw: RawJob,
  char: string,
  index: number,
  startedAt: number,
  id: string
): JobRun {
  const maxAttempts = raw.retries + 1
  const base = {
    id,
    trigger: "scheduled" as const,
    triggeredBy: "scheduler" as const,
    startedAt,
    maxAttempts,
  }
  switch (char) {
    case "f":
      return {
        ...base,
        status: "failed",
        durationSec: raw.baseDurationSec,
        attempt: maxAttempts,
        exitCode: raw.failure?.exitCode ?? 1,
      }
    case "t":
      return {
        ...base,
        status: "timedOut",
        durationSec: raw.timeoutMin * 60,
        attempt: maxAttempts,
        exitCode: null,
      }
    case "k":
      return {
        ...base,
        status: "skipped",
        durationSec: 0,
        attempt: 1,
        exitCode: null,
      }
    default:
      return {
        ...base,
        status: "succeeded",
        durationSec: succeededDuration(raw, index),
        attempt: char === "r" ? 2 : 1,
        exitCode: 0,
      }
  }
}

function buildHistory(raw: RawJob, ordinal: number, extraIds: string[]) {
  const cron = parseSchedule(raw)
  if (!cron) return []
  const fires = previousFires(
    cron,
    offsetOf(raw.timezone),
    raw.pausedAt ?? REFERENCE_MS,
    raw.history.pattern.length
  )
  const runSeed = FIRST_RUN_NUMBER + ordinal * RUN_ID_BLOCK
  const runs = fires.map((at, index) =>
    scheduledRun(
      raw,
      raw.history.pattern[index] ?? "s",
      index,
      at,
      `RUN-${runSeed - (fires.length - 1 - index)}`
    )
  )
  const extra = (raw.history.extraRuns ?? []).map((run, index): JobRun => {
    const failed = run.status === "failed"
    return {
      id: extraIds[index],
      status: run.status,
      trigger: "manual",
      triggeredBy: run.by,
      startedAt: Date.parse(run.at),
      durationSec: failed ? raw.baseDurationSec : succeededDuration(raw, 19),
      attempt: failed ? raw.retries + 1 : 1,
      maxAttempts: raw.retries + 1,
      exitCode: failed ? (raw.failure?.exitCode ?? 1) : 0,
    }
  })
  return [...runs, ...extra].sort((a, b) => b.startedAt - a.startedAt)
}

function seedJobs(): CronJob[] {
  // Manual seed runs count up from the end of the last job's block.
  let extraSeq = FIRST_RUN_NUMBER + (RAW_JOBS.length - 1) * RUN_ID_BLOCK
  return RAW_JOBS.map((raw, ordinal) => {
    const { history, ...job } = raw
    const extraIds = (history.extraRuns ?? []).map(() => `RUN-${++extraSeq}`)
    return { ...job, runs: buildHistory(raw, ordinal, extraIds) }
  })
}

export const JOBS: CronJob[] = seedJobs()

const idNumber = (id: string) => Number(id.slice(id.indexOf("-") + 1))

/** The highest seeded ids: created jobs and manual runs count up from these. */
export const LAST_SEED_JOB = Math.max(0, ...JOBS.map((job) => idNumber(job.id)))
export const LAST_SEED_RUN = Math.max(
  FIRST_RUN_NUMBER,
  ...JOBS.flatMap((job) => job.runs.map((run) => idNumber(run.id)))
)

export function healthOf(job: CronJob): JobHealth {
  if (!job.enabled) return "paused"
  const latest = job.runs.find(
    (run) => run.status !== "running" && run.status !== "skipped"
  )
  return latest?.status === "failed" || latest?.status === "timedOut"
    ? "failing"
    : "healthy"
}

export const isRunning = (job: CronJob) =>
  job.runs.some((run) => run.status === "running")

/** The fire after the skip rule, null when paused or never firing. */
export function nextRunOf(job: CronJob): number | null {
  if (!job.enabled) return null
  const cron = parseSchedule(job)
  if (!cron) return null
  const [first, second] = nextFires(
    cron,
    offsetOf(job.timezone),
    REFERENCE_MS,
    2
  )
  return first === job.skipFireAt ? (second ?? null) : (first ?? null)
}

/** The schedule's next fire, paused or not: the Next Run sort key, so pausing
 *  or resuming a job never moves its row out from under the pointer. */
export function scheduledFireOf(job: CronJob): number | null {
  return nextRunOf({ ...job, enabled: true })
}

/** The grid's default order: jobs whose last run failed first, then by next
 *  scheduled fire. Pause state is ignored, so the Switch never moves a row. */
export function triageOrder(jobs: CronJob[]): CronJob[] {
  return jobs
    .map((job) => ({
      job,
      failing: healthOf({ ...job, enabled: true }) === "failing",
      fire: scheduledFireOf(job) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => Number(b.failing) - Number(a.failing) || a.fire - b.fire)
    .map((entry) => entry.job)
}

/** The arguments after "--": the runner prefix repeats the Target column. */
export const commandArgsOf = (command: string) =>
  command.split(" -- ")[1] ?? command

/** Upcoming fires, the skipped one included and flagged. */
export function upcomingFires(job: CronJob, count: number) {
  const cron = parseSchedule(job)
  if (!cron || !job.enabled) return []
  const fires = nextFires(cron, offsetOf(job.timezone), REFERENCE_MS, count + 1)
  const list = fires.map((at) => ({ at, skipped: at === job.skipFireAt }))
  const skips = list.filter((fire) => fire.skipped).length
  return list.slice(0, count + skips)
}

export function failureStreak(job: CronJob) {
  let count = 0
  let since: number | null = null
  for (const run of job.runs) {
    if (run.status === "running" || run.status === "skipped") continue
    if (run.status !== "failed" && run.status !== "timedOut") break
    count += 1
    since = run.startedAt
  }
  return { count, since }
}

export type RunStats = {
  succeeded: number
  failed: number
  timedOut: number
  skipped: number
  total: number
  rate: number | null
  p95Sec: number | null
  lastFailure: JobRun | null
}

export function runStats(job: CronJob): RunStats {
  const recent = job.runs.filter((run) => run.status !== "running").slice(0, 20)
  const count = (status: RunStatus) =>
    recent.filter((run) => run.status === status).length
  const succeeded = count("succeeded")
  const failed = count("failed")
  const timedOut = count("timedOut")
  const outcomes = succeeded + failed + timedOut
  const durations = recent
    .filter((run) => run.status !== "skipped")
    .map((run) => run.durationSec)
    .sort((a, b) => a - b)
  return {
    succeeded,
    failed,
    timedOut,
    skipped: count("skipped"),
    total: recent.length,
    rate: outcomes > 0 ? succeeded / outcomes : null,
    p95Sec: durations.length
      ? durations[Math.ceil(0.95 * durations.length) - 1]
      : null,
    lastFailure:
      recent.find(
        (run) => run.status === "failed" || run.status === "timedOut"
      ) ?? null,
  }
}

export const teamOf = (job: CronJob) => PERSON_BY_ID.get(job.ownerId)?.team

export function frequencyOfJob(job: CronJob): Frequency | undefined {
  const cron = parseSchedule(job)
  return cron ? frequencyOf(cron) : undefined
}

// ── Fleet activity: the 24 hours before the reference time ──

export const WINDOW_START =
  Math.floor(REFERENCE_MS / HOUR_MS) * HOUR_MS - 23 * HOUR_MS
const PRIOR_WINDOW_START = WINDOW_START - 24 * HOUR_MS

type FireRecord = { at: number; status: RunStatus; durationSec: number }

/** A seed job's fires in [from, to): its recorded run where one exists, else a
 *  success at its base duration; manual runs join by start time. */
function seedRecords(job: CronJob, from: number, to: number): FireRecord[] {
  const cron = parseSchedule(job)
  const until = Math.min(to, job.pausedAt ?? Infinity)
  const byStart = new Map(job.runs.map((run) => [run.startedAt, run]))
  const fires = cron
    ? firesBetween(cron, offsetOf(job.timezone), from, until)
    : []
  const records: FireRecord[] = fires.map((at) => {
    const run = byStart.get(at)
    return run
      ? { at, status: run.status, durationSec: run.durationSec }
      : { at, status: "succeeded", durationSec: job.baseDurationSec }
  })
  for (const run of job.runs) {
    if (
      run.trigger !== "scheduled" &&
      run.startedAt >= from &&
      run.startedAt < to
    ) {
      records.push({
        at: run.startedAt,
        status: run.status,
        durationSec: run.durationSec,
      })
    }
  }
  return records
}

/** The past is fixed: seed fires are computed once, so later edits never rewrite it. */
const SEED_ACTIVITY = new Map<string, FireRecord[]>(
  JOBS.map((job) => [job.id, seedRecords(job, WINDOW_START, REFERENCE_MS)])
)

/** Runner seconds per seed job in the 24 hours before the window, same rule. */
const SEED_PRIOR_SEC = new Map<string, number>(
  JOBS.map((job) => [
    job.id,
    seedRecords(job, PRIOR_WINDOW_START, WINDOW_START).reduce(
      (total, record) => total + record.durationSec,
      0
    ),
  ])
)

/** The outcomes that spend runner time; a skipped fire spends none. */
export type FleetOutcome = "succeeded" | "timedOut" | "failed"

/** Each outcome's runner-seconds field on a bucket. */
export const SECONDS_KEY = {
  succeeded: "succeededSec",
  timedOut: "timedOutSec",
  failed: "failedSec",
} as const satisfies Record<FleetOutcome, string>

export type SlowestRun = { job: CronJob; durationSec: number }

export type FleetBucket = {
  label: string
  start: number
  succeeded: number
  failed: number
  timedOut: number
  skipped: number
  succeededSec: number
  failedSec: number
  timedOutSec: number
  /** The longest run of each outcome that started in this hour. */
  slowest: Partial<Record<FleetOutcome, SlowestRun>>
}

export type FleetActivity = {
  buckets: FleetBucket[]
  succeeded: number
  failed: number
  timedOut: number
  skipped: number
  failingJobs: number
  /** The job with the most failed and timed-out runs; ties keep fleet order. */
  worst: { job: CronJob; failures: number } | null
  /** Runner seconds in the prior 24 hours; jobs created since add none. */
  priorSec: number
}

export function fleetActivity(jobs: CronJob[]): FleetActivity {
  const buckets: FleetBucket[] = Array.from({ length: 24 }, (_, index) => {
    const start = WINDOW_START + index * HOUR_MS
    return {
      label: formatClock(start),
      start,
      succeeded: 0,
      failed: 0,
      timedOut: 0,
      skipped: 0,
      succeededSec: 0,
      failedSec: 0,
      timedOutSec: 0,
      slowest: {},
    }
  })
  let failingJobs = 0
  let worst: FleetActivity["worst"] = null
  let priorSec = 0
  for (const job of jobs) {
    priorSec += SEED_PRIOR_SEC.get(job.id) ?? 0
    let failures = 0
    // Runs started at the reference time (Run Now, Retry) join the last hour.
    const live = job.runs
      .filter(
        (run) => run.startedAt >= REFERENCE_MS && run.status !== "running"
      )
      .map((run) => ({
        at: run.startedAt,
        status: run.status,
        durationSec: run.durationSec,
      }))
    for (const record of [...(SEED_ACTIVITY.get(job.id) ?? []), ...live]) {
      const index = Math.min(
        23,
        Math.max(0, Math.floor((record.at - WINDOW_START) / HOUR_MS))
      )
      const bucket = buckets[index]
      const { status, durationSec } = record
      if (status === "skipped") bucket.skipped += 1
      if (
        status !== "succeeded" &&
        status !== "failed" &&
        status !== "timedOut"
      )
        continue
      bucket[status] += 1
      bucket[SECONDS_KEY[status]] += durationSec
      if (status !== "succeeded") failures += 1
      const slowest = bucket.slowest[status]
      if (!slowest || durationSec > slowest.durationSec)
        bucket.slowest[status] = { job, durationSec }
    }
    if (failures === 0) continue
    failingJobs += 1
    if (!worst || failures > worst.failures) worst = { job, failures }
  }
  const sum = (key: "succeeded" | "failed" | "timedOut" | "skipped") =>
    buckets.reduce((total, bucket) => total + bucket[key], 0)
  return {
    buckets,
    succeeded: sum("succeeded"),
    failed: sum("failed"),
    timedOut: sum("timedOut"),
    skipped: sum("skipped"),
    failingJobs,
    worst,
    priorSec,
  }
}

export type UpNextEntry = { job: CronJob; at: number }

/** Each enabled job's next fire, soonest first; ties keep fleet order. */
export function upNextOf(jobs: CronJob[]): UpNextEntry[] {
  return jobs
    .flatMap((job) => {
      const at = nextRunOf(job)
      return at === null ? [] : [{ job, at }]
    })
    .sort((a, b) => a.at - b.at)
}

/** The next hour in 5-minute slots, each labelled by its end time. */
export type FireSlot = { end: number; healthy: number; failing: number }

const SLOT_MS = 5 * MINUTE_MS

/** Runs firing in the hour after the reference time, failing jobs counted
 *  apart; a skipped fire never counts. */
export function nextHourLoad(jobs: CronJob[]): FireSlot[] {
  const slots: FireSlot[] = Array.from({ length: 12 }, (_, index) => ({
    end: REFERENCE_MS + (index + 1) * SLOT_MS,
    healthy: 0,
    failing: 0,
  }))
  for (const job of jobs) {
    const cron = job.enabled ? parseSchedule(job) : null
    if (!cron) continue
    const failing = healthOf(job) === "failing"
    // Strictly after the reference time, up to and including +60m.
    const fires = firesBetween(
      cron,
      offsetOf(job.timezone),
      REFERENCE_MS + 1,
      REFERENCE_MS + HOUR_MS + 1
    )
    for (const at of fires) {
      if (at === job.skipFireAt) continue
      const slot = slots[Math.ceil((at - REFERENCE_MS) / SLOT_MS) - 1]
      if (failing) slot.failing += 1
      else slot.healthy += 1
    }
  }
  return slots
}

/** What a manual run of this job resolves to. */
export function manualOutcome(job: CronJob, runNumber: number) {
  const maxAttempts = job.retries + 1
  if (job.failure?.persistent && job.failure.kind === "exit") {
    return {
      status: "failed" as const,
      durationSec: job.baseDurationSec,
      exitCode: job.failure.exitCode ?? 1,
      attempt: maxAttempts,
    }
  }
  if (job.failure?.persistent && job.failure.kind === "timeout") {
    return {
      status: "timedOut" as const,
      durationSec: job.timeoutMin * 60,
      exitCode: null,
      attempt: maxAttempts,
    }
  }
  return {
    status: "succeeded" as const,
    durationSec: succeededDuration(job, runNumber % 20),
    exitCode: 0,
    attempt: 1,
  }
}

// ── Formatters (always UTC) ──

const countFormat = new Intl.NumberFormat("en-US")
const percentFormat = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
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

export const formatCount = (value: number) => countFormat.format(value)
export const formatPercent = (value: number) => percentFormat.format(value)

/** "14:25" */
export function formatClock(ms: number) {
  const date = new Date(ms)
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

function formatClockSeconds(ms: number) {
  const date = new Date(ms)
  return `${formatClock(ms)}:${pad(date.getUTCSeconds())}`
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

/** "Sep 29, 13:30 UTC" */
export const formatShortUtc = (ms: number) => `${formatShort(ms)} UTC`

const isToday = (ms: number) =>
  Math.floor(ms / 86_400_000) === Math.floor(REFERENCE_MS / 86_400_000)

/** Today reads as a time; any other day carries its date. */
export const formatWhen = (ms: number) =>
  isToday(ms) ? formatTime(ms) : formatShort(ms)

/** "14:30" today, "Sep 30" on any other day: the grid's skip line. */
export const formatBrief = (ms: number) =>
  isToday(ms) ? formatClock(ms) : monthDayFormat.format(ms)

/** "47s", "2m 14s", "1h 02m" */
export function formatDuration(totalSec: number) {
  const sec = Math.max(0, Math.round(totalSec))
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${pad(sec % 60)}s`
  return `${Math.floor(sec / 3600)}h ${pad(Math.floor((sec % 3600) / 60))}m`
}

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

// ── Run logs ──

const RUNNER = "harbor-runner 3.12.0"

/** Deterministic log text for one run; lines are "[hh:mm:ss] text". */
export function buildRunLog(job: CronJob, run: JobRun): string {
  const runNumber = run.id.replace("RUN-", "")
  const at = (offsetSec: number) =>
    `[${formatClockSeconds(run.startedAt + offsetSec * 1000)}]`
  const duration = run.durationSec
  const header = [
    `${at(0)} ${RUNNER} on ${job.cluster}, pod ${job.service}-${runNumber}`,
    `${at(1)} Lock acquired for ${job.id}, policy ${job.concurrency}`,
    `${at(1)} $ ${job.command}`,
  ]
  const step =
    LOG_STEPS[job.id] ??
    `Running ${job.command.split(" -- ")[1]?.split(" ")[0] ?? "job"}`

  if (run.status === "skipped") {
    return [
      header[0],
      `${at(0)} Previous run still active, skipped by policy ${job.concurrency}`,
    ].join("\n")
  }
  if (run.status === "running") {
    return [...header, `${at(2)} Running...`].join("\n")
  }
  if (run.status === "timedOut") {
    const limit = Math.round(duration / 60)
    return [
      ...header,
      `${at(3)} ${step}`,
      `${at((limit - 1) * 60)} WARN still running at ${limit - 1}m 00s`,
      `${at(limit * 60)} ERROR deadline exceeded at ${limit}m, sent SIGTERM`,
      `${at(limit * 60)} Exit code unavailable`,
    ].join("\n")
  }
  if (run.status === "failed") {
    const attemptLine = `${at(duration)} Attempt ${run.attempt} of ${run.maxAttempts} failed, exit ${run.exitCode ?? 1}`
    if (job.id === "JOB-219") {
      // prettier-ignore
      const body: [number, string][] = [
        [4, "Fetched 8 settlement files from the bank SFTP drop"],
        [41, "Imported file 1 of 8, 162,300 records"],
        [78, "Imported file 2 of 8, 158,900 records"],
        [112, "Imported file 3 of 8, 171,200 records"],
        [150, "Imported file 4 of 8, 166,000 records"],
        [185, "Imported file 5 of 8, 154,000 records"],
        [192, "WARN memory at 1.9Gi of 2Gi limit"],
        [duration, "ERROR container terminated: OOMKilled (limit 2Gi)"],
        [duration, "Processed 812,400 of 1,284,112 records"],
      ]
      return [
        ...header,
        ...body.map(([offset, text]) => `${at(offset)} ${text}`),
        attemptLine,
      ].join("\n")
    }
    if (job.id === "JOB-233") {
      return [
        ...header,
        `${at(3)} Draining 4,812 queued deliveries`,
        `${at(duration)} ERROR POST /v1/deliveries/retry returned 503 for 212 deliveries`,
        attemptLine,
      ].join("\n")
    }
    return [
      ...header,
      `${at(3)} ${step}`,
      `${at(duration)} ERROR ${job.failure?.reason ?? "Command exited with an error"}`,
      attemptLine,
    ].join("\n")
  }

  const records =
    1200 + (((idSeed(job.id) + Number(runNumber)) * 7919) % 480_000)
  const lines = [...header]
  if (run.attempt > 1) {
    lines.push(
      `${at(Math.round(duration * 0.4))} WARN attempt 1 of ${run.maxAttempts} failed, retrying`
    )
  }
  lines.push(
    `${at(Math.max(2, duration - 1))} Processed ${formatCount(records)} records in ${Math.ceil(records / 25_000)} batches`,
    `${at(duration)} Exit 0 after ${formatDuration(duration)}`
  )
  return lines.join("\n")
}