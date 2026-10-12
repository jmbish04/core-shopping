"use no memo"

import { createContext, useContext, type ReactNode } from "react"
import { type DataGridFeatures } from "@/components/reui/data-grid/data-grid"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table"
import { type ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"

import { formatTime } from "./audit-format"
import { reviewState } from "./audit-query"
import { CopyToken, useCopyFeedback } from "./copy-token"
import { ACTORS, AUTH_LABEL, OUTCOME_CONFIG, type AuditEvent } from "./data"
import { UI_ICONS } from "./icons"
import {
  ActionFace,
  ActorFace,
  EnvironmentFace,
  OutcomeFace,
  ResourceFace,
  ReviewFace,
  SourceFace,
} from "./value-faces"

export type AuditRowAction =
  "view" | "filterActor" | "resourceHistory" | "review"

export type AuditColumnHandlers = {
  onOpen: (id: string) => void
  onAction: (action: AuditRowAction, event: AuditEvent) => void
}

/** The event open in the sheet. A context, not a column input, so opening an
 *  event never rebuilds the columns and remounts the button focus returns to. */
export const CurrentEventContext = createContext<string | null>(null)

/** The time is the row's keyboard path into the sheet. */
function TimeCell({
  event,
  onOpen,
}: {
  event: AuditEvent
  onOpen: AuditColumnHandlers["onOpen"]
}) {
  const currentId = useContext(CurrentEventContext)
  return (
    <button
      type="button"
      aria-label={`${formatTime(event.at)}, open ${event.id}`}
      aria-current={currentId === event.id ? "true" : undefined}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(event.id)
      }}
      className="focus-visible:outline-ring/50 font-mono text-xs tabular-nums underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2"
    >
      {formatTime(event.at)}
    </button>
  )
}

/** Clicks inside this cell never reach the row's open handler. */
function StopRowClick({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn("flex min-w-0 items-center", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

/** Held open so the swap to Copied shows where it was asked for. */
function CopyMenuItem({
  value,
  label,
  icon,
}: {
  value: string
  label: string
  icon: ReactNode
}) {
  const { copied, copy } = useCopyFeedback()
  return (
    <DropdownMenuItem closeOnClick={false} onClick={() => copy(value)}>
      {copied ? UI_ICONS.check : icon}
      {copied ? "Copied" : label}
    </DropdownMenuItem>
  )
}

function ActionsCell({
  event,
  onAction,
}: {
  event: AuditEvent
  onAction: AuditColumnHandlers["onAction"]
}) {
  const reviewed = Boolean(event.reviewedBy)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Actions for ${event.id}`}
          />
        }
      >
        {UI_ICONS.more}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Event</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onAction("view", event)}>
            {UI_ICONS.view}
            View details
          </DropdownMenuItem>
          <CopyMenuItem
            value={event.id}
            label="Copy event ID"
            icon={UI_ICONS.copy}
          />
          <CopyMenuItem
            value={event.requestId}
            label="Copy request ID"
            icon={UI_ICONS.hash}
          />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Narrow</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onAction("filterActor", event)}>
            {UI_ICONS.user}
            Filter by actor
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction("resourceHistory", event)}>
            {UI_ICONS.history}
            Resource history
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Review</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onAction("review", event)}>
            {reviewed ? UI_ICONS.reset : UI_ICONS.review}
            {reviewed ? "Reopen review" : "Mark reviewed"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const MUTED_MONO = "text-muted-foreground font-mono text-xs tabular-nums"

export function createAuditColumns({
  onOpen,
  onAction,
}: AuditColumnHandlers): ColumnDef<DataGridFeatures, AuditEvent>[] {
  return [
    {
      id: "select",
      header: () => <DataGridTableRowSelectAll />,
      // The checkbox stops its own click, but the hidden input it drives does
      // not, so the wrapper keeps a tick from opening the sheet.
      cell: ({ row }) => (
        <StopRowClick>
          <DataGridTableRowSelect row={row} />
        </StopRowClick>
      ),
      size: 36,
      enableSorting: false,
      enableResizing: false,
      enableHiding: false,
      meta: { skeleton: <Skeleton className="size-4" /> },
    },
    {
      id: "time",
      accessorFn: (event) => Date.parse(event.at),
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => <TimeCell event={row.original} onOpen={onOpen} />,
      size: 140,
      enableHiding: false,
      meta: {
        headerTitle: "Time",
        skeleton: <Skeleton className="h-4 w-28" />,
      },
    },
    {
      id: "actor",
      accessorFn: (event) => ACTORS[event.actorId].name,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => (
        <ActorFace actorId={row.original.actorId} className="text-sm" />
      ),
      size: 180,
      enableHiding: false,
      meta: {
        headerTitle: "Actor",
        skeleton: (
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ),
      },
    },
    {
      id: "action",
      accessorKey: "action",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => <ActionFace action={row.original.action} />,
      size: 204,
      enableHiding: false,
      meta: {
        headerTitle: "Action",
        skeleton: <Skeleton className="h-4 w-32" />,
      },
    },
    {
      id: "outcome",
      accessorFn: (event) => OUTCOME_CONFIG[event.outcome].label,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => <OutcomeFace outcome={row.original.outcome} />,
      size: 110,
      enableHiding: false,
      meta: {
        headerTitle: "Outcome",
        skeleton: <Skeleton className="h-5 w-16 rounded-full" />,
      },
    },
    {
      id: "resource",
      accessorFn: (event) => event.resource.name,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => <ResourceFace resource={row.original.resource} />,
      size: 204,
      enableHiding: false,
      meta: {
        headerTitle: "Resource",
        skeleton: <Skeleton className="h-4 w-36" />,
      },
    },
    {
      id: "environment",
      accessorKey: "environment",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => (
        <EnvironmentFace environment={row.original.environment} />
      ),
      size: 98,
      meta: {
        headerTitle: "Env",
        skeleton: <Skeleton className="h-5 w-16 rounded-full" />,
      },
    },
    {
      id: "source",
      accessorKey: "source",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => <SourceFace source={row.original.source} />,
      size: 140,
      meta: {
        headerTitle: "Source",
        skeleton: <Skeleton className="h-4 w-20" />,
      },
    },
    {
      id: "ip",
      accessorKey: "ip",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => <span className={MUTED_MONO}>{row.original.ip}</span>,
      size: 112,
      enableSorting: false,
      meta: {
        headerTitle: "IP",
        skeleton: <Skeleton className="h-4 w-24" />,
      },
    },
    {
      id: "request",
      accessorKey: "requestId",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => (
        <StopRowClick>
          <CopyToken value={row.original.requestId} label="request ID" />
        </StopRowClick>
      ),
      size: 176,
      enableSorting: false,
      meta: {
        headerTitle: "Request",
        skeleton: <Skeleton className="h-4 w-24" />,
      },
    },
    {
      id: "session",
      accessorKey: "sessionId",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => (
        <span className={MUTED_MONO}>{row.original.sessionId}</span>
      ),
      size: 132,
      enableSorting: false,
      meta: {
        headerTitle: "Session",
        skeleton: <Skeleton className="h-4 w-24" />,
      },
    },
    {
      id: "auth",
      accessorFn: (event) => AUTH_LABEL[event.authMethod],
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => (
        <span className="truncate text-sm">
          {AUTH_LABEL[row.original.authMethod]}
        </span>
      ),
      size: 168,
      meta: {
        headerTitle: "Auth",
        skeleton: <Skeleton className="h-4 w-24" />,
      },
    },
    {
      id: "cluster",
      accessorFn: (event) => event.cluster ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) =>
        row.original.cluster ? (
          <span className="font-mono text-xs">{row.original.cluster}</span>
        ) : (
          <span className="text-muted-foreground text-sm">None</span>
        ),
      size: 148,
      meta: {
        headerTitle: "Cluster",
        skeleton: <Skeleton className="h-4 w-24" />,
      },
    },
    {
      id: "review",
      accessorFn: (event) => reviewState(event),
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility />
      ),
      cell: ({ row }) => <ReviewFace event={row.original} />,
      size: 128,
      meta: {
        headerTitle: "Review",
        skeleton: <Skeleton className="h-4 w-24" />,
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <StopRowClick className="justify-end">
          <ActionsCell event={row.original} onAction={onAction} />
        </StopRowClick>
      ),
      size: 44,
      enableSorting: false,
      enableHiding: false,
      meta: {
        headerClassName: "text-right",
        cellClassName: "text-right",
        skeleton: <Skeleton className="ms-auto size-6" />,
      },
    },
  ]
}