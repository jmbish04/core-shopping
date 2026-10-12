/**
 * @fileoverview Shared API envelopes for core-shopping (maestro cs-c-01).
 *
 * The one source of truth both sides import: Hono routes build OpenAPI from
 * these schemas and the frontend client types its calls with them. Plain
 * `zod` only (no Hono, no Drizzle) so the browser bundle stays clean, and no
 * relative value imports so plain-Node self-checks can load this file.
 *
 * Conventions every resource follows:
 * - Money is integer cents plus an ISO-4217 currency code.
 * - Points are an integer amount plus a program id.
 * - Times are ISO-8601 strings with a zone; dates are YYYY-MM-DD.
 * - Lists take {@link ListQuerySchema} and return {@link listEnvelope}.
 * - Filters are the ReUI Filters `FilterQuery` tree, validated against the
 *   resource's declared field list ({@link ListFieldSpec}) — a field that is
 *   not declared is refused, never silently ignored.
 *
 * @example
 * const parsed = ListQuerySchema.parse({ page: "2", filter: JSON.stringify(tree) });
 * const errors = validateFilter(GOAL_LIST_FIELDS, parsed.filter);
 */

import { z } from "zod";

/** Integer cents plus currency. Never a float. */
export const MoneySchema = z
  .object({
    cents: z.number().int(),
    currency: z.string().length(3).toUpperCase(),
  })
  .meta({ id: "Money" });
export type Money = z.infer<typeof MoneySchema>;

/** Loyalty points: integer amount plus the program id (e.g. "chase-ur", "krisflyer"). */
export const PointsSchema = z
  .object({ amount: z.number().int().nonnegative(), program: z.string().min(1) })
  .meta({ id: "Points" });
export type Points = z.infer<typeof PointsSchema>;

/** ISO-8601 datetime with an explicit offset or Z. */
export const IsoDateTime = z.iso.datetime({ offset: true });
/** Calendar date, YYYY-MM-DD. */
export const IsoDate = z.iso.date();
/** Database ids are UUIDs. */
export const Id = z.uuid();

/** One error shape for every non-2xx answer. */
export const ErrorEnvelopeSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .meta({ id: "ErrorEnvelope" });
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

// ---------------------------------------------------------------------------
// ReUI FilterQuery tree (see the ReUI Filters "query model").
// ---------------------------------------------------------------------------

/** Field value types, matching ReUI FilterField `type`. */
export const FILTER_FIELD_TYPES = ["text", "number", "select", "multiselect", "boolean", "date"] as const;
export type FilterFieldType = (typeof FILTER_FIELD_TYPES)[number];

/**
 * Operators accepted per field type. Mirrors ReUI's built-in catalog; `date`
 * reuses the number comparisons on ISO strings.
 */
export const OPERATORS_BY_TYPE: Record<FilterFieldType, readonly string[]> = {
  text: ["contains", "not_contains", "starts_with", "ends_with", "is", "is_not", "empty", "not_empty"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "not_between", "empty", "not_empty"],
  select: ["is", "is_not", "is_any_of", "is_none_of", "empty", "not_empty"],
  multiselect: ["has_any_of", "has_all_of", "has_none_of", "empty", "not_empty"],
  boolean: ["is", "is_not", "empty", "not_empty"],
  date: ["eq", "gt", "gte", "lt", "lte", "between", "not_between", "empty", "not_empty"],
};

export interface FilterRule {
  id: string;
  type: "rule";
  path: string[];
  operator: string;
  value?: unknown;
  negated?: boolean;
}
export interface FilterGroup {
  id: string;
  type: "group";
  combinator: "and" | "or";
  rules: FilterNode[];
}
export type FilterNode = FilterRule | FilterGroup;
/** A query is always a group, never a bare array. */
export type FilterQuery = FilterGroup;

const FilterRuleSchema = z.object({
  id: z.string(),
  type: z.literal("rule"),
  path: z.array(z.string().min(1)).min(1),
  operator: z.string(),
  value: z.unknown().optional(),
  negated: z.boolean().optional(),
});

export const FilterNodeSchema: z.ZodType<FilterNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    FilterRuleSchema,
    z.object({
      id: z.string(),
      type: z.literal("group"),
      combinator: z.enum(["and", "or"]),
      rules: z.array(FilterNodeSchema),
    }),
  ]),
);

// ponytail: depth 4 and 50 rules is far past anything the builder UI produces;
// the caps exist so an unauthenticated query string cannot build a huge WHERE.
export const FILTER_MAX_DEPTH = 4;
export const FILTER_MAX_RULES = 50;

export const FilterQuerySchema = FilterNodeSchema.refine((n) => n.type === "group", {
  message: "A filter query must be a group at the root",
}).meta({ id: "FilterQuery" }) as z.ZodType<FilterQuery>;

// ---------------------------------------------------------------------------
// List query + envelope
// ---------------------------------------------------------------------------

/**
 * What a resource exposes to filtering, grouping and sorting. The server maps
 * each id to a column; the frontend turns it into ReUI `FilterField[]`.
 */
export interface ListFieldSpec {
  type: FilterFieldType;
  label: string;
  groupable?: boolean;
  sortable?: boolean;
  /** Allowed values for select / multiselect fields. */
  options?: readonly string[];
}
export type ListFields = Record<string, ListFieldSpec>;

/** Query-string list parameters. `filter` arrives as a JSON string. */
export const ListQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    filter: z
      .string()
      .max(8_000)
      .optional()
      .transform((raw, ctx) => {
        if (!raw) return undefined;
        try {
          const parsed = FilterQuerySchema.safeParse(JSON.parse(raw));
          if (parsed.success) return parsed.data;
          ctx.addIssue({ code: "custom", message: `Invalid filter: ${parsed.error.issues[0]?.message ?? "bad shape"}` });
        } catch {
          ctx.addIssue({ code: "custom", message: "filter is not valid JSON" });
        }
        return z.NEVER;
      }),
    group_by: z.string().max(64).optional(),
    /** Field id, prefixed with "-" for descending. */
    sort: z.string().max(65).optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(200).default(50),
  })
  .meta({ id: "ListQuery" });
export type ListQuery = z.infer<typeof ListQuerySchema>;

export const ListGroupSchema = z
  .object({
    key: z.string().nullable(),
    count: z.number().int().nonnegative(),
    /** Per-group sums the resource declares (e.g. price_cents). */
    subtotals: z.record(z.string(), z.number()).optional(),
  })
  .meta({ id: "ListGroup" });

/** Wrap an item schema in the shared list envelope. */
export function listEnvelope<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    page_size: z.number().int().min(1),
    groups: z.array(ListGroupSchema).optional(),
  });
}

/**
 * Check a filter tree, group_by and sort against a resource's declared fields.
 * Returns human-readable problems; an empty array means the query is allowed.
 */
export function validateListQuery(fields: ListFields, query: Pick<ListQuery, "filter" | "group_by" | "sort">): string[] {
  const problems: string[] = [];
  let rules = 0;
  const walk = (node: FilterNode, depth: number) => {
    if (depth > FILTER_MAX_DEPTH) {
      problems.push(`filter nests deeper than ${FILTER_MAX_DEPTH} levels`);
      return;
    }
    if (node.type === "group") {
      for (const child of node.rules) walk(child, depth + 1);
      return;
    }
    rules += 1;
    const id = node.path.join(".");
    const spec = fields[id];
    if (!spec) {
      problems.push(`unknown filter field "${id}"`);
      return;
    }
    if (!node.operator) return; // an unfinished rule is skipped, as ReUI does
    if (!OPERATORS_BY_TYPE[spec.type].includes(node.operator)) {
      problems.push(`operator "${node.operator}" is not valid for ${spec.type} field "${id}"`);
    }
  };
  if (query.filter) walk(query.filter, 1);
  if (rules > FILTER_MAX_RULES) problems.push(`filter has more than ${FILTER_MAX_RULES} rules`);
  if (query.group_by && !fields[query.group_by]?.groupable) {
    problems.push(`cannot group by "${query.group_by}"`);
  }
  if (query.sort) {
    const key = query.sort.replace(/^-/, "");
    if (!fields[key]?.sortable) problems.push(`cannot sort by "${key}"`);
  }
  return problems;
}
