type CronFieldName = "minute" | "hour" | "dom" | "month" | "dow"

type CronField = {
  values: number[]
  /** False for a field that starts with "*": Vixie semantics for day matching. */
  restricted: boolean
}

type ParsedCron = Record<CronFieldName, CronField>

type CronResult = { ok: true; cron: ParsedCron } | { ok: false; error: string }

const FIELDS: {
  name: CronFieldName
  label: string
  min: number
  max: number
}[] = [
  { name: "minute", label: "Minute", min: 0, max: 59 },
  { name: "hour", label: "Hour", min: 0, max: 23 },
  { name: "dom", label: "Day", min: 1, max: 31 },
  { name: "month", label: "Month", min: 1, max: 12 },
  { name: "dow", label: "Weekday", min: 0, max: 7 },
]

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000
const FORWARD_DAYS = 400
const BACK_DAYS = 800

function parseField(
  raw: string,
  spec: (typeof FIELDS)[number]
): { field: CronField } | { error: string } {
  const values = new Set<number>()
  const parts = raw.split(",")

  for (const part of parts) {
    const match = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(part)
    if (!match) {
      return {
        error: `${spec.label} field has an unsupported value "${part}".`,
      }
    }
    const [, base, fromText, toText, stepText] = match
    const every = stepText === undefined ? 1 : Number(stepText)
    if (every < 1) return { error: "Step must be at least 1." }

    let from = spec.min
    let to = spec.max === 7 ? 6 : spec.max
    if (base !== "*") {
      from = Number(fromText)
      to = toText === undefined ? (stepText ? spec.max : from) : Number(toText)
      for (const value of [from, to]) {
        if (value < spec.min || value > spec.max) {
          return {
            error: `${spec.label} ${value} is outside ${spec.min} to ${spec.max}.`,
          }
        }
      }
      if (from > to) {
        return { error: `${spec.label} range must run from low to high.` }
      }
    }
    for (let value = from; value <= to; value += every) {
      values.add(spec.name === "dow" && value === 7 ? 0 : value)
    }
  }

  return {
    field: {
      values: [...values].sort((a, b) => a - b),
      restricted: !raw.startsWith("*"),
    },
  }
}

export function parseCron(expression: string): CronResult {
  const source = expression.trim()
  if (!source) return { ok: false, error: "Enter a cron expression." }
  const tokens = source.split(/\s+/)
  if (tokens.length !== 5) {
    return {
      ok: false,
      error: `Expected 5 fields, got ${tokens.length}.`,
    }
  }
  const fields: Partial<Record<CronFieldName, CronField>> = {}
  for (const [index, spec] of FIELDS.entries()) {
    const result = parseField(tokens[index], spec)
    if ("error" in result) return { ok: false, error: result.error }
    fields[spec.name] = result.field
  }
  const { minute, hour, dom, month, dow } = fields
  if (!minute || !hour || !dom || !month || !dow) {
    return { ok: false, error: "Enter a cron expression." }
  }
  return { ok: true, cron: { minute, hour, dom, month, dow } }
}

/** Vixie: with both day fields restricted, either one matching is enough. */
function dayMatches(cron: ParsedCron, wallDayStart: number) {
  const date = new Date(wallDayStart)
  if (!cron.month.values.includes(date.getUTCMonth() + 1)) return false
  const domHit = cron.dom.values.includes(date.getUTCDate())
  const dowHit = cron.dow.values.includes(date.getUTCDay())
  if (cron.dom.restricted && cron.dow.restricted) return domHit || dowHit
  return domHit && dowHit
}

const dayFloor = (wallMs: number) => Math.floor(wallMs / DAY_MS) * DAY_MS

/** The next `count` fires strictly after `afterMs`. */
export function nextFires(
  cron: ParsedCron,
  offsetMin: number,
  afterMs: number,
  count: number
): number[] {
  const offset = offsetMin * MINUTE_MS
  const wallAfter = afterMs + offset
  const fires: number[] = []
  let day = dayFloor(wallAfter)
  for (let index = 0; index < FORWARD_DAYS && fires.length < count; index++) {
    if (dayMatches(cron, day)) {
      for (const hour of cron.hour.values) {
        for (const minute of cron.minute.values) {
          const wall = day + hour * 3_600_000 + minute * MINUTE_MS
          if (wall > wallAfter) fires.push(wall - offset)
          if (fires.length === count) return fires
        }
      }
    }
    day += DAY_MS
  }
  return fires
}

/** The last `count` fires strictly before `beforeMs`, oldest first. */
export function previousFires(
  cron: ParsedCron,
  offsetMin: number,
  beforeMs: number,
  count: number
): number[] {
  const offset = offsetMin * MINUTE_MS
  const wallBefore = beforeMs + offset
  const fires: number[] = []
  const hours = [...cron.hour.values].reverse()
  const minutes = [...cron.minute.values].reverse()
  let day = dayFloor(wallBefore)
  for (let index = 0; index < BACK_DAYS && fires.length < count; index++) {
    if (dayMatches(cron, day)) {
      for (const hour of hours) {
        for (const minute of minutes) {
          const wall = day + hour * 3_600_000 + minute * MINUTE_MS
          if (wall < wallBefore) fires.push(wall - offset)
          if (fires.length === count) return fires.reverse()
        }
      }
    }
    day -= DAY_MS
  }
  return fires.reverse()
}

/** Every fire in [fromMs, toMs), oldest first. */
export function firesBetween(
  cron: ParsedCron,
  offsetMin: number,
  fromMs: number,
  toMs: number
): number[] {
  const offset = offsetMin * MINUTE_MS
  const wallFrom = fromMs + offset
  const wallTo = toMs + offset
  const fires: number[] = []
  for (let day = dayFloor(wallFrom); day < wallTo; day += DAY_MS) {
    if (!dayMatches(cron, day)) continue
    for (const hour of cron.hour.values) {
      for (const minute of cron.minute.values) {
        const wall = day + hour * 3_600_000 + minute * MINUTE_MS
        if (wall >= wallFrom && wall < wallTo) fires.push(wall - offset)
      }
    }
  }
  return fires
}