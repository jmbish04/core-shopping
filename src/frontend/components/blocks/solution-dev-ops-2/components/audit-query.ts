import { REFERENCE_NOW, userAgentOf } from "./audit-format"
import {
  ACTORS,
  CHANGES,
  CURRENT_REVIEWER,
  REFERENCE_DATE,
  TIME_RANGES,
  type AuditEvent,
  type Outcome,
  type ReviewState,
  type TimeRange,
} from "./data"

const MINUTE_MS = 60_000

const rangeMs = (range: TimeRange) => TIME_RANGES[range].minutes * MINUTE_MS

/** Events in (end - span, end], the half-open window every count shares. */
function inWindow(events: AuditEvent[], end: number, span: number) {
  return events.filter((event) => {
    const at = Date.parse(event.at)
    return at > end - span && at <= end
  })
}

export const inRange = (events: AuditEvent[], range: TimeRange) =>
  inWindow(events, REFERENCE_NOW, rangeMs(range))

/** The equal window just before the range: the volume comparison's base. */
export const inPriorRange = (events: AuditEvent[], range: TimeRange) =>
  inWindow(events, REFERENCE_NOW - rangeMs(range), rangeMs(range))

export function matchesSearch(event: AuditEvent, search: string) {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return [
    event.id,
    event.action,
    ACTORS[event.actorId].name,
    event.resource.name,
    event.resource.id,
    event.ip,
    event.requestId,
    event.summary,
  ].some((value) => value.toLowerCase().includes(needle))
}

// ── Histogram buckets, UTC-aligned to multiples of the bucket size ──

/** `key` is the aligned bucket start; `start` and `end` clamp to the window,
 *  so an edge bucket reads as the part of it the range covers. */
export type Bucket = { key: string } & Record<Outcome, number> & {
    start: number
    end: number
  }

/** A contiguous run of buckets, first and last key inclusive. */
export type BucketSpan = { from: string; to: string }

const bucketMs = (range: TimeRange) =>
  TIME_RANGES[range].bucketMinutes * MINUTE_MS

const bucketStartOf = (at: string, range: TimeRange) =>
  Math.floor(Date.parse(at) / bucketMs(range)) * bucketMs(range)

export const bucketKeyOf = (event: AuditEvent, range: TimeRange) =>
  new Date(bucketStartOf(event.at, range)).toISOString()

/** Edge buckets are partial: they count only events inside the window. */
export function bucketize(events: AuditEvent[], range: TimeRange): Bucket[] {
  const size = bucketMs(range)
  const windowStart = REFERENCE_NOW - rangeMs(range)
  const first = Math.floor(windowStart / size) * size
  const last = Math.floor((REFERENCE_NOW - 1) / size) * size
  const buckets: Bucket[] = []
  const byStart = new Map<number, Bucket>()
  for (let start = first; start <= last; start += size) {
    const bucket: Bucket = {
      key: new Date(start).toISOString(),
      start: Math.max(start, windowStart),
      end: Math.min(start + size, REFERENCE_NOW),
      success: 0,
      denied: 0,
      failed: 0,
    }
    buckets.push(bucket)
    byStart.set(start, bucket)
  }
  for (const event of events) {
    const bucket = byStart.get(bucketStartOf(event.at, range))
    if (bucket) bucket[event.outcome] += 1
  }
  return buckets
}

export function inSpan(event: AuditEvent, span: BucketSpan, range: TimeRange) {
  const start = bucketStartOf(event.at, range)
  return start >= Date.parse(span.from) && start <= Date.parse(span.to)
}

// ── Correlation and review ──

export const byTimeAscending = (a: AuditEvent, b: AuditEvent) =>
  Date.parse(a.at) - Date.parse(b.at)

/** Workload sessions (wl_*) span every run of a service, so only people's
 *  sessions correlate. */
export function relatedEvents(event: AuditEvent, events: AuditEvent[]) {
  const others = events.filter((other) => other.id !== event.id)
  return {
    request: others.filter((other) => other.requestId === event.requestId),
    session: event.sessionId.startsWith("ses_")
      ? others.filter((other) => other.sessionId === event.sessionId)
      : [],
  }
}

const needsReview = (event: AuditEvent) =>
  !event.reviewedBy &&
  (event.outcome !== "success" ||
    event.category === "access" ||
    event.category === "secret")

export function reviewState(event: AuditEvent): ReviewState {
  if (event.reviewedBy) return "reviewed"
  return needsReview(event) ? "needs_review" : "not_required"
}

/** The one review mutation: the current reviewer's mark, set or cleared. */
export const withReview = (
  event: AuditEvent,
  reviewed: boolean
): AuditEvent => ({
  ...event,
  reviewedBy: reviewed ? CURRENT_REVIEWER : undefined,
  reviewedAt: reviewed ? REFERENCE_DATE : undefined,
})

/** Lines in a CodeBlock spec such as "4,6" or "1-7". */
export function countLines(spec?: string) {
  if (!spec) return 0
  return spec.split(",").reduce((total, part) => {
    const [from, to] = part.split("-").map(Number)
    return total + (to === undefined ? 1 : to - from + 1)
  }, 0)
}

// ── Export shapes ──

export function toJsonPayload(event: AuditEvent) {
  const actor = ACTORS[event.actorId]
  const state = reviewState(event)
  const change = event.changeKey ? CHANGES[event.changeKey] : undefined
  return {
    id: event.id,
    time: event.at,
    action: event.action,
    category: event.category,
    outcome: event.outcome,
    ...(event.reason ? { reason: event.reason } : {}),
    actor: {
      type: actor.kind === "human" ? "user" : "service",
      id: actor.id,
      name: actor.name,
      auth: event.authMethod,
      session: event.sessionId,
    },
    resource: { ...event.resource },
    context: {
      environment: event.environment,
      cluster: event.cluster ?? null,
      source: event.source,
      ip: event.ip,
      user_agent: userAgentOf(event),
      request_id: event.requestId,
      trace_id: event.traceId,
    },
    review: {
      state,
      ...(event.reviewedBy ? { by: ACTORS[event.reviewedBy].name } : {}),
      ...(event.reviewedAt ? { at: event.reviewedAt } : {}),
    },
    ...(change
      ? {
          change: {
            file: change.file,
            added: change.added,
            removed: change.removed ?? null,
            redacted: change.redacted ?? false,
          },
        }
      : {}),
  }
}

const CSV_HEADER = [
  "id",
  "time",
  "actor",
  "action",
  "category",
  "resource_type",
  "resource_name",
  "resource_id",
  "environment",
  "cluster",
  "source",
  "ip",
  "outcome",
  "reason",
  "request_id",
  "trace_id",
  "review",
]

/** A leading =, +, - or @ is escaped, so a spreadsheet never runs a cell as
 *  a formula. */
const quote = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

export function toCsv(events: AuditEvent[]) {
  const rows = events.map((event) =>
    [
      event.id,
      event.at,
      ACTORS[event.actorId].name,
      event.action,
      event.category,
      event.resource.type,
      event.resource.name,
      event.resource.id,
      event.environment,
      event.cluster ?? "",
      event.source,
      event.ip,
      event.outcome,
      event.reason ?? "",
      event.requestId,
      event.traceId,
      reviewState(event),
    ]
      .map(quote)
      .join(",")
  )
  return [CSV_HEADER.map(quote).join(","), ...rows].join("\n")
}

/** False when the browser has no Blob URL support or refuses the download. */
export function downloadFile(filename: string, content: string, type: string) {
  try {
    if (typeof Blob === "undefined" || !URL.createObjectURL) return false
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Revoked a tick later: some browsers cancel a download whose URL is gone.
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    return true
  } catch {
    return false
  }
}