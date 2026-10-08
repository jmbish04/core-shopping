import { type RefObject } from "react"

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

import { WORKSPACE_NAME } from "./data"

/** Centred by layout, not the stock -50% translate: an odd height lands that on
 *  a half pixel and smears every 1px separator across two rows. */
const CRISP_CENTER = "inset-0 m-auto h-fit translate-x-0 translate-y-0"

/** The sheet menu's Delete Job confirm; `origin` takes focus back on Cancel. */
export type PendingDelete = {
  id: string
  name: string
  origin: HTMLElement | null
}

/** The record the sheet moves to after a delete: the next survivor, else the
 *  previous one, else null when none is left. */
export function survivingNeighbour(orderedIds: string[], deleted: string[]) {
  const first = orderedIds.findIndex((id) => deleted.includes(id))
  const survives = (id: string) => !deleted.includes(id)
  return (
    orderedIds.slice(first + 1).find(survives) ??
    orderedIds.slice(0, Math.max(first, 0)).reverse().find(survives) ??
    null
  )
}

export function DeleteJobsDialog({
  open,
  onOpenChange,
  pending,
  focusTargetRef,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Kept while the dialog closes, so the exit animation keeps its copy. */
  pending: PendingDelete | null
  /** Set by a confirm to the sheet's trigger; read once on close. */
  focusTargetRef: RefObject<HTMLElement | null>
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        size="sm"
        className={CRISP_CENTER}
        finalFocus={() => {
          // A confirm sets the sheet's trigger; Cancel falls back to the opener.
          const node = focusTargetRef.current ?? pending?.origin
          focusTargetRef.current = null
          return node?.isConnected ? node : true
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Job?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="text-foreground font-medium">{pending?.name}</span>{" "}
            and its run history leave {WORKSPACE_NAME}. Scheduled runs stop at
            once.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete Job
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}