/**
 * @fileoverview When a goal linked to an occasion becomes due
 * (maestro cs-gap-occasion-calendar).
 *
 * Pure date arithmetic with NO value imports, so
 * `scripts/selfcheck-occasions.mjs` drives every branch without a database.
 * `cs-be-7-1`'s cron and the Overview both read these functions, so there is
 * one definition of "due" rather than one per caller.
 *
 * All dates are `YYYY-MM-DD` and all arithmetic is in UTC. A due date computed
 * from a local clock would move a goal's due day for anyone west of UTC, which
 * is the defect already filed against the KPI sparkline (`f6159691a5bf`).
 *
 * Three things the arithmetic has to get right, each of which has a test:
 *
 * - **A recurring window ignores its stored year.** "Prime Day is mid-July" is
 *   one row, projected into whichever year is next.
 * - **A recurring window may end before it starts.** 28 December to 4 January
 *   is one window across a year boundary, so `ends_on < starts_on` is valid
 *   and the end belongs to the following year.
 * - **29 February does not exist in most years.** A recurring window on the
 *   leap day is clamped to 28 February rather than silently becoming 1 March,
 *   which is what `new Date("2027-02-29")` gives you.
 */

/** A projected window: real dates in a real year. */
export interface OccasionWindow {
  starts_on: string;
  ends_on: string;
}

/** What a linked occasion says about when a goal is due. */
export interface OccasionDue {
  occasion_id: string;
  label: string;
  /** The window this due date is for, projected into a real year. */
  window: OccasionWindow;
  /** The lead actually used: the link's override, else the occasion's own. */
  lead_days: number;
  /** The day the goal becomes due: the window's open date minus the lead. */
  due_on: string;
  /** Whether it is due as of the date asked about. */
  is_due: boolean;
  /** Why, in words a person reads on the Overview. */
  reason: string;
}

/** The fields the computation needs. More may be present and are ignored. */
export interface OccasionLike {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  recurs_yearly: boolean;
  lead_days: number;
  is_active?: boolean;
  /** From `goal_occasions`; null or absent uses `lead_days`. */
  lead_days_override?: number | null;
}

const DAY_MS = 86_400_000;

/** Days in a month, 1-indexed, for a given year. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Parse `YYYY-MM-DD` into its parts, refusing anything else.
 *
 * Deliberately not `new Date(...)`: that accepts "2027-02-30" and silently
 * returns 2 March, which would make a nonsense window look like a real one.
 *
 * @param iso - A calendar date.
 * @returns The year, month (1-12) and day.
 * @throws {RangeError} When the string is not a real calendar date.
 */
export function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new RangeError(`Not a YYYY-MM-DD date: ${iso}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) throw new RangeError(`Month out of range: ${iso}`);
  if (day < 1 || day > daysInMonth(year, month)) throw new RangeError(`Day out of range: ${iso}`);
  return { year, month, day };
}

function toIso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Add days to a calendar date, in UTC.
 *
 * @param iso - A `YYYY-MM-DD` date.
 * @param days - Days to add; negative subtracts.
 * @returns The resulting `YYYY-MM-DD` date.
 * @example
 * ```typescript
 * addDays("2027-07-08", -21); // "2027-06-17"
 * ```
 */
export function addDays(iso: string, days: number): string {
  const { year, month, day } = parseIsoDate(iso);
  const stamp = Date.UTC(year, month - 1, day) + days * DAY_MS;
  const result = new Date(stamp);
  return toIso(result.getUTCFullYear(), result.getUTCMonth() + 1, result.getUTCDate());
}

/** Whole days from `from` to `to`, negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS,
  );
}

/**
 * Project a stored month-day into a real date in `year`.
 *
 * 29 February is clamped to 28 February in a non-leap year. Letting it roll to
 * 1 March would move the window, and `new Date("2027-02-29")` does exactly
 * that without complaining.
 *
 * @param monthDay - The stored date, whose year is ignored.
 * @param year - The year to project into.
 * @returns A real `YYYY-MM-DD` date in that year.
 * @example
 * ```typescript
 * projectInto("2024-02-29", 2027); // "2027-02-28"
 * ```
 */
export function projectInto(monthDay: string, year: number): string {
  const { month, day } = parseIsoDate(monthDay);
  return toIso(year, month, Math.min(day, daysInMonth(year, month)));
}

/**
 * The next occurrence of an occasion's window that has not finished.
 *
 * For a one-off occasion that is the stored window, or null once it has
 * closed — a wedding in 2026 is not an answer to "what is coming up".
 *
 * For a recurring one it is this year's window if it has not finished, else
 * next year's. The window's END decides, not its start, because a goal linked
 * to Restaurant Week is still relevant on its last day.
 *
 * @param occasion - The occasion.
 * @param asOf - The date to look forward from, `YYYY-MM-DD`.
 * @returns The projected window, or null for a one-off that has closed.
 * @example
 * ```typescript
 * // A recurring window that crosses the new year.
 * nextOccurrence({ starts_on: "2024-12-28", ends_on: "2024-01-04", recurs_yearly: true, ... }, "2027-06-01");
 * // { starts_on: "2027-12-28", ends_on: "2028-01-04" }
 * ```
 */
export function nextOccurrence(
  occasion: Pick<OccasionLike, "starts_on" | "ends_on" | "recurs_yearly">,
  asOf: string,
): OccasionWindow | null {
  if (!occasion.recurs_yearly) {
    return occasion.ends_on < asOf ? null : { starts_on: occasion.starts_on, ends_on: occasion.ends_on };
  }

  const { year } = parseIsoDate(asOf);
  /**
   * The previous year is a real candidate, and leaving it out was a defect
   * this file's own fixture caught before it shipped. A window from 28
   * December to 4 January that is asked about on 2 January OPENED last year
   * and has not closed; starting the search at the current year skipped it and
   * answered with next December's window instead, so a goal linked to the New
   * Year sales would have reported "not due" in the middle of them.
   */
  for (const candidateYear of [year - 1, year, year + 1]) {
    const starts = projectInto(occasion.starts_on, candidateYear);
    /**
     * A window whose stored MONTH-DAY end is before its month-day start
     * crosses the new year, so its end belongs to the following year. The
     * comparison is on the "MM-DD" slice, not the whole date, because the
     * stored years are meaningless for a recurring occasion.
     */
    const crossesYear = occasion.ends_on.slice(5) < occasion.starts_on.slice(5);
    const ends = projectInto(occasion.ends_on, crossesYear ? candidateYear + 1 : candidateYear);
    if (ends >= asOf) return { starts_on: starts, ends_on: ends };
  }
  return null;
}

/**
 * When a goal linked to this occasion becomes due.
 *
 * @param occasion - The occasion, with the link's `lead_days_override` if any.
 * @param asOf - The date being asked about, `YYYY-MM-DD`.
 * @returns The due date and whether it has arrived, or null when the occasion
 *   is inactive or is a one-off that has closed.
 * @example
 * ```typescript
 * // Prime Day opens 8 July, lead 21 days.
 * occasionDue({ id, label: "Prime Day", starts_on: "2027-07-08", ends_on: "2027-07-09",
 *               recurs_yearly: false, lead_days: 21 }, "2027-06-17").is_due; // true
 * ```
 */
export function occasionDue(occasion: OccasionLike, asOf: string): OccasionDue | null {
  if (occasion.is_active === false) return null;
  const window = nextOccurrence(occasion, asOf);
  if (!window) return null;

  const lead = occasion.lead_days_override ?? occasion.lead_days;
  const dueOn = addDays(window.starts_on, -lead);
  const isDue = asOf >= dueOn;
  const until = daysBetween(asOf, window.starts_on);

  const reason = isDue
    ? `${occasion.label} opens ${window.starts_on}${until > 0 ? ` in ${until.toLocaleString("en-US")} day${until === 1 ? "" : "s"}` : ""}; this goal wakes ${lead.toLocaleString("en-US")} day${lead === 1 ? "" : "s"} ahead.`
    : `${occasion.label} opens ${window.starts_on}; this goal wakes on ${dueOn}, ${lead.toLocaleString("en-US")} day${lead === 1 ? "" : "s"} ahead.`;

  return {
    occasion_id: occasion.id,
    label: occasion.label,
    window,
    lead_days: lead,
    due_on: dueOn,
    is_due: isDue,
    reason,
  };
}

/**
 * The soonest due date across every occasion a goal is linked to.
 *
 * A goal with several links is due as soon as the FIRST of them says so, and
 * the reason names that one — telling a reader "due because of a birthday" is
 * useful where "due because of one of four things" is not.
 *
 * Returns null when a goal has no linked occasion. That is not "not due":
 * occasions are one reason a goal can be due and the cadence detector is
 * another, so a caller must treat null as "this rule has nothing to say"
 * rather than as a verdict.
 *
 * @param occasions - The linked occasions, with their overrides.
 * @param asOf - The date being asked about.
 * @returns The governing occasion's verdict, or null when there are none.
 */
export function soonestDue(occasions: readonly OccasionLike[], asOf: string): OccasionDue | null {
  const verdicts = occasions
    .map((occasion) => occasionDue(occasion, asOf))
    .filter((v): v is OccasionDue => v !== null);
  if (verdicts.length === 0) return null;

  // Already-due beats not-yet-due; within each, the earlier due date wins, and
  // the earlier window breaks a tie so the answer is stable.
  verdicts.sort((a, b) => {
    if (a.is_due !== b.is_due) return a.is_due ? -1 : 1;
    if (a.due_on !== b.due_on) return a.due_on < b.due_on ? -1 : 1;
    return a.window.starts_on < b.window.starts_on ? -1 : 1;
  });
  return verdicts[0]!;
}
