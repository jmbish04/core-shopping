import { useRef, type MouseEvent } from "react"
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatAgo, isNewNetwork } from "./audit-format"
import { bucketKeyOf } from "./audit-query"
import { ACTORS, type AuditEvent, type TimeRange } from "./data"
import { hatchBackground } from "./hatch"
import { FIELD_ICONS, UI_ICONS } from "./icons"
import { Readout } from "./readout"
import { ActorAvatar, DotSeparator } from "./value-faces"
import { ArrowRightIcon } from "lucide-react"

/** Beyond this many denials a pill per denial gets too thin to read, so the
 *  meter shows two: reviewed and open. */
const METER_PILLS = 24
/** A reviewed denial is a bare track, like an empty column in the chart. */
const REVIEWED_PILL = "bg-muted"
/** An open denial wears the chart's amber hatch. */
const OPEN_HATCH = { backgroundImage: hatchBackground("denied") }
/** The chart's segment pill; it grows, never stretches, so the hatch keeps
 *  the chart's angle while its column is lit. */
const METER_PILL = "h-2 flex-1 rounded-full data-[linked=true]:h-3"

/** Denials in scope as pills, oldest to newest like the chart's axis. */
function ReviewMeter({
  inScope,
  range,
  litBucketKey,
  linkedEventId,
}: {
  inScope: AuditEvent[]
  range: TimeRange
  litBucketKey: string | null
  linkedEventId: string | null
}) {
  const reviewed = inScope.filter((event) => event.reviewedBy).length
  const open = inScope.length - reviewed

  return (
    <div className="flex h-5 min-w-0 items-center gap-3">
      <span aria-hidden className="flex min-w-0 flex-1 items-center gap-0.5">
        {inScope.length > METER_PILLS ? (
          <>
            {reviewed > 0 ? (
              <span
                className={cn(METER_PILL, REVIEWED_PILL)}
                style={{ flexGrow: reviewed }}
              />
            ) : null}
            {open > 0 ? (
              <span
                className={METER_PILL}
                style={{ ...OPEN_HATCH, flexGrow: open }}
              />
            ) : null}
          </>
        ) : (
          [...inScope]
            .reverse()
            .map((event) => (
              <span
                key={event.id}
                data-linked={
                  event.id === linkedEventId ||
                  bucketKeyOf(event, range) === litBucketKey
                    ? "true"
                    : undefined
                }
                className={cn(METER_PILL, event.reviewedBy && REVIEWED_PILL)}
                style={event.reviewedBy ? undefined : OPEN_HATCH}
              />
            ))
        )}
      </span>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {reviewed} of {inScope.length} reviewed
      </span>
    </div>
  )
}

/** Unreviewed denials, newest first, narrowed by the chart's time selection
 *  but never by the chips. */
export function DeniedAttemptsList({
  denied,
  inScope,
  scoped,
  range,
  litBucketKey,
  linkedEventId,
  onLinkEvent,
  onClearSelection,
  currentId,
  onOpenEvent,
  onReview,
  onReviewAll,
}: {
  denied: AuditEvent[]
  /** Every denial in scope, reviewed or not, for the meter. */
  inScope: AuditEvent[]
  /** A chart selection narrows the queue to its window. */
  scoped: boolean
  range: TimeRange
  /** The chart column under the pointer; its rows light. */
  litBucketKey: string | null
  linkedEventId: string | null
  onLinkEvent: (id: string | null) => void
  onClearSelection: () => void
  /** The event open in the sheet, if any. */
  currentId: string | null
  onOpenEvent: (id: string) => void
  onReview: (event: AuditEvent) => void
  onReviewAll: () => void
}) {
  const oldest = denied.at(-1)
  const actorCount = new Set(denied.map((event) => event.actorId)).size
  const newNetwork = denied.filter((event) => isNewNetwork(event.ip)).length
  const panelRef = useRef<HTMLDivElement>(null)

  /** The row unmounts once reviewed, so a keyboard press hands focus to the
   *  neighbouring row, or the panel after the last (detail 0: no pointer). */
  function review(click: MouseEvent<HTMLButtonElement>, event: AuditEvent) {
    onLinkEvent(null)
    if (click.detail === 0) {
      const row = click.currentTarget.closest("li")
      const next = row?.nextElementSibling ?? row?.previousElementSibling
      const target = next?.querySelector("button")
      if (target) target.focus()
      else panelRef.current?.focus()
    }
    onReview(event)
  }

  /** The Empty unmounts as the rows return, so a keyboard press lands focus
   *  on the panel instead of the page. */
  function showAll(click: MouseEvent<HTMLButtonElement>) {
    onClearSelection()
    if (click.detail === 0) panelRef.current?.focus()
  }

  return (
    <Frame
      dense
      variant="default"
      spacing="default"
      className="flex h-full min-w-0 flex-col"
    >
      <FrameHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-px">
          <FrameTitle>Denied Attempts</FrameTitle>
          <FrameDescription className="text-xs">
            {scoped
              ? "Selected window only"
              : oldest
                ? `Newest first, oldest ${formatAgo(oldest.at)}`
                : "Unreviewed, newest first"}
          </FrameDescription>
        </div>
        {/* Nothing to triage once the queue is clear, so no call to review. */}
        {denied.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={onReviewAll}
          >
            Review all
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
        ) : null}
      </FrameHeader>
      <FramePanel
        ref={panelRef}
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col gap-4 outline-none"
      >
        <Readout
          figure={denied.length}
          label="to review"
          meta={
            denied.length > 0 ? (
              <>
                <span>
                  {actorCount} {actorCount === 1 ? "actor" : "actors"}
                </span>
                {/* Glyph first, so it keys the one the rows carry. */}
                {newNetwork > 0 ? (
                  <>
                    <DotSeparator />
                    <span className="flex items-center gap-1">
                      <span className="text-warning flex">
                        {FIELD_ICONS.ip}
                      </span>
                      {newNetwork} from a new network
                    </span>
                  </>
                ) : null}
              </>
            ) : null
          }
        />
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {inScope.length > 0 ? (
            <ReviewMeter
              inScope={inScope}
              range={range}
              litBucketKey={litBucketKey}
              linkedEventId={linkedEventId}
            />
          ) : null}
          {denied.length > 0 ? (
            /* Beside the chart it scrolls within the row the chart sets;
               stacked, it grows. */
            <div className="relative min-w-0 @4xl:min-h-36 @4xl:flex-1">
              <ul
                aria-label="Denied attempts"
                className="@4xl:scroll-fade-y -mx-2.5 flex flex-col @4xl:absolute @4xl:inset-0 @4xl:overflow-y-auto"
              >
                {denied.map((event) => (
                  <li
                    key={event.id}
                    className="group/row relative"
                    // On the li, so the row and its check light the column as one.
                    onPointerEnter={(pointer) => {
                      if (pointer.pointerType === "mouse") onLinkEvent(event.id)
                    }}
                    onPointerLeave={() => onLinkEvent(null)}
                    // Keyboard focus only: a sheet handing focus back must not.
                    onFocus={(focus) => {
                      if (focus.target.matches(":focus-visible"))
                        onLinkEvent(event.id)
                    }}
                    onBlur={(blur) => {
                      const next = blur.relatedTarget
                      if (!(
                        next instanceof Node &&
                        blur.currentTarget.contains(next)
                      ))
                        onLinkEvent(null)
                    }}
                  >
                    <Item
                      size="xs"
                      className="group-hover/row:bg-muted aria-[current=true]:bg-muted data-[linked=true]:bg-muted dark:group-hover/row:bg-muted/50 dark:aria-[current=true]:bg-muted/50 dark:data-[linked=true]:bg-muted/50 cursor-pointer items-start text-start focus-visible:ring-inset"
                      aria-current={currentId === event.id ? "true" : undefined}
                      data-linked={
                        bucketKeyOf(event, range) === litBucketKey
                          ? "true"
                          : undefined
                      }
                      render={
                        <button
                          type="button"
                          onClick={() => onOpenEvent(event.id)}
                        />
                      }
                    >
                      <ItemMedia>
                        <ActorAvatar actorId={event.actorId} />
                      </ItemMedia>
                      <ItemContent className="min-w-0">
                        <ItemTitle className="max-w-full min-w-0 gap-1.5">
                          <span className="min-w-0 truncate">
                            {ACTORS[event.actorId].name}
                          </span>
                          {/* The one risk cue a row carries; the summary above
                              counts it, so a glyph is enough here. */}
                          {isNewNetwork(event.ip) ? (
                            <span className="text-warning flex shrink-0">
                              {FIELD_ICONS.ip}
                              <span className="sr-only">
                                From a new network
                              </span>
                            </span>
                          ) : null}
                        </ItemTitle>
                        <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                          <span className="shrink-0 font-mono">
                            {event.action}
                          </span>
                          <DotSeparator />
                          <span className="truncate">
                            {event.resource.name}
                          </span>
                        </span>
                      </ItemContent>
                      <ItemActions>
                        <span className="text-muted-foreground text-xs leading-5 tabular-nums">
                          {formatAgo(event.at)}
                        </span>
                      </ItemActions>
                    </Item>
                    {/* A sibling of the row, never inside it. Shown on hover or focus,
                        and always on touch, which has no hover. */}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Mark ${ACTORS[event.actorId].name}'s ${event.action} on ${event.resource.name}, ${formatAgo(event.at)}, reviewed`}
                            className="hover:bg-card absolute end-2.5 bottom-1 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100"
                            onClick={(click) => review(click, event)}
                          />
                        }
                      >
                        {UI_ICONS.check}
                      </TooltipTrigger>
                      <TooltipContent>Mark reviewed</TooltipContent>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Empty className="@4xl:flex-1">
              <EmptyHeader>
                <EmptyMedia variant="icon">{UI_ICONS.circleCheck}</EmptyMedia>
                <EmptyTitle>
                  {inScope.length > 0 ? "All Reviewed" : "No Denials"}
                </EmptyTitle>
                <EmptyDescription>
                  {inScope.length > 0
                    ? `No denied attempts wait in this ${scoped ? "window" : "range"}.`
                    : `Nothing was denied in this ${scoped ? "window" : "range"}.`}
                </EmptyDescription>
              </EmptyHeader>
              {scoped ? (
                <EmptyContent>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={showAll}
                  >
                    Show all
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          )}
        </div>
      </FramePanel>
    </Frame>
  )
}