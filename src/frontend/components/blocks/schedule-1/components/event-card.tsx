import { Badge } from "@/components/reui/badge"

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import { Item } from "@/components/ui/item"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  initials,
  MAX_VISIBLE,
  parseDateParts,
  STATUS_VARIANT,
  type Attendee,
  type EventCardProps,
} from "./data"
import { ClockIcon, MapPinIcon } from "lucide-react"

function AttendeeGroup({ attendees }: { attendees: Attendee[] }) {
  if (attendees.length === 0) return null
  const visible = attendees.slice(0, MAX_VISIBLE)
  const overflow = attendees.length - MAX_VISIBLE

  return (
    <AvatarGroup className="-space-x-1.5">
      {visible.map((a) => (
        <Avatar key={a.id} className="size-4!" title={a.name}>
          <AvatarImage src={a.avatar} alt={a.name} />
          <AvatarFallback className="text-[9px]">
            {initials(a.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <AvatarGroupCount className="size-4! text-[10px]">
          {/* A native button in both bases, so the count opens every
              attendee by tap or keyboard at phone widths too. */}
          <Popover>
            <PopoverTrigger
              aria-label={`${overflow} more: ${attendees
                .slice(MAX_VISIBLE)
                .map((a) => a.name)
                .join(", ")}`}
              className="hover:text-foreground focus-visible:ring-ring/50 flex size-full items-center justify-center rounded-full tabular-nums outline-none focus-visible:ring-2"
            >
              +{overflow}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto">
              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground text-xs font-medium">
                  Attendees
                </span>
                <ul className="flex flex-col gap-1.5">
                  {attendees.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarImage src={a.avatar} alt="" />
                        <AvatarFallback>{initials(a.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{a.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </PopoverContent>
          </Popover>
        </AvatarGroupCount>
      )}
    </AvatarGroup>
  )
}

export function EventCard({ event }: EventCardProps) {
  const { day, monthShort } = parseDateParts(event.date)
  const variant = STATUS_VARIANT[event.status]

  return (
    <Item variant="outline" size="xs" className="flex items-start gap-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <a
          href="#"
          className="text-foreground hover:text-primary text-sm leading-tight font-medium"
        >
          {event.title}
        </a>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge variant={variant} size="sm">
            {event.status}
          </Badge>

          <AttendeeGroup attendees={event.attendees} />

          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <ClockIcon className="size-3 shrink-0" aria-hidden="true" />
            {monthShort} {day} · {event.time}
          </span>

          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <MapPinIcon className="size-3 shrink-0" aria-hidden="true" />
            {event.location}
          </span>
        </div>
      </div>
    </Item>
  )
}