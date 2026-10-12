import { CircleCheckIcon, AlertCircleIcon, PlayIcon, PauseIcon, MoreHorizontalIcon, CopyIcon, DownloadIcon } from "lucide-react";

/** The success toast glyph, shared by every confirmation the block raises. */
export const TOAST_SUCCESS_ICON = (
  <CircleCheckIcon className="text-success size-4" aria-hidden="true" />
)

/** The error toast glyph, so a failed copy reads like every other toast. */
export const TOAST_ERROR_ICON = (
  <AlertCircleIcon className="text-destructive size-4" aria-hidden="true" />
)

/** Chrome glyphs, unsized: the owning Button or menu item sizes them. */
// prettier-ignore
export const UI_ICONS = {
  play:        <PlayIcon aria-hidden="true" />,
  pause:       <PauseIcon aria-hidden="true" />,
  more:        <MoreHorizontalIcon aria-hidden="true" />,
  copy:        <CopyIcon aria-hidden="true" />,
  download:    <DownloadIcon aria-hidden="true" />,
}