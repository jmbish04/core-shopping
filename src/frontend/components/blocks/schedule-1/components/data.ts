import type { BadgeProps } from "@/components/reui/badge"

export type EventStatus = "Upcoming" | "Cancelled" | "Pending" | "Completed"

export interface Attendee {
  id: string
  name: string
  avatar: string
}

export interface MockEvent {
  id: string
  title: string
  status: EventStatus
  date: string
  time: string
  location: string
  attendees: Attendee[]
}

export interface ScheduleCalendarProps {
  selected: Date | undefined
  onSelect: (date: Date | undefined) => void
  datesWithEvents?: Set<string>
  className?: string
}

export type EventsFilter =
  | "all"
  | "upcoming"
  | "completed"
  | "cancelled"
  | "pending"

export interface EventsListProps {
  selectedDate?: Date
  filter?: EventsFilter
  onFilterChange?: (filter: EventsFilter) => void
  className?: string
}

export interface EventCardProps {
  event: MockEvent
}

// ── Attendee pool ──

const POOL: Attendee[] = [
  {
    id: "u01",
    name: "Sarah Chen",
    avatar:
      "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "u02",
    name: "Michael Torres",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "u03",
    name: "Emma Wilson",
    avatar:
      "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "u04",
    name: "James Park",
    avatar:
      "https://images.unsplash.com/photo-1463453091185-61582044d556?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "u05",
    name: "Olivia Nguyen",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "u06",
    name: "Alex Johnson",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "u07",
    name: "Nina Patel",
    avatar:
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "u08",
    name: "Ryan Murphy",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "u09",
    name: "Zoe Martinez",
    avatar:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "u10",
    name: "Tom Anderson",
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "u11",
    name: "Priya Sharma",
    avatar:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "u12",
    name: "Lucas Ferreira",
    avatar:
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=96&h=96&dpr=2&q=80",
  },
]

// ── Event template pool ──

const TEMPLATES: Array<{ title: string; location: string }> = [
  { title: "Daily Standup", location: "Slack Huddle" },
  { title: "Design System Review", location: "Figma / Remote" },
  { title: "Sprint Planning", location: "Conference Room A" },
  { title: "API Contract Review", location: "Remote" },
  { title: "Investor Briefing", location: "22nd Floor Boardroom" },
  { title: "Product Roadmap Review", location: "Conference Room B" },
  { title: "UX Research Session", location: "Lab 2" },
  { title: "Security Briefing", location: "Remote" },
  { title: "Analytics Kick-off", location: "Google Meet" },
  { title: "Backend Guild", location: "Meeting Room A" },
  { title: "Frontend Perf Deep-dive", location: "Remote" },
  { title: "Mobile QA Handoff", location: "Remote" },
  { title: "Hiring Interview · Senior FE", location: "Zoom" },
  { title: "Q2 OKR Planning", location: "Conference Room A" },
  { title: "Tech Talk: Next.js 15", location: "Main Hall" },
  { title: "Release Planning v3.0", location: "Zoom" },
  { title: "Accessibility Workshop", location: "Lab 1" },
  { title: "Partner API Workshop", location: "HQ · Floor 3" },
  { title: "Quarterly All-Hands", location: "Main Hall" },
  { title: "Customer Feedback Review", location: "Google Meet" },
  { title: "Board Meeting", location: "HQ · Floor 3" },
  { title: "Brand Identity Refresh", location: "Figma / Remote" },
  { title: "Infrastructure Cost Review", location: "Remote" },
  { title: "Database Migration Planning", location: "Remote" },
  { title: "Figma Handoff · Billing", location: "Figma / Remote" },
  { title: "Marketing Campaign Review", location: "Google Meet" },
  { title: "Platform Architecture Review", location: "HQ · Floor 3" },
  { title: "Payment Gateway Review", location: "Zoom" },
  { title: "Email A/B Results 2", location: "Google Meet" },
  { title: "Weekly Retro", location: "Slack Huddle" },
  { title: "Security Audit Debrief", location: "Remote" },
  { title: "Contractor Onboarding", location: "Zoom" },
  { title: "Hiring Panel · Design", location: "Zoom" },
  { title: "Growth Strategy Workshop", location: "HQ · Floor 2" },
  { title: "i18n Sprint Kick-off", location: "Remote" },
  { title: "Product Launch Q1", location: "1200 Innovation Way" },
  { title: "Partnership Summit", location: "Grand Plaza Hotel" },
  { title: "Tech Debt Triage", location: "Remote" },
  { title: "1:1 with Engineering Lead", location: "Zoom" },
  { title: "Release Sign-off", location: "Zoom" },
]

const TIMES = [
  "8:00 am",
  "8:30 am",
  "9:00 am",
  "9:30 am",
  "10:00 am",
  "10:30 am",
  "11:00 am",
  "11:30 am",
  "12:00 pm",
  "1:00 pm",
  "1:30 pm",
  "2:00 pm",
  "2:30 pm",
  "3:00 pm",
  "3:30 pm",
  "4:00 pm",
  "4:30 pm",
  "5:00 pm",
  "5:30 pm",
]

// ── Calendar data ──

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

// Fixed demo clock: every "today" bucket derives from this reference date.
const DEMO_REFERENCE_DATE_ISO = "2026-06-10"
// Noon keeps UTC-based date keys (toISOString) on the same calendar day across timezones.
export const DEMO_REFERENCE_DATE = new Date(
  `${DEMO_REFERENCE_DATE_ISO}T12:00:00`
)

export const CURRENT_YEAR = DEMO_REFERENCE_DATE.getFullYear()
export const YEARS = Array.from({ length: 21 }, (_, i) => CURRENT_YEAR - 10 + i)

// ── Event card data ──

export const STATUS_VARIANT: Record<EventStatus, BadgeProps["variant"]> = {
  Upcoming: "info-light",
  Cancelled: "destructive-light",
  Pending: "warning-light",
  Completed: "success-light",
}

export const MAX_VISIBLE = 3

export function parseDateParts(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00")
  return {
    day: d.getDate().toString().padStart(2, "0"),
    monthShort: d.toLocaleString("en-US", { month: "short" }),
  }
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// ── Events list data ──

export const FILTER_ITEMS = [
  { label: "All events", value: "all" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Pending", value: "pending" },
]

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function matchesFilter(event: MockEvent, filter: EventsFilter): boolean {
  if (filter === "all") return true
  return event.status.toLowerCase() === filter
}

// ── Mock event generation ──

function hash(n: number): number {
  let x = n
  x = ((x >> 16) ^ x) * 0x45d9f3b
  x = ((x >> 16) ^ x) * 0x45d9f3b
  x = (x >> 16) ^ x
  return Math.abs(x)
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function buildMockEvents(ref: Date = DEMO_REFERENCE_DATE): MockEvent[] {
  const Y = ref.getFullYear()
  const M = ref.getMonth()
  const todayNum = ref.getDate()
  const daysInMonth = new Date(Y, M + 1, 0).getDate()

  // Current week's Monday day-of-month (may be <= 0 → last month, skip)
  const dow = ref.getDay() // 0=Sun … 6=Sat
  const mondayNum = todayNum - (dow === 0 ? 6 : dow - 1)

  const seed = Y * 100 + M // stable per month

  const events: MockEvent[] = []

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const isToday = dayNum === todayNum
    const isMonday = dayNum === mondayNum
    const dayHash = hash(seed + dayNum)

    // Decide whether this day gets events
    const guaranteed = isToday || isMonday
    const randomlyChosen = dayHash % 10 < 4 // ~40 %
    if (!guaranteed && !randomlyChosen) continue

    // How many events (4-9)
    const baseCount = isToday ? 5 : 4
    const count = baseCount + (dayHash % (isToday ? 3 : 6))

    const date = toDateStr(new Date(Y, M, dayNum, 12, 0, 0, 0))

    // Status for each slot
    const defaultStatus: EventStatus =
      dayNum < todayNum ? "Completed" : "Upcoming"

    // Spread events through the day using distinct templates and times
    for (let i = 0; i < count; i++) {
      const slot = hash(seed + dayNum * 37 + i * 13)
      const template = TEMPLATES[(dayHash + i * 7) % TEMPLATES.length]
      const time = TIMES[(slot + i * 3) % TIMES.length]

      // Occasionally vary status for non-today days
      let status: EventStatus = defaultStatus
      if (!isToday) {
        const r = (slot * 31 + i * 17) % 10
        if (dayNum < todayNum) {
          status = r < 2 ? "Cancelled" : "Completed"
        } else {
          status = r < 3 ? "Pending" : "Upcoming"
        }
      }

      // Pick 2-6 attendees deterministically
      const attendeeCount = 2 + (slot % 5)
      const attendees = Array.from(
        { length: attendeeCount },
        (_, k) => POOL[(slot + k * 3) % POOL.length]
      )
      // Deduplicate
      const seen = new Set<string>()
      const uniqueAttendees = attendees.filter((a) => {
        if (seen.has(a.id)) return false
        seen.add(a.id)
        return true
      })

      events.push({
        id: `${Y}-${M}-${dayNum}-${i}`,
        title: template.title,
        status,
        date,
        time,
        location: template.location,
        attendees: uniqueAttendees,
      })
    }
  }

  return events
}

export const MOCK_EVENTS: MockEvent[] = buildMockEvents()

export function getDatesWithEvents(events: MockEvent[]): Set<string> {
  return new Set(events.map((e) => e.date))
}

export function getEventsForDate(
  events: MockEvent[],
  date: Date | undefined,
  filter: "all" | "upcoming" | "completed" | "cancelled" | "pending"
): MockEvent[] {
  if (!date) return events
  const dateStr = toDateStr(date)
  let list = events.filter((e) => e.date === dateStr)
  if (filter === "upcoming") list = list.filter((e) => e.status === "Upcoming")
  else if (filter === "completed")
    list = list.filter((e) => e.status === "Completed")
  else if (filter === "cancelled")
    list = list.filter((e) => e.status === "Cancelled")
  else if (filter === "pending")
    list = list.filter((e) => e.status === "Pending")
  return list
}