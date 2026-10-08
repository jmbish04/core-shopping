"use client"

/**
 * The card a run leaves behind: a verdict per item with the evidence behind
 * it, a panel per row that says what backed it, and a retry scoped to the
 * failures. Swap OUTCOME and ITEMS in ./data.
 */
import { useEffect, useState, useSyncExternalStore } from "react"
import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"

import {
  formatDuration,
  ITEMS,
  OUTCOME,
  reportText,
  STATE_WORD,
  tally,
  totalMs,
  type OutcomeItem,
  type OutcomeState,
} from "./data"
import {
  ICON_COPY,
  ICON_DISCARD,
  ICON_MORE,
  ICON_REPORT,
  ICON_RESTORE,
  ICON_TRACE,
  TOAST_ERROR_ICON,
  TOAST_SUCCESS_ICON,
} from "./icons"
import { LedgerRow, LedgerRowPending } from "./outcome-ledger"

/** How long the scoped retry runs before the failed rows settle again. */
const RETRY_MS = 1600

/** The beat before the report resolves, while its ledger is still being read
    back. The card holds its own shape for it rather than popping in. */
const SETTLE_MS = 700

/** The house landing motion: a row that was just read slides the last pixel
    into place instead of blinking into existence. */
const LAND =
  "animate-in fade-in-50 slide-in-from-bottom-1 duration-300 ease-out motion-reduce:animate-none"

/** A footer control before the report resolves. The bar is a plain Skeleton;
    the ghost Button around it only lends the theme's own small-button box. */
function ActionShell({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      tabIndex={-1}
      aria-hidden="true"
      className={cn("pointer-events-none p-0", className)}
    >
      <Skeleton className="bg-input/50 size-full" />
    </Button>
  )
}

const BAND: Record<
  OutcomeState,
  "warning-light" | "success-light" | "outline"
> = {
  completedWithIssues: "warning-light",
  completed: "success-light",
  cancelled: "outline",
}

/** A finished retry: a recovered row keeps the time its failed attempt spent,
    and a skipped row settles only when the blocker it waited on recovered. */
function resolveRetry(items: OutcomeItem[], retried: string[]): OutcomeItem[] {
  const recovered = new Set(
    retried.filter((id) =>
      items.some(
        (item) => item.id === id && item.state === "failed" && item.recovered
      )
    )
  )
  return items.map((item) => {
    const unblocked =
      item.state === "skipped" &&
      item.blockedBy !== undefined &&
      recovered.has(item.blockedBy)
    const ran = item.state === "skipped" ? unblocked : recovered.has(item.id)
    if (!item.recovered || !ran) return item
    return {
      ...item,
      state: "succeeded",
      durationMs: item.durationMs + item.recovered.durationMs,
      evidence: item.recovered.evidence,
      verdict: "verified",
      reason: undefined,
      needsYou: undefined,
      needsYouAction: undefined,
    }
  })
}

/** The frozen demo pins the clock, so the report renders already read back.
    The server snapshot stays false, so hydration never mismatches. */
const subscribeNever = () => () => {}
function useFrozenDemo() {
  return useSyncExternalStore(
    subscribeNever,
    () => document.documentElement.dataset.demo === "frozen",
    () => false
  )
}

export function AgentActivity() {
  /** How many ledger rows have been read back. The report resolves row by
      row, so the card is never a finished shape holding empty rows. */
  const [readCount, setReadCount] = useState(0)
  const frozen = useFrozenDemo()
  const readBack = frozen ? ITEMS.length : readCount
  const [items, setItems] = useState<OutcomeItem[]>(ITEMS)
  const [discarded, setDiscarded] = useState(false)
  /** Ids currently being re-run, so those rows swap to a spinner. */
  const [retrying, setRetrying] = useState<string[]>([])

  const counts = tally(items)
  // A row blocked on a person is excluded: retrying it would fail again, and
  // the card says so in its own Needs you callout. A closed row is settled.
  const retryable = items.filter(
    (item) => item.state === "failed" && !item.needsYou && !item.closed
  )
  /** The retry set for these ids: the rows plus any skipped row waiting on
      one of them, so a cascaded recovery is watched rather than silent. */
  const cascadeFor = (ids: string[]) =>
    items
      .filter(
        (item) =>
          !item.closed &&
          (ids.includes(item.id) ||
            (item.state === "skipped" &&
              item.blockedBy !== undefined &&
              ids.includes(item.blockedBy)))
      )
      .map((item) => item.id)
  const retryCascade = cascadeFor(retryable.map((item) => item.id))
  const unfinished = items.filter(
    (item) =>
      (item.state === "failed" || item.state === "skipped") && !item.closed
  )
  const inFlight = retrying.length > 0
  /** Every copy reports what it did: a copy that says nothing is
      indistinguishable from one that failed. */
  const copyText = (text: string, what: string) => {
    const refused = () =>
      toast("Could not copy", {
        description: "Your browser refused clipboard access.",
        icon: TOAST_ERROR_ICON,
      })
    // An insecure origin has no clipboard API at all, so it fails loudly too.
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      refused()
      return
    }
    void navigator.clipboard
      .writeText(text)
      .then(() =>
        toast.success(`Copied the ${what}`, {
          description: "It is on your clipboard.",
          icon: TOAST_SUCCESS_ICON,
        })
      )
      .catch(refused)
  }

  // The band derives from the ledger, so a green Completed can only exist when
  // every row actually succeeded.
  const state: OutcomeState = discarded
    ? "cancelled"
    : items.every((item) => item.state === "succeeded")
      ? "completed"
      : "completedWithIssues"

  useEffect(() => {
    // Frozen demo: the clock is pinned, so no read-back timer starts.
    if (document.documentElement.dataset.demo === "frozen") return
    let cancelled = false
    const cleanups: Array<() => void> = []
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms)
        cleanups.push(() => clearTimeout(timer))
      })
    // Awaited per row rather than rescheduled from one tick, so each row waits
    // for its own read and the sequence cannot drift.
    async function read() {
      await wait(SETTLE_MS)
      for (const item of ITEMS) {
        await wait(item.readMs)
        if (cancelled) return
        setReadCount((n) => n + 1)
      }
    }
    void read()
    return () => {
      cancelled = true
      cleanups.forEach((stop) => stop())
    }
  }, [])

  useEffect(() => {
    // Frozen demo: the clock is pinned, so no retry timer starts.
    if (document.documentElement.dataset.demo === "frozen") return
    if (!retrying.length) return
    const timer = setTimeout(() => {
      const next = resolveRetry(items, retrying)
      // Counted from the ledger diff, so the toast can never report fewer
      // rows than the user just watched settle.
      const recovered = next.filter(
        (item, index) =>
          item.state === "succeeded" && items[index].state !== "succeeded"
      ).length
      // Counted across the whole ledger: a success line that ignores rows it
      // never attempted contradicts the Failed chips still on screen.
      const stillFailed = next.filter((item) => item.state === "failed").length
      setItems(next)
      setRetrying([])
      if (stillFailed) {
        toast("Retry finished", {
          description: `${recovered} recovered, ${stillFailed} still failed.`,
          icon: TOAST_ERROR_ICON,
        })
      } else {
        toast.success("Retry finished", {
          description: "Everything that failed has now settled.",
          icon: TOAST_SUCCESS_ICON,
        })
      }
    }, RETRY_MS)
    return () => clearTimeout(timer)
  }, [retrying, items])

  /** Accept the partial result: unfinished rows close with their state and
      reason intact, so the record still says what failed, and why. */
  const keepSucceeded = () => {
    const before = items
    const closed = unfinished.length
    setItems((current) =>
      current.map((item) =>
        item.state === "failed" || item.state === "skipped"
          ? {
              ...item,
              closed: true,
              // A cleared blocker's line invites a retry this closes, so the
              // row goes back on record with the reason it actually failed.
              reason:
                ITEMS.find((source) => source.id === item.id)?.reason ??
                item.reason,
              needsYou: undefined,
              needsYouAction: undefined,
            }
          : item
      )
    )
    toast.success("Kept what succeeded", {
      description: `${counts.succeeded} finished ${
        counts.succeeded === 1 ? "item" : "items"
      } kept, ${closed} closed.`,
      icon: TOAST_SUCCESS_ICON,
      action: { label: "Undo", onClick: () => setItems(before) },
    })
  }

  /** The unblocking control: clears the human blocker so the row turns
      retryable, and the row's own line says so. */
  const clearBlocker = (id: string) => {
    const blocked = items.find((item) => item.id === id)
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              needsYou: undefined,
              needsYouAction: undefined,
              reason: "The blocker is cleared. Retry to run this item again.",
            }
          : item
      )
    )
    toast.success("Blocker cleared", {
      description: blocked
        ? `${blocked.label} is ready to retry.`
        : "The item is ready to retry.",
      icon: TOAST_SUCCESS_ICON,
    })
  }

  const reading = readBack < items.length
  /** The decision cluster comes and goes; the summary beside it does not. */
  const deciding =
    reading || discarded || retryable.length > 0 || unfinished.length > 0

  return (
    <TooltipProvider>
      {/* One persistent region, outside aria-busy: a status that mounts with
          its text never announces, and aria-busy silences the ones inside. */}
      <span role="status" aria-live="polite" className="sr-only">
        {reading
          ? "Reading back the run report"
          : inFlight
            ? `Retrying ${retrying.length} of ${counts.total}`
            : discarded
              ? `Run discarded. ${counts.succeeded} of ${counts.total} had already finished.`
              : `${STATE_WORD[state]}. ${counts.succeeded} of ${counts.total} succeeded.`}
      </span>
      <Frame
        dense
        spacing="default"
        aria-busy={reading || inFlight}
        className="w-full max-w-2xl"
      >
        <FrameHeader className="h-9 flex-row items-center gap-3 py-0">
          {/* The run is the headline; the verdict trails it as a chip, so the
            eye lands on what ran before it lands on how it went. */}
          {readBack === 0 ? (
            <Skeleton className="bg-input/50 h-4 w-52" />
          ) : (
            <FrameTitle className="min-w-0 flex-1 truncate">
              {OUTCOME.label}
            </FrameTitle>
          )}
          {/* The verdict and the menu read as one trailing cluster: a chip with
            its own overflow, not two things that happen to share an edge. */}
          <div className="ms-auto flex shrink-0 items-center gap-1">
            {/* No band until every row is in: a verdict derived from half a
              ledger is a guess, and never says "Done" while one failed. */}
            {reading ? (
              <span className="text-muted-foreground shimmer text-xs [--shimmer-duration:2.4s]">
                Reading the report
              </span>
            ) : (
              <Badge
                variant={BAND[state]}
                className={cn("shrink-0 font-normal", LAND)}
              >
                {STATE_WORD[state]}
              </Badge>
            )}
            {reading ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                tabIndex={-1}
                aria-hidden="true"
                className="pointer-events-none -me-1.5 p-0"
              >
                <Skeleton className="bg-input/50 size-full" />
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Run actions"
                      className="text-muted-foreground hover:text-foreground -me-1.5"
                    />
                  }
                >
                  {ICON_MORE}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>This run</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() =>
                        toast("Opening the full activity", {
                          description: `Full activity for ${OUTCOME.id}.`,
                        })
                      }
                    >
                      {ICON_TRACE}
                      Full activity
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => copyText(OUTCOME.id, "run id")}
                    >
                      {ICON_COPY}
                      Copy run id
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => copyText(reportText(items), "report")}
                    >
                      {ICON_REPORT}
                      Copy the report
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  {discarded ? (
                    <DropdownMenuItem onClick={() => setDiscarded(false)}>
                      {ICON_RESTORE}
                      Restore run
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        // Clearing the retry first cancels its timer, so a
                        // discarded run cannot be resurrected by a stale one.
                        setRetrying([])
                        setDiscarded(true)
                      }}
                    >
                      {ICON_DISCARD}
                      Discard
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </FrameHeader>

        {discarded ? null : (
          <FramePanel className="flex flex-col gap-0 p-1.5 shadow-none">
            {items.slice(0, readBack).map((item) => (
              <LedgerRow
                key={item.id}
                item={item}
                retrying={retrying.includes(item.id)}
                onClear={clearBlocker}
                onCopy={(text) => copyText(text, "row")}
                onRetry={(id) => setRetrying(cascadeFor([id]))}
                busy={inFlight}
                className={LAND}
              />
            ))}
            {/* One pending row, never a predicted stack: the report's length is
              not known until the last row is read. */}
            {reading ? <LedgerRowPending /> : null}
          </FramePanel>
        )}

        {/* The run summary is permanent; only the decision cluster comes and
          goes, so a settled run still reports what it did. */}
        <FrameFooter className="flex-row flex-wrap items-center gap-2">
          {!deciding ? null : reading ? (
            // The settled arrangement, in bars: one segmented decision.
            <ButtonGroup aria-hidden="true">
              <ActionShell className="w-24" />
              <ActionShell className="w-40" />
            </ButtonGroup>
          ) : discarded ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDiscarded(false)}
            >
              Restore run
            </Button>
          ) : retryable.length ? (
            // One segmented decision about the retry scope: run the failures
            // again, or accept the partial result without them.
            <ButtonGroup aria-label="Retry decision">
              <Button
                type="button"
                size="sm"
                disabled={inFlight}
                onClick={() => setRetrying(retryCascade)}
              >
                Retry {retryable.length} failed
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={inFlight}
                onClick={keepSucceeded}
              >
                Keep what succeeded
              </Button>
            </ButtonGroup>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={keepSucceeded}
            >
              Keep what succeeded
            </Button>
          )}
          {/* Pushed right only when something sits to its left, so a settled
            run does not leave the line hugging one edge. */}
          {reading ? (
            <Skeleton
              className={cn("bg-input/50 h-3 w-44", deciding && "ms-auto")}
            />
          ) : (
            <div
              className={cn(
                "text-muted-foreground flex items-center gap-1.5 text-xs",
                deciding && "ms-auto"
              )}
            >
              <span className="tabular-nums">
                {discarded
                  ? `Discarded after ${counts.succeeded} succeeded`
                  : inFlight
                    ? `Retrying ${retrying.length} of ${counts.total}`
                    : `${counts.total} settled, ${counts.succeeded} succeeded`}
              </span>
              <span
                className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
                aria-hidden="true"
              />
              <span className="shrink-0 tabular-nums">
                ran {formatDuration(totalMs(items))}
              </span>
            </div>
          )}
        </FrameFooter>
      </Frame>
    </TooltipProvider>
  )
}