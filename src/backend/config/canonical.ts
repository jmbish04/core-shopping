/**
 * @fileoverview Turning the configuration tables into one canonical string
 * (maestro cs-gap-config-asof).
 *
 * Pure, with NO value imports, so `scripts/selfcheck-config-snapshot.mjs` can
 * drive every branch without a database. The hashing itself is in
 * `pg/queries/config-snapshot.ts`, which needs `crypto`.
 *
 * **The hash is over the MEANING of the configuration, not its bytes.** Two
 * decisions follow, and both are load-bearing:
 *
 * - **Row order must not matter.** Postgres returns rows in whatever order it
 *   likes unless told otherwise, so the same configuration read twice would
 *   hash differently and every read would mint a new snapshot. Rows are sorted
 *   by their id and object keys are sorted, so the string is a function of the
 *   content alone.
 * - **`created_at` and `updated_at` are excluded.** They change on every write
 *   without changing what the configuration SAYS. Including them would make
 *   "I retyped the same hotel rule" a different configuration, which would
 *   make a past proposal look as though it had been judged against something
 *   else. The whole point of the table is that a day of unchanged config costs
 *   one row.
 *
 * Nothing else is excluded. A loyalty balance that moved IS a change, because
 * a verdict about whether a seat was affordable depended on it.
 */

/** The tables a snapshot covers, in a fixed order. */
export const SNAPSHOT_TABLES = [
  "preferences",
  "people",
  "hotel_brand_rules",
  "loyalty_programs",
  "loyalty_accounts",
  "transfer_partners",
  "travel_windows",
  "home_airports",
  "taste_artists",
  "taste_genres",
  "venue_stances",
  "wishlist_items",
  "occasions",
  "goal_occasions",
] as const;
export type SnapshotTable = (typeof SNAPSHOT_TABLES)[number];

/**
 * Columns dropped from every table before hashing.
 *
 * These move on every write without changing what the configuration says. A
 * snapshot that counted them would never dedupe, and the claim that "a day of
 * unchanged config costs one row" would be false.
 *
 * **Both spellings are listed on purpose.** Drizzle returns a row keyed by its
 * TypeScript property names, so `created_at` arrives as `createdAt`. The first
 * version of this list held only the snake_case names, which matched nothing
 * at all: the exclusion was dead code, every snapshot carried its timestamps,
 * and touching any row would have minted a new snapshot. Measured 2026-10-25
 * by planting the removal of this filter and watching the check stay GREEN.
 */
export const VOLATILE_COLUMNS = ["created_at", "updated_at", "createdAt", "updatedAt"] as const;

/** The rows of each snapshot table, keyed by table name. */
export type SnapshotPayload = Partial<Record<SnapshotTable, Array<Record<string, unknown>>>>;

/**
 * A single row's sort key: its id, or the composite key of a link table.
 *
 * `goal_occasions` has no `id` column — it is keyed by the pair — so falling
 * back to a sorted rendering of the whole row keeps the order stable for it
 * too, rather than leaving one table's order up to Postgres.
 */
function rowKey(row: Record<string, unknown>): string {
  if (typeof row.id === "string") return `id:${row.id}`;
  const parts = Object.keys(row)
    .sort()
    .map((key) => `${key}=${JSON.stringify(row[key] ?? null)}`);
  return `row:${parts.join("|")}`;
}

/**
 * Drop the volatile columns and sort the remaining keys.
 *
 * @param row - A row as the database returned it.
 * @returns The row with volatile columns removed and keys in sorted order.
 */
function canonicalRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row).sort()) {
    if ((VOLATILE_COLUMNS as readonly string[]).includes(key)) continue;
    const value = row[key];
    // A Date reaches here from a timestamp column that is NOT volatile, such
    // as a loyalty balance's read date. ISO so the string is stable.
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

/**
 * Render a payload as one canonical string, ready to hash.
 *
 * The same configuration always produces the same string, whatever order the
 * database returned its rows in and whatever order the object keys arrived in.
 *
 * @param payload - Rows keyed by table name.
 * @returns A stable string: a function of the content and nothing else.
 * @example
 * ```typescript
 * canonicalString({ people: [{ id: "b", slug: "y" }, { id: "a", slug: "x" }] })
 *   === canonicalString({ people: [{ slug: "x", id: "a" }, { slug: "y", id: "b" }] });
 * // true
 * ```
 */
export function canonicalString(payload: SnapshotPayload): string {
  const lines: string[] = [];
  for (const table of SNAPSHOT_TABLES) {
    const rows = payload[table] ?? [];
    const canonical = rows
      .map((row) => ({ key: rowKey(row), row: canonicalRow(row) }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((entry) => JSON.stringify(entry.row));
    lines.push(`${table}:${canonical.length}`);
    for (const row of canonical) lines.push(row);
  }
  return lines.join("\n");
}

/**
 * The payload as it is stored, with volatile columns already dropped.
 *
 * Stored canonically rather than raw so a reader of a past snapshot sees
 * exactly what was hashed, and so two snapshots can be compared field by field
 * without one of them carrying timestamps the other does not.
 *
 * @param payload - Rows keyed by table name.
 * @returns The same shape, canonicalised and ordered.
 */
export function canonicalPayload(payload: SnapshotPayload): SnapshotPayload {
  const out: SnapshotPayload = {};
  for (const table of SNAPSHOT_TABLES) {
    const rows = payload[table] ?? [];
    out[table] = rows
      .map((row) => ({ key: rowKey(row), row: canonicalRow(row) }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((entry) => entry.row);
  }
  return out;
}

/** One field-level difference between two snapshots. */
export interface SnapshotDiffEntry {
  table: string;
  /** The row's id, or its composite key for a link table. */
  row: string;
  change: "added" | "removed" | "changed";
  /** Only for `changed`: the fields that differ, with both values. */
  fields?: Array<{ field: string; before: unknown; after: unknown }>;
}

/**
 * Compare two snapshot payloads, field by field.
 *
 * This is what makes "the settings at the time, diffed against now" a real
 * answer rather than two JSON blobs side by side. A verdict explained by a
 * rule since changed is explainable again.
 *
 * @param before - The stored snapshot's payload.
 * @param after - The current configuration's payload.
 * @returns Every difference, table order fixed and rows in key order.
 * @example
 * ```typescript
 * diffSnapshots(stored, current);
 * // [{ table: "hotel_brand_rules", row: "id:…", change: "changed",
 * //    fields: [{ field: "stance", before: "avoid", after: "prefer" }] }]
 * ```
 */
export function diffSnapshots(before: SnapshotPayload, after: SnapshotPayload): SnapshotDiffEntry[] {
  const out: SnapshotDiffEntry[] = [];
  for (const table of SNAPSHOT_TABLES) {
    const beforeRows = new Map(
      (before[table] ?? []).map((row) => [rowKey(row), canonicalRow(row)] as const),
    );
    const afterRows = new Map(
      (after[table] ?? []).map((row) => [rowKey(row), canonicalRow(row)] as const),
    );
    const keys = [...new Set([...beforeRows.keys(), ...afterRows.keys()])].sort();

    for (const key of keys) {
      const was = beforeRows.get(key);
      const now = afterRows.get(key);
      if (was && !now) {
        out.push({ table, row: key, change: "removed" });
        continue;
      }
      if (!was && now) {
        out.push({ table, row: key, change: "added" });
        continue;
      }
      if (!was || !now) continue;
      const fields = [...new Set([...Object.keys(was), ...Object.keys(now)])]
        .sort()
        .filter((field) => JSON.stringify(was[field]) !== JSON.stringify(now[field]))
        .map((field) => ({ field, before: was[field] ?? null, after: now[field] ?? null }));
      if (fields.length > 0) out.push({ table, row: key, change: "changed", fields });
    }
  }
  return out;
}
