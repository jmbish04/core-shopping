/**
 * @fileoverview Browser runs (maestro cs-be-6-6): the pure rules that turn a goal
 * into a core-browser job, and a core-browser job back into an `agent_runs` row.
 *
 * No value imports, so `scripts/selfcheck-browser-runs.mjs` drives every rule
 * in plain Node. The routes in `api/routes/shopping/browse.ts` do the I/O.
 *
 * How a browser run is stored, with no new table:
 *
 * | Where                       | What                                                  |
 * |-----------------------------|-------------------------------------------------------|
 * | `agent_runs`                | `client = browser`, `model = core-browser`            |
 * | `run_goals`                 | the goal the run works                                |
 * | `run_events` kind `browser.job` | `data.jobId`: the core-browser job id (one per run) |
 * | `run_events` kind `browser.<kind>` | one row per core-browser job event, `data.seq` |
 *
 * The job id is derived from the `browser.job` event, never stored twice. The
 * sync copies only events whose `seq` is above the highest `seq` already copied.
 */

import type { BrowserHealth, BrowserJob, BrowserJobEvent } from "./types";

/** The longest prompt sent to core-browser. Past this the goal text is cut. */
export const BROWSE_PROMPT_MAX_CHARS = 4_000;

/** The default for `BROWSER_DAILY_RUN_CAP` when the var is absent or not a positive integer. */
export const DEFAULT_BROWSER_DAILY_RUN_CAP = 20;

/** `run_events.kind` of the row that holds the core-browser job id. */
export const BROWSER_JOB_EVENT_KIND = "browser.job";

/** The goal fields the prompt uses. */
export interface BrowseGoal {
  title: string;
  category: string;
  status: string;
  instructions: string;
  systemPrompt: string;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  currency: string;
  windowStart: string | null;
  windowEnd: string | null;
  timeNotes: string;
  breakRules: string[];
}

/** One goal criterion, as the prompt uses it. */
export interface BrowseCriterion {
  label: string;
  kind: string;
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

/**
 * The core-browser prompt for one goal.
 *
 * @param goal - The goal.
 * @param criteria - Its criteria, in display order.
 * @returns A prompt of at most `BROWSE_PROMPT_MAX_CHARS` characters.
 * @example
 * ```typescript
 * const prompt = buildBrowsePrompt(goal, criteria);
 * ```
 */
export function buildBrowsePrompt(goal: BrowseGoal, criteria: BrowseCriterion[]): string {
  const lines: string[] = [
    `Shopping goal: ${goal.title} (${goal.category}).`,
    "Use the browser to find current, real offers that match this goal. Visit the seller or venue page for each one; do not report a price you did not see on a page.",
  ];
  const { budgetMinCents: lo, budgetMaxCents: hi, currency } = goal;
  if (lo != null && hi != null) lines.push(`Budget: ${money(lo, currency)} to ${money(hi, currency)}.`);
  else if (hi != null) lines.push(`Budget: at most ${money(hi, currency)}.`);
  else if (lo != null) lines.push(`Budget: at least ${money(lo, currency)}.`);
  if (goal.windowStart || goal.windowEnd) {
    lines.push(`Dates: ${goal.windowStart ?? "any"} to ${goal.windowEnd ?? "any"}.`);
  }
  if (goal.timeNotes.trim()) lines.push(`Timing: ${goal.timeNotes.trim()}`);
  const hard = criteria.filter((c) => c.kind === "hard").map((c) => c.label);
  const soft = criteria.filter((c) => c.kind !== "hard").map((c) => c.label);
  if (hard.length) lines.push(`Must have: ${hard.join("; ")}.`);
  if (soft.length) lines.push(`Prefer: ${soft.join("; ")}.`);
  if (goal.breakRules.length) lines.push(`Exceptions worth reporting anyway: ${goal.breakRules.join("; ")}.`);
  if (goal.instructions.trim()) lines.push(`Instructions: ${goal.instructions.trim()}`);
  if (goal.systemPrompt.trim()) lines.push(`Context: ${goal.systemPrompt.trim()}`);
  lines.push(
    "Finish with one JSON object on the last line: {\"findings\":[{\"kind\",\"title\",\"url\",\"price\",\"currency\",\"seller\",\"venue\",\"city\",\"dates\",\"notes\"}]}. kind is one of event, product, flight, hotel, experience. dates is YYYY-MM-DD or an ISO datetime. Use null for a field you did not see.",
  );
  const prompt = lines.join("\n");
  if (prompt.length <= BROWSE_PROMPT_MAX_CHARS) return prompt;
  // ponytail: cut the free text, never the closing output instruction.
  const tail = lines[lines.length - 1];
  return `${prompt.slice(0, BROWSE_PROMPT_MAX_CHARS - tail.length - 2)}\n${tail}`;
}

/** Why a browse request is refused. */
export type BrowseRefusal =
  | { ok: false; status: 409; code: "goal_not_active" | "browser_run_in_progress"; reason: string }
  | { ok: false; status: 429; code: "daily_cap_reached"; reason: string }
  | { ok: false; status: 503; code: "browser_unavailable" | "cost_guard_tripped"; reason: string };

/** What decides whether a browse request may start a job. */
export interface BrowseGateInput {
  goalStatus: string;
  /** Browser runs for this goal still `running`. */
  runningForGoal: number;
  /** Browser runs started since 00:00 UTC, all goals. */
  startedToday: number;
  cap: number;
  /** `null` when `health()` threw. */
  health: BrowserHealth | null;
}

/**
 * Decide whether a browse request may submit a job. Every refusal names why.
 *
 * @param input - The goal status, the counts and core-browser's health.
 * @returns `{ ok: true }`, or the refusal with its HTTP status.
 */
export function gateBrowse(input: BrowseGateInput): { ok: true } | BrowseRefusal {
  if (input.goalStatus !== "active") {
    return { ok: false, status: 409, code: "goal_not_active", reason: `The goal is ${input.goalStatus}; only active goals are browsed.` };
  }
  if (input.runningForGoal > 0) {
    return { ok: false, status: 409, code: "browser_run_in_progress", reason: "A browser run for this goal is still running. Sync it first." };
  }
  if (input.startedToday >= input.cap) {
    return {
      ok: false,
      status: 429,
      code: "daily_cap_reached",
      reason: `${input.startedToday.toLocaleString("en-US")} browser runs started today; the cap is ${input.cap.toLocaleString("en-US")}.`,
    };
  }
  if (!input.health) {
    return { ok: false, status: 503, code: "browser_unavailable", reason: "core-browser did not answer health()." };
  }
  if (!input.health.guard.ok) {
    return {
      ok: false,
      status: 503,
      code: "cost_guard_tripped",
      reason: `core-browser's cost guard is ${input.health.guard.state}: ${input.health.guard.reason}`,
    };
  }
  if (!input.health.ok) {
    return { ok: false, status: 503, code: "browser_unavailable", reason: "The agent-browser VM browser is not ready." };
  }
  return { ok: true };
}

/**
 * Parse `BROWSER_DAILY_RUN_CAP`.
 *
 * @param raw - The var, as wrangler passes it.
 * @returns A positive integer; the default when the var is absent or invalid.
 */
export function dailyRunCap(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_BROWSER_DAILY_RUN_CAP;
}

/**
 * The run status for a core-browser job status.
 *
 * @param status - The job status.
 * @returns `running` until the job is terminal.
 */
export function runStatusForJob(status: BrowserJob["status"]): "running" | "succeeded" | "failed" | "abandoned" {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
      return "abandoned";
    default:
      return "running";
  }
}

/** A `run_events` insert built from one core-browser event. */
export interface BrowserRunEventInsert {
  at: Date;
  level: "info" | "error";
  kind: string;
  message: string;
  data: Record<string, unknown>;
}

/**
 * The core-browser events not yet copied, as `run_events` inserts.
 *
 * @param events - The job's full timeline.
 * @param lastCopiedSeq - The highest `seq` already copied, or `-1` when none.
 * @returns The new events, in `seq` order.
 */
export function eventsToCopy(events: BrowserJobEvent[], lastCopiedSeq: number): BrowserRunEventInsert[] {
  return events
    .filter((e) => e.seq > lastCopiedSeq)
    .sort((a, b) => a.seq - b.seq)
    .map((e) => ({
      at: new Date(e.ts * 1000),
      level: e.kind === "error" ? "error" : "info",
      kind: `browser.${e.kind}`,
      message: (e.message || e.title || e.url || e.kind).slice(0, 2_000),
      data: {
        seq: e.seq,
        url: e.url,
        title: e.title,
        screenshotKey: e.screenshotKey,
        durationMs: e.durationMs,
        model: e.model,
      },
    }));
}

/**
 * The run summary for a terminal job.
 *
 * @param job - The job.
 * @returns One line: status, steps and cost.
 */
export function jobSummary(job: BrowserJob): string {
  const cost = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(job.costUsd / 1_000_000);
  return `core-browser job ${job.status}: ${job.stepCount.toLocaleString("en-US")} steps, ${cost}`;
}
