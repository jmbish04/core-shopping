"use client"

import {
  useState,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react"
import { Badge } from "@/components/reui/badge"
import { type DataGridFeatures } from "@/components/reui/data-grid/data-grid"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import { type ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"

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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  formatPrice,
  formatTrial,
  PLAN_AUDIENCES,
  PLAN_VISIBILITIES,
  type PlanAudience,
  type PlanDraft,
  type PlanDraftErrors,
  type PlanVisibility,
  type PricingPlan,
} from "./data"
import { XIcon, CheckIcon, SquarePenIcon, CopyIcon, Trash2Icon } from "lucide-react"

/**
 * Threaded into cells via `table.options.meta` so columns never rebuild on a
 * keystroke. Unlike a cell-at-a-time grid, exactly one row is editable at once:
 * `editingRowId` names it, `draft` holds its live values, and every other row
 * stays locked (`isLocked`) until this one is saved or cancelled.
 */
export interface PlanTableMeta {
  editingRowId: string | null
  draft: PlanDraft | null
  errors: PlanDraftErrors | null
  hasErrors: boolean
  isLocked: boolean
  startEdit: (rowId: string) => void
  cancelEdit: () => void
  saveEdit: () => void
  updateDraft: (patch: Partial<PlanDraft>) => void
  duplicateRow: (rowId: string) => void
  deleteRow: (rowId: string) => void
}

const visibilityVariant: Record<
  PlanVisibility,
  ComponentProps<typeof Badge>["variant"]
> = {
  Public: "success-light",
  Private: "info-light",
  Archived: "secondary",
}

const audienceDotClass: Record<PlanAudience, string> = {
  Individuals: "bg-sky-500",
  Teams: "bg-violet-500",
  Companies: "bg-amber-500",
}

/** Visibility as its semantic badge. Shared by the cell, the editor, and the filter. */
export function VisibilityBadge({
  visibility,
}: {
  visibility: PlanVisibility
}) {
  return <Badge variant={visibilityVariant[visibility]}>{visibility}</Badge>
}

/** Audience as a categorical outline badge with a colored dot, reused across the block. */
export function AudienceBadge({ audience }: { audience: PlanAudience }) {
  return (
    <Badge variant="outline">
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          audienceDotClass[audience]
        )}
        aria-hidden="true"
      />
      {audience}
    </Badge>
  )
}

function handleEditorKeyDown(
  event: ReactKeyboardEvent<HTMLInputElement>,
  meta: PlanTableMeta
) {
  if (event.key === "Enter") {
    event.preventDefault()
    if (!meta.hasErrors) meta.saveEdit()
  } else if (event.key === "Escape") {
    event.preventDefault()
    meta.cancelEdit()
  }
}

/**
 * Wraps an inline editor so its validation message floats out of layout flow.
 * The control keeps its own 8-height and centers in the row like a read cell, so
 * the row height never changes between read and edit and an error cannot push it.
 */
function EditorField({
  children,
  error,
}: {
  children: ReactNode
  error?: string | null
}) {
  return (
    <div className="relative">
      {children}
      {error ? (
        <span
          role="alert"
          className="text-destructive absolute top-full left-0 z-20 mt-1 text-[11px] leading-none font-medium"
        >
          {error}
        </span>
      ) : null}
    </div>
  )
}

/** Compact icon button with a tooltip, used for every row action. */
function RowAction({
  label,
  icon,
  onClick,
  disabled,
  variant = "ghost",
  className,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: ComponentProps<typeof Button>["variant"]
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant={variant}
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={className}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// Cells: each renders the checked-out editor when its row is being edited,
// otherwise a read-only display. Editors keep a fixed 8-height so the row does
// not resize on edit; validation messages float via EditorField.

function PlanCell({ plan, meta }: { plan: PricingPlan; meta: PlanTableMeta }) {
  const editing = meta.editingRowId === plan.id

  return (
    <div className="relative">
      {editing ? (
        <span
          aria-hidden="true"
          className="bg-primary absolute top-1/2 -left-2 h-7 w-0.5 -translate-y-1/2 rounded-full lg:-left-3"
        />
      ) : null}
      {editing && meta.draft ? (
        <EditorField error={meta.errors?.name}>
          <Input
            autoFocus
            value={meta.draft.name}
            onChange={(event) => meta.updateDraft({ name: event.target.value })}
            onKeyDown={(event) => handleEditorKeyDown(event, meta)}
            aria-invalid={Boolean(meta.errors?.name)}
            aria-label={`Edit name for ${plan.name}`}
            autoComplete="off"
            className={cn("h-8", meta.errors?.name && "border-destructive")}
          />
        </EditorField>
      ) : (
        <div className="flex min-w-0 flex-col">
          <span className="text-foreground truncate text-sm font-medium">
            {plan.name}
          </span>
          <span className="text-muted-foreground truncate text-xs tabular-nums">
            {plan.code}
          </span>
        </div>
      )}
    </div>
  )
}

function AudienceCell({
  plan,
  meta,
}: {
  plan: PricingPlan
  meta: PlanTableMeta
}) {
  if (meta.editingRowId === plan.id && meta.draft) {
    const value = meta.draft.audience
    return (
      <Select
        value={value}
        onValueChange={(next) => {
          if (next) meta.updateDraft({ audience: next as PlanAudience })
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label={`Edit audience for ${plan.name}`}
          className="h-8 w-full"
        >
          <SelectValue>
            {(selected) =>
              typeof selected === "string" ? (
                <AudienceBadge audience={selected as PlanAudience} />
              ) : null
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          <SelectGroup>
            {PLAN_AUDIENCES.map((option) => (
              <SelectItem key={option} value={option}>
                <AudienceBadge audience={option} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    )
  }

  return <AudienceBadge audience={plan.audience} />
}

function PriceCell({ plan, meta }: { plan: PricingPlan; meta: PlanTableMeta }) {
  if (meta.editingRowId === plan.id && meta.draft) {
    return (
      <EditorField error={meta.errors?.price}>
        <Input
          inputMode="decimal"
          value={meta.draft.price}
          onChange={(event) => meta.updateDraft({ price: event.target.value })}
          onKeyDown={(event) => handleEditorKeyDown(event, meta)}
          aria-invalid={Boolean(meta.errors?.price)}
          aria-label={`Edit monthly price for ${plan.name}`}
          autoComplete="off"
          className={cn(
            "h-8 text-right tabular-nums",
            meta.errors?.price && "border-destructive"
          )}
        />
      </EditorField>
    )
  }

  return (
    <span className="flex items-baseline justify-end gap-1">
      <span className="text-foreground text-sm tabular-nums">
        {formatPrice(plan.price)}
      </span>
      <span className="text-muted-foreground text-xs">/mo</span>
    </span>
  )
}

function SeatsCell({ plan, meta }: { plan: PricingPlan; meta: PlanTableMeta }) {
  if (meta.editingRowId === plan.id && meta.draft) {
    return (
      <EditorField error={meta.errors?.seats}>
        <Input
          inputMode="numeric"
          value={meta.draft.seats}
          onChange={(event) => meta.updateDraft({ seats: event.target.value })}
          onKeyDown={(event) => handleEditorKeyDown(event, meta)}
          aria-invalid={Boolean(meta.errors?.seats)}
          aria-label={`Edit included seats for ${plan.name}`}
          autoComplete="off"
          className={cn(
            "h-8 text-right tabular-nums",
            meta.errors?.seats && "border-destructive"
          )}
        />
      </EditorField>
    )
  }

  return (
    <span className="text-foreground block text-right text-sm tabular-nums">
      {plan.seats}
    </span>
  )
}

function TrialCell({ plan, meta }: { plan: PricingPlan; meta: PlanTableMeta }) {
  if (meta.editingRowId === plan.id && meta.draft) {
    return (
      <EditorField error={meta.errors?.trialDays}>
        <Input
          inputMode="numeric"
          value={meta.draft.trialDays}
          onChange={(event) =>
            meta.updateDraft({ trialDays: event.target.value })
          }
          onKeyDown={(event) => handleEditorKeyDown(event, meta)}
          aria-invalid={Boolean(meta.errors?.trialDays)}
          aria-label={`Edit trial length for ${plan.name}`}
          autoComplete="off"
          className={cn(
            "h-8 text-right tabular-nums",
            meta.errors?.trialDays && "border-destructive"
          )}
        />
      </EditorField>
    )
  }

  const noTrial = plan.trialDays === 0

  return (
    <span
      className={cn(
        "block text-right text-sm tabular-nums",
        noTrial ? "text-muted-foreground" : "text-foreground"
      )}
    >
      {formatTrial(plan.trialDays)}
    </span>
  )
}

function VisibilityCell({
  plan,
  meta,
}: {
  plan: PricingPlan
  meta: PlanTableMeta
}) {
  if (meta.editingRowId === plan.id && meta.draft) {
    const value = meta.draft.visibility
    return (
      <Select
        value={value}
        onValueChange={(next) => {
          if (next) meta.updateDraft({ visibility: next as PlanVisibility })
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label={`Edit visibility for ${plan.name}`}
          className="h-8 w-full"
        >
          <SelectValue>
            {(selected) =>
              typeof selected === "string" ? (
                <VisibilityBadge visibility={selected as PlanVisibility} />
              ) : null
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          <SelectGroup>
            {PLAN_VISIBILITIES.map((option) => (
              <SelectItem key={option} value={option}>
                <VisibilityBadge visibility={option} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    )
  }

  return <VisibilityBadge visibility={plan.visibility} />
}

function FeaturedCell({
  plan,
  meta,
}: {
  plan: PricingPlan
  meta: PlanTableMeta
}) {
  if (meta.editingRowId === plan.id && meta.draft) {
    return (
      <div className="flex justify-center">
        <Switch
          size="sm"
          checked={meta.draft.featured}
          onCheckedChange={(checked) => meta.updateDraft({ featured: checked })}
          aria-label={`Toggle featured for ${plan.name}`}
        />
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      {plan.featured ? (
        <Badge variant="primary-light">Featured</Badge>
      ) : (
        <span className="text-muted-foreground text-sm">Off</span>
      )}
    </div>
  )
}

function ActionsCell({
  plan,
  meta,
}: {
  plan: PricingPlan
  meta: PlanTableMeta
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const editing = meta.editingRowId === plan.id

  const handleDeleteConfirm = () => {
    meta.deleteRow(plan.id)
    setDeleteOpen(false)
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <RowAction
          label="Cancel"
          onClick={meta.cancelEdit}
          icon={
            <XIcon aria-hidden="true" />
          }
        />
        <RowAction
          label="Save"
          variant="default"
          disabled={meta.hasErrors}
          onClick={meta.saveEdit}
          icon={
            <CheckIcon aria-hidden="true" />
          }
        />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <RowAction
        label="Edit"
        disabled={meta.isLocked}
        onClick={() => meta.startEdit(plan.id)}
        icon={
          <SquarePenIcon aria-hidden="true" />
        }
      />
      <RowAction
        label="Duplicate"
        disabled={meta.isLocked}
        onClick={() => meta.duplicateRow(plan.id)}
        icon={
          <CopyIcon aria-hidden="true" />
        }
      />
      <RowAction
        label="Delete"
        disabled={meta.isLocked}
        className="hover:text-destructive"
        onClick={() => setDeleteOpen(true)}
        icon={
          <Trash2Icon aria-hidden="true" />
        }
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <span className="text-foreground font-medium">{plan.name}</span>{" "}
              from the catalog. Connect your billing API to persist changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// prettier-ignore
function readMeta(table: { options: { meta?: unknown } }): PlanTableMeta {
  return table.options.meta as PlanTableMeta
}

export function createPlanColumns(): ColumnDef<
  DataGridFeatures,
  PricingPlan
>[] {
  return [
    {
      accessorKey: "name",
      id: "plan",
      header: ({ column }) => (
        <DataGridColumnHeader title="Plan" column={column} />
      ),
      cell: ({ row, table }) => (
        <PlanCell plan={row.original} meta={readMeta(table)} />
      ),
      enableHiding: false,
      enableSorting: false,
      minSize: 200,
      meta: { headerTitle: "Plan", autoSize: true },
    },
    {
      accessorKey: "audience",
      id: "audience",
      header: ({ column }) => (
        <DataGridColumnHeader title="Audience" column={column} />
      ),
      cell: ({ row, table }) => (
        <AudienceCell plan={row.original} meta={readMeta(table)} />
      ),
      enableSorting: false,
      size: 140,
      meta: { headerTitle: "Audience" },
    },
    {
      accessorKey: "price",
      id: "price",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Price"
          column={column}
          className="w-full justify-end text-right"
        />
      ),
      cell: ({ row, table }) => (
        <PriceCell plan={row.original} meta={readMeta(table)} />
      ),
      enableSorting: false,
      size: 128,
      meta: { headerTitle: "Price", headerClassName: "text-right!" },
    },
    {
      accessorKey: "seats",
      id: "seats",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Seats"
          column={column}
          className="w-full justify-end text-right"
        />
      ),
      cell: ({ row, table }) => (
        <SeatsCell plan={row.original} meta={readMeta(table)} />
      ),
      enableSorting: false,
      size: 96,
      meta: { headerTitle: "Seats", headerClassName: "text-right!" },
    },
    {
      accessorKey: "trialDays",
      id: "trial",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Trial"
          column={column}
          className="w-full justify-end text-right"
        />
      ),
      cell: ({ row, table }) => (
        <TrialCell plan={row.original} meta={readMeta(table)} />
      ),
      enableSorting: false,
      size: 110,
      meta: { headerTitle: "Trial", headerClassName: "text-right!" },
    },
    {
      accessorKey: "visibility",
      id: "visibility",
      header: ({ column }) => (
        <DataGridColumnHeader title="Visibility" column={column} />
      ),
      cell: ({ row, table }) => (
        <VisibilityCell plan={row.original} meta={readMeta(table)} />
      ),
      enableSorting: false,
      size: 138,
      meta: { headerTitle: "Visibility" },
    },
    {
      accessorKey: "featured",
      id: "featured",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Featured"
          column={column}
          className="w-full justify-center text-center"
        />
      ),
      cell: ({ row, table }) => (
        <FeaturedCell plan={row.original} meta={readMeta(table)} />
      ),
      enableSorting: false,
      size: 112,
      meta: { headerTitle: "Featured", headerClassName: "text-center!" },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row, table }) => (
        <ActionsCell plan={row.original} meta={readMeta(table)} />
      ),
      enableHiding: false,
      enableSorting: false,
      size: 120,
    },
  ]
}