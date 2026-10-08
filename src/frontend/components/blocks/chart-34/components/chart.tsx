"use client"

/** The Run History panel: a fleet summary over one row per cron job, each row
 *  carrying its last run, a full-width chart of its last 20 runs and its rate. */
import { Fragment } from "react"
import { FramePanel } from "@/components/reui/frame"
import { cn } from "@/lib/utils"

import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import {
  commandArgsOf,
  formatDuration,
  formatPercent,
  formatRelative,
  formatStamp,
  healthOf,
  JOBS,
  REFERENCE_MS,
  RUN_STATUS,
  RUN_STATUSES,
  RUN_WINDOW,
  runStats,
  type CronJob,
} from "./data"
import { RunStrip } from "./run-strip"
import { RunSummary } from "./run-summary"
import { SectionFoot, SectionFrame, SectionHead } from "./section-header"
import {
  DotSeparator,
  HealthFace,
  RunStatusFace,
  RunStatusSwatch,
} from "./value-faces"
import { HistoryIcon } from "lucide-react"

/** Column widths shared by the head row and every job row, so they align. */
const COL = {
  job: "@3xl/runs:w-60 @3xl/runs:flex-none @3xl/runs:basis-auto",
  lastRun: "w-36 shrink-0",
  // Phones put the chart on its own full-width line under the row's facts.
  chart:
    "order-last min-w-0 basis-full @3xl/runs:order-none @3xl/runs:flex-1 @3xl/runs:basis-0",
  rate: "ms-auto w-20 shrink-0 text-right",
}

const plural = (count: number, noun: string) =>
  `${count} ${count === 1 ? noun : `${noun}s`}`

function LastRunCell({ job }: { job: CronJob }) {
  const latest = job.runs[0]
  if (!latest) {
    return <span className="text-muted-foreground text-sm">Never run</span>
  }
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <RunStatusFace status={latest.status} />
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs whitespace-nowrap tabular-nums">
        {formatRelative(latest.startedAt)}
        {latest.status !== "skipped" ? (
          <>
            <DotSeparator />
            {formatDuration(latest.durationSec)}
          </>
        ) : null}
      </span>
    </div>
  )
}

function RateCell({ job }: { job: CronJob }) {
  const stats = runStats(job)
  return (
    <div className="flex flex-col items-end gap-0.5 tabular-nums">
      <span className="text-sm font-medium">
        {stats.rate === null ? "None" : formatPercent(stats.rate)}
      </span>
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        p95 {stats.p95Sec === null ? "none" : formatDuration(stats.p95Sec)}
      </span>
    </div>
  )
}

function JobRow({ job }: { job: CronJob }) {
  const paused = healthOf(job) === "paused"
  return (
    <Item
      role="listitem"
      size="sm"
      // Paused rows dim; the badge says so in words, not by the dimming alone.
      className={cn("px-(--frame-panel-px)", paused && "opacity-55")}
    >
      <ItemContent className={cn("min-w-0 basis-full gap-0.5", COL.job)}>
        {/* The span truncates: a flex title clips with no ellipsis. */}
        <ItemTitle className="max-w-full min-w-0">
          <span className="min-w-0 truncate">{job.name}</span>
          {paused ? <HealthFace health="paused" /> : null}
        </ItemTitle>
        <ItemDescription className="truncate font-mono text-xs">
          {commandArgsOf(job.command)}
        </ItemDescription>
      </ItemContent>
      <div className={COL.lastRun}>
        <LastRunCell job={job} />
      </div>
      <RunStrip job={job} className={COL.chart} />
      <div className={COL.rate}>
        <RateCell job={job} />
      </div>
    </Item>
  )
}

export function Chart() {
  return (
    <div className="@container w-full max-w-6xl">
      <SectionFrame>
        <SectionHead
          icon={
            <HistoryIcon aria-hidden="true" />
          }
          title="Run History"
          description={
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
              {plural(JOBS.length, "cron job")}
              <DotSeparator />
              As of {formatStamp(REFERENCE_MS)} UTC
            </span>
          }
        />
        <RunSummary jobs={JOBS} />
        {/* Wide panels hold one line per job; phones stack the facts and give
            the chart its own line. */}
        <FramePanel className="@container/runs p-0">
          <Item
            size="sm"
            aria-hidden="true"
            className="text-muted-foreground hidden px-(--frame-panel-px) text-xs font-medium @3xl/runs:flex"
          >
            <span className={cn("flex-1", COL.job)}>Job</span>
            <span className={COL.lastRun}>Last Run</span>
            <span className={cn("flex justify-between gap-3", COL.chart)}>
              <span>Last {RUN_WINDOW} Runs</span>
              <span className="font-normal">Oldest to newest</span>
            </span>
            <span className={COL.rate}>Success</span>
          </Item>
          <ItemSeparator className="my-0 hidden @3xl/runs:block" />
          <ItemGroup className="gap-0">
            {JOBS.map((job, index) => (
              <Fragment key={job.id}>
                {index > 0 ? <ItemSeparator className="my-0" /> : null}
                <JobRow job={job} />
              </Fragment>
            ))}
          </ItemGroup>
        </FramePanel>
        <SectionFoot>
          <ul
            aria-label="Bar tones"
            className="flex flex-wrap items-center gap-x-4 gap-y-1"
          >
            {RUN_STATUSES.map((status) => (
              <li key={status} className="flex items-center gap-1.5">
                <RunStatusSwatch status={status} />
                {RUN_STATUS[status].label}
              </li>
            ))}
          </ul>
          <span>Bar height is run duration</span>
        </SectionFoot>
      </SectionFrame>
    </div>
  )
}