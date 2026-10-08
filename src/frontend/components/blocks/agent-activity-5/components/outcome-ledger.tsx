import { Badge } from "@/components/reui/badge"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import {
  formatDuration,
  ITEM_WORD,
  itemLine,
  type ItemState,
  type OutcomeItem,
} from "./data"
import { ICON_COPY, ICON_DONE, ICON_FAILED, ICON_RETRY } from "./icons"

/** 8px here, plus the panel's gutter, lands on the frame's own text column. */
const ROW_X = "px-2"

const ROW = "group/row flex-nowrap items-start gap-2.5 py-1.5 text-left"

/** The house reveal: opacity only inside an always-present box, so controls never
    reflow the list. Always on below md and on coarse pointers, where hover is absent. */
const REVEAL =
  "pointer-events-none opacity-0 transition-opacity group-hover/row:pointer-events-auto group-hover/row:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 max-md:pointer-events-auto max-md:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100"

/** The clock is a column, not an afterthought: one width for every row, so the
    numbers stack into a single right edge. */
const CLOCK =
  "text-muted-foreground w-12 shrink-0 self-start text-end text-xs leading-5 tabular-nums"

// Tinted chips keep the band as the card's single solid accent.
const STATE_BADGE: Record<
  ItemState,
  "success-light" | "destructive-light" | "warning-light" | "outline"
> = {
  succeeded: "success-light",
  failed: "destructive-light",
  // Skipped is unfinished work, not a neutral outcome: it reads as attention.
  skipped: "warning-light",
  cancelled: "outline",
}

function StateGlyph({ state }: { state: ItemState }) {
  if (state === "succeeded")
    return <span className="text-success">{ICON_DONE}</span>
  if (state === "failed")
    return <span className="text-destructive">{ICON_FAILED}</span>
  // Skipped and cancelled never ran, so they get a hollow mark rather than a
  // cross: nothing failed, the item simply never got its turn.
  return (
    <span
      className="border-muted-foreground/40 size-4 rounded-full border border-dashed"
      aria-hidden="true"
    />
  )
}

/** The one line the row shows about what backs it. A blocked step is the one
    a reader must stop and read, so it is set a tier above and never clamped. */
function leadOf(item: OutcomeItem, retrying: boolean) {
  if (retrying) return { text: "Running again", mono: false, blocked: false }
  if (item.needsYou) return { text: item.needsYou, mono: false, blocked: true }
  if (item.reason) return { text: item.reason, mono: false, blocked: false }
  if (item.evidence)
    return {
      text: item.evidence.label,
      mono: item.evidence.kind === "command",
      blocked: false,
    }
  if (item.verdict === "unsupported")
    return { text: "Nothing checked this", mono: false, blocked: false }
  return null
}

function RowAction({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function LedgerRow({
  item,
  retrying,
  onClear,
  onCopy,
  onRetry,
  busy,
  className,
}: {
  item: OutcomeItem
  retrying: boolean
  onClear: (id: string) => void
  onCopy: (text: string) => void
  onRetry: (id: string) => void
  busy: boolean
  className?: string
}) {
  const lead = leadOf(item, retrying)
  // A row that needs a person is not retryable: the retry would fail the same
  // way, which is what the Grant control below the line is for.
  const canRetry =
    item.state === "failed" &&
    !item.needsYou &&
    !item.closed &&
    !retrying &&
    !busy

  return (
    <Item
      size="xs"
      aria-busy={retrying || undefined}
      className={cn(ROW, ROW_X, className)}
    >
      {/* h-5 matches the label line box, so the mark centers on the label. */}
      <ItemMedia variant="icon" className="h-5 w-4 translate-y-0 self-start">
        {retrying ? (
          // The header narrates the retry; silenced here so two spinners
          // cannot announce a bare "Loading" beside each other.
          <Spinner
            className="text-muted-foreground size-4"
            role="presentation"
            aria-hidden="true"
          />
        ) : (
          <StateGlyph state={item.state} />
        )}
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0.5">
        {/* line-clamp-1 leaves overflow:hidden behind once flex wins the
            display contest, and it shears the inline controls and their ring. */}
        <ItemTitle className="w-full min-w-0 flex-wrap gap-y-1 overflow-visible text-[13px] leading-5 font-normal">
          <span
            className={cn(
              "text-foreground min-w-0",
              item.state === "cancelled" && "text-muted-foreground line-through"
            )}
          >
            {item.label}
          </span>
          {/* The chips and the controls wrap as one cluster, so on a narrow row
              the icons never land on a line of their own. */}
          <span className="flex shrink-0 items-center gap-2">
            <Badge
              variant={retrying ? "info-light" : STATE_BADGE[item.state]}
              className="shrink-0 font-normal"
            >
              {retrying ? "Retrying" : ITEM_WORD[item.state]}
            </Badge>
            {item.verdict === "unsupported" ? (
              <Badge variant="outline" className="shrink-0 font-normal">
                Unsupported
              </Badge>
            ) : null}
            {item.closed ? (
              <Badge variant="outline" className="shrink-0 font-normal">
                Closed
              </Badge>
            ) : null}
            {/* Beside the label, not at the row's edge: the controls belong to
                the thing they act on, and the reserved box keeps the line still. */}
            <span
              className={cn("flex h-5 shrink-0 items-center gap-0.5", REVEAL)}
            >
              {canRetry ? (
                <RowAction
                  label="Retry this item"
                  icon={ICON_RETRY}
                  onClick={() => onRetry(item.id)}
                />
              ) : null}
              <RowAction
                label="Copy this row"
                icon={ICON_COPY}
                onClick={() => onCopy(itemLine(item))}
              />
            </span>
          </span>
        </ItemTitle>
        {lead ? (
          <ItemDescription
            className={cn(
              "min-w-0 leading-5",
              lead.blocked ? "line-clamp-none text-sm" : "text-xs",
              lead.mono && "font-mono break-all"
            )}
          >
            {lead.text}
          </ItemDescription>
        ) : null}
        {/* No retry clears this one, so the control sits under the line that
            asks for it, where it cannot squeeze the label on a phone. */}
        {item.needsYouAction ? (
          <ItemActions className="mt-1 self-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onClear(item.id)}
            >
              {item.needsYouAction}
            </Button>
          </ItemActions>
        ) : null}
      </ItemContent>
      <span className={CLOCK}>{formatDuration(item.durationMs)}</span>
    </Item>
  )
}

/** The row still being read back: a live spinner in the same glyph slot, and a
    shimmering line where the label lands. It claims no label and no verdict. */
export function LedgerRowPending() {
  return (
    <Item size="xs" className={cn(ROW, ROW_X)} aria-hidden="true">
      <ItemMedia variant="icon" className="h-5 w-4 translate-y-0 self-start">
        <Spinner
          className="text-muted-foreground size-4"
          role="presentation"
          aria-hidden="true"
        />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle className="text-muted-foreground h-5 w-full min-w-0 text-[13px] leading-5 font-normal">
          <span className="shimmer [--shimmer-duration:2.4s]">
            Reading the next item
          </span>
        </ItemTitle>
        {/* Bars, not text: ItemDescription renders a <p>, which cannot legally
            hold the Skeleton's div. */}
        <div className="flex h-5 items-center">
          <Skeleton className="h-3 w-2/5" />
        </div>
      </ItemContent>
      <span className={cn(CLOCK, "flex justify-end")}>
        <Skeleton className="h-3 w-8" />
      </span>
    </Item>
  )
}