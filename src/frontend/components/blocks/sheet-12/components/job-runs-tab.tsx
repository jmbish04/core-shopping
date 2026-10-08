import { Fragment, useMemo } from "react"
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockExpandButton,
  CodeBlockHeader,
  CodeBlockTitle,
  type CodeBlockLine,
} from "@/components/reui/code-block/code-block"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"

import {
  buildRunLog,
  formatDuration,
  formatRelative,
  formatShortUtc,
  isRunning,
  runStats,
  type CronJob,
  type JobRun,
} from "./data"
import { ROW_CHEVRON, UI_ICONS } from "./icons"
import { CODE_DENSITY } from "./job-overview-tab"
import {
  DotSeparator,
  OwnerFace,
  RunStatusGlyph,
  SchedulerFace,
  TriggerFace,
} from "./value-faces"

/** Plain log text as CodeBlock lines; ERROR and WARN lines carry a level tint. */
function toLogLines(text: string): CodeBlockLine[] {
  return text.split("\n").map((line, index) => {
    const level = line.includes("ERROR")
      ? "error"
      : line.includes("WARN")
        ? "warning"
        : null
    return {
      tokens: line ? [{ content: line }] : [],
      number: index + 1,
      text: line,
      ...(level ? { state: { level } } : {}),
    }
  })
}

function runDetail(run: JobRun) {
  if (run.status === "failed") {
    return `Exit ${run.exitCode ?? 1}, attempt ${run.attempt} of ${run.maxAttempts}`
  }
  if (run.status === "timedOut") {
    return `Timed out after ${Math.round(run.durationSec / 60)}m`
  }
  if (run.status === "succeeded" && run.attempt > 1) {
    return `Succeeded on attempt ${run.attempt} of ${run.maxAttempts}`
  }
  return null
}

function RunLog({ job, run }: { job: CronJob; run: JobRun }) {
  const lines = useMemo(() => toLogLines(buildRunLog(job, run)), [job, run])
  return (
    <CodeBlock
      lines={lines}
      showLineNumbers
      maxLines={12}
      className={CODE_DENSITY}
    >
      <CodeBlockHeader className="min-h-8 gap-2 px-2.5">
        <CodeBlockTitle className="truncate">{run.id}.log</CodeBlockTitle>
        <CodeBlockCopyButton className="ms-auto" />
      </CodeBlockHeader>
      {/* No CodeBlockContent: the root owns its scroll, the only shape where
          maxLines applies. */}
      <CodeBlockExpandButton className="pt-6" />
    </CodeBlock>
  )
}

function RunRow({
  job,
  run,
  expanded,
  onExpandedChange,
  onRetry,
}: {
  job: CronJob
  run: JobRun
  expanded: boolean
  onExpandedChange: (id: string | null) => void
  onRetry: () => void
}) {
  const detail = runDetail(run)
  const timed = run.status !== "skipped" && run.status !== "running"
  const failed = run.status === "failed" || run.status === "timedOut"

  return (
    <Collapsible
      open={expanded}
      onOpenChange={(open) => onExpandedChange(open ? run.id : null)}
    >
      <CollapsibleTrigger
        render={
          <button
            type="button"
            className="flex w-full items-start gap-3 py-2 text-start"
          />
        }
      >
        <RunStatusGlyph status={run.status} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-sm">{run.id}</span>
            <TriggerFace trigger={run.trigger} />
          </span>
          <span className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
            {formatShortUtc(run.startedAt)}
            <DotSeparator />
            {formatRelative(run.startedAt)}
            <DotSeparator />
            {run.triggeredBy === "scheduler" ? (
              <SchedulerFace />
            ) : (
              <OwnerFace ownerId={run.triggeredBy} compact />
            )}
          </span>
          {detail ? (
            <span className="text-muted-foreground text-xs tabular-nums">
              {detail}
            </span>
          ) : null}
        </span>
        {timed ? (
          <span className="text-muted-foreground flex h-5 shrink-0 items-center self-start text-xs tabular-nums">
            {formatDuration(run.durationSec)}
          </span>
        ) : null}
        <span className="flex h-5 shrink-0 items-center self-start">
          {ROW_CHEVRON}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col items-start gap-2 ps-7 pb-3">
          <RunLog job={job} run={run} />
          {failed ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={isRunning(job)}
              onClick={onRetry}
            >
              {UI_ICONS.retry}
              Retry Run
            </Button>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function JobRunsTab({
  job,
  expandedRunId,
  onExpandedChange,
  onRun,
  onRetry,
}: {
  job: CronJob
  expandedRunId: string | null
  onExpandedChange: (id: string | null) => void
  onRun: () => void
  onRetry: () => void
}) {
  if (job.runs.length === 0) {
    return (
      <Empty className="py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">{UI_ICONS.history}</EmptyMedia>
          <EmptyTitle>No Runs Yet</EmptyTitle>
          <EmptyDescription>This job has not fired.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" onClick={onRun}>
            {UI_ICONS.play}
            Run Now
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const stats = runStats(job)
  const succeeded = job.runs.filter((run) => run.status === "succeeded").length

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
        {job.runs.length} {job.runs.length === 1 ? "run" : "runs"}
        <DotSeparator />
        {succeeded} succeeded
        {stats.p95Sec !== null ? (
          <>
            <DotSeparator />
            p95 {formatDuration(stats.p95Sec)}
          </>
        ) : null}
      </p>
      <div className="flex flex-col">
        {job.runs.map((run, index) => (
          <Fragment key={run.id}>
            {index > 0 ? <Separator /> : null}
            <RunRow
              job={job}
              run={run}
              expanded={expandedRunId === run.id}
              onExpandedChange={onExpandedChange}
              onRetry={onRetry}
            />
          </Fragment>
        ))}
      </div>
    </div>
  )
}