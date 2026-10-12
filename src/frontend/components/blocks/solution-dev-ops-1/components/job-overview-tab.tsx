import { useState, type ReactNode } from "react"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert"
import { Badge } from "@/components/reui/badge"
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/reui/code-block/code-block"
import { cn } from "@/lib/utils"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  XAxis,
  type BarShapeProps,
} from "recharts"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import { cronFields, describeCron } from "./cron"
import {
  ALERT_CHANNEL,
  CONCURRENCY_BY_ID,
  failureStreak,
  formatDateTime,
  formatDuration,
  formatRelative,
  formatTime,
  healthOf,
  nextRunOf,
  parseSchedule,
  PERSON_BY_ID,
  REFERENCE_MS,
  RUN_STATUS,
  runStats,
  TIMEZONE_BY_ID,
  upcomingFires,
  type CronJob,
} from "./data"
import { UI_ICONS } from "./icons"
import {
  DotSeparator,
  EnvironmentFace,
  OwnerFace,
  ServiceFace,
} from "./value-faces"

const DURATION_CHART_CONFIG = {
  durationSec: { label: "Duration", color: "var(--primary)" },
} satisfies ChartConfig

/** Each run is a tinted body under a solid cap in its status tone. Both share
 *  top radii, and the cap height is the floor, so a 0s run still shows. */
const CAP_HEIGHT = 3
const CAP_RADII: [number, number, number, number] = [
  CAP_HEIGHT / 2,
  CAP_HEIGHT / 2,
  0,
  0,
]
const BODY_TINT = 0.2

/** Code surface density: the primitive's defaults suit a docs page, not a sheet. */
export const CODE_DENSITY =
  "w-full min-w-0 [--code-block-header-height:--spacing(8)] [--code-block-line-height:1.125rem] [--code-block-padding:--spacing(2)]"

/** The hover fill overhangs the row so the label never sits on its edge (a
 *  carded style clips it); my-auto centers the chevron on a taller label. */
export const SECTION_TRIGGER =
  "isolate before:absolute before:inset-y-0 before:-inset-x-2 before:-z-10 before:rounded-lg before:transition-colors hover:no-underline hover:before:bg-muted/50 [&>svg]:my-auto"

/** The Overview sections in render order; the job sheet opens them all first. */
export const OVERVIEW_SECTIONS = [
  "schedule",
  "details",
  "next-runs",
  "run-durations",
  "command",
]

/** One collapsible section: the whole header row toggles it. */
function Section({
  value,
  title,
  children,
}: {
  value: string
  title: string
  children: ReactNode
}) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger
        className={cn(
          SECTION_TRIGGER,
          "text-muted-foreground text-xs font-medium"
        )}
      >
        {title}
      </AccordionTrigger>
      <AccordionContent className="flex min-w-0 flex-col gap-3">
        {children}
      </AccordionContent>
    </AccordionItem>
  )
}

type Fact = { label: string; value: ReactNode }

function FactGroup({
  value,
  title,
  facts,
}: {
  value: string
  title: string
  facts: Fact[]
}) {
  return (
    <Section value={value} title={title}>
      <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm">
        {facts.map((fact) => (
          <div key={fact.label} className="contents">
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="flex min-w-0 items-center gap-1.5 leading-5">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground truncate">{children}</span>
}

/** Today reads as a time; an older start carries its day. */
const since = (ms: number) =>
  Math.floor(ms / 86_400_000) === Math.floor(REFERENCE_MS / 86_400_000)
    ? formatTime(ms)
    : formatDateTime(ms)

function StateAlert({
  job,
  onViewLog,
}: {
  job: CronJob
  onViewLog: () => void
}) {
  const health = healthOf(job)

  if (health === "paused") {
    const by = PERSON_BY_ID.get(job.pausedBy ?? job.ownerId)?.name
    const when =
      job.pausedAt === undefined ? "" : ` ${formatRelative(job.pausedAt)}`
    return (
      <Alert variant="info">
        {UI_ICONS.paused}
        <AlertTitle>Paused</AlertTitle>
        <AlertDescription>
          {job.pauseNote ? `${job.pauseNote}. ` : ""}Paused by {by}
          {when}.
        </AlertDescription>
      </Alert>
    )
  }

  if (health !== "failing") return null
  const streak = failureStreak(job)
  const latest = job.runs.find(
    (run) => run.status === "failed" || run.status === "timedOut"
  )
  const timedOut = latest?.status === "timedOut"
  const reason =
    job.failure?.reason ??
    (timedOut
      ? `Deadline exceeded at the ${job.timeoutMin}m timeout`
      : `The command exited with code ${latest?.exitCode ?? 1}`)
  const noun = timedOut ? "timed out runs" : "failed runs"
  const run =
    streak.count > 1 && streak.since !== null
      ? `${streak.count} ${noun} in a row since ${since(streak.since)}.`
      : `The last run ${timedOut ? "timed out" : "failed"}${latest ? ` at ${since(latest.startedAt)}` : ""}.`

  return (
    <Alert variant={timedOut ? "warning" : "destructive"}>
      {timedOut ? UI_ICONS.timeout : UI_ICONS.failed}
      <AlertTitle className={timedOut ? undefined : "font-mono"}>
        {timedOut
          ? "Timed Out"
          : (job.failure?.label ?? `Exit ${latest?.exitCode ?? 1}`)}
      </AlertTitle>
      <AlertAction>
        <Button type="button" size="xs" variant="outline" onClick={onViewLog}>
          View Log
        </Button>
      </AlertAction>
      <AlertDescription>
        {reason}. {run}
      </AlertDescription>
    </Alert>
  )
}

function DurationChart({ job }: { job: CronJob }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const runs = job.runs
    .filter((run) => run.status !== "running")
    .slice(0, 20)
    .reverse()
  const stats = runStats(job)
  const active = activeIndex === null ? null : runs[activeIndex]

  return (
    <Section value="run-durations" title="Run Durations">
      {/* A div, not a p: the panel adds a bottom margin to every inner p. */}
      <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
        {active ? (
          <>
            <span className="font-mono">{active.id}</span>
            <DotSeparator />
            {formatDuration(active.durationSec)}
            <DotSeparator />
            {RUN_STATUS[active.status].label}
          </>
        ) : (
          <>
            Last {runs.length} runs
            <DotSeparator />
            p95 {stats.p95Sec === null
              ? "none"
              : formatDuration(stats.p95Sec)}{" "}
            of {job.timeoutMin}m timeout
          </>
        )}
      </div>
      <ChartContainer
        config={DURATION_CHART_CONFIG}
        className="aspect-auto h-32 w-full"
      >
        <BarChart
          accessibilityLayer
          data={runs}
          barCategoryGap="24%"
          margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          onMouseMove={(state) => {
            const index = Number(state.activeTooltipIndex ?? Number.NaN)
            setActiveIndex(Number.isInteger(index) ? index : null)
          }}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="id" hide />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value) => (
                  <div className="flex flex-1 items-center justify-between gap-6">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-mono font-medium tabular-nums">
                      {formatDuration(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar
            dataKey="durationSec"
            maxBarSize={24}
            minPointSize={CAP_HEIGHT}
            isAnimationActive={false}
            shape={(props: BarShapeProps) => {
              const run = runs[props.originalDataIndex]
              if (!run) return <g />
              const tone = RUN_STATUS[run.status].color
              const dimmed =
                activeIndex !== null && activeIndex !== props.originalDataIndex
              return (
                <g opacity={dimmed ? 0.3 : 1}>
                  <Rectangle
                    {...props}
                    radius={CAP_RADII}
                    fill={tone}
                    fillOpacity={BODY_TINT}
                  />
                  <Rectangle
                    x={props.x}
                    y={props.y}
                    width={props.width}
                    height={CAP_HEIGHT}
                    radius={CAP_RADII}
                    fill={tone}
                  />
                </g>
              )
            }}
          />
        </BarChart>
      </ChartContainer>
    </Section>
  )
}

/** The state Alert stays pinned above the sections and never collapses. */
export function JobOverviewTab({
  job,
  onViewLog,
  openSections,
  onOpenSectionsChange,
}: {
  job: CronJob
  onViewLog: () => void
  openSections: string[]
  onOpenSectionsChange: (value: string[]) => void
}) {
  const cron = parseSchedule(job)
  const zone = TIMEZONE_BY_ID.get(job.timezone)
  const next = nextRunOf(job)
  const fires = upcomingFires(job, 5)
  const concurrency = CONCURRENCY_BY_ID.get(job.concurrency)
  const owner = PERSON_BY_ID.get(job.ownerId)
  const finished = job.runs.some((run) => run.status !== "running")

  return (
    <>
      <StateAlert job={job} onViewLog={onViewLog} />

      <Accordion
        multiple
        value={openSections}
        onValueChange={onOpenSectionsChange}
      >
        {cron ? (
          <Section value="schedule" title="Schedule">
            <dl className="grid grid-cols-5 gap-x-3 gap-y-1">
              {cronFields(cron).map((field) => (
                <div key={field.label} className="flex min-w-0 flex-col gap-1">
                  <dt className="text-muted-foreground truncate text-xs">
                    {field.label}
                  </dt>
                  <dd className="truncate font-mono text-sm">{field.value}</dd>
                </div>
              ))}
            </dl>
          </Section>
        ) : null}

        <FactGroup
          value="details"
          title="Details"
          facts={[
            {
              label: "Runs",
              value: (
                <>
                  <span className="truncate">
                    {cron ? describeCron(cron) : "Custom schedule"}
                  </span>
                  <Muted>{zone?.label}</Muted>
                </>
              ),
            },
            {
              label: "Next Run",
              value:
                next === null ? (
                  <Muted>Paused</Muted>
                ) : (
                  <>
                    <span className="truncate tabular-nums">
                      {formatDateTime(next)}
                    </span>
                    <Muted>{formatRelative(next)}</Muted>
                  </>
                ),
            },
            {
              label: "Concurrency",
              value: (
                <>
                  {job.concurrency}
                  <Muted>{concurrency?.description.toLowerCase()}</Muted>
                </>
              ),
            },
            {
              label: "Timeout",
              value: <span className="tabular-nums">{job.timeoutMin} min</span>,
            },
            {
              label: "Retries",
              value: <span className="tabular-nums">{job.retries}</span>,
            },
            {
              label: "Alerts",
              value: job.notifyOnFailure ? (
                `Pages ${ALERT_CHANNEL}`
              ) : (
                <Muted>Off</Muted>
              ),
            },
            {
              label: "Target",
              value: (
                <>
                  <ServiceFace service={job.service} />
                  <span className="text-muted-foreground truncate font-mono text-xs">
                    {job.cluster}
                  </span>
                </>
              ),
            },
            {
              label: "Environment",
              value: <EnvironmentFace environment={job.environment} />,
            },
            {
              label: "Owner",
              value: (
                <>
                  <OwnerFace ownerId={job.ownerId} />
                  <Muted>{owner?.team}</Muted>
                </>
              ),
            },
          ]}
        />

        <Section value="next-runs" title="Next 5 Runs">
          {fires.length > 0 ? (
            <ol className="flex flex-col gap-1.5 text-sm">
              {fires.map((fire) => (
                <li
                  key={fire.at}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="min-w-0 truncate tabular-nums">
                    {formatDateTime(fire.at)}
                  </span>
                  {fire.skipped ? (
                    <Badge variant="outline">Skipping</Badge>
                  ) : (
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {formatRelative(fire.at)}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground text-sm">
              Resume the job to schedule runs.
            </p>
          )}
        </Section>

        {finished ? <DurationChart job={job} /> : null}

        <Section value="command" title="Command">
          <CodeBlock
            code={job.command}
            language="bash"
            className={CODE_DENSITY}
          >
            <CodeBlockHeader className="min-h-8 gap-2 px-2.5">
              <CodeBlockTitle className="truncate">command.sh</CodeBlockTitle>
              <CodeBlockCopyButton className="ms-auto" />
            </CodeBlockHeader>
          </CodeBlock>
        </Section>
      </Accordion>
    </>
  )
}