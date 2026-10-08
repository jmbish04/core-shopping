import { useState, type FormEvent, type RefObject } from "react"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

/** Centred by layout, not the stock -50% translate: an odd height lands that on
 *  a half pixel and smears every 1px separator across two rows. */
export const CRISP_CENTER = "inset-0 m-auto h-fit translate-x-0 translate-y-0"

const MAX_NAME = 32

function nameError(name: string, takenNames: string[]) {
  const trimmed = name.trim()
  if (!trimmed) return "Give the view a name."
  if (trimmed.length > MAX_NAME)
    return `Keep the name to ${MAX_NAME} characters.`
  const lower = trimmed.toLowerCase()
  if (takenNames.some((taken) => taken.toLowerCase() === lower))
    return "A view with this name already exists."
  return null
}

function SaveViewForm({
  takenNames,
  onSave,
}: {
  takenNames: string[]
  onSave: (name: string) => void
}) {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const problem = nameError(name, takenNames)
    if (problem) {
      setError(problem)
      return
    }
    onSave(name.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Save View</DialogTitle>
        <DialogDescription>
          Keeps these filters one click away.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="devops-2-view-name">Name</FieldLabel>
          <Input
            id="devops-2-view-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (error) setError(null)
            }}
            placeholder="Prod denials this week"
            aria-invalid={error ? true : undefined}
            autoComplete="off"
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit">Save View</Button>
      </DialogFooter>
    </form>
  )
}

export function SaveViewDialog({
  formKey,
  open,
  onOpenChange,
  takenNames,
  returnFocus,
  onSave,
}: {
  formKey: number
  open: boolean
  onOpenChange: (open: boolean) => void
  takenNames: string[]
  returnFocus: RefObject<HTMLElement | null>
  onSave: (name: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(CRISP_CENTER, "sm:max-w-md")}
        finalFocus={() => returnFocus.current ?? true}
      >
        <SaveViewForm key={formKey} takenNames={takenNames} onSave={onSave} />
      </DialogContent>
    </Dialog>
  )
}