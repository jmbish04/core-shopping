import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import {
  Timeline,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline"
import { cn } from "@/lib/utils"
import { CheckIcon, CircleIcon } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"

import {
  INCIDENT_EVENTS,
  incidentSeverityDotClass,
  type IncidentStatus,
} from "./data"

// ── Incident timeline (reused from application/timeline/timeline-1) ──
// Reuses timeline-1's Timeline + TimelineItem composition, its separator and
// indicator offset grammar, and its StatusIcon (Check / Spinner / Circle).
// Adapted to short agent incident events; wrapped in a Frame to match the
// dashboard's one container family.

function StatusIcon({ status }: { status: IncidentStatus }) {
  if (status === "completed") {
    return <CheckIcon className="size-3.5" />
  }

  if (status === "active") {
    return <Spinner className="size-3.5" />
  }

  return <CircleIcon className="size-3.5" />
}

export function IncidentTimeline({ className }: { className?: string }) {
  return (
    <Frame spacing="sm" className={cn("w-full", className)}>
      <FrameHeader>
        <FrameTitle>Incident Activity</FrameTitle>
      </FrameHeader>

      <FramePanel className="flex grow flex-col">
        <Timeline>
          {INCIDENT_EVENTS.map((event, index) => (
            <TimelineItem
              key={event.id}
              step={event.id}
              className={cn(
                "ms-8",
                index === INCIDENT_EVENTS.length - 1 ? "pb-0" : "pb-8"
              )}
            >
              <TimelineHeader>
                <TimelineSeparator className="bg-border group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.5rem)] group-data-[orientation=vertical]/timeline:translate-y-6" />
                <div className="flex flex-wrap items-center gap-2">
                  <TimelineTitle className="text-sm font-semibold">
                    {event.title}
                  </TimelineTitle>
                  <Badge variant="outline" className="gap-1.5">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        incidentSeverityDotClass[event.severity]
                      )}
                      aria-hidden="true"
                    />
                    {event.severity}
                  </Badge>
                </div>
                <TimelineIndicator
                  className={cn(
                    "flex size-6 items-center justify-center border-none group-data-[orientation=vertical]/timeline:-left-6",
                    event.status === "completed"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                    event.status === "active" && "ring-primary/20 ring-2"
                  )}
                >
                  <StatusIcon status={event.status} />
                </TimelineIndicator>
              </TimelineHeader>
              <TimelineContent className="mt-1.5">
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <span className="[&_svg]:text-muted-foreground [&_svg]:size-3.5">
                    {event.icon}
                  </span>
                  <span className="font-medium">{event.meta}</span>
                </div>
                <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                  {event.description}
                </p>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </FramePanel>
    </Frame>
  )
}