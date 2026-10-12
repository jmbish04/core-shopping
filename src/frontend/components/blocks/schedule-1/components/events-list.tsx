import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Item, ItemMedia } from "@/components/ui/item"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FILTER_ITEMS,
  matchesFilter,
  MOCK_EVENTS,
  toDateKey,
  type EventsFilter,
  type EventsListProps,
  type MockEvent,
} from "./data"
import { EventCard } from "./event-card"
import { PlusIcon, CalendarIcon } from "lucide-react"

export function EventsList({
  selectedDate,
  filter = "all",
  onFilterChange,
}: EventsListProps) {
  const dateKey = selectedDate ? toDateKey(selectedDate) : null

  const events = MOCK_EVENTS.filter((event) => {
    if (dateKey && event.date !== dateKey) return false
    return matchesFilter(event, filter)
  })

  const headingLabel = selectedDate
    ? selectedDate.toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "All Events"

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {/* Heading */}
        <div className="min-w-0">
          <h2 className="text-foreground text-sm font-semibold">
            {headingLabel}
          </h2>
          <p className="text-muted-foreground text-xs">
            {events.length > 0
              ? `${events.length} event${events.length !== 1 ? "s" : ""}`
              : "No events found"}
          </p>
        </div>

        {/* Filters */}
        <div className="flex shrink-0 items-center gap-2 sm:w-auto">
          <Select
            value={filter}
            onValueChange={(v) => onFilterChange?.(v as EventsFilter)}
            items={FILTER_ITEMS}
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              {FILTER_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm">
            <PlusIcon className="size-4" aria-hidden="true" />
            Add
          </Button>
        </div>
      </div>

      {/* Events */}
      <div className="min-h-[320px]">
        <div className="relative flex max-h-full">
          <ScrollArea
            className={cn(
              "-mr-3.5 max-h-[320px] grow pr-3.5",
              "**:data-[slot=scroll-area-thumb]:bg-foreground/15 **:data-[slot=scroll-area-thumb]:rounded-full",
              "**:data-[slot=scroll-area-viewport]:mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))]",
              "**:data-[slot=scroll-area-viewport]:mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))]",
              "**:data-[slot=scroll-area-viewport]:mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))]",
              "**:data-[slot=scroll-area-viewport]:mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))]",
              "**:data-[slot=scroll-area-viewport]:[--fade-size:1.5rem]"
            )}
          >
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Item
                  render={<span />}
                  className="bg-muted flex size-10 items-center justify-center rounded-full p-0"
                >
                  <ItemMedia variant="icon" className="size-auto">
                    <CalendarIcon className="text-muted-foreground size-5" aria-hidden="true" />
                  </ItemMedia>
                </Item>
                <div className="space-y-1">
                  <p className="text-foreground text-sm font-medium">
                    No events found
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {dateKey
                      ? "Nothing scheduled for this day."
                      : "Try changing the filter."}
                  </p>
                </div>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {events.map((event: MockEvent) => (
                  <li key={event.id}>
                    <EventCard event={event} />
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}