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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  formatCurrency,
  formatStock,
  LOW_STOCK_THRESHOLD,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  validateName,
  validatePrice,
  validateStock,
  type Product,
  type ProductStatus,
} from "./data"
import { TriangleAlertIcon, MoreHorizontalIcon, CopyIcon, Trash2Icon } from "lucide-react"

export type EditField = "name" | "price" | "stock" | "category" | "status"

export interface EditingCell {
  rowId: string
  field: EditField
}

/** Threaded into cells via `table.options.meta` so columns never rebuild on keystroke. */
export interface InventoryTableMeta {
  editingCell: EditingCell | null
  startEdit: (rowId: string, field: EditField) => void
  cancelEdit: () => void
  commitText: (rowId: string, value: string) => void
  commitNumber: (rowId: string, field: "price" | "stock", value: number) => void
  commitSelect: (
    rowId: string,
    field: "category" | "status",
    value: string
  ) => void
  toggleVisible: (rowId: string) => void
  duplicateRow: (rowId: string) => void
  deleteRow: (rowId: string) => void
  isRowDirty: (rowId: string) => boolean
}

const statusVariant: Record<
  ProductStatus,
  ComponentProps<typeof Badge>["variant"]
> = {
  Active: "success-light",
  Draft: "warning-light",
  Archived: "destructive-light",
}

/** Status as its semantic badge. Shared by the cell, the edit dropdown, and the status filter. */
export function StatusBadge({ status }: { status: ProductStatus }) {
  return <Badge variant={statusVariant[status]}>{status}</Badge>
}

function isEditing(meta: InventoryTableMeta, rowId: string, field: EditField) {
  return meta.editingCell?.rowId === rowId && meta.editingCell.field === field
}

// ── Editable display trigger (click or keyboard to enter edit mode) ──

function EditableTrigger({
  ariaLabel,
  onStart,
  className,
  children,
}: {
  ariaLabel: string
  onStart: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onStart}
      className={cn(
        "hover:bg-muted/60 focus-visible:ring-ring/60 -mx-1.5 flex h-8 w-[calc(100%+0.75rem)] items-center px-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset",
        className
      )}
    >
      {children}
    </button>
  )
}

function CellError({ message }: { message: string }) {
  return (
    <span
      role="alert"
      className="text-destructive absolute top-full left-0 z-20 mt-1 text-[11px] leading-none font-medium"
    >
      {message}
    </span>
  )
}

// ── Inline editors ──

function TextCellEditor({
  initial,
  validate,
  onCommit,
  onCancel,
  ariaLabel,
}: {
  initial: string
  validate: (value: string) => string | null
  onCommit: (value: string) => void
  onCancel: () => void
  ariaLabel: string
}) {
  const [draft, setDraft] = useState(initial)
  const error = validate(draft)

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      if (!error) onCommit(draft.trim())
    } else if (event.key === "Escape") {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="relative">
      <Input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => (error ? onCancel() : onCommit(draft.trim()))}
        aria-invalid={Boolean(error)}
        aria-label={ariaLabel}
        autoComplete="off"
        className={cn("h-8", error && "border-destructive")}
      />
      {error ? <CellError message={error} /> : null}
    </div>
  )
}

function NumberCellEditor({
  initial,
  validate,
  onCommit,
  onCancel,
  ariaLabel,
}: {
  initial: string
  validate: (value: string) => string | null
  onCommit: (value: number) => void
  onCancel: () => void
  ariaLabel: string
}) {
  const [draft, setDraft] = useState(initial)
  const error = validate(draft)

  const commit = () => {
    if (!error) onCommit(Number(draft.trim()))
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      commit()
    } else if (event.key === "Escape") {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="relative">
      <Input
        autoFocus
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => (error ? onCancel() : commit())}
        aria-invalid={Boolean(error)}
        aria-label={ariaLabel}
        autoComplete="off"
        className={cn(
          "h-8 text-right tabular-nums",
          error && "border-destructive"
        )}
      />
      {error ? <CellError message={error} /> : null}
    </div>
  )
}

function SelectCellEditor({
  value,
  options,
  ariaLabel,
  onCommit,
  onCancel,
  renderOption,
}: {
  value: string
  options: readonly string[]
  ariaLabel: string
  onCommit: (value: string) => void
  onCancel: () => void
  /** Renders each option + the selected value (e.g. status badges); plain text when omitted. */
  renderOption?: (value: string) => ReactNode
}) {
  return (
    <Select
      defaultOpen
      value={value}
      onValueChange={(next) => {
        if (next) onCommit(next)
      }}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <SelectTrigger size="sm" aria-label={ariaLabel} className="h-8 w-full">
        {renderOption ? (
          <SelectValue>
            {(selected) =>
              typeof selected === "string" ? renderOption(selected) : null
            }
          </SelectValue>
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {renderOption ? renderOption(option) : option}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

// ── Display cells ──

function ProductCell({
  product,
  meta,
}: {
  product: Product
  meta: InventoryTableMeta
}) {
  const dirty = meta.isRowDirty(product.id)

  return (
    <div className="relative flex min-w-0 items-center">
      {dirty ? (
        <span
          aria-hidden="true"
          className="bg-primary absolute top-1 bottom-1 -left-1.5 w-0.5 rounded-full lg:-left-2"
        />
      ) : null}
      {isEditing(meta, product.id, "name") ? (
        <TextCellEditor
          initial={product.name}
          validate={validateName}
          ariaLabel={`Edit name for ${product.name}`}
          onCommit={(value) => meta.commitText(product.id, value)}
          onCancel={meta.cancelEdit}
        />
      ) : (
        <EditableTrigger
          ariaLabel={`Edit name for ${product.name}`}
          onStart={() => meta.startEdit(product.id, "name")}
          className="cursor-text"
        >
          <div className="flex min-w-0 flex-col">
            <span className="text-foreground truncate text-sm font-medium">
              {product.name}
            </span>
            <span className="text-muted-foreground truncate text-xs tabular-nums">
              {product.sku}
            </span>
          </div>
        </EditableTrigger>
      )}
    </div>
  )
}

function CategoryCell({
  product,
  meta,
}: {
  product: Product
  meta: InventoryTableMeta
}) {
  if (isEditing(meta, product.id, "category")) {
    return (
      <SelectCellEditor
        value={product.category}
        options={PRODUCT_CATEGORIES}
        ariaLabel={`Edit category for ${product.name}`}
        onCommit={(value) => meta.commitSelect(product.id, "category", value)}
        onCancel={meta.cancelEdit}
      />
    )
  }

  return (
    <EditableTrigger
      ariaLabel={`Edit category for ${product.name}`}
      onStart={() => meta.startEdit(product.id, "category")}
      className="cursor-pointer"
    >
      <span className="text-foreground truncate text-sm">
        {product.category}
      </span>
    </EditableTrigger>
  )
}

function PriceCell({
  product,
  meta,
}: {
  product: Product
  meta: InventoryTableMeta
}) {
  if (isEditing(meta, product.id, "price")) {
    return (
      <NumberCellEditor
        initial={String(product.price)}
        validate={validatePrice}
        ariaLabel={`Edit price for ${product.name}`}
        onCommit={(value) => meta.commitNumber(product.id, "price", value)}
        onCancel={meta.cancelEdit}
      />
    )
  }

  return (
    <EditableTrigger
      ariaLabel={`Edit price for ${product.name}`}
      onStart={() => meta.startEdit(product.id, "price")}
      className="cursor-text justify-end"
    >
      <span className="text-foreground text-sm tabular-nums">
        {formatCurrency(product.price)}
      </span>
    </EditableTrigger>
  )
}

function StockCell({
  product,
  meta,
}: {
  product: Product
  meta: InventoryTableMeta
}) {
  if (isEditing(meta, product.id, "stock")) {
    return (
      <NumberCellEditor
        initial={String(product.stock)}
        validate={validateStock}
        ariaLabel={`Edit stock for ${product.name}`}
        onCommit={(value) => meta.commitNumber(product.id, "stock", value)}
        onCancel={meta.cancelEdit}
      />
    )
  }

  const low =
    product.stock <= LOW_STOCK_THRESHOLD && product.status !== "Archived"

  return (
    <EditableTrigger
      ariaLabel={`Edit stock for ${product.name}${low ? ", low stock" : ""}`}
      onStart={() => meta.startEdit(product.id, "stock")}
      className="cursor-text justify-end"
    >
      <span className="flex items-center justify-end gap-1.5">
        {low ? (
          <Tooltip>
            <TooltipTrigger
              render={<span className="text-warning inline-flex shrink-0" />}
            >
              <TriangleAlertIcon className="size-4" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent side="top">
              {`Low stock, ${LOW_STOCK_THRESHOLD} units or fewer`}
            </TooltipContent>
          </Tooltip>
        ) : null}
        <span className="text-foreground text-sm tabular-nums">
          {formatStock(product.stock)}
        </span>
      </span>
    </EditableTrigger>
  )
}

function StatusCell({
  product,
  meta,
}: {
  product: Product
  meta: InventoryTableMeta
}) {
  if (isEditing(meta, product.id, "status")) {
    return (
      <SelectCellEditor
        value={product.status}
        options={PRODUCT_STATUSES}
        ariaLabel={`Edit status for ${product.name}`}
        onCommit={(value) => meta.commitSelect(product.id, "status", value)}
        onCancel={meta.cancelEdit}
        renderOption={(value) => (
          <StatusBadge status={value as ProductStatus} />
        )}
      />
    )
  }

  return (
    <EditableTrigger
      ariaLabel={`Edit status for ${product.name}`}
      onStart={() => meta.startEdit(product.id, "status")}
      className="cursor-pointer"
    >
      <StatusBadge status={product.status} />
    </EditableTrigger>
  )
}

function VisibleCell({
  product,
  meta,
}: {
  product: Product
  meta: InventoryTableMeta
}) {
  return (
    <div className="flex justify-center">
      <Switch
        size="sm"
        checked={product.visible}
        onCheckedChange={() => meta.toggleVisible(product.id)}
        aria-label={`Toggle storefront visibility for ${product.name}`}
      />
    </div>
  )
}

function ActionsCell({
  product,
  meta,
}: {
  product: Product
  meta: InventoryTableMeta
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleDeleteConfirm = () => {
    meta.deleteRow(product.id)
    setDeleteOpen(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Actions for ${product.name}`}
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        {/* Content */}
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => meta.duplicateRow(product.id)}>
              <CopyIcon aria-hidden="true" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <span className="text-foreground font-medium">
                {product.name}
              </span>{" "}
              from the working set. Connect your product API to persist changes.
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
    </>
  )
}

// prettier-ignore
function readMeta(table: { options: { meta?: unknown } }): InventoryTableMeta {
  return table.options.meta as InventoryTableMeta
}

export function createInventoryColumns(): ColumnDef<
  DataGridFeatures,
  Product
>[] {
  return [
    {
      accessorKey: "name",
      id: "product",
      header: ({ column }) => (
        <DataGridColumnHeader title="Product" column={column} />
      ),
      cell: ({ row, table }) => (
        <ProductCell product={row.original} meta={readMeta(table)} />
      ),
      enableHiding: false,
      enableSorting: false,
      minSize: 240,
      meta: { headerTitle: "Product" },
    },
    {
      accessorKey: "category",
      id: "category",
      header: ({ column }) => (
        <DataGridColumnHeader title="Category" column={column} />
      ),
      cell: ({ row, table }) => (
        <CategoryCell product={row.original} meta={readMeta(table)} />
      ),
      enableSorting: false,
      size: 170,
      meta: { headerTitle: "Category" },
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
        <PriceCell product={row.original} meta={readMeta(table)} />
      ),
      enableSorting: false,
      size: 130,
      meta: { headerTitle: "Price", headerClassName: "text-right!" },
    },
    {
      accessorKey: "stock",
      id: "stock",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Stock"
          column={column}
          className="w-full justify-end text-right"
        />
      ),
      cell: ({ row, table }) => (
        <StockCell product={row.original} meta={readMeta(table)} />
      ),
      enableSorting: false,
      size: 130,
      meta: { headerTitle: "Stock", headerClassName: "text-right!" },
    },
    {
      accessorKey: "status",
      id: "status",
      header: ({ column }) => (
        <DataGridColumnHeader title="Status" column={column} />
      ),
      cell: ({ row, table }) => (
        <StatusCell product={row.original} meta={readMeta(table)} />
      ),
      enableSorting: false,
      size: 130,
      meta: { headerTitle: "Status" },
    },
    {
      accessorKey: "visible",
      id: "visible",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Visible"
          column={column}
          className="w-full justify-center text-center"
        />
      ),
      cell: ({ row, table }) => (
        <VisibleCell product={row.original} meta={readMeta(table)} />
      ),
      enableSorting: false,
      size: 96,
      meta: { headerTitle: "Visible", headerClassName: "text-center!" },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row, table }) => (
        <div className="flex justify-end">
          <ActionsCell product={row.original} meta={readMeta(table)} />
        </div>
      ),
      enableHiding: false,
      enableSorting: false,
      size: 56,
    },
  ]
}