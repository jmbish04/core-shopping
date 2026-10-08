import { type BadgeProps } from "@/components/reui/badge"

// ── Reference time ──

// customize: the demo's "now"; every label and number hangs off it.
const REFERENCE_ISO = "2026-09-29T14:20:00Z"
export const REFERENCE_MS = Date.parse(REFERENCE_ISO)

/** Each strip, rate and p95 reads a job's newest 20 runs. */
export const RUN_WINDOW = 20

const MINUTE_MS = 60_000

// ── Types ──

export type RunStatus = "succeeded" | "failed" | "timedOut" | "skipped"
export type JobHealth = "healthy" | "failing" | "paused"
type RunTrigger = "schedule" | "manual"

export type JobRun = {
  id: string
  status: RunStatus
  trigger: RunTrigger
  startedAt: number
  durationSec: number
  exitCode: number | null
}

export type CronJob = {
  id: string
  name: string
  command: string
  enabled: boolean
  runs: JobRun[]
}

/** Legend and tally order: the outcome first, then the exceptions. */
export const RUN_STATUSES = [
  "succeeded",
  "failed",
  "timedOut",
  "skipped",
] as const satisfies readonly RunStatus[]

// customize: one face per run status, shared by the badges and the bars.
export const RUN_STATUS: Record<
  RunStatus,
  { label: string; variant: BadgeProps["variant"]; bar: string }
> = {
  succeeded: {
    label: "Succeeded",
    variant: "success-light",
    bar: "bg-success/40",
  },
  failed: {
    label: "Failed",
    variant: "destructive-light",
    bar: "bg-destructive",
  },
  timedOut: {
    label: "Timed Out",
    variant: "warning-light",
    bar: "bg-warning",
  },
  skipped: {
    label: "Skipped",
    variant: "info-light",
    // The skip stub is the smallest mark, so dark lifts it off the card.
    bar: "bg-info/40 dark:bg-info/70",
  },
}

// customize: one face per job health; a paused job carries it beside its name.
export const JOB_HEALTH: Record<
  JobHealth,
  { label: string; variant: BadgeProps["variant"] }
> = {
  healthy: { label: "Healthy", variant: "success-light" },
  failing: { label: "Failing", variant: "destructive-light" },
  paused: { label: "Paused", variant: "info-light" },
}

// ── Seed ──

type SeedHistory = {
  /** 20 chars, oldest to newest: s succeeded, f failed, t timed out, k skipped. */
  pattern: string
  /** The newest scheduled fire; each earlier one sits `everyMin` before it. */
  lastFire: string
  everyMin: number
  extraRuns?: { at: string; status: RunStatus }[]
}

type RawJob = Omit<CronJob, "runs"> & {
  baseDurationSec: number
  timeoutMin: number
  failure?: { exitCode: number }
  history: SeedHistory
}

const ALL_OK = "ssssssssssssssssssss"

// customize: the jobs, failing first, then by next fire. Stats derive from the runs.
// prettier-ignore
const RAW_JOBS: RawJob[] = [
  { id: "JOB-233", name: "Drain webhook retry queue", command: "harbor run webhook-dispatcher -- retries:drain --max=5000", enabled: true, baseDurationSec: 52, timeoutMin: 4, failure: { exitCode: 1 }, history: { pattern: "ssssssssssssssssssff", lastFire: "2026-09-29T14:15:00Z", everyMin: 5 } },
  { id: "JOB-219", name: "Import bank settlement files", command: "harbor run ledger-worker -- settlements:import --banks=all", enabled: true, baseDurationSec: 252, timeoutMin: 15, failure: { exitCode: 137 }, history: { pattern: "sssssssssssssssssfff", lastFire: "2026-09-29T13:30:00Z", everyMin: 60, extraRuns: [{ at: "2026-09-29T12:05:00Z", status: "failed" }] } },
  { id: "JOB-240", name: "Rebuild merchant search index", command: "harbor run search-indexer -- reindex merchants --shards=12", enabled: true, baseDurationSec: 2860, timeoutMin: 60, history: { pattern: "sssssssssssssssssstt", lastFire: "2026-09-29T03:30:00Z", everyMin: 1440 } },
  { id: "JOB-226", name: "Expire stale payout holds", command: "harbor run payouts-scheduler -- holds:expire --older-than=72h", enabled: true, baseDurationSec: 18, timeoutMin: 10, history: { pattern: "ssssssssskssssssssss", lastFire: "2026-09-29T14:15:00Z", everyMin: 15 } },
  { id: "JOB-281", name: "Retry failed payouts", command: "harbor run payouts-scheduler -- payouts:retry --max-attempts=3", enabled: true, baseDurationSec: 100, timeoutMin: 10, failure: { exitCode: 1 }, history: { pattern: "ssssssssfsssssssssss", lastFire: "2026-09-29T14:00:00Z", everyMin: 30 } },
  { id: "JOB-248", name: "Compact ledger partitions", command: "harbor run ledger-worker -- partitions:compact --keep=90d", enabled: false, baseDurationSec: 2820, timeoutMin: 120, history: { pattern: ALL_OK, lastFire: "2026-09-20T03:00:00Z", everyMin: 10080 } },
  { id: "JOB-221", name: "Rotate webhook signing keys", command: "harbor run webhook-dispatcher -- keys:rotate --grace=48h", enabled: true, baseDurationSec: 41, timeoutMin: 15, history: { pattern: ALL_OK, lastFire: "2026-09-28T04:00:00Z", everyMin: 10080 } },
]

// ── Derivations ──

/** Sum of the id's char codes: a stable per-job seed for demo variation. */
function idSeed(id: string) {
  let total = 0
  for (const char of id) total += char.charCodeAt(0)
  return total
}

function succeededDuration(
  job: Pick<RawJob, "id" | "baseDurationSec">,
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
  startedAt: number
): JobRun {
  const base = {
    id: `${raw.id}-${index + 1}`,
    trigger: "schedule" as const,
    startedAt,
  }
  switch (char) {
    case "f":
      return {
        ...base,
        status: "failed",
        durationSec: raw.baseDurationSec,
        exitCode: raw.failure?.exitCode ?? 1,
      }
    case "t":
      return {
        ...base,
        status: "timedOut",
        durationSec: raw.timeoutMin * 60,
        exitCode: null,
      }
    case "k":
      return { ...base, status: "skipped", durationSec: 0, exitCode: null }
    default:
      return {
        ...base,
        status: "succeeded",
        durationSec: succeededDuration(raw, index),
        exitCode: 0,
      }
  }
}

/** Scheduled runs from the pattern plus manual runs, newest first. */
function buildHistory(raw: RawJob): JobRun[] {
  const { pattern, lastFire, everyMin, extraRuns = [] } = raw.history
  const last = Date.parse(lastFire)
  const runs = [...pattern].map((char, index) =>
    scheduledRun(
      raw,
      char,
      index,
      last - (pattern.length - 1 - index) * everyMin * MINUTE_MS
    )
  )
  const extra = extraRuns.map((run, index): JobRun => {
    const failed = run.status === "failed"
    return {
      id: `${raw.id}-manual-${index + 1}`,
      status: run.status,
      trigger: "manual",
      startedAt: Date.parse(run.at),
      durationSec: failed ? raw.baseDurationSec : succeededDuration(raw, 19),
      exitCode: failed ? (raw.failure?.exitCode ?? 1) : 0,
    }
  })
  return [...runs, ...extra].sort((a, b) => b.startedAt - a.startedAt)
}

export const JOBS: CronJob[] = RAW_JOBS.map((raw) => ({
  id: raw.id,
  name: raw.name,
  command: raw.command,
  enabled: raw.enabled,
  runs: buildHistory(raw),
}))

export function healthOf(job: CronJob): JobHealth {
  if (!job.enabled) return "paused"
  const latest = job.runs.find((run) => run.status !== "skipped")
  return latest?.status === "failed" || latest?.status === "timedOut"
    ? "failing"
    : "healthy"
}

/** The arguments after "--": the runner prefix repeats on every row. */
export const commandArgsOf = (command: string) =>
  command.split(" -- ")[1] ?? command

type Tally = Record<RunStatus, number> & {
  total: number
  /** Succeeded over timed runs; a skipped run spends no time and counts no outcome. */
  rate: number | null
}

function tally(runs: JobRun[]): Tally {
  const counts = { succeeded: 0, failed: 0, timedOut: 0, skipped: 0 }
  for (const run of runs) counts[run.status] += 1
  const outcomes = runs.length - counts.skipped
  return {
    ...counts,
    total: runs.length,
    rate: outcomes > 0 ? counts.succeeded / outcomes : null,
  }
}

/** One job over its window: the tally plus the p95 of its timed runs. */
export function runStats(job: CronJob) {
  const recent = job.runs.slice(0, RUN_WINDOW)
  const durations = recent
    .filter((run) => run.status !== "skipped")
    .map((run) => run.durationSec)
    .sort((a, b) => a - b)
  return {
    ...tally(recent),
    p95Sec: durations.length
      ? durations[Math.ceil(0.95 * durations.length) - 1]
      : null,
  }
}

/** Every job's window pooled, plus the newer and older halves for the trend. */
export function fleetStats(jobs: CronJob[]) {
  const half = RUN_WINDOW / 2
  return {
    ...tally(jobs.flatMap((job) => job.runs.slice(0, RUN_WINDOW))),
    newerRate: tally(jobs.flatMap((job) => job.runs.slice(0, half))).rate,
    olderRate: tally(jobs.flatMap((job) => job.runs.slice(half, RUN_WINDOW)))
      .rate,
  }
}

/** The unbroken failures and timeouts at the head of the history, newest first. */
export function failureStreakOf(job: CronJob) {
  const streak: JobRun[] = []
  for (const run of job.runs) {
    if (run.status === "skipped") continue
    if (run.status === "succeeded") break
    streak.push(run)
  }
  return streak
}

// ── Formatters (always UTC) ──

const percentFormat = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const pad = (value: number) => String(value).padStart(2, "0")

export const formatPercent = (value: number) => percentFormat.format(value)

const stampFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
})

/** "Sep 29, 13:30" */
export const formatStamp = (ms: number) => stampFormat.format(ms)

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