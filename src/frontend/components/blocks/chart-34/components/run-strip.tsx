import { useState, type KeyboardEvent, type ReactNode } from "react"
import { cn } from "@/lib/utils"

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Separator } from "@/components/ui/separator"

import {
  formatDuration,
  formatPercent,
  formatRelative,
  formatStamp,
  RUN_STATUS,
  RUN_WINDOW,
  runStats,
  type CronJob,
  type JobRun,
} from "./data"
import { RunStatusFace } from "./value-faces"

/** A bar never drops below this share of the strip, so a skip still shows. */
const MIN_BAR = 12

/** Arrow keys walk the strip; one bar holds the tab stop. */
const KEY_MOVES: Record<string, (index: number, last: number) => number> = {
  ArrowLeft: (index) => Math.max(0, index - 1),
  ArrowRight: (index, last) => Math.min(last, index + 1),
  Home: () => 0,
  End: (_, last) => last,
}

function exitOf(run: JobRun) {
  if (run.status === "timedOut") return "Killed at limit"
  return run.exitCode === null ? "None" : String(run.exitCode)
}

function CardRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="flex flex-col gap-1.5 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground shrink-0">{label}</dt>
          <dd className="flex min-w-0 justify-end text-right tabular-nums">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function RunStrip({
  job,
  className,
}: {
  job: CronJob
  className?: string
}) {
  const runs = job.runs.slice(0, RUN_WINDOW).reverse()
  const last = runs.length - 1
  const [focusIndex, setFocusIndex] = useState(last)

  if (runs.length === 0) {
    return (
      <span className={cn("text-muted-foreground text-sm", className)}>
        No runs yet
      </span>
    )
  }

  const stats = runStats(job)
  const max = Math.max(1, ...runs.map((run) => run.durationSec))
  const p95 = stats.p95Sec === null ? "None" : formatDuration(stats.p95Sec)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = KEY_MOVES[event.key]
    if (!move) return
    event.preventDefault()
    const next = move(focusIndex, last)
    setFocusIndex(next)
    event.currentTarget.querySelectorAll("button")[next]?.focus()
  }

  return (
    <div
      role="group"
      aria-label={`${job.name}, last ${runs.length} runs, oldest first: ${
        stats.rate === null
          ? "no timed runs"
          : `${formatPercent(stats.rate)} succeeded`
      }`}
      onKeyDown={onKeyDown}
      // The bars tile edge to edge as hover targets, their padding is the gap;
      // the negative margin keeps the outer bars on the column's edges.
      className={cn(
        "group/strip -mx-0.5 grid h-10 grid-cols-20 @3xl/runs:-mx-0.75",
        className
      )}
    >
      {runs.map((run, index) => (
        <HoverCard key={run.id}>
          <HoverCardTrigger
            render={
              <button
                type="button"
                tabIndex={index === focusIndex ? 0 : -1}
                aria-label={`${formatStamp(run.startedAt)} UTC, ${RUN_STATUS[run.status].label}`}
                onFocus={() => setFocusIndex(index)}
                // A shorter history sits against the newest end.
                style={
                  index === 0
                    ? { gridColumnStart: RUN_WINDOW - runs.length + 1 }
                    : undefined
                }
                className="focus-visible:outline-ring/50 flex h-full min-w-0 items-end px-0.5 transition-opacity duration-150 group-hover/strip:opacity-40 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 motion-reduce:transition-none @3xl/runs:px-0.75"
              />
            }
          >
            <span
              aria-hidden="true"
              className={cn("w-full", RUN_STATUS[run.status].bar)}
              style={{
                height: `${Math.max((run.durationSec / max) * 100, MIN_BAR)}%`,
              }}
            />
          </HoverCardTrigger>
          <HoverCardContent className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-medium tabular-nums">
                {formatStamp(run.startedAt)} UTC
              </span>
              <RunStatusFace status={run.status} />
            </div>
            <Separator />
            <CardRows
              rows={[
                ["Started", formatRelative(run.startedAt)],
                [
                  "Duration",
                  run.status === "skipped"
                    ? "Did not run"
                    : formatDuration(run.durationSec),
                ],
                ["Exit code", exitOf(run)],
                ["Trigger", run.trigger === "manual" ? "Manual" : "Schedule"],
                ["Job p95", p95],
              ]}
            />
          </HoverCardContent>
        </HoverCard>
      ))}
    </div>
  )
}