/**
 * @fileoverview Which goals an occasion makes due, and when
 * (maestro cs-gap-occasion-calendar).
 *
 * The split here is deliberate: **SQL fetches the rows, the tested pure
 * function decides.** `occasions/schedule.ts` already holds the date
 * arithmetic — recurring windows, windows that cross the new year, the leap
 * day, the lead — with twenty assertions and nine planted regressions behind
 * it. Writing that arithmetic again in SQL would be two definitions of "due"
 * that can disagree, and the SQL copy would be the one nobody could test
 * without a database.
 *
 * `cs-be-7-1`'s cron and the Overview are both callers. Neither owns the rule.
 */

import { eq, inArray, sql } from "drizzle-orm";

import type { PgDb } from "@/backend/pg/client";
import { goalOccasions, occasions } from "@/backend/pg/schemas/config/occasions";
import { goals } from "@/backend/pg/schemas/goals/goals";
import { soonestDue, type OccasionDue, type OccasionLike } from "@/backend/occasions/schedule";

/** A goal and what its occasions say about being due. */
export interface GoalOccasionVerdict {
  goal_id: string;
  slug: string;
  title: string;
  status: string;
  /**
   * The governing occasion, or null when the goal has no active linked
   * occasion. Null is NOT "not due": the cadence detector is another reason a
   * goal can be due, so a caller must be able to tell "this rule has nothing
   * to say" from "this rule says no".
   */
  due: OccasionDue | null;
}

function toOccasionLike(row: {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  recursYearly: boolean;
  leadDays: number;
  isActive: boolean;
  leadDaysOverride: number | null;
}): OccasionLike {
  return {
    id: row.id,
    label: row.label,
    starts_on: String(row.startsOn),
    ends_on: String(row.endsOn),
    recurs_yearly: row.recursYearly,
    lead_days: Number(row.leadDays),
    is_active: row.isActive,
    lead_days_override: row.leadDaysOverride == null ? null : Number(row.leadDaysOverride),
  };
}

/**
 * Every goal that has at least one linked occasion, with its verdict.
 *
 * Only `active` goals by default: a paused or retired goal becoming "due"
 * because Prime Day is coming would put work on the board that nobody asked
 * for.
 *
 * @param db - A Drizzle client from `withPg`, or a transaction.
 * @param asOf - The date being asked about, `YYYY-MM-DD`.
 * @param options - `statuses` to widen beyond active, `onlyDue` to filter.
 * @returns One row per goal with a linked occasion, soonest-due first.
 * @example
 * ```typescript
 * // What cs-be-7-1's cron would wake.
 * const due = await goalsDueByOccasion(db, "2027-06-17", { onlyDue: true });
 * ```
 */
export async function goalsDueByOccasion(
  db: PgDb,
  asOf: string,
  options: { statuses?: readonly string[]; onlyDue?: boolean } = {},
): Promise<GoalOccasionVerdict[]> {
  const statuses = options.statuses ?? ["active"];

  const rows = await db
    .select({
      goalId: goals.id,
      slug: goals.slug,
      title: goals.title,
      status: goals.status,
      id: occasions.id,
      label: occasions.label,
      startsOn: occasions.startsOn,
      endsOn: occasions.endsOn,
      recursYearly: occasions.recursYearly,
      leadDays: occasions.leadDays,
      isActive: occasions.isActive,
      leadDaysOverride: goalOccasions.leadDaysOverride,
    })
    .from(goalOccasions)
    .innerJoin(occasions, eq(occasions.id, goalOccasions.occasionId))
    .innerJoin(goals, eq(goals.id, goalOccasions.goalId))
    .where(inArray(goals.status, statuses as ("active" | "paused" | "retired")[]));

  /** One entry per goal, so a goal with four links is decided once. */
  const byGoal = new Map<string, { row: (typeof rows)[number]; links: OccasionLike[] }>();
  for (const row of rows) {
    const existing = byGoal.get(row.goalId);
    if (existing) existing.links.push(toOccasionLike(row));
    else byGoal.set(row.goalId, { row, links: [toOccasionLike(row)] });
  }

  const verdicts: GoalOccasionVerdict[] = [...byGoal.values()].map(({ row, links }) => ({
    goal_id: row.goalId,
    slug: row.slug,
    title: row.title,
    status: row.status,
    due: soonestDue(links, asOf),
  }));

  const filtered = options.onlyDue ? verdicts.filter((v) => v.due?.is_due) : verdicts;

  // Due first, then by due date, then by title so the order is stable.
  return filtered.sort((a, b) => {
    const aDue = a.due?.is_due ? 0 : 1;
    const bDue = b.due?.is_due ? 0 : 1;
    if (aDue !== bDue) return aDue - bDue;
    const aOn = a.due?.due_on ?? "9999-12-31";
    const bOn = b.due?.due_on ?? "9999-12-31";
    if (aOn !== bOn) return aOn < bOn ? -1 : 1;
    return a.title < b.title ? -1 : 1;
  });
}

/**
 * The occasions one goal is linked to, with each one's own verdict.
 *
 * Every link is returned, not only the governing one, because a goal viewport
 * showing "due because of Prime Day" should also show that a birthday is three
 * weeks behind it.
 *
 * @param db - A Drizzle client or transaction.
 * @param goalId - The goal.
 * @param asOf - The date being asked about.
 * @returns One entry per link, soonest first; an inactive or closed occasion
 *   is returned with a null verdict rather than dropped, so a surface can say
 *   it is linked but silent.
 */
export async function occasionsForGoal(
  db: PgDb,
  goalId: string,
  asOf: string,
): Promise<Array<{ occasion_id: string; label: string; kind: string; lead_days_override: number | null; due: OccasionDue | null }>> {
  const rows = await db
    .select({
      id: occasions.id,
      label: occasions.label,
      kind: occasions.kind,
      startsOn: occasions.startsOn,
      endsOn: occasions.endsOn,
      recursYearly: occasions.recursYearly,
      leadDays: occasions.leadDays,
      isActive: occasions.isActive,
      leadDaysOverride: goalOccasions.leadDaysOverride,
    })
    .from(goalOccasions)
    .innerJoin(occasions, eq(occasions.id, goalOccasions.occasionId))
    .where(eq(goalOccasions.goalId, goalId))
    .orderBy(sql`${occasions.startsOn} asc`);

  return rows
    .map((row) => ({
      occasion_id: row.id,
      label: row.label,
      kind: row.kind,
      lead_days_override: row.leadDaysOverride == null ? null : Number(row.leadDaysOverride),
      due: soonestDue([toOccasionLike(row)], asOf),
    }))
    .sort((a, b) => {
      const aOn = a.due?.due_on ?? "9999-12-31";
      const bOn = b.due?.due_on ?? "9999-12-31";
      if (aOn !== bOn) return aOn < bOn ? -1 : 1;
      return a.label < b.label ? -1 : 1;
    });
}

/**
 * Replace the set of occasions a goal is linked to, in one transaction.
 *
 * Replace rather than merge, because this is a settings surface showing the
 * whole list — and unlike the config bulk save there is no partial-list risk,
 * since a link carries no data of its own beyond the override.
 *
 * @param tx - An open transaction. This function never opens its own.
 * @param goalId - The goal.
 * @param links - The occasions to link, with optional per-link leads.
 * @returns How many links were written and removed.
 * @throws {Error} When an occasion id does not exist, rather than storing an orphan.
 */
export async function setGoalOccasions(
  tx: PgDb,
  goalId: string,
  links: ReadonlyArray<{ occasion_id: string; lead_days_override?: number | null }>,
): Promise<{ linked: number; removed: number }> {
  const ids = links.map((link) => link.occasion_id);
  if (ids.length > 0) {
    const found = await tx
      .select({ id: occasions.id })
      .from(occasions)
      .where(inArray(occasions.id, ids));
    const known = new Set(found.map((row) => row.id));
    const missing = ids.filter((id) => !known.has(id));
    if (missing.length > 0) throw new Error(`No such occasion: ${missing.join(", ")}`);
  }

  const removed = await tx
    .delete(goalOccasions)
    .where(eq(goalOccasions.goalId, goalId))
    .returning({ goalId: goalOccasions.goalId });

  if (links.length > 0) {
    await tx.insert(goalOccasions).values(
      links.map((link) => ({
        goalId,
        occasionId: link.occasion_id,
        leadDaysOverride: link.lead_days_override ?? null,
      })),
    );
  }

  return { linked: links.length, removed: removed.length };
}
