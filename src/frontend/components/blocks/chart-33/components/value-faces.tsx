import { Badge } from "@/components/reui/badge"
import { cn } from "@/lib/utils"

import { Spinner } from "@/components/ui/spinner"

import { SERVICES, type CronJob } from "./data"

export function DotSeparator({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-muted-foreground/40 size-1 shrink-0 rounded-full",
        className
      )}
    />
  )
}

/** The service icon beside the job name; size-4 sits at text-sm height. */
export function JobFace({ job }: { job: CronJob }) {
  return (
    <span className="flex min-w-0 items-center gap-2 [&_svg:not([class*=size-])]:size-4">
      {SERVICES[job.service].icon}
      <span className="truncate">{job.name}</span>
    </span>
  )
}

/** What the job is doing right now, inline after its title. */
export function JobStateFace({ state }: { state: "running" | "paused" }) {
  if (state === "paused") return <Badge variant="warning-light">Paused</Badge>
  return (
    <Badge variant="primary-light">
      {/* Decorative: the Spinner ships role="status" and the label names it. */}
      <Spinner
        role="presentation"
        aria-label={undefined}
        aria-hidden="true"
        className="size-3"
      />
      Running
    </Badge>
  )
}