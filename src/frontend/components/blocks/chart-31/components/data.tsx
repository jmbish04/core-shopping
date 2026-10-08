import { type ReactNode } from "react"
import { type BadgeProps } from "@/components/reui/badge"
import { firesBetween, nextFires, parseCron, previousFires } from "./cron"
import { BanknoteIcon, DatabaseIcon, WebhookIcon, ShieldCheckIcon, WalletIcon, ListChecksIcon, SearchIcon, BellIcon } from "lucide-react"

// ── Reference time ──

// customize: the demo's "now"; every label and number hangs off it.
const REFERENCE_ISO = "2026-09-29T14:20:00Z"
export const REFERENCE_MS = Date.parse(REFERENCE_ISO)
export const SUCCESS_SLO = 0.995

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000

// ── Types ──

type ServiceId =
  | "payments-api"
  | "ledger-worker"
  | "webhook-dispatcher"
  | "fraud-scorer"
  | "payouts-scheduler"
  | "reconciliation"
  | "search-indexer"
  | "notifications"
type TimezoneId = "UTC" | "America/New_York" | "Europe/Dublin"
export type RunStatus =
  "succeeded" | "failed" | "timedOut" | "skipped" | "running"
type RunTrigger = "scheduled" | "manual" | "retry"
export type JobHealth = "healthy" | "failing" | "paused"

type JobRun = {
  status: RunStatus
  trigger: RunTrigger
  startedAt: number
}

export type CronJob = {
  id: string
  name: string
  schedule: string
  timezone: TimezoneId
  enabled: boolean
  service: ServiceId
  pausedAt?: number
  runs: JobRun[]
}

// ── World ──

// prettier-ignore
export const SERVICE_ICONS: Record<ServiceId, ReactNode> = {
  "payments-api":       <BanknoteIcon aria-hidden="true" />,
  "ledger-worker":      <DatabaseIcon aria-hidden="true" />,
  "webhook-dispatcher": <WebhookIcon aria-hidden="true" />,
  "fraud-scorer":       <ShieldCheckIcon aria-hidden="true" />,
  "payouts-scheduler":  <WalletIcon aria-hidden="true" />,
  reconciliation:       <ListChecksIcon aria-hidden="true" />,
  "search-indexer":     <SearchIcon aria-hidden="true" />,
  notifications:        <BellIcon aria-hidden="true" />,
}

/** Fixed offsets in minutes, exact for the seed's windows (all inside summer time). */
const OFFSET_MIN: Record<TimezoneId, number> = {
  UTC: 0,
  "America/New_York": -240,
  "Europe/Dublin": 60,
}

const offsetOf = (timezone: TimezoneId) => OFFSET_MIN[timezone]

// customize: one face per run status. `tick` is the full tone the KPI strips
// use beside JOB_HEALTH ticks; `text` tones the Next Run caption.
export const RUN_STATUS: Record<
  RunStatus,
  { label: string; tick: string; text: string }
> = {
  succeeded: { label: "Succeeded", tick: "bg-success", text: "text-success" },
  failed: { label: "Failed", tick: "bg-destructive", text: "text-destructive" },
  timedOut: { label: "Timed Out", tick: "bg-warning", text: "text-warning" },
  skipped: { label: "Skipped", tick: "bg-info", text: "text-info" },
  running: { label: "Running", tick: "bg-primary", text: "text-primary" },
}

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

// ── Seed ──

type SeedHistory = {
  /** 20 chars, oldest to newest: s ok, r ok on attempt 2, f failed, t timed out, k skipped. */
  pattern: string
  extraRuns?: { at: string; status: RunStatus }[]
}

type RawJob = Omit<CronJob, "runs"> & { history: SeedHistory }

const ALL_OK = "ssssssssssssssssssss"

const SEED_OUTCOME: Record<string, RunStatus> = {
  f: "failed",
  t: "timedOut",
  k: "skipped",
}

// customize: the job fleet. Health, KPIs and charts all derive from it.
// prettier-ignore
const RAW_JOBS: RawJob[] = [
  { id: "JOB-214", name: "Nightly ledger reconciliation", schedule: "0 2 * * *", timezone: "UTC", enabled: true, service: "reconciliation", history: { pattern: "sssssssssrssssssssss" } },
  { id: "JOB-219", name: "Import bank settlement files", schedule: "30 * * * *", timezone: "UTC", enabled: true, service: "ledger-worker", history: { pattern: "sssssssssssssssssfff", extraRuns: [{ at: "2026-09-29T12:05:00Z", status: "failed" }] } },
  { id: "JOB-221", name: "Rotate webhook signing keys", schedule: "0 4 * * 1", timezone: "UTC", enabled: true, service: "webhook-dispatcher", history: { pattern: ALL_OK } },
  { id: "JOB-226", name: "Expire stale payout holds", schedule: "*/15 * * * *", timezone: "UTC", enabled: true, service: "payouts-scheduler", history: { pattern: "ssssssssskssssssssss" } },
  { id: "JOB-233", name: "Drain webhook retry queue", schedule: "*/5 * * * *", timezone: "UTC", enabled: true, service: "webhook-dispatcher", history: { pattern: "ssssssssssssssssssff" } },
  { id: "JOB-237", name: "Refresh fraud model features", schedule: "0 * * * *", timezone: "UTC", enabled: true, service: "fraud-scorer", history: { pattern: "sssssstsssssssssssss" } },
  { id: "JOB-240", name: "Rebuild merchant search index", schedule: "30 3 * * *", timezone: "UTC", enabled: true, service: "search-indexer", history: { pattern: "sssssssssssssssssstt" } },
  { id: "JOB-244", name: "Send payout digest emails", schedule: "0 9 * * 1-5", timezone: "America/New_York", enabled: true, service: "notifications", history: { pattern: ALL_OK } },
  { id: "JOB-248", name: "Compact ledger partitions", schedule: "0 3 * * 0", timezone: "UTC", enabled: false, service: "ledger-worker", pausedAt: Date.parse("2026-09-26T10:12:00Z"), history: { pattern: ALL_OK } },
  { id: "JOB-252", name: "Prune staging preview releases", schedule: "0 */6 * * *", timezone: "UTC", enabled: true, service: "payments-api", history: { pattern: ALL_OK, extraRuns: [{ at: "2026-09-29T09:12:00Z", status: "succeeded" }] } },
  { id: "JOB-257", name: "Reset sandbox test merchants", schedule: "0 5 * * *", timezone: "Europe/Dublin", enabled: true, service: "payments-api", history: { pattern: ALL_OK } },
  { id: "JOB-261", name: "Recalculate risk thresholds", schedule: "15 */4 * * *", timezone: "UTC", enabled: false, service: "fraud-scorer", pausedAt: Date.parse("2026-09-28T16:40:00Z"), history: { pattern: ALL_OK } },
  { id: "JOB-263", name: "Sync FX reference rates", schedule: "*/10 * * * *", timezone: "UTC", enabled: true, service: "payments-api", history: { pattern: ALL_OK } },
  { id: "JOB-266", name: "Archive delivered webhooks", schedule: "0 1 * * *", timezone: "UTC", enabled: true, service: "webhook-dispatcher", history: { pattern: ALL_OK } },
  { id: "JOB-270", name: "Vacuum ledger replicas", schedule: "30 4 * * *", timezone: "UTC", enabled: true, service: "ledger-worker", history: { pattern: "sssssssssssssssssrss" } },
  { id: "JOB-272", name: "Export daily settlement report", schedule: "0 6 * * *", timezone: "UTC", enabled: true, service: "reconciliation", history: { pattern: ALL_OK } },
  { id: "JOB-275", name: "Score dormant accounts", schedule: "0 0 * * *", timezone: "UTC", enabled: true, service: "fraud-scorer", history: { pattern: ALL_OK } },
  { id: "JOB-279", name: "Release scheduled payouts", schedule: "0 13,17,21 * * 1-5", timezone: "UTC", enabled: true, service: "payouts-scheduler", history: { pattern: ALL_OK } },
  { id: "JOB-281", name: "Retry failed payouts", schedule: "*/30 * * * *", timezone: "UTC", enabled: true, service: "payouts-scheduler", history: { pattern: "ssssssssfsssssssssss" } },
  { id: "JOB-284", name: "Warm merchant search cache", schedule: "*/20 * * * *", timezone: "UTC", enabled: true, service: "search-indexer", history: { pattern: ALL_OK } },
  { id: "JOB-288", name: "Purge expired idempotency keys", schedule: "45 * * * *", timezone: "UTC", enabled: true, service: "payments-api", history: { pattern: ALL_OK } },
  { id: "JOB-290", name: "Rotate database credentials", schedule: "0 5 1 * *", timezone: "UTC", enabled: true, service: "ledger-worker", history: { pattern: ALL_OK } },
  { id: "JOB-293", name: "Expire push notification tokens", schedule: "0 2 * * *", timezone: "Europe/Dublin", enabled: true, service: "notifications", history: { pattern: ALL_OK } },
  { id: "JOB-296", name: "Rebuild disputes index", schedule: "15 2 * * *", timezone: "UTC", enabled: false, service: "search-indexer", pausedAt: Date.parse("2026-09-27T09:05:00Z"), history: { pattern: ALL_OK } },
  { id: "JOB-301", name: "Send failed charge alerts", schedule: "*/5 * * * *", timezone: "UTC", enabled: true, service: "notifications", history: { pattern: ALL_OK } },
  { id: "JOB-304", name: "Reconcile card network fees", schedule: "0 7 * * 1-5", timezone: "UTC", enabled: true, service: "reconciliation", history: { pattern: ALL_OK } },
  { id: "JOB-308", name: "Seed staging ledger", schedule: "0 6 * * 1", timezone: "UTC", enabled: true, service: "ledger-worker", history: { pattern: ALL_OK } },
  { id: "JOB-311", name: "Replay sandbox webhooks", schedule: "0 */3 * * *", timezone: "UTC", enabled: false, service: "webhook-dispatcher", pausedAt: Date.parse("2026-09-24T18:30:00Z"), history: { pattern: ALL_OK } },
  { id: "JOB-315", name: "Check certificate expiry", schedule: "0 8 * * *", timezone: "UTC", enabled: true, service: "notifications", history: { pattern: ALL_OK } },
  { id: "JOB-318", name: "Load test fraud scorer", schedule: "0 22 * * 2", timezone: "UTC", enabled: false, service: "fraud-scorer", pausedAt: Date.parse("2026-09-22T11:00:00Z"), history: { pattern: "ssssssssssssssssstss" } },
  { id: "JOB-322", name: "Clean orphaned payout batches", schedule: "0 4 * * *", timezone: "UTC", enabled: true, service: "payouts-scheduler", history: { pattern: ALL_OK } },
  { id: "JOB-325", name: "Refresh sandbox API docs index", schedule: "0 */12 * * *", timezone: "UTC", enabled: true, service: "search-indexer", history: { pattern: ALL_OK } },
]

// ── Derivations ──

function parseSchedule(job: Pick<CronJob, "schedule">) {
  const result = parseCron(job.schedule)
  return result.ok ? result.cron : null
}

function buildHistory(job: Omit<CronJob, "runs">, history: SeedHistory) {
  const cron = parseSchedule(job)
  if (!cron) return []
  const fires = previousFires(
    cron,
    offsetOf(job.timezone),
    job.pausedAt ?? REFERENCE_MS,
    history.pattern.length
  )
  const runs = fires.map((at, index): JobRun => ({
    status: SEED_OUTCOME[history.pattern[index]] ?? "succeeded",
    trigger: "scheduled",
    startedAt: at,
  }))
  const extra = (history.extraRuns ?? []).map((run): JobRun => ({
    status: run.status,
    trigger: "manual",
    startedAt: Date.parse(run.at),
  }))
  return [...runs, ...extra].sort((a, b) => b.startedAt - a.startedAt)
}

export const JOBS: CronJob[] = RAW_JOBS.map(({ history, ...job }) => ({
  ...job,
  runs: buildHistory(job, history),
}))

export function healthOf(job: CronJob): JobHealth {
  if (!job.enabled) return "paused"
  const latest = job.runs.find(
    (run) => run.status !== "running" && run.status !== "skipped"
  )
  return latest?.status === "failed" || latest?.status === "timedOut"
    ? "failing"
    : "healthy"
}

/** The next fire, null when paused or never firing. */
function nextRunOf(job: CronJob): number | null {
  if (!job.enabled) return null
  const cron = parseSchedule(job)
  if (!cron) return null
  const [first] = nextFires(cron, offsetOf(job.timezone), REFERENCE_MS, 1)
  return first ?? null
}

// ── Fleet activity: the 24 hours before the reference time ──

const WINDOW_START = Math.floor(REFERENCE_MS / HOUR_MS) * HOUR_MS - 23 * HOUR_MS

type FireRecord = { at: number; status: RunStatus }

/** A seed job's fires in [from, to): its recorded run where one exists, else a
 *  success; manual runs join by start time. */
function seedRecords(job: CronJob, from: number, to: number): FireRecord[] {
  const cron = parseSchedule(job)
  const until = Math.min(to, job.pausedAt ?? Infinity)
  const byStart = new Map(job.runs.map((run) => [run.startedAt, run]))
  const fires = cron
    ? firesBetween(cron, offsetOf(job.timezone), from, until)
    : []
  const records: FireRecord[] = fires.map((at) => ({
    at,
    status: byStart.get(at)?.status ?? "succeeded",
  }))
  for (const run of job.runs) {
    if (
      run.trigger !== "scheduled" &&
      run.startedAt >= from &&
      run.startedAt < to
    ) {
      records.push({ at: run.startedAt, status: run.status })
    }
  }
  return records
}

export type FleetBucket = {
  start: number
  succeeded: number
  failed: number
  timedOut: number
}

export type FleetActivity = {
  buckets: FleetBucket[]
  succeeded: number
  failed: number
  timedOut: number
  failingJobs: number
  /** The job with the most failed and timed-out runs; ties keep fleet order. */
  worst: { job: CronJob; failures: number } | null
}

export function fleetActivity(jobs: CronJob[]): FleetActivity {
  const buckets: FleetBucket[] = Array.from({ length: 24 }, (_, index) => ({
    start: WINDOW_START + index * HOUR_MS,
    succeeded: 0,
    failed: 0,
    timedOut: 0,
  }))
  let failingJobs = 0
  let worst: FleetActivity["worst"] = null
  for (const job of jobs) {
    let failures = 0
    for (const { at, status } of seedRecords(job, WINDOW_START, REFERENCE_MS)) {
      if (
        status !== "succeeded" &&
        status !== "failed" &&
        status !== "timedOut"
      )
        continue
      const index = Math.min(
        23,
        Math.max(0, Math.floor((at - WINDOW_START) / HOUR_MS))
      )
      buckets[index][status] += 1
      if (status !== "succeeded") failures += 1
    }
    if (failures === 0) continue
    failingJobs += 1
    if (!worst || failures > worst.failures) worst = { job, failures }
  }
  const sum = (key: "succeeded" | "failed" | "timedOut") =>
    buckets.reduce((total, bucket) => total + bucket[key], 0)
  return {
    buckets,
    succeeded: sum("succeeded"),
    failed: sum("failed"),
    timedOut: sum("timedOut"),
    failingJobs,
    worst,
  }
}

type UpNextEntry = { job: CronJob; at: number }

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
type FireSlot = { end: number; healthy: number; failing: number }

const SLOT_MS = 5 * MINUTE_MS

/** Runs firing in the hour after the reference time, failing jobs counted
 *  apart. */
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
      const slot = slots[Math.ceil((at - REFERENCE_MS) / SLOT_MS) - 1]
      if (failing) slot.failing += 1
      else slot.healthy += 1
    }
  }
  return slots
}

// ── Formatters (always UTC) ──

const countFormat = new Intl.NumberFormat("en-US")
const percentFormat = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
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
function formatClock(ms: number) {
  const date = new Date(ms)
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

/** "14:25 UTC" */
export const formatTime = (ms: number) => `${formatClock(ms)} UTC`

/** "Sep 30, 02:00" */
const formatShort = (ms: number) =>
  `${monthDayFormat.format(ms)}, ${formatClock(ms)}`

const isToday = (ms: number) =>
  Math.floor(ms / 86_400_000) === Math.floor(REFERENCE_MS / 86_400_000)

/** Today reads as a time; any other day carries its date. */
export const formatWhen = (ms: number) =>
  isToday(ms) ? formatTime(ms) : formatShort(ms)

/** "14:30" today, "Sep 30" on any other day. */
export const formatBrief = (ms: number) =>
  isToday(ms) ? formatClock(ms) : monthDayFormat.format(ms)

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