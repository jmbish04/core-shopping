import { type ReactNode } from "react"

import { type ChartConfig } from "@/components/ui/chart"
import { ShieldCheckIcon } from "lucide-react"

// ── Types ──

export type ServiceId = "fraud-scorer"
export type RunStatus =
  "succeeded" | "failed" | "timedOut" | "skipped" | "running"

export type JobRun = {
  id: string
  status: RunStatus
  durationSec: number
}

export type CronJob = {
  /** File-safe id, used to name exports. */
  slug: string
  name: string
  /** The schedule in words, read in the job's timezone. */
  cadence: string
  timezone: string
  service: ServiceId
  timeoutMin: number
  runs: JobRun[]
}

// ── World ──

// prettier-ignore
export const SERVICES: Record<ServiceId, { icon: ReactNode }> = {
  "fraud-scorer": { icon: <ShieldCheckIcon aria-hidden="true" /> },
}

// customize: one tone per run status, shared by the bars and the readout.
export const RUN_STATUS: Record<RunStatus, { label: string; color: string }> = {
  succeeded: { label: "Succeeded", color: "var(--success)" },
  failed: { label: "Failed", color: "var(--destructive)" },
  timedOut: { label: "Timed Out", color: "var(--warning)" },
  skipped: { label: "Skipped", color: "var(--info)" },
  running: { label: "Running", color: "var(--primary)" },
}

export const DURATION_CHART_CONFIG = {
  durationSec: { label: "Duration", color: "var(--primary)" },
} satisfies ChartConfig

// customize: the job and its last 50 runs; one timed out at the 20m limit,
// one failed fast and one was skipped.
export const JOB: CronJob = {
  slug: "refresh-fraud-model-features",
  name: "Refresh fraud model features",
  cadence: "Hourly at :00",
  timezone: "UTC",
  service: "fraud-scorer",
  timeoutMin: 20,
  runs: [
    { id: "RUN-58418", status: "succeeded", durationSec: 348 },
    { id: "RUN-58417", status: "succeeded", durationSec: 444 },
    { id: "RUN-58416", status: "succeeded", durationSec: 392 },
    { id: "RUN-58415", status: "succeeded", durationSec: 340 },
    { id: "RUN-58414", status: "succeeded", durationSec: 436 },
    { id: "RUN-58413", status: "succeeded", durationSec: 384 },
    { id: "RUN-58412", status: "succeeded", durationSec: 332 },
    { id: "RUN-58411", status: "succeeded", durationSec: 428 },
    { id: "RUN-58410", status: "succeeded", durationSec: 376 },
    { id: "RUN-58409", status: "succeeded", durationSec: 472 },
    { id: "RUN-58408", status: "succeeded", durationSec: 420 },
    { id: "RUN-58407", status: "succeeded", durationSec: 368 },
    { id: "RUN-58406", status: "succeeded", durationSec: 464 },
    { id: "RUN-58405", status: "timedOut", durationSec: 1200 },
    { id: "RUN-58404", status: "succeeded", durationSec: 360 },
    { id: "RUN-58403", status: "succeeded", durationSec: 456 },
    { id: "RUN-58402", status: "succeeded", durationSec: 404 },
    { id: "RUN-58401", status: "succeeded", durationSec: 352 },
    { id: "RUN-58400", status: "succeeded", durationSec: 448 },
    { id: "RUN-58399", status: "succeeded", durationSec: 396 },
    { id: "RUN-58398", status: "succeeded", durationSec: 388 },
    { id: "RUN-58397", status: "succeeded", durationSec: 452 },
    { id: "RUN-58396", status: "succeeded", durationSec: 344 },
    { id: "RUN-58395", status: "succeeded", durationSec: 416 },
    { id: "RUN-58394", status: "succeeded", durationSec: 372 },
    { id: "RUN-58393", status: "succeeded", durationSec: 468 },
    { id: "RUN-58392", status: "succeeded", durationSec: 356 },
    { id: "RUN-58391", status: "failed", durationSec: 94 },
    { id: "RUN-58390", status: "succeeded", durationSec: 400 },
    { id: "RUN-58389", status: "succeeded", durationSec: 336 },
    { id: "RUN-58388", status: "succeeded", durationSec: 440 },
    { id: "RUN-58387", status: "succeeded", durationSec: 380 },
    { id: "RUN-58386", status: "succeeded", durationSec: 460 },
    { id: "RUN-58385", status: "succeeded", durationSec: 348 },
    { id: "RUN-58384", status: "succeeded", durationSec: 412 },
    { id: "RUN-58383", status: "skipped", durationSec: 0 },
    { id: "RUN-58382", status: "succeeded", durationSec: 476 },
    { id: "RUN-58381", status: "succeeded", durationSec: 364 },
    { id: "RUN-58380", status: "succeeded", durationSec: 428 },
    { id: "RUN-58379", status: "succeeded", durationSec: 352 },
    { id: "RUN-58378", status: "succeeded", durationSec: 444 },
    { id: "RUN-58377", status: "succeeded", durationSec: 396 },
    { id: "RUN-58376", status: "succeeded", durationSec: 336 },
    { id: "RUN-58375", status: "succeeded", durationSec: 456 },
    { id: "RUN-58374", status: "succeeded", durationSec: 372 },
    { id: "RUN-58373", status: "succeeded", durationSec: 420 },
    { id: "RUN-58372", status: "succeeded", durationSec: 384 },
    { id: "RUN-58371", status: "succeeded", durationSec: 468 },
    { id: "RUN-58370", status: "succeeded", durationSec: 340 },
    { id: "RUN-58369", status: "succeeded", durationSec: 408 },
  ],
}

// ── Derivations ──

// customize: a manual run finishes after this many ms, with these durations in turn.
export const MANUAL_RUN = { finishMs: 4000, durationsSec: [372, 418, 356] }

/** How many recent runs the chart shows. */
export const RUN_WINDOWS = [20, 50] as const
export type RunWindow = (typeof RUN_WINDOWS)[number]

export type RunStats = {
  p95Sec: number | null
  succeeded: number
}

/** Over the runs shown; a skipped run spends no time. */
export function runStats(recent: JobRun[]): RunStats {
  const durations = recent
    .filter((run) => run.status !== "skipped")
    .map((run) => run.durationSec)
    .sort((a, b) => a - b)
  return {
    p95Sec: durations.length
      ? durations[Math.ceil(0.95 * durations.length) - 1]
      : null,
    succeeded: recent.filter((run) => run.status === "succeeded").length,
  }
}

// ── Formatters ──

const pad = (value: number) => String(value).padStart(2, "0")

/** "47s", "2m 14s", "1h 02m" */
export function formatDuration(totalSec: number) {
  const sec = Math.max(0, Math.round(totalSec))
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${pad(sec % 60)}s`
  return `${Math.floor(sec / 3600)}h ${pad(Math.floor((sec % 3600) / 60))}m`
}