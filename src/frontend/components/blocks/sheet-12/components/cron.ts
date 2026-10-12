export type CronFieldName = "minute" | "hour" | "dom" | "month" | "dow"

export type CronField = {
  raw: string
  values: number[]
  /** False for a field that starts with "*": Vixie semantics for day matching. */
  restricted: boolean
  /** The step n when the field is one stepped token, else null. */
  step: number | null
}

export type ParsedCron = Record<CronFieldName, CronField> & { source: string }

export type CronResult =
  { ok: true; cron: ParsedCron } | { ok: false; error: string }

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
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAY_PLURALS = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
]

function parseField(
  raw: string,
  spec: (typeof FIELDS)[number]
): { field: CronField } | { error: string } {
  const values = new Set<number>()
  let step: number | null = null
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
    if (parts.length === 1 && stepText !== undefined) step = every
  }

  return {
    field: {
      raw,
      values: [...values].sort((a, b) => a - b),
      restricted: !raw.startsWith("*"),
      step,
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
  return { ok: true, cron: { minute, hour, dom, month, dow, source } }
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

const pad = (value: number) => String(value).padStart(2, "0")

function joinTimes(times: string[]) {
  if (times.length <= 2) return times.join(" and ")
  return times.join(", ")
}

function clockTimes(cron: ParsedCron) {
  const times: string[] = []
  for (const hour of cron.hour.values) {
    for (const minute of cron.minute.values) {
      times.push(`${pad(hour)}:${pad(minute)}`)
    }
  }
  return times
}

const isWeekdays = (field: CronField) =>
  field.values.length === 5 && field.values.every((day, i) => day === i + 1)

/** A human sentence for the common shapes, "Custom schedule" for the rest. */
export function describeCron(cron: ParsedCron): string {
  const { minute, hour, dom, month, dow } = cron
  const anyDay = !dom.restricted && !month.restricted && !dow.restricted
  const singleMinute = minute.values.length === 1

  if (!hour.restricted && hour.step === null && anyDay) {
    if (!minute.restricted && minute.values.length === 60) return "Every minute"
    if (minute.step !== null && !minute.restricted) {
      return minute.step === 1 ? "Every minute" : `Every ${minute.step} minutes`
    }
    if (singleMinute) {
      return `Hourly at :${pad(minute.values[0])}`
    }
    if (minute.values.length <= 4) {
      return `Hourly at ${minute.values.map((value) => `:${pad(value)}`).join(", ")}`
    }
    return "Custom schedule"
  }

  if (!hour.restricted && hour.step !== null && singleMinute && anyDay) {
    const at = minute.values[0] === 0 ? "" : ` at :${pad(minute.values[0])}`
    return `Every ${hour.step} hours${at}`
  }

  if (!hour.restricted || minute.values.length > 2) return "Custom schedule"
  const times = clockTimes(cron)
  if (times.length > 4) return "Custom schedule"
  const at = joinTimes(times)
  if (month.restricted) return "Custom schedule"

  if (!dom.restricted && !dow.restricted) return `Daily at ${at}`
  if (!dom.restricted && isWeekdays(dow)) return `Weekdays at ${at}`
  if (!dom.restricted && dow.restricted) {
    if (dow.values.length === 1) return `${DAY_PLURALS[dow.values[0]]} at ${at}`
    return `${dow.values.map((day) => DAY_NAMES[day]).join(", ")} at ${at}`
  }
  if (dom.restricted && !dow.restricted) {
    const days = dom.values.join(", ")
    return dom.values.length === 1
      ? `Monthly on day ${days} at ${at}`
      : `Monthly on days ${days} at ${at}`
  }
  return "Custom schedule"
}

/** Parses, then proves the schedule fires at least once within the horizon. */
export function validateSchedule(
  expression: string,
  offsetMin: number,
  fromMs: number
): CronResult {
  const result = parseCron(expression)
  if (!result.ok) return result
  if (nextFires(result.cron, offsetMin, fromMs, 1).length === 0) {
    return { ok: false, error: "This schedule never runs." }
  }
  return result
}

/** The five raw field tokens, labelled, for the schedule breakdown. */
export function cronFields(cron: ParsedCron) {
  return FIELDS.map((spec) => ({
    label: spec.label,
    value: cron[spec.name].raw,
  }))
}