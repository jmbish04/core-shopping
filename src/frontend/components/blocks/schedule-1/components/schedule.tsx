"use client"

import { useState } from "react"
import { Frame, FramePanel } from "@/components/reui/frame"

import { DEMO_REFERENCE_DATE, getDatesWithEvents, MOCK_EVENTS } from "./data"
import type { EventsFilter } from "./data"
import { EventsList } from "./events-list"
import { ScheduleCalendar } from "./schedule-calendar"

export function Schedule() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    DEMO_REFERENCE_DATE
  )
  const [filter, setFilter] = useState<EventsFilter>("all")
  const datesWithEvents = getDatesWithEvents(MOCK_EVENTS)

  return (
    <Frame className="w-full max-w-4xl">
      <FramePanel className="flex flex-col p-0! lg:flex-row">
        {/* Left - calendar */}
        <div className="lg:border-border shrink-0 p-5 pt-5.5 lg:w-[370px] lg:border-r">
          <ScheduleCalendar
            selected={selectedDate}
            onSelect={setSelectedDate}
            datesWithEvents={datesWithEvents}
          />
        </div>

        {/* Right - events */}
        <div className="flex-1 p-5">
          <EventsList
            selectedDate={selectedDate}
            filter={filter}
            onFilterChange={setFilter}
          />
        </div>
      </FramePanel>
    </Frame>
  )
}