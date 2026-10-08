"use client"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert"
import { Badge, type BadgeProps } from "@/components/reui/badge"
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
import { CheckIcon, ChevronRightIcon, CircleIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Spinner } from "@/components/ui/spinner"
import {
  RUN_STEPS,
  TOAST_SUCCESS_ICON,
  type RunStep,
  type StepStatus,
  type ToolCall,
} from "./data"
import { AlertCircleIcon } from "lucide-react"

const toolCallVariant: Record<ToolCall["status"], BadgeProps["variant"]> = {
  Succeeded: "success-light",
  Failed: "destructive-light",
}

const FAILED_STEP = RUN_STEPS.find((step) => step.status === "failed")
const COMPLETED_STEPS = RUN_STEPS.filter(
  (step) => step.status === "completed"
).length

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "completed") {
    return <CheckIcon className="size-3" />
  }

  if (status === "active") {
    return <Spinner className="size-3" />
  }

  if (status === "failed") {
    return <XIcon className="size-3" />
  }

  return <CircleIcon className="size-3" />
}

function ToolCallRow({ call }: { call: ToolCall }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-foreground truncate font-mono text-xs font-medium">
          {call.name}
        </span>
        {call.note ? (
          <span className="text-muted-foreground truncate text-xs">
            {call.note}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-muted-foreground text-xs tabular-nums">
          {call.latency}
        </span>
        <Badge variant={toolCallVariant[call.status]}>{call.status}</Badge>
      </div>
    </div>
  )
}

function StepBody({
  step,
  onRetryStep,
}: {
  step: RunStep
  onRetryStep: (step: RunStep) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs leading-5">{step.summary}</p>

      {step.toolCalls.length > 0 ? (
        <div className="space-y-2.5 border-t pt-2.5">
          {step.toolCalls.map((call) => (
            <ToolCallRow key={call.id} call={call} />
          ))}
        </div>
      ) : null}

      {step.error ? (
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>{step.error.title}</AlertTitle>
          <AlertAction>
            <Button type="button" size="xs" onClick={() => onRetryStep(step)}>
              Retry Step
            </Button>
          </AlertAction>
          <AlertDescription>{step.error.detail}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

export function RunTrace() {
  function handleRetryStep(step: RunStep) {
    toast.success(`Step ${step.id} requeued`, {
      description: `${step.title} replays with exponential backoff, attempt 3 of 3.`,
      icon: TOAST_SUCCESS_ICON,
    })
  }

  return (
    <Frame stacked spacing="sm" className="w-full">
      <FrameHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <FrameTitle>Step Trace</FrameTitle>
          <FrameDescription className="hidden truncate sm:block">
            Failed at step 3 of 6
          </FrameDescription>
        </div>
      </FrameHeader>

      <FramePanel>
        <Timeline defaultValue={COMPLETED_STEPS}>
          {RUN_STEPS.map((step) => (
            <TimelineItem key={step.id} step={step.id}>
              <TimelineHeader>
                <TimelineSeparator className="bg-border group-data-[orientation=vertical]/timeline:h-[calc(100%-1.25rem-0.5rem)] group-data-[orientation=vertical]/timeline:translate-y-6" />
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <TimelineTitle className="text-sm font-semibold">
                    {step.title}
                  </TimelineTitle>
                  {step.duration ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {step.duration}
                    </span>
                  ) : null}
                </div>
                <TimelineIndicator
                  className={cn(
                    "bg-muted text-muted-foreground group-data-completed/timeline-item:bg-primary group-data-completed/timeline-item:text-primary-foreground flex size-5 items-center justify-center border-none",
                    step.status === "failed" &&
                      "bg-destructive/10 text-destructive dark:bg-destructive/20"
                  )}
                >
                  <StatusIcon status={step.status} />
                </TimelineIndicator>
              </TimelineHeader>
              <TimelineContent className="mt-2">
                <Frame stacked dense spacing="sm">
                  <Collapsible
                    defaultOpen={step.status === "failed"}
                    className="group/collapsible"
                  >
                    <CollapsibleTrigger
                      type="button"
                      className="flex w-full"
                      aria-label={`Toggle ${step.title} tool calls`}
                    >
                      <FrameHeader className="flex grow flex-row items-center justify-between gap-2">
                        <span className="text-muted-foreground min-w-0 truncate text-sm font-medium">
                          {step.toolCalls.length === 1
                            ? "1 tool call"
                            : `${step.toolCalls.length} tool calls`}
                        </span>
                        <ChevronRightIcon
                          className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-open/collapsible:rotate-90"
                          aria-hidden="true"
                        />
                      </FrameHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <FramePanel className="space-y-3">
                        <StepBody step={step} onRetryStep={handleRetryStep} />
                      </FramePanel>
                    </CollapsibleContent>
                  </Collapsible>
                </Frame>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </FramePanel>
    </Frame>
  )
}