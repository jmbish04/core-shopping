/**
 * @fileoverview The one place a list endpoint is actually fetched
 * (maestro cs-fe-0-4).
 *
 * Split from `./list-query` on purpose: that module holds the pure
 * serialisation and is loaded by `scripts/selfcheck-data-layer.mjs` under plain
 * Node, which cannot parse `api.ts` (it uses a TypeScript parameter property,
 * unsupported in strip-only mode). Keeping the network call here lets the logic
 * worth testing stay testable.
 *
 * @example
 * const page = await fetchList<GoalListRow>("/api/goals", buildListParams(state));
 */

import { apiGet, qs } from "@/lib/api";
import type { ListEnvelope } from "@/lib/list-query";

/**
 * Fetch one page of a list endpoint.
 *
 * @param path - The endpoint, e.g. "/api/goals".
 * @param params - From `buildListParams`.
 * @returns The list envelope, typed to the row shape.
 * @throws {ApiError} When the request fails; callers route it through the
 *   shared frontend error handler rather than a browser alert.
 */
export async function fetchList<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<ListEnvelope<T>> {
  return apiGet<ListEnvelope<T>>(`${path}${qs(params)}`);
}
