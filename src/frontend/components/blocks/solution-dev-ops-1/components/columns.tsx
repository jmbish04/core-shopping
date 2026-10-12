"use no memo"

import { createContext, memo, useContext, type ReactNode } from "react"
import { type DataGridFeatures } from "@/components/reui/data-grid/data-grid"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table"
import { type ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

import { describeCron } from "./cron"
import {
  commandArgsOf,
  formatBrief,
  formatDuration,
  formatPercent,
  formatRelative,
  formatWhen,
  isRunning,
  nextRunOf,
  parseSchedule,
  PERSON_BY_ID,
  RUN_STATUS,
  runStats,
  scheduledFireOf,
  TIMEZONE_BY_ID,
  type CronJob,
  type SheetTab,
} from "./data"
import { UI_ICONS } from "./icons"
import {
  DotSeparator,
  EnvironmentFace,
  OwnerFace,
  RunStatusFace,
  ServiceFace,
} from "./value-faces"

export type JobRowAction =
  "view" | "edit" | "run" | "skip" | "pause" | "resume" | "duplicate" | "delete"

export type JobColumnHandlers = {
  onOpen: (id: string, tab: SheetTab) => void
  onToggle: (id: string, enabled: boolean) => void
  onAction: (action: JobRowAction, job: CronJob) => void
}

/** The open sheet's job id: its name cell tints the row and sets aria-current. */
export const ActiveJobContext = createContext<string | null>(null)

/** Focus ring for the run strip: hover reveals detail, a click opens Runs. */
const HOVER_TARGET =
  "focus-visible:outline-ring/50 cursor-pointer outline-offset-2 focus-visible:outline-2"

/** Paused rows dim their content, never the Switch, so the way back stays clear. */
const dimmed = (job: CronJob) => !job.enabled && "opacity-55"

// ── Hover card parts: head, rule, quiet rows ──

function CardHead({
  title,
  value,
  className,
}: {
  title: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 truncate font-medium">{title}</span>
      <span
        className={cn(
          "shrink-0 font-semibold whitespace-nowrap tabular-nums",
          className
        )}
      >
        {value}
      </span>
    </div>
  )
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

// ── Cells ──

function JobNameCell({
  job,
  onOpen,
}: {
  job: CronJob
  onOpen: JobColumnHandlers["onOpen"]
}) {
  const active = useContext(ActiveJobContext) === job.id
  return (
    <div
      data-active-row={active ? "" : undefined}
      className={cn("flex min-w-0 flex-col gap-0.5", dimmed(job))}
    >
      <button
        type="button"
        aria-label={`Open ${job.name}`}
        aria-current={active ? "true" : undefined}
        onClick={(event) => {
          event.stopPropagation()
          onOpen(job.id, "overview")
        }}
        className="text-foreground hover:text-primary max-w-full cursor-pointer self-start truncate text-left font-medium underline-offset-2 transition-colors hover:underline"
      >
        {job.name}
      </button>
      <span className="text-muted-foreground truncate font-mono text-xs">
        {commandArgsOf(job.command)}
      </span>
    </div>
  )
}

function ScheduleCell({ job }: { job: CronJob }) {
  const cron = parseSchedule(job)
  const zone = TIMEZONE_BY_ID.get(job.timezone)
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", dimmed(job))}>
      <span className="truncate text-sm">
        {cron ? describeCron(cron) : "Invalid schedule"}
      </span>
      <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
        <span className="truncate font-mono">{job.schedule}</span>
        {zone && zone.value !== "UTC" ? (
          <>
            <DotSeparator />
            <span className="shrink-0">{zone.short}</span>
          </>
        ) : null}
      </span>
    </div>
  )
}

const EnabledCell = memo(function EnabledCell({
  job,
  onToggle,
}: {
  job: CronJob
  onToggle: JobColumnHandlers["onToggle"]
}) {
  return (
    // The wrapper, not the Switch, stops the click: Base UI re-dispatches it
    // on a hidden input that would otherwise reach the row and open the sheet.
    <div
      className="flex items-center"
      onClick={(event) => event.stopPropagation()}
    >
      <Switch
        size="sm"
        checked={job.enabled}
        onCheckedChange={(checked) => onToggle(job.id, checked)}
        aria-label={`Enable ${job.name}`}
      />
    </div>
  )
})

function LastRunCell({ job }: { job: CronJob }) {
  const latest = job.runs[0]
  if (!latest) {
    return (
      <span className={cn("text-muted-foreground text-sm", dimmed(job))}>
        Never run
      </span>
    )
  }
  const timed = latest.status !== "skipped" && latest.status !== "running"
  return (
    <div
      className={cn("flex min-w-0 flex-col items-start gap-0.5", dimmed(job))}
    >
      <RunStatusFace status={latest.status} />
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs whitespace-nowrap tabular-nums">
        {formatRelative(latest.startedAt)}
        {timed ? (
          <>
            <DotSeparator />
            {formatDuration(latest.durationSec)}
          </>
        ) : null}
      </span>
    </div>
  )
}

function RunHistoryCell({
  job,
  onOpen,
}: {
  job: CronJob
  onOpen: JobColumnHandlers["onOpen"]
}) {
  const stats = runStats(job)
  const bars = job.runs
    .filter((run) => run.status !== "running")
    .slice(0, 20)
    .reverse()
  if (bars.length === 0) {
    return (
      <span className={cn("text-muted-foreground text-sm", dimmed(job))}>
        No runs yet
      </span>
    )
  }
  const max = Math.max(1, ...bars.map((run) => run.durationSec))
  const lastFailure = stats.lastFailure
  const summary = `${stats.succeeded} of ${stats.total} runs succeeded${
    lastFailure ? `, last failure ${formatRelative(lastFailure.startedAt)}` : ""
  }`

  return (
    <div className={cn("flex", dimmed(job))}>
      <HoverCard>
        <HoverCardTrigger
          render={
            <button
              type="button"
              aria-label={summary}
              className={cn("flex items-end", HOVER_TARGET)}
              onClick={(event) => {
                event.stopPropagation()
                onOpen(job.id, "runs")
              }}
            />
          }
        >
          <div className="flex h-5 items-end gap-0.5" aria-hidden="true">
            {bars.map((run) => (
              <span
                key={run.id}
                className={cn("w-1 rounded-full", RUN_STATUS[run.status].bar)}
                style={{
                  height: `${Math.max((run.durationSec / max) * 100, 16)}%`,
                }}
              />
            ))}
          </div>
        </HoverCardTrigger>
        <HoverCardContent align="end" className="flex flex-col gap-2.5">
          <CardHead
            title="Last 20 Runs"
            value={stats.rate === null ? "None" : formatPercent(stats.rate)}
          />
          <Separator />
          <CardRows
            rows={[
              ["Succeeded", stats.succeeded],
              ["Failed", stats.failed],
              ...(stats.timedOut > 0
                ? [["Timed out", stats.timedOut] satisfies [string, ReactNode]]
                : []),
              ...(stats.skipped > 0
                ? [["Skipped", stats.skipped] satisfies [string, ReactNode]]
                : []),
              [
                "p95",
                stats.p95Sec === null ? "None" : formatDuration(stats.p95Sec),
              ],
              [
                "Last failure",
                lastFailure
                  ? `${formatRelative(lastFailure.startedAt)}, ${
                      lastFailure.status === "timedOut"
                        ? "timed out"
                        : `exit ${lastFailure.exitCode ?? 1}`
                    }`
                  : "None",
              ],
            ]}
          />
        </HoverCardContent>
      </HoverCard>
    </div>
  )
}

function NextRunCell({ job }: { job: CronJob }) {
  if (!job.enabled) {
    return (
      <div className="flex min-w-0 flex-col gap-0.5 opacity-55">
        <span className="text-muted-foreground text-sm">Paused</span>
        <span className="text-muted-foreground truncate text-xs">
          by {PERSON_BY_ID.get(job.pausedBy ?? job.ownerId)?.name}
        </span>
      </div>
    )
  }
  const next = nextRunOf(job)
  if (next === null) {
    return <span className="text-muted-foreground text-sm">None</span>
  }
  const skipping = job.skipFireAt !== undefined && job.skipFireAt < next
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-sm tabular-nums">{formatRelative(next)}</span>
      <span className="text-muted-foreground truncate text-xs tabular-nums">
        {skipping && job.skipFireAt !== undefined
          ? `${formatBrief(next)}, skips ${formatBrief(job.skipFireAt)}`
          : formatWhen(next)}
      </span>
    </div>
  )
}

function TargetCell({ job }: { job: CronJob }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", dimmed(job))}>
      <span className="text-sm">
        <ServiceFace service={job.service} />
      </span>
      <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
        <span className="truncate font-mono">{job.cluster}</span>
        {job.environment === "sandbox" ? (
          <>
            <DotSeparator />
            <span className="shrink-0">sandbox</span>
          </>
        ) : null}
      </span>
    </div>
  )
}

function ActionsCell({
  job,
  onAction,
  triggerRef,
}: {
  job: CronJob
  onAction: JobColumnHandlers["onAction"]
  triggerRef: (node: HTMLButtonElement | null) => void
}) {
  const running = isRunning(job)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            ref={triggerRef}
            size="icon-xs"
            variant="ghost"
            aria-label={`Actions for ${job.name}`}
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        {UI_ICONS.more}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onAction("view", job)}>
            {UI_ICONS.view}
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction("edit", job)}>
            {UI_ICONS.edit}
            Edit Schedule
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={running}
            onClick={() => onAction("run", job)}
          >
            {UI_ICONS.play}
            Run Now
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!job.enabled}
            onClick={() => onAction("skip", job)}
          >
            {UI_ICONS.skip}
            {job.skipFireAt !== undefined ? "Keep Next Run" : "Skip Next Run"}
          </DropdownMenuItem>
          {job.enabled ? (
            <DropdownMenuItem onClick={() => onAction("pause", job)}>
              {UI_ICONS.pause}
              Pause
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onAction("resume", job)}>
              {UI_ICONS.play}
              Resume
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onAction("duplicate", job)}>
            {UI_ICONS.copy}
            Duplicate
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onAction("delete", job)}
          >
            {UI_ICONS.trash}
            Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Column factory ──

export function createJobColumns(
  handlers: JobColumnHandlers,
  registerTrigger: (id: string) => (node: HTMLButtonElement | null) => void
): ColumnDef<DataGridFeatures, CronJob>[] {
  const { onOpen, onToggle, onAction } = handlers
  return [
    {
      id: "select",
      header: () => <DataGridTableRowSelectAll />,
      // Same hidden-input bubbling as the Switch: keep the click off the row.
      cell: ({ row }) => (
        <div className="flex" onClick={(event) => event.stopPropagation()}>
          <DataGridTableRowSelect row={row} />
        </div>
      ),
      size: 36,
      enableSorting: false,
      enableResizing: false,
      enableHiding: false,
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => <JobNameCell job={row.original} onOpen={onOpen} />,
      size: 228,
      enableHiding: false,
      meta: { headerTitle: "Job" },
    },
    {
      id: "schedule",
      accessorKey: "schedule",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => <ScheduleCell job={row.original} />,
      size: 140,
      enableSorting: false,
      meta: { headerTitle: "Schedule" },
    },
    {
      id: "enabled",
      accessorKey: "enabled",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => <EnabledCell job={row.original} onToggle={onToggle} />,
      size: 80,
      enableSorting: false,
      meta: { headerTitle: "Enabled" },
    },
    {
      id: "lastRun",
      accessorFn: (job) => job.runs[0]?.startedAt,
      sortUndefined: "last",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => <LastRunCell job={row.original} />,
      // Fits the longest meta line, "14h 20m ago" plus a duration, unclipped.
      size: 160,
      meta: { headerTitle: "Last Run" },
    },
    {
      id: "history",
      accessorFn: (job) => runStats(job).rate ?? undefined,
      sortUndefined: "last",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => <RunHistoryCell job={row.original} onOpen={onOpen} />,
      size: 136,
      meta: { headerTitle: "Last 20 Runs" },
    },
    {
      id: "nextRun",
      accessorFn: (job) => scheduledFireOf(job) ?? undefined,
      sortUndefined: "last",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => <NextRunCell job={row.original} />,
      size: 128,
      meta: { headerTitle: "Next Run" },
    },
    {
      id: "target",
      accessorFn: (job) => job.service,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => <TargetCell job={row.original} />,
      size: 156,
      meta: { headerTitle: "Target" },
    },
    {
      id: "environment",
      accessorKey: "environment",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => (
        <span className={cn("flex", dimmed(row.original))}>
          <EnvironmentFace environment={row.original.environment} />
        </span>
      ),
      size: 120,
      meta: { headerTitle: "Environment" },
    },
    {
      id: "owner",
      accessorFn: (job) => PERSON_BY_ID.get(job.ownerId)?.name ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => (
        <span className={cn("flex min-w-0", dimmed(row.original))}>
          <OwnerFace ownerId={row.original.ownerId} />
        </span>
      ),
      size: 168,
      meta: { headerTitle: "Owner" },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <ActionsCell
          job={row.original}
          onAction={onAction}
          triggerRef={registerTrigger(row.original.id)}
        />
      ),
      size: 44,
      enableSorting: false,
      enableHiding: false,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
    },
  ]
}