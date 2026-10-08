import { Frame, FramePanel } from "@/components/reui/frame"

import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

import {
  formatRelative,
  healthOf,
  REFERENCE_MS,
  SERVICES,
  type SheetTab,
  type UpNextEntry,
} from "./data"
import { SectionHeader } from "./section-header"
import { HealthFace } from "./value-faces"

/** The list covers fires within the next half hour of the reference time. */
const UP_NEXT_WINDOW_MS = 30 * 60_000

export function UpNextList({
  entries,
  onOpenJob,
}: {
  entries: UpNextEntry[]
  onOpenJob: (id: string, tab: SheetTab, origin: HTMLElement) => void
}) {
  const soon = entries.filter(
    ({ at }) => at - REFERENCE_MS <= UP_NEXT_WINDOW_MS
  )
  return (
    <Frame spacing="default" className="flex h-full min-w-0 flex-col">
      <SectionHeader title="Up Next" description="Next 30 minutes" />
      <FramePanel className="flex flex-col gap-1">
        {soon.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No runs in the next 30 minutes.
          </p>
        ) : (
          soon.map(({ job, at }) => (
            <Item
              key={job.id}
              size="xs"
              render={
                <button
                  type="button"
                  onClick={(event) =>
                    onOpenJob(job.id, "overview", event.currentTarget)
                  }
                />
              }
              className="hover:bg-muted cursor-pointer text-start"
            >
              <ItemMedia variant="icon">{SERVICES[job.service].icon}</ItemMedia>
              <ItemContent className="min-w-0">
                {/* One dense line; the span truncates (a flex title clips with
                    no ellipsis) and the badge is title-tall, so rows never grow. */}
                <ItemTitle className="max-w-full min-w-0">
                  <span className="min-w-0 truncate">{job.name}</span>
                  {healthOf(job) === "failing" ? (
                    <HealthFace health="failing" />
                  ) : null}
                </ItemTitle>
              </ItemContent>
              <ItemActions>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatRelative(at)}
                </span>
              </ItemActions>
            </Item>
          ))
        )}
      </FramePanel>
    </Frame>
  )
}