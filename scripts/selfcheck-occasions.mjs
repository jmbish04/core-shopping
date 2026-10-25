/**
 * Self-check for the occasion due-date rule (maestro cs-gap-occasion-calendar).
 *
 * The task's own bar is first: "a goal with an occasion lead of 21 days
 * reports due on a date 21 days ahead of the window, and a test that removes
 * the lead_days term makes it go red." That is the third check below, and it
 * has been planted and watched go red.
 *
 * The rest are the cases date arithmetic gets wrong quietly:
 *
 * - **A recurring window ignores its stored year**, so "Prime Day is mid-July"
 *   is one row rather than one a year.
 * - **A recurring window may end before it starts.** 28 December to 4 January
 *   is one window, and its end belongs to the NEXT year. Subtracting the
 *   stored dates gives a negative length and a window in the past.
 * - **29 February does not exist in most years.** `new Date("2027-02-29")`
 *   silently returns 1 March, which moves the window. It is clamped to 28
 *   February instead.
 * - **A one-off that has closed is not an answer to "what is coming up".** A
 *   wedding in 2026 must not make a goal due in 2027.
 * - **The END of a window decides whether it has passed**, not the start: a
 *   goal linked to Restaurant Week is still relevant on its last day.
 * - **No linked occasion returns null, not "not due".** Occasions are one
 *   reason a goal can be due and the cadence detector is another, so a caller
 *   must be able to tell "this rule has nothing to say" from "this rule says
 *   no".
 *
 * Everything is UTC. A due date computed from a local clock would move a
 * goal's due day for anyone west of UTC, which is the already-filed
 * `f6159691a5bf` on the KPI sparkline.
 */
import assert from "node:assert/strict";

const { addDays, daysBetween, nextOccurrence, occasionDue, parseIsoDate, projectInto, soonestDue } =
  await import("../src/backend/occasions/schedule.ts");

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const occasion = (over = {}) => ({
  id: "o-1",
  label: "Prime Day",
  starts_on: "2027-07-08",
  ends_on: "2027-07-09",
  recurs_yearly: false,
  lead_days: 21,
  ...over,
});

console.log("selfcheck-occasions");

check("a calendar date that does not exist is refused, not rolled forward", () => {
  // new Date("2027-02-30") is 2 March, which would make a nonsense window look real.
  assert.throws(() => parseIsoDate("2027-02-30"), RangeError);
  assert.throws(() => parseIsoDate("2027-13-01"), RangeError);
  assert.throws(() => parseIsoDate("2027-02-29"), RangeError, "2027 is not a leap year");
  assert.deepEqual(parseIsoDate("2028-02-29"), { year: 2028, month: 2, day: 29 });
});

check("day arithmetic crosses months and years in UTC", () => {
  assert.equal(addDays("2027-07-08", -21), "2027-06-17");
  assert.equal(addDays("2027-01-05", -10), "2026-12-26");
  assert.equal(addDays("2028-03-01", -1), "2028-02-29", "2028 is a leap year");
  assert.equal(daysBetween("2027-06-17", "2027-07-08"), 21);
  assert.equal(daysBetween("2027-07-08", "2027-06-17"), -21);
});

// ---------------------------------------------------------------------------
// The task's own bar.
// ---------------------------------------------------------------------------

check("a lead of 21 days makes the goal due 21 days ahead of the window", () => {
  const due = occasionDue(occasion(), "2027-06-17");
  assert.ok(due, "the occasion must produce a verdict");
  assert.equal(due.due_on, "2027-06-17");
  assert.equal(daysBetween(due.due_on, due.window.starts_on), 21, "the gap must be the lead");
  assert.equal(due.is_due, true, "on the due date itself the goal is due");
  assert.equal(due.lead_days, 21);
});

check("and NOT due the day before that", () => {
  const due = occasionDue(occasion(), "2027-06-16");
  assert.equal(due.is_due, false);
  assert.equal(due.due_on, "2027-06-17", "the due date does not move with the question");
});

check("it stays due through the window, not only on the due date", () => {
  for (const day of ["2027-06-18", "2027-07-01", "2027-07-08", "2027-07-09"]) {
    assert.equal(occasionDue(occasion(), day).is_due, true, `should be due on ${day}`);
  }
});

check("the reason says why, with the date and the lead", () => {
  const notYet = occasionDue(occasion(), "2027-06-01");
  assert.match(notYet.reason, /Prime Day opens 2027-07-08/);
  assert.match(notYet.reason, /wakes on 2027-06-17, 21 days ahead/);
  const now = occasionDue(occasion(), "2027-06-17");
  assert.match(now.reason, /opens 2027-07-08 in 21 days/);
  assert.match(now.reason, /wakes 21 days ahead/);
});

check("a lead of one day reads in the singular", () => {
  const due = occasionDue(occasion({ lead_days: 1 }), "2027-07-07");
  assert.match(due.reason, /1 day ahead\./);
  assert.doesNotMatch(due.reason, /1 days/);
});

check("a zero lead means due when the window opens, not before", () => {
  const zero = occasion({ lead_days: 0 });
  assert.equal(occasionDue(zero, "2027-07-07").is_due, false);
  assert.equal(occasionDue(zero, "2027-07-08").is_due, true);
  assert.equal(occasionDue(zero, "2027-07-08").due_on, "2027-07-08");
});

// ---------------------------------------------------------------------------
// Recurring windows.
// ---------------------------------------------------------------------------

check("a recurring window ignores its stored year", () => {
  const primeDay = occasion({ starts_on: "2024-07-08", ends_on: "2024-07-09", recurs_yearly: true });
  assert.deepEqual(nextOccurrence(primeDay, "2027-01-01"), {
    starts_on: "2027-07-08",
    ends_on: "2027-07-09",
  });
  assert.equal(occasionDue(primeDay, "2027-06-17").due_on, "2027-06-17");
});

check("once this year's window has closed it rolls to next year", () => {
  const primeDay = occasion({ starts_on: "2024-07-08", ends_on: "2024-07-09", recurs_yearly: true });
  assert.deepEqual(nextOccurrence(primeDay, "2027-07-10"), {
    starts_on: "2028-07-08",
    ends_on: "2028-07-09",
  });
  assert.equal(occasionDue(primeDay, "2027-07-10").is_due, false, "next year's is not due yet");
});

check("the END of the window decides whether it has passed, not the start", () => {
  const week = occasion({ starts_on: "2024-01-20", ends_on: "2024-01-31", recurs_yearly: true, label: "SF Restaurant Week" });
  // Mid-window: still this year's, not next year's.
  assert.deepEqual(nextOccurrence(week, "2027-01-25"), { starts_on: "2027-01-20", ends_on: "2027-01-31" });
  // On the last day: still this year's.
  assert.deepEqual(nextOccurrence(week, "2027-01-31"), { starts_on: "2027-01-20", ends_on: "2027-01-31" });
  // The day after: next year's.
  assert.deepEqual(nextOccurrence(week, "2027-02-01"), { starts_on: "2028-01-20", ends_on: "2028-01-31" });
});

check("a recurring window that crosses the new year is ONE window", () => {
  const newYear = occasion({ starts_on: "2024-12-28", ends_on: "2024-01-04", recurs_yearly: true, label: "New Year sales" });
  const window = nextOccurrence(newYear, "2027-06-01");
  assert.deepEqual(window, { starts_on: "2027-12-28", ends_on: "2028-01-04" });
  assert.ok(window.ends_on > window.starts_on, "the end must follow the start once projected");
  assert.equal(daysBetween(window.starts_on, window.ends_on), 7);
});

check("and is still current in January, having opened the previous December", () => {
  const newYear = occasion({ starts_on: "2024-12-28", ends_on: "2024-01-04", recurs_yearly: true, lead_days: 7 });
  /**
   * This is the case that found a real defect before it shipped. On 2 January
   * the window that OPENED last December has not closed, so the answer must be
   * last December's window — not next December's. The search therefore has to
   * consider the previous year, which it originally did not.
   */
  assert.deepEqual(nextOccurrence(newYear, "2027-01-02"), {
    starts_on: "2026-12-28",
    ends_on: "2027-01-04",
  });
  const due = occasionDue(newYear, "2027-01-02");
  assert.equal(due.is_due, true, "a goal must be due DURING the sales, not told to wait a year");
  assert.equal(due.due_on, "2026-12-21");
  // And on the day after it closes, the answer rolls forward a full year.
  assert.deepEqual(nextOccurrence(newYear, "2027-01-05"), {
    starts_on: "2027-12-28",
    ends_on: "2028-01-04",
  });
});

check("29 February is clamped, never rolled into March", () => {
  assert.equal(projectInto("2024-02-29", 2027), "2027-02-28", "2027 has no 29 February");
  assert.equal(projectInto("2024-02-29", 2028), "2028-02-29", "2028 does");
  assert.equal(projectInto("2024-07-08", 2027), "2027-07-08");
  // The whole window, through the real function.
  const leap = occasion({ starts_on: "2024-02-29", ends_on: "2024-03-02", recurs_yearly: true, lead_days: 7 });
  const due = occasionDue(leap, "2027-02-01");
  assert.equal(due.window.starts_on, "2027-02-28");
  assert.equal(due.due_on, "2027-02-21");
});

// ---------------------------------------------------------------------------
// One-offs, overrides and absence.
// ---------------------------------------------------------------------------

check("a one-off that has closed is not an answer to what is coming up", () => {
  const wedding = occasion({ starts_on: "2026-09-12", ends_on: "2026-09-12", kind: "personal", label: "Wedding" });
  assert.equal(nextOccurrence(wedding, "2027-01-01"), null);
  assert.equal(occasionDue(wedding, "2027-01-01"), null, "a past wedding must not make a goal due");
  // On the day itself it has not closed.
  assert.ok(nextOccurrence(wedding, "2026-09-12"));
});

check("an inactive occasion says nothing at all", () => {
  assert.equal(occasionDue(occasion({ is_active: false }), "2027-06-17"), null);
  assert.ok(occasionDue(occasion({ is_active: true }), "2027-06-17"));
});

check("a per-link lead overrides the occasion's own", () => {
  const shipped = occasion({ lead_days: 21, lead_days_override: 45 });
  const due = occasionDue(shipped, "2027-05-24");
  assert.equal(due.lead_days, 45, "the override must win");
  assert.equal(due.due_on, "2027-05-24");
  assert.equal(due.is_due, true);
  // An override of 0 is a real value and must not fall back to 21.
  const immediate = occasion({ lead_days: 21, lead_days_override: 0 });
  assert.equal(occasionDue(immediate, "2027-06-17").lead_days, 0);
  assert.equal(occasionDue(immediate, "2027-06-17").is_due, false);
  // A null override falls back.
  assert.equal(occasionDue(occasion({ lead_days_override: null }), "2027-06-17").lead_days, 21);
});

check("no linked occasion returns null, which is not 'not due'", () => {
  assert.equal(soonestDue([], "2027-06-17"), null);
  assert.equal(soonestDue([occasion({ is_active: false })], "2027-06-17"), null);
});

check("with several links, an already-due one governs and names itself", () => {
  const birthday = occasion({ id: "o-bday", label: "Birthday", starts_on: "2024-08-02", ends_on: "2024-08-02", recurs_yearly: true, lead_days: 30 });
  const primeDay = occasion({ id: "o-prime", label: "Prime Day", starts_on: "2024-07-08", ends_on: "2024-07-09", recurs_yearly: true, lead_days: 21 });
  // On 20 June: Prime Day is due (17 June), the birthday is not (3 July).
  const governing = soonestDue([birthday, primeDay], "2027-06-20");
  assert.equal(governing.label, "Prime Day");
  assert.equal(governing.is_due, true);
  assert.match(governing.reason, /Prime Day/);
  // Order of the input must not change the answer.
  assert.equal(soonestDue([primeDay, birthday], "2027-06-20").label, "Prime Day");
});

check("when none is due yet, the soonest due date governs", () => {
  const far = occasion({ id: "o-far", label: "Far", starts_on: "2027-12-01", ends_on: "2027-12-02", lead_days: 7 });
  const near = occasion({ id: "o-near", label: "Near", starts_on: "2027-08-01", ends_on: "2027-08-02", lead_days: 7 });
  const governing = soonestDue([far, near], "2027-06-01");
  assert.equal(governing.label, "Near");
  assert.equal(governing.is_due, false);
  assert.equal(governing.due_on, "2027-07-25");
});

console.log(`selfcheck-occasions: ok (${passed} checks)`);
