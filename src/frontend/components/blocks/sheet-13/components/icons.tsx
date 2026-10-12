import { CircleCheckIcon, PlusIcon, XIcon, CalendarClockIcon, SquareTerminalIcon } from "lucide-react";

/** The success toast glyph, so the created toast reads like every typed toast. */
export const TOAST_SUCCESS_ICON = (
  <CircleCheckIcon className="text-success size-4" aria-hidden="true" />
)

// prettier-ignore
export const UI_ICONS = {
  plus:     <PlusIcon aria-hidden="true" />,
  close:    <XIcon aria-hidden="true" />,
  schedule: <CalendarClockIcon aria-hidden="true" />,
  terminal: <SquareTerminalIcon aria-hidden="true" />,
}