/**
 * @fileoverview Columns for the Goals console (maestro cs-fe-2-1).
 *
 * Adapted from the ReUI Pro block `solution-dev-ops-1` (its cron-job grid: the
 * enable switch, the row-select column, the health faces) nested with the tree
 * spine this repo already uses in `/tasks` — `DataGridTableRowExpand` plus the
 * leaf spacer, so a category header and a goal share one label spine.
 *
 * Every figure is a field of `GET /api/goals`. Two renderings are load-bearing
 * and are pinned by `scripts/selfcheck-goals-console.mjs`:
 *
 * - `accept_rate` of null renders as an em dash, never 0%. No proposal has
 *   been reviewed yet, which is not the same as none being accepted.
 * - a goal that has never run shows an em dash for its last run and is not
 *   drawn as stale.
 */

import {
  CalendarClockIcon,
  CircleSlashIcon,
  CompassIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  PauseIcon,
  PlayIcon,
  TargetIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { ColumnDef, Row } from "@tanstack/react-table";

import { Badge } from "@/components/reui/badge";
import type { DataGridFeatures } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import {
  DataGridTableRowExpand,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table";
import { IconTile } from "@/components/reui/icon-tile";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { optionLabel } from "@/lib/filters";
import { money, moneyRange, percent, relativeTime, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { GoalCategoryRow, GoalHealth, GoalItemRow, GoalRow } from "./goal-rows";

/** What a row can ask the console to do. */
export type GoalRowAction =
  | { kind: "open"; goal: GoalItemRow["goal"] }
  | { kind: "status"; goal: GoalItemRow["goal"]; status: "active" | "paused" };

/** Depth indent per tree level, in px — the data-grid primitive's own default. */
const TREE_INDENT = 20;

const HEALTH_BADGE: Record<GoalHealth, { label: string; variant: string }> = {
  healthy: { label: "Healthy", variant: "success-light" },
  stale: { label: "Stale", variant: "warning-light" },
  paused: { label: "Paused", variant: "secondary" },
  retired: { label: "Retired", variant: "outline" },
};

/** Status options for the toolbar's select, in workflow order. */
export const GOAL_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "retired", label: "Retired" },
] as const;

export const GOAL_CATEGORY_OPTIONS = [
  { value: "experience", label: "Experience" },
  { value: "travel", label: "Travel" },
  { value: "product", label: "Product" },
  { value: "gift", label: "Gift" },
  { value: "deal", label: "Deal" },
  { value: "research", label: "Research" },
] as const;

const isCategory = (row: GoalRow): row is GoalCategoryRow => row.kind === "category";

// Sorting is the SERVER's. `manualSorting` is on in the console, every sort
// leaves as a `sort` parameter, and GOAL_LIST_FIELDS is the only set the API
// accepts. A client sortFn here would be dead code that looks authoritative,
// and would silently reorder ONE PAGE as though it had reordered the result
// set — so a column the API cannot sort does not offer a sort at all.

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

/** An em dash, for every value that is absent rather than zero. */
const EMPTY = "—";

function Numeric({ value, muted }: { value: number | string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "text-sm tabular-nums",
        muted ? "text-muted-foreground" : "text-foreground",
      )}
    >
      {typeof value === "number" ? value.toLocaleString("en-US") : value}
    </span>
  );
}

function TitleCell({ row, dense }: { row: Row<DataGridFeatures, GoalRow>; dense: boolean }) {
  const node = row.original;

  if (isCategory(node)) {
    const loaded = node.children.length;
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex shrink-0 items-center">
          <DataGridTableRowExpand row={row} indent={TREE_INDENT} />
        </span>
        <IconTile variant="elevated" size="xs" aria-hidden="true" className="text-muted-foreground shrink-0">
          <CompassIcon />
        </IconTile>
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-foreground truncate text-sm font-semibold">
            {optionLabel(node.category)}
          </span>
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {/* The server counted the whole result set while `items` is one
                page, so a partial category says so instead of under-reporting. */}
            {node.total !== null && node.total > loaded
              ? `${loaded} of ${node.total}`
              : `${loaded} ${loaded === 1 ? "goal" : "goals"}`}
          </Badge>
          {node.stale > 0 ? (
            <Badge variant="warning-light" className="shrink-0 tabular-nums">
              {`${node.stale} stale`}
            </Badge>
          ) : null}
          {node.paused > 0 ? (
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {`${node.paused} paused`}
            </Badge>
          ) : null}
        </span>
      </div>
    );
  }

  const { goal, health } = node;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex shrink-0 items-center">
        {/* Pads a goal out to the category toggle's width so both share one
            label spine. The toggle is size-7, or size-6 when dense. */}
        <span aria-hidden="true" className={cn("shrink-0", dense ? "w-4" : "w-5")} />
        <span aria-hidden="true" className="w-5 shrink-0" />
      </span>
      <IconTile
        variant="outline"
        size="xs"
        aria-hidden="true"
        className={cn("shrink-0", health === "stale" ? "text-warning" : "text-muted-foreground")}
      >
        {health === "stale" ? <TriangleAlertIcon /> : health === "retired" ? <CircleSlashIcon /> : <TargetIcon />}
      </IconTile>
      <div className="flex min-w-0 flex-col">
        <a
          href={`/goals/${goal.slug}`}
          className={cn(
            "hover:text-primary text-foreground truncate text-sm font-medium transition-colors",
            goal.status !== "active" && "text-muted-foreground",
          )}
        >
          {goal.title}
        </a>
        <span className="text-muted-foreground truncate text-xs">{goal.slug}</span>
      </div>
    </div>
  );
}

function StatusCell({
  node,
  onAction,
}: {
  node: GoalItemRow;
  onAction: (action: GoalRowAction) => void;
}) {
  const { goal, health } = node;
  const badge = HEALTH_BADGE[health];
  return (
    <div className="flex min-w-0 items-center gap-2">
      {/* The hidden input bubbles a click up to the row, which would open the
          goal; stop it here so the switch only ever switches. */}
      <div className="flex" onClick={(event) => event.stopPropagation()}>
        <Switch
          checked={goal.status === "active"}
          disabled={goal.status === "retired"}
          aria-label={goal.status === "active" ? `Pause ${goal.title}` : `Resume ${goal.title}`}
          onCheckedChange={(checked) =>
            onAction({ kind: "status", goal, status: checked ? "active" : "paused" })
          }
        />
      </div>
      <Badge variant={badge.variant as never} className="shrink-0">
        {badge.label}
      </Badge>
    </div>
  );
}

function ActionsCell({
  node,
  onAction,
}: {
  node: GoalItemRow;
  onAction: (action: GoalRowAction) => void;
}) {
  const { goal } = node;
  const paused = goal.status !== "active";
  return (
    <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions for ${goal.title}`}>
              <MoreHorizontalIcon aria-hidden="true" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>{goal.title}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onAction({ kind: "open", goal })}>
              <ExternalLinkIcon aria-hidden="true" />
              Open goal
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={goal.status === "retired"}
              onClick={() =>
                onAction({ kind: "status", goal, status: paused ? "active" : "paused" })
              }
            >
              {paused ? <PlayIcon aria-hidden="true" /> : <PauseIcon aria-hidden="true" />}
              {paused ? "Resume" : "Pause"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

/**
 * Build the Goals console columns.
 *
 * @param options - `dense` tracks the density switch; `onAction` receives every
 *   row-level pause, resume and open.
 * @returns Column definitions for the data grid.
 */
export function createGoalColumns({
  dense,
  onAction,
}: {
  dense: boolean;
  onAction: (action: GoalRowAction) => void;
}): ColumnDef<DataGridFeatures, GoalRow>[] {
  /** Renders nothing on a category header: a roll-up would restate the goals. */
  const goalOnly =
    (render: (node: GoalItemRow) => React.ReactNode) =>
    ({ row }: { row: Row<DataGridFeatures, GoalRow> }) =>
      isCategory(row.original) ? null : render(row.original);

  return [
    {
      id: "select",
      header: () => <DataGridTableRowSelectAll />,
      cell: ({ row }) => (
        <div className="flex" onClick={(event) => event.stopPropagation()}>
          <DataGridTableRowSelect row={row} />
        </div>
      ),
      size: 36,
      enableSorting: false,
      enableResizing: false,
      enableHiding: false,
    },
    {
      id: "title",
      accessorFn: (row) => (isCategory(row) ? row.category : row.goal.title),
      header: ({ column }) => <DataGridColumnHeader title="Goal" column={column} visibility />,
      cell: ({ row }) => <TitleCell row={row} dense={dense} />,
      enableHiding: false,
      enableSorting: true,
      minSize: 280,
      meta: { headerTitle: "Goal", autoSize: true },
    },
    {
      id: "status",
      accessorFn: (row) => (isCategory(row) ? "" : row.goal.status),
      header: ({ column }) => <DataGridColumnHeader title="Enabled" column={column} visibility />,
      cell: goalOnly((node) => <StatusCell node={node} onAction={onAction} />),
      size: 160,
      enableSorting: true,
      meta: { headerTitle: "Enabled" },
    },
    {
      id: "schedule_hint",
      accessorFn: (row) => (isCategory(row) ? "" : row.goal.schedule_hint),
      header: ({ column }) => <DataGridColumnHeader title="Schedule" column={column} visibility />,
      cell: goalOnly((node) =>
        node.goal.schedule_hint ? (
          <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
            <CalendarClockIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{node.goal.schedule_hint}</span>
          </span>
        ) : (
          <Numeric value={EMPTY} muted />
        ),
      ),
      size: 170,
      enableSorting: false,
      meta: { headerTitle: "Schedule" },
    },
    {
      id: "last_run_at",
      accessorFn: (row) => (isCategory(row) ? null : row.goal.last_run_at),
      header: ({ column }) => <DataGridColumnHeader title="Last run" column={column} visibility />,
      // A goal that has never run has no last run — an em dash, not "never ran
      // 56 years ago", and not a zero.
      cell: goalOnly((node) =>
        node.goal.last_run_at ? (
          <span className="text-foreground text-sm" title={shortDate(node.goal.last_run_at)}>
            {relativeTime(node.goal.last_run_at)}
          </span>
        ) : (
          <Numeric value={EMPTY} muted />
        ),
      ),
      size: 130,
      enableSorting: true,
      meta: { headerTitle: "Last run" },
    },
    {
      id: "next_expected_at",
      accessorFn: (row) => (isCategory(row) ? null : row.goal.next_expected_at),
      header: ({ column }) => <DataGridColumnHeader title="Next expected" column={column} visibility />,
      cell: goalOnly((node) =>
        node.goal.next_expected_at ? (
          <span
            className={cn("text-sm", node.goal.stale ? "text-warning" : "text-muted-foreground")}
            title={shortDate(node.goal.next_expected_at)}
          >
            {relativeTime(node.goal.next_expected_at)}
          </span>
        ) : (
          <Numeric value={EMPTY} muted />
        ),
      ),
      size: 140,
      enableSorting: false,
      meta: { headerTitle: "Next expected" },
    },
    {
      id: "runs_count",
      accessorFn: (row) => (isCategory(row) ? row.runs : row.goal.runs_count),
      header: ({ column }) => <DataGridColumnHeader title="Runs" column={column} visibility />,
      cell: ({ row }) =>
        isCategory(row.original) ? (
          <Numeric value={row.original.runs} />
        ) : (
          <Numeric value={row.original.goal.runs_count} muted={row.original.goal.runs_count === 0} />
        ),
      size: 90,
      enableSorting: false,
      meta: { headerTitle: "Runs", cellClassName: "text-right!", headerClassName: "justify-end" },
    },
    {
      id: "findings_count",
      accessorFn: (row) => (isCategory(row) ? row.findings : row.goal.findings_count),
      header: ({ column }) => <DataGridColumnHeader title="Findings" column={column} visibility />,
      cell: ({ row }) =>
        isCategory(row.original) ? (
          <Numeric value={row.original.findings} />
        ) : (
          <Numeric
            value={row.original.goal.findings_count}
            muted={row.original.goal.findings_count === 0}
          />
        ),
      size: 100,
      enableSorting: false,
      meta: { headerTitle: "Findings", cellClassName: "text-right!", headerClassName: "justify-end" },
    },
    {
      id: "accept_rate",
      accessorFn: (row) => (isCategory(row) ? null : row.goal.accept_rate),
      header: ({ column }) => <DataGridColumnHeader title="Accept rate" column={column} visibility />,
      // percent() answers an em dash for null, which is the whole point: a goal
      // whose proposals nobody has reviewed has no accept rate, and that is not
      // 0%.
      cell: goalOnly((node) => (
        <Numeric value={percent(node.goal.accept_rate)} muted={node.goal.accept_rate === null} />
      )),
      size: 120,
      enableSorting: false,
      meta: {
        headerTitle: "Accept rate",
        cellClassName: "text-right!",
        headerClassName: "justify-end",
      },
    },
    {
      id: "budget_max_cents",
      accessorFn: (row) => (isCategory(row) ? null : row.goal.budget_max_cents),
      header: ({ column }) => <DataGridColumnHeader title="Budget" column={column} visibility />,
      cell: goalOnly((node) => (
        <span
          className={cn(
            "text-sm tabular-nums",
            node.goal.budget_min_cents === null && node.goal.budget_max_cents === null
              ? "text-muted-foreground"
              : "text-foreground",
          )}
          title={
            node.goal.budget_max_cents !== null
              ? `Up to ${money(node.goal.budget_max_cents, node.goal.currency)}`
              : undefined
          }
        >
          {moneyRange(node.goal.budget_min_cents, node.goal.budget_max_cents, node.goal.currency)}
        </span>
      )),
      size: 150,
      enableSorting: true,
      meta: { headerTitle: "Budget", cellClassName: "text-right!", headerClassName: "justify-end" },
    },
    {
      id: "actions",
      header: "",
      cell: goalOnly((node) => <ActionsCell node={node} onAction={onAction} />),
      size: 56,
      enableSorting: false,
      enableResizing: false,
      enableHiding: false,
    },
  ];
}
