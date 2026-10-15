/**
 * Self-check for the Overview's run sections (maestro cs-fe-1-2, 1-3, 1-4).
 *
 * Pins: incidents are failed runs plus STALE goals only (a never-run goal is
 * not an incident), newest first, browser runs marked; the feed merges runs
 * and proposals by time and places a run at its finish; the review button
 * counts queued proposals only; totals keep browser as a subset; strip success
 * rate ignores running runs and is null with nothing finished; day labels are
 * UTC days.
 */
import assert from "node:assert/strict";

const S = await import("../src/frontend/components/overview/overview-sections.ts");

const run = (id, status, started, extra = {}) => ({
  id,
  client: "claude",
  status,
  summary: `${id} summary`,
  error: null,
  started_at: started,
  finished_at: null,
  sightings_count: 0,
  goal_title: null,
  ...extra,
});
const strip = (id, stale, runs) => ({
  goal_id: id,
  slug: id,
  title: `Goal ${id}`,
  category: "product",
  stale,
  runs,
  runs_total: runs.length,
});
const sr = (status, started) => ({
  id: `${status}-${started}`,
  status,
  started_at: started,
  duration_ms: status === "running" ? null : 1000,
  quality_score: null,
  summary: "",
  sightings_count: 0,
});

// --- incidents -------------------------------------------------------------
{
  const runs = [
    run("ok", "succeeded", "2026-10-15T10:00:00.000Z"),
    run("f1", "failed", "2026-10-15T09:00:00.000Z", { client: "browser", error: "VM browser not ready", goal_title: "Concerts" }),
    run("f2", "failed", "2026-10-15T11:00:00.000Z"),
  ];
  const strips = [
    strip("stale", true, [sr("succeeded", "2026-10-14T08:00:00.000Z"), sr("failed", "2026-10-15T10:30:00.000Z")]),
    strip("fresh", false, [sr("succeeded", "2026-10-15T08:00:00.000Z")]),
    strip("never", false, []),
  ];
  const incidents = S.buildIncidents(runs, strips);
  assert.deepEqual(incidents.map((i) => i.id), ["run:f2", "goal:stale", "run:f1"], "failed runs and stale goals, newest first");
  const f1 = incidents.find((i) => i.id === "run:f1");
  assert.deepEqual([f1.title, f1.detail, f1.browser, f1.href], ["Concerts", "VM browser not ready", true, "/runs/f1"]);
  assert.equal(incidents.find((i) => i.id === "run:f2").detail, "Failed without a recorded reason.", "no error is said, not left blank");
  assert.equal(incidents.find((i) => i.id === "run:f2").title, "f2 summary", "a run with no goal is named by its summary");
  assert.equal(incidents.find((i) => i.id === "goal:stale").at, "2026-10-15T10:30:00.000Z", "a stale goal sits at its LAST run");
  assert.ok(!incidents.some((i) => i.id === "goal:never"), "a goal that never ran is not an incident");
}

// --- activity feed -----------------------------------------------------------
{
  const overview = {
    recent_runs: [
      run("r-old-start-late-finish", "succeeded", "2026-10-15T08:00:00.000Z", { finished_at: "2026-10-15T12:00:00.000Z" }),
      run("r-running", "running", "2026-10-15T11:00:00.000Z"),
    ],
    recent_proposals: [
      { id: "p1", kind: "item", status: "queued", title: "P1", goal_id: null, goal_title: null, match_score: 0.5, created_at: "2026-10-15T11:30:00.000Z", expires_at: null },
    ],
  };
  const feed = S.buildActivity(overview);
  assert.deepEqual(feed.map((i) => i.id), ["run:r-old-start-late-finish", "proposal:p1", "run:r-running"], "a run is placed at its finish");
  assert.equal(S.buildActivity(overview, 1).length, 1, "the limit holds");
}

// --- review CTA ---------------------------------------------------------------
{
  const backlog = { queued: 0, snoozed: 4, expiring_soon: 0, oldest_queued_at: null, silent_updates: 0 };
  assert.equal(S.reviewCtaLabel(backlog), null, "snoozed proposals do not make a review button");
  assert.equal(S.reviewCtaLabel({ ...backlog, queued: 1 }), "Review 1 item");
  assert.equal(S.reviewCtaLabel({ ...backlog, queued: 1_204 }), "Review 1,204 items");
}

// --- totals, success rate, day labels -------------------------------------------
{
  const day = (date, o) => ({ date, succeeded: 0, failed: 0, abandoned: 0, running: 0, browser: 0, ...o, total: (o.succeeded ?? 0) + (o.failed ?? 0) + (o.abandoned ?? 0) + (o.running ?? 0) });
  const totals = S.throughputTotals([day("2026-10-14", { succeeded: 1, failed: 2, browser: 3 }), day("2026-10-15", { failed: 5, running: 1, browser: 5 })]);
  assert.deepEqual(totals, { total: 9, failed: 7, browser: 8, running: 1 });

  assert.equal(S.stripSuccessRate(strip("a", false, [sr("succeeded", "x"), sr("failed", "y"), sr("running", "z")])), 0.5, "running runs are not counted");
  assert.equal(S.stripSuccessRate(strip("b", false, [sr("running", "z")])), null, "nothing finished is unknown, not 0%");
  assert.equal(S.stripSuccessRate(strip("c", false, [])), null);

  assert.equal(S.utcDayLabel("2026-10-15"), "Oct 15", "the UTC day, whatever the local zone");
  assert.equal(S.utcDayLabel("2026-01-01"), "Jan 1");
}

console.log("selfcheck-overview-sections: ok");
