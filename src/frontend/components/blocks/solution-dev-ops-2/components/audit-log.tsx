"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { type FilterQuery } from "@/components/reui/filters/filters-types"
import {
  type PaginationState,
  type RowSelectionState,
} from "@tanstack/react-table"
import { toast } from "sonner"

import { TooltipProvider } from "@/components/ui/tooltip"

import {
  activeRulesKey,
  ALL_EVENTS_VIEW_ID,
  BUILT_IN_VIEWS,
  EMPTY_FILTER_QUERY,
  matchesAuditFilters,
  OPEN_DENIALS_VIEW_ID,
  withRule,
} from "./audit-filters"
import { AuditGridView } from "./audit-grid-view"
import { AuditHeader } from "./audit-header"
import {
  inPriorRange,
  inRange,
  inSpan,
  matchesSearch,
  withReview,
  type BucketSpan,
} from "./audit-query"
import {
  ACTORS,
  CURRENT_REVIEWER,
  EVENTS,
  type AuditEvent,
  type SavedView,
  type TimeRange,
} from "./data"
import { TOAST_SUCCESS_ICON } from "./icons"
import { SignalRow } from "./signal-row"

/** The simulated round trip a range, view or filter change waits on. */
const APPLY_DELAY_MS = 400
const UNDO_TOAST_MS = 8000

type ReviewFields = Pick<AuditEvent, "reviewedBy" | "reviewedAt">

export function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>(EVENTS)
  const [views, setViews] = useState<SavedView[]>(BUILT_IN_VIEWS)
  const [activeViewId, setActiveViewId] = useState(ALL_EVENTS_VIEW_ID)
  // Controls answer at once; the applied pair is what the grid shows.
  const [query, setQuery] = useState<FilterQuery>(EMPTY_FILTER_QUERY)
  const [appliedQuery, setAppliedQuery] =
    useState<FilterQuery>(EMPTY_FILTER_QUERY)
  const [timeRange, setTimeRange] = useState<TimeRange>("7d")
  const [appliedRange, setAppliedRange] = useState<TimeRange>("7d")
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [bucketSpan, setBucketSpan] = useState<BucketSpan | null>(null)
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [activeEventId, setActiveEventId] = useState<string | null>(null)
  // Seeded so the sheet mounts CLOSED, and retained on close so its exit
  // animates with the content intact.
  const [retainedEventId, setRetainedEventId] = useState(EVENTS[0].id)
  if (activeEventId !== null && activeEventId !== retainedEventId) {
    setRetainedEventId(activeEventId)
  }
  const [sheetOpen, setSheetOpen] = useState(false)

  const pendingRef = useRef<number | null>(null)
  const gridRef = useRef<HTMLElement>(null)
  const customViewSeq = useRef(0)
  // Handlers and toast actions outlive their render; they read state here.
  const latestRef = useRef({
    events,
    query,
    timeRange,
    appliedQuery,
    appliedRange,
  })
  useEffect(() => {
    latestRef.current = {
      events,
      query,
      timeRange,
      appliedQuery,
      appliedRange,
    }
  })
  useEffect(() => {
    return () => {
      if (pendingRef.current !== null) window.clearTimeout(pendingRef.current)
    }
  }, [])

  // ── Derived during render ──

  const rangeEvents = useMemo(
    () => inRange(events, appliedRange),
    [events, appliedRange]
  )
  const matchesQuery = useCallback(
    (event: AuditEvent) =>
      matchesAuditFilters(event, appliedQuery) && matchesSearch(event, search),
    [appliedQuery, search]
  )
  // The one grid predicate: the rows below and the sheet's triage both read it.
  const matchesGrid = useCallback(
    (event: AuditEvent) =>
      matchesQuery(event) &&
      (!bucketSpan || inSpan(event, bucketSpan, appliedRange)),
    [matchesQuery, bucketSpan, appliedRange]
  )
  const queryEvents = useMemo(
    () => rangeEvents.filter(matchesQuery),
    [rangeEvents, matchesQuery]
  )
  // The same chips over the window before, so the chart compares like with like.
  const priorTotal = useMemo(
    () => inPriorRange(events, appliedRange).filter(matchesQuery).length,
    [events, appliedRange, matchesQuery]
  )
  const gridEvents = useMemo(
    () => (bucketSpan ? queryEvents.filter(matchesGrid) : queryEvents),
    [queryEvents, bucketSpan, matchesGrid]
  )
  // The queue ignores the chips but follows the chart's time selection.
  const deniedInScope = useMemo(
    () =>
      rangeEvents.filter(
        (event) =>
          event.outcome === "denied" &&
          (!bucketSpan || inSpan(event, bucketSpan, appliedRange))
      ),
    [rangeEvents, bucketSpan, appliedRange]
  )
  const deniedQueue = useMemo(
    () => deniedInScope.filter((event) => !event.reviewedBy),
    [deniedInScope]
  )
  const viewCounts = useMemo(
    () =>
      new Map(
        views.map((view) => [
          view.id,
          rangeEvents.filter((event) => matchesAuditFilters(event, view.query))
            .length,
        ])
      ),
    [views, rangeEvents]
  )
  const selectedEvents = useMemo(
    () => events.filter((event) => rowSelection[event.id]),
    [events, rowSelection]
  )

  const activeView =
    views.find((view) => view.id === activeViewId) ?? BUILT_IN_VIEWS[0]
  const viewEdited = activeRulesKey(query) !== activeRulesKey(activeView.query)
  const sheetEvent =
    events.find((event) => event.id === retainedEventId) ?? null

  // A review can empty the last page; land on the new last page instead.
  const lastPage = Math.max(
    0,
    Math.ceil(gridEvents.length / pagination.pageSize) - 1
  )
  if (!isLoading && pagination.pageIndex > lastPage) {
    setPagination({ ...pagination, pageIndex: lastPage })
  }

  const resetPage = useCallback(
    () =>
      setPagination((current) =>
        current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
      ),
    []
  )

  /** The one skeleton path: range, view, chip, Clear and narrowing changes. */
  const scheduleApply = useCallback(
    (next: { query?: FilterQuery; range?: TimeRange }) => {
      const latest = latestRef.current
      const nextQuery = next.query ?? latest.query
      const nextRange = next.range ?? latest.timeRange
      if (next.query) setQuery(next.query)
      if (next.range) setTimeRange(next.range)
      latestRef.current = { ...latest, query: nextQuery, timeRange: nextRange }

      if (pendingRef.current !== null) {
        window.clearTimeout(pendingRef.current)
        pendingRef.current = null
      }
      // An unfinished chip, or a change back to what is shown, refilters nothing.
      if (
        activeRulesKey(nextQuery) === activeRulesKey(latest.appliedQuery) &&
        nextRange === latest.appliedRange
      ) {
        setIsLoading(false)
        return
      }

      resetPage()
      setBucketSpan(null)
      setRowSelection({})
      const rangeChanged = nextRange !== latest.appliedRange
      const commit = () => {
        pendingRef.current = null
        // A bar clicked during the wait belongs to the old buckets.
        if (rangeChanged) setBucketSpan(null)
        setAppliedQuery(nextQuery)
        setAppliedRange(nextRange)
        setIsLoading(false)
      }
      // Frozen demo guard: ?demo=frozen pins the demo, so no timer starts.
      if (document.documentElement.dataset.demo === "frozen") {
        commit()
        return
      }
      setIsLoading(true)
      pendingRef.current = window.setTimeout(commit, APPLY_DELAY_MS)
    },
    [resetPage]
  )

  // ── Views ──

  const handleSelectView = useCallback(
    (id: string) => {
      const view = views.find((item) => item.id === id)
      if (!view) return
      setActiveViewId(view.id)
      scheduleApply({ query: view.query })
    },
    [views, scheduleApply]
  )

  function handleSaveView(name: string) {
    customViewSeq.current += 1
    const view: SavedView = {
      id: `view-custom-${customViewSeq.current}`,
      name,
      query,
      builtIn: false,
    }
    const previousId = activeViewId
    setViews((current) => [...current, view])
    setActiveViewId(view.id)
    toast.success("View saved", {
      description: name,
      icon: TOAST_SUCCESS_ICON,
      duration: UNDO_TOAST_MS,
      action: {
        label: "Undo",
        onClick: () => {
          setViews((current) => current.filter((item) => item.id !== view.id))
          // The rules stay applied, so the old view reads as edited again.
          setActiveViewId((current) =>
            current === view.id ? previousId : current
          )
        },
      },
    })
  }

  function handleDeleteView(view: SavedView) {
    const index = views.findIndex((item) => item.id === view.id)
    const previousId = views[index - 1]?.id
    setViews((current) => current.filter((item) => item.id !== view.id))
    setActiveViewId(ALL_EVENTS_VIEW_ID)
    scheduleApply({ query: EMPTY_FILTER_QUERY })
    toast.success("View deleted", {
      description: view.name,
      icon: TOAST_SUCCESS_ICON,
      duration: UNDO_TOAST_MS,
      action: {
        label: "Undo",
        onClick: () => {
          // Re-anchored to its old neighbour, so it lands in place.
          setViews((current) => {
            if (current.some((item) => item.id === view.id)) return current
            const after = current.findIndex((item) => item.id === previousId)
            const at = after >= 0 ? after + 1 : current.length
            return [...current.slice(0, at), view, ...current.slice(at)]
          })
          setActiveViewId(view.id)
          scheduleApply({ query: view.query })
        },
      },
    })
  }

  function handleClearFilters() {
    setActiveViewId(ALL_EVENTS_VIEW_ID)
    scheduleApply({ query: EMPTY_FILTER_QUERY })
  }

  function handleClearAll() {
    setSearch("")
    setBucketSpan(null)
    resetPage()
    handleClearFilters()
  }

  const handleNarrow = useCallback(
    (field: "actor" | "resource", value: string) => {
      scheduleApply({
        query: withRule(latestRef.current.query, {
          field,
          operator: "is",
          value,
        }),
      })
    },
    [scheduleApply]
  )

  // ── Reviews ──

  /** Sets or clears the review on these events; returns the exact undo. */
  const applyReview = useCallback((ids: string[], reviewed: boolean) => {
    const idSet = new Set(ids)
    const priors = new Map<string, ReviewFields>(
      latestRef.current.events
        .filter((event) => idSet.has(event.id))
        .map((event) => [
          event.id,
          { reviewedBy: event.reviewedBy, reviewedAt: event.reviewedAt },
        ])
    )
    setEvents((current) =>
      current.map((event) =>
        idSet.has(event.id) ? withReview(event, reviewed) : event
      )
    )
    return () =>
      setEvents((current) =>
        current.map((event) => {
          const prior = priors.get(event.id)
          return prior ? { ...event, ...prior } : event
        })
      )
  }, [])

  const handleToggleReview = useCallback(
    (event: AuditEvent) => {
      const reviewed = !event.reviewedBy
      const undo = applyReview([event.id], reviewed)
      toast.success(reviewed ? "Event reviewed" : "Review reopened", {
        description: `${event.action} by ${ACTORS[event.actorId].name}`,
        icon: TOAST_SUCCESS_ICON,
        duration: UNDO_TOAST_MS,
        action: { label: "Undo", onClick: undo },
      })
    },
    [applyReview]
  )

  function handleBulkReview(ids: string[]) {
    const idSet = new Set(ids)
    const targets = events
      .filter((event) => idSet.has(event.id) && !event.reviewedBy)
      .map((event) => event.id)
    if (targets.length === 0) return
    const undo = applyReview(targets, true)
    setRowSelection({})
    toast.success(
      `${targets.length} ${targets.length === 1 ? "event" : "events"} reviewed`,
      {
        description: `Marked by ${ACTORS[CURRENT_REVIEWER].name}`,
        icon: TOAST_SUCCESS_ICON,
        duration: UNDO_TOAST_MS,
        action: { label: "Undo", onClick: undo },
      }
    )
  }

  // ── Sheet ──

  const handleOpenEvent = useCallback((id: string) => {
    setActiveEventId(id)
    setSheetOpen(true)
  }, [])

  function handleSheetOpenChange(open: boolean) {
    setSheetOpen(open)
    if (!open) setActiveEventId(null)
  }

  function handleReviewAll() {
    // No search or bar narrows it, so the grid count equals the queue's.
    setSearch("")
    setBucketSpan(null)
    setRowSelection({})
    resetPage()
    handleSelectView(OPEN_DENIALS_VIEW_ID)
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    gridRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    })
  }

  return (
    <TooltipProvider delay={200}>
      <div className="bg-background flex min-h-svh w-full flex-col">
        <div className="mx-auto w-full max-w-[1320px] p-3 md:p-4">
          <div className="@container flex w-full flex-col gap-4">
            <AuditHeader
              range={timeRange}
              appliedRange={appliedRange}
              onRangeChange={(range) => scheduleApply({ range })}
              filtered={gridEvents}
              selected={selectedEvents}
            />

            {/* Three fifths to two: the queue's two-line rows need more than a
                third to stay readable. */}
            <div className="grid grid-cols-1 items-stretch gap-4 @4xl:grid-cols-5">
              <SignalRow
                events={queryEvents}
                priorTotal={priorTotal}
                range={appliedRange}
                selection={bucketSpan}
                onSelectionChange={(span) => {
                  setBucketSpan(span)
                  setRowSelection({})
                  resetPage()
                }}
                denied={deniedQueue}
                inScope={deniedInScope}
                currentId={sheetOpen ? activeEventId : null}
                onOpenEvent={handleOpenEvent}
                onReview={handleToggleReview}
                onReviewAll={handleReviewAll}
              />
              <section
                ref={gridRef}
                aria-label="Events"
                className="min-w-0 scroll-mt-4 @4xl:col-span-5"
              >
                <AuditGridView
                  gridEvents={gridEvents}
                  allEvents={events}
                  selectedEvents={selectedEvents}
                  isLoading={isLoading}
                  appliedRange={appliedRange}
                  pagination={pagination}
                  setPagination={setPagination}
                  rowSelection={rowSelection}
                  setRowSelection={setRowSelection}
                  views={views}
                  activeView={activeView}
                  viewEdited={viewEdited}
                  viewCounts={viewCounts}
                  onSelectView={handleSelectView}
                  onSaveView={handleSaveView}
                  onResetView={() => scheduleApply({ query: activeView.query })}
                  onDeleteView={handleDeleteView}
                  query={query}
                  onQueryChange={(next) => scheduleApply({ query: next })}
                  search={search}
                  onSearchChange={(next) => {
                    setSearch(next)
                    setRowSelection({})
                    resetPage()
                  }}
                  onClearFilters={handleClearFilters}
                  onClearAll={handleClearAll}
                  onWidenRange={() => scheduleApply({ range: "30d" })}
                  onNarrow={handleNarrow}
                  onToggleReview={handleToggleReview}
                  onBulkReview={handleBulkReview}
                  matchesGrid={matchesGrid}
                  sheetEvent={sheetEvent}
                  sheetOpen={sheetOpen}
                  activeEventId={activeEventId}
                  onOpenEvent={handleOpenEvent}
                  onSheetOpenChange={handleSheetOpenChange}
                />
              </section>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}