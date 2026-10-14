/**
 * Self-check for browser runs (maestro cs-be-6-6): the pure rules in
 * `src/backend/browser/runs.ts` and the route wiring.
 *
 * In each fixture the wrong answer is the easy one:
 * - every gate fixture is otherwise allowed, so only the one fault refuses it
 * - a cost guard that is tripped refuses even while the browser is ready
 * - the event copy is given events BELOW and ABOVE the copied seq, out of order
 * - a long goal must still end with the output instruction after the cut
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runs = await import("../src/backend/browser/runs.ts");
const { buildBrowsePrompt, gateBrowse, dailyRunCap, runStatusForJob, eventsToCopy, jobSummary, BROWSE_PROMPT_MAX_CHARS } = runs;

const goal = {
  title: "Prime Day wishlist",
  category: "product",
  status: "active",
  instructions: "Check Amazon and Best Buy.",
  systemPrompt: "",
  budgetMinCents: null,
  budgetMaxCents: 120000,
  currency: "USD",
  windowStart: null,
  windowEnd: "2026-10-20",
  timeNotes: "",
  breakRules: [],
};
const health = { ok: true, cdpConnected: true, lease: { held: false }, guard: { ok: true, state: "active", reason: "" } };
const allowed = { goalStatus: "active", runningForGoal: 0, startedToday: 3, cap: 20, health };

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}
console.log("selfcheck-browser-runs");

await check("the prompt carries the goal, the budget, the criteria and the output format", () => {
  const p = buildBrowsePrompt(goal, [
    { label: "64 GB RAM", kind: "hard" },
    { label: "quiet fans", kind: "soft" },
  ]);
  assert.match(p, /Prime Day wishlist \(product\)/);
  assert.match(p, /at most \$1,200\.00/);
  assert.match(p, /Must have: 64 GB RAM\./);
  assert.match(p, /Prefer: quiet fans\./);
  assert.match(p, /Dates: any to 2026-10-20/);
  assert.match(p, /Check Amazon and Best Buy/);
  assert.match(p, /"findings"/);
});

await check("a long goal is cut to the limit and keeps the output instruction", () => {
  const p = buildBrowsePrompt({ ...goal, instructions: "x".repeat(10_000) }, []);
  assert.ok(p.length <= BROWSE_PROMPT_MAX_CHARS, `prompt is ${p.length} chars`);
  assert.match(p.split("\n").at(-1), /"findings"/);
});

await check("an otherwise allowed request passes the gate", () => {
  assert.deepEqual(gateBrowse(allowed), { ok: true });
});

for (const [name, change, code, status] of [
  ["a paused goal", { goalStatus: "paused" }, "goal_not_active", 409],
  ["a browser run already running", { runningForGoal: 1 }, "browser_run_in_progress", 409],
  ["the cap reached exactly", { startedToday: 20 }, "daily_cap_reached", 429],
  ["core-browser not answering", { health: null }, "browser_unavailable", 503],
  ["a tripped cost guard with the browser ready", { health: { ...health, guard: { ok: false, state: "soft-killed", reason: "over cap" } } }, "cost_guard_tripped", 503],
  ["the VM browser not ready", { health: { ...health, ok: false, cdpConnected: false } }, "browser_unavailable", 503],
]) {
  await check(`${name} is refused`, () => {
    const r = gateBrowse({ ...allowed, ...change });
    assert.equal(r.ok, false);
    assert.equal(r.code, code);
    assert.equal(r.status, status);
    assert.ok(r.reason.length > 0);
  });
}

await check("the daily cap var parses, and falls back on junk", () => {
  assert.equal(dailyRunCap("5"), 5);
  assert.equal(dailyRunCap(undefined), 20);
  assert.equal(dailyRunCap("0"), 20);
  assert.equal(dailyRunCap("abc"), 20);
});

await check("job status maps to run status; only terminal jobs finish the run", () => {
  assert.equal(runStatusForJob("queued"), "running");
  assert.equal(runStatusForJob("running"), "running");
  assert.equal(runStatusForJob("succeeded"), "succeeded");
  assert.equal(runStatusForJob("failed"), "failed");
  assert.equal(runStatusForJob("cancelled"), "abandoned");
});

await check("only events above the copied seq are copied, in seq order", () => {
  const ev = (seq, kind, message) => ({ id: seq, jobId: "j", seq, ts: 1_760_000_000 + seq, kind, url: "https://x.test", title: null, message, screenshotKey: null, durationMs: null, model: null, tokensIn: null, tokensOut: null });
  const out = eventsToCopy([ev(4, "read", "four"), ev(1, "navigate", "one"), ev(3, "error", "three"), ev(2, "act", "two")], 2);
  assert.deepEqual(out.map((e) => e.data.seq), [3, 4]);
  assert.equal(out[0].kind, "browser.error");
  assert.equal(out[0].level, "error");
  assert.equal(out[1].level, "info");
  assert.equal(out[1].at.toISOString(), new Date((1_760_000_000 + 4) * 1000).toISOString());
  assert.equal(eventsToCopy([ev(0, "navigate", null)], -1)[0].message, "https://x.test");
});

await check("the summary formats steps and micro-USD cost", () => {
  assert.equal(jobSummary({ status: "succeeded", stepCount: 1234, costUsd: 42_500 }), "core-browser job succeeded: 1,234 steps, $0.04");
});

await check("the routes are mounted and the cap var is declared", () => {
  const api = readFileSync(resolve(root, "src/backend/api/index.ts"), "utf8");
  assert.match(api, /app\.route\("\/api\/goals", browseGoalsRouter\)/);
  assert.match(api, /app\.route\("\/api\/runs", browseRunsRouter\)/);
  const browse = readFileSync(resolve(root, "src/backend/api/routes/shopping/browse.ts"), "utf8");
  assert.match(browse, /const gate = gateBrowse\(/);
  assert.match(browse, /if \(!gate\.ok\) return/);
  assert.ok(browse.indexOf("if (!gate.ok)") < browse.indexOf("browserSubmit(env"), "submit runs before the gate");
  assert.match(readFileSync(resolve(root, "wrangler.jsonc"), "utf8"), /"BROWSER_DAILY_RUN_CAP":\s*"\d+"/);
});

console.log(`selfcheck-browser-runs: ${passed} checks passed`);
