import { useEffect, useState } from "react"
import { Frame, FramePanel } from "@/components/reui/frame"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ReferenceLine,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts"
import { toast } from "sonner"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

import {
  DURATION_CHART_CONFIG,
  formatDuration,
  JOB,
  MANUAL_RUN,
  RUN_STATUS,
  runStats,
  type JobRun,
  type RunWindow,
} from "./data"
import { TOAST_SUCCESS_ICON } from "./icons"
import { RunToolbar } from "./run-toolbar"
import { SectionHeader } from "./section-header"
import { DotSeparator, JobFace, JobStateFace } from "./value-faces"

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
const TIMEOUT_SEC = JOB.timeoutMin * 60

/** Newest first, as the CSV reads in a log viewer. */
function runsCsv(runs: JobRun[]) {
  return [
    "run_id,status,duration_sec",
    ...runs.map((run) => `${run.id},${run.status},${run.durationSec}`),
  ].join("\n")
}

export function Chart() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [runWindow, setRunWindow] = useState<RunWindow>(20)
  const [manualRuns, setManualRuns] = useState<JobRun[]>([])
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)

  const history = [...manualRuns, ...JOB.runs]
  const recent = history
    .filter((run) => run.status !== "running")
    .slice(0, runWindow)
  const runs = [...recent].reverse()
  const stats = runStats(recent)
  const active = activeIndex === null ? null : runs[activeIndex]
  const nextId = `RUN-${Number(history[0].id.slice(4)) + 1}`

  // A manual run finishes after a beat and joins the chart as the newest bar.
  useEffect(() => {
    // Frozen demo guard: ?demo=frozen pins the demo, so no timer starts.
    if (document.documentElement.dataset.demo === "frozen") return
    if (!pendingId) return
    const id = window.setTimeout(() => {
      const { durationsSec } = MANUAL_RUN
      const run: JobRun = {
        id: pendingId,
        status: "succeeded",
        durationSec: durationsSec[manualRuns.length % durationsSec.length],
      }
      setManualRuns((current) => [run, ...current])
      setPendingId(null)
      toast.success("Run finished", {
        icon: TOAST_SUCCESS_ICON,
        description: `${run.id} succeeded in ${formatDuration(run.durationSec)}.`,
      })
    }, MANUAL_RUN.finishMs)
    return () => window.clearTimeout(id)
  }, [manualRuns.length, pendingId])

  const runNow = () => {
    setPendingId(nextId)
    toast.success("Run started", {
      icon: TOAST_SUCCESS_ICON,
      description: `${nextId} for ${JOB.name}.`,
    })
  }
  const togglePause = () => {
    setPaused(!paused)
    toast.success(paused ? "Schedule resumed" : "Schedule paused", {
      icon: TOAST_SUCCESS_ICON,
      description: paused
        ? `Runs start ${JOB.cadence.toLowerCase()} ${JOB.timezone} again.`
        : "No scheduled run starts until you resume.",
    })
  }
  const exportRuns = () => {
    const url = URL.createObjectURL(
      new Blob([runsCsv(recent)], { type: "text/csv" })
    )
    const link = document.createElement("a")
    link.href = url
    link.download = `${JOB.slug}-runs.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Runs exported", {
      icon: TOAST_SUCCESS_ICON,
      description: `The last ${recent.length} runs of ${JOB.name}.`,
    })
  }

  return (
    <Frame spacing="default" className="w-full max-w-2xl">
      <SectionHeader
        title="Run Durations"
        badge={
          pendingId ? (
            <JobStateFace state="running" />
          ) : paused ? (
            <JobStateFace state="paused" />
          ) : null
        }
        description={
          // Under sm the schedule takes its own line, so no dot dangles at a wrap.
          <span className="flex min-w-0 flex-wrap items-center gap-1.5 max-sm:flex-col max-sm:items-start max-sm:gap-0.5">
            <JobFace job={JOB} />
            <DotSeparator className="max-sm:hidden" />
            <span>
              {JOB.cadence} {JOB.timezone}
            </span>
          </span>
        }
      >
        <RunToolbar
          runWindow={runWindow}
          onRunWindowChange={(next) => {
            setRunWindow(next)
            setActiveIndex(null)
          }}
          running={pendingId !== null}
          paused={paused}
          lastRunId={recent[0].id}
          onRunNow={runNow}
          onTogglePause={togglePause}
          onExport={exportRuns}
        />
      </SectionHeader>
      <FramePanel className="flex min-w-0 flex-col gap-3">
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
              {stats.succeeded} succeeded
              {/* Under sm the p95 takes its own line, so no dot dangles at a wrap. */}
              <DotSeparator className="max-sm:hidden" />
              <span className="max-sm:basis-full">
                p95{" "}
                {stats.p95Sec === null ? "none" : formatDuration(stats.p95Sec)}{" "}
                of {JOB.timeoutMin}m timeout
              </span>
            </>
          )}
        </div>
        <ChartContainer
          config={DURATION_CHART_CONFIG}
          className="aspect-auto h-36 w-full"
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
            {/* Headroom over the timeout, so its label clears a run that hit it. */}
            <YAxis
              hide
              domain={[0, (max: number) => Math.max(TIMEOUT_SEC, max) * 1.22]}
            />
            <ReferenceLine
              y={TIMEOUT_SEC}
              stroke="var(--destructive)"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
              label={{
                value: `Timeout ${JOB.timeoutMin}m`,
                position: "insideBottomRight",
                fill: "var(--destructive)",
              }}
            />
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
                  activeIndex !== null &&
                  activeIndex !== props.originalDataIndex
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
      </FramePanel>
    </Frame>
  )
}