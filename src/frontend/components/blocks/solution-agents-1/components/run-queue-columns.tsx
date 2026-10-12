import { memo } from "react"
import { Badge } from "@/components/reui/badge"
import { type DataGridFeatures } from "@/components/reui/data-grid/data-grid"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import { type ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { runStatusLabel, runStatusToneClass, type IRun } from "./data"
import { MoreHorizontalIcon, EyeIcon, RefreshCwIcon, PauseIcon, UserPlusIcon } from "lucide-react"

export type RunAction = "inspect" | "retry" | "pause" | "assign"

// Typed status badge, mirrored from data-grid-5 StatusBadge (dot + outline).
export const RunStatusBadge = memo(function RunStatusBadge({
  status,
}: {
  status: IRun["status"]
}) {
  return (
    <Badge variant="outline" className="gap-1.5">
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          runStatusToneClass[status]
        )}
        aria-hidden="true"
      />
      {runStatusLabel[status]}
    </Badge>
  )
})

function RunActionsCell({
  run,
  onAction,
}: {
  run: IRun
  onAction: (action: RunAction, run: IRun) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Actions for ${run.agent}`}
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onAction("inspect", run)}>
            <EyeIcon className="size-4" aria-hidden="true" />
            Inspect Run
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction("retry", run)}>
            <RefreshCwIcon className="size-4" aria-hidden="true" />
            Retry
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction("pause", run)}>
            <PauseIcon className="size-4" aria-hidden="true" />
            Pause
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onAction("assign", run)}>
            <UserPlusIcon className="size-4" aria-hidden="true" />
            Assign Owner
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function createRunColumns({
  onAction,
}: {
  onAction: (action: RunAction, run: IRun) => void
}): ColumnDef<DataGridFeatures, IRun>[] {
  return [
    {
      accessorFn: (row) => row.agent,
      id: "agent",
      header: ({ column }) => (
        <DataGridColumnHeader title="Agent / Run" column={column} />
      ),
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-foreground truncate text-sm font-medium">
            {row.original.agent}
          </span>
          <span className="text-muted-foreground font-mono text-xs">
            {row.original.runKey}
          </span>
        </div>
      ),
      enableHiding: false,
      enableSorting: false,
      minSize: 220,
      meta: {
        autoSize: true,
      },
    },
    {
      accessorFn: (row) => row.statusOrder,
      id: "status",
      header: ({ column }) => (
        <DataGridColumnHeader title="Status" column={column} />
      ),
      cell: ({ row }) => <RunStatusBadge status={row.original.status} />,
      size: 132,
      enableSorting: false,
    },
    {
      accessorFn: (row) => row.environment,
      id: "environment",
      header: ({ column }) => (
        <DataGridColumnHeader title="Environment" column={column} />
      ),
      cell: ({ row }) => (
        <span className="text-foreground text-sm">
          {row.original.environment}
        </span>
      ),
      size: 140,
      enableSorting: false,
    },
    {
      accessorFn: (row) => row.latencyMs,
      id: "latency",
      header: ({ column }) => (
        <DataGridColumnHeader title="Latency" column={column} />
      ),
      cell: ({ row }) => (
        <span className="text-foreground text-sm font-medium tabular-nums">
          {row.original.latencyLabel}
        </span>
      ),
      size: 118,
      enableSorting: true,
    },
    {
      accessorFn: (row) => row.startedLabel,
      id: "started",
      header: ({ column }) => (
        <DataGridColumnHeader title="Started" column={column} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.startedLabel}
        </span>
      ),
      size: 124,
      enableSorting: false,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <RunActionsCell run={row.original} onAction={onAction} />
      ),
      size: 56,
    },
  ]
}