/**
 * @fileoverview Pure logic for the Run detail page (maestro cs-fe-10-2).
 *
 * Split from the island so `scripts/selfcheck-run-detail.mjs` can load it under
 * plain Node: type-only imports, no React. What it decides:
 *
 * - **The trace is the run's own events, in time order.** Screenshot events are
 *   folded out of it and counted instead: the run stores a screenshot KEY but
 *   no route serves the image, so a step that says "screenshot" with nothing to
 *   look at is noise.
 * - **Each step shows its offset from the run's start** (`+1:23`), which is how
 *   a person reads a trace; the absolute time is the tooltip.
 * - **The browser job id comes from the `browser.job` event**, the same event
 *   the sync route reads. A browser run without one cannot be refreshed.
 * - **An API error envelope is `{ error: { code, message } }`.** `ApiError`'s
 *   own message stringifies the object, so the message is read from the body.
 */

import type { RunDetail, RunEvent } from "@/shared/contracts";

/** `GET /api/runs/{id}` as the route returns it. */
export type RunDetailView = RunDetail & { duration_ms: number | null };

/** The event kind the browse route writes when it submits a core-browser job. */
export const BROWSER_JOB_KIND = "browser.job";
/** Events that only carry a screenshot key. */
export const SCREENSHOT_KIND = "browser.screenshot";

/** One row of the step trace. */
export interface TraceStep {
  event: RunEvent;
  /** Milliseconds since the run started; null when either time is unreadable. */
  offsetMs: number | null;
  /** The model that made this step's decision, when the event names one. */
  model: string | null;
  /** A page the step was on, when the event names one and it is http(s). */
  url: string | null;
}

function field(data: unknown, key: string): unknown {
  return data && typeof data === "object" ? (data as Record<string, unknown>)[key] : undefined;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * Build the step trace from a run's events.
 *
 * @param run - The run detail.
 * @returns The steps in time order, and how many screenshot events were folded out.
 * @example
 * ```typescript
 * buildTrace(run).steps[0].offsetMs; // 0
 * ```
 */
export function buildTrace(run: Pick<RunDetail, "events" | "started_at">): {
  steps: TraceStep[];
  screenshots: number;
} {
  const start = Date.parse(run.started_at);
  const sorted = [...run.events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
  const steps: TraceStep[] = [];
  let screenshots = 0;
  for (const event of sorted) {
    if (event.kind === SCREENSHOT_KIND) {
      screenshots += 1;
      continue;
    }
    const at = Date.parse(event.at);
    const model = field(event.data, "model");
    steps.push({
      event,
      offsetMs: Number.isFinite(start) && Number.isFinite(at) ? Math.max(0, at - start) : null,
      model: typeof model === "string" && model ? model : null,
      url: httpUrl(field(event.data, "url")),
    });
  }
  return { steps, screenshots };
}

/**
 * Format an offset from the run's start as `+m:ss`, or `+h:mm:ss` past an hour.
 *
 * @param ms - Milliseconds since the start, or null.
 * @returns e.g. "+0:00", "+7:16", "+1:02:03", or an em dash.
 */
export function formatOffset(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "—";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `+${h}:${String(m).padStart(2, "0")}:${s}` : `+${m}:${s}`;
}

/**
 * The core-browser job behind a browser run.
 *
 * @param run - The run detail.
 * @returns The job id, or null when this is not a browser run or no job was recorded.
 */
export function browserJobId(run: Pick<RunDetail, "client" | "events">): string | null {
  if (run.client !== "browser") return null;
  const jobEvent = run.events.find((e) => e.kind === BROWSER_JOB_KIND);
  const jobId = field(jobEvent?.data, "jobId");
  return typeof jobId === "string" && jobId ? jobId : null;
}

/**
 * Read a human message out of a failed API call.
 *
 * @param error - What the request threw.
 * @param fallback - Said when nothing better is available.
 * @returns The server's own message when it sent one.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const body = error && typeof error === "object" ? (error as { body?: unknown }).body : undefined;
  const inner = field(body, "error");
  const message = typeof inner === "string" ? inner : field(inner, "message");
  return typeof message === "string" && message ? message : fallback;
}

/** Plain-language result of a sync, for the line under the Refresh button. */
export function syncSummary(result: { events_added: number; run_status: string; job_status: string }): string {
  const added =
    result.events_added === 0
      ? "No new steps"
      : `${result.events_added.toLocaleString("en-US")} new ${result.events_added === 1 ? "step" : "steps"}`;
  return `${added}. Job ${result.job_status}, run ${result.run_status}.`;
}
