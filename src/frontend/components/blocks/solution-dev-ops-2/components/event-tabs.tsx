import { useMemo, type ReactNode } from "react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert"
import { Badge } from "@/components/reui/badge"
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/reui/code-block/code-block"
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

import {
  formatAgo,
  formatFull,
  formatMinute,
  formatOffset,
  formatSpan,
  formatTime,
  ipLabel,
  maskMiddle,
  userAgentOf,
} from "./audit-format"
import { byTimeAscending, countLines, toJsonPayload } from "./audit-query"
import { CopyToken } from "./copy-token"
import { ACTORS, AUTH_LABEL, CHANGES, type AuditEvent } from "./data"
import { CATEGORY_ICONS, LOCK_GLYPH, UI_ICONS } from "./icons"
import {
  ActorFace,
  DotSeparator,
  EnvironmentFace,
  OutcomeFace,
  ResourceFace,
  ReviewFace,
  SourceFace,
} from "./value-faces"

/** The density variables are the primitive's extension point; its defaults
 *  suit a docs page, not a 36rem sheet. */
const CODE_DENSITY =
  "w-full min-w-0 [--code-block-line-height:1.125rem] [--code-block-padding:--spacing(2)]"

/** Full height, so only the sheet scrolls down; the code region scrolls
 *  across itself: one focus stop, and its thin bar shows only on overflow. */
const CODE_SURFACE = (
  <CodeBlockContent className="[scrollbar-width:thin] overflow-x-auto focus-visible:ring-inset" />
)

type Fact = { label: string; value: ReactNode }

function FactGroup({ title, facts }: { title: string; facts: Fact[] }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h3 className="text-muted-foreground text-xs font-medium">{title}</h3>
      <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm">
        {facts.map((fact) => (
          <div key={fact.label} className="contents">
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="flex min-w-0 items-center leading-5">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Plain({
  children,
  mono = false,
}: {
  children: ReactNode
  mono?: boolean
}) {
  return (
    <span
      className={
        mono
          ? "min-w-0 font-mono text-xs wrap-break-word"
          : "min-w-0 wrap-break-word"
      }
    >
      {children}
    </span>
  )
}

/** A value with its muted gloss, wrapping under it on a narrow sheet. */
function WithGloss({ value, gloss }: { value: ReactNode; gloss: string }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2">
      {value}
      <span className="text-muted-foreground">{gloss}</span>
    </span>
  )
}

export function DetailsTab({ event }: { event: AuditEvent }) {
  const actor = ACTORS[event.actorId]
  const reviewer = event.reviewedBy ? ACTORS[event.reviewedBy] : null

  return (
    <div className="flex flex-col gap-5">
      {event.outcome === "denied" ? (
        <Alert variant="warning">
          {UI_ICONS.shieldAlert}
          <AlertTitle>Permission Denied</AlertTitle>
          <AlertDescription>{event.reason}</AlertDescription>
        </Alert>
      ) : event.outcome === "failed" ? (
        <Alert variant="destructive">
          {UI_ICONS.circleX}
          <AlertTitle>Action Failed</AlertTitle>
          <AlertDescription>{event.reason}</AlertDescription>
        </Alert>
      ) : null}

      <FactGroup
        title="Actor"
        facts={[
          { label: "Name", value: <ActorFace actorId={event.actorId} /> },
          {
            label: "Role",
            value: <Plain>{`${actor.role}, ${actor.team}`}</Plain>,
          },
          {
            label: "Auth",
            value: <Plain>{AUTH_LABEL[event.authMethod]}</Plain>,
          },
          {
            label: "Session",
            value: <CopyToken value={event.sessionId} label="session ID" />,
          },
          {
            label: "IP address",
            value: (
              <WithGloss
                value={
                  <span className="font-mono text-xs tabular-nums">
                    {event.ip}
                  </span>
                }
                gloss={ipLabel(event.ip)}
              />
            ),
          },
          {
            label: "User agent",
            value: <Plain mono>{userAgentOf(event)}</Plain>,
          },
        ]}
      />

      <FactGroup
        title="Target"
        facts={[
          {
            label: "Resource",
            value: <ResourceFace resource={event.resource} showId={false} />,
          },
          {
            label: "Resource ID",
            value: <CopyToken value={event.resource.id} label="resource ID" />,
          },
          {
            label: "Environment",
            value: <EnvironmentFace environment={event.environment} />,
          },
          {
            label: "Cluster",
            value: event.cluster ? (
              <Plain mono>{event.cluster}</Plain>
            ) : (
              <span className="text-muted-foreground">None</span>
            ),
          },
          { label: "Source", value: <SourceFace source={event.source} /> },
        ]}
      />

      <FactGroup
        title="Request"
        facts={[
          {
            label: "Request ID",
            value: <CopyToken value={event.requestId} label="request ID" />,
          },
          {
            label: "Trace ID",
            value: (
              <CopyToken
                value={event.traceId}
                display={maskMiddle(event.traceId)}
                label="trace ID"
              />
            ),
          },
          {
            label: "Recorded",
            value: (
              <WithGloss
                value={
                  <span className="tabular-nums">{formatFull(event.at)}</span>
                }
                gloss={formatAgo(event.at)}
              />
            ),
          },
          {
            label: "Review",
            value:
              reviewer && event.reviewedAt ? (
                <WithGloss
                  value={<ReviewFace event={event} />}
                  gloss={`by ${reviewer.name}, ${formatMinute(event.reviewedAt)}`}
                />
              ) : (
                <ReviewFace event={event} />
              ),
          },
        ]}
      />
    </div>
  )
}

export function ChangesTab({ event }: { event: AuditEvent }) {
  const change = event.changeKey ? CHANGES[event.changeKey] : null

  if (!change) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">{UI_ICONS.fileText}</EmptyMedia>
          <EmptyTitle>No Change Recorded</EmptyTitle>
          <EmptyDescription>
            This event did not modify configuration.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const applied = event.outcome === "success"

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        {applied ? (
          <span className="text-sm font-medium">Applied change</span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium">Attempted change</span>
            <Badge variant="outline">Not applied</Badge>
          </span>
        )}
        <span className="flex items-center gap-2 text-xs tabular-nums">
          <span className="text-success">
            {`+${countLines(change.added)}`}
            <span className="sr-only"> lines added</span>
          </span>
          <span className="text-destructive">
            {`-${countLines(change.removed)}`}
            <span className="sr-only"> lines removed</span>
          </span>
        </span>
      </div>
      <CodeBlock
        code={change.code}
        language={change.language}
        diff={{ added: change.added, removed: change.removed }}
        showLineNumbers
        className={CODE_DENSITY}
      >
        <CodeBlockHeader className="min-h-8 gap-2 px-2.5">
          <CodeBlockTitle className="truncate">{change.file}</CodeBlockTitle>
          <CodeBlockCopyButton
            className="ms-auto"
            labels={{ copy: "Copy diff", copied: "Copied" }}
          />
        </CodeBlockHeader>
        {CODE_SURFACE}
      </CodeBlock>
      {change.redacted ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {LOCK_GLYPH}
          Secret values are redacted before they are written.
        </p>
      ) : null}
    </div>
  )
}

export function RawTab({ event }: { event: AuditEvent }) {
  const raw = useMemo(
    () => JSON.stringify(toJsonPayload(event), null, 2),
    [event]
  )
  const filename = `${event.id}.json`

  return (
    <CodeBlock
      code={raw}
      language="json"
      showLineNumbers
      foldable
      className={CODE_DENSITY}
    >
      <CodeBlockHeader className="min-h-8 gap-2 px-2.5">
        <CodeBlockTitle className="truncate">{filename}</CodeBlockTitle>
        <CodeBlockDownloadButton
          className="ms-auto"
          filename={filename}
          label={`Download ${filename}`}
        />
        <CodeBlockCopyButton labels={{ copy: "Copy JSON", copied: "Copied" }} />
      </CodeBlockHeader>
      {CODE_SURFACE}
    </CodeBlock>
  )
}

/** One step of a trace: what happened, to what, and how far from the open
 *  event. Every other step opens that event; the open one is marked. */
function TraceStep({
  step,
  index,
  current,
  showActor,
  onOpenEvent,
}: {
  step: AuditEvent
  index: number
  current: AuditEvent
  /** A request crosses actors; a session is one person, named once above. */
  showActor: boolean
  onOpenEvent: (id: string) => void
}) {
  const isCurrent = step.id === current.id
  return (
    <TimelineItem
      step={index + 1}
      className="group-data-[orientation=vertical]/timeline:ms-10 group-data-[orientation=vertical]/timeline:not-last:pb-5"
    >
      <TimelineHeader>
        <TimelineSeparator className="bg-border! group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.5rem)] group-data-[orientation=vertical]/timeline:w-px! group-data-[orientation=vertical]/timeline:translate-y-7" />
        <TimelineIndicator
          className={cn(
            "bg-background text-muted-foreground flex size-6 items-center justify-center rounded-full border group-data-[orientation=vertical]/timeline:-left-7 [&_svg]:size-3",
            isCurrent ? "border-foreground! text-foreground" : "border-border!"
          )}
        >
          {CATEGORY_ICONS[step.category]}
        </TimelineIndicator>
        <TimelineTitle
          aria-level={4}
          className="flex min-w-0 items-center gap-2 text-sm leading-6"
        >
          {isCurrent ? (
            <span className="min-w-0 truncate font-mono font-medium">
              {step.action}
            </span>
          ) : (
            // Stretched over the whole step, so the row is one target.
            <button
              type="button"
              onClick={() => onOpenEvent(step.id)}
              className="focus-visible:after:ring-ring/50 min-w-0 truncate text-start font-mono font-medium underline-offset-4 outline-none after:absolute after:-inset-x-2 after:-top-1 after:bottom-4 after:z-10 group-last/timeline-item:after:-bottom-1 hover:underline focus-visible:after:ring-[3px]"
            >
              {step.action}
            </button>
          )}
          <OutcomeFace outcome={step.outcome} />
        </TimelineTitle>
      </TimelineHeader>
      <TimelineContent className="flex min-w-0 flex-col gap-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <ResourceFace resource={step.resource} showId={false} />
          {showActor ? (
            <>
              <DotSeparator />
              <ActorFace actorId={step.actorId} className="text-sm" />
            </>
          ) : null}
        </span>
        <span className="line-clamp-2 text-xs">{step.summary}</span>
        {/* Absolute and relative time together, so the title row keeps the
            whole verb on a narrow sheet. */}
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs tabular-nums">
          {formatTime(step.at)}
          <DotSeparator />
          {isCurrent ? (
            <span className="text-foreground font-medium">This event</span>
          ) : (
            formatOffset(Date.parse(step.at) - Date.parse(current.at))
          )}
        </span>
      </TimelineContent>
    </TimelineItem>
  )
}

/** Everything that shares one correlation key, in order, the open event
 *  included, so the reader sees where it sits in the sequence. */
function RelatedTrace({
  title,
  id,
  idLabel,
  current,
  others,
  showActor,
  onOpenEvent,
}: {
  title: string
  id: string
  idLabel: string
  current: AuditEvent
  others: AuditEvent[]
  showActor: boolean
  onOpenEvent: (id: string) => void
}) {
  const steps = [...others, current].sort(byTimeAscending)
  const span = Date.parse(steps[steps.length - 1].at) - Date.parse(steps[0].at)

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          <CopyToken value={id} label={idLabel} />
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">
          {steps.length} events{" "}
          {Math.round(span / 1000) === 0
            ? "within a second"
            : `over ${formatSpan(span)}`}
        </span>
      </header>
      {/* No step is "completed": the primitive's progress tint means nothing
          in a trace, so the active step sits before the first. */}
      <Timeline defaultValue={0}>
        {steps.map((step, index) => (
          <TraceStep
            key={step.id}
            step={step}
            index={index}
            current={current}
            showActor={showActor}
            onOpenEvent={onOpenEvent}
          />
        ))}
      </Timeline>
    </section>
  )
}

export function RelatedTab({
  event,
  related,
  onOpenEvent,
}: {
  event: AuditEvent
  related: { request: AuditEvent[]; session: AuditEvent[] }
  onOpenEvent: (id: string) => void
}) {
  if (related.request.length === 0 && related.session.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">{UI_ICONS.activity}</EmptyMedia>
          <EmptyTitle>No Related Events</EmptyTitle>
          <EmptyDescription>
            No other event shares this request or session.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {related.request.length > 0 ? (
        <RelatedTrace
          title="Same Request"
          id={event.requestId}
          idLabel="request ID"
          current={event}
          others={related.request}
          showActor
          onOpenEvent={onOpenEvent}
        />
      ) : null}
      {related.session.length > 0 ? (
        <RelatedTrace
          title="Same Session"
          id={event.sessionId}
          idLabel="session ID"
          current={event}
          others={related.session}
          showActor={false}
          onOpenEvent={onOpenEvent}
        />
      ) : null}
    </div>
  )
}