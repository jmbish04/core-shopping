/**
 * @fileoverview Shared PostgreSQL list-query compiler and executor.
 *
 * Converts the browser-safe list contract into parameterized Drizzle SQL for
 * filtering, full-text-style search, sorting, pagination, and optional grouped
 * summaries. Routes provide an explicit field-to-column whitelist, so client
 * field ids never become SQL identifiers.
 *
 * @example
 * ```typescript
 * const result = await runList(db, {
 *   fields: GOAL_LIST_FIELDS,
 *   columns: { title: goals.title, status: goals.status },
 *   query,
 *   from: goals,
 *   fallback: asc(goals.title),
 *   searchColumns: [goals.title],
 * });
 * ```
 */

import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { PgSelect } from "drizzle-orm/pg-core/query-builders/select.types";

import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  not,
  notIlike,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { PgDb } from "@/backend/pg/client";

import {
  validateListQuery,
  type FilterNode,
  type FilterQuery,
  type FilterRule,
  type ListFields,
  type ListQuery,
} from "@/shared/contracts/common";

/** Maps every declared list field to its trusted database expression. */
export type ColumnMap<F extends ListFields> = { [K in keyof F]: AnyPgColumn | SQL };

/** A route-owned select factory used when a list reads from joins or a view. */
export type ListSelectFactory = (selection?: Record<string, AnyPgColumn | SQL>) => PgSelect;

/** Optional numeric expressions summed for every group. */
export type GroupSubtotalMap = Record<string, AnyPgColumn | SQL>;

/** Parameters accepted by {@link runList}. */
export interface RunListOptions<F extends ListFields> {
  fields: F;
  columns: ColumnMap<F>;
  query: ListQuery;
  from: PgTable | ListSelectFactory;
  fallback: SQL;
  baseWhere?: SQL;
  searchColumns?: AnyPgColumn[];
  groupSubtotals?: GroupSubtotalMap;
}

/** Shape returned by {@link runList}. */
export interface ListResult<TItem> {
  items: TItem[];
  total: number;
  page: number;
  page_size: number;
  groups?: Array<{ key: string | null; count: number; subtotals?: Record<string, number> }>;
}

/**
 * Error raised when a list query references fields or operations outside a
 * resource's declared whitelist.
 *
 * @param problems - Human-readable validation failures.
 * @returns A typed error carrying every validation problem.
 * @example
 * ```typescript
 * throw new ListQueryError(['unknown filter field "secret"']);
 * ```
 */
export class ListQueryError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(problems.join("; "));
    this.name = "ListQueryError";
    this.problems = problems;
  }
}

function escapeLike(value: unknown): string {
  return String(value ?? "").replace(/[\\%_]/g, "\\$&");
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function asRange(value: unknown): [unknown, unknown] {
  const values = asList(value);
  return [values[0], values[1]];
}

function emptyExpression(column: AnyPgColumn | SQL, text: boolean, negate: boolean): SQL {
  const comparable = column as SQL;
  if (!text) return negate ? isNotNull(comparable) : isNull(comparable);
  const expression = negate
    ? and(isNotNull(comparable), ne(comparable, ""))
    : or(isNull(comparable), eq(comparable, ""));
  return expression ?? sql`false`;
}

function compileRule(
  fieldType: ListFields[string]["type"],
  column: AnyPgColumn | SQL,
  rule: FilterRule,
): SQL {
  const { operator, value } = rule;
  const comparable = column as SQL;
  let expression: SQL;

  if (operator === "empty" || operator === "not_empty") {
    expression = emptyExpression(column, fieldType === "text", operator === "not_empty");
  } else if (fieldType === "text") {
    const escaped = escapeLike(value);
    switch (operator) {
      case "contains":
        expression = ilike(comparable, `%${escaped}%`);
        break;
      case "not_contains":
        expression = notIlike(comparable, `%${escaped}%`);
        break;
      case "starts_with":
        expression = ilike(comparable, `${escaped}%`);
        break;
      case "ends_with":
        expression = ilike(comparable, `%${escaped}`);
        break;
      case "is":
        expression = eq(comparable, value);
        break;
      default:
        expression = ne(comparable, value);
        break;
    }
  } else if (fieldType === "number" || fieldType === "date") {
    const [from, to] = asRange(value);
    switch (operator) {
      case "eq":
        expression = eq(comparable, value);
        break;
      case "neq":
        expression = ne(comparable, value);
        break;
      case "gt":
        expression = gt(comparable, value);
        break;
      case "gte":
        expression = gte(comparable, value);
        break;
      case "lt":
        expression = lt(comparable, value);
        break;
      case "lte":
        expression = lte(comparable, value);
        break;
      case "between":
        expression = and(gte(comparable, from), lte(comparable, to)) ?? sql`false`;
        break;
      default:
        expression = not(and(gte(comparable, from), lte(comparable, to)) ?? sql`false`);
        break;
    }
  } else if (fieldType === "select") {
    const values = asList(value);
    switch (operator) {
      case "is":
        expression = eq(comparable, value);
        break;
      case "is_not":
        expression = ne(comparable, value);
        break;
      case "is_any_of":
        expression = inArray(comparable, values);
        break;
      default:
        expression = notInArray(comparable, values);
        break;
    }
  } else if (fieldType === "multiselect") {
    const values = asList(value);
    const parameter = sql.param(values, column as AnyPgColumn);
    switch (operator) {
      case "has_any_of":
        expression = sql`${column} && ${parameter}`;
        break;
      case "has_all_of":
        expression = sql`${column} @> ${parameter}`;
        break;
      default:
        expression = not(sql`${column} && ${parameter}`);
        break;
    }
  } else {
    expression = operator === "is" ? eq(comparable, value) : ne(comparable, value);
  }

  return rule.negated ? not(expression) : expression;
}

function compileNode<F extends ListFields>(
  fields: F,
  columns: ColumnMap<F>,
  node: FilterNode,
): SQL | undefined {
  if (node.type === "rule") {
    if (!node.operator) return undefined;
    const key = node.path.join(".") as keyof F;
    return compileRule(fields[key].type, columns[key], node);
  }

  const expressions = node.rules
    .map((child) => compileNode(fields, columns, child))
    .filter((value): value is SQL => value !== undefined);
  if (expressions.length === 0) return undefined;
  return node.combinator === "and" ? and(...expressions) : or(...expressions);
}

function assertValid(
  fields: ListFields,
  query: Partial<Pick<ListQuery, "filter" | "group_by" | "sort">>,
): void {
  const problems = validateListQuery(fields, {
    filter: query.filter,
    group_by: query.group_by,
    sort: query.sort,
  });
  if (problems.length > 0) throw new ListQueryError(problems);
}

/**
 * Compile a ReUI filter tree into parameterized Drizzle SQL.
 *
 * @param fields - Resource field declarations and operator types.
 * @param columns - Trusted SQL expressions keyed by field id.
 * @param filter - Optional ReUI filter tree.
 * @returns The WHERE expression, or undefined for no completed rules.
 * @throws {@link ListQueryError} when a rule is not allowed by the field declaration.
 * @example
 * ```typescript
 * const where = compileFilter(FIELDS, COLUMNS, filter);
 * ```
 */
export function compileFilter<F extends ListFields>(
  fields: F,
  columns: ColumnMap<F>,
  filter?: FilterQuery,
): SQL | undefined {
  assertValid(fields, { filter });
  return filter ? compileNode(fields, columns, filter) : undefined;
}

/**
 * Compile a whitelisted sort, falling back to the route's stable ordering.
 *
 * @param fields - Resource field declarations.
 * @param columns - Trusted SQL expressions keyed by field id.
 * @param sort - Optional field id, with a leading dash for descending order.
 * @param fallback - Stable ordering used when sort is absent.
 * @returns Drizzle ORDER BY expressions.
 * @throws {@link ListQueryError} when the sort field is not declared sortable.
 * @example
 * ```typescript
 * const order = compileSort(FIELDS, COLUMNS, "-created_at", asc(table.id));
 * ```
 */
export function compileSort<F extends ListFields>(
  fields: F,
  columns: ColumnMap<F>,
  sort: string | undefined,
  fallback: SQL,
): SQL[] {
  assertValid(fields, { sort });
  if (!sort) return [fallback];
  const descending = sort.startsWith("-");
  const key = (descending ? sort.slice(1) : sort) as keyof F;
  return [descending ? desc(columns[key]) : asc(columns[key]), fallback];
}

/**
 * Convert one-based list pagination into SQL limit and offset values.
 *
 * @param query - Parsed shared list query.
 * @returns The bounded limit and zero-based offset.
 * @example
 * ```typescript
 * compilePage({ page: 3, page_size: 25 }); // { limit: 25, offset: 50 }
 * ```
 */
export function compilePage(query: Pick<ListQuery, "page" | "page_size">): {
  limit: number;
  offset: number;
} {
  return { limit: query.page_size, offset: (query.page - 1) * query.page_size };
}

/**
 * Compile escaped case-insensitive search across an explicit column list.
 *
 * @param columns - Text columns included in search.
 * @param q - Optional user search text.
 * @returns An OR-ed ILIKE expression, or undefined when search is empty.
 * @example
 * ```typescript
 * const search = compileSearch([goals.title], "50% off");
 * ```
 */
export function compileSearch(columns: AnyPgColumn[], q?: string): SQL | undefined {
  if (!q || columns.length === 0) return undefined;
  const pattern = `%${escapeLike(q)}%`;
  return or(...columns.map((column) => ilike(column, pattern)));
}

function combineWhere(...expressions: Array<SQL | undefined>): SQL | undefined {
  const present = expressions.filter((value): value is SQL => value !== undefined);
  if (present.length === 0) return undefined;
  return and(...present);
}

function makeSelect(
  db: PgDb,
  source: PgTable | ListSelectFactory,
  selection?: Record<string, AnyPgColumn | SQL>,
): PgSelect {
  if (typeof source === "function") return source(selection).$dynamic();
  return (
    selection ? db.select(selection).from(source) : db.select().from(source)
  ).$dynamic() as PgSelect;
}

/**
 * Execute a validated list query, its total count, and optional group summaries.
 *
 * @param db - Request-scoped node-postgres Drizzle database.
 * @param options - Field whitelist, source, query, ordering, and summary configuration.
 * @returns The shared list envelope with rows, total, pagination, and optional groups.
 * @throws {@link ListQueryError} when filter, group, or sort input violates the field declaration.
 * @example
 * ```typescript
 * const page = await runList<GoalRow>(db, {
 *   fields: GOAL_LIST_FIELDS,
 *   columns,
 *   query,
 *   from: goals,
 *   fallback: asc(goals.id),
 * });
 * ```
 */
export async function runList<TItem, F extends ListFields = ListFields>(
  db: PgDb,
  options: RunListOptions<F>,
): Promise<ListResult<TItem>> {
  const { fields, columns, query } = options;
  assertValid(fields, query);

  const where = combineWhere(
    options.baseWhere,
    compileFilter(fields, columns, query.filter),
    compileSearch(options.searchColumns ?? [], query.q),
  );
  const order = compileSort(fields, columns, query.sort, options.fallback);
  const { limit, offset } = compilePage(query);

  let itemsQuery = makeSelect(db, options.from);
  if (where) itemsQuery = itemsQuery.where(where);
  const itemsPromise = itemsQuery
    .orderBy(...order)
    .limit(limit)
    .offset(offset) as Promise<TItem[]>;

  let totalQuery = makeSelect(db, options.from, { count: sql<number>`count(*)` });
  if (where) totalQuery = totalQuery.where(where);
  const totalPromise = Promise.resolve(totalQuery).then((rows) =>
    rows.map((row) => ({ count: row.count as number | string })),
  );

  let groupsPromise: Promise<Array<Record<string, unknown>>> | undefined;
  if (query.group_by) {
    const groupColumn = columns[query.group_by];
    const selection: Record<string, AnyPgColumn | SQL> = {
      key: groupColumn,
      count: sql<number>`count(*)`,
    };
    for (const [name, expression] of Object.entries(options.groupSubtotals ?? {})) {
      selection[name] = sql<number>`coalesce(sum(${expression}), 0)`;
    }
    let groupsQuery = makeSelect(db, options.from, selection);
    if (where) groupsQuery = groupsQuery.where(where);
    groupsPromise = groupsQuery.groupBy(groupColumn).orderBy(asc(groupColumn)) as Promise<
      Array<Record<string, unknown>>
    >;
  }

  const [items, totalRows, groupRows] = await Promise.all([
    itemsPromise,
    totalPromise,
    groupsPromise,
  ]);
  const groups = groupRows?.map((row) => {
    const subtotals = Object.fromEntries(
      Object.keys(options.groupSubtotals ?? {}).map((name) => [name, Number(row[name])]),
    );
    return {
      key: row.key == null ? null : String(row.key),
      count: Number(row.count),
      ...(Object.keys(subtotals).length > 0 ? { subtotals } : {}),
    };
  });

  return {
    items,
    total: Number(totalRows[0]?.count ?? 0),
    page: query.page,
    page_size: query.page_size,
    ...(groups ? { groups } : {}),
  };
}
