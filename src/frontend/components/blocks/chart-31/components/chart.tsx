"use client"

import { useId, type ReactNode } from "react"
import { Badge } from "@/components/reui/badge"
import { Frame, FramePanel } from "@/components/reui/frame"
import { IconTile } from "@/components/reui/icon-tile"
import { cn } from "@/lib/utils"
import {
  Area,
  AreaChart,
  ReferenceLine,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"

import {
  fleetActivity,
  formatBrief,
  formatCount,
  formatPercent,
  formatRelative,
  formatTime,
  formatWhen,
  healthOf,
  JOB_HEALTH,
  JOB_HEALTH_ORDER,
  JOBS,
  nextHourLoad,
  REFERENCE_MS,
  RUN_STATUS,
  SERVICE_ICONS,
  SUCCESS_SLO,
  upNextOf,
  type CronJob,
  type FleetActivity,
  type FleetBucket,
} from "./data"
import { RUN_GLYPHS, UI_ICONS } from "./icons"
import { HealthFace } from "./value-faces"

type Tick = { key: string; tone: string }
type LegendItem = { key: string; tone: string; text: string; dot?: boolean }
type HourPoint = { start: number; rate: number | null; lift: number | null }

/** A split with nothing to split. */
const ZERO_TONE = "bg-muted-foreground/25"

const FAILURE_SPLIT = ["failed", "timedOut"] as const

// State token, never --chart-N: those flip hue between themes.
const SUCCESS_CHART_CONFIG = {
  rate: { label: "Success rate", color: "var(--success)" },
} satisfies ChartConfig

// The interval caption's unit: the largest that fits the span twice.
const INTERVAL_UNITS = [
  { ms: 86_400_000, one: "day", many: "days" },
  { ms: 3_600_000, one: "hour", many: "hours" },
  { ms: 60_000, one: "minute", many: "minutes" },
]

/** Header, value, optional subject line, then a footer pinned to the bottom,
 *  so the footers in a row share one bottom edge. */
function KpiTile({
  icon,
  title,
  detail,
  value,
  badge,
  subject,
  children,
}: {
  icon: ReactNode
  title: string
  detail: ReactNode
  value: ReactNode
  badge?: ReactNode
  subject?: ReactNode
  children?: ReactNode
}) {
  return (
    <Frame spacing="default">
      <FramePanel className="flex flex-col gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile variant="elevated" size="sm" aria-hidden="true">
            {icon}
          </IconTile>
          <div className="min-w-0 pt-0.5">
            <span className="block truncate text-sm font-medium">{title}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {detail}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="text-xl font-semibold tracking-tight tabular-nums">
            {value}
          </div>
          {badge}
        </div>
        {subject ? (
          <div className="flex h-5 min-w-0 items-center gap-2">{subject}</div>
        ) : null}
        {children}
      </FramePanel>
    </Frame>
  )
}

/** Every footer: a full-width mark over one caption line. */
function StripFooter({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-2">{children}</div>
}

/** One tick per item, spread edge to edge. */
function TickStrip({ label, ticks }: { label: string; ticks: Tick[] }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-3.5 w-full items-center justify-between"
    >
      {ticks.map((tick) => (
        <span
          key={tick.key}
          className={cn("h-3.5 w-0.75 rounded-full", tick.tone)}
        />
      ))}
    </div>
  )
}

/** A tick for strips and lines, a dot for point marks. */
function Swatch({ tone, dot = false }: { tone: string; dot?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "shrink-0 rounded-full",
        dot ? "size-1.5" : "h-2 w-0.75",
        tone
      )}
    />
  )
}

function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((item) => (
        <span key={item.key} className="flex items-center gap-1">
          <Swatch tone={item.tone} dot={item.dot} />
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            {item.text}
          </span>
        </span>
      ))}
    </div>
  )
}

/** One tick per job, coloured by health: the fleet's shape in one strip. */
function FleetTicks({ jobs }: { jobs: CronJob[] }) {
  const groups = JOB_HEALTH_ORDER.map((health) => ({
    health,
    count: jobs.filter((job) => healthOf(job) === health).length,
  }))
  const summary = groups
    .map(
      (group) =>
        `${group.count} ${JOB_HEALTH[group.health].label.toLowerCase()}`
    )
    .join(", ")

  return (
    <StripFooter>
      <TickStrip
        label={`${jobs.length} jobs: ${summary}`}
        ticks={groups.flatMap((group) =>
          Array.from({ length: group.count }, (_, index) => ({
            key: `${group.health}-${index}`,
            tone: JOB_HEALTH[group.health].tick,
          }))
        )}
      />
      <Legend
        items={groups.map((group) => ({
          key: group.health,
          tone: JOB_HEALTH[group.health].tick,
          text: `${group.count} ${JOB_HEALTH[group.health].label}`,
        }))}
      />
    </StripFooter>
  )
}

function hourRate(bucket: FleetBucket) {
  const outcomes = bucket.succeeded + bucket.failed + bucket.timedOut
  return outcomes > 0 ? bucket.succeeded / outcomes : null
}

/** Height on a square-root error scale, so the half-point gap to the SLO
 *  still reads beside a deep dip. */
const liftOf = (rate: number) => 1 - Math.sqrt(1 - rate)

/** Only hours under the SLO get a mark, in the caption's below tone. */
function BelowSloDot({ cx, cy, payload }: DotItemDotProps) {
  const point: HourPoint = payload
  if (cx === undefined || cy === undefined) return null
  if (point.rate === null || point.rate >= SUCCESS_SLO) return null
  return (
    <circle
      cx={cx}
      cy={cy}
      r={2.5}
      fill="var(--warning)"
      stroke="var(--card)"
      strokeWidth={1}
    />
  )
}

/** Hourly success over the last 24 hours; an hour with no runs is bridged
 *  by its neighbours, never drawn as zero. */
function SuccessSparkline({ buckets }: { buckets: FleetBucket[] }) {
  const fillId = `success-fill-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`
  const points: HourPoint[] = buckets.map((bucket) => {
    const rate = hourRate(bucket)
    return {
      start: bucket.start,
      rate,
      lift: rate === null ? null : liftOf(rate),
    }
  })
  const measured = points.flatMap((point) =>
    point.rate === null ? [] : [{ start: point.start, rate: point.rate }]
  )
  const met = measured.filter((point) => point.rate >= SUCCESS_SLO).length
  const below = measured.length - met
  const lowest = measured.reduce((low, point) =>
    point.rate < low.rate ? point : low
  )
  // A tenth of the span under the lowest hour or the SLO, whichever is lower.
  const low = liftOf(Math.min(SUCCESS_SLO, lowest.rate))
  const floor = low - (1 - low) / 10

  return (
    <StripFooter>
      <div
        role="img"
        aria-label={`Success rate by hour, last 24 hours: ${met} of ${measured.length} hours in SLO, lowest ${formatPercent(lowest.rate)} at ${formatTime(lowest.start)}`}
        className="min-w-0"
      >
        {/* Recharts' z-index layers take pointer focus (tabindex -1), so
            their default ring is hidden: a click never boxes the sparkline. */}
        <ChartContainer
          config={SUCCESS_CHART_CONFIG}
          className="aspect-auto h-11.5 w-full min-w-0 [&_[class*=recharts-zIndex-layer]]:outline-hidden"
          initialDimension={{ width: 200, height: 46 }}
        >
          <AreaChart
            data={points}
            accessibilityLayer={false}
            margin={{ top: 4, right: 3, bottom: 3, left: 3 }}
          >
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-rate)"
                  stopOpacity={0.25}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-rate)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <XAxis dataKey="start" hide />
            <YAxis hide domain={[floor, 1]} />
            <ReferenceLine
              y={liftOf(SUCCESS_SLO)}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.6}
              strokeDasharray="3 3"
              label={{
                value: `SLO ${formatPercent(SUCCESS_SLO)}`,
                position: "insideTopLeft",
                fill: "var(--muted-foreground)",
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(_value, _name, item) => {
                    const point: HourPoint = item.payload
                    return (
                      <div className="flex flex-1 items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {formatTime(point.start)}
                        </span>
                        <span className="font-mono font-medium tabular-nums">
                          {point.rate === null
                            ? "No runs"
                            : formatPercent(point.rate)}
                        </span>
                      </div>
                    )
                  }}
                />
              }
            />
            <Area
              dataKey="lift"
              type="monotone"
              connectNulls
              stroke="var(--color-rate)"
              strokeWidth={1.5}
              fill={`url(#${fillId})`}
              dot={BelowSloDot}
              activeDot={{
                r: 3,
                fill: "var(--color-rate)",
                stroke: "var(--card)",
                strokeWidth: 1,
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </div>
      <Legend
        items={[
          {
            key: "met",
            tone: "bg-success",
            text: `${met} of ${measured.length} hours in SLO`,
          },
          ...(below > 0
            ? [
                {
                  key: "below",
                  tone: "bg-warning",
                  text: `${below} below`,
                  dot: true,
                },
              ]
            : []),
        ]}
      />
    </StripFooter>
  )
}

/** Failed against Timed Out, widths from counts; the legend carries the numbers. */
function FailureSplit({ fleet }: { fleet: FleetActivity }) {
  const parts = FAILURE_SPLIT.map((status) => ({
    status,
    count: fleet[status],
  }))
  const total = fleet.failed + fleet.timedOut

  return (
    <StripFooter>
      <div
        role="img"
        aria-label={
          total > 0
            ? `${total} failed runs: ${parts
                .map(
                  (part) =>
                    `${part.count} ${RUN_STATUS[part.status].label.toLowerCase()}`
                )
                .join(", ")}`
            : "No failed runs in the last 24 hours"
        }
        className="flex h-3.5 w-full items-center gap-0.5"
      >
        {total > 0 ? (
          parts
            .filter((part) => part.count > 0)
            .map((part) => (
              <span
                key={part.status}
                className={cn(
                  "h-1.5 min-w-1.5 basis-0 rounded-full",
                  RUN_STATUS[part.status].tick
                )}
                style={{ flexGrow: part.count }}
              />
            ))
        ) : (
          <span className={cn("h-1.5 w-full rounded-full", ZERO_TONE)} />
        )}
      </div>
      <Legend
        items={parts.map((part) => ({
          key: part.status,
          tone: RUN_STATUS[part.status].tick,
          text: `${part.count} ${RUN_STATUS[part.status].label}`,
        }))}
      />
    </StripFooter>
  )
}

/** "5 of 10 minutes" from the start of the interval to now. */
function intervalText(from: number, to: number) {
  const unit =
    INTERVAL_UNITS.find((item) => to - from >= 2 * item.ms) ??
    INTERVAL_UNITS[INTERVAL_UNITS.length - 1]
  const span = Math.max(1, Math.round((to - from) / unit.ms))
  const elapsed = Math.round((REFERENCE_MS - from) / unit.ms)
  return `${elapsed} of ${span} ${span === 1 ? unit.one : unit.many}`
}

/** How far now sits between the job's last run and its next fire. */
function IntervalTrack({ job, at }: { job: CronJob; at: number }) {
  const last = job.runs[0]
  const share = last
    ? Math.min(
        1,
        Math.max(0, (REFERENCE_MS - last.startedAt) / (at - last.startedAt))
      )
    : 0
  const percent = Math.round(share * 100)

  return (
    <StripFooter>
      {/* Elapsed time, not a control: a darker ground and a muted fill, no
          knob, so it never reads as a draggable scrubber. */}
      <div className="flex h-3.5 items-center">
        <Progress
          value={percent}
          aria-label={`${job.name} run interval`}
          aria-valuetext={
            last
              ? `${intervalText(last.startedAt, at)} elapsed since the last run`
              : `No runs yet, first run at ${formatTime(at)}`
          }
          className="**:data-[slot=progress-indicator]:bg-muted-foreground/40 **:data-[slot=progress-track]:bg-muted-foreground/15 w-full **:data-[slot=progress-track]:h-1.5"
        />
      </div>
      <div className="text-muted-foreground flex min-w-0 items-center justify-between gap-2 text-xs font-medium tabular-nums">
        {last ? (
          <span className="flex min-w-0 items-center gap-1">
            <span
              aria-hidden="true"
              className={cn(
                "flex shrink-0 [&_svg]:size-3.5",
                RUN_STATUS[last.status].text
              )}
            >
              {last.status === "running" ? (
                <Spinner aria-hidden="true" />
              ) : (
                RUN_GLYPHS[last.status]
              )}
            </span>
            <span className="shrink-0">{formatBrief(last.startedAt)}</span>
            <span className={cn("truncate", RUN_STATUS[last.status].text)}>
              {RUN_STATUS[last.status].label}
            </span>
          </span>
        ) : (
          <span className="truncate">No runs yet</span>
        )}
        <span className="shrink-0">{formatBrief(at)}</span>
      </div>
    </StripFooter>
  )
}

/** A job by name: its service icon and its name. */
function JobFace({ job }: { job: CronJob }) {
  return (
    <span className="text-foreground flex min-w-0 items-center gap-1.5 text-sm font-medium [&_svg:not([class*=size-])]:size-3.5">
      <span className="text-muted-foreground flex shrink-0">
        {SERVICE_ICONS[job.service]}
      </span>
      <span className="truncate">{job.name}</span>
    </span>
  )
}

const runs = (count: number) => `${count} ${count === 1 ? "run" : "runs"}`

// The whole fleet at the fixed reference time.
const FLEET = fleetActivity(JOBS)
const NEXT_UP = upNextOf(JOBS)[0] ?? null
const HOUR_RUNS = nextHourLoad(JOBS).reduce(
  (sum, slot) => sum + slot.healthy + slot.failing,
  0
)

export function Chart() {
  const active = JOBS.filter((job) => job.enabled).length
  const outcomes = FLEET.succeeded + FLEET.failed + FLEET.timedOut
  const rate = outcomes > 0 ? FLEET.succeeded / outcomes : null
  const failures = FLEET.failed + FLEET.timedOut

  return (
    <div className="grid w-full max-w-7xl gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:gap-3">
      {/* Active jobs */}
      <KpiTile
        icon={UI_ICONS.layers}
        title="Active Jobs"
        detail={`${JOBS.length - active} paused`}
        value={
          <>
            {active}
            <span className="text-muted-foreground text-sm font-normal">
              {" "}
              of {JOBS.length}
            </span>
          </>
        }
      >
        {JOBS.length > 0 ? <FleetTicks jobs={JOBS} /> : null}
      </KpiTile>

      {/* Success rate */}
      <KpiTile
        icon={UI_ICONS.activity}
        title="Success Rate"
        detail={
          rate === null
            ? "No runs in 24 hours"
            : `${formatCount(FLEET.succeeded)} of ${formatCount(outcomes)} runs`
        }
        value={rate === null ? "None" : formatPercent(rate)}
        badge={
          rate === null ? null : rate < SUCCESS_SLO ? (
            <Badge variant="warning-light">Below SLO</Badge>
          ) : (
            <Badge variant="success-light">Within SLO</Badge>
          )
        }
      >
        {rate === null ? null : <SuccessSparkline buckets={FLEET.buckets} />}
      </KpiTile>

      {/* Failed runs */}
      <KpiTile
        icon={UI_ICONS.failures}
        title="Failed Runs"
        detail={
          FLEET.failingJobs > 0
            ? `across ${FLEET.failingJobs} ${FLEET.failingJobs === 1 ? "job" : "jobs"}`
            : "Last 24 hours"
        }
        value={formatCount(failures)}
        subject={
          FLEET.worst ? (
            <>
              <span className="text-muted-foreground shrink-0 text-xs">
                Worst
              </span>
              <JobFace job={FLEET.worst.job} />
              <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
                {FLEET.worst.failures} of {failures}
              </span>
            </>
          ) : null
        }
      >
        <FailureSplit fleet={FLEET} />
      </KpiTile>

      {/* Next run */}
      <KpiTile
        icon={UI_ICONS.schedule}
        title="Next Run"
        detail={
          NEXT_UP
            ? HOUR_RUNS > 0
              ? `${runs(HOUR_RUNS)} in the next hour`
              : "None in the next hour"
            : JOBS.length > 0
              ? "All jobs paused"
              : "No jobs scheduled"
        }
        value={
          NEXT_UP ? (
            <>
              {formatRelative(NEXT_UP.at)}
              <span className="text-muted-foreground text-sm font-normal">
                {" "}
                {formatWhen(NEXT_UP.at)}
              </span>
            </>
          ) : (
            "None"
          )
        }
        subject={
          NEXT_UP ? (
            <>
              <JobFace job={NEXT_UP.job} />
              {healthOf(NEXT_UP.job) === "failing" ? (
                <HealthFace health="failing" />
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground truncate text-xs">
              {JOBS.length > 0
                ? "Resume a job to schedule runs."
                : "Create a job to schedule runs."}
            </p>
          )
        }
      >
        {NEXT_UP ? <IntervalTrack job={NEXT_UP.job} at={NEXT_UP.at} /> : null}
      </KpiTile>
    </div>
  )
}