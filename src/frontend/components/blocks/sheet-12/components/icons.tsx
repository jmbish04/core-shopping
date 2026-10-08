import { type ReactNode } from "react"
import { type RunStatus } from "./data"
import { CircleCheckIcon, AlertCircleIcon, InfoIcon, CalendarClockIcon, XIcon, MoreHorizontalIcon, PlayIcon, PauseIcon, Redo2Icon, CopyIcon, CheckIcon, Trash2Icon, RefreshCwIcon, HistoryIcon, SquareTerminalIcon, ChevronUpIcon, ChevronDownIcon, TriangleAlertIcon, PauseCircleIcon, CircleXIcon, TimerIcon, CircleDashedIcon, ChevronRightIcon } from "lucide-react"

/** The toast state glyphs, one per typed method, so every toast reads alike. */
export const TOAST_SUCCESS_ICON = (
  <CircleCheckIcon className="text-success size-4" aria-hidden="true" />
)

export const TOAST_ERROR_ICON = (
  <AlertCircleIcon className="text-destructive size-4" aria-hidden="true" />
)

export const TOAST_INFO_ICON = (
  <InfoIcon className="text-info size-4" aria-hidden="true" />
)

/** The Open Job trigger's leading glyph, the schedule icon. */
export const TRIGGER_ICON = (
  <CalendarClockIcon data-icon="inline-start" aria-hidden="true" />
)

// prettier-ignore
export const UI_ICONS = {
  close:    <XIcon aria-hidden="true" />,
  more:     <MoreHorizontalIcon aria-hidden="true" />,
  play:     <PlayIcon aria-hidden="true" />,
  pause:    <PauseIcon aria-hidden="true" />,
  skip:     <Redo2Icon aria-hidden="true" />,
  copy:     <CopyIcon aria-hidden="true" />,
  check:    <CheckIcon aria-hidden="true" />,
  trash:    <Trash2Icon aria-hidden="true" />,
  retry:    <RefreshCwIcon aria-hidden="true" />,
  history:  <HistoryIcon aria-hidden="true" />,
  schedule: <CalendarClockIcon aria-hidden="true" />,
  terminal: <SquareTerminalIcon aria-hidden="true" />,
  previous: <ChevronUpIcon aria-hidden="true" />,
  next:     <ChevronDownIcon aria-hidden="true" />,
  failed:   <AlertCircleIcon aria-hidden="true" />,
  timeout:  <TriangleAlertIcon aria-hidden="true" />,
  paused:   <PauseCircleIcon aria-hidden="true" />,
}

/** Bare run-status glyphs: the wrapper span sets the tone; running uses Spinner. */
// prettier-ignore
export const RUN_GLYPHS: Record<Exclude<RunStatus, "running">, ReactNode> = {
  succeeded: <CircleCheckIcon className="size-4" aria-hidden="true" />,
  failed:    <CircleXIcon className="size-4" aria-hidden="true" />,
  timedOut:  <TimerIcon className="size-4" aria-hidden="true" />,
  skipped:   <CircleDashedIcon className="size-4" aria-hidden="true" />,
}

/** The run-row disclosure chevron; rotates when its Collapsible opens. */
export const ROW_CHEVRON = (
  <ChevronRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 in-data-panel-open:rotate-90" aria-hidden="true" />
)