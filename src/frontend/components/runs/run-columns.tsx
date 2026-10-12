/**
 * @fileoverview Columns for the Runs queue (maestro cs-fe-10-1).
 *
 * Adapted from the ReUI Pro block `solution-agents-2` (its run-queue grid: a
 * status group header over run rows, the run title with a context line, the
 * agent and timing columns). Decorations of the stock block that have no
 * backing here are removed, not faked: there are no owners, no step progress,
 * no environment, and no retry or pause action, because no API does those.
 *
 * Every figure is a field of `GET /api/runs`. A running run has no duration
 * and an unscored run has no quality; both render as an em dash.
 */

import {
  BanIcon,
  CircleCheckIcon,
  CircleXIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
} from "lucide-react";
import type { ColumnDef, Row } from "@tanstack/react-table";

import { Badge } from "@/components/reui/badge";
import type { DataGridFeatures } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { DataGridTableRowExpand } from "@/components/reui/data-grid/data-grid-table";
import { IconTile } from "@/components/reui/icon-tile";
import { duration, relativeTime, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  CLIENT_LABELS,
  formatScore,
  LOW_QUALITY_THRESHOLD,
  safeSessionUrl,
  type RunItemRow,
  type RunRow,
  type RunStatusRow,
} from "./run-rows";

const TREE_INDENT = 20;
const EMPTY = "—";

const STATUS_META: Record<
  RunStatusRow["status"],
  { label: string; variant: string; icon: typeof CircleCheckIcon; tone: string }
> = {
  running: { label: "Running", variant: "info-light", icon: LoaderCircleIcon, tone: "text-info" },
  failed: { label: "Failed", variant: "destructive-light", icon: CircleXIcon, tone: "text-destructive" },
  succeeded: { label: "Succeeded", variant: "success-light", icon: CircleCheckIcon, tone: "text-success" },
  abandoned: { label: "Abandoned", variant: "secondary", icon: BanIcon, tone: "text-muted-foreground" },
};

const isStatus = (row: RunRow): row is RunStatusRow => row.kind === "status";

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground text-sm tabular-nums">{children}</span>;
}

function TitleCell({
  row,
  goalTitles,
}: {
  row: Row<DataGridFeatures, RunRow>;
  goalTitles: Map<string, string>;
}) {
  const node = row.original;
  if (isStatus(node)) {
    const meta = STATUS_META[node.status] ?? STATUS_META.abandoned;
    const loaded = node.children.length;
    return (
      <div className="flex min-w-0 items-center gap-2.5" data-run-row="group">
        <span className="flex shrink-0 items-center">
          <DataGridTableRowExpand row={row} indent={TREE_INDENT} />
        </span>
        <span className="text-foreground truncate text-sm font-semibold">{meta.label}</span>
        <Badge variant="outline" className="shrink-0 tabular-nums">
          {node.total !== null && node.total > loaded
            ? `${loaded.toLocaleString("en-US")} of ${node.total.toLocaleString("en-US")}`
            : `${loaded.toLocaleString("en-US")} ${loaded === 1 ? "run" : "runs"}`}
        </Badge>
      </div>
    );
  }

  const { run } = node;
  const meta = STATUS_META[run.status] ?? STATUS_META.abandoned;
  const Icon = meta.icon;
  const goals = run.goal_ids.map((id) => goalTitles.get(id)).filter((t): t is string => Boolean(t));
  const context = run.status === "failed" && run.error ? run.error : goals.join(" · ");
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden="true" className="w-9 shrink-0" />
      <IconTile variant="outline" size="xs" aria-hidden="true" className={cn("shrink-0", meta.tone)}>
        <Icon className={cn(run.status === "running" && "animate-spin")} />
      </IconTile>
      <div className="flex min-w-0 flex-col">
        <span className="text-foreground truncate text-sm font-medium" title={run.summary || undefined}>
          {run.summary || <span className="text-muted-foreground">No summary recorded</span>}
        </span>
        {context ? (
          <span
            className={cn(
              "truncate text-xs",
              run.status === "failed" && run.error ? "text-destructive" : "text-muted-foreground",
            )}
            title={context}
          >
            {context}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Build the Runs queue columns.
 *
 * @param options - `goalTitles` maps goal ids to titles for the context line.
 * @returns Column definitions for the data grid.
 */
export function createRunColumns({
  goalTitles,
}: {
  goalTitles: Map<string, string>;
}): ColumnDef<DataGridFeatures, RunRow>[] {
  const runOnly =
    (render: (node: RunItemRow) => React.ReactNode) =>
    ({ row }: { row: Row<DataGridFeatures, RunRow> }) =>
      isStatus(row.original) ? null : render(row.original);

  return [
    {
      id: "summary",
      accessorFn: (row) => (isStatus(row) ? row.status : row.run.summary),
      header: ({ column }) => <DataGridColumnHeader title="Run" column={column} />,
      cell: ({ row }) => <TitleCell row={row} goalTitles={goalTitles} />,
      enableSorting: false,
      enableHiding: false,
      minSize: 320,
      meta: { headerTitle: "Run", autoSize: true },
    },
    {
      id: "status",
      accessorFn: (row) => (isStatus(row) ? "" : row.run.status),
      header: ({ column }) => <DataGridColumnHeader title="Status" column={column} />,
      cell: runOnly(({ run }) => {
        const meta = STATUS_META[run.status] ?? STATUS_META.abandoned;
        return (
          <Badge variant={meta.variant as never} className="shrink-0">
            {meta.label}
          </Badge>
        );
      }),
      size: 120,
      enableSorting: false,
      meta: { headerTitle: "Status" },
    },
    {
      id: "client",
      accessorFn: (row) => (isStatus(row) ? "" : row.run.client),
      header: ({ column }) => <DataGridColumnHeader title="Agent" column={column} />,
      cell: runOnly(({ run }) => (
        <div className="flex min-w-0 flex-col">
          <span className="text-foreground text-sm">{CLIENT_LABELS[run.client] ?? run.client}</span>
          <span className="text-muted-foreground truncate text-xs" title={run.model}>
            {run.model || EMPTY}
          </span>
        </div>
      )),
      size: 170,
      enableSorting: false,
      meta: { headerTitle: "Agent" },
    },
    {
      id: "started_at",
      accessorFn: (row) => (isStatus(row) ? null : row.run.started_at),
      header: ({ column }) => <DataGridColumnHeader title="Started" column={column} />,
      cell: runOnly(({ run }) => (
        <span className="text-foreground text-sm" title={shortDate(run.started_at)}>
          {relativeTime(run.started_at)}
        </span>
      )),
      size: 120,
      enableSorting: false,
      meta: { headerTitle: "Started" },
    },
    {
      id: "duration",
      accessorFn: (row) => (isStatus(row) ? null : row.run.duration_ms),
      header: ({ column }) => <DataGridColumnHeader title="Duration" column={column} />,
      cell: runOnly(({ run }) =>
        run.duration_ms === null ? <Muted>{EMPTY}</Muted> : <Muted>{duration(run.duration_ms)}</Muted>,
      ),
      size: 100,
      enableSorting: false,
      meta: { headerTitle: "Duration", cellClassName: "text-right!", headerClassName: "justify-end" },
    },
    {
      id: "quality_score",
      accessorFn: (row) => (isStatus(row) ? null : row.run.quality_score),
      header: ({ column }) => <DataGridColumnHeader title="Quality" column={column} />,
      cell: runOnly(({ run }) => (
        <span
          className={cn(
            "text-sm tabular-nums",
            run.quality_score === null
              ? "text-muted-foreground"
              : run.quality_score < LOW_QUALITY_THRESHOLD
                ? "text-warning"
                : "text-foreground",
          )}
        >
          {formatScore(run.quality_score)}
        </span>
      )),
      size: 90,
      enableSorting: false,
      meta: { headerTitle: "Quality", cellClassName: "text-right!", headerClassName: "justify-end" },
    },
    {
      id: "outputs",
      accessorFn: (row) => (isStatus(row) ? null : row.run.sightings_count),
      header: ({ column }) => <DataGridColumnHeader title="Found" column={column} />,
      cell: runOnly(({ run }) => (
        <span
          className="text-muted-foreground text-xs tabular-nums"
          title={`${run.sightings_count.toLocaleString("en-US")} sightings · ${run.new_entities_count.toLocaleString("en-US")} new items · ${run.proposals_count.toLocaleString("en-US")} proposals`}
        >
          <span className="text-foreground text-sm">{run.sightings_count.toLocaleString("en-US")}</span>
          {" sightings · "}
          {run.proposals_count.toLocaleString("en-US")}
          {" proposals"}
        </span>
      )),
      size: 190,
      enableSorting: false,
      meta: { headerTitle: "Found" },
    },
    {
      id: "session",
      header: () => <span className="sr-only">Session</span>,
      cell: runOnly(({ run }) => {
        const href = safeSessionUrl(run.session_url);
        return href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground hover:text-foreground inline-flex"
            aria-label="Open the agent session"
            title="Open the agent session"
          >
            <ExternalLinkIcon className="size-4" aria-hidden="true" />
          </a>
        ) : null;
      }),
      size: 48,
      enableSorting: false,
      enableResizing: false,
      meta: { headerTitle: "Session" },
    },
  ];
}
