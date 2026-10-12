import { useRef, useState } from "react"
import { Badge } from "@/components/reui/badge"

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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { type SavedView } from "./data"
import { UI_ICONS } from "./icons"
import { CRISP_CENTER, SaveViewDialog } from "./save-view-dialog"

export function ViewsMenu({
  views,
  activeView,
  edited,
  counts,
  onSelectView,
  onSaveView,
  onResetView,
  onDeleteView,
}: {
  views: SavedView[]
  activeView: SavedView
  edited: boolean
  /** Events in the current range that each view's rules match. */
  counts: Map<string, number>
  onSelectView: (id: string) => void
  onSaveView: (name: string) => void
  onResetView: () => void
  onDeleteView: (view: SavedView) => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  // A fresh form per open, so a cancelled name never comes back.
  const [saveSeq, setSaveSeq] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Kept after closing, so the dialog copy holds through its exit.
  const [deleteTarget, setDeleteTarget] = useState<SavedView>(activeView)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              ref={triggerRef}
              type="button"
              variant="outline"
              aria-label={`View, ${activeView.name}${edited ? ", edited" : ""}`}
              className="min-w-0"
            />
          }
        >
          {UI_ICONS.bookmark}
          <span className="max-w-36 truncate">{activeView.name}</span>
          {edited ? (
            <Badge variant="outline" radius="full">
              Edited
            </Badge>
          ) : null}
          {UI_ICONS.chevronDown}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuRadioGroup
            aria-label="Saved views"
            value={activeView.id}
            onValueChange={(next) => onSelectView(String(next))}
          >
            <DropdownMenuLabel>Saved views</DropdownMenuLabel>
            {views.map((view) => (
              <DropdownMenuRadioItem key={view.id} value={view.id} closeOnClick>
                <span className="min-w-0 truncate">{view.name}</span>
                <span className="text-muted-foreground ms-auto text-xs tabular-nums">
                  {counts.get(view.id) ?? 0}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup aria-label="Manage">
            <DropdownMenuLabel>Manage</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={!edited}
              onClick={() => {
                setSaveSeq((seq) => seq + 1)
                setSaveOpen(true)
              }}
            >
              {UI_ICONS.save}
              Save current view
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!edited} onClick={onResetView}>
              {UI_ICONS.reset}
              Reset view
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={activeView.builtIn}
              onClick={() => {
                setDeleteTarget(activeView)
                setDeleteOpen(true)
              }}
            >
              {UI_ICONS.trash}
              Delete view
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <SaveViewDialog
        formKey={saveSeq}
        open={saveOpen}
        onOpenChange={setSaveOpen}
        takenNames={views.map((view) => view.name)}
        returnFocus={triggerRef}
        onSave={(name) => {
          onSaveView(name)
          setSaveOpen(false)
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent
          size="sm"
          className={CRISP_CENTER}
          finalFocus={() => triggerRef.current ?? true}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete View?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="text-foreground font-medium">
                {deleteTarget.name}
              </span>{" "}
              and its filters leave the views menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDeleteView(deleteTarget)
                setDeleteOpen(false)
              }}
            >
              Delete View
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}