import { Badge } from "@/components/reui/badge"
import { cn } from "@/lib/utils"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

import {
  ENVIRONMENT_OPTIONS,
  PERSON_BY_ID,
  SERVICES,
  type Environment,
  type PersonId,
  type ServiceId,
} from "./data"

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

export function EnvironmentFace({ environment }: { environment: Environment }) {
  const label =
    ENVIRONMENT_OPTIONS.find((option) => option.value === environment)?.label ??
    environment
  return <Badge variant="outline">{label}</Badge>
}

/** Icon scales with its host text: size-4 beside text-sm. */
export function ServiceFace({ service }: { service: ServiceId }) {
  return (
    <span className="flex min-w-0 items-center gap-2 [&_svg:not([class*=size-])]:size-4">
      {SERVICES[service].icon}
      <span className="truncate">{SERVICES[service].label}</span>
    </span>
  )
}

/** The face sits at text height: size-5 beside text-sm. */
function OwnerAvatar({ ownerId }: { ownerId: PersonId }) {
  const owner = PERSON_BY_ID.get(ownerId)
  if (!owner) return null
  return (
    <Avatar size="sm" className="size-5">
      <AvatarImage src={owner.avatar} alt="" />
      <AvatarFallback className="text-[9px]">{owner.initials}</AvatarFallback>
    </Avatar>
  )
}

export function OwnerFace({ ownerId }: { ownerId: PersonId }) {
  const owner = PERSON_BY_ID.get(ownerId)
  if (!owner) return <span className="text-muted-foreground">Unassigned</span>
  return (
    <span className="flex min-w-0 items-center gap-2">
      <OwnerAvatar ownerId={ownerId} />
      <span className="truncate">{owner.name}</span>
    </span>
  )
}