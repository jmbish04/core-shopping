import {
  Frame,
  FrameDescription,
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

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

import {
  activityKindIcon,
  activityKindIndicatorClass,
  METRIC_ACTIVITY,
  type MetricActivity,
} from "./data"

// ActivityRow: application/timeline/timeline-1's TimelineItem / Header / Indicator
// grammar reskinned to one metric change.
function ActivityRow({
  activity,
  step,
}: {
  activity: MetricActivity
  step: number
}) {
  return (
    <TimelineItem
      step={step}
      className="has-[+[data-completed]]:[&_[data-slot=timeline-separator]]:bg-border group-data-[orientation=vertical]/timeline:ms-8 group-data-[orientation=vertical]/timeline:not-last:pb-6"
    >
      <TimelineHeader className="flex min-w-0 items-start justify-between gap-2.5">
        <TimelineSeparator className="bg-border group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.25rem-0.5rem)] group-data-[orientation=vertical]/timeline:translate-y-6" />
        <TimelineIndicator
          className={cn(
            "group-data-completed/timeline-item:border-border flex size-5 items-center justify-center rounded-full border group-data-[orientation=vertical]/timeline:-left-6 [&_svg]:size-3",
            activityKindIndicatorClass[activity.kind]
          )}
        >
          {activityKindIcon[activity.kind]}
        </TimelineIndicator>

        <TimelineTitle className="min-w-0 text-sm leading-5">
          <span className="text-foreground font-medium">{activity.title}</span>
        </TimelineTitle>

        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {activity.timeLabel}
        </span>
      </TimelineHeader>

      <TimelineContent className="flex min-w-0 flex-col items-start gap-2 pb-1">
        <p className="text-muted-foreground max-w-[52ch] text-sm leading-5">
          {activity.detail}
        </p>
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Avatar className="size-5">
            {activity.author.avatar ? (
              <AvatarImage
                src={activity.author.avatar}
                alt={activity.author.name}
              />
            ) : null}
            <AvatarFallback className="text-[9px]">
              {activity.author.initials}
            </AvatarFallback>
          </Avatar>
          <span>{activity.author.name}</span>
        </div>
      </TimelineContent>
    </TimelineItem>
  )
}

export function MetricActivity() {
  return (
    <Frame className="h-full">
      <FrameHeader>
        <FrameTitle>Recent Changes</FrameTitle>
        <FrameDescription>
          Edits to this metric over the last weeks
        </FrameDescription>
      </FrameHeader>
      <FramePanel>
        <Timeline defaultValue={0}>
          {METRIC_ACTIVITY.map((item, index) => (
            <ActivityRow key={item.id} activity={item} step={index + 1} />
          ))}
        </Timeline>
      </FramePanel>
    </Frame>
  )
}