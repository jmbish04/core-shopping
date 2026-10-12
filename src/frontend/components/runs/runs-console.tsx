/**
 * @fileoverview `/runs` — the Runs queue island (maestro cs-fe-10-1).
 *
 * Adapted from the ReUI Pro block `solution-agents-2` (its run queue: runs
 * grouped by status with header counts, a search box, an attention filter and
 * a queue-mix footer), over the server-side list engine the Goals console
 * already uses. Nothing here is demo data: every row, count and group comes
 * from `GET /api/runs` with `group_by=status`.
 *
 * Removed from the stock block because nothing backs them: owners, step
 * progress, the "New run", retry and pause actions, and the "Live" pulse (this
 * screen loads on demand; it does not stream).
 *
 * The view — search, attention, client, goal, page — round-trips through the
 * URL, so a filtered queue is a pasteable link. Surface is `frame`.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { BellIcon, PlayIcon, SearchIcon, XIcon } from "lucide-react";
import { useTable, type ExpandedState } from "@tanstack/react-table";

import { Badge } from "@/components/reui/badge";
import { DataGrid, DataGridContainer, dataGridFeatures } from "@/components/reui/data-grid/data-grid";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { FilterSelect } from "@/components/ui/option-select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/shared";
import { ApiError } from "@/lib/api";
import { fetchList } from "@/lib/list-fetch";
import { buildListParams, DEFAULT_PAGE_SIZE, type ListEnvelope } from "@/lib/list-query";
import { AGENT_CLIENTS, type GoalListRow } from "@/shared/contracts";

import { createRunColumns } from "./run-columns";
import {
  buildRunRows,
  CLIENT_LABELS,
  parseRunQueueView,
  RUN_ATTENTION,
  RUN_ATTENTION_LABELS,
  RUN_STATUS_ORDER,
  runQueueFilter,
  serializeRunQueueView,
  statusCount,
  type RunAttention,
  type RunListRow,
  type RunQueueView,
  type RunRow,
} from "./run-rows";

const CLIENT_OPTIONS = AGENT_CLIENTS.map((value) => ({ value, label: CLIENT_LABELS[value] }));

const STATUS_LABEL: Record<(typeof RUN_STATUS_ORDER)[number], string> = {
  running: "Running",
  failed: "Failed",
  succeeded: "Succeeded",
  abandoned: "Abandoned",
};

/** One figure in the queue header. */
function HeaderMetric({
  label,
  value,
  variant = "outline",
}: {
  label: string;
  value: number;
  variant?: "outline" | "info-light" | "destructive-light";
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 sm:border-l sm:pl-3 sm:first:border-l-0 sm:first:pl-0">
      <span className="text-muted-foreground truncate text-xs font-medium">{label}</span>
      <Badge variant={variant} className="tabular-nums">
        {value.toLocaleString("en-US")}
      </Badge>
    </div>
  );
}

/** The Runs queue: every agent run, grouped by status for triage. */
export function RunsConsole() {
  const initial = useMemo<RunQueueView>(
    () =>
      typeof window === "undefined"
        ? { q: "", attention: [], client: undefined, goalId: undefined, page: 1 }
        : parseRunQueueView(new URLSearchParams(window.location.search), AGENT_CLIENTS),
    [],
  );

  const [searchInput, setSearchInput] = useState(initial.q);
  const [query, setQuery] = useState(initial.q);
  const [attention, setAttention] = useState<RunAttention[]>(initial.attention);
  const [client, setClient] = useState(initial.client);
  const [goalId, setGoalId] = useState(initial.goalId);
  const [page, setPage] = useState(initial.page);

  const [items, setItems] = useState<RunListRow[]>([]);
  const [groups, setGroups] = useState<Array<{ key: string | null; count: number }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [goals, setGoals] = useState<GoalListRow[]>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Debounced so a keystroke is not a request.
  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const view = useMemo<RunQueueView>(
    () => ({ q: query, attention, client, goalId, page }),
    [query, attention, client, goalId, page],
  );

  const params = useMemo(
    () => buildListParams({ q: view.q, filter: runQueueFilter(view), group_by: "status", page: view.page }),
    [view],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = serializeRunQueueView(view);
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  }, [view]);

  // Goal titles, for the goal filter and each run's context line. One page of
  // up to 200 goals; a goal past that still filters by id from a pasted link.
  useEffect(() => {
    let cancelled = false;
    fetchList<GoalListRow>("/api/goals", { page_size: "200", sort: "title" })
      .then((res) => {
        if (!cancelled) setGoals(res.items);
      })
      .catch(() => {
        // The queue still works without titles; the goal filter just has no options.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchList<RunListRow>("/api/runs", params)
      .then((res: ListEnvelope<RunListRow>) => {
        if (cancelled) return;
        setItems(res.items);
        setGroups(res.groups ?? []);
        setTotal(res.total);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Could not load runs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params, reloadToken]);

  const rows = useMemo(() => buildRunRows(items, groups), [items, groups]);
  const goalTitles = useMemo(() => new Map(goals.map((g) => [g.id, g.title])), [goals]);
  const goalOptions = useMemo(() => goals.map((g) => ({ value: g.id, label: g.title })), [goals]);

  // Every status opens by default; adjusted during render so a hand toggle survives.
  const rowsKey = rows.map((row) => `${row.id}:${row.children.length}`).join("|");
  const [appliedRowsKey, setAppliedRowsKey] = useState("");
  if (appliedRowsKey !== rowsKey) {
    setAppliedRowsKey(rowsKey);
    setExpanded(Object.fromEntries(rows.map((row) => [row.id, true])));
  }

  const columns = useMemo(() => createRunColumns({ goalTitles }), [goalTitles]);
  const pagination = useMemo(() => ({ pageIndex: page - 1, pageSize: DEFAULT_PAGE_SIZE }), [page]);

  const table = useTable({
    features: dataGridFeatures,
    manualPagination: true,
    manualSorting: true,
    rowCount: total,
    pageCount: Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE)),
    data: rows as RunRow[],
    columns,
    getRowId: (row) => row.id,
    getSubRows: (row) => (row.kind === "status" ? row.children : undefined),
    getRowCanExpand: (row) => row.original.kind === "status",
    state: { expanded, pagination },
    onPaginationChange: (next) => {
      const resolved = typeof next === "function" ? next(pagination) : next;
      setPage(resolved.pageIndex + 1);
    },
    onExpandedChange: setExpanded,
  });

  const isFiltered = query.length > 0 || attention.length > 0 || Boolean(client) || Boolean(goalId);
  const running = statusCount(groups, "running");
  const failed = statusCount(groups, "failed");

  function toggleAttention(value: RunAttention, checked: boolean) {
    setAttention((current) =>
      checked ? (current.includes(value) ? current : [...current, value]) : current.filter((a) => a !== value),
    );
    setPage(1);
  }

  function clearView() {
    setSearchInput("");
    setQuery("");
    setAttention([]);
    setClient(undefined);
    setGoalId(undefined);
    setPage(1);
  }

  return (
    <DataGrid
      table={table}
      recordCount={total}
      emptyMessage="No runs match this view."
      tableLayout={{
        dense: true,
        rowBorder: true,
        headerSticky: false,
        columnsVisibility: false,
        columnsResizable: false,
        columnsMovable: false,
        width: "fixed",
      }}
      tableClassNames={{
        bodyRow:
          "[&>td]:h-12 [&:has([data-run-row=group])>td]:h-11 [&:has([data-run-row=group])>td]:bg-muted/45",
        edgeCell: "first:ps-3 last:pe-3 lg:first:ps-4 lg:last:pe-4",
      }}
    >
      <Frame className="min-w-0">
        <FrameHeader className="flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col">
            <FrameTitle>Run queue</FrameTitle>
            <FrameDescription>Every agent run, grouped by status so failures surface first.</FrameDescription>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <HeaderMetric label="Runs" value={total} />
            <HeaderMetric label="Running" value={running} variant={running > 0 ? "info-light" : "outline"} />
            <HeaderMetric label="Failed" value={failed} variant={failed > 0 ? "destructive-light" : "outline"} />
          </div>
        </FrameHeader>

        <FramePanel className="bg-card p-0! shadow-none!">
          <div className="flex flex-col gap-3 border-b px-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-4">
            <InputGroup className="w-full min-w-0 lg:max-w-sm">
              <InputGroupAddon align="inline-start">
                <SearchIcon className="text-muted-foreground size-4" aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setPage(1);
                }}
                placeholder="Search summary or model..."
                aria-label="Search runs"
              />
              {searchInput.length > 0 ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setSearchInput("")}>
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
                      <BellIcon data-icon="inline-start" aria-hidden="true" />
                      Attention
                      {attention.length > 0 ? (
                        <Badge variant="secondary" className="tabular-nums">
                          {attention.length}
                        </Badge>
                      ) : null}
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="min-w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Needs attention</DropdownMenuLabel>
                    {RUN_ATTENTION.map((value) => (
                      <DropdownMenuCheckboxItem
                        key={value}
                        checked={attention.includes(value)}
                        closeOnClick={false}
                        onCheckedChange={(checked) => toggleAttention(value, checked === true)}
                      >
                        {RUN_ATTENTION_LABELS[value]}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                  {attention.length > 0 ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        closeOnClick={false}
                        onClick={() => {
                          setAttention([]);
                          setPage(1);
                        }}
                      >
                        Reset attention
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>

              <FilterSelect
                value={client}
                onChange={(next) => {
                  setClient(next);
                  setPage(1);
                }}
                options={CLIENT_OPTIONS}
                allLabel="All agents"
                ariaLabel="Filter by agent"
                size="default"
                className="w-[140px]"
              />

              <FilterSelect
                value={goalId}
                onChange={(next) => {
                  setGoalId(next);
                  setPage(1);
                }}
                options={goalOptions}
                allLabel="All goals"
                ariaLabel="Filter by goal"
                size="default"
                className="w-[180px]"
              />

              {isFiltered ? (
                <Button type="button" variant="ghost" onClick={clearView}>
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="p-4">
              <ErrorState message={error} onRetry={() => setReloadToken((n) => n + 1)} />
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
                icon={<PlayIcon />}
                title={isFiltered ? "No runs match this view" : "No runs yet"}
                description={
                  isFiltered
                    ? "Clear the search or filters to see the rest of the queue."
                    : "A run is one agent session working a goal. Runs appear here as soon as an agent reports one."
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
          ) : !error ? (
            <DataGridContainer>
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
            </DataGridContainer>
          ) : null}
        </FramePanel>

        {items.length > 0 ? (
          <FrameFooter className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
              <span className="text-foreground font-medium">Queue mix</span>
              {RUN_STATUS_ORDER.map((status) => (
                <Badge key={status} variant="outline" className="tabular-nums">
                  {STATUS_LABEL[status]}: {statusCount(groups, status).toLocaleString("en-US")}
                </Badge>
              ))}
            </div>
            <DataGridPagination />
          </FrameFooter>
        ) : null}
      </Frame>
    </DataGrid>
  );
}
