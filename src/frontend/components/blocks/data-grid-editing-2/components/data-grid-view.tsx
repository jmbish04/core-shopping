import { useCallback, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/reui/badge"
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
} from "@/components/reui/data-grid/data-grid"
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
import { useTable } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  createInventoryColumns,
  StatusBadge,
  type EditField,
  type EditingCell,
  type InventoryTableMeta,
} from "./columns"
import {
  isProductChanged,
  PRODUCT_STATUSES,
  PRODUCTS,
  type Product,
  type ProductCategory,
  type ProductStatus,
} from "./data"
import { PlusIcon, SearchIcon, XIcon, FilterIcon, InfoIcon, CircleCheckIcon } from "lucide-react"

function getSearchBlob(product: Product) {
  return [product.name, product.sku, product.category, product.status]
    .join(" ")
    .toLowerCase()
}

/**
 * Inline-editable inventory grid: Frame shell + DataGrid with per-type cell
 * editors threaded through TanStack `table.options.meta`. Editing mutates the
 * `rows` working copy; diffing it against the `savedRows` baseline drives the
 * dirty state and the Save / Discard bar.
 * customize: wire handleSave to your update API and reseed PRODUCTS from data.
 */
export function InventoryEditingDataGridView() {
  // Working copy + saved baseline: diffing the two powers dirty state + Discard.
  const [savedRows, setSavedRows] = useState<Product[]>(PRODUCTS)
  const [rows, setRows] = useState<Product[]>(PRODUCTS)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatuses, setSelectedStatuses] = useState<ProductStatus[]>([])
  const newRowCounter = useRef(0)

  const columns = useMemo(() => createInventoryColumns(), [])

  const savedById = useMemo(
    () => new Map(savedRows.map((row) => [row.id, row])),
    [savedRows]
  )

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return rows.filter((product) => {
      if (
        normalizedQuery.length > 0 &&
        !getSearchBlob(product).includes(normalizedQuery)
      ) {
        return false
      }

      if (
        selectedStatuses.length > 0 &&
        !selectedStatuses.includes(product.status)
      ) {
        return false
      }

      return true
    })
  }, [rows, searchQuery, selectedStatuses])

  // Dirty accounting: changed + added rows, plus rows removed from the baseline.
  const dirty = useMemo(() => {
    const workingIds = new Set(rows.map((row) => row.id))
    const changedOrAdded = rows.filter((row) => {
      const saved = savedById.get(row.id)
      return !saved || isProductChanged(row, saved)
    }).length
    const removed = savedRows.filter((row) => !workingIds.has(row.id)).length
    return {
      count: changedOrAdded + removed,
      hasChanges: changedOrAdded + removed > 0,
    }
  }, [rows, savedRows, savedById])

  const updateRow = useCallback(
    (rowId: string, updater: (row: Product) => Product) => {
      setRows((current) =>
        current.map((row) => (row.id === rowId ? updater(row) : row))
      )
    },
    []
  )

  const startEdit = useCallback((rowId: string, field: EditField) => {
    setEditingCell({ rowId, field })
  }, [])

  const cancelEdit = useCallback(() => setEditingCell(null), [])

  const commitText = useCallback(
    (rowId: string, value: string) => {
      updateRow(rowId, (row) => ({ ...row, name: value }))
      setEditingCell(null)
    },
    [updateRow]
  )

  const commitNumber = useCallback(
    (rowId: string, field: "price" | "stock", value: number) => {
      updateRow(rowId, (row) => ({ ...row, [field]: value }))
      setEditingCell(null)
    },
    [updateRow]
  )

  const commitSelect = useCallback(
    (rowId: string, field: "category" | "status", value: string) => {
      updateRow(rowId, (row) =>
        field === "category"
          ? { ...row, category: value as ProductCategory }
          : { ...row, status: value as ProductStatus }
      )
      setEditingCell(null)
    },
    [updateRow]
  )

  const toggleVisible = useCallback(
    (rowId: string) => {
      updateRow(rowId, (row) => ({ ...row, visible: !row.visible }))
    },
    [updateRow]
  )

  const duplicateRow = useCallback((rowId: string) => {
    setRows((current) => {
      const index = current.findIndex((row) => row.id === rowId)
      if (index === -1) return current
      const source = current[index]
      newRowCounter.current += 1
      const copy: Product = {
        ...source,
        id: `prd-new-${newRowCounter.current}`,
        name: `${source.name} Copy`,
        sku: `${source.sku}-C`,
        status: "Draft",
        visible: false,
      }
      const next = [...current]
      next.splice(index + 1, 0, copy)
      return next
    })
  }, [])

  const deleteRow = useCallback((rowId: string) => {
    setRows((current) => current.filter((row) => row.id !== rowId))
    setEditingCell((current) => (current?.rowId === rowId ? null : current))
  }, [])

  const isRowDirty = useCallback(
    (rowId: string) => {
      const working = rows.find((row) => row.id === rowId)
      if (!working) return false
      const saved = savedById.get(rowId)
      return !saved || isProductChanged(working, saved)
    },
    [rows, savedById]
  )

  const handleAddProduct = useCallback(() => {
    newRowCounter.current += 1
    const id = `prd-new-${newRowCounter.current}`
    const product: Product = {
      id,
      name: "New product",
      sku: `NEW-${String(newRowCounter.current).padStart(4, "0")}`,
      category: "Apparel",
      price: 0,
      stock: 0,
      status: "Draft",
      visible: false,
    }
    setRows((current) => [product, ...current])
    setEditingCell({ rowId: id, field: "name" })
  }, [])

  const handleSave = useCallback(() => {
    setSavedRows(rows)
    setEditingCell(null)
    toast.success("Inventory saved", {
      description: "Connect this action to your product API.",
    })
  }, [rows])

  const handleDiscard = useCallback(() => {
    setRows(savedRows)
    setEditingCell(null)
  }, [savedRows])

  const handleStatusToggle = useCallback(
    (status: ProductStatus, checked: boolean) => {
      setSelectedStatuses((current) => {
        if (checked) {
          return current.includes(status) ? current : [...current, status]
        }
        return current.filter((item) => item !== status)
      })
    },
    []
  )

  const tableMeta: InventoryTableMeta = {
    editingCell,
    startEdit,
    cancelEdit,
    commitText,
    commitNumber,
    commitSelect,
    toggleVisible,
    duplicateRow,
    deleteRow,
    isRowDirty,
  }

  const table = useTable({
    features: dataGridFeatures,
    // No pagination row model on v8, so every row rendered. The shared
    // bundle registers one, and manualPagination is v9's way to say the
    // data is already the page - it keeps the pagination APIs while
    // leaving the rows unsliced.
    manualPagination: true,
    data: filteredRows,
    columns,
    getRowId: (row) => row.id,
    meta: tableMeta,
  })

  const activeFilterCount = selectedStatuses.length

  return (
    <TooltipProvider delay={200}>
      <DataGrid
        table={table}
        recordCount={filteredRows.length}
        emptyMessage="No products match this view."
        tableLayout={{
          dense: false,
          rowBorder: true,
          columnsVisibility: false,
          columnsResizable: false,
          columnsMovable: false,
          width: "fixed",
        }}
        tableClassNames={{
          bodyRow: "[&>td]:h-12",
          edgeCell: "first:ps-3 last:pe-3 lg:first:ps-4 lg:last:pe-4",
        }}
      >
        <section className="flex w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
          <Frame>
            {/* Header */}
            <FrameHeader className="flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <FrameTitle>Product Inventory</FrameTitle>
                <FrameDescription>
                  Edit pricing and stock inline.
                </FrameDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddProduct}
              >
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                Add product
              </Button>
            </FrameHeader>

            <FramePanel className="bg-card p-0! shadow-none!">
              {/* Toolbar */}
              <div className="flex flex-col gap-3 border-b px-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-4">
                <InputGroup className="w-full min-w-0 lg:max-w-xs">
                  <InputGroupAddon align="inline-start">
                    <SearchIcon className="text-muted-foreground size-4" aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search products..."
                    aria-label="Search products"
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

                <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:justify-end">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger
                      render={
                        <Button type="button" variant="outline">
                          <FilterIcon data-icon="inline-start" aria-hidden="true" />
                          Status
                          {activeFilterCount > 0 ? (
                            <Badge variant="secondary">
                              {activeFilterCount}
                            </Badge>
                          ) : null}
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="min-w-44">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Status</DropdownMenuLabel>
                        {PRODUCT_STATUSES.map((status) => (
                          <DropdownMenuCheckboxItem
                            key={status}
                            checked={selectedStatuses.includes(status)}
                            closeOnClick={false}
                            onCheckedChange={(checked) =>
                              handleStatusToggle(status, checked === true)
                            }
                          >
                            <StatusBadge status={status} />
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuGroup>
                      {activeFilterCount > 0 ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            closeOnClick={false}
                            onClick={() => setSelectedStatuses([])}
                          >
                            Reset status
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {searchQuery.length > 0 || selectedStatuses.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setSearchQuery("")
                        setSelectedStatuses([])
                      }}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Editable grid */}
              <DataGridContainer>
                <DataGridScrollArea>
                  <DataGridTable />
                </DataGridScrollArea>
              </DataGridContainer>
            </FramePanel>

            {/* Save bar */}
            <FrameFooter className="flex-row items-center justify-between gap-3">
              {dirty.hasChanges ? (
                <span className="text-foreground flex items-center gap-1.5 text-xs font-medium">
                  <InfoIcon className="text-primary size-4" aria-hidden="true" />
                  {dirty.count} unsaved{" "}
                  {dirty.count === 1 ? "change" : "changes"}
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <CircleCheckIcon className="text-success size-4" aria-hidden="true" />
                  All changes saved
                </span>
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDiscard}
                  disabled={!dirty.hasChanges}
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty.hasChanges}
                >
                  Save changes
                </Button>
              </div>
            </FrameFooter>
          </Frame>
        </section>
      </DataGrid>
    </TooltipProvider>
  )
}