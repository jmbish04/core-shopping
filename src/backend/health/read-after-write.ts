/**
 * @fileoverview The read-after-write health probe (maestro 5492781d5118).
 *
 * Proves that a COMMITTED write is visible to the NEXT request's read. The
 * older `postgres_write_roundtrip` check cannot: it writes and reads inside one
 * transaction, so both statements share a session and never touch Hyperdrive's
 * query cache. It stayed green for the whole hour the Goals console served
 * month-old state (docs/decisions/2026-10-10-hyperdrive-query-caching.md).
 *
 * The probe runs three statements, each on its OWN connection:
 *
 * 1. **prime** — read the probe row. If a query cache is in front of Postgres,
 *    this puts the current value in it.
 * 2. **write** — overwrite the row with a fresh nonce, autocommitted.
 * 3. **read back** — the exact same query as step 1. A cache that does not
 *    invalidate on write answers with the primed value, and the check fails.
 *
 * The read is deliberately cacheable: plain columns, no `now()` or other
 * volatile function. A volatile read would always be fresh and the probe would
 * be the instrument that cannot fail.
 */

import { eq } from "drizzle-orm";

import type { PgDb } from "@/backend/pg/client";
import { healthProbes } from "@/backend/pg/schemas/ops/health-probes";

/** The probe's row id in `health_probes`. */
export const READ_AFTER_WRITE_PROBE_ID = "read_after_write";

/** Opens a fresh connection, runs `fn`, and closes it — `withPg` in production. */
export type OpenConnection = <T>(fn: (db: PgDb) => Promise<T>) => Promise<T>;

/** What the probe reports; the health route maps it onto a check result. */
export interface ReadAfterWriteResult {
  status: "ok" | "fail";
  message: string;
  details: { primed: string | null; wrote: string; readBack: string | null };
}

/** The one read both step 1 and step 3 run, so their SQL text is identical. */
async function readProbe(db: PgDb): Promise<string | null> {
  const rows = await db
    .select({ nonce: healthProbes.nonce })
    .from(healthProbes)
    .where(eq(healthProbes.id, READ_AFTER_WRITE_PROBE_ID))
    .limit(1);
  return rows[0]?.nonce ?? null;
}

/**
 * Run the probe.
 *
 * @param open - Opens a new connection per call; each step gets its own.
 * @param nonce - The value to write; random by default.
 * @returns `ok` only when the read-back returns exactly the value just written.
 * @throws Re-throws connection or query errors; the caller reports those as a
 *   failed check of their own.
 * @example
 * ```typescript
 * const result = await readAfterWriteProbe((fn) => withPg(env, fn));
 * ```
 */
export async function readAfterWriteProbe(
  open: OpenConnection,
  nonce: string = crypto.randomUUID(),
): Promise<ReadAfterWriteResult> {
  const primed = await open(readProbe);
  await open((db) =>
    db
      .insert(healthProbes)
      .values({ id: READ_AFTER_WRITE_PROBE_ID, nonce, writtenAt: new Date() })
      .onConflictDoUpdate({ target: healthProbes.id, set: { nonce, writtenAt: new Date() } }),
  );
  const readBack = await open(readProbe);
  const details = { primed, wrote: nonce, readBack };
  if (readBack === nonce) {
    return {
      status: "ok",
      message: "A committed write was visible to the next connection's read",
      details,
    };
  }
  return {
    status: "fail",
    message:
      readBack === primed
        ? "A committed write was NOT visible to the next read: it returned the value from before the write. A query cache (Hyperdrive caching) is answering reads."
        : "A committed write was NOT visible to the next read: it returned a value that was never written by this probe.",
    details,
  };
}
