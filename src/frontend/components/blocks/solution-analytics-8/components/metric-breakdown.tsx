import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { cn } from "@/lib/utils"

import { Progress } from "@/components/ui/progress"

import { COHORTS } from "./data"

// MiniProgress: the hatched track + Progress indicator from application/sheet
// (sheet-11), re-declared here; the indicator color is the cohort's health.
function MiniProgress({ value }: { value: number }) {
  const indicatorColor =
    value >= 65
      ? "**:data-[slot=progress-indicator]:bg-success"
      : value >= 45
        ? "**:data-[slot=progress-indicator]:bg-primary"
        : "**:data-[slot=progress-indicator]:bg-warning"

  return (
    <div className="bg-muted/55 relative h-1.5 overflow-hidden rounded-full">
      <div
        className="text-muted-foreground pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,currentColor_0,currentColor_1px,transparent_0,transparent_4px)] opacity-20"
        aria-hidden="true"
      />
      <Progress
        value={value}
        className={cn(
          "absolute inset-0 gap-0",
          "**:data-[slot=progress-track]:h-full **:data-[slot=progress-track]:rounded-none **:data-[slot=progress-track]:bg-transparent",
          "**:data-[slot=progress-indicator]:rounded-none",
          indicatorColor
        )}
      />
    </div>
  )
}

// Cohort breakdown: one progress row per cohort, name and count on a header line
// over the hatched rate bar.
export function MetricBreakdown() {
  return (
    <Frame className="h-full">
      <FrameHeader>
        <FrameTitle>Cohort Breakdown</FrameTitle>
        <FrameDescription>
          Share activated in their first 28 days
        </FrameDescription>
      </FrameHeader>
      <FramePanel className="flex grow flex-col gap-5">
        {COHORTS.map((cohort) => (
          <div key={cohort.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="text-foreground truncate text-sm font-medium">
                  {cohort.name}
                </span>
                <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
                  {cohort.code}
                </span>
              </span>
              <div className="flex shrink-0 items-center gap-2.5 text-xs">
                <span className="text-muted-foreground tabular-nums">
                  {cohort.activated} of {cohort.total}
                </span>
                <span className="text-foreground w-9 text-right font-medium tabular-nums">
                  {cohort.rate}%
                </span>
              </div>
            </div>
            <MiniProgress value={cohort.rate} />
          </div>
        ))}
      </FramePanel>
    </Frame>
  )
}