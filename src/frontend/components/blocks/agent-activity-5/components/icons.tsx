import { CheckIcon, XIcon, ClipboardListIcon, Trash2Icon, RotateCcwIcon, RefreshCwIcon, CopyIcon, EllipsisVerticalIcon, ActivityIcon, CircleCheckIcon, AlertCircleIcon } from "lucide-react";

export const ICON_DONE = (
  <CheckIcon className="size-4" aria-hidden="true" />
)

export const ICON_FAILED = (
  <XIcon className="size-4" aria-hidden="true" />
)

export const ICON_REPORT = (
  <ClipboardListIcon aria-hidden="true" />
)

export const ICON_DISCARD = (
  <Trash2Icon aria-hidden="true" />
)

export const ICON_RESTORE = (
  <RotateCcwIcon aria-hidden="true" />
)

export const ICON_RETRY = (
  <RefreshCwIcon aria-hidden="true" />
)

export const ICON_COPY = (
  <CopyIcon aria-hidden="true" />
)

export const ICON_MORE = (
  <EllipsisVerticalIcon aria-hidden="true" />
)

export const ICON_TRACE = (
  <ActivityIcon aria-hidden="true" />
)

/** Success toasts carry the green check, matching the house toast grammar. */
export const TOAST_SUCCESS_ICON = (
  <CircleCheckIcon className="size-[18px] text-green-600" aria-hidden="true" />
)

/** Error toasts carry the destructive alert glyph. */
export const TOAST_ERROR_ICON = (
  <AlertCircleIcon className="text-destructive size-[18px]" aria-hidden="true" />
)