import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

/** A figure and its meta on one line; the meta drops below it on narrow
 *  blocks, in every state, so a swapped readout never moves what is below. */
export function Readout({
  figure,
  label,
  meta,
  twoLineMeta = false,
}: {
  figure: number
  label: string
  meta: ReactNode
  /** Narrow blocks wrap the meta inside a fixed two-line slot, for metas
   *  that swap between a short and a long one. */
  twoLineMeta?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 @xl:flex-row @xl:items-baseline @xl:gap-3">
      <div className="flex shrink-0 items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {figure.toLocaleString("en-US")}
        </span>
        <span className="text-muted-foreground text-sm">{label}</span>
      </div>
      <div
        className={cn(
          "text-muted-foreground flex min-w-0 items-center gap-x-1.5 text-xs tabular-nums",
          twoLineMeta
            ? "min-h-9 flex-wrap content-start gap-y-1 @xl:min-h-0 @xl:flex-nowrap @xl:overflow-hidden @xl:whitespace-nowrap"
            : "overflow-hidden whitespace-nowrap"
        )}
      >
        {meta}
      </div>
    </div>
  )
}