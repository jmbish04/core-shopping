/**
 * @fileoverview Pure row and filter logic for the Runs queue (maestro cs-fe-10-1).
 *
 * Split from the island so `scripts/selfcheck-runs-queue.mjs` can load it under
 * plain Node: type-only imports, no `.tsx`, no React. The decisions worth
 * pinning all live here —
 *
 * - **Groups come from the server.** The queue asks `group_by=status`, and the
 *   API returns the groups in triage order (running, failed, succeeded,
 *   abandoned) with counts over the whole result set. A header says "3 of 40"
 *   when the page holds fewer than the server counted.
 * - **Attention is a real filter, not a client slice.** Each attention option
 *   compiles to rules against `RUN_LIST_FIELDS`, so the envelope's `total`
 *   describes the view on screen. Options are OR-ed with each other and AND-ed
 *   with the client and goal filters.
 * - **Every attention option is backed by a stored field.** Failed and running
 *   are statuses; low quality is `quality_score < 0.5`; unscored is a
 *   succeeded run whose `quality_score` is still null. Nothing is inferred.
 * - **A running run has no duration**, and an unscored run has no quality.
 *   Both render as an em dash, never as 0.
 */

import type { FilterNode, FilterQuery, Run } from "@/shared/contracts";

/** A run row as `GET /api/runs` returns it. */
export type RunListRow = Run & { duration_ms: number | null };

/** The attention filters the toolbar offers. */
export const RUN_ATTENTION = ["failed", "running", "low_quality", "unscored"] as const;
export type RunAttention = (typeof RUN_ATTENTION)[number];

export const RUN_ATTENTION_LABELS: Record<RunAttention, string> = {
  failed: "Failed",
  running: "Still running",
  low_quality: "Low quality (under 50%)",
  unscored: "Finished, not scored",
};

/** Display names for agent clients; brand casing, not title case ("GPT", not "Gpt"). */
export const CLIENT_LABELS: Record<Run["client"], string> = {
  claude: "Claude",
  gpt: "GPT",
  gemini: "Gemini",
  browser: "Browser",
  other: "Other",
};

/** Below this quality score a run is flagged for attention. */
export const LOW_QUALITY_THRESHOLD = 0.5;

/** Triage order for status groups; mirrors the API's own ordering. */
export const RUN_STATUS_ORDER: readonly Run["status"][] = ["running", "failed", "succeeded", "abandoned"];

/** The queue's view: everything that rides in the URL besides paging. */
export interface RunQueueView {
  q: string;
  attention: RunAttention[];
  client: Run["client"] | undefined;
  goalId: string | undefined;
  page: number;
}

let ruleSeq = 0;

function rule(path: string, operator: string, value?: unknown): FilterNode {
  ruleSeq += 1;
  return {
    id: `runs-${path}-${ruleSeq}`,
    type: "rule",
    path: [path],
    operator,
    ...(value === undefined ? {} : { value }),
  };
}

function group(id: string, combinator: "and" | "or", rules: FilterNode[]): FilterQuery {
  return { id, type: "group", combinator, rules };
}

/**
 * The filter one attention option means.
 *
 * @param attention - The option.
 * @returns A rule or group against `RUN_LIST_FIELDS`.
 * @example
 * ```typescript
 * attentionNode("unscored"); // status is succeeded AND quality_score is empty
 * ```
 */
export function attentionNode(attention: RunAttention): FilterNode {
  switch (attention) {
    case "failed":
      return rule("status", "is", "failed");
    case "running":
      return rule("status", "is", "running");
    case "low_quality":
      return rule("quality_score", "lt", LOW_QUALITY_THRESHOLD);
    case "unscored":
      return group("runs-unscored", "and", [rule("status", "is", "succeeded"), rule("quality_score", "empty")]);
  }
}

/**
 * Build the API filter for the queue's toolbar state.
 *
 * @param view - The selected attention options, client and goal.
 * @returns One filter tree, or undefined when nothing is selected.
 * @example
 * ```typescript
 * runQueueFilter({ attention: ["failed", "low_quality"], client: "claude", goalId: undefined });
 * // (status is failed OR quality_score < 0.5) AND client is claude
 * ```
 */
export function runQueueFilter(
  view: Pick<RunQueueView, "attention" | "client" | "goalId">,
): FilterQuery | undefined {
  const parts: FilterNode[] = [];
  const attention = RUN_ATTENTION.filter((a) => view.attention.includes(a));
  if (attention.length === 1) parts.push(attentionNode(attention[0]));
  if (attention.length > 1) parts.push(group("runs-attention", "or", attention.map(attentionNode)));
  if (view.client) parts.push(rule("client", "is", view.client));
  if (view.goalId) parts.push(rule("goal_id", "is", view.goalId));
  if (parts.length === 0) return undefined;
  return group("runs-view", "and", parts);
}

/** One run under its status. */
export interface RunItemRow {
  kind: "run";
  id: string;
  run: RunListRow;
  children?: undefined;
}

/** A status header, with what the server counted and what this page holds. */
export interface RunStatusRow {
  kind: "status";
  id: string;
  status: Run["status"];
  children: RunItemRow[];
  /** The server's count for this status, or null when it did not group. */
  total: number | null;
}

export type RunRow = RunStatusRow | RunItemRow;

/**
 * Nest one page of runs under their status, in triage order.
 *
 * Only statuses with a run on this page get a header: a header with nothing
 * under it claims a section that is not there.
 *
 * @param items - `items` from the list envelope.
 * @param groups - `groups` from the same envelope, when `group_by=status`.
 * @returns Status rows, each holding its runs in the server's order.
 */
export function buildRunRows(
  items: RunListRow[],
  groups?: Array<{ key: string | null; count: number }>,
): RunStatusRow[] {
  const byStatus = new Map<string, RunItemRow[]>();
  for (const run of items) {
    const list = byStatus.get(run.status) ?? [];
    list.push({ kind: "run", id: run.id, run });
    byStatus.set(run.status, list);
  }
  const counted = new Map((groups ?? []).map((g) => [g.key ?? "", g.count]));
  const seen = new Set(byStatus.keys());
  const ordered = [
    ...RUN_STATUS_ORDER.filter((s) => seen.has(s)),
    ...[...seen].filter((s) => !RUN_STATUS_ORDER.includes(s as Run["status"])).sort(),
  ] as Run["status"][];
  return ordered.map((status) => ({
    kind: "status",
    id: `status:${status}`,
    status,
    children: byStatus.get(status) ?? [],
    total: counted.has(status) ? counted.get(status)! : null,
  }));
}

/**
 * The server's count for one status, for the header figures.
 *
 * @param groups - `groups` from the envelope.
 * @param status - The status to read.
 * @returns The count, or 0 when the status has no group (the server only
 *   returns groups that have rows, so absence under `group_by` means none).
 */
export function statusCount(
  groups: Array<{ key: string | null; count: number }> | undefined,
  status: Run["status"],
): number {
  return groups?.find((g) => g.key === status)?.count ?? 0;
}

/**
 * Read the queue's view from a URL query string.
 *
 * Unknown attention values and clients are dropped rather than sent, so a
 * stale bookmark cannot produce a filter the API rejects.
 *
 * @param search - `window.location.search` as `URLSearchParams`.
 * @param clients - The valid agent clients.
 * @returns The view, with defaults for anything absent.
 */
export function parseRunQueueView(search: URLSearchParams, clients: readonly string[]): RunQueueView {
  const attention = (search.get("attention") ?? "")
    .split(",")
    .filter((a): a is RunAttention => (RUN_ATTENTION as readonly string[]).includes(a));
  const client = search.get("client") ?? undefined;
  const page = Number.parseInt(search.get("page") ?? "1", 10);
  return {
    q: search.get("q") ?? "",
    attention: [...new Set(attention)],
    client: client && clients.includes(client) ? (client as Run["client"]) : undefined,
    goalId: search.get("goal") || undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/**
 * Write the queue's view to a URL query string; defaults are left out so a
 * plain queue has a plain URL.
 *
 * @param view - The current view.
 * @returns A query string without the leading "?".
 */
export function serializeRunQueueView(view: RunQueueView): string {
  const out = new URLSearchParams();
  if (view.q) out.set("q", view.q);
  const attention = RUN_ATTENTION.filter((a) => view.attention.includes(a));
  if (attention.length) out.set("attention", attention.join(","));
  if (view.client) out.set("client", view.client);
  if (view.goalId) out.set("goal", view.goalId);
  if (view.page > 1) out.set("page", String(view.page));
  return out.toString();
}

/**
 * Format a 0..1 score as a whole percentage, or an em dash when unscored.
 *
 * @param score - The score, or null.
 * @returns e.g. "72%", or "—".
 */
export function formatScore(score: number | null): string {
  return score === null || !Number.isFinite(score) ? "—" : `${Math.round(score * 100)}%`;
}

/**
 * Accept a stored session link only when it is plain http(s).
 *
 * `session_url` is written by agents, so it is untrusted: a `javascript:` or
 * `data:` URL in an `href` would run in this origin when clicked.
 *
 * @param url - The stored link, or null.
 * @returns The link when its scheme is http or https, otherwise null.
 * @example
 * ```typescript
 * safeSessionUrl("https://claude.ai/chat/1"); // "https://claude.ai/chat/1"
 * safeSessionUrl("javascript:alert(1)");      // null
 * ```
 */
export function safeSessionUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}
