"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  DataGrid,
  dataGridFeatures,
} from "@/components/reui/data-grid/data-grid"
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
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
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  RUNS,
  STATUS_FILTER_OPTIONS,
  TOAST_INFO_ICON,
  TOAST_SUCCESS_ICON,
  type IRun,
  type RunStatus,
} from "./data"
import { createRunColumns, type RunAction } from "./run-queue-columns"
import { RefreshCwIcon, DownloadIcon, SearchIcon, XIcon } from "lucide-react"

export function RunQueue({
  onRunAction,
  className,
}: {
  onRunAction: (action: RunAction, run: IRun) => void
  className?: string
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sorting, setSorting] = useState<SortingState>([
    { id: "latency", desc: true },
  ])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  })

  const handleRunAction = useCallback(
    (action: RunAction, run: IRun) => {
      onRunAction(action, run)
    },
    [onRunAction]
  )

  const handleRefresh = useCallback(() => {
    toast("Queue refreshed", {
      description: "Showing the latest agent runs across your environments.",
      icon: TOAST_INFO_ICON,
    })
  }, [])

  const handleExportRuns = useCallback(() => {
    toast.success("Runs exported", {
      description: "The filtered run queue is downloading as a CSV file.",
      icon: TOAST_SUCCESS_ICON,
    })
  }, [])

  const filteredRuns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return RUNS.filter((run) => {
      const matchesStatus =
        statusFilter === "all" || run.status === (statusFilter as RunStatus)

      const matchesQuery =
        query.length === 0 ||
        run.agent.toLowerCase().includes(query) ||
        run.runKey.toLowerCase().includes(query)

      return matchesStatus && matchesQuery
    })
  }, [searchQuery, statusFilter])

  const sortedRuns = useMemo(() => {
    const primarySort = sorting[0]
    if (!primarySort) return filteredRuns

    const direction = primarySort.desc ? -1 : 1

    return [...filteredRuns].sort(
      (a, b) =>
        (a.latencyMs - b.latencyMs) * direction ||
        a.runKey.localeCompare(b.runKey)
    )
  }, [filteredRuns, sorting])

  useEffect(() => {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
    )
  }, [searchQuery, statusFilter])

  const pagedRuns = useMemo(() => {
    const startIndex = pagination.pageIndex * pagination.pageSize
    return sortedRuns.slice(startIndex, startIndex + pagination.pageSize)
  }, [pagination.pageIndex, pagination.pageSize, sortedRuns])

  const columns = useMemo(
    () => createRunColumns({ onAction: handleRunAction }),
    [handleRunAction]
  )

  const emptyMessage = useMemo(() => {
    if (sortedRuns.length > 0) return undefined
    return "No runs match this view. Clear the search or switch the status filter."
  }, [sortedRuns.length])

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: pagedRuns,
    pageCount: Math.ceil(sortedRuns.length / pagination.pageSize),
    getRowId: (row) => row.id,
    state: {
      pagination,
      sorting,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    manualSorting: true,
    manualPagination: true,
  })

  return (
    <DataGrid
      table={table}
      recordCount={sortedRuns.length}
      emptyMessage={emptyMessage}
      tableLayout={{
        headerSticky: true,
        dense: true,
      }}
      // customize: first column pads to the frame header px token so the grid
      // aligns with the FrameHeader instead of the default cell padding
      tableClassNames={{
        edgeCell:
          "first:ps-(--frame-panel-header-px) last:pe-(--frame-panel-header-px)",
      }}
    >
      <Frame
        dense
        variant="default"
        spacing="sm"
        className={cn("w-full", className)}
      >
        <FrameHeader className="flex-row items-center justify-between gap-3">
          <div className="flex flex-col gap-px">
            <FrameTitle className="text-balance">Run Queue</FrameTitle>
            <FrameDescription className="text-xs text-pretty">
              {sortedRuns.length} run{sortedRuns.length === 1 ? "" : "s"} in
              view
            </FrameDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
            >
              <RefreshCwIcon className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportRuns}
            >
              <DownloadIcon className="size-4" aria-hidden="true" />
              Export
            </Button>
          </div>
        </FrameHeader>

        <FramePanel className="p-0 shadow-none!">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-(--frame-panel-header-px) py-2.5">
            <InputGroup className="w-full min-w-52 sm:w-[260px]">
              <InputGroupAddon align="inline-start">
                <SearchIcon className="text-muted-foreground size-4" aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search agent or run"
                aria-label="Search runs"
              />
              {searchQuery.length > 0 ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery("")}
                  >
                    <XIcon className="size-4" aria-hidden="true" />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>

            <Select
              value={statusFilter}
              onValueChange={(value) => value && setStatusFilter(value)}
              items={STATUS_FILTER_OPTIONS}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>

          <Separator />

          <FrameFooter>
            <DataGridPagination />
          </FrameFooter>
        </FramePanel>
      </Frame>
    </DataGrid>
  )
}