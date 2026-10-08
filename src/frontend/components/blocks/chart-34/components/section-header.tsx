import { type ComponentProps, type ReactNode } from "react"
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FrameTitle,
} from "@/components/reui/frame"
import { IconTile } from "@/components/reui/icon-tile"
import { cn } from "@/lib/utils"

/** The panel's container: one dense frame at the house rung. */
export function SectionFrame({ className, ...props }: ComponentProps<"div">) {
  return (
    <Frame
      dense
      spacing="default"
      className={cn("min-w-0", className)}
      {...props}
    />
  )
}

/** The header band: frame tile, title, one clause. */
export function SectionHead({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description?: ReactNode
}) {
  return (
    <FrameHeader className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <IconTile variant="frame" size="sm" aria-hidden="true">
          {icon}
        </IconTile>
        <div className="flex min-w-0 flex-col gap-px">
          <FrameTitle role="heading" aria-level={3} className="truncate">
            {title}
          </FrameTitle>
          {description ? (
            <FrameDescription className="truncate">
              {description}
            </FrameDescription>
          ) : null}
        </div>
      </div>
    </FrameHeader>
  )
}

/** The footer band: it reads its panel. One 40px row, wrapping only when it must. */
export function SectionFoot({ className, ...props }: ComponentProps<"footer">) {
  return (
    <FrameFooter
      className={cn(
        "text-muted-foreground min-h-10 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs tabular-nums",
        className
      )}
      {...props}
    />
  )
}