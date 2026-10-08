import { type ReactNode } from "react"
import { type RunStatus } from "./data"
import { CalendarClockIcon, LayersIcon, ActivityIcon, CircleXIcon, CircleCheckIcon, TimerIcon, CircleDashedIcon } from "lucide-react"

/** The KPI tile icons, one per tile. */
// prettier-ignore
export const UI_ICONS = {
  schedule: <CalendarClockIcon aria-hidden="true" />,
  layers:   <LayersIcon aria-hidden="true" />,
  activity: <ActivityIcon aria-hidden="true" />,
  failures: <CircleXIcon aria-hidden="true" />,
}

/** Bare run-status glyphs: the wrapper span sets the tone; running uses Spinner. */
// prettier-ignore
export const RUN_GLYPHS: Record<Exclude<RunStatus, "running">, ReactNode> = {
  succeeded: <CircleCheckIcon className="size-4" aria-hidden="true" />,
  failed:    <CircleXIcon className="size-4" aria-hidden="true" />,
  timedOut:  <TimerIcon className="size-4" aria-hidden="true" />,
  skipped:   <CircleDashedIcon className="size-4" aria-hidden="true" />,
}