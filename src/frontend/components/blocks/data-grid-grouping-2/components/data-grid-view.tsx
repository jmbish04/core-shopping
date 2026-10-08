"use client"

import { useCallback, useMemo, useState, type ComponentProps } from "react"
import { Badge } from "@/components/reui/badge"
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
} from "@/components/reui/data-grid/data-grid"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import {
  DataGridTable,
  DataGridTableFootRow,
  DataGridTableFootRowCell,
} from "@/components/reui/data-grid/data-grid-table"
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import {
  useTable,
  type ColumnVisibilityState,
  type ExpandedState,
} from "@tanstack/react-table"
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
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
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
import { createPortfolioColumns, NrrValue, type AccountAction } from "./columns"
import {
  ACCOUNT_HEALTH_OPTIONS,
  ACCOUNTS,
  formatCompactCurrency,
  formatCurrency,
  REGIONS,
  sumArr,
  weightedNrr,
  type Account,
  type AccountHealth,
  type AccountRow,
  type PortfolioRow,
  type RegionGroupRow,
} from "./data"
import { DownloadIcon, SearchIcon, XIcon, ActivityIcon, Settings2Icon, CheckIcon } from "lucide-react"

type TableDensity = "compact" | "comfortable"

type PortfolioColumnKey = "owner" | "tier" | "health" | "nrr" | "renewal"

const TABLE_DENSITY_OPTIONS: { value: TableDensity; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
]

const DISPLAY_COLUMN_OPTIONS: { key: PortfolioColumnKey; label: string }[] = [
  { key: "owner", label: "Owner" },
  { key: "tier", label: "Tier" },
  { key: "health", label: "Health" },
  { key: "nrr", label: "NRR" },
  { key: "renewal", label: "Renewal" },
]

function getAccountSearchBlob(account: Account) {
  return [
    account.name,
    account.industry,
    account.owner.name,
    account.owner.role,
    account.tier,
    account.health,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function buildPortfolioRows(accounts: Account[]): RegionGroupRow[] {
  return REGIONS.map((region) => {
    const subRows: AccountRow[] = accounts
      .filter((account) => account.regionId === region.id)
      .map((account) => ({
        kind: "account",
        id: account.id,
        region,
        account,
      }))

    const row: RegionGroupRow = {
      kind: "region",
      id: region.id,
      region,
      subRows,
    }

    return row
  }).filter((row) => (row.subRows?.length ?? 0) > 0)
}

function getExpandedRegionState(rows: RegionGroupRow[]): ExpandedState {
  return rows.reduce<Record<string, boolean>>((expanded, row) => {
    expanded[row.id] = true
    return expanded
  }, {})
}

function isExpanded(expanded: ExpandedState, rowId: string) {
  if (expanded === true) return true
  return expanded[rowId] === true
}

function PortfolioMetric({
  label,
  value,
  variant = "secondary",
}: {
  label: string
  value: string
  variant?: ComponentProps<typeof Badge>["variant"]
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 sm:border-l sm:pl-3 sm:first:border-l-0 sm:first:pl-0">
      <span className="text-muted-foreground truncate text-xs font-medium">
        {label}
      </span>
      <Badge variant={variant} className="tabular-nums">
        {value}
      </Badge>
    </div>
  )
}

export function GroupedRevenueDataGridView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedHealth, setSelectedHealth] = useState<AccountHealth[]>([])
  const [tableDensity, setTableDensity] = useState<TableDensity>("comfortable")
  const [visibleColumns, setVisibleColumns] = useState<
    Record<PortfolioColumnKey, boolean>
  >({
    owner: true,
    tier: false,
    health: true,
    nrr: true,
    renewal: true,
  })
  const [expandedRows, setExpandedRows] = useState<ExpandedState>(() => {
    // Start collapsed; open only the first region as a preview.
    const [firstRegion] = buildPortfolioRows(ACCOUNTS)
    return firstRegion ? { [firstRegion.id]: true } : {}
  })

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return ACCOUNTS.filter((account) => {
      if (
        normalizedQuery.length > 0 &&
        !getAccountSearchBlob(account).includes(normalizedQuery)
      ) {
        return false
      }

      if (
        selectedHealth.length > 0 &&
        !selectedHealth.includes(account.health)
      ) {
        return false
      }

      return true
    })
  }, [searchQuery, selectedHealth])

  const groupedRows = useMemo(
    () => buildPortfolioRows(filteredAccounts),
    [filteredAccounts]
  )

  const allGroupsExpanded =
    groupedRows.length > 0 &&
    groupedRows.every((row) => isExpanded(expandedRows, row.id))

  const activeFilterCount = selectedHealth.length
  const totalArr = sumArr(filteredAccounts)
  const portfolioNrr = weightedNrr(filteredAccounts)
  const atRiskArr = sumArr(
    filteredAccounts.filter((account) => account.health === "At Risk")
  )

  const columnVisibility = useMemo<ColumnVisibilityState>(
    () => ({
      owner: visibleColumns.owner,
      tier: visibleColumns.tier,
      health: visibleColumns.health,
      nrr: visibleColumns.nrr,
      renewal: visibleColumns.renewal,
    }),
    [visibleColumns]
  )

  const handleHealthToggle = useCallback(
    (health: AccountHealth, checked: boolean) => {
      setSelectedHealth((current) => {
        if (checked) {
          return current.includes(health) ? current : [...current, health]
        }

        return current.filter((item) => item !== health)
      })
    },
    []
  )

  const handleToggleGroups = useCallback(() => {
    setExpandedRows(
      allGroupsExpanded ? {} : getExpandedRegionState(groupedRows)
    )
  }, [allGroupsExpanded, groupedRows])

  const handleAccountAction = useCallback(
    (action: AccountAction, account: Account) => {
      if (action === "open") {
        toast.info("View account", {
          description: `${account.name} / ${account.industry}`,
        })
        return
      }

      if (action === "copy") {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          void navigator.clipboard.writeText(account.name)
        }

        toast.success("Account name copied", {
          description: account.name,
        })
        return
      }

      toast.message("Adjust plan", {
        description: `Connect ${account.name} to your renewal or pricing flow.`,
      })
    },
    []
  )

  const handleExport = useCallback(() => {
    toast.success("Export portfolio", {
      description: "Connect this action to your CSV or warehouse export.",
    })
  }, [])

  const columns = useMemo(
    () =>
      createPortfolioColumns({
        onAction: handleAccountAction,
      }),
    [handleAccountAction]
  )

  const table = useTable({
    features: dataGridFeatures,
    // No pagination row model on v8, so every row rendered. The shared
    // bundle registers one, and manualPagination is v9's way to say the
    // data is already the page - it keeps the pagination APIs while
    // leaving the rows unsliced.
    manualPagination: true,
    data: groupedRows,
    columns,
    getRowId: (row) => row.id,
    getSubRows: (row) =>
      row.kind === "region"
        ? (row.subRows as PortfolioRow[] | undefined)
        : undefined,
    getRowCanExpand: (row) =>
      row.original.kind === "region" && Boolean(row.original.subRows?.length),
    state: {
      columnVisibility,
      expanded: expandedRows,
    },
    onExpandedChange: setExpandedRows,
  })

  function toggleColumn(key: PortfolioColumnKey, checked: boolean) {
    setVisibleColumns((current) => ({
      ...current,
      [key]: checked,
    }))
  }

  function clearFilters() {
    setSearchQuery("")
    setSelectedHealth([])
  }

  // Grand-total footer: one cell per visible column so it tracks column toggles.
  const footerContent =
    filteredAccounts.length > 0 ? (
      <DataGridTableFootRow>
        {table.getVisibleLeafColumns().map((column) => {
          if (column.id === "account") {
            return (
              <DataGridTableFootRowCell key={column.id}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-foreground text-sm font-semibold">
                    All Regions
                  </span>
                  <Badge variant="outline" className="tabular-nums">
                    {filteredAccounts.length}
                  </Badge>
                </div>
              </DataGridTableFootRowCell>
            )
          }

          if (column.id === "arr") {
            return (
              <DataGridTableFootRowCell key={column.id} className="text-right!">
                <span className="text-foreground text-sm font-semibold tabular-nums">
                  {formatCurrency(totalArr)}
                </span>
              </DataGridTableFootRowCell>
            )
          }

          if (column.id === "nrr") {
            return (
              <DataGridTableFootRowCell key={column.id} className="text-right!">
                <div className="flex w-full items-center justify-end">
                  <NrrValue value={portfolioNrr} />
                </div>
              </DataGridTableFootRowCell>
            )
          }

          return <DataGridTableFootRowCell key={column.id} />
        })}
      </DataGridTableFootRow>
    ) : undefined

  return (
    <DataGrid
      table={table}
      recordCount={filteredAccounts.length}
      emptyMessage="No accounts match this view."
      tableLayout={{
        dense: tableDensity === "compact",
        rowBorder: true,
        footerBackground: true,
        columnsVisibility: false,
        columnsResizable: false,
        columnsMovable: false,
        width: "fixed",
      }}
      tableClassNames={{
        body: "[&>tr:has([data-portfolio-row=region])+tr:has(>td:only-child:empty)>td]:!border-b-0",
        bodyRow:
          "group/portfolio-row [&>td]:h-11 [&:has([data-portfolio-row=region])>td]:h-11",
        edgeCell: "first:ps-3 last:pe-3 lg:first:ps-4 lg:last:pe-4",
      }}
    >
      <section className="flex w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <Frame>
          {/* Header */}
          <FrameHeader className="flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <FrameTitle>Revenue By Region</FrameTitle>
              <FrameDescription>
                Net retention and renewals across the book.
              </FrameDescription>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <PortfolioMetric
                label="Total ARR"
                value={formatCompactCurrency(totalArr)}
                variant="outline"
              />
              <PortfolioMetric
                label="Portfolio NRR"
                value={`${portfolioNrr}%`}
                variant={
                  portfolioNrr >= 100 ? "success-light" : "warning-light"
                }
              />
              <PortfolioMetric
                label="At-Risk ARR"
                value={formatCompactCurrency(atRiskArr)}
                variant={atRiskArr > 0 ? "destructive-light" : "secondary"}
              />
              <Button type="button" variant="outline" onClick={handleExport}>
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                Export
              </Button>
            </div>
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
                  placeholder="Search accounts..."
                  aria-label="Search accounts"
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
                        <ActivityIcon data-icon="inline-start" aria-hidden="true" />
                        Health
                        {activeFilterCount > 0 ? (
                          <Badge variant="secondary">{activeFilterCount}</Badge>
                        ) : null}
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="min-w-48">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Account health</DropdownMenuLabel>
                      {ACCOUNT_HEALTH_OPTIONS.map((health) => (
                        <DropdownMenuCheckboxItem
                          key={health}
                          checked={selectedHealth.includes(health)}
                          closeOnClick={false}
                          onCheckedChange={(checked) =>
                            handleHealthToggle(health, checked === true)
                          }
                        >
                          {health}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuGroup>
                    {activeFilterCount > 0 ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          closeOnClick={false}
                          onClick={() => setSelectedHealth([])}
                        >
                          Reset health
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Popover>
                  <PopoverTrigger
                    render={
                      <Button type="button" variant="outline">
                        <Settings2Icon data-icon="inline-start" aria-hidden="true" />
                        Display
                      </Button>
                    }
                  />
                  <PopoverContent align="end" className="w-[300px] p-0">
                    <FieldGroup className="gap-3 px-3.5 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="text-muted-foreground text-xs font-medium">
                          Table
                        </div>
                        <Field
                          orientation="horizontal"
                          className="min-h-9 items-center justify-between gap-3"
                        >
                          <FieldLabel className="text-sm font-normal">
                            Density
                          </FieldLabel>
                          <Select
                            value={tableDensity}
                            onValueChange={(value) =>
                              setTableDensity(value as TableDensity)
                            }
                          >
                            <SelectTrigger
                              size="sm"
                              className="w-[132px] shrink-0"
                            >
                              <SelectValue>
                                {
                                  TABLE_DENSITY_OPTIONS.find(
                                    (option) => option.value === tableDensity
                                  )?.label
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent align="end">
                              <SelectGroup>
                                {TABLE_DENSITY_OPTIONS.map((option) => (
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
                      </div>

                      <FieldSeparator className="-mx-3.5" />

                      <div className="flex flex-col gap-2">
                        <div className="text-muted-foreground text-xs font-medium">
                          Display properties
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {DISPLAY_COLUMN_OPTIONS.map((option) => {
                            const active = visibleColumns[option.key]

                            return (
                              <Button
                                key={option.key}
                                type="button"
                                size="sm"
                                variant={active ? "secondary" : "outline"}
                                className={cn(
                                  "rounded-full",
                                  active && "border-foreground/10"
                                )}
                                aria-pressed={active}
                                onClick={() =>
                                  toggleColumn(option.key, !active)
                                }
                              >
                                {active ? (
                                  <CheckIcon className="size-4" aria-hidden="true" />
                                ) : null}
                                {option.label}
                              </Button>
                            )
                          })}
                        </div>
                      </div>
                    </FieldGroup>
                  </PopoverContent>
                </Popover>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleToggleGroups}
                >
                  {allGroupsExpanded ? "Collapse all" : "Expand all"}
                </Button>

                {searchQuery.length > 0 || selectedHealth.length > 0 ? (
                  <Button type="button" variant="ghost" onClick={clearFilters}>
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Grouped grid */}
            <DataGridContainer>
              <DataGridScrollArea>
                <DataGridTable footerContent={footerContent} />
              </DataGridScrollArea>
            </DataGridContainer>
          </FramePanel>
        </Frame>
      </section>
    </DataGrid>
  )
}