import { type ReactNode } from "react"
import { Badge } from "@/components/reui/badge"
import { IconTile } from "@/components/reui/icon-tile"
import { cn } from "@/lib/utils"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Spinner } from "@/components/ui/spinner"

import {
  ENVIRONMENT_OPTIONS,
  JOB_HEALTH,
  PERSON_BY_ID,
  RUN_STATUS,
  SCHEDULER_NAME,
  SERVICES,
  TRIGGER_LABEL,
  type Environment,
  type JobHealth,
  type PersonId,
  type RunStatus,
  type RunTrigger,
  type ServiceId,
} from "./data"
import { RUN_GLYPHS, UI_ICONS } from "./icons"

export function DotSeparator({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-muted-foreground/40 size-1 shrink-0 rounded-full",
        className
      )}
    />
  )
}

export function RunStatusFace({ status }: { status: RunStatus }) {
  return (
    <Badge variant={RUN_STATUS[status].variant}>
      {status === "running" ? (
        <Spinner aria-hidden="true" className="size-3" />
      ) : null}
      {RUN_STATUS[status].label}
    </Badge>
  )
}

/** One label line tall and pinned to the top, so a wrapped row keeps its glyph.
 *  The status also reads in words for assistive tech. */
export function RunStatusGlyph({ status }: { status: RunStatus }) {
  return (
    <span
      className={cn(
        "flex h-5 w-4 shrink-0 items-center justify-center self-start",
        RUN_STATUS[status].text
      )}
    >
      {status === "running" ? (
        <Spinner aria-hidden="true" />
      ) : (
        RUN_GLYPHS[status]
      )}
      <span className="sr-only">{RUN_STATUS[status].label}</span>
    </span>
  )
}

export function HealthFace({ health }: { health: JobHealth }) {
  return (
    <Badge variant={JOB_HEALTH[health].variant}>
      {JOB_HEALTH[health].label}
    </Badge>
  )
}

export function TriggerFace({ trigger }: { trigger: RunTrigger }) {
  return <Badge variant="outline">{TRIGGER_LABEL[trigger]}</Badge>
}

export function EnvironmentFace({ environment }: { environment: Environment }) {
  const label =
    ENVIRONMENT_OPTIONS.find((option) => option.value === environment)?.label ??
    environment
  return <Badge variant="outline">{label}</Badge>
}

/** Icon scales with its host text: size-4 beside text-sm, size-3.5 in xs rows. */
export function ServiceFace({
  service,
  compact = false,
}: {
  service: ServiceId
  compact?: boolean
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center",
        compact
          ? "gap-1.5 [&_svg:not([class*=size-])]:size-3.5"
          : "gap-2 [&_svg:not([class*=size-])]:size-4"
      )}
    >
      {SERVICES[service].icon}
      <span className="truncate">{SERVICES[service].label}</span>
    </span>
  )
}

/** The face sits at text height: size-5 beside text-sm, size-4 in xs rows. */
export function OwnerAvatar({
  ownerId,
  compact = false,
}: {
  ownerId: PersonId
  compact?: boolean
}) {
  const owner = PERSON_BY_ID.get(ownerId)
  if (!owner) return null
  return (
    <Avatar size="sm" className={compact ? "size-4" : "size-5"}>
      <AvatarImage src={owner.avatar} alt="" />
      <AvatarFallback className={compact ? "text-[8px]" : "text-[9px]"}>
        {owner.initials}
      </AvatarFallback>
    </Avatar>
  )
}

export function OwnerFace({
  ownerId,
  compact = false,
}: {
  ownerId: PersonId
  compact?: boolean
}) {
  const owner = PERSON_BY_ID.get(ownerId)
  if (!owner) return <span className="text-muted-foreground">Unassigned</span>
  return (
    <span
      className={cn("flex min-w-0 items-center", compact ? "gap-1.5" : "gap-2")}
    >
      <OwnerAvatar ownerId={ownerId} compact={compact} />
      <span className="truncate">{owner.name}</span>
    </span>
  )
}

/** The non-human actor: a tile, never an avatar. */
export function SchedulerFace() {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <IconTile variant="outline" size="xs" aria-hidden="true">
        {UI_ICONS.schedule}
      </IconTile>
      <span className="truncate">{SCHEDULER_NAME}</span>
    </span>
  )
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