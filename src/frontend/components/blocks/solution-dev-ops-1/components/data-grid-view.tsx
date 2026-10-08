"use no memo"

import { useCallback, useMemo, useRef, useState, type RefObject } from "react"
import { Badge } from "@/components/reui/badge"
import {
  DataGrid,
  dataGridFeatures,
} from "@/components/reui/data-grid/data-grid"
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
import { type FilterQuery } from "@/components/reui/filters/filters-types"
import {
  Frame,
  FrameFooter,
  FramePanel,
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
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  ActiveJobContext,
  createJobColumns,
  type JobRowAction,
} from "./columns"
import {
  healthOf,
  isRunning,
  JOB_TABS,
  triageOrder,
  WORKSPACE_NAME,
  type CronJob,
  type Density,
  type EnvironmentScope,
  type JobTab,
  type SheetTab,
} from "./data"
import {
  DeleteJobsDialog,
  pendingIds,
  survivingNeighbour,
  type PendingDelete,
} from "./delete-jobs-dialog"
import { UI_ICONS } from "./icons"
import { EMPTY_FILTER_QUERY, matchesJobFilters } from "./job-filters"
import { JobSheet, type SheetState } from "./job-sheet"
import { type JobStore } from "./job-store"
import { JobsDisplayPopover, JobsToolbar } from "./jobs-toolbar"
import { SectionHeader } from "./section-header"
import { DotSeparator } from "./value-faces"

function NoJobsEmpty({
  onNewJob,
}: {
  onNewJob: (origin: HTMLElement) => void
}) {
  return (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">{UI_ICONS.schedule}</EmptyMedia>
        <EmptyTitle>No Cron Jobs</EmptyTitle>
        <EmptyDescription>
          Schedule the first job for {WORKSPACE_NAME}.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          type="button"
          onClick={(event) => onNewJob(event.currentTarget)}
        >
          {UI_ICONS.plus}
          New Job
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function NoMatchEmpty({ onClear }: { onClear: () => void }) {
  return (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">{UI_ICONS.search}</EmptyMedia>
        <EmptyTitle>No Jobs Match</EmptyTitle>
        <EmptyDescription>Try another tab, search or filter.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" variant="outline" onClick={onClear}>
          Clear Filters
        </Button>
      </EmptyContent>
    </Empty>
  )
}

/** The selection's actions: the row checkboxes exist to drive this bar. */
function BulkBar({
  count,
  selectedJobs,
  onClear,
  onRun,
  onSetEnabled,
  onDelete,
}: {
  count: number
  selectedJobs: CronJob[]
  onClear: () => void
  onRun: () => void
  onSetEnabled: (enabled: boolean) => void
  onDelete: (origin: HTMLElement) => void
}) {
  return (
    <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 px-(--frame-panel-header-px) py-2">
      <span className="text-foreground text-sm font-medium tabular-nums">
        {count} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          Clear
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={selectedJobs.every(isRunning)}
          onClick={onRun}
        >
          {UI_ICONS.play}
          Run
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!selectedJobs.some((job) => job.enabled)}
          onClick={() => onSetEnabled(false)}
        >
          {UI_ICONS.pause}
          Pause
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!selectedJobs.some((job) => !job.enabled)}
          onClick={() => onSetEnabled(true)}
        >
          {UI_ICONS.play}
          Resume
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={(event) => onDelete(event.currentTarget)}
        >
          {UI_ICONS.trash}
          Delete
        </Button>
      </div>
    </div>
  )
}

const plural = (count: number, noun: string) =>
  `${count} ${count === 1 ? noun : `${noun}s`}`

function matchesSearch(job: CronJob, query: string) {
  if (!query) return true
  return [job.name, job.command, job.id, job.service].some((value) =>
    value.toLowerCase().includes(query)
  )
}

export function JobsGridView({
  jobs,
  allJobs,
  store,
  scope,
  reveal,
  sheet,
  onSheetChange,
  onCloseSheet,
  onNewJob,
  returnFocusRef,
  onReturnFocusChange,
}: {
  /** The scoped fleet the grid lists. */
  jobs: CronJob[]
  /** Every job, so the sheet keeps its record outside the current scope. */
  allJobs: CronJob[]
  store: JobStore
  scope: EnvironmentScope
  /** Bumps after a create: the view clears its query and pages to the new job. */
  reveal: { seq: number; id: string | null }
  sheet: SheetState
  onSheetChange: (patch: Partial<SheetState>) => void
  onCloseSheet: () => void
  onNewJob: (origin: HTMLElement) => void
  /** Read by the sheet's finalFocus; openers set it through onReturnFocusChange. */
  returnFocusRef: RefObject<HTMLElement | null>
  onReturnFocusChange: (node: HTMLElement | null) => void
}) {
  const { runJobs, setEnabled, toggleSkip, duplicate, remove, update } = store
  const [search, setSearch] = useState("")
  const [filterQuery, setFilterQuery] =
    useState<FilterQuery>(EMPTY_FILTER_QUERY)
  const [tab, setTab] = useState<JobTab>("all")
  // No header sort by default: rows keep the triage order, failing jobs first.
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  // Environment starts hidden: sandbox and staging read from Target already.
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({ environment: false })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [density, setDensity] = useState<Density>("compact")
  const [striped, setStriped] = useState(false)

  // The dialog keeps its last record while it closes, so the exit stays intact.
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

  const resetPage = useCallback(
    () =>
      setPagination((current) =>
        current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
      ),
    []
  )

  // A scope change or a fresh create resets the view in the same render.
  const [seenScope, setSeenScope] = useState(scope)
  if (seenScope !== scope) {
    setSeenScope(scope)
    resetPage()
    setRowSelection({})
  }
  const [seenReveal, setSeenReveal] = useState(reveal.seq)
  const [revealId, setRevealId] = useState<string | null>(null)
  if (seenReveal !== reveal.seq) {
    setSeenReveal(reveal.seq)
    setSearch("")
    setFilterQuery(EMPTY_FILTER_QUERY)
    setTab("all")
    resetPage()
    setRowSelection({})
    setRevealId(reveal.id)
  }

  // Row menu triggers by job id: focus returns here, and a deleted row's falls
  // to a neighbour. A state-held Map, since the column handlers capture it.
  const [triggerNodes] = useState(() => new Map<string, HTMLButtonElement>())
  const focusTargetRef = useRef<HTMLElement | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const registerTrigger = useCallback(
    (id: string) => (node: HTMLButtonElement | null) => {
      if (node) triggerNodes.set(id, node)
      else triggerNodes.delete(id)
    },
    [triggerNodes]
  )

  const triagedJobs = useMemo(() => triageOrder(jobs), [jobs])
  const preTabJobs = useMemo(() => {
    const query = search.trim().toLowerCase()
    return triagedJobs.filter(
      (job) => matchesSearch(job, query) && matchesJobFilters(job, filterQuery)
    )
  }, [triagedJobs, search, filterQuery])
  const tabCounts = useMemo(() => {
    const counts: Record<JobTab, number> = {
      all: preTabJobs.length,
      healthy: 0,
      failing: 0,
      paused: 0,
    }
    for (const job of preTabJobs) counts[healthOf(job)] += 1
    return counts
  }, [preTabJobs])
  const visibleJobs = useMemo(
    () =>
      tab === "all"
        ? preTabJobs
        : preTabJobs.filter((job) => healthOf(job) === tab),
    [preTabJobs, tab]
  )

  /** Grid opens return focus to the row's menu, never a hover-card trigger. */
  const openFromGrid = useCallback(
    (id: string, sheetTab: SheetTab) => {
      onReturnFocusChange(triggerNodes.get(id) ?? null)
      onSheetChange({ jobId: id, tab: sheetTab, open: true })
    },
    [onSheetChange, onReturnFocusChange, triggerNodes]
  )

  const requestDelete = useCallback((pending: PendingDelete) => {
    setPendingDelete(pending)
    setDeleteOpen(true)
  }, [])

  const handleAction = useCallback(
    (action: JobRowAction, job: CronJob) => {
      switch (action) {
        case "view":
          openFromGrid(job.id, "overview")
          break
        case "edit":
          openFromGrid(job.id, "settings")
          break
        case "run":
          runJobs([job.id], "manual")
          break
        case "skip":
          toggleSkip(job.id)
          break
        case "pause":
          setEnabled([job.id], false)
          break
        case "resume":
          setEnabled([job.id], true)
          break
        case "duplicate": {
          const copyId = duplicate(job.id)
          if (!copyId) break
          // The copy opens on Settings; focus returns to its source's menu.
          setRevealId(copyId)
          onReturnFocusChange(triggerNodes.get(job.id) ?? null)
          onSheetChange({ jobId: copyId, tab: "settings", open: true })
          break
        }
        case "delete":
          requestDelete({
            kind: "row",
            id: job.id,
            name: job.name,
            origin: triggerNodes.get(job.id) ?? null,
          })
          break
      }
    },
    [
      openFromGrid,
      runJobs,
      toggleSkip,
      setEnabled,
      duplicate,
      requestDelete,
      triggerNodes,
      onReturnFocusChange,
      onSheetChange,
    ]
  )

  const handleToggle = useCallback(
    (id: string, enabled: boolean) => setEnabled([id], enabled),
    [setEnabled]
  )

  const columns = useMemo(
    () =>
      createJobColumns(
        {
          onOpen: openFromGrid,
          onToggle: handleToggle,
          onAction: handleAction,
        },
        registerTrigger
      ),
    [openFromGrid, handleToggle, handleAction, registerTrigger]
  )

  const table = useTable({
    features: dataGridFeatures,
    data: visibleJobs,
    columns,
    getRowId: (row) => row.id,
    state: { sorting, pagination, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    // Edits must not bounce the reader back to page one.
    autoResetPageIndex: false,
    // Pinning as an ordering lock only: tableLayout.columnsPinnable stays off.
    initialState: {
      columnPinning: { start: ["select", "name"], end: ["actions"] },
    },
  })

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])
  const selectedJobs = allJobs.filter((job) => selectedIds.includes(job.id))

  // The sheet steps through the visible order, across pages.
  const orderedIds = table
    .getPrePaginatedRowModel()
    .rows.map((row) => row.original.id)

  // A pause or delete can empty the last page: fall back to the new last page.
  const pageCount = Math.max(
    1,
    Math.ceil(orderedIds.length / pagination.pageSize)
  )
  if (pagination.pageIndex >= pageCount) {
    setPagination((current) => ({ ...current, pageIndex: pageCount - 1 }))
  }
  // A created or duplicated job lands by its next run, often past page one.
  if (revealId !== null) {
    setRevealId(null)
    const index = orderedIds.indexOf(revealId)
    const page = Math.floor(index / pagination.pageSize)
    if (index >= 0 && page !== pagination.pageIndex) {
      setPagination((current) => ({ ...current, pageIndex: page }))
    }
  }

  function stepTo(index: number) {
    const id = orderedIds[index]
    if (!id) return
    onSheetChange({ jobId: id })
    const page = Math.floor(index / pagination.pageSize)
    if (page !== pagination.pageIndex) table.setPageIndex(page)
    const trigger = triggerNodes.get(id)
    if (trigger) onReturnFocusChange(trigger)
  }

  function clearView() {
    setSearch("")
    setFilterQuery(EMPTY_FILTER_QUERY)
    setTab("all")
    resetPage()
    setRowSelection({})
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return
    const ids = pendingIds(pendingDelete)
    const neighbourId = survivingNeighbour(
      table.getRowModel().rows.map((row) => row.id),
      ids
    )
    // An emptied last page steps back through the page clamp above.
    focusTargetRef.current = neighbourId
      ? (triggerNodes.get(neighbourId) ?? null)
      : searchRef.current
    if (sheet.open && ids.includes(sheet.jobId)) {
      // The confirm's finalFocus places focus; the closing sheet stays out of it.
      onReturnFocusChange(null)
      onCloseSheet()
    }
    remove(ids)
    setRowSelection({})
    setDeleteOpen(false)
  }

  const sheetJob = allJobs.find((job) => job.id === sheet.jobId) ?? null
  const sheetIndex = sheetJob ? orderedIds.indexOf(sheetJob.id) : -1
  const failingCount = visibleJobs.filter(
    (job) => healthOf(job) === "failing"
  ).length

  return (
    <ActiveJobContext.Provider value={sheet.open ? sheet.jobId : null}>
      <DataGrid
        table={table}
        recordCount={visibleJobs.length}
        onRowClick={(job) => openFromGrid(job.id, "overview")}
        emptyMessage={
          jobs.length === 0 ? (
            <NoJobsEmpty onNewJob={onNewJob} />
          ) : (
            <NoMatchEmpty onClear={clearView} />
          )
        }
        tableLayout={{
          dense: density === "compact",
          stripped: striped,
          headerSticky: true,
          columnsMovable: true,
          columnsVisibility: true,
        }}
        tableClassNames={{
          bodyRow: "group/job-row [&:has([data-active-row])]:bg-muted/50",
          edgeCell:
            "first:ps-(--frame-panel-header-px) last:pe-(--frame-panel-header-px)",
        }}
      >
        {/* Not dense: the panel keeps the muted ring the KPI, Run Time and
            Up Next frames show, so the page reads as one surface. */}
        <Frame spacing="default" className="w-full min-w-0">
          <SectionHeader
            title="Jobs"
            description={
              <span
                role="status"
                className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums"
              >
                <span>
                  {visibleJobs.length === jobs.length
                    ? plural(jobs.length, "job")
                    : `${visibleJobs.length} of ${plural(jobs.length, "job")}`}
                </span>
                <DotSeparator />
                <span>{failingCount} failing</span>
              </span>
            }
          >
            <div className="ms-auto flex shrink-0 items-center gap-2">
              <JobsDisplayPopover
                table={table}
                density={density}
                onDensityChange={setDensity}
                striped={striped}
                onStripedChange={setStriped}
              />
            </div>
          </SectionHeader>

          <FramePanel className="p-0">
            {/* Status tabs */}
            <Tabs
              value={tab}
              onValueChange={(value) => {
                const next = JOB_TABS.find((item) => item.value === value)
                if (!next) return
                setTab(next.value)
                resetPage()
                setRowSelection({})
              }}
            >
              <TabsList
                variant="line"
                className="no-scrollbar h-10! w-full justify-start gap-3 overflow-x-auto border-b bg-transparent px-(--frame-panel-header-px) py-0! sm:gap-5"
              >
                {JOB_TABS.map((item) => (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="h-full! flex-none gap-1.5 px-1 text-sm after:-bottom-px!"
                  >
                    {item.label}
                    <Badge
                      variant="outline"
                      radius="full"
                      className="tabular-nums"
                    >
                      {tabCounts[item.value]}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <JobsToolbar
              search={search}
              onSearchChange={(value) => {
                setSearch(value)
                resetPage()
                setRowSelection({})
              }}
              searchRef={searchRef}
              filterQuery={filterQuery}
              onFilterQueryChange={(next) => {
                setFilterQuery(next)
                resetPage()
                setRowSelection({})
              }}
            />

            {selectedIds.length > 0 ? (
              <>
                <Separator />
                <BulkBar
                  count={selectedIds.length}
                  selectedJobs={selectedJobs}
                  onClear={() => setRowSelection({})}
                  onRun={() => {
                    runJobs(selectedIds, "manual")
                    setRowSelection({})
                  }}
                  onSetEnabled={(enabled) => {
                    setEnabled(selectedIds, enabled)
                    setRowSelection({})
                  }}
                  onDelete={(origin) => {
                    // One pick confirms by name, like the row menu.
                    const only =
                      selectedIds.length === 1 ? selectedJobs[0] : undefined
                    requestDelete(
                      only
                        ? { kind: "row", id: only.id, name: only.name, origin }
                        : { kind: "bulk", ids: selectedIds, origin }
                    )
                  }}
                />
              </>
            ) : null}

            <Separator />

            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
          </FramePanel>

          <FrameFooter>
            <DataGridPagination
              sizes={[10, 25, 50]}
              info="{from} - {to} of {count} jobs"
            />
          </FrameFooter>
        </Frame>
      </DataGrid>

      {/* Overlays */}
      <JobSheet
        job={sheetJob}
        open={sheet.open}
        tab={sheet.tab}
        position={
          sheetIndex >= 0
            ? { index: sheetIndex, total: orderedIds.length }
            : null
        }
        returnFocusRef={returnFocusRef}
        onTabChange={(next) => onSheetChange({ tab: next })}
        onStep={(direction) => stepTo(sheetIndex + direction)}
        onClose={onCloseSheet}
        onRun={(id) => runJobs([id], "manual")}
        onRetry={(id) => runJobs([id], "retry")}
        onPauseToggle={(job) => setEnabled([job.id], !job.enabled)}
        onSkipToggle={toggleSkip}
        onDuplicate={(id) => {
          const copyId = duplicate(id)
          if (!copyId) return
          setRevealId(copyId)
          onSheetChange({ jobId: copyId, tab: "settings" })
        }}
        onDelete={(job) => {
          // The sheet closes first, then the shared confirm opens and owns focus.
          onReturnFocusChange(null)
          onCloseSheet()
          requestDelete({
            kind: "row",
            id: job.id,
            name: job.name,
            origin: triggerNodes.get(job.id) ?? null,
          })
        }}
        onSave={update}
      />

      <DeleteJobsDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        pending={pendingDelete}
        focusTargetRef={focusTargetRef}
        onConfirm={handleConfirmDelete}
      />
    </ActiveJobContext.Provider>
  )
}