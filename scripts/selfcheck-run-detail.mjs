/**
 * Self-check for the Run detail page's pure logic (maestro cs-fe-10-2).
 *
 * Pins: the trace is time-ordered, screenshot events are counted and folded
 * out, offsets read from the run's start, only http(s) step URLs survive, the
 * browser job id comes from the `browser.job` event (and only on a browser
 * run), and an API error envelope yields its message rather than
 * "[object Object]".
 */
import assert from "node:assert/strict";

const { buildTrace, formatOffset, browserJobId, apiErrorMessage, syncSummary } = await import(
  "../src/frontend/components/runs/run-detail-model.ts"
);

const START = "2026-10-14T21:18:13.000Z";
const ev = (id, at, kind, data = null, level = "info") => ({
  id,
  run_id: "r",
  at,
  level,
  kind,
  message: id,
  data,
});

// Out of order on purpose: the trace must sort, not trust the array.
const events = [
  ev("c", "2026-10-14T21:19:13.000Z", "browser.ai_decision", { model: "glm-5.3", url: "https://tm.example/p" }),
  ev("shot", "2026-10-14T21:18:50.000Z", "browser.screenshot", { screenshotKey: "jobs/x/1.jpg" }),
  ev("a", "2026-10-14T21:18:14.000Z", "browser.job", { jobId: "job-123", promptChars: 765 }),
  ev("b", "2026-10-14T21:18:19.000Z", "browser.lease", { url: "javascript:alert(1)", model: null }),
  ev("shot2", "2026-10-14T21:20:00.000Z", "browser.screenshot", {}),
];

{
  const { steps, screenshots } = buildTrace({ events, started_at: START });
  assert.deepEqual(steps.map((s) => s.event.id), ["a", "b", "c"], "steps are in time order, screenshots folded out");
  assert.equal(screenshots, 2, "screenshot events are counted");
  assert.deepEqual(steps.map((s) => s.offsetMs), [1000, 6000, 60000], "offsets are measured from the run's start");
  assert.equal(steps[2].model, "glm-5.3");
  assert.equal(steps[2].url, "https://tm.example/p");
  assert.equal(steps[1].url, null, "a javascript: URL never becomes a link");
  assert.equal(steps[1].model, null, "a null model is not a model");
}

{
  // A step logged before the run's own start (clock skew) is +0:00, never negative.
  const { steps } = buildTrace({ events: [ev("x", "2026-10-14T21:18:00.000Z", "note")], started_at: START });
  assert.equal(steps[0].offsetMs, 0);
}

assert.equal(formatOffset(0), "+0:00");
assert.equal(formatOffset(436_000), "+7:16");
assert.equal(formatOffset(3_723_000), "+1:02:03");
assert.equal(formatOffset(null), "—");

assert.equal(browserJobId({ client: "browser", events }), "job-123");
assert.equal(browserJobId({ client: "claude", events }), null, "only a browser run has a core-browser job");
assert.equal(browserJobId({ client: "browser", events: events.filter((e) => e.kind !== "browser.job") }), null);

assert.equal(
  apiErrorMessage({ status: 502, body: { error: { code: "browser_unavailable", message: "core-browser did not answer" } } }, "fallback"),
  "core-browser did not answer",
  "the envelope's message, not [object Object]",
);
assert.equal(apiErrorMessage({ body: { error: "plain string" } }, "fallback"), "plain string");
assert.equal(apiErrorMessage(new Error("network"), "fallback"), "fallback");

assert.equal(syncSummary({ events_added: 0, run_status: "failed", job_status: "failed" }), "No new steps. Job failed, run failed.");
assert.equal(syncSummary({ events_added: 1_204, run_status: "running", job_status: "running" }), "1,204 new steps. Job running, run running.");

console.log("selfcheck-run-detail: ok");
