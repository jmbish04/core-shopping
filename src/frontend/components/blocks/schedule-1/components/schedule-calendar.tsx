import { useState } from "react"
import { cn } from "@/lib/utils"
import { DayButton } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar, CalendarDayButton } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DEMO_REFERENCE_DATE,
  MONTHS,
  YEARS,
  type ScheduleCalendarProps,
} from "./data"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

// Weekday header highlight tracks the fixed demo clock, not the live date.
const TODAY_WEEKDAY_NAME = DEMO_REFERENCE_DATE.toLocaleString("en-US", {
  weekday: "short",
}).toUpperCase()

export function ScheduleCalendar({
  selected,
  onSelect,
  datesWithEvents = new Set(),
}: ScheduleCalendarProps) {
  const [month, setMonth] = useState<Date>(selected ?? DEMO_REFERENCE_DATE)

  const stepMonth = (delta: number) =>
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))

  const handleMonthSelect = (value: string) => {
    const i = MONTHS.indexOf(value)
    if (i >= 0) setMonth(new Date(month.getFullYear(), i, 1))
  }

  const handleYearSelect = (value: string) => {
    const y = parseInt(value, 10)
    if (!isNaN(y)) setMonth(new Date(y, month.getMonth(), 1))
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 select-none">
      {/* ── Custom header ── */}
      <div className="flex w-full grow items-center justify-between gap-1">
        {/* Prev month */}
        <Button
          variant="ghost"
          size="sm"
          className="size-7 shrink-0 p-0"
          onClick={() => stepMonth(-1)}
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
        </Button>

        {/* Month select */}
        <Select
          value={MONTHS[month.getMonth()]}
          onValueChange={(value) => handleMonthSelect(value ?? "")}
        >
          <SelectTrigger size="sm" className="min-w-0 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Year select */}
        <Select
          value={String(month.getFullYear())}
          onValueChange={(value) => handleYearSelect(value ?? "")}
        >
          <SelectTrigger size="sm" className="w-22 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Next month */}
        <Button
          variant="ghost"
          size="sm"
          className="size-7 shrink-0 p-0"
          onClick={() => stepMonth(1)}
          aria-label="Next month"
        >
          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      {/* ── Calendar ── */}
      <Calendar
        mode="single"
        selected={selected}
        onSelect={onSelect}
        month={month}
        onMonthChange={setMonth}
        showOutsideDays
        hideNavigation
        className="w-full bg-transparent p-0 md:[--cell-size:--spacing(11)]"
        formatters={{
          formatWeekdayName: (date) =>
            date.toLocaleString("en-US", { weekday: "short" }).toUpperCase(),
        }}
        classNames={{
          month_caption: "hidden",
          nav: "hidden",
          weekdays: "flex gap-1",
          weekday:
            "flex-1 flex items-center justify-center h-14 text-[0.65rem] font-medium text-muted-foreground",
          week: "flex gap-1 mt-1",
          day: "flex-1 aspect-square p-0",
          day_button: cn(
            "bg-muted/50 hover:bg-muted",
            " rounded-md   ",
            "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[selected-single=true]:hover:bg-primary data-[selected-single=true]:hover:text-primary-foreground!"
          ),
          outside: "opacity-60",
          disabled: "opacity-60",
          today: cn("bg-accent text-foreground", " rounded-md   "),
        }}
        components={{
          Weekday: ({
            children,
            className: cls,
            ...props
          }: React.ComponentPropsWithoutRef<"th">) => {
            const isToday = children === TODAY_WEEKDAY_NAME
            return (
              <th
                scope="col"
                className={cn(
                  "flex h-6! flex-1 items-center justify-center rounded-md text-xs font-medium",
                  isToday
                    ? "bg-accent text-foreground!"
                    : "text-muted-foreground",
                  cls
                )}
                {...props}
              >
                {children}
              </th>
            )
          },

          DayButton: ({
            children,
            modifiers,
            day,
            ...props
          }: React.ComponentProps<typeof DayButton>) => {
            const dateKey = day.date.toISOString().slice(0, 10)
            const hasEvents = !modifiers.outside && datesWithEvents.has(dateKey)

            return (
              <CalendarDayButton day={day} modifiers={modifiers} {...props}>
                {hasEvents ? (
                  <span
                    className="bg-primary text-primary-foreground in-data-[selected-single=true]:bg-primary-foreground! size-1 rounded-full"
                    aria-hidden
                  />
                ) : (
                  <span className="size-1" aria-hidden />
                )}
                {children}
              </CalendarDayButton>
            )
          },
        }}
      />
    </div>
  )
}