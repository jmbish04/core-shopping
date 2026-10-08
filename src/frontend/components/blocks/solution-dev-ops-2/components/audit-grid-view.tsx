"use no memo"

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { Badge } from "@/components/reui/badge"
import {
  DataGrid,
  dataGridFeatures,
  getColumnHeaderLabel,
} from "@/components/reui/data-grid/data-grid"
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
import { Filters } from "@/components/reui/filters/filters"
import { countFilterRules } from "@/components/reui/filters/filters-query"
import { type FilterQuery } from "@/components/reui/filters/filters-types"
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import {
  useTable,
  type ColumnVisibilityState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table"

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
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

import { AUDIT_FILTER_FIELDS, COMPACT_OPERATORS } from "./audit-filters"
import { withReview } from "./audit-query"
import {
  createAuditColumns,
  CurrentEventContext,
  type AuditRowAction,
} from "./columns"
import { useCopyFeedback } from "./copy-token"
import { type AuditEvent, type SavedView, type TimeRange } from "./data"
import { EventSheet } from "./event-sheet"
import { exportEvents } from "./export-menu"
import { UI_ICONS } from "./icons"
import { DotSeparator } from "./value-faces"
import { ViewsMenu } from "./views-menu"

type Density = "compact" | "comfortable"

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
]

const isDensity = (value: unknown): value is Density =>
  value === "compact" || value === "comfortable"

/** Secondary context starts hidden; Settings brings each column back. */
const DEFAULT_VISIBILITY: ColumnVisibilityState = {
  request: false,
  session: false,
  auth: false,
  cluster: false,
  review: false,
}

function NoMatchingEvents({
  canWiden,
  onClear,
  onWiden,
}: {
  canWiden: boolean
  onClear: () => void
  onWiden: () => void
}) {
  return (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">{UI_ICONS.searchX}</EmptyMedia>
        <EmptyTitle>No Matching Events</EmptyTitle>
        <EmptyDescription>
          Nothing in this window matches these filters.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button type="button" variant="outline" onClick={onClear}>
          Clear filters
        </Button>
        {canWiden ? (
          <Button type="button" variant="ghost" onClick={onWiden}>
            Show 30d
          </Button>
        ) : null}
      </EmptyContent>
    </Empty>
  )
}

type AuditGridViewProps = {
  gridEvents: AuditEvent[]
  /** The whole log, for the sheet's correlation tab. */
  allEvents: AuditEvent[]
  selectedEvents: AuditEvent[]
  isLoading: boolean
  appliedRange: TimeRange
  pagination: PaginationState
  setPagination: Dispatch<SetStateAction<PaginationState>>
  rowSelection: RowSelectionState
  setRowSelection: Dispatch<SetStateAction<RowSelectionState>>
  views: SavedView[]
  activeView: SavedView
  viewEdited: boolean
  viewCounts: Map<string, number>
  onSelectView: (id: string) => void
  onSaveView: (name: string) => void
  onResetView: () => void
  onDeleteView: (view: SavedView) => void
  query: FilterQuery
  onQueryChange: (query: FilterQuery) => void
  search: string
  onSearchChange: (search: string) => void
  /** Toolbar Clear: back to All events. */
  onClearFilters: () => void
  /** Empty state: All events, and the search and bucket cleared too. */
  onClearAll: () => void
  /** Empty state: widen the window to 30 days. */
  onWidenRange: () => void
  onNarrow: (field: "actor" | "resource", value: string) => void
  onToggleReview: (event: AuditEvent) => void
  onBulkReview: (ids: string[]) => void
  /** Whether an event passes the applied filters, search and bucket. */
  matchesGrid: (event: AuditEvent) => boolean
  sheetEvent: AuditEvent | null
  sheetOpen: boolean
  activeEventId: string | null
  onOpenEvent: (id: string) => void
  onSheetOpenChange: (open: boolean) => void
}

export function AuditGridView({
  gridEvents,
  allEvents,
  selectedEvents,
  isLoading,
  appliedRange,
  pagination,
  setPagination,
  rowSelection,
  setRowSelection,
  views,
  activeView,
  viewEdited,
  viewCounts,
  onSelectView,
  onSaveView,
  onResetView,
  onDeleteView,
  query,
  onQueryChange,
  search,
  onSearchChange,
  onClearFilters,
  onClearAll,
  onWidenRange,
  onNarrow,
  onToggleReview,
  onBulkReview,
  matchesGrid,
  sheetEvent,
  sheetOpen,
  activeEventId,
  onOpenEvent,
  onSheetOpenChange,
}: AuditGridViewProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "time", desc: true },
  ])
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>(DEFAULT_VISIBILITY)
  const [density, setDensity] = useState<Density>("compact")
  const searchRef = useRef<HTMLInputElement>(null)
  const bulkCopy = useCopyFeedback()

  const ruleCount = countFilterRules(query)
  const actorCount = new Set(gridEvents.map((event) => event.actorId)).size
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])
  const unreviewedSelected = selectedEvents.filter(
    (event) => !event.reviewedBy
  ).length

  const handleRowAction = useCallback(
    (action: AuditRowAction, event: AuditEvent) => {
      if (action === "view") onOpenEvent(event.id)
      else if (action === "filterActor") onNarrow("actor", event.actorId)
      else if (action === "resourceHistory")
        onNarrow("resource", event.resource.name)
      else onToggleReview(event)
    },
    [onNarrow, onOpenEvent, onToggleReview]
  )

  const currentId = sheetOpen ? activeEventId : null
  const columns = useMemo(
    () =>
      createAuditColumns({
        onOpen: onOpenEvent,
        onAction: handleRowAction,
      }),
    [onOpenEvent, handleRowAction]
  )

  const table = useTable({
    features: dataGridFeatures,
    data: gridEvents,
    columns,
    getRowId: (row) => row.id,
    state: { sorting, pagination, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    // Reviews must not bounce the reader back to page one; resets are explicit.
    autoResetPageIndex: false,
    // Pinning as an ordering lock only; the sticky affordance stays off.
    initialState: {
      columnPinning: { start: ["select", "time"], end: ["actions"] },
    },
  })

  // Sorted and filtered, before pagination: the sheet steps through all of it.
  const orderedIds = table.getPrePaginatedRowModel().rows.map((row) => row.id)
  const sheetIndex = sheetEvent ? orderedIds.indexOf(sheetEvent.id) : -1

  function openAt(index: number) {
    const id = orderedIds[index]
    if (!id) return
    const page = Math.floor(index / pagination.pageSize)
    if (page !== pagination.pageIndex)
      setPagination((current) => ({ ...current, pageIndex: page }))
    onOpenEvent(id)
  }

  /** Triage: an event that leaves the filters hands the sheet to its neighbour. */
  function handleSheetReview(event: AuditEvent) {
    const after = withReview(event, !event.reviewedBy)
    onToggleReview(event)
    if (sheetIndex < 0 || matchesGrid(after)) return
    const next = orderedIds[sheetIndex + 1]
    const previous = orderedIds[sheetIndex - 1]
    if (next) {
      // The neighbour slides into the reviewed event's slot.
      const page = Math.floor(sheetIndex / pagination.pageSize)
      setPagination((current) => ({ ...current, pageIndex: page }))
      onOpenEvent(next)
    } else if (previous) {
      const page = Math.floor((sheetIndex - 1) / pagination.pageSize)
      setPagination((current) => ({ ...current, pageIndex: page }))
      onOpenEvent(previous)
    } else {
      onSheetOpenChange(false)
    }
  }

  function clearSearch() {
    onSearchChange("")
    searchRef.current?.focus()
  }

  return (
    <CurrentEventContext.Provider value={currentId}>
      <DataGrid
        table={table}
        recordCount={gridEvents.length}
        isLoading={isLoading}
        loadingMode="skeleton"
        onRowClick={(event) => onOpenEvent(event.id)}
        emptyMessage={
          <NoMatchingEvents
            canWiden={appliedRange !== "30d"}
            onClear={onClearAll}
            onWiden={onWidenRange}
          />
        }
        tableLayout={{ dense: density === "compact", columnsVisibility: true }}
        tableClassNames={{
          edgeCell:
            "first:ps-(--frame-panel-header-px) last:pe-(--frame-panel-header-px)",
          bodyRow: "[&:has([aria-current=true])]:bg-muted/50",
        }}
      >
        <Frame dense variant="default" spacing="default" className="w-full">
          <FrameHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-px">
              <FrameTitle>Events</FrameTitle>
              <FrameDescription className="text-xs">
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums"
                >
                  <span>
                    {gridEvents.length}{" "}
                    {gridEvents.length === 1 ? "event" : "events"}
                  </span>
                  <DotSeparator />
                  <span>
                    {actorCount} {actorCount === 1 ? "actor" : "actors"}
                  </span>
                </span>
              </FrameDescription>
            </div>

            <div className="ms-auto flex min-w-0 shrink-0 items-center gap-2">
              <ViewsMenu
                views={views}
                activeView={activeView}
                edited={viewEdited}
                counts={viewCounts}
                onSelectView={onSelectView}
                onSaveView={onSaveView}
                onResetView={onResetView}
                onDeleteView={onDeleteView}
              />

              {/* Display settings */}
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      aria-label="Display settings"
                    />
                  }
                >
                  {UI_ICONS.settings}
                  <span className="max-sm:sr-only">Settings</span>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64">
                  <FieldSet className="gap-3">
                    <FieldLegend variant="label">Table</FieldLegend>
                    <FieldGroup className="gap-3">
                      <Field orientation="horizontal">
                        <FieldLabel htmlFor="devops-2-density">
                          Density
                        </FieldLabel>
                        <Select
                          value={density}
                          items={DENSITY_OPTIONS}
                          onValueChange={(next) => {
                            if (isDensity(next)) setDensity(next)
                          }}
                        >
                          <SelectTrigger
                            id="devops-2-density"
                            size="sm"
                            className="w-36"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent
                            align="start"
                            alignItemWithTrigger={false}
                          >
                            <SelectGroup>
                              {DENSITY_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    </FieldGroup>
                  </FieldSet>
                  <FieldSeparator />
                  <FieldSet className="gap-3">
                    <FieldLegend variant="label">Columns</FieldLegend>
                    <FieldGroup className="gap-3">
                      {table
                        .getAllLeafColumns()
                        .filter((column) => column.getCanHide())
                        .map((column) => (
                          <Field key={column.id} orientation="horizontal">
                            <FieldLabel
                              htmlFor={`devops-2-column-${column.id}`}
                            >
                              {getColumnHeaderLabel(column)}
                            </FieldLabel>
                            <Switch
                              id={`devops-2-column-${column.id}`}
                              size="sm"
                              checked={column.getIsVisible()}
                              onCheckedChange={(checked) =>
                                column.toggleVisibility(checked)
                              }
                            />
                          </Field>
                        ))}
                    </FieldGroup>
                  </FieldSet>
                </PopoverContent>
              </Popover>
            </div>
          </FrameHeader>

          <FramePanel className="p-0">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 px-(--frame-panel-header-px) py-(--frame-panel-header-py)">
              <InputGroup className="min-w-0 flex-1 sm:max-w-64">
                <InputGroupAddon align="inline-start">
                  {UI_ICONS.search}
                </InputGroupAddon>
                <InputGroupInput
                  ref={searchRef}
                  placeholder="Search actions, resources, IPs..."
                  aria-label="Search events"
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                />
                {search.length > 0 ? (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      aria-label="Clear search"
                      size="icon-xs"
                      onClick={clearSearch}
                    >
                      {UI_ICONS.close}
                    </InputGroupButton>
                  </InputGroupAddon>
                ) : null}
              </InputGroup>

              {/* Own trigger, so it can go icon-only below sm. The bar fills the row:
                  chips stay by search, the trigger takes the trailing edge. */}
              <Filters
                fields={AUDIT_FILTER_FIELDS}
                query={query}
                onQueryChange={onQueryChange}
                size="default"
                operatorLabels={COMPACT_OPERATORS}
                className="min-w-0 sm:flex-1"
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    className="ms-auto"
                    aria-label={
                      ruleCount > 0
                        ? `Filter, ${ruleCount} ${ruleCount === 1 ? "rule" : "rules"}`
                        : "Filter"
                    }
                  >
                    {UI_ICONS.filter}
                    <span className="max-sm:sr-only">Filter</span>
                    {ruleCount > 0 ? (
                      <Badge
                        variant="outline"
                        radius="full"
                        className="tabular-nums"
                      >
                        {ruleCount}
                      </Badge>
                    ) : null}
                  </Button>
                }
              />

              {ruleCount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={onClearFilters}
                >
                  {UI_ICONS.filterClear}
                  Clear
                </Button>
              ) : null}
            </div>

            {selectedIds.length > 0 ? (
              <>
                <Separator />
                {/* Bulk bar: the row checkboxes exist to drive this. */}
                <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 px-(--frame-panel-header-px) py-2">
                  <span className="text-foreground text-sm font-medium tabular-nums">
                    {selectedIds.length} selected
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={unreviewedSelected === 0}
                      onClick={() => onBulkReview(selectedIds)}
                    >
                      {UI_ICONS.review}
                      Mark reviewed
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => bulkCopy.copy(selectedIds.join("\n"))}
                    >
                      {bulkCopy.copied ? UI_ICONS.check : UI_ICONS.copy}
                      {bulkCopy.copied ? "Copied" : "Copy IDs"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportEvents(selectedEvents, "csv", appliedRange)
                      }
                    >
                      {UI_ICONS.download}
                      Export
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRowSelection({})}
                    >
                      Clear selection
                    </Button>
                  </div>
                </div>
              </>
            ) : null}

            <Separator />

            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>

            <Separator />

            <FrameFooter>
              <DataGridPagination
                sizes={[10, 20, 50]}
                info="{from} - {to} of {count} events"
              />
            </FrameFooter>
          </FramePanel>
        </Frame>
      </DataGrid>

      <EventSheet
        event={sheetEvent}
        open={sheetOpen && sheetEvent !== null}
        onOpenChange={onSheetOpenChange}
        index={sheetIndex}
        total={orderedIds.length}
        onStep={(direction) => openAt(sheetIndex + direction)}
        events={allEvents}
        onOpenEvent={onOpenEvent}
        onToggleReview={handleSheetReview}
        onResourceHistory={(event) => {
          onNarrow("resource", event.resource.name)
          onSheetOpenChange(false)
        }}
      />
    </CurrentEventContext.Provider>
  )
}