"use client"

import { memo, useState } from "react"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { Badge } from "@/components/reui/badge"
import { type DataGridFeatures } from "@/components/reui/data-grid/data-grid"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table"
import { type ColumnDef } from "@tanstack/react-table"
import type { Row } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Item, ItemMedia } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import type { TxChannel } from "./data"
import type { TxStatus } from "./data"
import type { ITransaction } from "./data"
import { MoreHorizontalIcon, EyeIcon, CopyIcon, DownloadIcon, TriangleAlertIcon, ArrowRightIcon } from "lucide-react"

// ── Formatters ──

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Math.abs(amount))
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso))
}

// ── Status (aligned with data-grid-1 badge language) ──

export const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status: TxStatus
}) {
  if (status === "completed")
    return <Badge variant="success-outline">Completed</Badge>
  if (status === "failed")
    return <Badge variant="destructive-outline">Failed</Badge>
  if (status === "pending")
    return <Badge variant="warning-outline">Pending</Badge>
  return <Badge variant="info-outline">Cancelled</Badge>
})

// ── Channel (origin of charge - replaces "method" duplicate logos) ──

const channelLabel: Record<TxChannel, string> = {
  checkout: "Checkout",
  api: "API",
  invoice: "Invoice",
  dashboard: "Dashboard",
}

const channelVariant: Record<
  TxChannel,
  "success-light" | "info-light" | "warning-light"
> = {
  checkout: "success-light",
  api: "info-light",
  invoice: "warning-light",
  dashboard: "success-light",
}

export const ChannelBadge = memo(function ChannelBadge({
  channel,
}: {
  channel: TxChannel
}) {
  return <Badge variant="secondary">{channelLabel[channel]}</Badge>
})

// ── Actions ──

export function ActionsCell({
  row,
}: {
  row: Row<DataGridFeatures, ITransaction>
}) {
  const { copyToClipboard } = useCopyToClipboard()
  const [disputeOpen, setDisputeOpen] = useState(false)

  const handleCopyRef = () => {
    copyToClipboard(row.original.reference)
    toast.success("Reference copied", { description: row.original.reference })
  }

  const handleDisputeConfirm = () => {
    setDisputeOpen(false)
    toast.message("Dispute opened", {
      description: `${row.original.reference}. Connect your payments API (demo).`,
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="Transaction actions"
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start" className="min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() =>
                toast.info("Transaction details", {
                  description: "Demo. Navigate to your detail view.",
                })
              }
            >
              <EyeIcon className="size-4" aria-hidden="true" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyRef}>
              <CopyIcon className="size-4" aria-hidden="true" />
              Copy Reference
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                toast.success("Receipt", {
                  description: "Demo. Download from your storage.",
                })
              }
            >
              <DownloadIcon className="size-4" aria-hidden="true" />
              Receipt
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDisputeOpen(true)}
            >
              <TriangleAlertIcon className="size-4" aria-hidden="true" />
              Dispute
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Open a dispute?</AlertDialogTitle>
            <AlertDialogDescription>
              This starts a dispute for{" "}
              <span className="text-foreground font-mono text-xs">
                {row.original.reference}
              </span>
              . In production this is irreversible until resolved. Wire to your
              payment provider.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDisputeConfirm}
            >
              Start dispute
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export const columns: ColumnDef<DataGridFeatures, ITransaction>[] = [
  {
    accessorKey: "id",
    id: "id",
    header: () => <DataGridTableRowSelectAll />,
    cell: ({ row }) => <DataGridTableRowSelect row={row} />,
    enableSorting: false,
    size: 35,
    enableResizing: false,
    enableHiding: false,
    meta: {
      skeleton: <Skeleton className="size-4 rounded" />,
    },
  },
  {
    accessorKey: "reference",
    id: "reference",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="group/ref text-foreground hover:text-primary inline-flex min-w-0 cursor-pointer items-center gap-1 truncate font-mono text-xs font-medium transition-colors">
          <span className="group-hover/ref:border-primary border-b border-transparent py-0.25 transition-colors">
            {row.original.reference}
          </span>
          <ArrowRightIcon className="size-3 shrink-0 -translate-x-1 opacity-0 transition-all group-hover/ref:translate-x-0 group-hover/ref:opacity-100" aria-hidden="true" />
        </span>
        <span className="text-muted-foreground text-xs">
          {formatDate(row.original.date)}
        </span>
      </div>
    ),
    size: 150,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Reference",
      skeleton: (
        <div className="flex min-w-0 flex-col gap-0.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ),
    },
  },
  {
    accessorKey: "description",
    id: "description",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <Item className="w-auto shrink-0 border-0 p-0 [&_svg]:size-5">
          <ItemMedia variant="icon" className="size-auto">
            {row.original.merchantLogo}
          </ItemMedia>
        </Item>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-foreground truncate text-sm font-medium">
            {row.original.description}
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {row.original.merchant} · {row.original.category}
          </span>
        </div>
      </div>
    ),
    minSize: 150,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Description",
      skeleton: (
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-5 shrink-0 rounded" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ),
    },
  },
  {
    accessorKey: "country",
    id: "region",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <img
            src={`https://flagcdn.com/${row.original.flag.toLowerCase()}.svg`}
            alt=""
            width={16}
            height={16}
            loading="lazy"
            decoding="async"
            className="size-4 shrink-0 rounded-full object-cover"
          />
          <span className="text-foreground line-clamp-1 text-sm font-medium">
            {row.original.country}
          </span>
        </div>
        {row.original.timezone && (
          <span className="text-muted-foreground line-clamp-1 text-xs tabular-nums">
            {row.original.timezone}
          </span>
        )}
      </div>
    ),
    size: 170,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Region",
      skeleton: (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-3 w-28" />
        </div>
      ),
    },
  },
  {
    accessorKey: "channel",
    id: "channel",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => <ChannelBadge channel={row.original.channel} />,
    size: 120,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Channel",
      skeleton: <Skeleton className="h-6 w-20 rounded-full" />,
    },
  },
  {
    accessorKey: "amount",
    id: "amount",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => {
      const { amount, currency } = row.original
      const inflow = amount > 0
      return (
        <span
          className={cn("font-semibold tabular-nums", inflow && "text-success")}
        >
          {inflow ? "+" : "−"}
          {formatAmount(amount, currency)}
        </span>
      )
    },
    size: 100,
    enableSorting: true,
    enableHiding: true,
    meta: {
      headerTitle: "Amount",
      skeleton: <Skeleton className="h-4 w-20" />,
    },
  },
  {
    accessorKey: "account",
    id: "account",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => (
      <span className="text-foreground font-mono text-xs">
        {row.original.account}
      </span>
    ),
    size: 160,
    enableSorting: false,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Account",
      skeleton: <Skeleton className="h-4 w-24" />,
    },
  },
  {
    accessorKey: "status",
    id: "status",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    size: 90,
    enableSorting: true,
    enableHiding: true,
    enableResizing: false,
    meta: {
      headerTitle: "Status",
      skeleton: <Skeleton className="h-6 w-20 rounded-full" />,
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <ActionsCell row={row} />,
    size: 50,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    meta: {
      skeleton: <Skeleton className="size-7 rounded" />,
    },
  },
]