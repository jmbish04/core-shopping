"use no memo"

import { memo, type ComponentProps } from "react"
import { Badge } from "@/components/reui/badge"
import { type DataGridFeatures } from "@/components/reui/data-grid/data-grid"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import { type ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Item } from "@/components/ui/item"
import {
  ACCOUNTS,
  formatCurrency,
  nextRenewal,
  sumArr,
  weightedNrr,
  type Account,
  type AccountHealth,
  type AccountOwner,
  type AccountRow,
  type AccountTier,
  type PortfolioRow,
  type RegionGroupRow,
} from "./data"
import { TrendingUp, TrendingDown, ArrowRightIcon, CalendarDaysIcon, MoreHorizontalIcon, EyeIcon, CopyIcon, PencilIcon, ChevronRightIcon, GlobeIcon } from "lucide-react"

export type AccountAction = "open" | "copy" | "plan"

const tierVariant: Record<
  AccountTier,
  ComponentProps<typeof Badge>["variant"]
> = {
  Enterprise: "outline",
  Growth: "outline",
  Startup: "outline",
}

const healthVariant: Record<
  AccountHealth,
  ComponentProps<typeof Badge>["variant"]
> = {
  Healthy: "success-light",
  Watch: "warning-light",
  "At Risk": "destructive-light",
}

// Per-account brand mark: a colored monogram tile stands in for a real logo
// (accounts are fictional, so real brand art is off limits). Tint is stable per
// account id; the monogram is the initials of the first two words.
const BRAND_TINTS = [
  "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  "border-cyan-200 bg-cyan-100 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-300",
]

// Cycle the tints by position within each region so a region's accounts get
// distinct colors (a region with more than six repeats from the first tint).
const BRAND_TINT_BY_ID = new Map<string, string>()
const regionTintCursor = new Map<Account["regionId"], number>()
for (const account of ACCOUNTS) {
  const cursor = regionTintCursor.get(account.regionId) ?? 0
  BRAND_TINT_BY_ID.set(account.id, BRAND_TINTS[cursor % BRAND_TINTS.length])
  regionTintCursor.set(account.regionId, cursor + 1)
}

function brandTint(id: string) {
  return BRAND_TINT_BY_ID.get(id) ?? BRAND_TINTS[0]
}

function accountMonogram(name: string) {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function isAccountRow(row: PortfolioRow): row is AccountRow {
  return row.kind === "account"
}

function getRegionAccounts(row: RegionGroupRow): Account[] {
  return row.subRows?.map((item) => item.account) ?? []
}

/** Color tone keyed on net revenue retention (100% = flat). */
function nrrTone(value: number) {
  if (value >= 100) return "text-emerald-600 dark:text-emerald-500"
  return "text-rose-600 dark:text-rose-500"
}

// ── Shared cells ──

const OwnerAvatar = memo(function OwnerAvatar({
  owner,
  className,
}: {
  owner: AccountOwner
  className?: string
}) {
  return (
    <Avatar className={cn("size-6 shrink-0", className)}>
      {owner.avatarSrc ? (
        <AvatarImage src={owner.avatarSrc} alt={owner.name} />
      ) : null}
      <AvatarFallback className="text-[10px]">{owner.initials}</AvatarFallback>
    </Avatar>
  )
})

export function NrrValue({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm tabular-nums",
        nrrTone(value)
      )}
    >
      {value >= 100 ? (
        <TrendingUp className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <TrendingDown className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      {value}%
    </span>
  )
}

// ── Account (leaf) cells ──

function AccountLogoTile({ account }: { account: Account }) {
  return (
    <Item
      render={<span />}
      aria-hidden="true"
      className={cn(
        "flex size-7 shrink-0 items-center justify-center border p-0 text-xs font-semibold tracking-tight",
        brandTint(account.id)
      )}
    >
      {accountMonogram(account.name)}
    </Item>
  )
}

function AccountNameAffordance({ name }: { name: string }) {
  return (
    <span className="group/account-name inline-flex min-w-0 items-center gap-1 truncate">
      <span
        data-slot="portfolio-account-name"
        className="hover:text-primary text-foreground max-w-full cursor-pointer truncate py-0.25 transition-colors"
      >
        {name}
      </span>
      <ArrowRightIcon className="size-3 shrink-0 -translate-x-1 opacity-0 transition group-hover/account-name:translate-x-0 group-hover/account-name:opacity-100" aria-hidden="true" />
    </span>
  )
}

function AccountNameCell({ account }: { account: Account }) {
  return (
    <div
      data-portfolio-row="account"
      className="flex min-w-0 items-center gap-3 ps-8"
    >
      <AccountLogoTile account={account} />
      <div className="min-w-0 flex-1 text-sm leading-5 font-medium">
        <AccountNameAffordance name={account.name} />
      </div>
    </div>
  )
}

function OwnerCell({ owner }: { owner: AccountOwner }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <OwnerAvatar owner={owner} />
      <span className="text-foreground min-w-0 truncate text-sm">
        {owner.name}
      </span>
    </div>
  )
}

function RenewalCell({ account }: { account: Account }) {
  return (
    <Badge variant="outline" className="bg-background gap-1.5">
      <CalendarDaysIcon className="text-muted-foreground size-3.5" aria-hidden="true" />
      <span className="tabular-nums">{account.renewalLabel}</span>
    </Badge>
  )
}

function AccountActionsCell({
  account,
  onAction,
}: {
  account: Account
  onAction: (action: AccountAction, account: Account) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Actions for ${account.name}`}
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      {/* Content */}
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onAction("open", account)}>
            <EyeIcon aria-hidden="true" />
            View account
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction("copy", account)}>
            <CopyIcon aria-hidden="true" />
            Copy name
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onAction("plan", account)}>
            <PencilIcon aria-hidden="true" />
            Adjust plan
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Region (group) cells ──

function RegionExpandButton({
  label,
  expanded,
  onToggle,
}: {
  label: string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
      aria-expanded={expanded}
      className="text-muted-foreground hover:text-foreground size-6 shrink-0 p-0 shadow-none"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
    >
      <ChevronRightIcon className={cn(
                    "size-3.5 shrink-0 transition-transform duration-150",
                    expanded && "rotate-90"
                  )} aria-hidden="true" />
    </Button>
  )
}

function RegionGroupCell({
  row,
  expanded,
  onToggle,
}: {
  row: RegionGroupRow
  expanded: boolean
  onToggle: () => void
}) {
  const count = row.subRows?.length ?? 0

  return (
    <div
      data-portfolio-row="region"
      className="flex min-w-0 items-center gap-2"
    >
      <RegionExpandButton
        label={row.region.name}
        expanded={expanded}
        onToggle={onToggle}
      />
      <GlobeIcon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      <span className="text-foreground min-w-0 truncate text-sm font-semibold">
        {row.region.name}
      </span>
      <Badge variant="outline" className="shrink-0">
        {count}
      </Badge>
    </div>
  )
}

/** Right-aligned numeric slot shared by account and group rows. */
function NumericSlot({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex w-full items-center justify-end", className)}>
      {children}
    </div>
  )
}

export function createPortfolioColumns({
  onAction,
}: {
  onAction: (action: AccountAction, account: Account) => void
}): ColumnDef<DataGridFeatures, PortfolioRow>[] {
  return [
    {
      accessorFn: (row) =>
        isAccountRow(row) ? row.account.name : row.region.name,
      id: "account",
      header: ({ column }) => (
        <DataGridColumnHeader title="Account" column={column} />
      ),
      cell: ({ row }) =>
        isAccountRow(row.original) ? (
          <AccountNameCell account={row.original.account} />
        ) : (
          <RegionGroupCell
            row={row.original}
            expanded={row.getIsExpanded()}
            onToggle={row.getToggleExpandedHandler()}
          />
        ),
      enableHiding: false,
      enableSorting: false,
      minSize: 240,
      meta: {
        headerTitle: "Account",
        autoSize: true,
      },
    },
    {
      accessorFn: (row) =>
        isAccountRow(row) ? row.account.owner.name : row.region.summary,
      id: "owner",
      header: ({ column }) => (
        <DataGridColumnHeader title="Owner" column={column} />
      ),
      cell: ({ row }) =>
        isAccountRow(row.original) ? (
          <OwnerCell owner={row.original.account.owner} />
        ) : (
          <span className="text-muted-foreground truncate text-sm">
            {row.original.region.summary}
          </span>
        ),
      size: 190,
      enableSorting: false,
      meta: {
        headerTitle: "Owner",
      },
    },
    {
      accessorFn: (row) => (isAccountRow(row) ? row.account.tier : ""),
      id: "tier",
      header: ({ column }) => (
        <DataGridColumnHeader title="Tier" column={column} />
      ),
      cell: ({ row }) =>
        isAccountRow(row.original) ? (
          <Badge variant={tierVariant[row.original.account.tier]}>
            {row.original.account.tier}
          </Badge>
        ) : null,
      size: 120,
      enableSorting: false,
      meta: {
        headerTitle: "Tier",
      },
    },
    {
      accessorFn: (row) => (isAccountRow(row) ? row.account.health : ""),
      id: "health",
      header: ({ column }) => (
        <DataGridColumnHeader title="Health" column={column} />
      ),
      cell: ({ row }) =>
        isAccountRow(row.original) ? (
          <Badge variant={healthVariant[row.original.account.health]}>
            {row.original.account.health}
          </Badge>
        ) : null,
      size: 120,
      enableSorting: false,
      meta: {
        headerTitle: "Health",
      },
    },
    {
      accessorFn: (row) =>
        isAccountRow(row) ? row.account.arr : sumArr(getRegionAccounts(row)),
      id: "arr",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="ARR"
          column={column}
          className="w-full justify-end text-right"
        />
      ),
      cell: ({ row }) => {
        const value = isAccountRow(row.original)
          ? row.original.account.arr
          : sumArr(getRegionAccounts(row.original))
        return (
          <NumericSlot>
            <span
              className={cn(
                "text-foreground text-sm tabular-nums",
                isAccountRow(row.original) ? "font-medium" : "font-semibold"
              )}
            >
              {formatCurrency(value)}
            </span>
          </NumericSlot>
        )
      },
      size: 150,
      enableSorting: false,
      meta: {
        headerTitle: "ARR",
        headerClassName: "text-right!",
        cellClassName: "text-right!",
      },
    },
    {
      accessorFn: (row) =>
        isAccountRow(row)
          ? row.account.nrr
          : weightedNrr(getRegionAccounts(row)),
      id: "nrr",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="NRR"
          column={column}
          className="w-full justify-end text-right"
        />
      ),
      cell: ({ row }) => {
        const value = isAccountRow(row.original)
          ? row.original.account.nrr
          : weightedNrr(getRegionAccounts(row.original))
        return (
          <NumericSlot>
            <NrrValue value={value} />
          </NumericSlot>
        )
      },
      size: 120,
      enableSorting: false,
      meta: {
        headerTitle: "NRR",
        headerClassName: "text-right!",
        cellClassName: "text-right!",
      },
    },
    {
      accessorFn: (row) =>
        isAccountRow(row)
          ? row.account.renewalAt
          : (nextRenewal(getRegionAccounts(row))?.renewalAt ?? ""),
      id: "renewal",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Renewal"
          column={column}
          className="w-full justify-end text-right"
        />
      ),
      cell: ({ row }) => {
        if (isAccountRow(row.original)) {
          return (
            <div className="flex justify-end">
              <RenewalCell account={row.original.account} />
            </div>
          )
        }
        const upcoming = nextRenewal(getRegionAccounts(row.original))
        return (
          <div className="flex justify-end">
            {upcoming ? (
              <span className="inline-flex items-baseline gap-1.5 text-sm whitespace-nowrap">
                <span className="text-muted-foreground">Next</span>
                <span className="text-foreground tabular-nums">
                  {upcoming.renewalLabel}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">--</span>
            )}
          </div>
        )
      },
      size: 184,
      minSize: 150,
      enableSorting: false,
      meta: {
        headerTitle: "Renewal",
        headerClassName: "text-right!",
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        isAccountRow(row.original) ? (
          <div className="flex justify-end">
            <AccountActionsCell
              account={row.original.account}
              onAction={onAction}
            />
          </div>
        ) : null,
      size: 56,
      enableHiding: false,
      enableSorting: false,
    },
  ]
}