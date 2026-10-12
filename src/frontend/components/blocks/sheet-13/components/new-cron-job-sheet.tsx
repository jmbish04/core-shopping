"use client"

/**
 * New cron job sheet: the create form for one scheduled command on Harbor Ops.
 * Open by default over its trigger; Create Job toasts and closes.
 * Customize: people, services and presets in data.tsx; fields in job-form-fields.tsx.
 */
import { useRef, useState, type FormEvent } from "react"
import { flushSync } from "react-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { nextFires, validateSchedule } from "./cron"
import {
  formatRelative,
  formatWhen,
  NEW_JOB_DRAFT,
  offsetOf,
  REFERENCE_MS,
  WORKSPACE_NAME,
  type JobDraft,
} from "./data"
import { TOAST_SUCCESS_ICON, UI_ICONS } from "./icons"
import {
  focusFirstError,
  JobFormFields,
  validateDraft,
} from "./job-form-fields"
import { DotSeparator } from "./value-faces"
import { PlusIcon } from "lucide-react"

/** The floating inset shell: header band, scroll body, pinned footer. */
const SHEET_SHELL =
  "inset-y-4 right-4 left-auto flex h-[calc(100svh-2rem)] w-[min(36rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 outline-none"

/** Pinned under the scrolling body; px-5 keeps it on the band's spine. */
const SHEET_FOOTER =
  "bg-muted flex shrink-0 items-center gap-2 border-t px-5 py-3"

const FORM_ID = "sheet-13-new-job-form"
const ID_PREFIX = "sheet-13-new"
/** JobFormFields ids its Name input `${idPrefix}-name`; the sheet opens on it. */
const NAME_FIELD = `#${ID_PREFIX}-name`

/** Mounted by SheetContent on every open, so each open seeds a fresh form. */
function NewJobForm({
  onCreate,
  onDone,
}: {
  onCreate: (draft: JobDraft) => void
  onDone: () => void
}) {
  const [values, setValues] = useState<JobDraft>(NEW_JOB_DRAFT)
  // Errors stay hidden until Create is refused; closing remounts a calm form.
  const [attempted, setAttempted] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const schedule = validateSchedule(
    values.schedule,
    offsetOf(values.timezone),
    REFERENCE_MS
  )
  const [firstRun] = schedule.ok
    ? nextFires(schedule.cron, offsetOf(values.timezone), REFERENCE_MS, 1)
    : []

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validateDraft(values)
    if (Object.keys(errors).length > 0) {
      // Committed first, so the scroll measures each field with its message.
      flushSync(() => setAttempted(true))
      void focusFirstError(bodyRef.current, ID_PREFIX, errors)
      return
    }
    setAttempted(false)
    onCreate({
      ...values,
      name: values.name.trim(),
      command: values.command.trim(),
      schedule: values.schedule.trim(),
    })
    onDone()
  }

  return (
    <>
      {/* Header band */}
      <div className="flex shrink-0 flex-col border-b px-5 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <SheetTitle className="min-w-0 text-lg">New Job</SheetTitle>
          <SheetClose
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
              />
            }
          >
            {UI_ICONS.close}
          </SheetClose>
        </div>
        <SheetDescription className="mt-1">
          Schedule a command on {WORKSPACE_NAME}.
        </SheetDescription>
      </div>

      <form
        id={FORM_ID}
        noValidate
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* Only the body scrolls; the header band and footer stay put. */}
        <div
          ref={bodyRef}
          className="scroll-fade-y no-scrollbar min-h-0 flex-1 scroll-py-10 overflow-y-auto"
        >
          <div className="flex flex-col gap-5 px-5 py-5">
            <JobFormFields
              idPrefix={ID_PREFIX}
              values={values}
              onChange={(patch) =>
                setValues((current) => ({ ...current, ...patch }))
              }
              showErrors={attempted}
            />
          </div>
        </div>

        <div className={SHEET_FOOTER}>
          {/* The first fire stays in view while the body scrolls. */}
          <p
            aria-live="polite"
            className="text-muted-foreground me-auto flex min-w-0 items-center gap-1.5 text-xs tabular-nums"
          >
            {firstRun !== undefined ? (
              <>
                <span className="truncate">
                  First run {formatRelative(firstRun)}
                </span>
                <DotSeparator className="max-sm:hidden" />
                <span className="shrink-0 max-sm:hidden">
                  {formatWhen(firstRun)}
                </span>
              </>
            ) : (
              <span className="truncate">No first run yet</span>
            )}
          </p>
          <SheetClose render={<Button type="button" variant="outline" />}>
            Cancel
          </SheetClose>
          <Button type="submit">
            {UI_ICONS.plus}
            Create Job
          </Button>
        </div>
      </form>
    </>
  )
}

export function NewCronJobSheet() {
  const [open, setOpen] = useState(true)
  const popupRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function handleCreate(draft: JobDraft) {
    toast.success("Job created", {
      description: draft.name,
      icon: TOAST_SUCCESS_ICON,
    })
  }

  return (
    // Open by default; the trigger reopens it with a fresh form.
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="flex min-h-[360px] items-center justify-center">
        <SheetTrigger
          render={
            <Button ref={triggerRef} type="button" variant="outline" size="lg">
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              New Job
            </Button>
          }
        />
      </div>

      <SheetContent
        ref={popupRef}
        side="right"
        showCloseButton={false}
        initialFocus={() =>
          popupRef.current?.querySelector<HTMLElement>(NAME_FIELD) ?? true
        }
        // The default-open mount has no opener, so focus returns to the trigger.
        finalFocus={triggerRef}
        className={SHEET_SHELL}
      >
        <NewJobForm onCreate={handleCreate} onDone={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}