import { type ReactNode } from "react"
import { Badge } from "@/components/reui/badge"
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
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  activityKindIcon,
  activityKindIndicatorClass,
  alertRuleStatusVariant,
  METRIC,
  METRIC_ACTIVITY,
  metricHealthVariant,
  type AlertRule,
  type MetricActivity,
  type MetricFact,
  type MetricOwner,
} from "./data"
import { BellIcon, PanelRightIcon, TargetIcon, XIcon } from "lucide-react"

// Section wrapper: the px-5 rhythm and Separator between blocks are lifted from
// sheet-7's notification list so the drawer keeps one vertical spine.
function Section({
  label,
  action,
  children,
}: {
  label?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {label}
          </h3>
          {action}
        </div>
      ) : null}
      {children}
    </div>
  )
}

// MiniProgress: the hatched track + Progress indicator copied verbatim from
// sheet-7; the target progress bar is half of the block's signature.
function MiniProgress({ value }: { value: number }) {
  const indicatorColor =
    value >= 80
      ? "**:data-[slot=progress-indicator]:bg-success"
      : value >= 50
        ? "**:data-[slot=progress-indicator]:bg-primary"
        : "**:data-[slot=progress-indicator]:bg-warning"

  return (
    <div className="bg-muted/55 relative mt-1.5 h-1 overflow-hidden rounded-full">
      <div
        className="text-muted-foreground pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,currentColor_0,currentColor_1px,transparent_0,transparent_4px)] opacity-20"
        aria-hidden="true"
      />
      <Progress
        value={value}
        className={cn(
          "absolute inset-0 gap-0",
          "**:data-[slot=progress-track]:h-full **:data-[slot=progress-track]:rounded-none **:data-[slot=progress-track]:bg-transparent",
          "**:data-[slot=progress-indicator]:rounded-none",
          indicatorColor
        )}
      />
    </div>
  )
}

// FactRow: definition facts as a label/value dl, the grammar from
// solution-agents-7's run-detail sheet.
function FactRow({ fact }: { fact: MetricFact }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground text-sm">{fact.label}</dt>
      <dd
        className={cn(
          "text-foreground min-w-0 text-sm",
          fact.mono && "font-mono text-xs"
        )}
      >
        {fact.value}
      </dd>
    </div>
  )
}

// Owner avatars: sheet-7's AvatarGroup grammar; Iris Vale resolves to initials
// as the deliberate fallback. The contributor avatars are the other half of the
// signature.
function OwnerAvatars({
  owners,
  leadOwnerId,
}: {
  owners: MetricOwner[]
  leadOwnerId: string
}) {
  const lead = owners.find((owner) => owner.id === leadOwnerId)

  return (
    <div className="flex items-center justify-between gap-3">
      <AvatarGroup className="-space-x-1">
        {owners.map((owner) => (
          <Avatar key={owner.id} className="size-6">
            {owner.avatar ? (
              <AvatarImage src={owner.avatar} alt={owner.name} />
            ) : null}
            <AvatarFallback className="text-[10px]">
              {owner.initials}
            </AvatarFallback>
          </Avatar>
        ))}
      </AvatarGroup>
      {lead ? (
        <p className="text-muted-foreground inline-flex min-w-0 flex-wrap items-center justify-end gap-x-1.5 text-xs">
          <span className="text-foreground font-medium">{lead.name}</span>
          <span
            className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
            aria-hidden="true"
          />
          <span className="truncate">leads</span>
        </p>
      ) : null}
    </div>
  )
}

// Alert rule row: sheet-7's notification-item grammar (colored icon cell +
// content column with a title/badge row and a muted meta line), reskinned to the
// metric's one alert rule. No hand-rolled card or icon box.
function AlertRuleRow({ rule }: { rule: AlertRule }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-warning relative grid size-5 shrink-0 place-items-center">
        <span className="grid size-5 place-items-center leading-none [&_svg]:block [&_svg]:size-4">
          <BellIcon aria-hidden="true" />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-foreground min-w-0 text-sm leading-5 font-medium">
            {rule.name}
          </p>
          <Badge variant={alertRuleStatusVariant[rule.status]}>
            {rule.status}
          </Badge>
        </div>
        <p className="text-muted-foreground inline-flex flex-wrap items-center gap-x-1.5 text-xs">
          <span>{rule.threshold}</span>
          <span
            className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
            aria-hidden="true"
          />
          <span>{rule.window}</span>
        </p>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
          <Avatar className="size-5">
            {rule.owner.avatar ? (
              <AvatarImage src={rule.owner.avatar} alt={rule.owner.name} />
            ) : null}
            <AvatarFallback className="text-[9px]">
              {rule.owner.initials}
            </AvatarFallback>
          </Avatar>
          <span>{rule.owner.name}</span>
        </div>
      </div>
    </div>
  )
}

// ActivityRow: timeline-1's TimelineItem / Header / Indicator grammar (via the
// agents-7 ladder) reskinned to one metric change.
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
        <TimelineSeparator className="bg-border group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.25rem-0.5rem)] group-data-[orientation=vertical]/timeline:translate-y-5" />
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
        {activity.detail ? (
          <p className="text-muted-foreground max-w-[52ch] text-sm leading-5">
            {activity.detail}
          </p>
        ) : null}
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

export function MetricDetailSheet() {
  return (
    <Sheet defaultOpen>
      {/* Actions */}
      <div className="flex min-h-[360px] items-center justify-center">
        <SheetTrigger
          render={
            <Button type="button" variant="outline" size="lg">
              <PanelRightIcon data-icon="inline-start" aria-hidden="true" />
              Open Sheet
            </Button>
          }
        />
      </div>

      {/* Content */}
      <SheetContent
        side="right"
        showCloseButton={false}
        initialFocus={false}
        className="bg-popover inset-y-4 right-4 left-auto z-[60] flex h-[calc(100svh-2rem)] w-[min(30rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 outline-none"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 gap-0 border-b p-0">
          <div className="flex min-h-11 items-center justify-between gap-2 px-5">
            <span className="text-muted-foreground inline-flex items-center gap-2 font-mono text-xs">
              <TargetIcon className="size-3.5" aria-hidden="true" />
              {METRIC.id}
            </span>
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close metric detail"
                  className="shrink-0"
                >
                  <XIcon aria-hidden="true" />
                </Button>
              }
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2 px-5 pt-1 pb-4">
            <div className="flex min-w-0 items-center gap-2">
              <SheetTitle className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
                {METRIC.name}
              </SheetTitle>
              <Badge variant={metricHealthVariant[METRIC.health]}>
                {METRIC.health}
              </Badge>
            </div>
            <SheetDescription className="text-muted-foreground text-xs">
              801 of 1,284 workspaces activated in 28 days.
            </SheetDescription>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full min-h-0">
            {/* Hero: current value, delta, and the target progress */}
            <Section>
              <div className="flex items-end justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-foreground text-4xl font-semibold tracking-tight tabular-nums">
                    {METRIC.current}
                  </span>
                  <Badge variant="success-light">{METRIC.delta}</Badge>
                </div>
                <span className="text-muted-foreground pb-1 text-xs">
                  {METRIC.prior}
                </span>
              </div>
              <MiniProgress value={METRIC.progress} />
              <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                <span>Target {METRIC.target}</span>
                <span className="tabular-nums">{METRIC.progress}% ready</span>
              </div>
              <p className="text-muted-foreground text-sm">
                {METRIC.sampleLine}
              </p>
            </Section>

            <Separator className="opacity-60" />

            {/* Definition facts */}
            <Section label="Definition">
              <dl className="grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-2.5">
                {METRIC.facts.map((fact) => (
                  <FactRow key={fact.label} fact={fact} />
                ))}
              </dl>
            </Section>

            <Separator className="opacity-60" />

            {/* Owners */}
            <Section label="Owners">
              <OwnerAvatars
                owners={METRIC.owners}
                leadOwnerId={METRIC.leadOwnerId}
              />
            </Section>

            <Separator className="opacity-60" />

            {/* Alert rule */}
            <Section label="Alert Rule">
              <AlertRuleRow rule={METRIC.alertRule} />
            </Section>

            <Separator className="opacity-60" />

            <Section label="Readout">
              <div className="grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-2.5">
                {METRIC.readout.map((fact) => (
                  <FactRow key={fact.label} fact={fact} />
                ))}
              </div>
            </Section>

            <Separator className="opacity-60" />

            {/* Recent changes */}
            <Section label="Recent Changes">
              <Timeline defaultValue={0}>
                {METRIC_ACTIVITY.map((item, index) => (
                  <ActivityRow key={item.id} activity={item} step={index + 1} />
                ))}
              </Timeline>
            </Section>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}