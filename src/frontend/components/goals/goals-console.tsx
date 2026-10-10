/**
 * @fileoverview `/goals` — the Goals console island (maestro cs-fe-2-1).
 *
 * Adapted from the ReUI Pro block `solution-dev-ops-1` (its cron-job console:
 * the enable switch, row selection with a bulk bar, the health strip) over the
 * tree spine `/tasks` already uses, with the ReUI Filters builder for the
 * advanced query. Nothing here is demo data: every row, count and group comes
 * from `GET /api/goals`.
 *
 * Endpoints: `GET /api/goals` (list, with `q`, `filter`, `group_by=category`,
 * `sort`, `page`, `page_size`), `POST /api/goals/{id}/pause` and
 * `POST /api/goals/{id}/resume`.
 *
 * What rides on the API rather than on this file, because the envelope's
 * `total` and `groups` have to describe the view on screen:
 *
 * - the health tabs are real `filter` trees, not a client-side slice
 * - grouping is `group_by=category`, so a category header's count is the whole
 *   result set while its children are one page
 * - the whole view round-trips through the URL, so a filtered, grouped,
 *   sorted console is a pasteable link
 *
 * Surface is `frame` — one surface for the screen, per the design system.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterIcon, PauseIcon, PlayIcon, SearchIcon, Settings2Icon, TargetIcon, XIcon } from "lucide-react";
import {
  useTable,
  type ColumnVisibilityState,
  type ExpandedState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";

import { Badge } from "@/components/reui/badge";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Filters } from "@/components/reui/filters/filters";
import { createFilterQuery } from "@/components/reui/filters/filters-query";
import type { FilterField } from "@/components/reui/filters/filters-types";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { OptionSelect } from "@/components/ui/option-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/common/shared";
import { ApiError, apiSend } from "@/lib/api";
import { countRules, toFilterFields } from "@/lib/filters";
import { buildListParams, parseListParams, DEFAULT_PAGE_SIZE } from "@/lib/list-query";
import type { ListEnvelope } from "@/lib/list-query";
import { fetchList } from "@/lib/list-fetch";
import { GOAL_LIST_FIELDS, type FilterQuery, type GoalListRow } from "@/shared/contracts";
import { cn } from "@/lib/utils";

import { createGoalColumns, type GoalRowAction } from "./goal-columns";
import {
  buildGoalRows,
  expandAllCategories,
  GOAL_HEALTH_TABS,
  healthFilterQuery,
  mergeFilterQueries,
  rollUpGoals,
  withGoalStatus,
  type GoalHealthTab,
  type GoalRow,
} from "./goal-rows";

type TableDensity = "compact" | "comfortable";

const DENSITY_OPTIONS: { value: TableDensity; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
];

const TAB_LABELS: Record<GoalHealthTab, string> = {
  all: "All",
  healthy: "Healthy",
  stale: "Stale",
  paused: "Paused",
};

const COLUMN_OPTIONS = [
  { key: "schedule_hint", label: "Schedule" },
  { key: "last_run_at", label: "Last run" },
  { key: "next_expected_at", label: "Next expected" },
  { key: "runs_count", label: "Runs" },
  { key: "findings_count", label: "Findings" },
  { key: "accept_rate", label: "Accept rate" },
  { key: "budget_max_cents", label: "Budget" },
] as const;

// ponytail: ReUI's editor registry is text / number / range / select /
// multiselect / boolean — there is no date editor — so a `type: "date"` field
// would draw a chip with nothing to edit it with. GOAL_LIST_FIELDS' one date
// field is last_run_at, and the health tabs already answer the question it
// would be used for. A date editor belongs in the foundation epic (cs-fe-0-4),
// not in this console; until then the builder offers the fields it can edit.
// The cast is for `type?: string` in the shared spec vs ReUI's own union.
const BUILDER_FIELDS = toFilterFields(
  Object.fromEntries(Object.entries(GOAL_LIST_FIELDS).filter(([, spec]) => spec.type !== "date")),
) as unknown as FilterField[];

/** One figure in the console header. */
function HeaderMetric({
  label,
  value,
  variant = "outline",
}: {
  label: string;
  value: string;
  variant?: "outline" | "warning-light" | "secondary";
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 sm:border-l sm:pl-3 sm:first:border-l-0 sm:first:pl-0">
      <span className="text-muted-foreground truncate text-xs font-medium">{label}</span>
      <Badge variant={variant} className="tabular-nums">
        {value}
      </Badge>
    </div>
  );
}

/** The Goals console: every standing shopping brief, grouped by category. */
export function GoalsConsole() {
  const initial = useMemo(
    () =>
      typeof window === "undefined"
        ? { page: 1, page_size: DEFAULT_PAGE_SIZE }
        : parseListParams(new URLSearchParams(window.location.search)),
    [],
  );

  const [tab, setTab] = useState<GoalHealthTab>(() => {
    const raw = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("health");
    return GOAL_HEALTH_TABS.includes(raw as GoalHealthTab) ? (raw as GoalHealthTab) : "all";
  });
  const [searchInput, setSearchInput] = useState(initial.q ?? "");
  const [query, setQuery] = useState(initial.q ?? "");
  // Always a group, never undefined: `Filters` is controlled through `query`,
  // and handing it undefined would quietly make it uncontrolled. An empty
  // group filters nothing — `buildListParams` prunes it off the wire.
  const [userFilter, setUserFilter] = useState<FilterQuery>(
    () => initial.filter ?? (createFilterQuery() as unknown as FilterQuery),
  );
  const [sort, setSort] = useState<string | undefined>(initial.sort);
  const [page, setPage] = useState(initial.page ?? 1);

  const [items, setItems] = useState<GoalListRow[]>([]);
  const [groups, setGroups] = useState<Array<{ key: string | null; count: number }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [density, setDensity] = useState<TableDensity>("comfortable");
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const isDense = density === "compact";

  // Searching is debounced so a keystroke is not a request; everything else
  // applies at once, because a tab or a filter is a deliberate act.
  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const listState = useMemo(
    () => ({
      q: query,
      filter: mergeFilterQueries(healthFilterQuery(tab), userFilter),
      group_by: "category",
      sort,
      page,
    }),
    [query, tab, userFilter, sort, page],
  );

  const params = useMemo(() => buildListParams(listState), [listState]);

  // The URL carries the view so it can be pasted. The health tab is a UI
  // concept, not a list parameter, so it rides alongside rather than inside the
  // filter it expands to.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = new URLSearchParams(params);
    if (tab !== "all") next.set("health", tab);
    // group_by is implicit on this screen; keeping it out of the URL keeps a
    // shared link readable.
    next.delete("group_by");
    const search = next.toString();
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  }, [params, tab]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchList<GoalListRow>("/api/goals", params)
      .then((res: ListEnvelope<GoalListRow>) => {
        if (cancelled) return;
        setItems(res.items);
        setGroups(res.groups ?? []);
        setTotal(res.total);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Could not load goals.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params, reloadToken]);

  const rows = useMemo(() => buildGoalRows(items, groups), [items, groups]);
  const totals = useMemo(() => rollUpGoals(rows), [rows]);

  // Every category opens by default: a collapsed console hides the goals it
  // exists to list. Adjusted during render so `expanded` stays the table's one
  // source of truth and a hand toggle survives.
  const rowsKey = rows.map((row) => `${row.id}:${row.children.length}`).join("|");
  const [appliedRowsKey, setAppliedRowsKey] = useState("");
  if (appliedRowsKey !== rowsKey) {
    setAppliedRowsKey(rowsKey);
    setExpanded(expandAllCategories(rows));
    setRowSelection({});
  }

  const setStatus = useCallback((goal: GoalListRow, status: "active" | "paused") => {
    setActionError(null);
    const previous = goal.status;
    // Optimistic: the switch moves now, and a rejected call puts it back.
    setItems((current) => withGoalStatus(current, goal.id, status));
    apiSend("POST", `goals/${goal.id}/${status === "active" ? "resume" : "pause"}`).catch((e) => {
      setItems((current) => withGoalStatus(current, goal.id, previous));
      setActionError(
        e instanceof ApiError
          ? e.message
          : `Could not ${status === "active" ? "resume" : "pause"} "${goal.title}".`,
      );
    });
  }, []);

  const handleAction = useCallback(
    (action: GoalRowAction) => {
      if (action.kind === "open") {
        window.location.href = `/goals/${action.goal.slug}`;
        return;
      }
      setStatus(action.goal, action.status);
    },
    [setStatus],
  );

  const columns = useMemo(
    () => createGoalColumns({ dense: isDense, onAction: handleAction }),
    [isDense, handleAction],
  );

  const pagination = useMemo(
    () => ({ pageIndex: page - 1, pageSize: DEFAULT_PAGE_SIZE }),
    [page],
  );

  const table = useTable({
    features: dataGridFeatures,
    // The server already paged and sorted; this is that page. Both are manual
    // so the grid never reorders or re-slices one page as though it had the set.
    manualPagination: true,
    manualSorting: true,
    rowCount: total,
    pageCount: Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE)),
    data: rows as GoalRow[],
    columns,
    getRowId: (row) => row.id,
    getSubRows: (row) => (row.kind === "category" ? row.children : undefined),
    getRowCanExpand: (row) => row.original.kind === "category",
    // A category header is a heading, not a goal: selecting it selects its
    // goals, which is what the bulk bar acts on.
    enableRowSelection: (row) => row.original.kind === "goal",
    state: { columnVisibility, expanded, sorting, rowSelection, pagination },
    onPaginationChange: (next) => {
      const resolved = typeof next === "function" ? next(pagination) : next;
      setPage(resolved.pageIndex + 1);
    },
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onSortingChange: (next) => {
      setSorting(next);
      const resolved = typeof next === "function" ? next(sorting) : next;
      const [first] = resolved;
      setSort(first ? `${first.desc ? "-" : ""}${first.id}` : undefined);
      setPage(1);
    },
  });

  const selectedGoals = useMemo(() => {
    const byId = new Map(items.map((goal) => [goal.id, goal]));
    return Object.keys(rowSelection)
      .filter((id) => rowSelection[id])
      .map((id) => byId.get(id))
      .filter((goal): goal is GoalListRow => Boolean(goal));
  }, [rowSelection, items]);

  const bulk = useCallback(
    (status: "active" | "paused") => {
      for (const goal of selectedGoals) {
        if (goal.status === "retired" || goal.status === status) continue;
        setStatus(goal, status);
      }
      setRowSelection({});
    },
    [selectedGoals, setStatus],
  );

  const ruleCount = countRules(userFilter);
  const isFiltered = query.length > 0 || ruleCount > 0 || tab !== "all";

  function clearView() {
    setSearchInput("");
    setQuery("");
    setUserFilter(createFilterQuery() as unknown as FilterQuery);
    setTab("all");
    setPage(1);
  }

  return (
    <DataGrid
      table={table}
      recordCount={total}
      emptyMessage="No goals match this view."
      tableLayout={{
        dense: isDense,
        rowBorder: true,
        columnsVisibility: true,
        columnsResizable: true,
        columnsMovable: true,
        width: "fixed",
      }}
      tableClassNames={{
        bodyRow: isDense ? "[&>td]:h-10" : "[&>td]:h-12",
        edgeCell: "first:ps-3 last:pe-3 lg:first:ps-4 lg:last:pe-4",
      }}
    >
      <Frame className="min-w-0">
        <FrameHeader className="flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col">
            <FrameTitle>Goals</FrameTitle>
            <FrameDescription>
              Every standing brief your shopper agents work, grouped by category.
            </FrameDescription>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <HeaderMetric label="Goals" value={total.toLocaleString("en-US")} />
            <HeaderMetric label="Runs" value={totals.runs.toLocaleString("en-US")} />
            <HeaderMetric label="Findings" value={totals.findings.toLocaleString("en-US")} />
            <HeaderMetric
              label="Stale"
              value={totals.stale.toLocaleString("en-US")}
              variant={totals.stale > 0 ? "warning-light" : "outline"}
            />
          </div>
        </FrameHeader>

        <FramePanel className="bg-card p-0! shadow-none!">
          <div className="flex flex-col gap-3 border-b px-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-4">
            <Tabs
              value={tab}
              onValueChange={(value) => {
                setTab(value as GoalHealthTab);
                setPage(1);
              }}
            >
              <TabsList>
                {GOAL_HEALTH_TABS.map((value) => (
                  <TabsTrigger key={value} value={value}>
                    {TAB_LABELS[value]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:justify-end">
              <InputGroup className="w-full min-w-0 lg:max-w-xs">
                <InputGroupAddon align="inline-start">
                  <SearchIcon className="text-muted-foreground size-4" aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search goals..."
                  aria-label="Search goals"
                />
                {searchInput.length > 0 ? (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label="Clear search"
                      onClick={() => setSearchInput("")}
                    >
                      <XIcon className="size-4" aria-hidden="true" />
                    </InputGroupButton>
                  </InputGroupAddon>
                ) : null}
              </InputGroup>

              <Filters
                fields={BUILDER_FIELDS}
                query={userFilter as never}
                onQueryChange={(next) => {
                  setUserFilter(next as unknown as FilterQuery);
                  setPage(1);
                }}
                variant="advanced"
                size="default"
                trigger={
                  <Button variant="outline" aria-label="Filters">
                    <FilterIcon aria-hidden="true" />
                    Filters
                    {ruleCount > 0 ? (
                      <Badge variant="secondary" className="tabular-nums">
                        {ruleCount}
                      </Badge>
                    ) : null}
                  </Button>
                }
              />

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
                    <div className="text-muted-foreground text-xs font-medium">Table</div>
                    <Field
                      orientation="horizontal"
                      className="min-h-9 items-center justify-between gap-3"
                    >
                      <FieldLabel className="text-sm font-normal">Density</FieldLabel>
                      <OptionSelect
                        value={density}
                        onChange={setDensity}
                        options={DENSITY_OPTIONS}
                        ariaLabel="Table density"
                      />
                    </Field>
                    <div className="text-muted-foreground pt-1 text-xs font-medium">Columns</div>
                    <div className="flex flex-wrap gap-1.5">
                      {COLUMN_OPTIONS.map((option) => {
                        const active = columnVisibility[option.key] !== false;
                        return (
                          <Button
                            key={option.key}
                            type="button"
                            size="sm"
                            variant={active ? "secondary" : "outline"}
                            className={cn("rounded-full", active && "border-foreground/10")}
                            aria-pressed={active}
                            onClick={() =>
                              setColumnVisibility((current) => ({
                                ...current,
                                [option.key]: !active,
                              }))
                            }
                          >
                            {option.label}
                          </Button>
                        );
                      })}
                    </div>
                  </FieldGroup>
                </PopoverContent>
              </Popover>

              {isFiltered ? (
                <Button type="button" variant="ghost" onClick={clearView}>
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {selectedGoals.length > 0 ? (
            <div className="bg-muted/40 flex flex-wrap items-center gap-2 border-b px-3 py-2 lg:px-4">
              <span className="text-foreground text-sm font-medium tabular-nums">
                {`${selectedGoals.length} selected`}
              </span>
              <span className="grow" />
              <Button type="button" size="sm" variant="outline" onClick={() => bulk("paused")}>
                <PauseIcon aria-hidden="true" />
                Pause
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => bulk("active")}>
                <PlayIcon aria-hidden="true" />
                Resume
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setRowSelection({})}>
                Clear selection
              </Button>
            </div>
          ) : null}

          {error ? (
            <div className="p-4">
              <ErrorState message={error} onRetry={() => setReloadToken((n) => n + 1)} />
            </div>
          ) : null}
          {actionError ? (
            <div className="px-4 pt-4">
              <ErrorState message={actionError} />
            </div>
          ) : null}

          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !error && items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<TargetIcon />}
                title={isFiltered ? "No goals match this view" : "No goals yet"}
                description={
                  isFiltered
                    ? "Clear the filters, or widen the health tab, to see the rest."
                    : "A goal is a standing brief: what to look for, the budget, the window, and the rules an agent may break. Create one to start a search."
                }
                action={
                  isFiltered ? (
                    <Button type="button" variant="outline" onClick={clearView}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <DataGridContainer>
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
            </DataGridContainer>
          )}
        </FramePanel>

        {items.length > 0 ? (
          <FrameFooter>
            <DataGridPagination />
          </FrameFooter>
        ) : null}
      </Frame>
    </DataGrid>
  );
}
