import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Badge } from "@/components/reui/badge"
import { flushSync } from "react-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  ButtonGroup,
  ButtonGroupText,
} from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { describeCron } from "./cron"
import {
  draftOf,
  healthOf,
  isRunning,
  parseSchedule,
  TIMEZONE_BY_ID,
  triageOrder,
  type CronJob,
  type JobDraft,
  type SheetTab,
} from "./data"
import {
  DeleteJobsDialog,
  survivingNeighbour,
  type PendingDelete,
} from "./delete-jobs-dialog"
import { TOAST_ERROR_ICON, TRIGGER_ICON, UI_ICONS } from "./icons"
import {
  focusFirstError,
  JobFormFields,
  sameDraft,
  SETTINGS_SECTIONS,
  validateDraft,
  withErrorSections,
} from "./job-form-fields"
import { JobOverviewTab, OVERVIEW_SECTIONS } from "./job-overview-tab"
import { JobRunsTab } from "./job-runs-tab"
import { useJobStore } from "./job-store"
import { DotSeparator, HealthFace, ServiceFace } from "./value-faces"

/** The record the sheet opens on: the failing job with the richest log. */
const DEFAULT_JOB_ID = "JOB-219"

/** The open sections of each collapsible tab; the Runs rows keep their own. */
type OpenSections = { overview: string[]; settings: string[] }

const SHEET_TABS: { value: SheetTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "runs", label: "Runs" },
  { value: "settings", label: "Settings" },
]

const FORM_ID = "sheet-12-job-form"
const ID_PREFIX = "sheet-12-edit"

/** The floating inset shell: a full-height card held off every edge. */
const SHEET_SHELL =
  "inset-y-4 right-4 left-auto flex h-[calc(100svh-2rem)] w-[min(36rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 outline-none"

/** Pinned under the scrolling body; px-5 keeps it on the band's spine. */
const SHEET_FOOTER =
  "bg-muted flex shrink-0 items-center gap-2 border-t px-5 py-3"

type SheetActions = {
  onTabChange: (tab: SheetTab) => void
  onClose: () => void
  onRun: (id: string) => void
  onRetry: (id: string) => void
  onPauseToggle: (job: CronJob) => void
  onSkipToggle: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (job: CronJob) => void
  onSave: (id: string, draft: JobDraft) => void
}

/** The open run: the newest failure, else the newest run. */
function defaultExpanded(job: CronJob): string | null {
  const failure = job.runs.find(
    (run) => run.status === "failed" || run.status === "timedOut"
  )
  return failure?.id ?? job.runs[0]?.id ?? null
}

/** Mono id with an inline copy swap; a refused clipboard says so. */
function JobIdChip({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current)
    }
  }, [])

  function handleCopy() {
    const failed = () =>
      toast.error("Copy failed", {
        icon: TOAST_ERROR_ICON,
        description: "Clipboard access was blocked.",
      })
    // Clipboard access can be refused (an iframe, an insecure origin), so both paths answer.
    if (!navigator.clipboard) {
      failed()
      return
    }
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true)
      if (document.documentElement.dataset.demo === "frozen") return
      if (resetTimer.current) window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => setCopied(false), 2000)
    }, failed)
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="text-muted-foreground min-w-0 truncate font-mono text-xs">
        {id}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={copied ? "Job ID copied" : "Copy job ID"}
        onClick={handleCopy}
      >
        {copied ? UI_ICONS.check : UI_ICONS.copy}
      </Button>
    </div>
  )
}

function JobSheetView({
  job,
  tab,
  position,
  onStep,
  sections,
  onSectionsChange,
  actions,
}: {
  job: CronJob
  tab: SheetTab
  position: { index: number; total: number } | null
  onStep: (direction: 1 | -1) => void
  sections: OpenSections
  onSectionsChange: (patch: Partial<OpenSections>) => void
  actions: SheetActions
}) {
  const source = draftOf(job)
  const [draft, setDraft] = useState<JobDraft>(source)
  // Errors stay hidden until a save is refused; a save or Discard hides them.
  const [attempted, setAttempted] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(() =>
    defaultExpanded(job)
  )

  // A save or an Undo changes the record outside the form: a clean draft follows it.
  const [seenSource, setSeenSource] = useState(source)
  if (!sameDraft(seenSource, source)) {
    setSeenSource(source)
    if (sameDraft(draft, seenSource)) setDraft(source)
  }

  const dirty = !sameDraft(draft, source)
  const health = healthOf(job)
  const running = isRunning(job)
  const cron = parseSchedule(job)
  const zone = TIMEZONE_BY_ID.get(job.timezone)

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dirty) return
    const errors = validateDraft(draft)
    if (Object.keys(errors).length > 0) {
      // Committed first, so every error's section is open and each field
      // carries its message before the focus and the scroll.
      flushSync(() => {
        setAttempted(true)
        onSectionsChange({
          settings: withErrorSections(sections.settings, errors),
        })
      })
      void focusFirstError(bodyRef.current, ID_PREFIX, errors)
      return
    }
    setAttempted(false)
    const clean = {
      ...draft,
      name: draft.name.trim(),
      command: draft.command.trim(),
      schedule: draft.schedule.trim(),
    }
    // The form holds the saved values, so it reads pristine once the record updates.
    setDraft(clean)
    actions.onSave(job.id, clean)
  }

  function viewLog() {
    const failure = job.runs.find(
      (run) => run.status === "failed" || run.status === "timedOut"
    )
    if (failure) setExpandedRunId(failure.id)
    actions.onTabChange("runs")
  }

  return (
    <>
      {/* Header band */}
      <div className="flex shrink-0 flex-col border-b px-5 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <JobIdChip id={job.id} />
          <div className="flex shrink-0 items-center gap-1">
            {position ? (
              <ButtonGroup aria-label="Jobs">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Previous job"
                        disabled={position.index === 0 || dirty}
                        onClick={() => onStep(-1)}
                      />
                    }
                  >
                    {UI_ICONS.previous}
                  </TooltipTrigger>
                  <TooltipContent>Previous job</TooltipContent>
                </Tooltip>
                <ButtonGroupText className="min-w-16 justify-center text-xs tabular-nums">
                  {position.index + 1} of {position.total}
                </ButtonGroupText>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Next job"
                        disabled={
                          position.index === position.total - 1 || dirty
                        }
                        onClick={() => onStep(1)}
                      />
                    }
                  >
                    {UI_ICONS.next}
                  </TooltipTrigger>
                  <TooltipContent>Next job</TooltipContent>
                </Tooltip>
              </ButtonGroup>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="More job actions"
                  />
                }
              >
                {UI_ICONS.more}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="tabular-nums">
                    {job.id}
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={!job.enabled}
                    onClick={() => actions.onSkipToggle(job.id)}
                  >
                    {UI_ICONS.skip}
                    {job.skipFireAt !== undefined
                      ? "Keep Next Run"
                      : "Skip Next Run"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => actions.onDuplicate(job.id)}>
                    {UI_ICONS.copy}
                    Duplicate Job
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => actions.onDelete(job)}
                  >
                    {UI_ICONS.trash}
                    Delete Job
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              onClick={actions.onClose}
            >
              {UI_ICONS.close}
            </Button>
          </div>
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
          <SheetTitle className="min-w-0 text-lg">{job.name}</SheetTitle>
          <HealthFace health={health} />
        </div>
        <SheetDescription className="mt-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="font-mono">{job.schedule}</span>
            <DotSeparator />
            <span>
              {cron ? describeCron(cron) : "Custom schedule"} {zone?.short}
            </span>
            <DotSeparator />
            <ServiceFace service={job.service} compact />
          </span>
        </SheetDescription>
        <div className="mt-2.5 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={running}
            onClick={() => actions.onRun(job.id)}
          >
            {running ? <Spinner aria-hidden="true" /> : UI_ICONS.play}
            {running ? "Running" : "Run Now"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => actions.onPauseToggle(job)}
          >
            {job.enabled ? UI_ICONS.pause : UI_ICONS.play}
            {job.enabled ? "Pause" : "Resume"}
          </Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = SHEET_TABS.find((item) => item.value === value)
          if (next) actions.onTabChange(next.value)
        }}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="shrink-0 border-b px-5">
          <TabsList
            variant="line"
            className="-mb-px h-10! gap-5 bg-transparent p-0"
          >
            {SHEET_TABS.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="h-full! gap-1.5 px-0 text-sm font-medium after:-bottom-px!"
              >
                {item.label}
                {item.value === "runs" ? (
                  <Badge
                    variant="outline"
                    radius="full"
                    className="tabular-nums"
                  >
                    {job.runs.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Only the body scrolls; the header band, tabs and footer stay put. */}
        <div
          ref={bodyRef}
          className="scroll-fade-y no-scrollbar min-h-0 flex-1 scroll-py-10 overflow-y-auto"
        >
          <div className="flex flex-col gap-5 px-5 py-5">
            <TabsContent value="overview" className="flex flex-col gap-5">
              <JobOverviewTab
                job={job}
                onViewLog={viewLog}
                openSections={sections.overview}
                onOpenSectionsChange={(overview) =>
                  onSectionsChange({ overview })
                }
              />
            </TabsContent>
            <TabsContent value="runs">
              <JobRunsTab
                job={job}
                expandedRunId={expandedRunId}
                onExpandedChange={setExpandedRunId}
                onRun={() => actions.onRun(job.id)}
                onRetry={() => actions.onRetry(job.id)}
              />
            </TabsContent>
            <TabsContent value="settings">
              <form id={FORM_ID} noValidate onSubmit={handleSave}>
                <JobFormFields
                  idPrefix={ID_PREFIX}
                  values={draft}
                  onChange={(patch) =>
                    setDraft((current) => ({ ...current, ...patch }))
                  }
                  openSections={sections.settings}
                  onOpenSectionsChange={(settings) =>
                    onSectionsChange({ settings })
                  }
                  showErrors={attempted}
                />
              </form>
            </TabsContent>
          </div>
        </div>

        {tab === "settings" ? (
          <div className={SHEET_FOOTER}>
            <Button
              type="button"
              variant="outline"
              className="ms-auto"
              disabled={!dirty}
              onClick={() => {
                setDraft(source)
                setAttempted(false)
              }}
            >
              Discard
            </Button>
            <Button type="submit" form={FORM_ID} disabled={!dirty}>
              Save Changes
            </Button>
          </div>
        ) : null}
      </Tabs>
    </>
  )
}

export function CronJobSheet() {
  const store = useJobStore()
  const [open, setOpen] = useState(true)
  const [jobId, setJobId] = useState(DEFAULT_JOB_ID)
  const [tab, setTab] = useState<SheetTab>("overview")
  const popupRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Set while a delete confirm takes focus from the closing sheet.
  const deletingRef = useRef(false)
  // Both live outside the keyed view, so they survive a step's remount.
  const [announcement, setAnnouncement] = useState("")
  const [sections, setSections] = useState<OpenSections>({
    overview: OVERVIEW_SECTIONS,
    settings: SETTINGS_SECTIONS,
  })
  // The dialog keeps its last record while it closes, so the exit stays intact.
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const focusTargetRef = useRef<HTMLElement | null>(null)

  // Previous and Next walk the triage order: failing jobs first, then next fire.
  const orderedIds = useMemo(
    () => triageOrder(store.jobs).map((item) => item.id),
    [store.jobs]
  )
  const job = store.jobs.find((item) => item.id === jobId) ?? null
  const index = job ? orderedIds.indexOf(job.id) : -1
  const position = index >= 0 ? { index, total: orderedIds.length } : null

  function handleOpenChange(next: boolean) {
    // Any open hands focus back to the trigger when it closes again.
    if (next) deletingRef.current = false
    setOpen(next)
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return
    // The trigger reopens the sheet on the next survivor in the order.
    const neighbourId = survivingNeighbour(orderedIds, [pendingDelete.id])
    if (neighbourId) setJobId(neighbourId)
    focusTargetRef.current = triggerRef.current
    store.remove([pendingDelete.id])
    setDeleteOpen(false)
  }

  return (
    <TooltipProvider>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <div className="flex min-h-[360px] items-center justify-center">
          <SheetTrigger
            ref={triggerRef}
            render={
              <Button type="button" variant="outline" size="lg">
                {TRIGGER_ICON}
                Open Job
              </Button>
            }
          />
        </div>

        <SheetContent
          ref={popupRef}
          side="right"
          showCloseButton={false}
          // Focus the panel itself: a first control would pop its tooltip.
          initialFocus={popupRef}
          finalFocus={() => {
            // A delete confirm opened as the sheet closed and holds focus.
            if (deletingRef.current) return false
            return triggerRef.current ?? true
          }}
          className={SHEET_SHELL}
        >
          {job ? (
            <JobSheetView
              key={job.id}
              job={job}
              tab={tab}
              position={position}
              onStep={(direction) => {
                if (!position) return
                const next = position.index + direction
                const id = orderedIds[next]
                if (!id) return
                setAnnouncement(`Job ${next + 1} of ${position.total}`)
                setJobId(id)
              }}
              sections={sections}
              onSectionsChange={(patch) =>
                setSections((current) => ({ ...current, ...patch }))
              }
              actions={{
                onTabChange: setTab,
                onClose: () => setOpen(false),
                onRun: (id) => store.runJobs([id], "manual"),
                onRetry: (id) => store.runJobs([id], "retry"),
                onPauseToggle: (item) =>
                  store.setEnabled([item.id], !item.enabled),
                onSkipToggle: store.toggleSkip,
                onDuplicate: (id) => {
                  const copyId = store.duplicate(id)
                  if (!copyId) return
                  setJobId(copyId)
                  setTab("settings")
                },
                onDelete: (item) => {
                  // The sheet closes first, then the confirm opens and owns focus.
                  deletingRef.current = true
                  setOpen(false)
                  setPendingDelete({
                    id: item.id,
                    name: item.name,
                    origin: triggerRef.current,
                  })
                  setDeleteOpen(true)
                },
                onSave: store.update,
              }}
            />
          ) : (
            <SheetTitle className="sr-only">Job</SheetTitle>
          )}
          <span role="status" className="sr-only">
            {announcement}
          </span>
        </SheetContent>
      </Sheet>

      <DeleteJobsDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        pending={pendingDelete}
        focusTargetRef={focusTargetRef}
        onConfirm={handleConfirmDelete}
      />
    </TooltipProvider>
  )
}