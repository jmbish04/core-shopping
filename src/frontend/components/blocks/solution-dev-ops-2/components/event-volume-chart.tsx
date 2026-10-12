import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react"
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { cn } from "@/lib/utils"
import {
  Bar,
  BarChart,
  Rectangle,
  ReferenceLine,
  useActiveTooltipLabel,
  usePlotArea,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts"

import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import {
  formatChange,
  formatShare,
  formatTick,
  formatWindow,
} from "./audit-format"
import {
  bucketize,
  bucketKeyOf,
  type Bucket,
  type BucketSpan,
} from "./audit-query"
import {
  ACTORS,
  OUTCOME_CONFIG,
  OUTCOME_DOT,
  TIME_RANGES,
  VOLUME_CHART_CONFIG,
  type ActorId,
  type AuditEvent,
  type Outcome,
  type TimeRange,
} from "./data"
import { DenialLane, type DenialMark } from "./denial-lane"
import { HATCH, HATCH_PAINT, STRIPE } from "./hatch"
import { Readout } from "./readout"
import { ActorAvatar, DotSeparator } from "./value-faces"
import { TrendingUp, TrendingDown } from "lucide-react"

/** Stack order, bottom to top. */
const OUTCOMES: Outcome[] = ["success", "denied", "failed"]
const DAY_MS = 86_400_000
/** Every segment is its own pill on a full-height track: this corner, and
 *  this much air between segments. */
const BAR_RADIUS = 4
const SEGMENT_GAP = 2
/** Caps the sparse 1h buckets so a dozen bars never balloon. */
const MAX_BAR_SIZE = 28
/** Room right of the plot for the average label. */
const AVERAGE_GUTTER = 56
/** The margin above the plot that holds the denial lane: a 20px face and 8px
 *  of air over its column's track. */
const LANE = 28
/** Narrower columns get a dot in the lane instead of a face. */
const FACE_PITCH = 20
/** Integer steps: 1 to 8 times a power of ten. */
const TICK_STEPS = [0, 1, 2, 3, 4, 5].flatMap((power) =>
  [1, 2, 3, 4, 5, 6, 8].map((step) => step * 10 ** power)
)

/** The readout above the chart carries the details, so the tooltip draws none. */
const NO_TOOLTIP_CARD = () => null

const OUTCOME_LIST = new Intl.ListFormat("en-US", { type: "conjunction" })

type PlotBox = { x: number; y: number; width: number; height: number }
/** Bucket indexes, first <= last. */
type IndexSpan = { first: number; last: number }

const isBucket = (value: unknown): value is Bucket =>
  typeof value === "object" &&
  value !== null &&
  "start" in value &&
  "end" in value

const spanOf = (a: number, b: number): IndexSpan => ({
  first: Math.min(a, b),
  last: Math.max(a, b),
})

/** Zero to the first round top in two or three integer steps that clears the
 *  peak by 6%, so even the tallest column keeps a lit run of track. */
function fitTicks(peak: number) {
  const target = Math.max(peak + 1, Math.ceil(peak * 1.06))
  let best = { step: target, count: 1 }
  for (const count of [3, 2]) {
    const step =
      TICK_STEPS.find((candidate) => candidate * count >= target) ??
      Math.ceil(target / count)
    // A tie keeps three steps, the finer scale.
    if (best.count === 1 || step * count < best.step * best.count)
      best = { step, count }
  }
  return Array.from({ length: best.count + 1 }, (_, i) => i * best.step)
}

/** Who acted in a bucket: the busiest actor (a tie keeps the first to reach
 *  it) and how many distinct actors there were. */
function actorsIn(events: AuditEvent[]) {
  const counts = new Map<ActorId, number>()
  let leader: { actorId: ActorId; count: number } | null = null
  for (const event of events) {
    const count = (counts.get(event.actorId) ?? 0) + 1
    counts.set(event.actorId, count)
    if (!leader || count > leader.count)
      leader = { actorId: event.actorId, count }
  }
  return { leader, distinct: counts.size }
}

/** The hovered bucket, read out above the bars so no card ever covers one:
 *  every outcome (hidden ones too, the total a click opens) and who drove it. */
function BucketMeta({
  bucket,
  events,
  shown,
  showWindow = true,
}: {
  bucket: Bucket
  events: AuditEvent[]
  shown: Outcome[]
  /** Off for a selection: the header already names its window. */
  showWindow?: boolean
}) {
  const total = OUTCOMES.reduce((sum, outcome) => sum + bucket[outcome], 0)
  const { leader, distinct } = actorsIn(events)
  // Whoever drove the window wears the face the lane and the queue use.
  const leaderShown = leader !== null && (total === 1 || leader.count > 1)

  return (
    <>
      {showWindow ? (
        <span className="text-foreground font-medium">
          {formatWindow(bucket.start, bucket.end)}
        </span>
      ) : null}
      {/* One unit, so a narrow block wraps the counts to their own line. */}
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-3",
          showWindow && "@xl:ms-1.5"
        )}
      >
        {OUTCOMES.map((outcome) => (
          <span key={outcome} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "size-2 shrink-0 rounded-full",
                shown.includes(outcome)
                  ? OUTCOME_DOT[outcome]
                  : "border-muted-foreground/60 border"
              )}
            />
            <span
              className={cn(
                bucket[outcome] > 0 && "text-foreground font-medium"
              )}
            >
              {bucket[outcome]}
            </span>
            {OUTCOME_CONFIG[outcome].label}
          </span>
        ))}
      </span>
      {leader ? (
        <span className="hidden min-w-0 items-center gap-1.5 @5xl:flex">
          <DotSeparator />
          {leaderShown ? (
            <>
              <span className="sr-only">Top actor</span>
              <ActorAvatar actorId={leader.actorId} />
              <span className="truncate">
                {ACTORS[leader.actorId].name}
                {total > 1 ? ` (${leader.count})` : ""}
              </span>
            </>
          ) : (
            <span className="truncate">{distinct} actors</span>
          )}
        </span>
      ) : null}
    </>
  )
}

/** The hatch tiles, one per outcome, opaque so the track never shows through. */
function HatchPatterns({ id }: { id: string }) {
  return (
    <defs>
      {OUTCOMES.map((outcome) => (
        <pattern
          key={outcome}
          id={`${id}-${outcome}`}
          width={HATCH}
          height={HATCH}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect
            width={HATCH}
            height={HATCH}
            style={{ fill: HATCH_PAINT[outcome].ground }}
          />
          {/* Inset by half its width, so the tile edge never clips the stripe. */}
          <line
            x1={STRIPE / 2}
            x2={STRIPE / 2}
            y2={HATCH}
            strokeWidth={STRIPE}
            style={{ stroke: HATCH_PAINT[outcome].stripe }}
          />
        </pattern>
      ))}
    </defs>
  )
}

/** Reports the bar the pointer or keyboard is on, for the lit column and Enter. */
function ActiveLabelReporter({
  onChange,
  pass,
}: {
  onChange: (label: string | null) => void
  /** Bumped on focus, so a label cleared on blur is reported again. */
  pass: number
}) {
  const label = useActiveTooltipLabel()
  useEffect(() => {
    onChange(label === undefined || label === null ? null : String(label))
  }, [label, onChange, pass])
  return null
}

/** Reports where the bars are drawn, so a pointer maps to a column and the
 *  lane can pin faces over them. */
function PlotAreaReporter({
  onChange,
}: {
  onChange: (box: PlotBox | null) => void
}) {
  const plot = usePlotArea()
  const x = plot?.x
  const y = plot?.y
  const width = plot?.width
  const height = plot?.height
  useEffect(() => {
    onChange(
      x === undefined ||
        y === undefined ||
        width === undefined ||
        height === undefined
        ? null
        : { x, y, width, height }
    )
  }, [x, y, width, height, onChange])
  return null
}

export function EventVolumeChart({
  events,
  priorTotal,
  range,
  selection,
  onSelectionChange,
  activeLabel,
  onActiveLabelChange,
  linkedBucketKey,
}: {
  events: AuditEvent[]
  /** Events under the same filters in the window before this range. */
  priorTotal: number
  range: TimeRange
  selection: BucketSpan | null
  onSelectionChange: (span: BucketSpan | null) => void
  /** The column the pointer or keyboard is on; the queue lights its rows. */
  activeLabel: string | null
  onActiveLabelChange: (label: string | null) => void
  /** The column of the queue row being pointed at, lit under the bars. */
  linkedBucketKey: string | null
}) {
  const [shown, setShown] = useState<Outcome[]>(OUTCOMES)
  const [plot, setPlot] = useState<PlotBox | null>(null)
  const [focusPass, setFocusPass] = useState(0)
  // Pattern ids are document-global, so each chart gets its own.
  const hatchId = `hatch-${useId().replace(/[^\w-]/g, "")}`
  const [draft, setDraft] = useState<IndexSpan | null>(null)
  const dragRef = useRef<{ anchor: number; extend: boolean } | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const dragging = draft !== null

  // A pointer drag leaves focus where it was, so Escape cancels it page-wide.
  useEffect(() => {
    if (!dragging) return
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return
      dragRef.current = null
      setDraft(null)
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [dragging])

  const buckets = useMemo(() => bucketize(events, range), [events, range])
  const eventsByBucket = useMemo(() => {
    const map = new Map<string, AuditEvent[]>()
    for (const event of events) {
      const key = bucketKeyOf(event, range)
      const list = map.get(key)
      if (list) list.push(event)
      else map.set(key, [event])
    }
    return map
  }, [events, range])
  const totals = useMemo(() => {
    const counts: Record<Outcome, number> = { success: 0, denied: 0, failed: 0 }
    for (const event of events) counts[event.outcome] += 1
    return counts
  }, [events])
  // Day ranges label midnights only; shorter ranges let the axis thin itself.
  const ticks = useMemo(
    () =>
      range === "7d"
        ? buckets
            .filter((bucket) => bucket.start % DAY_MS === 0)
            .map((bucket) => bucket.key)
        : undefined,
    [buckets, range]
  )

  const tickFormatter = useCallback(
    (value: unknown) => formatTick(String(value), range),
    [range]
  )

  const stackTotal = (bucket: Bucket) =>
    shown.reduce((sum, outcome) => sum + bucket[outcome], 0)
  const plotted = buckets.reduce((sum, bucket) => sum + stackTotal(bucket), 0)
  const peak = Math.max(0, ...buckets.map(stackTotal))
  // Stable between hovers, so the axis never re-registers mid-interaction.
  const yTicks = useMemo(() => fitTicks(peak), [peak])
  const yTop = yTicks[yTicks.length - 1]
  const average = buckets.length > 0 ? plotted / buckets.length : 0
  // Rounded once, so a line is drawn only when its label would not read 0.
  const averageLabel =
    average >= 10 ? Math.round(average) : Number(average.toFixed(1))
  const total = events.length

  const indexOf = (key: string) =>
    buckets.findIndex((bucket) => bucket.key === key)
  const fromIndex = selection ? indexOf(selection.from) : -1
  const toIndex = selection ? indexOf(selection.to) : -1
  const selected =
    fromIndex >= 0 && toIndex >= 0 ? spanOf(fromIndex, toIndex) : null
  const focus = draft ?? selected
  const activeIndex = activeLabel === null ? -1 : indexOf(activeLabel)
  const hovered = activeIndex >= 0 ? buckets[activeIndex] : undefined
  const linkedIndex =
    activeLabel === null && linkedBucketKey !== null
      ? indexOf(linkedBucketKey)
      : -1

  /** A repeat click on the one selected bar clears it; a drag never does. */
  function select(span: IndexSpan, toggle: boolean) {
    const from = buckets[span.first]
    const to = buckets[span.last]
    if (!from || !to) return
    const same = selection?.from === from.key && selection.to === to.key
    onSelectionChange(same && toggle ? null : { from: from.key, to: to.key })
  }

  /** Shift adds the bar and everything between it and the selection. */
  function extendTo(index: number) {
    if (!selected) return select(spanOf(index, index), true)
    select(
      spanOf(Math.min(selected.first, index), Math.max(selected.last, index)),
      false
    )
  }

  // The pointer decides the column: the tooltip index lags a frame behind a
  // tap, and the whole column is the hit area, so empty segments still select.
  function indexAt(event: PointerEvent<HTMLDivElement>) {
    if (!plot || plot.width <= 0 || buckets.length === 0) return -1
    const offset =
      event.clientX - event.currentTarget.getBoundingClientRect().left - plot.x
    // Clamped, so the margins and axis labels pick the nearest column.
    return Math.min(
      buckets.length - 1,
      Math.max(0, Math.floor((offset / plot.width) * buckets.length))
    )
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const index = indexAt(event)
    if (index < 0) return
    // Captured, so a drag that leaves the chart still ends here.
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { anchor: index, extend: event.shiftKey }
    setDraft(spanOf(index, index))
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const index = drag ? indexAt(event) : -1
    if (!drag || index < 0) return
    setDraft((current) =>
      current &&
      current.first === Math.min(drag.anchor, index) &&
      current.last === Math.max(drag.anchor, index)
        ? current
        : spanOf(drag.anchor, index)
    )
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const index = drag ? indexAt(event) : -1
    cancelDrag()
    if (!drag || index < 0) return
    if (index !== drag.anchor) select(spanOf(drag.anchor, index), false)
    else if (drag.extend) extendTo(index)
    else select(spanOf(index, index), true)
  }

  function cancelDrag() {
    dragRef.current = null
    setDraft(null)
  }

  // Capture phase: Recharts toggles its tooltip on Enter, so a handled key
  // stops here and the tooltip stays on the bar it just selected.
  function handleKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
    // A drag in progress is the window listener's Escape, not this one.
    if (event.key === "Escape" && selection && !dragging) {
      event.preventDefault()
      onSelectionChange(null)
      return
    }
    if ((event.key === "Enter" || event.key === " ") && activeIndex >= 0) {
      event.preventDefault()
      event.stopPropagation()
      if (event.shiftKey) extendTo(activeIndex)
      else select(spanOf(activeIndex, activeIndex), true)
    }
  }

  /** The button unmounts with the selection, so a keyboard press hands focus
   *  back to the bars (detail 0 means no pointer was involved). */
  function showAll(event: MouseEvent<HTMLButtonElement>) {
    onSelectionChange(null)
    if (event.detail === 0)
      chartRef.current?.querySelector<SVGElement>(".recharts-surface")?.focus()
  }

  /** Each segment is its own pill: inner seams give up half the gap each, so
   *  the stack keeps its true height. An empty outcome draws nothing. */
  function segmentOf(props: BarShapeProps, outcome: Outcome) {
    const bucket = isBucket(props.payload) ? props.payload : null
    if (!bucket || bucket[outcome] === 0) return null
    const filled = shown.filter((item) => bucket[item] > 0)
    const at = filled.indexOf(outcome)
    const above = at < filled.length - 1 ? SEGMENT_GAP / 2 : 0
    const below = at > 0 ? SEGMENT_GAP / 2 : 0
    const height = Math.max(1, props.height - above - below)
    return { y: props.y + above, height }
  }

  /** The hatch tile is opaque, so the average line never shows through. */
  function renderSegment(props: BarShapeProps, outcome: Outcome) {
    const segment = segmentOf(props, outcome)
    if (!segment) return <g />
    return (
      <Rectangle
        {...props}
        {...segment}
        radius={BAR_RADIUS}
        fill={`url(#${hatchId}-${outcome})`}
      />
    )
  }

  /** Every column keeps a full-height track, so empty buckets still read; it
   *  darkens when lit, more when selected, and most when both. */
  function renderTrack(props: BarShapeProps) {
    const index = props.index
    const selectedTrack =
      focus !== null && index >= focus.first && index <= focus.last
    const lit = index === activeIndex || index === linkedIndex
    return (
      // Recharts passes the full-height background box as the rect itself.
      <Rectangle
        x={props.x}
        y={props.y}
        width={props.width}
        height={props.height}
        radius={BAR_RADIUS}
        className={
          lit && selectedTrack
            ? "fill-muted-foreground/50 dark:fill-muted-foreground/60"
            : selectedTrack
              ? "fill-muted-foreground/35 dark:fill-muted-foreground/45"
              : lit
                ? "fill-muted-foreground/20 dark:fill-muted-foreground/30"
                : "fill-muted"
        }
      />
    )
  }

  const hoveredTotal = hovered
    ? OUTCOMES.reduce((sum, outcome) => sum + hovered[outcome], 0)
    : 0
  const rangeMeta = (
    <>
      {priorTotal > 0 ? (
        <span className="inline-flex items-center gap-1">
          {total > priorTotal ? (
            <TrendingUp aria-hidden="true" className="size-4" />
          ) : total < priorTotal ? (
            <TrendingDown aria-hidden="true" className="size-4" />
          ) : null}
          {formatChange(total, priorTotal, range)}
        </span>
      ) : (
        <span>No prior {range} to compare</span>
      )}
      {total > 0 ? (
        <>
          <DotSeparator />
          <span>{formatShare(totals.denied, total)} denied</span>
        </>
      ) : null}
    </>
  )

  // A committed selection reads out as one window: its totals and its leader.
  const span =
    selected && !draft ? buckets.slice(selected.first, selected.last + 1) : null
  const spanBucket: Bucket | null = span
    ? {
        key: span[0].key,
        start: span[0].start,
        end: span[span.length - 1].end,
        success: span.reduce((sum, bucket) => sum + bucket.success, 0),
        denied: span.reduce((sum, bucket) => sum + bucket.denied, 0),
        failed: span.reduce((sum, bucket) => sum + bucket.failed, 0),
      }
    : null
  const spanTotal = spanBucket
    ? OUTCOMES.reduce((sum, outcome) => sum + spanBucket[outcome], 0)
    : 0

  const pitch = plot && buckets.length > 0 ? plot.width / buckets.length : 0
  // Open denials pin their leader's face over the column, and hide with the
  // Denied chip like the bars.
  const laneMarks = useMemo(() => {
    const marks: DenialMark[] = []
    if (!plot || buckets.length === 0 || !shown.includes("denied")) return marks
    const indexByKey = new Map(buckets.map((bucket, i) => [bucket.key, i]))
    for (const [key, list] of eventsByBucket) {
      const index = indexByKey.get(key)
      const leader = actorsIn(
        list.filter((event) => event.outcome === "denied" && !event.reviewedBy)
      ).leader
      if (index === undefined || !leader) continue
      marks.push({
        key,
        cx: Math.round(plot.x + ((index + 0.5) * plot.width) / buckets.length),
        actorId: leader.actorId,
      })
    }
    return marks
  }, [plot, buckets, eventsByBucket, shown])

  const chartLabel = `Events per bucket: ${OUTCOME_LIST.format(
    shown.map((outcome) => OUTCOME_CONFIG[outcome].label)
  )}. Arrow keys move, Enter selects, Shift+Enter extends, Escape clears.`

  return (
    <Frame
      dense
      variant="default"
      spacing="default"
      className="flex h-full min-w-0 flex-col"
    >
      <FrameHeader className="flex-row flex-wrap items-center justify-between gap-3">
        {/* A fixed basis: a long selected window truncates instead of wrapping
            the chips, so the header never changes height. */}
        <div className="flex min-w-0 grow basis-40 flex-col gap-px">
          <FrameTitle>Event Volume</FrameTitle>
          {/* Inter's tabular figures widen the hyphen in "6-hour". */}
          <FrameDescription
            className={cn("truncate text-xs", selected && "tabular-nums")}
          >
            {selected
              ? `${formatWindow(
                  buckets[selected.first].start,
                  buckets[selected.last].end
                )} selected`
              : `${TIME_RANGES[range].bucketLabel}, UTC`}
          </FrameDescription>
        </div>
        {/* The stock pressed fill is bg-muted, the band's own tone, so an on
            chip lifts to the card surface instead. */}
        <ToggleGroup
          multiple
          variant="outline"
          size="sm"
          value={shown}
          onValueChange={(next) => {
            // One outcome always stays plotted, so the chart never blanks.
            const picked = OUTCOMES.filter((outcome) => next.includes(outcome))
            if (picked.length > 0) setShown(picked)
          }}
          aria-label="Outcomes in the chart"
          className="flex-wrap"
        >
          {OUTCOMES.map((outcome) => (
            <ToggleGroupItem
              key={outcome}
              value={outcome}
              aria-label={`${OUTCOME_CONFIG[outcome].label}, ${totals[outcome]} events`}
              className="text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground gap-1.5"
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  shown.includes(outcome)
                    ? OUTCOME_DOT[outcome]
                    : "border-muted-foreground/60 border"
                )}
              />
              {OUTCOME_CONFIG[outcome].label}
              <span className="tabular-nums">{totals[outcome]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FrameHeader>
      <FramePanel className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          {/* Hovering a bar swaps the range total for that bucket. */}
          <div aria-live="polite" aria-atomic="true" className="min-w-0">
            {hovered ? (
              <Readout
                figure={hoveredTotal}
                label={hoveredTotal === 1 ? "event" : "events"}
                twoLineMeta
                meta={
                  <BucketMeta
                    bucket={hovered}
                    events={eventsByBucket.get(hovered.key) ?? []}
                    shown={shown}
                  />
                }
              />
            ) : span && spanBucket ? (
              <Readout
                figure={spanTotal}
                label={spanTotal === 1 ? "event" : "events"}
                twoLineMeta
                meta={
                  <BucketMeta
                    bucket={spanBucket}
                    events={span.flatMap(
                      (bucket) => eventsByBucket.get(bucket.key) ?? []
                    )}
                    shown={shown}
                    showWindow={false}
                  />
                }
              />
            ) : (
              <Readout
                figure={total}
                label={total === 1 ? "event" : "events"}
                twoLineMeta
                meta={rangeMeta}
              />
            )}
          </div>
          {/* Beside the chart it resets, so the chips above never shift. */}
          {selection ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={showAll}
            >
              Show all
            </Button>
          ) : null}
        </div>
        {/* Sets the row height: the denied queue scrolls within it, so a range
            switch never moves the grid. */}
        <div className="relative mt-auto min-w-0">
          <ChartContainer
            config={VOLUME_CHART_CONFIG}
            role="group"
            aria-label={chartLabel}
            ref={chartRef}
            onKeyDownCapture={handleKeyDownCapture}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={cancelDrag}
            onFocusCapture={() => setFocusPass((pass) => pass + 1)}
            // Recharts keeps a keyboard column after focus leaves; clear it
            // unless the pointer still rests on one.
            onBlurCapture={(event) => {
              const next = event.relatedTarget
              if (next instanceof Node && event.currentTarget.contains(next))
                return
              if (!event.currentTarget.matches(":hover"))
                onActiveLabelChange(null)
            }}
            className="has-[.recharts-surface:focus-visible]:ring-ring/50 h-48 w-full min-w-0 cursor-pointer touch-pan-y select-none has-[.recharts-surface:focus-visible]:ring-[3px] @4xl:h-62"
          >
            <BarChart
              accessibilityLayer
              data={buckets}
              margin={{
                top: LANE,
                right: AVERAGE_GUTTER,
                bottom: 0,
                left: 0,
              }}
              barCategoryGap="20%"
            >
              <ActiveLabelReporter
                onChange={onActiveLabelChange}
                pass={focusPass}
              />
              <PlotAreaReporter onChange={setPlot} />
              <HatchPatterns id={hatchId} />
              <XAxis
                dataKey="key"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={24}
                ticks={ticks}
                tickFormatter={tickFormatter}
              />
              {/* A quiet scale: two or three round steps, no line or grid; the
                  tracks carry the frame and the readout gives exact counts. */}
              <YAxis
                // 7px a digit plus the margin; "auto" re-measures in a loop.
                width={10 + String(yTop).length * 7}
                axisLine={false}
                tickLine={false}
                tickSize={0}
                tickMargin={6}
                ticks={yTicks}
                domain={[0, yTicks[yTicks.length - 1]]}
                allowDecimals={false}
              />
              {/* No card and no cursor: the tooltip only drives the lit track. */}
              <ChartTooltip cursor={false} content={NO_TOOLTIP_CARD} />
              {/* All three stay mounted and hide instead: a remounted series
                  re-registers last and would jump to the top of the stack. */}
              {OUTCOMES.map((outcome) => (
                <Bar
                  key={outcome}
                  dataKey={outcome}
                  stackId="events"
                  hide={!shown.includes(outcome)}
                  // The lowest plotted series draws the track for the stack.
                  background={outcome === shown[0] ? renderTrack : false}
                  maxBarSize={MAX_BAR_SIZE}
                  isAnimationActive={false}
                  shape={(props: BarShapeProps) =>
                    renderSegment(props, outcome)
                  }
                />
              ))}
              {averageLabel > 0 ? (
                // Above the tracks, below the bars: it never cuts a pill.
                <ReferenceLine
                  zIndex={250}
                  y={average}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.6}
                  strokeDasharray="4 4"
                  label={{
                    value: `Avg ${averageLabel}`,
                    position: "right",
                    offset: 6,
                    fill: "var(--muted-foreground)",
                  }}
                />
              ) : null}
            </BarChart>
          </ChartContainer>
          {plot ? (
            <DenialLane
              marks={laneMarks}
              plotTop={plot.y}
              faces={pitch >= FACE_PITCH}
            />
          ) : null}
          {plotted === 0 ? (
            <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-xs">
              No matching events in this window
            </p>
          ) : null}
        </div>
      </FramePanel>
    </Frame>
  )
}