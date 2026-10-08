import { type ReactNode } from "react"
import { Badge } from "@/components/reui/badge"
import { cn } from "@/lib/utils"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

import { reviewState } from "./audit-query"
import {
  ACTORS,
  CATEGORY_LABEL,
  ENV_LABEL,
  OUTCOME_CONFIG,
  REVIEW_CONFIG,
  SOURCE_LABEL,
  type ActorId,
  type AuditEvent,
  type Category,
  type Environment,
  type Outcome,
  type Resource,
  type ReviewState,
  type Source,
} from "./data"
import {
  CATEGORY_ICONS,
  RESOURCE_ICONS,
  SERVICE_ACTOR_ICONS,
  SOURCE_ICONS,
} from "./icons"

export function DotSeparator() {
  return (
    <span
      aria-hidden
      className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
    />
  )
}

/** People wear a small portrait; service accounts wear their brand mark,
 *  frameless, in the same 20px slot so names align. */
export function ActorAvatar({ actorId }: { actorId: ActorId }) {
  const actor = ACTORS[actorId]
  if (actor.kind === "service") {
    return (
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center"
      >
        {SERVICE_ACTOR_ICONS[actor.id]}
      </span>
    )
  }
  return (
    <Avatar size="sm" className="size-5" aria-hidden>
      <AvatarImage src={actor.avatar} alt="" />
      <AvatarFallback>{actor.initials}</AvatarFallback>
    </Avatar>
  )
}

export function ActorFace({
  actorId,
  className,
}: {
  actorId: ActorId
  className?: string
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <ActorAvatar actorId={actorId} />
      <span className="truncate">{ACTORS[actorId].name}</span>
    </span>
  )
}

/** The verb is the row's identity, so it gets the whole cell. */
export function ActionFace({ action }: { action: string }) {
  return (
    <span className="flex min-w-0 items-center">
      <span className="truncate font-mono text-xs">{action}</span>
    </span>
  )
}

export function CategoryFace({ category }: { category: Category }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="text-muted-foreground flex shrink-0">
        {CATEGORY_ICONS[category]}
      </span>
      <span className="truncate">{CATEGORY_LABEL[category]}</span>
    </span>
  )
}

/** Handles people quote (DEP-4127, JOB-214) show inline; internal slugs
 *  that only restate the name stay in the sheet. */
const HANDLE = /^[A-Z]{2,5}-\d+$/

export function ResourceFace({
  resource,
  showId = true,
}: {
  resource: Resource
  showId?: boolean
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="text-muted-foreground flex shrink-0">
        {RESOURCE_ICONS[resource.type]}
      </span>
      <span className="truncate text-sm">{resource.name}</span>
      {showId && HANDLE.test(resource.id) ? (
        <span className="text-muted-foreground shrink-0 font-mono text-xs">
          {resource.id}
        </span>
      ) : null}
    </span>
  )
}

export function EnvironmentFace({ environment }: { environment: Environment }) {
  return <Badge variant="outline">{ENV_LABEL[environment]}</Badge>
}

export function SourceFace({ source }: { source: Source }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="text-muted-foreground flex shrink-0">
        {SOURCE_ICONS[source]}
      </span>
      <span className="text-muted-foreground truncate text-sm">
        {SOURCE_LABEL[source]}
      </span>
    </span>
  )
}

export function OutcomeFace({ outcome }: { outcome: Outcome }) {
  const config = OUTCOME_CONFIG[outcome]
  return <Badge variant={config.variant}>{config.label}</Badge>
}

export function ReviewStateFace({ state }: { state: ReviewState }) {
  const config = REVIEW_CONFIG[state]
  if (!config.variant) {
    return <span className="text-muted-foreground text-sm">{config.label}</span>
  }
  return <Badge variant={config.variant}>{config.label}</Badge>
}

export function ReviewFace({ event }: { event: AuditEvent }) {
  return <ReviewStateFace state={reviewState(event)} />
}

/** A filter value: the first pick's face, then an outline count for the rest. */
export function FirstFacePlus({
  values,
  face,
  empty,
}: {
  values: string[]
  face: (value: string) => ReactNode
  empty: string
}) {
  if (values.length === 0) return <>{empty}</>
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="flex min-w-0">{face(values[0])}</span>
      {values.length > 1 ? (
        <Badge variant="outline" className="shrink-0 tabular-nums">
          +{values.length - 1}
        </Badge>
      ) : null}
    </span>
  )
}