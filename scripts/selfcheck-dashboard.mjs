/**
 * Self-check for the Overview dashboard contract (maestro cs-c-09 / cs-be-2-9).
 *
 * The SQL is verified separately against the real database. What is pinned here
 * is the arithmetic that decides what the screen is allowed to claim:
 *
 * - a rate over a zero denominator is null, and a rate of exactly 0 over a
 *   real denominator is 0 — these are different facts and the dashboard must
 *   not conflate them
 * - a delta needs both ends; a missing baseline yields no delta, never "no
 *   change"
 * - the day series covers every day in the window, zero-filled, so a quiet day
 *   is a zero rather than a hole the chart closes up
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/shared/")) {
      let target = resolvePath(root, "src/shared", specifier.slice("@/shared/".length));
      if (!/\.[cm]?[jt]sx?$/.test(target)) {
        target = existsSync(`${target}.ts`) ? `${target}.ts` : resolvePath(target, "index.ts");
      }
      return next(pathToFileURL(target).href, context);
    }
    if (
      context.parentURL?.startsWith(pathToFileURL(resolvePath(root, "src")).href) &&
      /^\.\.?\//.test(specifier) &&
      !/\.[cm]?[jt]sx?$/.test(specifier)
    ) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});

const {
  DASHBOARD_STRIP_RUNS,
  DashboardOverviewQuerySchema,
  DashboardOverviewSchema,
  dashboardWindow,
  denseDays,
  makeKpi,
  ratioOrNull,
} = await import("../src/shared/contracts/dashboard.ts");

// --- a rate with nothing to divide by is unknown -----------------------------
assert.equal(ratioOrNull(0, 0), null, "0 of 0 is not 0% — nothing happened, so there is no rate");
assert.equal(ratioOrNull(0, 4), 0, "0 of 4 IS 0%: four finished and none succeeded");
assert.equal(ratioOrNull(3, 4), 0.75);
assert.equal(ratioOrNull(5, 0), null, "a numerator without a denominator is still no rate");

// --- a delta needs both ends ------------------------------------------------
const runs = makeKpi({ id: "runs", label: "Runs", unit: "count", value: 12, previous: 8 });
assert.equal(runs.delta, 4);
assert.equal(runs.unavailable_reason, null);
assert.equal(runs.higher_is_better, true, "most tiles want to go up");

const firstWindow = makeKpi({ id: "runs", label: "Runs", unit: "count", value: 12, previous: null });
assert.equal(
  firstWindow.delta,
  null,
  "no baseline means NO delta — not a delta of 12, and not 'no change'",
);
assert.equal(firstWindow.value, 12, "the figure itself is still known");
assert.equal(firstWindow.unavailable_reason, null, "the VALUE is available; only the delta is not");

const noRate = makeKpi({
  id: "run_success_rate",
  label: "Success rate",
  unit: "ratio",
  value: ratioOrNull(0, 0),
  previous: 0.5,
  unavailableReason: "no run has finished in this window",
});
assert.equal(noRate.value, null);
assert.equal(noRate.delta, null, "an unknown value cannot have moved");
assert.equal(
  noRate.unavailable_reason,
  "no run has finished in this window",
  "a null tile says why, so the screen shows a reason instead of a dash with no story",
);

const zeroRate = makeKpi({
  id: "run_success_rate",
  label: "Success rate",
  unit: "ratio",
  value: ratioOrNull(0, 4),
  previous: 0.5,
});
assert.equal(zeroRate.value, 0, "a measured zero is a value");
assert.equal(zeroRate.delta, -0.5, "and it moves against its baseline");
assert.equal(zeroRate.unavailable_reason, null);

const backlog = makeKpi({
  id: "review_backlog",
  label: "Awaiting review",
  unit: "count",
  value: 9,
  previous: 2,
  higherIsBetter: false,
});
assert.equal(backlog.higher_is_better, false, "a growing backlog is not an improvement");
assert.equal(backlog.delta, 7);

// --- the day series is dense ------------------------------------------------
const days = denseDays("2026-10-08", 3, {
  "2026-10-09": { succeeded: 2, failed: 1, browser: 2 },
});
assert.deepEqual(
  days.map((d) => d.date),
  ["2026-10-08", "2026-10-09", "2026-10-10"],
  "every day in the window is present, oldest first",
);
assert.deepEqual(days[0], {
  date: "2026-10-08",
  succeeded: 0,
  failed: 0,
  abandoned: 0,
  running: 0,
  total: 0,
  browser: 0,
});
assert.equal(days[1].total, 3, "total is the sum of the outcomes, not a separate count");
assert.equal(days[1].browser, 2, "browser is a subset of total, never added to it");
assert.equal(days[2].total, 0, "a quiet day is a zero, never a missing point");
assert.equal(
  denseDays("2026-10-08", 1, {}).length,
  1,
  "a one-day window still produces its one day",
);
// A bucket outside the window is ignored rather than appended, so a row the
// query should not have returned cannot stretch the axis.
assert.equal(denseDays("2026-10-08", 2, { "2026-12-25": { succeeded: 9 } }).length, 2);

// --- the window is day-aligned so the series and the counts agree -----------
// The bug this prevents: a window starting exactly windowDays*24h ago spans
// windowDays+1 CALENDAR days, so the dense series is one bucket short and
// today's runs drop off the chart while still counting in the "runs" tile.
{
  const now = new Date("2026-10-10T18:30:00.000Z");
  const w = dashboardWindow(now, 7);
  assert.equal(w.windowEnd.toISOString(), "2026-10-10T18:30:00.000Z", "the window ends now");
  assert.equal(
    w.windowStart.toISOString(),
    "2026-10-04T00:00:00.000Z",
    "and starts at midnight UTC six days back, so seven calendar days are covered",
  );
  assert.equal(w.previousStart.toISOString(), "2026-09-27T00:00:00.000Z");

  const series = denseDays(w.windowStart.toISOString().slice(0, 10), 7, {});
  assert.equal(series.length, 7);
  assert.equal(
    series.at(-1).date,
    "2026-10-10",
    "TODAY is the last bucket — a run an hour ago has somewhere to land",
  );
  assert.equal(series[0].date, "2026-10-04");

  // The previous window is the same number of whole days, so a delta compares
  // like with like rather than six-and-a-bit days against seven.
  assert.equal(
    (w.windowStart.getTime() - w.previousStart.getTime()) / 86_400_000,
    7,
    "the baseline window is exactly as long as the current one",
  );

  // A one-day window is today alone, not today plus yesterday.
  const one = dashboardWindow(now, 1);
  assert.equal(one.windowStart.toISOString(), "2026-10-10T00:00:00.000Z");
  assert.equal(denseDays(one.windowStart.toISOString().slice(0, 10), 1, {})[0].date, "2026-10-10");

  // Across a month boundary, and at the very start of a UTC day.
  const edge = dashboardWindow(new Date("2026-11-01T00:00:00.000Z"), 3);
  assert.equal(edge.windowStart.toISOString(), "2026-10-30T00:00:00.000Z");
  assert.deepEqual(
    denseDays(edge.windowStart.toISOString().slice(0, 10), 3, {}).map((d) => d.date),
    ["2026-10-30", "2026-10-31", "2026-11-01"],
  );
}

// --- the query's own defaults -----------------------------------------------
const defaults = DashboardOverviewQuerySchema.parse({});
assert.equal(defaults.window_days, 7);
assert.equal(defaults.strip_goals, 8);
assert.equal(defaults.recent_proposals, 8);
assert.equal(
  DashboardOverviewQuerySchema.parse({ window_days: "30" }).window_days,
  30,
  "a query string arrives as text and must coerce",
);
assert.throws(
  () => DashboardOverviewQuerySchema.parse({ window_days: 400 }),
  "a window past the cap is refused rather than silently clamped",
);
assert.throws(() => DashboardOverviewQuerySchema.parse({ window_days: 0 }));

// --- the envelope accepts an entirely empty project -------------------------
// The state this project is actually in today: no runs, no proposals, one goal.
// An empty dashboard must parse, because the alternative is a 500 on a new
// install and a screen that cannot render its own empty state.
const empty = DashboardOverviewSchema.parse({
  generated_at: "2026-10-10T22:00:00.000Z",
  window_days: 7,
  window_start: "2026-10-03T22:00:00.000Z",
  window_end: "2026-10-10T22:00:00.000Z",
  kpis: [
    makeKpi({ id: "active_goals", label: "Active goals", unit: "count", value: 1, previous: 0 }),
    makeKpi({
      id: "run_success_rate",
      label: "Success rate",
      unit: "ratio",
      value: ratioOrNull(0, 0),
      previous: ratioOrNull(0, 0),
      unavailableReason: "no run has finished in this window",
    }),
  ],
  runs_per_day: denseDays("2026-10-03", 7, {}),
  goal_strips: [
    {
      goal_id: "124bd0e6-acc6-4860-aa01-ae8f98d40a37",
      slug: "concerts-and-comedy-in-sf",
      title: "Concerts and comedy in SF",
      category: "experience",
      stale: false,
      runs: [],
      runs_total: 0,
    },
  ],
  review_backlog: {
    queued: 0,
    snoozed: 0,
    expiring_soon: 0,
    oldest_queued_at: null,
    silent_updates: 0,
  },
  recent_proposals: [],
  recent_runs: [],
});
assert.equal(empty.goal_strips[0].runs.length, 0, "a goal that has never run keeps an empty strip");
assert.equal(
  empty.goal_strips[0].stale,
  false,
  "and it is not stale — a never-run goal is not overdue",
);
assert.equal(empty.review_backlog.oldest_queued_at, null, "an empty backlog has no oldest item");
assert.equal(empty.runs_per_day.length, 7, "the chart still gets seven days to draw");

// A strip longer than the contract's cap is a server bug, not something the
// client should quietly truncate.
assert.throws(
  () =>
    DashboardOverviewSchema.parse({
      ...empty,
      goal_strips: [
        {
          ...empty.goal_strips[0],
          runs: Array.from({ length: DASHBOARD_STRIP_RUNS + 1 }, (_, i) => ({
            id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
            status: "succeeded",
            started_at: "2026-10-10T00:00:00.000Z",
            duration_ms: 1,
            quality_score: null,
          })),
        },
      ],
    }),
  /20|too_big|array/i,
  `a strip may not exceed ${DASHBOARD_STRIP_RUNS} runs`,
);

console.log("selfcheck-dashboard: ok");
