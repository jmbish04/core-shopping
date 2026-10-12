import {
  REFERENCE_DATE,
  TIME_RANGES,
  type AuditEvent,
  type TimeRange,
} from "./data"

export const REFERENCE_NOW = Date.parse(REFERENCE_DATE)

const UTC = { timeZone: "UTC", hourCycle: "h23" } as const

const TIME = new Intl.DateTimeFormat("en-US", {
  ...UTC,
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})
const FULL = new Intl.DateTimeFormat("en-US", {
  ...UTC,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})
const MINUTE = new Intl.DateTimeFormat("en-US", {
  ...UTC,
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})
const DAY = new Intl.DateTimeFormat("en-US", {
  ...UTC,
  month: "short",
  day: "numeric",
})
const WEEKDAY = new Intl.DateTimeFormat("en-US", {
  ...UTC,
  weekday: "short",
  month: "short",
  day: "numeric",
})
const CLOCK = new Intl.DateTimeFormat("en-US", {
  ...UTC,
  hour: "2-digit",
  minute: "2-digit",
})
const DAY_MS = 86_400_000

/** "Sep 29, 14:12:08" */
export const formatTime = (iso: string) => TIME.format(Date.parse(iso))

/** "Sep 29, 2026, 14:12:08 UTC" */
export const formatFull = (iso: string) => `${FULL.format(Date.parse(iso))} UTC`

/** "Sep 29, 08:02" */
export const formatMinute = (iso: string) => MINUTE.format(Date.parse(iso))

/** "42s", "5m 54s", "1h 05m", "3d 4h": the two largest units of a span. */
export function formatSpan(ms: number) {
  const seconds = Math.round(Math.abs(ms) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)
    return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

/** "5m 54s before", "2m 03s after": a step's distance from the open event. */
export const formatOffset = (ms: number) =>
  Math.round(Math.abs(ms) / 1000) === 0
    ? "Same moment"
    : `${formatSpan(ms)} ${ms < 0 ? "before" : "after"}`

/** "8m ago", "2h ago", "3d ago" against the demo clock. */
export function formatAgo(iso: string) {
  const minutes = Math.floor((REFERENCE_NOW - Date.parse(iso)) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** "Sep 29, 12:00 to 18:00 UTC", "Tue, Sep 29 UTC" or "Sep 26 to Sep 28 UTC". */
export function formatWindow(start: number, end: number) {
  if (start % DAY_MS === 0 && end % DAY_MS === 0) {
    const lastDay = end - DAY_MS
    return lastDay === start
      ? `${WEEKDAY.format(start)} UTC`
      : `${DAY.format(start)} to ${DAY.format(lastDay)} UTC`
  }
  // A window that ends at midnight still belongs to the day it started on.
  if (Math.floor(start / DAY_MS) === Math.floor((end - 1) / DAY_MS))
    return `${DAY.format(start)}, ${CLOCK.format(start)} to ${CLOCK.format(end)} UTC`
  return `${MINUTE.format(start)} to ${MINUTE.format(end)} UTC`
}

/** "+23% vs prior 7d", or "3.5x vs prior 24h" once the window doubles. */
export function formatChange(current: number, prior: number, range: TimeRange) {
  const ratio = current / prior
  const percent = Math.round((ratio - 1) * 100)
  const change =
    ratio >= 2
      ? `${Number(ratio.toFixed(1))}x`
      : `${percent > 0 ? "+" : ""}${percent}%`
  return `${change} vs prior ${range}`
}

/** "6.3%": one decimal by default, so a small rate never rounds to zero. */
export const formatShare = (part: number, whole: number, digits = 1) =>
  `${whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(digits))}%`

/** Axis ticks: clock times inside a day, dates beyond one. */
export function formatTick(key: string, range: TimeRange) {
  const ms = Date.parse(key)
  return TIME_RANGES[range].minutes <= 1440 ? CLOCK.format(ms) : DAY.format(ms)
}

/** "4bf92f35…0e4736": enough of a trace id to match it in a log. */
export const maskMiddle = (value: string) =>
  `${value.slice(0, 8)}…${value.slice(-6)}`

/** The one address the trail has never seen before today. */
export const isNewNetwork = (ip: string) => ip === "203.0.113.57"

export function ipLabel(ip: string) {
  if (isNewNetwork(ip)) return "New network, first seen today"
  if (ip.startsWith("203.0.113.")) return "Corporate VPN"
  if (ip === "198.51.100.42") return "GitHub runner pool"
  if (ip === "198.51.100.14") return "Vercel rolling releases"
  if (ip === "198.51.100.8") return "n8n workers, prod-us-east-1"
  if (ip === "198.51.100.61") return "Cloud Build private pool"
  return "Unknown network"
}

const SERVICE_AGENTS: Record<string, string> = {
  "github-actions": "actions-runner/2.319.1",
  "cloud-build": "terraform/1.9.5 (cloud-build)",
  vercel: "vercel-rolling-release/1.4.0",
  n8n: "n8n/1.64.2 (schedule-trigger)",
}

export function userAgentOf(event: AuditEvent) {
  if (event.source === "console")
    return "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 Chrome/129.0.0.0 Safari/537.36"
  if (event.source === "cli") return "harbor-cli/3.12.0 (darwin; arm64)"
  if (event.source === "terraform") return SERVICE_AGENTS["cloud-build"]
  if (event.source === "github-actions") return SERVICE_AGENTS["github-actions"]
  return SERVICE_AGENTS[event.actorId] ?? "harbor-api-client/1.4.0"
}