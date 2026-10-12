"use client"

import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { Badge } from "@/components/reui/badge"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { formatFull } from "./audit-format"
import { relatedEvents, reviewState } from "./audit-query"
import { CopyToken, useCopyFeedback } from "./copy-token"
import { AUDIT_LINK_BASE, type AuditEvent } from "./data"
import { ChangesTab, DetailsTab, RawTab, RelatedTab } from "./event-tabs"
import { UI_ICONS } from "./icons"
import { ActorFace, DotSeparator, OutcomeFace } from "./value-faces"

type SheetTab = "details" | "changes" | "raw" | "related"

const SHEET_TABS: { value: SheetTab; label: string }[] = [
  { value: "details", label: "Details" },
  { value: "changes", label: "Changes" },
  { value: "raw", label: "Raw" },
  { value: "related", label: "Related" },
]

const isSheetTab = (value: unknown): value is SheetTab =>
  SHEET_TABS.some((tab) => tab.value === value)

const TAB_TRIGGER = "h-full flex-none px-0 py-2 after:-bottom-px!"

type EventSheetProps = {
  event: AuditEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Position in the filtered, sorted grid; -1 when the filters exclude it. */
  index: number
  total: number
  onStep: (direction: 1 | -1) => void
  /** The full log, for request and session correlation. */
  events: AuditEvent[]
  onOpenEvent: (id: string) => void
  onToggleReview: (event: AuditEvent) => void
  onResourceHistory: (event: AuditEvent) => void
}

/** Keyed by event, so a "Copied" state never carries over to the next event. */
function CopyLinkButton({ id }: { id: string }) {
  const { copied, copy } = useCopyFeedback()
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => copy(`${AUDIT_LINK_BASE}/${id}`)}
    >
      {copied ? UI_ICONS.check : UI_ICONS.link}
      {copied ? "Copied" : "Copy link"}
    </Button>
  )
}

/** Ends stay focusable while disabled, so focus never drops to the page. */
function StepButton({
  label,
  shortcut,
  disabled,
  onClick,
  children,
}: {
  label: string
  shortcut: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${label} event`}
            aria-keyshortcuts={shortcut}
            disabled={disabled}
            focusableWhenDisabled
            className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-1.5">
        {label}
        <Kbd>{shortcut}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}

function EventView({
  event,
  index,
  total,
  onStep,
  tab,
  onTabChange,
  events,
  onOpenEvent,
  onToggleReview,
  onResourceHistory,
  onClose,
}: Omit<EventSheetProps, "event" | "open" | "onOpenChange"> & {
  event: AuditEvent
  tab: SheetTab
  onTabChange: (tab: SheetTab) => void
  onClose: () => void
}) {
  const related = useMemo(() => relatedEvents(event, events), [event, events])
  // One event can share both the request and the session; count it once.
  const relatedCount = new Set(
    [...related.request, ...related.session].map((other) => other.id)
  ).size
  const state = reviewState(event)
  const inGrid = index >= 0

  return (
    <>
      <div className="flex shrink-0 flex-col gap-2 px-5 py-3.5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <CopyToken key={event.id} value={event.id} label="event ID" />
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-muted-foreground text-xs tabular-nums">
                {inGrid ? `${index + 1} of ${total}` : "Outside filters"}
              </span>
              <StepButton
                label="Previous"
                shortcut="K"
                disabled={!inGrid || index === 0}
                onClick={() => onStep(-1)}
              >
                {UI_ICONS.chevronUp}
              </StepButton>
              <StepButton
                label="Next"
                shortcut="J"
                disabled={!inGrid || index >= total - 1}
                onClick={() => onStep(1)}
              >
                {UI_ICONS.chevronDown}
              </StepButton>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="-me-1 shrink-0"
                onClick={onClose}
              >
                {UI_ICONS.close}
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* The verb sits in its own span: the title's heading font would
                otherwise win over font-mono. */}
            <SheetTitle className="min-w-0 truncate text-base">
              <span className="font-mono">{event.action}</span>
            </SheetTitle>
            <OutcomeFace outcome={event.outcome} />
          </div>
          <SheetDescription>
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <ActorFace actorId={event.actorId} />
              <DotSeparator />
              <span className="tabular-nums">{formatFull(event.at)}</span>
            </span>
          </SheetDescription>
        </div>
        <p className="text-foreground text-sm">{event.summary}</p>
      </div>

      {/* The Tabs root ships a gap of its own, which would open a seam
          between the rule under the triggers and the panel below it. */}
      <Tabs
        value={tab}
        onValueChange={(next) => {
          if (isSheetTab(next)) onTabChange(next)
        }}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList
          variant="line"
          className="h-auto w-full shrink-0 justify-start gap-5 border-b px-5 py-0"
        >
          {SHEET_TABS.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className={TAB_TRIGGER}
            >
              {item.label}
              {item.value === "related" && relatedCount > 0 ? (
                <Badge variant="outline" radius="full" className="tabular-nums">
                  {relatedCount}
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* One scroll body for every panel, keyed so each event opens at the top. */}
        <div
          key={event.id}
          className="scroll-fade-y no-scrollbar min-h-0 flex-1 scroll-py-10 overflow-y-auto"
        >
          <div className="flex flex-col gap-4 px-5 py-5">
            <TabsContent value="details">
              <DetailsTab event={event} />
            </TabsContent>
            <TabsContent value="changes">
              <ChangesTab event={event} />
            </TabsContent>
            <TabsContent value="raw">
              <RawTab event={event} />
            </TabsContent>
            <TabsContent value="related">
              <RelatedTab
                event={event}
                related={related}
                onOpenEvent={onOpenEvent}
              />
            </TabsContent>
          </div>
        </div>
      </Tabs>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t px-5 py-3">
        {state === "reviewed" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onToggleReview(event)}
          >
            {UI_ICONS.reset}
            Reopen review
          </Button>
        ) : (
          <Button
            type="button"
            variant={state === "needs_review" ? "default" : "outline"}
            size="sm"
            onClick={() => onToggleReview(event)}
          >
            {UI_ICONS.check}
            Mark reviewed
          </Button>
        )}
        <CopyLinkButton key={event.id} id={event.id} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ms-auto"
          onClick={() => onResourceHistory(event)}
        >
          {UI_ICONS.history}
          Resource history
        </Button>
      </div>
    </>
  )
}

export function EventSheet({
  event,
  open,
  onOpenChange,
  ...view
}: EventSheetProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  // Lives here because the sheet never unmounts: J/K and reopening keep the tab.
  const [tab, setTab] = useState<SheetTab>("details")
  const inGrid = view.index >= 0

  // J and K step like a mail client; typing in a field or a held modifier wins.
  function handleKeys(keyEvent: KeyboardEvent<HTMLDivElement>) {
    if (!event || !inGrid) return
    if (keyEvent.metaKey || keyEvent.ctrlKey || keyEvent.altKey) return
    const target = keyEvent.target
    if (
      target instanceof HTMLElement &&
      target.closest("input, textarea, [contenteditable='true']")
    )
      return
    const key = keyEvent.key.toLowerCase()
    if (key === "j" && view.index < view.total - 1) {
      keyEvent.preventDefault()
      view.onStep(1)
    } else if (key === "k" && view.index > 0) {
      keyEvent.preventDefault()
      view.onStep(-1)
    }
  }

  // The panel mounts CLOSED and keeps its event while closing: a first render
  // with `open` already true kills the enter transition.
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={popupRef}
        side="right"
        showCloseButton={false}
        // Focus the panel itself: a first control would pop its tooltip.
        initialFocus={popupRef}
        onKeyDown={handleKeys}
        className="inset-y-4 right-4 left-auto flex h-[calc(100svh-2rem)] w-[min(36rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 outline-none"
      >
        {event ? (
          <EventView
            event={event}
            tab={tab}
            onTabChange={setTab}
            onClose={() => onOpenChange(false)}
            {...view}
          />
        ) : (
          <SheetTitle className="sr-only">Audit Event</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  )
}