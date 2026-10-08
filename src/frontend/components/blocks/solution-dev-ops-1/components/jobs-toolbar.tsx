"use client"

// Reads the TanStack table instance directly, which React Compiler cannot see.
"use no memo"

import { type RefObject } from "react"
import { Badge } from "@/components/reui/badge"
import {
  getColumnHeaderLabel,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid"
import { Filters } from "@/components/reui/filters/filters"
import { countFilterRules } from "@/components/reui/filters/filters-query"
import { type FilterQuery } from "@/components/reui/filters/filters-types"
import { type Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
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
import { Switch } from "@/components/ui/switch"
import { DENSITY_OPTIONS, type CronJob, type Density } from "./data"
import { UI_ICONS } from "./icons"
import { COMPACT_OPERATORS, JOB_FILTER_FIELDS } from "./job-filters"
import { ListFilterIcon, Settings2Icon } from "lucide-react"

/** Search and Filters above the jobs grid; Display sits in the section header. */
export function JobsToolbar({
  search,
  onSearchChange,
  searchRef,
  filterQuery,
  onFilterQueryChange,
}: {
  search: string
  onSearchChange: (value: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  filterQuery: FilterQuery
  onFilterQueryChange: (next: FilterQuery) => void
}) {
  const ruleCount = countFilterRules(filterQuery)

  return (
    <div className="flex items-center gap-2 px-(--frame-panel-header-px) py-(--frame-panel-header-py)">
      <InputGroup className="min-w-0 flex-1 sm:max-w-64">
        <InputGroupAddon align="inline-start">
          {UI_ICONS.search}
        </InputGroupAddon>
        <InputGroupInput
          ref={searchRef}
          placeholder="Search jobs or commands..."
          aria-label="Search jobs"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {search.length > 0 && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label="Clear search"
              size="icon-xs"
              onClick={() => {
                onSearchChange("")
                searchRef.current?.focus()
              }}
            >
              {UI_ICONS.close}
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>

      <div className="ms-auto flex shrink-0 items-center gap-2">
        {/* Own trigger: the stock one always prints its label, so it
            could not go icon-only below sm. Widths fit COMPACT_OPERATORS. */}
        <Filters
          variant="advanced"
          advancedMode="popover"
          advancedAlign="end"
          size="sm"
          fields={JOB_FILTER_FIELDS}
          operatorLabels={COMPACT_OPERATORS}
          className="w-lg [--filter-field-width:7.5rem] [--filter-operator-width:6.5rem] [--filter-value-width:8rem]"
          query={filterQuery}
          onQueryChange={onFilterQueryChange}
          trigger={
            <Button
              type="button"
              variant="outline"
              aria-label={
                ruleCount > 0
                  ? `Filter, ${ruleCount} ${ruleCount === 1 ? "rule" : "rules"}`
                  : "Filter"
              }
            >
              <ListFilterIcon aria-hidden="true" />
              <span className="max-sm:sr-only">Filter</span>
              {ruleCount > 0 ? (
                <Badge variant="outline" radius="full" className="tabular-nums">
                  {ruleCount}
                </Badge>
              ) : null}
            </Button>
          }
        />
      </div>
    </div>
  )
}

/** The grid's view controls: density, stripes and column visibility.
 *  "Display", not "Settings": the job sheet owns a Settings tab. */
export function JobsDisplayPopover({
  table,
  density,
  onDensityChange,
  striped,
  onStripedChange,
}: {
  table: Table<DataGridFeatures, CronJob>
  density: Density
  onDensityChange: (next: Density) => void
  striped: boolean
  onStripedChange: (next: boolean) => void
}) {
  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline" />}>
        <Settings2Icon aria-hidden="true" />
        <span className="max-sm:sr-only">Display</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <FieldSet className="gap-3">
          <FieldLegend variant="label">Table</FieldLegend>
          <FieldGroup className="gap-3">
            <Field orientation="horizontal">
              <FieldLabel htmlFor="devops-1-density">Density</FieldLabel>
              <Select
                value={density}
                items={DENSITY_OPTIONS}
                onValueChange={(next) => {
                  const option = DENSITY_OPTIONS.find(
                    (item) => item.value === next
                  )
                  if (option) onDensityChange(option.value)
                }}
              >
                <SelectTrigger id="devops-1-density" size="sm" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end" alignItemWithTrigger={false}>
                  <SelectGroup>
                    {DENSITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="devops-1-striped">Striped rows</FieldLabel>
              <Switch
                id="devops-1-striped"
                size="sm"
                checked={striped}
                onCheckedChange={onStripedChange}
              />
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
                  <FieldLabel htmlFor={`devops-1-column-${column.id}`}>
                    {getColumnHeaderLabel(column)}
                  </FieldLabel>
                  <Switch
                    id={`devops-1-column-${column.id}`}
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
  )
}