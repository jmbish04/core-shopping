/**
 * @fileoverview Is the Postgres schema as new as the deployed code? (cs-be-0-5)
 *
 * Workers Builds cannot reach the LAN database, so a CI deploy can ship code
 * ahead of its migrations. The health program compares the newest migration
 * bundled with this build (drizzle-pg/meta/_journal.json `when`) against the
 * newest one recorded in drizzle.__drizzle_migrations (`created_at`, which the
 * Drizzle migrator sets to that same `when`). Pure, so a plain-Node self-check
 * can pin it.
 */

export type LedgerVerdict = { status: "ok" | "fail"; message: string };

/**
 * @param expectedWhen - Newest `when` in the bundled journal.
 * @param appliedWhen - Newest `created_at` in the database ledger, or null if empty.
 * @returns ok when the database has at least the bundled migration.
 */
export function ledgerVerdict(expectedWhen: number, appliedWhen: number | null): LedgerVerdict {
  if (appliedWhen == null) {
    return { status: "fail", message: "No migrations applied to core_shopping. Run pnpm run migrate:pg from the LAN." };
  }
  if (appliedWhen < expectedWhen) {
    return {
      status: "fail",
      message: `core_shopping is behind this build (applied ${new Date(appliedWhen).toISOString()}, expected ${new Date(expectedWhen).toISOString()}). Run pnpm run migrate:pg.`,
    };
  }
  return { status: "ok", message: "core_shopping migrations match this build" };
}

/** Newest `when` in a Drizzle journal. */
export function newestJournalWhen(journal: { entries: Array<{ when: number }> }): number {
  return journal.entries.reduce((max, e) => Math.max(max, e.when), 0);
}
