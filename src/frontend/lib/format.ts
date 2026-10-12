/**
 * @fileoverview Small date/number formatting helpers shared across feature
 * pages. Timestamps from the API are epoch milliseconds (or ISO strings).
 */

/**
 * A timestamp as the API actually serialises it.
 *
 * The Worker stores Drizzle `mode: "timestamp"` columns as integers but
 * serialises them to JSON as ISO STRINGS. Typing a wire field as `number`
 * therefore lies, and the lie only bites when someone does arithmetic on it
 * (`a.createdAt - b.createdAt` silently yields NaN and the sort becomes a
 * no-op). Type wire timestamps as this, and put them through `toMs` before
 * comparing or subtracting.
 */
export type Timestamp = Date | number | string;

/**
 * Coerce a `Timestamp` into epoch milliseconds.
 *
 * @param value An ISO string, epoch ms, or Date — whatever the wire gave you.
 * @returns Epoch ms, or null when the value is absent or unparseable.
 * @example
 * rows.sort((a, b) => (toMs(a.createdAt) ?? 0) - (toMs(b.createdAt) ?? 0));
 */
export function toMs(value: Timestamp | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Human relative time, e.g. "just now", "5m ago", "3d ago", "in 2h". */
export function relativeTime(value: Date | number | string | null | undefined): string {
  const ms = toMs(value);
  if (ms === null) return "";
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000000],
    ["month", 2592000000],
    ["week", 604800000],
    ["day", 86400000],
    ["hour", 3600000],
    ["minute", 60000],
    ["second", 1000],
  ];
  if (abs < 45000) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, unitMs] of units) {
    if (abs >= unitMs || unit === "second") {
      return rtf.format(Math.round(diff / unitMs), unit);
    }
  }
  return "just now";
}

/** Short absolute date, e.g. "Nov 28" or "Nov 28, 2026" if a different year. */
export function shortDate(value: Date | number | string | null | undefined): string {
  const ms = toMs(value);
  if (ms === null) return "";
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Compact number, e.g. 1.2k, 3.4M. */
export function compactNumber(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Human-readable byte size, e.g. "0 B", "1.4 KB", "3.2 MB". */
export function humanSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || value % 1 === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// ── Money, points and durations (maestro cs-fe-0-4) ─────────────────────────
//
// Every quantity a person reads carries thousands separators. Money is integer
// cents plus an ISO currency, never a float, so nothing here ever divides into
// a binary fraction and shows 8232563.021.

/**
 * Format integer cents as currency.
 *
 * @param cents - Amount in minor units. Negative renders as a loss.
 * @param currency - ISO-4217 code, e.g. "USD".
 * @param opts - `whole` drops the decimals when the amount is a round unit,
 *   which is what a price list wants; a total keeps them.
 * @returns A localised string, or an em dash for null/undefined.
 *
 * @example
 * money(0, "USD");          // "$0.00"
 * money(-25000, "USD");     // "-$250.00"
 * money(123456789, "USD");  // "$1,234,567.89"
 */
export function money(
  cents: number | null | undefined,
  currency = "USD",
  opts: { whole?: boolean } = {},
): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  const whole = opts.whole && cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

/** A price range; collapses to one value when both ends match. */
export function moneyRange(
  minCents: number | null | undefined,
  maxCents: number | null | undefined,
  currency = "USD",
): string {
  if (minCents == null && maxCents == null) return "—";
  if (minCents == null) return `up to ${money(maxCents, currency, { whole: true })}`;
  if (maxCents == null) return `from ${money(minCents, currency, { whole: true })}`;
  if (minCents === maxCents) return money(minCents, currency, { whole: true });
  return `${money(minCents, currency, { whole: true })}–${money(maxCents, currency, { whole: true })}`;
}

/**
 * Format a loyalty points amount.
 *
 * @param amount - Whole points.
 * @param program - Program id, shown after the number when given.
 * @returns e.g. "1,200,000 chase-ur".
 */
export function points(amount: number | null | undefined, program?: string): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const n = new Intl.NumberFormat("en-US").format(Math.round(amount));
  return program ? `${n} ${program}` : n;
}

/**
 * Format a duration in milliseconds for a latency or run-length readout.
 *
 * @param ms - Duration in milliseconds.
 * @returns e.g. "840ms", "1.4s", "2m 10s", "3h 04m".
 */
export function duration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

/**
 * Format a 0..1 ratio as a percentage.
 *
 * @param ratio - A share between 0 and 1.
 * @param digits - Decimal places, default 0.
 * @returns e.g. "72%", or an em dash when there is no ratio yet (which is
 *   different from 0% — an unreviewed goal has no accept rate).
 */
export function percent(ratio: number | null | undefined, digits = 0): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}
