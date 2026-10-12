"use client"

import { type ComponentProps, type ReactNode } from "react"
import { Badge } from "@/components/reui/badge"
import { Rating } from "@/components/reui/rating"
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
} from "@/components/reui/timeline"
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollBar } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { rolloutItems, type RolloutAttachment, type RolloutMeta } from "./data"
import { PaperclipIcon, DownloadIcon, ListChecksIcon, CheckCheckIcon } from "lucide-react"

function ScrollView({
  className,
  children,
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  children: ReactNode
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="focus-visible:ring-ring/50 max-h-[inherit] w-full overflow-x-hidden overflow-y-auto rounded-lg transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function DotBadge({ label, value, dotClassName, variant }: RolloutMeta) {
  return (
    <Badge
      variant={variant ?? "outline"}
      size="default"
      className="gap-1.5"
      aria-label={`${label} ${value}`}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", dotClassName)}
        aria-hidden="true"
      />
      <span className="font-normal opacity-70">{label}</span>
      <span>{value}</span>
    </Badge>
  )
}

function FileAttachment({ attachment }: { attachment: RolloutAttachment }) {
  return (
    <ButtonGroup className="max-w-full min-w-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-w-0 shrink justify-start gap-1.5 px-2.5"
      >
        <PaperclipIcon data-icon="inline-start" aria-hidden="true" />
        <span className="min-w-0 truncate">{attachment.name}</span>
        <span className="text-muted-foreground shrink-0">
          ({attachment.size})
        </span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Download ${attachment.name}`}
      >
        <DownloadIcon aria-hidden="true" />
      </Button>
    </ButtonGroup>
  )
}

function RolloutTimelineList() {
  return (
    <Timeline defaultValue={0} className="gap-2.5">
      {rolloutItems.map((item) => (
        <TimelineItem
          key={item.dateTime}
          step={item.id}
          className="has-[+[data-completed]]:[&_[data-slot=timeline-separator]]:bg-border group-data-[orientation=vertical]/timeline:not-last:pb-5"
        >
          <TimelineHeader className="flex min-w-0 items-start gap-2.5">
            <TimelineSeparator className="bg-foreground/20 group-data-[orientation=vertical]/timeline:h-[calc(100%-0.375rem)] group-data-[orientation=vertical]/timeline:!w-px" />
            <TimelineIndicator className="bg-border size-2 border-none group-data-[orientation=vertical]/timeline:top-1.5" />
            <TimelineDate
              dateTime={item.dateTime}
              className="text-muted-foreground/70 mb-0 pt-0.5 text-[10px] font-semibold uppercase"
            >
              {item.date}
            </TimelineDate>
          </TimelineHeader>

          <TimelineContent className="text-foreground min-w-0 text-sm font-medium">
            <div className="min-w-0 space-y-1 pt-1">
              <div className="min-w-0 space-y-0.5">
                <p className="text-foreground min-w-0 truncate text-sm leading-5">
                  <span className="text-muted-foreground">{item.action}</span>{" "}
                  <span className="font-medium">{item.title}</span>
                </p>
                <p className="text-muted-foreground min-w-0 truncate text-sm leading-5">
                  {item.body}
                </p>
              </div>

              {(item.attachment || item.rating !== undefined) && (
                <div className="flex max-w-full flex-wrap items-center gap-1.5 pt-0.5">
                  {item.attachment ? (
                    <FileAttachment attachment={item.attachment} />
                  ) : null}
                  {item.rating !== undefined ? (
                    <Rating
                      rating={item.rating}
                      size="sm"
                      showValue
                      className="py-1"
                    />
                  ) : null}
                </div>
              )}

              <div className="flex min-w-0 flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-muted-foreground min-w-0 truncate text-sm">
                  {item.owner}
                </span>
                <Badge variant={item.badgeVariant}>{item.badge}</Badge>
                {item.meta ? <DotBadge {...item.meta} /> : null}
              </div>
            </div>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  )
}

export function AccountRolloutDropdown() {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline">
            <ListChecksIcon data-icon="inline-start" aria-hidden="true" />
            Open timeline
          </Button>
        }
      />
      <DropdownMenuContent
        side="bottom"
        align="center"
        sideOffset={8}
        className="flex w-[min(34rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
      >
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold">
              Account Rollout
            </span>
            <Badge size="xs" className="rounded-full!">
              {rolloutItems.length}
            </Badge>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                disabled
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-60 hover:opacity-100"
                    aria-label="Mark all as read"
                  />
                }
              >
                <CheckCheckIcon className="size-3.5" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>Mark all as read</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="min-h-0 overflow-hidden">
          <ScrollView
            className="max-h-[min(calc(var(--available-height)-4rem),34rem)]"
            aria-label="Scrollable account rollout timeline"
          >
            <div className="px-4 py-4">
              <RolloutTimelineList />
            </div>
          </ScrollView>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}