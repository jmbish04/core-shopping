/**
 * @fileoverview The one question `trip_history` exists to answer: how long has
 * it been since the last trip (maestro cs-be-1-6).
 *
 * `calendar_checks.days_since_last_trip` has been a nullable column with no
 * writer since cs-be-1-4. This is its source, and it is the only way to
 * evaluate the brief's gate: "we have not just returned from a trip or time
 * off .. enough time has passed since our last vacation or trip or time off
 * that it would be appropriate to take more time off for the dates targeted".
 *
 * Two things the shape of this function is deliberate about:
 *
 * - **A household clock and a person's clock are different.** A trip with a
 *   null `person_id` is one the household took together and resets everyone's
 *   clock. A trip with a `person_id` is one person's — Jason flying home to
 *   Singapore alone does not reset Justin's. So the household query reads only
 *   the null rows, and a person's query reads the null rows plus their own.
 * - **A trip that ended today counts, and counts as zero days.** The bound is
 *   `ended_on <= as_of`, not `<`. With a strict `<` a household that landed
 *   this morning would be told its last trip was the one before, which is the
 *   exact case the gate exists to catch. A trip ending after `as_of` is in the
 *   future and is never an answer to "how long since".
 * - **No trip on record is not "zero days ago", and it is not a pass either.**
 *   It returns `days: null` with a stated `reason`, so a caller cannot read an
 *   empty table as "we just got back" (which would block every proposal) or
 *   silently treat it as "ages ago" (which would wave every proposal through).
 *   Deciding what an empty history means is the caller's call, made explicitly.
 */

import { and, desc, isNull, lte, or, sql, type SQL } from "drizzle-orm";

import type { PgDb } from "@/backend/pg/client";
import { tripHistory } from "@/backend/pg/schemas/config/travel";

/** Why `days` is null, when it is. */
export type NoTripReason = "no_trip_on_record";

/** The most recent trip before a date, and how long ago it ended. */
export interface DaysSinceLastTrip {
  /** Whole days between the trip's `ended_on` and `as_of`. Null when unknown. */
  days: number | null;
  /** The trip the answer came from, or null when there is none. */
  last_trip: {
    id: string;
    label: string;
    destination: string;
    started_on: string;
    ended_on: string;
    kind: string;
    person_id: string | null;
  } | null;
  /** Set only when `days` is null; states what is missing rather than guessing. */
  reason?: NoTripReason;
}

/**
 * Find the most recent trip that ended before a date, and the days since.
 *
 * Every `kind` counts, including `work`: the brief's wording is "our last
 * vacation or trip or time off", and a fortnight in an office abroad is still
 * a fortnight away from home.
 *
 * @param db - A Drizzle client from `withPg`, or a transaction.
 * @param options - `as_of` as YYYY-MM-DD, and whose clock to read.
 * @returns The days since the last trip, the trip it came from, or nulls with a reason.
 * @example
 * ```typescript
 * // The household's clock as of today.
 * await daysSinceLastTrip(db, { asOf: "2026-10-25" });
 * // Justin's clock, which also counts trips the household took together.
 * await daysSinceLastTrip(db, { asOf: "2026-10-25", personId: justinId });
 * ```
 */
export async function daysSinceLastTrip(
  db: PgDb,
  options: { asOf: string; personId?: string | null },
): Promise<DaysSinceLastTrip> {
  const { asOf, personId } = options;

  /**
   * A household trip (null `person_id`) always counts. A person's own trip
   * counts only for that person — never for the household, and never for the
   * other person.
   */
  const whose: SQL = personId
    ? or(isNull(tripHistory.personId), sql`${tripHistory.personId} = ${personId}`)!
    : isNull(tripHistory.personId);

  const [row] = await db
    .select({
      id: tripHistory.id,
      label: tripHistory.label,
      destination: tripHistory.destination,
      startedOn: tripHistory.startedOn,
      endedOn: tripHistory.endedOn,
      kind: tripHistory.kind,
      personId: tripHistory.personId,
      days: sql<number>`(${asOf}::date - ${tripHistory.endedOn})::int`,
    })
    .from(tripHistory)
    .where(and(whose, lte(tripHistory.endedOn, asOf)))
    .orderBy(desc(tripHistory.endedOn))
    .limit(1);

  if (!row) return { days: null, last_trip: null, reason: "no_trip_on_record" };

  return {
    days: Number(row.days),
    last_trip: {
      id: row.id,
      label: row.label,
      destination: row.destination,
      started_on: String(row.startedOn),
      ended_on: String(row.endedOn),
      kind: row.kind,
      person_id: row.personId,
    },
  };
}
