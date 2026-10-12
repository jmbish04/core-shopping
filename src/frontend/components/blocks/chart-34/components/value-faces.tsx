import { Badge } from "@/components/reui/badge"
import { cn } from "@/lib/utils"

import { JOB_HEALTH, RUN_STATUS, type JobHealth, type RunStatus } from "./data"

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

export function RunStatusFace({ status }: { status: RunStatus }) {
  return (
    <Badge variant={RUN_STATUS[status].variant}>
      {RUN_STATUS[status].label}
    </Badge>
  )
}

/** The bar tone as a legend key, square like the bars it names. */
export function RunStatusSwatch({ status }: { status: RunStatus }) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-2.5 shrink-0", RUN_STATUS[status].bar)}
    />
  )
}

export function HealthFace({ health }: { health: JobHealth }) {
  return (
    <Badge variant={JOB_HEALTH[health].variant}>
      {JOB_HEALTH[health].label}
    </Badge>
  )
}