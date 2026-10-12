import { type ReactNode } from "react"
import {
  FrameDescription,
  FrameHeader,
  FrameTitle,
} from "@/components/reui/frame"

/** The one header band every page section uses: title over a one-clause
 *  description, actions trailing, wrapping under the title when narrow. */
export function SectionHeader({
  title,
  description,
  children,
}: {
  title: string
  description: ReactNode
  children?: ReactNode
}) {
  return (
    <FrameHeader className="flex-row flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-px">
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </div>
      {children}
    </FrameHeader>
  )
}