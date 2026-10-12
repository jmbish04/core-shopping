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
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  createPlanColumns,
  VisibilityBadge,
  type PlanTableMeta,
} from "./columns"
import {
  draftToPlan,
  getPlanDraftErrors,
  hasPlanDraftError,
  PLAN_VISIBILITIES,
  PLANS,
  planToDraft,
  type PlanDraft,
  type PlanVisibility,
  type PricingPlan,
} from "./data"
import { EyeIcon, PlusIcon, SquarePenIcon } from "lucide-react"

/**
 * Pricing plan grid with per-row edit mode: the whole table is read-only until
 * one plan is checked out with Edit. That row's fields turn into inputs bound to
 * a single `draft`, Save validates and commits it on its own, Cancel reverts it,
 * and every other row is locked meanwhile. No global save bar, no bulk actions.
 * customize: wire handleSave callers to your billing API and reseed PLANS.
 */
export function PlanEditingDataGridView() {
  const [rows, setRows] = useState<PricingPlan[]>(PLANS)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [draft, setDraft] = useState<PlanDraft | null>(null)
  const [selectedVisibilities, setSelectedVisibilities] = useState<
    PlanVisibility[]
  >([])
  // Id of a row created in this edit session but not yet saved; Cancel drops it.
  const unsavedRowId = useRef<string | null>(null)
  const newRowCounter = useRef(0)

  const columns = useMemo(() => createPlanColumns(), [])

  const isLocked = editingRowId !== null
  const errors = useMemo(
    () => (draft ? getPlanDraftErrors(draft) : null),
    [draft]
  )
  const hasErrors = errors ? hasPlanDraftError(errors) : false

  // The checked-out row always stays visible so a filter cannot hide it mid-edit.
  const filteredRows = useMemo(() => {
    if (selectedVisibilities.length === 0) return rows
    return rows.filter(
      (plan) =>
        plan.id === editingRowId ||
        selectedVisibilities.includes(plan.visibility)
    )
  }, [rows, selectedVisibilities, editingRowId])

  const startEdit = useCallback(
    (rowId: string) => {
      if (editingRowId) return
      const plan = rows.find((row) => row.id === rowId)
      if (!plan) return
      unsavedRowId.current = null
      setDraft(planToDraft(plan))
      setEditingRowId(rowId)
    },
    [editingRowId, rows]
  )

  const updateDraft = useCallback((patch: Partial<PlanDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }, [])

  const cancelEdit = useCallback(() => {
    if (unsavedRowId.current) {
      const droppedId = unsavedRowId.current
      setRows((current) => current.filter((row) => row.id !== droppedId))
    }
    unsavedRowId.current = null
    setDraft(null)
    setEditingRowId(null)
  }, [])

  const saveEdit = useCallback(() => {
    if (!editingRowId || !draft) return
    if (hasPlanDraftError(getPlanDraftErrors(draft))) return
    setRows((current) =>
      current.map((row) =>
        row.id === editingRowId ? draftToPlan(row, draft) : row
      )
    )
    unsavedRowId.current = null
    setDraft(null)
    setEditingRowId(null)
    toast.success("Plan updated", {
      description: "Connect this action to your billing API.",
      icon: null,
    })
  }, [editingRowId, draft])

  const duplicateRow = useCallback(
    (rowId: string) => {
      if (editingRowId) return
      const source = rows.find((row) => row.id === rowId)
      if (!source) return
      newRowCounter.current += 1
      const id = `plan-new-${newRowCounter.current}`
      const copy: PricingPlan = {
        ...source,
        id,
        name: `${source.name} Copy`,
        code: `${source.code}_copy`,
        visibility: "Private",
        featured: false,
      }
      setRows((current) => {
        const index = current.findIndex((row) => row.id === rowId)
        if (index === -1) return current
        const next = [...current]
        next.splice(index + 1, 0, copy)
        return next
      })
      unsavedRowId.current = id
      setDraft(planToDraft(copy))
      setEditingRowId(id)
    },
    [editingRowId, rows]
  )

  const deleteRow = useCallback((rowId: string) => {
    setRows((current) => current.filter((row) => row.id !== rowId))
    setEditingRowId((current) => (current === rowId ? null : current))
    if (unsavedRowId.current === rowId) unsavedRowId.current = null
  }, [])

  const handleAddPlan = useCallback(() => {
    if (editingRowId) return
    newRowCounter.current += 1
    const id = `plan-new-${newRowCounter.current}`
    const plan: PricingPlan = {
      id,
      name: "New plan",
      code: `plan_new_${newRowCounter.current}`,
      audience: "Individuals",
      price: 0,
      seats: 1,
      trialDays: 0,
      visibility: "Private",
      featured: false,
    }
    unsavedRowId.current = id
    setRows((current) => [plan, ...current])
    setDraft(planToDraft(plan))
    setEditingRowId(id)
  }, [editingRowId])

  const handleVisibilityToggle = useCallback(
    (visibility: PlanVisibility, checked: boolean) => {
      setSelectedVisibilities((current) => {
        if (checked) {
          return current.includes(visibility)
            ? current
            : [...current, visibility]
        }
        return current.filter((item) => item !== visibility)
      })
    },
    []
  )

  const tableMeta: PlanTableMeta = {
    editingRowId,
    draft,
    errors,
    hasErrors,
    isLocked,
    startEdit,
    cancelEdit,
    saveEdit,
    updateDraft,
    duplicateRow,
    deleteRow,
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

  const publicCount = rows.filter((plan) => plan.visibility === "Public").length
  const editingName = draft?.name.trim() ? draft.name.trim() : "this plan"

  return (
    <TooltipProvider delay={200}>
      <DataGrid
        table={table}
        recordCount={filteredRows.length}
        emptyMessage="No plans match this view."
        tableLayout={{
          dense: false,
          rowBorder: true,
          columnsVisibility: false,
          columnsResizable: false,
          columnsMovable: false,
          width: "fixed",
        }}
        tableClassNames={{
          bodyRow: "[&>td]:h-14",
          edgeCell: "first:ps-4 last:pe-4 sm:first:ps-5 sm:last:pe-5",
        }}
      >
        <section className="flex w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
          <Frame spacing="default">
            {/* Header: title plus the visibility filter and Add plan, both locked while editing */}
            <FrameHeader className="items-start gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col">
                <FrameTitle className="text-foreground text-base font-semibold tracking-tight">
                  Plans
                </FrameTitle>
                <FrameDescription>Edit one plan at a time.</FrameDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isLocked}
                      >
                        <EyeIcon data-icon="inline-start" aria-hidden="true" />
                        Visibility
                        {selectedVisibilities.length > 0 ? (
                          <Badge variant="secondary">
                            {selectedVisibilities.length}
                          </Badge>
                        ) : null}
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="min-w-44">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Visibility</DropdownMenuLabel>
                      {PLAN_VISIBILITIES.map((visibility) => (
                        <DropdownMenuCheckboxItem
                          key={visibility}
                          checked={selectedVisibilities.includes(visibility)}
                          closeOnClick={false}
                          onCheckedChange={(checked) =>
                            handleVisibilityToggle(visibility, checked === true)
                          }
                        >
                          <VisibilityBadge visibility={visibility} />
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuGroup>
                    {selectedVisibilities.length > 0 ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          closeOnClick={false}
                          onClick={() => setSelectedVisibilities([])}
                        >
                          Reset visibility
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  onClick={handleAddPlan}
                  disabled={isLocked}
                >
                  <PlusIcon data-icon="inline-start" aria-hidden="true" />
                  Add plan
                </Button>
              </div>
            </FrameHeader>

            <FramePanel className="p-0">
              <DataGridContainer>
                <DataGridScrollArea>
                  <DataGridTable />
                </DataGridScrollArea>
              </DataGridContainer>
            </FramePanel>

            {/* Footer: a scope summary, or the lock hint while a row is checked out */}
            <FrameFooter>
              {isLocked ? (
                <span className="text-foreground flex items-center gap-1.5 text-xs font-medium">
                  <SquarePenIcon className="text-primary size-4" aria-hidden="true" />
                  Editing {editingName}. Save or cancel to continue.
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <span>
                    {rows.length} {rows.length === 1 ? "plan" : "plans"}
                  </span>
                  <span
                    aria-hidden="true"
                    className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
                  />
                  <span>{publicCount} public</span>
                </span>
              )}
            </FrameFooter>
          </Frame>
        </section>
      </DataGrid>
    </TooltipProvider>
  )
}