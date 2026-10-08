import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/reui/badge"
import {
  DataGrid,
  dataGridFeatures,
} from "@/components/reui/data-grid/data-grid"
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
import { Filters } from "@/components/reui/filters/filters"
import {
  createFilterQuery,
  createFilterRule,
  flattenFilterConditions,
} from "@/components/reui/filters/filters-query"
import type { FilterCondition } from "@/components/reui/filters/filters-query"
import type {
  FilterField,
  FilterQuery,
} from "@/components/reui/filters/filters-types"
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { useTable, type ColumnVisibilityState } from "@tanstack/react-table"
import type { SortingState } from "@tanstack/react-table"
import type { PaginationState } from "@tanstack/react-table"
import type { ColumnSizingState } from "@tanstack/react-table"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Item, ItemMedia } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ChannelBadge, columns, StatusBadge } from "./columns"
import {
  TRANSACTIONS,
  type ITransaction,
  type TxChannel,
  type TxStatus,
} from "./data"
import { HashIcon, FileTextIcon, Building2Icon, FolderIcon, GlobeIcon, RouteIcon, CircleDotIcon, PlusIcon, FilterIcon, FunnelXIcon } from "lucide-react"

// ── Helpers ──

function getActiveFilters(filters: FilterCondition[]) {
  return filters.filter((filter) => {
    const { operator, values } = filter
    // "is empty" / "is not empty" carry no value, so the blank checks below
    // would read them as an unfilled placeholder row and drop them.
    if (operator === "empty" || operator === "not_empty") return true
    if (!values || values.length === 0) return false
    if (
      values.every((value) => typeof value === "string" && value.trim() === "")
    )
      return false
    if (values.every((value) => value === null || value === undefined))
      return false
    if (values.every((value) => Array.isArray(value) && value.length === 0))
      return false
    return true
  })
}

/** Stable key for comparing whether applied (active) filters meaningfully changed. */
function serializeActiveFiltersKey(active: FilterCondition[]) {
  return JSON.stringify(
    active.map((f) => ({
      field: f.field,
      operator: f.operator,
      values: f.values,
      // Negation is part of what a filter means, not decoration. Leaving it out
      // makes "starts with" and its negated twin serialize the same, so the
      // early return below would skip the refetch and keep the rows the chip
      // now says it excludes.
      negated: f.negated,
    }))
  )
}

function filterFieldValue(item: ITransaction, field: string): unknown {
  if (field === "region") {
    return [item.country, item.timezone].filter(Boolean).join(" ")
  }
  return item[field as keyof ITransaction]
}

/** `null` for an operator this demo does not implement, which keeps the row. */
function matchesCondition(
  fieldValue: unknown,
  operator: string,
  values: unknown[]
): boolean | null {
  switch (operator) {
    case "is":
      return values.includes(fieldValue)
    case "is_not":
      return !values.includes(fieldValue)
    case "is_any_of":
      return values.some((v) => fieldValue === v)
    case "is_none_of":
      return !values.some((v) => fieldValue === v)
    case "contains": {
      const tokens = values.map((v) => String(v).trim()).filter(Boolean)
      if (tokens.length === 0) return true
      return tokens.some((token) =>
        String(fieldValue).toLowerCase().includes(token.toLowerCase())
      )
    }
    case "not_contains":
      return !values.some((v) =>
        String(fieldValue).toLowerCase().includes(String(v).toLowerCase())
      )
    case "starts_with":
      return values.some((v) =>
        String(fieldValue).toLowerCase().startsWith(String(v).toLowerCase())
      )
    case "ends_with":
      return values.some((v) =>
        String(fieldValue).toLowerCase().endsWith(String(v).toLowerCase())
      )
    case "eq":
      return fieldValue === values[0]
    case "neq":
      return fieldValue !== values[0]
    case "gt":
      return Number(fieldValue) > Number(values[0])
    case "lt":
      return Number(fieldValue) < Number(values[0])
    case "gte":
      return Number(fieldValue) >= Number(values[0])
    case "lte":
      return Number(fieldValue) <= Number(values[0])
    case "between":
      if (values.length >= 2) {
        const min = Number(values[0])
        const max = Number(values[1])
        return Number(fieldValue) >= min && Number(fieldValue) <= max
      }
      return true
    case "not_between":
      if (values.length >= 2) {
        const min = Number(values[0])
        const max = Number(values[1])
        return Number(fieldValue) < min || Number(fieldValue) > max
      }
      return true
    case "empty":
      return fieldValue === "" || fieldValue == null
    case "not_empty":
      return fieldValue !== "" && fieldValue != null
    default:
      return null
  }
}

function applyFiltersToData(
  data: ITransaction[],
  filters: FilterCondition[]
): ITransaction[] {
  const active = getActiveFilters(filters)
  let result = [...data]
  active.forEach((filter) => {
    const { field, operator, values, negated } = filter
    result = result.filter((item) => {
      const raw = filterFieldValue(item, field)
      const fieldValue = raw != null ? raw : ""
      const matches = matchesCondition(fieldValue, operator, values)

      // "Starts with" and "ends with" declare no opposite operator, so Negate
      // keeps the operator and flips this flag instead. Ignoring it would keep
      // exactly the rows the chip says it excludes.
      if (matches === null) return true
      return negated ? !matches : matches
    })
  })
  return result
}

// ── Filter field config ──

const CATEGORY_OPTIONS = [
  "Payments",
  "Infrastructure",
  "AI / ML",
  "Automation",
  "Design",
  "Documentation",
  "Backend",
  "Developer tools",
]

const STATUS_OPTIONS: { value: TxStatus; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
]

const CHANNEL_OPTIONS: { value: TxChannel; label: string }[] = [
  { value: "checkout", label: "Checkout" },
  { value: "api", label: "API" },
  { value: "invoice", label: "Invoice" },
  { value: "dashboard", label: "Dashboard" },
]

const MERCHANT_FILTER_OPTIONS = Array.from(
  new Map(
    TRANSACTIONS.map((transaction) => [
      transaction.merchant,
      {
        value: transaction.merchant,
        label: transaction.merchant,
        icon: (
          <Item
            render={<span />}
            className="w-auto shrink-0 border-0 p-0 [&_svg]:size-4"
          >
            <ItemMedia variant="icon" className="size-auto">
              {transaction.merchantLogo}
            </ItemMedia>
          </Item>
        ),
      },
    ])
  ).values()
)

function renderSelectedCount(values: unknown[]) {
  if (values.length === 0) return "Select..."
  if (values.length > 1) return `${values.length} selected`
  return null
}

const filterFields: FilterField[] = [
  {
    id: "reference",
    label: "Reference",
    icon: (
      <HashIcon className="size-3.5" aria-hidden />
    ),
    type: "text",
    placeholder: "Search...",
  },
  {
    id: "description",
    label: "Description",
    icon: (
      <FileTextIcon className="size-3.5" aria-hidden />
    ),
    type: "text",
    placeholder: "Search...",
  },
  {
    id: "merchant",
    label: "Merchant",
    icon: (
      <Building2Icon className="size-3.5" aria-hidden />
    ),
    type: "select",
    searchable: true,
    options: MERCHANT_FILTER_OPTIONS,
    renderValue: ({ values, options }) => {
      const state = renderSelectedCount(values)
      if (state) return state

      const option = options.find((item) => item.value === values[0])
      if (!option) return String(values[0])

      return (
        <div className="flex items-center gap-2">
          {option.icon}
          <span className="truncate">{option.label}</span>
        </div>
      )
    },
  },
  {
    id: "category",
    label: "Category",
    icon: (
      <FolderIcon className="size-3.5" aria-hidden />
    ),
    type: "select",
    searchable: true,
    options: CATEGORY_OPTIONS.map((category) => ({
      value: category,
      label: category,
    })),
    renderValue: ({ values }) => {
      const state = renderSelectedCount(values)
      if (state) return state

      return <Badge variant="outline">{String(values[0])}</Badge>
    },
  },
  {
    id: "region",
    label: "Region",
    icon: (
      <GlobeIcon className="size-3.5" aria-hidden />
    ),
    type: "text",
    placeholder: "Search...",
  },
  {
    id: "channel",
    label: "Channel",
    icon: (
      <RouteIcon className="size-3.5" aria-hidden />
    ),
    type: "select",
    searchable: false,
    options: CHANNEL_OPTIONS,
    renderValue: ({ values }) => {
      const state = renderSelectedCount(values)
      if (state) return state

      return <ChannelBadge channel={values[0] as TxChannel} />
    },
  },
  {
    id: "status",
    label: "Status",
    icon: (
      <CircleDotIcon className="size-3.5" aria-hidden />
    ),
    type: "select",
    searchable: false,
    options: STATUS_OPTIONS,
    renderValue: ({ values }) => {
      const state = renderSelectedCount(values)
      if (state) return state

      return <StatusBadge status={values[0] as TxStatus} />
    },
  },
]

/** Single default row: Reference | contains | empty - inactive until user types (see getActiveFilters). */
function createDefaultTransactionFilters(): FilterQuery {
  return createFilterQuery([
    createFilterRule({
      id: "reference-1",
      path: ["reference"],
      operator: "contains",
      value: "",
    }),
  ])
}

const DESCRIPTION_COLUMN_ID = "description"
const DESCRIPTION_COLUMN_DEFAULT_SIZE = 300

function getAutoDescriptionColumnSize(
  containerWidth: number,
  columnVisibility: ColumnVisibilityState
) {
  const occupiedWidth = columns.reduce((total, column) => {
    if (
      !column.id ||
      column.id === DESCRIPTION_COLUMN_ID ||
      columnVisibility[column.id] === false
    ) {
      return total
    }

    return total + (typeof column.size === "number" ? column.size : 0)
  }, 0)

  return Math.max(
    DESCRIPTION_COLUMN_DEFAULT_SIZE,
    Math.round(containerWidth - occupiedWidth)
  )
}

// ── Main component ──

export function DataGridView() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: "reference", desc: true },
  ])
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({
      account: false,
    })
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [filterQuery, setFilterQuery] = useState<FilterQuery>(
    createDefaultTransactionFilters
  )
  const filters = useMemo(
    () => flattenFilterConditions(filterQuery),
    [filterQuery]
  )
  const [isLoading, setIsLoading] = useState(false)
  const [filteredData, setFilteredData] = useState<ITransaction[]>(TRANSACTIONS)
  const [gridWidth, setGridWidth] = useState(0)
  const isInitialLoad = useRef(true)
  const gridWidthRef = useRef<HTMLDivElement>(null)
  const hasManualColumnSizing = useRef(false)
  const lastAppliedActiveKey = useRef<string>(
    serializeActiveFiltersKey(
      getActiveFilters(
        flattenFilterConditions(createDefaultTransactionFilters())
      )
    )
  )

  const applyFilters = useCallback((newFilters: FilterCondition[]) => {
    return applyFiltersToData(TRANSACTIONS, newFilters)
  }, [])

  const simulateAsyncFiltering = useCallback(
    async (newFilters: FilterCondition[]) => {
      setIsLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 400))
      setFilteredData(applyFilters(newFilters))
      setIsLoading(false)
    },
    [applyFilters]
  )

  const handleFiltersChange = useCallback(
    (nextQuery: FilterQuery) => {
      const newFilters = flattenFilterConditions(nextQuery)

      setFilterQuery(nextQuery)
      const newActive = getActiveFilters(newFilters)
      const nextKey = serializeActiveFiltersKey(newActive)
      if (nextKey === lastAppliedActiveKey.current) return
      lastAppliedActiveKey.current = nextKey
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
      simulateAsyncFiltering(newFilters)
    },
    [simulateAsyncFiltering]
  )

  useEffect(() => {
    if (isInitialLoad.current) {
      setFilteredData(applyFilters(filters))
      isInitialLoad.current = false
    }
  }, [filters, applyFilters])

  useEffect(() => {
    const element = gridWidthRef.current

    if (!element) return

    const syncGridWidth = () => {
      setGridWidth(element.clientWidth)
    }

    syncGridWidth()

    if (typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(syncGridWidth)
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (gridWidth <= 0 || hasManualColumnSizing.current) return

    const nextDescriptionWidth = getAutoDescriptionColumnSize(
      gridWidth,
      columnVisibility
    )

    setColumnSizing((current) =>
      current[DESCRIPTION_COLUMN_ID] === nextDescriptionWidth
        ? current
        : {
            ...current,
            [DESCRIPTION_COLUMN_ID]: nextDescriptionWidth,
          }
    )
  }, [columnVisibility, gridWidth])

  const [columnOrder, setColumnOrder] = useState<string[]>(
    columns.map((c) => c.id as string)
  )

  const handleColumnSizingChange = useCallback(
    (
      updater:
        | ColumnSizingState
        | ((old: ColumnSizingState) => ColumnSizingState)
    ) => {
      hasManualColumnSizing.current = true
      setColumnSizing(updater)
    },
    []
  )

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: filteredData,
    pageCount: Math.ceil(filteredData.length / pagination.pageSize),
    getRowId: (row) => row.id,
    state: {
      pagination,
      sorting,
      columnOrder,
      columnSizing,
      columnVisibility,
    },
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: handleColumnSizingChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  })

  /** Show Clear whenever any filter row is visible (including empty placeholders). */
  const showClearButton = filters.length > 0

  return (
    <TooltipProvider delay={200}>
      {/* Table */}
      <DataGrid
        table={table}
        isLoading={isLoading}
        loadingMode="skeleton"
        recordCount={filteredData.length}
        emptyMessage={
          !isLoading && filteredData.length === 0
            ? "No transactions match your filters."
            : undefined
        }
        tableLayout={{
          columnsPinnable: true,
          columnsResizable: true,
          columnsMovable: true,
          columnsVisibility: true,
          dense: true,
        }}
        // customize: first column pads to the frame header px token so the grid
        // aligns with the FrameHeader instead of the default cell padding
        tableClassNames={{
          edgeCell:
            "first:ps-(--frame-panel-header-px) last:pe-(--frame-panel-header-px)",
        }}
      >
        <Frame variant="default" spacing="sm" className="w-full">
          <FrameHeader className="flex-row items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle id="page-heading" className="text-balance">
                Transactions
              </FrameTitle>
              <FrameDescription className="text-xs text-pretty">
                Billing ledger(refunds / payouts)
              </FrameDescription>
            </div>
            <Button
              type="button"
              onClick={() =>
                toast.info("New transaction", {
                  description:
                    "Wire to your checkout or manual entry flow, demo only.",
                })
              }
            >
              <PlusIcon aria-hidden />
              New transaction
            </Button>
          </FrameHeader>
          <FramePanel className="p-0! shadow-none!">
            <div className="flex flex-wrap items-center justify-between gap-2 px-(--frame-panel-header-px) py-2.5">
              <Filters
                query={filterQuery}
                fields={filterFields}
                onQueryChange={handleFiltersChange}
                size="default"
                trigger={
                  <Button variant="outline" aria-label="Filters">
                    <FilterIcon aria-hidden />
                    Filters
                  </Button>
                }
              />
              {showClearButton && (
                <Button
                  variant="outline"
                  className="shrink-0"
                  onClick={() => {
                    const nextQuery = createDefaultTransactionFilters()
                    const next = flattenFilterConditions(nextQuery)
                    lastAppliedActiveKey.current = serializeActiveFiltersKey(
                      getActiveFilters(next)
                    )
                    setFilterQuery(nextQuery)
                    simulateAsyncFiltering(next)
                  }}
                  disabled={isLoading}
                >
                  <FunnelXIcon className="size-3.5" aria-hidden />
                  Clear
                </Button>
              )}
            </div>
            <Separator />
            <div ref={gridWidthRef} className="w-full">
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
            </div>
          </FramePanel>
          <FrameFooter>
            <DataGridPagination />
          </FrameFooter>
        </Frame>
      </DataGrid>
    </TooltipProvider>
  )
}