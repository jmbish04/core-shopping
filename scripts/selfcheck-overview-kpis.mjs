/**
 * Self-check for the Overview KPI strip's pure logic (maestro cs-fe-1-1).
 *
 * Pins what `kpi-tiles.ts` decides, each with a fixture where the WRONG answer
 * is the easy one:
 *
 * - an unknown value renders as an em dash with the server's reason, never 0
 * - an unknown delta draws no badge at all, never "0"
 * - a rising review backlog is coloured bad, a rising run count good
 * - a ratio delta is in percentage points
 * - only the runs tile carries a sparkline, and it is the dense daily series
 * - a KPI the server did not send is left out, not drawn as zero
 * - counts carry thousands separators
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const ALIASES = [
  ["@/components/", "src/frontend/components/"],
  ["@/lib/", "src/frontend/lib/"],
  ["@/shared/", "src/shared/"],
];

registerHooks({
  resolve(specifier, context, next) {
    for (const [prefix, dir] of ALIASES) {
      if (specifier.startsWith(prefix)) {
        let target = resolvePath(root, dir, specifier.slice(prefix.length));
        if (!/\.[cm]?[jt]sx?$/.test(target)) {
          target = existsSync(`${target}.ts`) ? `${target}.ts` : resolvePath(target, "index.ts");
        }
        return next(pathToFileURL(target).href, context);
      }
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

const { buildKpiTiles, formatKpiDelta, formatKpiValue, STRIP_KPI_IDS } = await import(
  "../src/frontend/components/overview/kpi-tiles.ts"
);
const { makeKpi, denseDays } = await import("../src/shared/contracts/dashboard.ts");

function overview(kpis, days = denseDays("2026-10-06", 7, { "2026-10-08": { succeeded: 2, failed: 1 } })) {
  return { window_days: 7, runs_per_day: days, kpis };
}

const FULL = [
  makeKpi({ id: "active_goals", label: "Active goals", unit: "count", value: 12345, previous: 12000 }),
  makeKpi({ id: "runs", label: "Runs in 7d", unit: "count", value: 3, previous: 5 }),
  makeKpi({ id: "run_success_rate", label: "Success rate", unit: "ratio", value: 2 / 3, previous: 0.5 }),
  makeKpi({ id: "new_findings", label: "New findings", unit: "count", value: 0, previous: 0 }),
  makeKpi({ id: "review_backlog", label: "Awaiting review", unit: "count", value: 9, previous: 6, higherIsBetter: false }),
  makeKpi({ id: "accept_rate", label: "Accept rate", unit: "ratio", value: null, previous: null,
            unavailableReason: "nothing has been reviewed in this window" }),
  makeKpi({ id: "lessons_learned", label: "Lessons learned", unit: "count", value: null, previous: 4,
            unavailableReason: "lessons are not recorded yet" }),
];

const tiles = buildKpiTiles(overview(FULL));
const byId = Object.fromEntries(tiles.map((t) => [t.id, t]));

// Order and membership: the five FE-1 tiles, accept_rate not drawn.
assert.deepEqual(tiles.map((t) => t.id), [...STRIP_KPI_IDS]);
assert.equal(byId.accept_rate, undefined);

// Thousands separators.
assert.equal(byId.active_goals.value, "12,345");
assert.equal(byId.active_goals.delta.text, "+345");

// Unknown is not zero: em dash, the server's reason, and no badge.
assert.equal(byId.lessons_learned.value, "—");
assert.equal(byId.lessons_learned.unavailableReason, "lessons are not recorded yet");
assert.equal(byId.lessons_learned.delta, null);
assert.equal(formatKpiValue("ratio", null), "—");
assert.equal(formatKpiValue("count", 0), "0");

// A measured zero change is a flat badge, distinct from an unknown one.
assert.deepEqual(byId.new_findings.delta, { text: "0", tone: "flat", direction: "none" });

// Tone follows higher_is_better.
assert.equal(byId.review_backlog.delta.tone, "bad");
assert.equal(byId.review_backlog.delta.direction, "up");
assert.equal(byId.runs.delta.tone, "bad");
assert.equal(byId.runs.delta.text, "−2");
assert.equal(byId.runs.delta.direction, "down");

// Ratio deltas are percentage points.
const rate = FULL.find((k) => k.id === "run_success_rate");
assert.deepEqual(formatKpiDelta(rate), { text: "+17 pts", tone: "good", direction: "up" });
assert.deepEqual(
  formatKpiDelta(makeKpi({ id: "accept_rate", label: "x", unit: "ratio", value: 0.501, previous: 0.5 })),
  { text: "0 pts", tone: "flat", direction: "none" },
);

// The runs tile folds in the success rate and carries the dense daily series.
assert.deepEqual(byId.runs.secondary, { label: "Success rate", value: "67%", reason: null });
assert.equal(byId.runs.sparkline.length, 7);
assert.deepEqual(byId.runs.sparkline[2], { date: "2026-10-08", value: 3 });
assert.equal(byId.runs.sparkline[0].value, 0);
for (const t of tiles) if (t.id !== "runs") assert.equal(t.sparkline, null, `${t.id} must not get a sparkline`);

// A null success rate shows its reason on the runs tile, not "0%".
const noFinished = buildKpiTiles(overview(FULL.map((k) =>
  k.id === "run_success_rate"
    ? makeKpi({ id: "run_success_rate", label: "Success rate", unit: "ratio", value: null, previous: null,
                unavailableReason: "no run has finished in this window" })
    : k)));
assert.deepEqual(noFinished.find((t) => t.id === "runs").secondary,
  { label: "Success rate", value: "—", reason: "no run has finished in this window" });

// A KPI the server did not send is omitted, not invented.
const partial = buildKpiTiles(overview(FULL.filter((k) => k.id !== "new_findings" && k.id !== "run_success_rate")));
assert.deepEqual(partial.map((t) => t.id), ["active_goals", "runs", "review_backlog", "lessons_learned"]);
assert.equal(partial.find((t) => t.id === "runs").secondary, null);

// The comparison caption names the real window.
assert.equal(byId.runs.comparison, "vs previous 7 days");
assert.equal(buildKpiTiles({ ...overview(FULL), window_days: 1 })[0].comparison, "vs previous 1 day");

console.log("selfcheck-overview-kpis: ok");
