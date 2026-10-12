/**
 * @fileoverview Bridge between a resource's declared list fields and the ReUI
 * Filters builder (maestro cs-fe-0-4).
 *
 * The server declares what is filterable once, as a {@link ListFields} map in
 * `@/shared/contracts`, and validates every incoming query against it. This
 * turns that same map into the `FilterField[]` the Filters component needs, so
 * the picker can never offer a field the API will refuse.
 *
 * Type-only imports throughout: `scripts/selfcheck-data-layer.mjs` loads this
 * with plain Node, which strips `import type` but cannot resolve `@/` aliases.
 *
 * @example
 * const fields = toFilterFields(GOAL_LIST_FIELDS);
 * <Filters fields={fields} query={query} onQueryChange={setQuery} />
 */

import type { FilterNode, FilterQuery, ListFields } from "@/shared/contracts";

/** One option in a select or multiselect field, in ReUI's shape. */
export interface FilterFieldOption {
  value: string;
  label: string;
}

/** The subset of ReUI's `FilterField` this app produces. */
export interface FilterFieldSpec {
  id: string;
  label: string;
  type?: string;
  options?: FilterFieldOption[];
  fields?: FilterFieldSpec[];
}

/** "last_run_at" -> "Last run at"; only used when a field declares no label. */
function humanize(id: string): string {
  const words = id.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Title-case an enum key for display: "in_progress" -> "In progress". */
export function optionLabel(value: string): string {
  const words = value.replace(/[-_]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Convert a declared field map into ReUI `FilterField[]`.
 *
 * A dotted id (`goal.title`) becomes a nested branch, because ReUI commits a
 * rule's `path` as an array and the server joins it back with "." to look the
 * field up — so the two representations have to agree.
 *
 * @param fields - The resource's declared list fields.
 * @returns Fields in ReUI's shape, parents first, in declaration order.
 *
 * @example
 * toFilterFields({ status: { type: "select", label: "Status", options: ["active"] } })
 * // [{ id: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }] }]
 */
export function toFilterFields(fields: ListFields): FilterFieldSpec[] {
  const roots: FilterFieldSpec[] = [];
  const branches = new Map<string, FilterFieldSpec>();

  for (const [id, spec] of Object.entries(fields)) {
    const leaf: FilterFieldSpec = {
      id: id.includes(".") ? id.slice(id.indexOf(".") + 1) : id,
      label: spec.label || humanize(id),
      type: spec.type,
    };
    if (spec.options?.length) {
      leaf.options = spec.options.map((value) => ({ value, label: optionLabel(value) }));
    }

    if (!id.includes(".")) {
      roots.push(leaf);
      continue;
    }
    const parentId = id.slice(0, id.indexOf("."));
    let parent = branches.get(parentId);
    if (!parent) {
      parent = { id: parentId, label: humanize(parentId), fields: [] };
      branches.set(parentId, parent);
      roots.push(parent);
    }
    parent.fields!.push(leaf);
  }
  return roots;
}

/** Walk every rule in a query tree, groups included. */
function* rules(node: FilterNode): Generator<Extract<FilterNode, { type: "rule" }>> {
  if (node.type === "rule") {
    yield node;
    return;
  }
  for (const child of node.rules) yield* rules(child);
}

/**
 * Count the rules a query would actually apply.
 *
 * A rule whose operator is still empty is half-built — ReUI draws it dashed and
 * `flattenFilterConditions` skips it — so it is not counted, and the badge never
 * claims a filter that is not filtering.
 *
 * @param query - The current query tree, or undefined.
 * @returns How many complete rules it holds.
 */
export function countRules(query: FilterQuery | undefined): number {
  if (!query) return 0;
  let n = 0;
  for (const rule of rules(query)) if (rule.operator) n += 1;
  return n;
}

/** True when nothing in the tree would filter anything. */
export function isEmptyQuery(query: FilterQuery | undefined): boolean {
  return countRules(query) === 0;
}

/**
 * Drop half-built rules and empty groups, so the wire only ever carries a query
 * the server can act on.
 *
 * @param query - The tree straight from the Filters component.
 * @returns A tree of complete rules, or undefined when nothing survives.
 */
export function pruneQuery(query: FilterQuery | undefined): FilterQuery | undefined {
  if (!query) return undefined;
  const walk = (node: FilterNode): FilterNode | undefined => {
    if (node.type === "rule") return node.operator ? node : undefined;
    const kept = node.rules.map(walk).filter((n): n is FilterNode => n !== undefined);
    return kept.length ? { ...node, rules: kept } : undefined;
  };
  const pruned = walk(query);
  return pruned && pruned.type === "group" ? pruned : undefined;
}
