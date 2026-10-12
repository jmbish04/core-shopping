/**
 * @fileoverview Turn list-screen UI state into the wire query and back
 * (maestro cs-fe-0-4).
 *
 * Every list endpoint takes the same envelope — `q`, `filter` (a ReUI
 * FilterQuery tree as JSON), `group_by`, `sort`, `page`, `page_size` — and
 * answers `{ items, total, page, page_size, groups? }`. This module is the one
 * place that serialises it, so a grid, a URL and a fetch cannot disagree.
 *
 * Round-tripping through `URLSearchParams` is deliberate: a filtered, grouped
 * view is then a pasteable link.
 *
 * `fetchList` lives in `./list-fetch` because this module must stay loadable
 * by plain Node for scripts/selfcheck-data-layer.mjs, and `api.ts` uses a
 * TypeScript parameter property that strip-only mode rejects.
 *
 * @example
 * const params = buildListParams({ q, filter: query, sort: "-last_run_at", page });
 */

import { pruneQuery } from "@/lib/filters";
import type { FilterQuery } from "@/shared/contracts";

/** List-screen state, all optional so a bare call still works. */
export interface ListState {
  q?: string;
  filter?: FilterQuery;
  group_by?: string;
  /** Field id, prefixed with "-" for descending. */
  sort?: string;
  page?: number;
  page_size?: number;
}

/** What every list endpoint returns. Mirrors `listEnvelope` in the contracts. */
export interface ListEnvelope<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  groups?: Array<{ key: string | null; count: number; subtotals?: Record<string, number> }>;
}

export const DEFAULT_PAGE_SIZE = 50;

/**
 * Serialise list state into query-string parameters.
 *
 * The filter is pruned first: an unfinished rule is dropped rather than sent,
 * because the server would refuse the whole query over one rule the user has
 * not finished picking. An empty value is omitted entirely, so the URL stays
 * short and the default page never appears in it.
 *
 * @param state - Current UI state.
 * @returns Parameters ready for {@link qs}.
 *
 * @example
 * buildListParams({ page: 1 });                  // {} — defaults stay implicit
 * buildListParams({ q: " adele " });             // { q: "adele" }
 */
export function buildListParams(state: ListState = {}): Record<string, string> {
  const params: Record<string, string> = {};
  const q = state.q?.trim();
  if (q) params.q = q;

  const filter = pruneQuery(state.filter);
  if (filter) params.filter = JSON.stringify(filter);

  if (state.group_by) params.group_by = state.group_by;
  if (state.sort) params.sort = state.sort;
  if (state.page && state.page > 1) params.page = String(state.page);
  if (state.page_size && state.page_size !== DEFAULT_PAGE_SIZE) {
    params.page_size = String(state.page_size);
  }
  return params;
}

/**
 * Read list state back out of a URL.
 *
 * A `filter` that is not valid JSON is dropped rather than thrown: a mangled
 * pasted link should show an unfiltered list, not an error page.
 *
 * @param search - The URL's search params.
 * @returns The state those params describe.
 */
export function parseListParams(search: URLSearchParams): ListState {
  const state: ListState = {};
  const q = search.get("q");
  if (q) state.q = q;

  const raw = search.get("filter");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as FilterQuery;
      if (parsed && parsed.type === "group" && Array.isArray(parsed.rules)) state.filter = parsed;
    } catch {
      // A broken link filters nothing rather than failing the screen.
    }
  }

  const groupBy = search.get("group_by");
  if (groupBy) state.group_by = groupBy;
  const sort = search.get("sort");
  if (sort) state.sort = sort;

  const page = Number(search.get("page"));
  state.page = Number.isInteger(page) && page > 1 ? page : 1;
  const size = Number(search.get("page_size"));
  state.page_size = Number.isInteger(size) && size > 0 ? size : DEFAULT_PAGE_SIZE;
  return state;
}

/** Split a `sort` value into its field and direction. */
export function parseSort(sort: string | undefined): { field: string; desc: boolean } | null {
  if (!sort) return null;
  return sort.startsWith("-") ? { field: sort.slice(1), desc: true } : { field: sort, desc: false };
}

/** Build a `sort` value from a field and direction. */
export function toSort(field: string, desc: boolean): string {
  return desc ? `-${field}` : field;
}
