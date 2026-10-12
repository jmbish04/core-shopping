/**
 * @fileoverview Pure row and filter logic for the Goals console
 * (maestro cs-fe-2-1).
 *
 * Split from the island so `scripts/selfcheck-goals-console.mjs` can load it
 * under plain Node: type-only imports throughout, no `.tsx`, no React. The
 * decisions worth pinning all live here —
 *
 * - **A never-run goal is not stale.** The server computes `stale` as
 *   `next_expected_at < now()`, and `next_expected_at` is null when either
 *   `last_run_at` or `expected_cadence_hours` is unknown, so a goal that has
 *   never run comes back `stale: false`. This module must not re-derive
 *   staleness from a null `last_run_at` and reach the opposite answer.
 * - **Status beats staleness.** A paused goal reads *paused*, not *stale*: it
 *   is not failing to run, it was switched off. A retired goal reads
 *   *retired* and belongs to no health tab, which is why the console keeps an
 *   "All" tab.
 * - **A group count comes from the server, not from the page.** `group_by`
 *   makes the API count the whole result set while `items` holds one page, so
 *   a category header carries both and the UI can say "12 of 40".
 */

import type { FilterQuery, GoalListRow } from "@/shared/contracts";

/** Where a goal sits in the console's health view. */
export type GoalHealth = "healthy" | "stale" | "paused" | "retired";

/** The tabs across the top of the console. "all" sends no health filter. */
export type GoalHealthTab = "all" | "healthy" | "stale" | "paused";

export const GOAL_HEALTH_TABS: readonly GoalHealthTab[] = ["all", "healthy", "stale", "paused"];

/**
 * Classify one goal for the health view.
 *
 * @param goal - A row from `GET /api/goals`.
 * @returns Its health bucket.
 * @example
 * ```typescript
 * goalHealth({ status: "active", stale: false, ... }); // "healthy"
 * goalHealth({ status: "paused", stale: true, ... });  // "paused"
 * ```
 */
export function goalHealth(goal: Pick<GoalListRow, "status" | "stale">): GoalHealth {
  if (goal.status === "retired") return "retired";
  if (goal.status === "paused") return "paused";
  return goal.stale ? "stale" : "healthy";
}

let ruleSeq = 0;

function rule(path: string, operator: string, value: unknown) {
  ruleSeq += 1;
  return { id: `health-${path}-${ruleSeq}`, type: "rule" as const, path: [path], operator, value };
}

/**
 * Build the API filter a health tab means.
 *
 * Every tab round-trips as a real `filter` tree against `GOAL_LIST_FIELDS`, so
 * the server does the filtering and the counts in the envelope are the truth
 * rather than a client-side slice of one page.
 *
 * @param tab - The selected tab.
 * @returns A filter tree, or undefined for "all".
 * @example
 * ```typescript
 * healthFilterQuery("stale"); // status is active AND stale is true
 * ```
 */
export function healthFilterQuery(tab: GoalHealthTab): FilterQuery | undefined {
  if (tab === "all") return undefined;
  const rules =
    tab === "paused"
      ? [rule("status", "is", "paused")]
      : [rule("status", "is", "active"), rule("stale", "is", tab === "stale")];
  return { id: `health-${tab}`, type: "group", combinator: "and", rules };
}

/**
 * AND a health tab's filter together with whatever the user built.
 *
 * Both are sent as one `filter`, so the server applies them together and the
 * envelope's `total` and `groups` describe the view actually on screen. The
 * result stays one level deeper than the deepest input, well inside the
 * contract's depth cap of 4.
 *
 * @param tab - The health tab's filter, from {@link healthFilterQuery}.
 * @param user - The advanced builder's query, if any.
 * @returns One query, or undefined when neither filters anything.
 */
export function mergeFilterQueries(
  tab: FilterQuery | undefined,
  user: FilterQuery | undefined,
): FilterQuery | undefined {
  const parts = [tab, user].filter((q): q is FilterQuery => Boolean(q && q.rules.length));
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return { id: "goals-view", type: "group", combinator: "and", rules: parts };
}

/** One goal under its category. */
export interface GoalItemRow {
  kind: "goal";
  id: string;
  goal: GoalListRow;
  health: GoalHealth;
  children?: undefined;
}

/** A category header, with what the server counted and what this page holds. */
export interface GoalCategoryRow {
  kind: "category";
  id: string;
  category: GoalListRow["category"];
  children: GoalItemRow[];
  /** The server's count for this category, or null when nothing grouped. */
  total: number | null;
  runs: number;
  findings: number;
  paused: number;
  stale: number;
}

export type GoalRow = GoalCategoryRow | GoalItemRow;

/** Declaration order, so the console's sections never reshuffle between loads. */
const CATEGORY_ORDER: readonly GoalListRow["category"][] = [
  "experience",
  "travel",
  "product",
  "gift",
  "deal",
  "research",
];

/**
 * Nest one page of goals under their categories.
 *
 * Only categories with a goal on this page get a header: a header with nothing
 * under it claims a section that is not there. The server's group count rides
 * along on `total` so a partially-loaded category can say so.
 *
 * @param items - `items` from the list envelope.
 * @param groups - `groups` from the same envelope, when `group_by=category`.
 * @returns Category rows in declaration order, each holding its goals.
 */
export function buildGoalRows(
  items: GoalListRow[],
  groups?: Array<{ key: string | null; count: number }>,
): GoalCategoryRow[] {
  const byCategory = new Map<string, GoalItemRow[]>();
  for (const goal of items) {
    const list = byCategory.get(goal.category) ?? [];
    list.push({ kind: "goal", id: goal.id, goal, health: goalHealth(goal) });
    byCategory.set(goal.category, list);
  }

  const counted = new Map((groups ?? []).map((g) => [g.key ?? "", g.count]));
  const seen = new Set(byCategory.keys());
  const ordered = [
    ...CATEGORY_ORDER.filter((c) => seen.has(c)),
    // A category the contract does not list still renders rather than vanishing.
    ...[...seen].filter((c) => !CATEGORY_ORDER.includes(c as GoalListRow["category"])).sort(),
  ] as GoalListRow["category"][];

  return ordered.map((category) => {
    const children = byCategory.get(category) ?? [];
    return {
      kind: "category",
      id: `category:${category}`,
      category,
      children,
      total: counted.has(category) ? counted.get(category)! : null,
      runs: children.reduce((n, c) => n + c.goal.runs_count, 0),
      findings: children.reduce((n, c) => n + c.goal.findings_count, 0),
      paused: children.filter((c) => c.health === "paused").length,
      stale: children.filter((c) => c.health === "stale").length,
    };
  });
}

/**
 * Totals across the loaded page, for the console header.
 *
 * @param rows - Category rows from {@link buildGoalRows}.
 * @returns Goal, run and finding counts, and how many are paused or stale.
 */
export function rollUpGoals(rows: GoalCategoryRow[]) {
  return rows.reduce(
    (acc, row) => ({
      goals: acc.goals + row.children.length,
      runs: acc.runs + row.runs,
      findings: acc.findings + row.findings,
      paused: acc.paused + row.paused,
      stale: acc.stale + row.stale,
    }),
    { goals: 0, runs: 0, findings: 0, paused: 0, stale: 0 },
  );
}

/** Expand every category, which is the console's default and its filtered state. */
export function expandAllCategories(rows: GoalCategoryRow[]): Record<string, boolean> {
  return Object.fromEntries(rows.map((row) => [row.id, true]));
}

/**
 * Apply a status change to the loaded page without refetching.
 *
 * Used for the optimistic switch and for its rollback, so both directions go
 * through one function and cannot drift apart.
 *
 * @param items - The current page.
 * @param id - The goal that changed.
 * @param status - Its new status.
 * @returns A new array with that goal's status replaced.
 */
export function withGoalStatus(
  items: GoalListRow[],
  id: string,
  status: GoalListRow["status"],
): GoalListRow[] {
  return items.map((goal) => (goal.id === id ? { ...goal, status } : goal));
}
