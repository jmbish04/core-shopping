import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { nextFires } from "./cron"
import {
  CURRENT_USER_ID,
  formatDateTime,
  isRunning,
  JOBS,
  LAST_SEED_JOB,
  LAST_SEED_RUN,
  manualOutcome,
  offsetOf,
  parseSchedule,
  REFERENCE_MS,
  type CronJob,
  type JobDraft,
  type JobRun,
} from "./data"
import { TOAST_ERROR_ICON, TOAST_INFO_ICON, TOAST_SUCCESS_ICON } from "./icons"

const UNDO_TOAST_MS = 8000
/** How long a manual run takes to resolve in the demo. */
const RUN_RESOLVE_MS = 2400

type RunOutcome = ReturnType<typeof manualOutcome>

type PauseFields = Pick<
  CronJob,
  "enabled" | "pausedAt" | "pausedBy" | "pauseNote" | "skipFireAt"
>

const pauseFieldsOf = (job: CronJob): PauseFields => ({
  enabled: job.enabled,
  pausedAt: job.pausedAt,
  pausedBy: job.pausedBy,
  pauseNote: job.pauseNote,
  skipFireAt: job.skipFireAt,
})

function withEnabled(job: CronJob, enabled: boolean): CronJob {
  if (enabled) {
    return {
      ...job,
      enabled: true,
      pausedAt: undefined,
      pausedBy: undefined,
      pauseNote: undefined,
    }
  }
  return {
    ...job,
    enabled: false,
    pausedAt: REFERENCE_MS,
    pausedBy: CURRENT_USER_ID,
    pauseNote: undefined,
    skipFireAt: undefined,
  }
}

/** "A, B and 3 more": a bulk toast names what it touched. */
function nameList(jobs: CronJob[]) {
  const names = jobs.map((job) => job.name)
  if (names.length <= 2) return names.join(" and ")
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`

function notify(title: string, description: string, undo?: () => void) {
  toast.success(title, {
    description,
    icon: TOAST_SUCCESS_ICON,
    ...(undo && {
      duration: UNDO_TOAST_MS,
      action: { label: "Undo", onClick: undo },
    }),
  })
}

function failureLine(job: CronJob, run: Pick<JobRun, "status" | "exitCode">) {
  return run.status === "timedOut"
    ? `${job.name}, timed out after ${job.timeoutMin}m`
    : `${job.name}, exit ${run.exitCode ?? 1}`
}

export function useJobStore() {
  const [jobs, setJobs] = useState<CronJob[]>(JOBS)
  // Handlers stay stable (the grid's columns depend on them) and read the latest jobs here.
  const jobsRef = useRef(jobs)
  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])

  const jobSeq = useRef(LAST_SEED_JOB)
  const runSeq = useRef(LAST_SEED_RUN)
  const timers = useRef(new Set<number>())
  // Outcomes by run id: a job deleted mid-run and restored by Undo still settles.
  const settled = useRef(new Map<string, RunOutcome>())
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer))
      pending.clear()
    }
  }, [])

  const patchJobs = useCallback(
    (ids: string[], patch: (job: CronJob) => CronJob) =>
      setJobs((current) =>
        current.map((job) => (ids.includes(job.id) ? patch(job) : job))
      ),
    []
  )

  const restorePauseFields = useCallback(
    (snapshot: Map<string, PauseFields>) =>
      setJobs((current) =>
        current.map((job) => {
          const fields = snapshot.get(job.id)
          return fields ? { ...job, ...fields } : job
        })
      ),
    []
  )

  /** Pause or resume; one toast for one job or a bulk selection. */
  const setEnabled = useCallback(
    (ids: string[], enabled: boolean) => {
      const targets = jobsRef.current.filter(
        (job) => ids.includes(job.id) && job.enabled !== enabled
      )
      if (targets.length === 0) return
      const snapshot = new Map(
        targets.map((job) => [job.id, pauseFieldsOf(job)])
      )
      patchJobs([...snapshot.keys()], (job) => withEnabled(job, enabled))
      const verb = enabled ? "resumed" : "paused"
      notify(
        targets.length === 1
          ? `Job ${verb}`
          : `${plural(targets.length, "job", "jobs")} ${verb}`,
        nameList(targets),
        () => restorePauseFields(snapshot)
      )
    },
    [patchJobs, restorePauseFields]
  )

  const runJobs = useCallback(function runJobs(
    ids: string[],
    trigger: "manual" | "retry"
  ) {
    const started = jobsRef.current
      .filter((job) => ids.includes(job.id) && !isRunning(job))
      .map((job) => {
        const runNumber = ++runSeq.current
        const run: JobRun = {
          id: `RUN-${runNumber}`,
          status: "running",
          trigger,
          triggeredBy: CURRENT_USER_ID,
          startedAt: REFERENCE_MS,
          durationSec: 0,
          attempt: 1,
          maxAttempts: job.retries + 1,
          exitCode: null,
        }
        return { job, run, outcome: manualOutcome(job, runNumber) }
      })
    if (started.length === 0) return

    const byJob = new Map(started.map((entry) => [entry.job.id, entry]))
    setJobs((current) =>
      current.map((job) => {
        const entry = byJob.get(job.id)
        return entry ? { ...job, runs: [entry.run, ...job.runs] } : job
      })
    )
    const verb = trigger === "retry" ? "Retry" : "Run"
    toast.info(
      started.length === 1
        ? `${verb} started`
        : `${plural(started.length, "run", "runs")} started`,
      {
        description: nameList(started.map((entry) => entry.job)),
        icon: TOAST_INFO_ICON,
      }
    )

    // Frozen demo guard: ?demo=frozen pins the demo, so runs stay running.
    if (document.documentElement.dataset.demo === "frozen") return
    const timer = window.setTimeout(() => {
      timers.current.delete(timer)
      for (const entry of started) {
        settled.current.set(entry.run.id, entry.outcome)
      }
      setJobs((current) =>
        current.map((job) => {
          const entry = byJob.get(job.id)
          if (!entry) return job
          return {
            ...job,
            runs: job.runs.map((run) =>
              run.id === entry.run.id ? { ...run, ...entry.outcome } : run
            ),
          }
        })
      )
      // Success resolves silently: the row is the feedback.
      const failed = started.filter(
        (entry) =>
          entry.outcome.status !== "succeeded" &&
          jobsRef.current.some((job) => job.id === entry.job.id)
      )
      if (failed.length === 0) return
      const retry = () =>
        runJobs(
          failed.map((entry) => entry.job.id),
          "retry"
        )
      toast.error(
        failed.length === 1
          ? "Run failed"
          : `${plural(failed.length, "run", "runs")} failed`,
        {
          description:
            failed.length === 1
              ? failureLine(failed[0].job, failed[0].outcome)
              : nameList(failed.map((entry) => entry.job)),
          icon: TOAST_ERROR_ICON,
          action: { label: "Retry", onClick: retry },
        }
      )
    }, RUN_RESOLVE_MS)
    timers.current.add(timer)
  }, [])

  /** Skip the next fire, or keep it again when a skip is already set. */
  const toggleSkip = useCallback(
    (id: string) => {
      const job = jobsRef.current.find((item) => item.id === id)
      if (!job || !job.enabled) return
      const previous = job.skipFireAt
      const restore = () =>
        patchJobs([id], (item) => ({ ...item, skipFireAt: previous }))
      if (previous !== undefined) {
        patchJobs([id], (item) => ({ ...item, skipFireAt: undefined }))
        notify("Next run restored", formatDateTime(previous), restore)
        return
      }
      const cron = parseSchedule(job)
      const [next] = cron
        ? nextFires(cron, offsetOf(job.timezone), REFERENCE_MS, 1)
        : []
      if (next === undefined) return
      patchJobs([id], (item) => ({ ...item, skipFireAt: next }))
      notify("Next run skipped", formatDateTime(next), restore)
    },
    [patchJobs]
  )

  /** Inserts a paused, never-run copy after the source; returns its id. */
  const duplicate = useCallback((id: string) => {
    const source = jobsRef.current.find((job) => job.id === id)
    if (!source) return null
    const copy: CronJob = {
      ...source,
      id: `JOB-${++jobSeq.current}`,
      name: `${source.name} (copy)`,
      enabled: false,
      pausedAt: REFERENCE_MS,
      pausedBy: CURRENT_USER_ID,
      pauseNote: `Duplicated from ${source.id}`,
      skipFireAt: undefined,
      runs: [],
    }
    setJobs((current) => {
      const index = current.findIndex((job) => job.id === id)
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)]
    })
    notify("Job duplicated", copy.name)
    return copy.id
  }, [])

  const create = useCallback((draft: JobDraft) => {
    const job: CronJob = {
      ...draft,
      id: `JOB-${++jobSeq.current}`,
      baseDurationSec: 45,
      runs: [],
      ...(draft.enabled
        ? {}
        : { pausedAt: REFERENCE_MS, pausedBy: CURRENT_USER_ID }),
    }
    setJobs((current) => [job, ...current])
    notify("Job created", job.name)
    return job
  }, [])

  /** Saves the editable fields; pause state and run history stay as they are. */
  const update = useCallback(
    (id: string, draft: JobDraft) => {
      const previous = jobsRef.current.find((job) => job.id === id)
      if (!previous) return
      const moved =
        previous.schedule !== draft.schedule ||
        previous.timezone !== draft.timezone
      patchJobs([id], (job) => ({
        ...job,
        ...draft,
        enabled: job.enabled,
        skipFireAt: moved ? undefined : job.skipFireAt,
      }))
      notify("Job updated", draft.name, () =>
        patchJobs([id], (job) => ({
          ...job,
          name: previous.name,
          command: previous.command,
          schedule: previous.schedule,
          timezone: previous.timezone,
          service: previous.service,
          cluster: previous.cluster,
          environment: previous.environment,
          ownerId: previous.ownerId,
          concurrency: previous.concurrency,
          timeoutMin: previous.timeoutMin,
          retries: previous.retries,
          notifyOnFailure: previous.notifyOnFailure,
          skipFireAt: previous.skipFireAt,
        }))
      )
    },
    [patchJobs]
  )

  /** Removes jobs; Undo re-anchors each to its original neighbour by id. */
  const remove = useCallback((ids: string[]) => {
    const current = jobsRef.current
    const removed = current
      .map((job, index) => ({
        job,
        index,
        previousId: current[index - 1]?.id,
        followingId: current[index + 1]?.id,
      }))
      .filter((entry) => ids.includes(entry.job.id))
    if (removed.length === 0) return
    setJobs((list) => list.filter((job) => !ids.includes(job.id)))
    notify(
      removed.length === 1
        ? "Job deleted"
        : `${plural(removed.length, "job", "jobs")} deleted`,
      nameList(removed.map((entry) => entry.job)),
      () =>
        setJobs((list) => {
          const next = [...list]
          for (const entry of removed) {
            if (next.some((job) => job.id === entry.job.id)) continue
            const after = next.findIndex((job) => job.id === entry.previousId)
            const before = next.findIndex((job) => job.id === entry.followingId)
            const at =
              after >= 0
                ? after + 1
                : before >= 0
                  ? before
                  : Math.min(entry.index, next.length)
            next.splice(at, 0, {
              ...entry.job,
              runs: entry.job.runs.map((run) => {
                const outcome = settled.current.get(run.id)
                return run.status === "running" && outcome
                  ? { ...run, ...outcome }
                  : run
              }),
            })
          }
          return next
        })
    )
  }, [])

  return {
    jobs,
    setEnabled,
    runJobs,
    toggleSkip,
    duplicate,
    create,
    update,
    remove,
  }
}

export type JobStore = ReturnType<typeof useJobStore>