"use client"

import { useCallback, useMemo, useRef, useState } from "react"

import { TooltipProvider } from "@/components/ui/tooltip"

import {
  fleetActivity,
  healthOf,
  JOBS,
  upNextOf,
  type EnvironmentScope,
  type JobDraft,
  type SheetTab,
} from "./data"
import { JobsGridView } from "./data-grid-view"
import { JobHealthStrip } from "./job-health-strip"
import { type SheetState } from "./job-sheet"
import { useJobStore } from "./job-store"
import { JobsHeader } from "./jobs-header"
import { NewJobSheet } from "./new-job-sheet"
import { RunTimeChart } from "./run-time-chart"
import { UpNextList } from "./up-next-list"

const plural = (count: number, noun: string) =>
  `${count} ${count === 1 ? noun : `${noun}s`}`

export function CronJobs() {
  const store = useJobStore()
  const { create } = store
  const [scope, setScope] = useState<EnvironmentScope>("all")
  // Seeded id + closed: the sheet mounts closed, so its first open animates.
  const [sheet, setSheet] = useState<SheetState>({
    jobId: JOBS[0].id,
    open: false,
    tab: "overview",
  })
  const [newJobOpen, setNewJobOpen] = useState(false)
  const [reveal, setReveal] = useState<{ seq: number; id: string | null }>({
    seq: 0,
    id: null,
  })
  // Where focus returns when the job sheet or the New Job sheet closes.
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const newJobReturnRef = useRef<HTMLElement | null>(null)

  const scopedJobs = useMemo(
    () =>
      scope === "all"
        ? store.jobs
        : store.jobs.filter((job) => job.environment === scope),
    [scope, store.jobs]
  )
  const fleet = useMemo(() => fleetActivity(scopedJobs), [scopedJobs])
  const upNext = useMemo(() => upNextOf(scopedJobs), [scopedJobs])
  const failingCount = scopedJobs.filter(
    (job) => healthOf(job) === "failing"
  ).length
  const clusterCount = new Set(scopedJobs.map((job) => job.cluster)).size

  const handleSheetChange = useCallback(
    (patch: Partial<SheetState>) =>
      setSheet((current) => ({ ...current, ...patch })),
    []
  )
  const closeSheet = useCallback(
    () => setSheet((current) => ({ ...current, open: false })),
    []
  )
  /** Openers outside the grid take focus back to the element that opened. */
  const openJob = useCallback(
    (id: string, tab: SheetTab, origin: HTMLElement) => {
      returnFocusRef.current = origin
      setSheet({ jobId: id, tab, open: true })
    },
    []
  )
  const setReturnFocus = useCallback((node: HTMLElement | null) => {
    returnFocusRef.current = node
  }, [])
  const openNewJob = useCallback((origin: HTMLElement) => {
    newJobReturnRef.current = origin
    setNewJobOpen(true)
  }, [])

  function handleCreate(draft: JobDraft) {
    const job = create(draft)
    // A new job hidden by the scope or the grid's query reads as a failed save.
    if (scope !== "all" && scope !== draft.environment) setScope("all")
    setReveal((current) => ({ seq: current.seq + 1, id: job.id }))
  }

  return (
    <TooltipProvider>
      <div className="bg-background flex min-h-svh w-full flex-col">
        <div className="mx-auto w-full max-w-[1320px] p-3 md:p-4">
          {/* Content-level header */}
          <JobsHeader
            failingCount={failingCount}
            subtitle={`${plural(scopedJobs.length, "job")} across ${plural(clusterCount, "cluster")}, times in UTC`}
            scope={scope}
            onScopeChange={setScope}
            onNewJob={openNewJob}
          />

          <div className="mt-4 flex flex-col gap-4">
            <JobHealthStrip
              jobs={scopedJobs}
              fleet={fleet}
              nextUp={upNext[0] ?? null}
              onOpenJob={openJob}
            />
            <JobsGridView
              jobs={scopedJobs}
              allJobs={store.jobs}
              store={store}
              scope={scope}
              reveal={reveal}
              sheet={sheet}
              onSheetChange={handleSheetChange}
              onCloseSheet={closeSheet}
              onNewJob={openNewJob}
              returnFocusRef={returnFocusRef}
              onReturnFocusChange={setReturnFocus}
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <RunTimeChart fleet={fleet} className="lg:col-span-2" />
              <UpNextList entries={upNext} onOpenJob={openJob} />
            </div>
          </div>
        </div>
      </div>

      <NewJobSheet
        open={newJobOpen}
        onOpenChange={setNewJobOpen}
        onCreate={handleCreate}
        returnFocusRef={newJobReturnRef}
      />
    </TooltipProvider>
  )
}