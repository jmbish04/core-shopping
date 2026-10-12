import { type ReactNode } from "react"
import { FramePanel } from "@/components/reui/frame"
import { cn } from "@/lib/utils"

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"

import {
  failureStreakOf,
  fleetStats,
  formatDuration,
  formatPercent,
  healthOf,
  RUN_STATUS,
  RUN_STATUSES,
  RUN_WINDOW,
  type CronJob,
} from "./data"
import { DotSeparator, RunStatusFace, RunStatusSwatch } from "./value-faces"

function ColumnHead({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h4 className="text-muted-foreground shrink-0 text-xs font-medium">
        {title}
      </h4>
      {meta ? (
        <span className="text-muted-foreground min-w-0 truncate text-xs tabular-nums">
          {meta}
        </span>
      ) : null}
    </div>
  )
}

/** "down from", "up from" or "level with" the older half. */
function trendOf(newer: number, older: number) {
  if (newer < older) return "down from"
  return newer > older ? "up from" : "level with"
}

export function RunSummary({ jobs }: { jobs: CronJob[] }) {
  const fleet = fleetStats(jobs)
  const timed = fleet.total - fleet.skipped
  // Worst first: the longest streak, then the most recent failure.
  const failing = jobs
    .filter((job) => healthOf(job) === "failing")
    .map((job) => ({ job, streak: failureStreakOf(job) }))
    .sort(
      (a, b) =>
        b.streak.length - a.streak.length ||
        (b.streak[0]?.startedAt ?? 0) - (a.streak[0]?.startedAt ?? 0)
    )

  return (
    <FramePanel className="@container/summary">
      {/* Three columns with rules between once the panel is wide; the rules
          span the second row at mid widths and everything stacks on phones. */}
      <div className="grid gap-6 @2xl/summary:grid-cols-2 @4xl/summary:grid-cols-[14rem_minmax(0,1fr)_minmax(0,1.3fr)] @4xl/summary:gap-0 @4xl/summary:divide-x">
        <section className="flex min-w-0 flex-col gap-3 @4xl/summary:pe-6">
          <ColumnHead title="Success Rate" />
          <div className="flex flex-col gap-1">
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {fleet.rate === null ? "None" : formatPercent(fleet.rate)}
            </p>
            <p className="text-muted-foreground text-sm text-pretty tabular-nums">
              {fleet.succeeded} of {timed} timed runs succeeded across{" "}
              {jobs.length} jobs.
            </p>
          </div>
          {fleet.newerRate !== null && fleet.olderRate !== null ? (
            <p className="text-muted-foreground mt-auto text-xs text-pretty tabular-nums">
              <span className="text-foreground font-medium">
                {formatPercent(fleet.newerRate)}
              </span>{" "}
              over each job&apos;s newest {RUN_WINDOW / 2} runs,{" "}
              {trendOf(fleet.newerRate, fleet.olderRate)}{" "}
              {formatPercent(fleet.olderRate)}
            </p>
          ) : null}
        </section>

        <section className="flex min-w-0 flex-col gap-3 @4xl/summary:px-6">
          <ColumnHead title="Outcomes" meta={`${fleet.total} runs`} />
          {/* The mix at a glance, in the strips' own tones. */}
          <div aria-hidden="true" className="flex h-2 gap-0.5">
            {RUN_STATUSES.filter((status) => fleet[status] > 0).map(
              (status) => (
                <span
                  key={status}
                  className={cn("min-w-1 basis-0", RUN_STATUS[status].bar)}
                  style={{ flexGrow: fleet[status] }}
                />
              )
            )}
          </div>
          <ul className="flex flex-col gap-2">
            {RUN_STATUSES.map((status) => (
              <li
                key={status}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <RunStatusSwatch status={status} />
                  <span className="text-muted-foreground truncate">
                    {RUN_STATUS[status].label}
                  </span>
                </span>
                <span className="font-medium tabular-nums">
                  {fleet[status]}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex min-w-0 flex-col gap-3 @2xl/summary:col-span-2 @4xl/summary:col-span-1 @4xl/summary:ps-6">
          <ColumnHead
            title="Failing Jobs"
            meta={`${failing.length} of ${jobs.length} jobs`}
          />
          {failing.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Every enabled job passed its last run.
            </p>
          ) : (
            <ItemGroup className="gap-2">
              {failing.map(({ job, streak }) => {
                const latest = streak[0]
                return (
                  <Item key={job.id} size="xs" variant="outline">
                    <ItemContent className="min-w-0">
                      <ItemTitle className="max-w-full min-w-0">
                        <span className="min-w-0 truncate">{job.name}</span>
                      </ItemTitle>
                      <ItemDescription className="flex min-w-0 items-center gap-1.5 tabular-nums">
                        <span className="shrink-0">
                          {streak.length} in a row
                        </span>
                        <DotSeparator />
                        <span className="truncate">
                          {latest.status === "timedOut"
                            ? `killed at ${formatDuration(latest.durationSec)}`
                            : `exit ${latest.exitCode ?? 1}`}
                        </span>
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <RunStatusFace status={latest.status} />
                    </ItemActions>
                  </Item>
                )
              })}
            </ItemGroup>
          )}
        </section>
      </div>
    </FramePanel>
  )
}