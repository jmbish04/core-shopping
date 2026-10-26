/**
 * @fileoverview The idea bank's three operations (maestro cs-gap-idea-bank):
 * what a briefing gets, recording an idea when a proposal is declined, and
 * promoting one into a goal.
 *
 * The task's "done when" is both halves of the loop: "declining a dated
 * proposal can record an idea, and the next briefing for that category returns
 * it". `recordIdeaFromDecline` is the first half and `ideasForBriefing` is the
 * second, so the loop closes without either side guessing at the other's shape.
 *
 * `cs-be-3-2`'s briefing tool does not exist yet, so the slice is the function
 * it will compose — the same shape as `wishlistForBriefing` and
 * `daysSinceLastTrip`, and for the same reason.
 */

import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import type { PgDb } from "@/backend/pg/client";
import { ideaEntities, ideas } from "@/backend/pg/schemas/hitl/ideas";
import { entities } from "@/backend/pg/schemas/catalog/entities";
import { goals } from "@/backend/pg/schemas/goals/goals";
import { proposals } from "@/backend/pg/schemas/proposals/proposals";
import { nextOccurrence } from "@/backend/occasions/schedule";
import type { GoalCategory } from "@/shared/contracts/goals";

/** An idea as a briefing or `/brain` states it. */
export interface BriefingIdea {
  id: string;
  title: string;
  category: string;
  rationale: string;
  target_month_start: number | null;
  target_month_end: number | null;
  /** The season in words, e.g. "late October" becomes "October". Null when none. */
  season: string | null;
  confidence: number;
  status: string;
  source_proposal_id: string | null;
  source_review_id: string | null;
  revisit_after: string | null;
  promoted_goal_id: string | null;
  /** What it is about, resolved — never a bare id a reader cannot use. */
  entities: Array<{ entity_id: string; role: string; title: string; kind: string }>;
  created_at: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * The season in words, for a briefing and for `/brain`.
 *
 * A season that wraps the new year reads "November to February" rather than
 * being silently reordered, because November to February and February to
 * November are different seasons and one of them is most of the year.
 *
 * @param start - Month 1-12, or null.
 * @param end - Month 1-12, or null.
 * @returns The season, or null when there is none.
 * @example
 * ```typescript
 * seasonLabel(10, 10); // "October"
 * seasonLabel(11, 2);  // "November to February"
 * ```
 */
export function seasonLabel(start: number | null, end: number | null): string | null {
  if (start == null || end == null) return null;
  const from = MONTHS[start - 1];
  const to = MONTHS[end - 1];
  if (!from || !to) return null;
  return start === end ? from : `${from} to ${to}`;
}

async function attachEntities(
  db: PgDb,
  rows: Array<{ id: string }>,
): Promise<Map<string, BriefingIdea["entities"]>> {
  const map = new Map<string, BriefingIdea["entities"]>();
  if (rows.length === 0) return map;
  const links = await db
    .select({
      ideaId: ideaEntities.ideaId,
      entityId: ideaEntities.entityId,
      role: ideaEntities.role,
      title: entities.title,
      kind: entities.kind,
    })
    .from(ideaEntities)
    .innerJoin(entities, eq(entities.id, ideaEntities.entityId))
    .where(
      inArray(
        ideaEntities.ideaId,
        rows.map((row) => row.id),
      ),
    );
  for (const link of links) {
    const list = map.get(link.ideaId) ?? [];
    list.push({
      entity_id: link.entityId,
      role: link.role,
      title: link.title,
      kind: link.kind,
    });
    map.set(link.ideaId, list);
  }
  return map;
}

/**
 * The ideas a briefing should hand to an agent, best first.
 *
 * Only `candidate` ideas, and only those whose `revisit_after` has passed. A
 * `promoted` idea already became a goal and a `dropped` one was turned down,
 * so handing either over would have an agent re-propose what has already been
 * decided — the same reason the wishlist hands over only `wanted` items.
 *
 * @param db - A Drizzle client from `withPg`, or a transaction.
 * @param options - `categories` to narrow, `asOf` for the revisit gate, `statuses` to widen.
 * @returns The ideas, highest confidence first, with their entities resolved.
 * @example
 * ```typescript
 * // What a travel goal's briefing gets today.
 * await ideasForBriefing(db, { categories: ["travel"], asOf: "2027-06-20" });
 * ```
 */
export async function ideasForBriefing(
  db: PgDb,
  options: {
    categories?: readonly GoalCategory[];
    asOf?: string;
    statuses?: readonly ("candidate" | "promoted" | "dropped")[];
  } = {},
): Promise<BriefingIdea[]> {
  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);
  const statuses = [...(options.statuses ?? (["candidate"] as const))];

  const where: SQL[] = [inArray(ideas.status, statuses)];
  if (options.categories && options.categories.length > 0) {
    where.push(inArray(ideas.category, [...options.categories]));
  }
  /**
   * A null `revisit_after` is "always eligible", not "revisit never". The
   * `isNull` branch is what keeps those apart; without it every idea that has
   * never been snoozed would be filtered out.
   */
  where.push(or(isNull(ideas.revisitAfter), sql`${ideas.revisitAfter} <= ${asOf}`)!);

  const rows = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      category: ideas.category,
      rationale: ideas.rationale,
      targetMonthStart: ideas.targetMonthStart,
      targetMonthEnd: ideas.targetMonthEnd,
      confidence: ideas.confidence,
      status: ideas.status,
      sourceProposalId: ideas.sourceProposalId,
      sourceReviewId: ideas.sourceReviewId,
      revisitAfter: ideas.revisitAfter,
      promotedGoalId: ideas.promotedGoalId,
      createdAt: ideas.createdAt,
    })
    .from(ideas)
    .where(and(...where))
    .orderBy(sql`${ideas.confidence} desc, ${ideas.createdAt} desc`);

  const byIdea = await attachEntities(db, rows);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    rationale: row.rationale,
    target_month_start: row.targetMonthStart == null ? null : Number(row.targetMonthStart),
    target_month_end: row.targetMonthEnd == null ? null : Number(row.targetMonthEnd),
    season: seasonLabel(
      row.targetMonthStart == null ? null : Number(row.targetMonthStart),
      row.targetMonthEnd == null ? null : Number(row.targetMonthEnd),
    ),
    confidence: Number(row.confidence),
    status: row.status,
    source_proposal_id: row.sourceProposalId,
    source_review_id: row.sourceReviewId,
    revisit_after: row.revisitAfter == null ? null : String(row.revisitAfter),
    promoted_goal_id: row.promotedGoalId,
    entities: byIdea.get(row.id) ?? [],
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  }));
}

/** What `recordIdeaFromDecline` needs beyond the proposal it came from. */
export interface IdeaFromDecline {
  title: string;
  rationale?: string;
  category?: GoalCategory;
  target_month_start?: number | null;
  target_month_end?: number | null;
  confidence?: number;
  revisit_after?: string | null;
  review_id?: string | null;
  entities?: ReadonlyArray<{ entity_id: string; role?: string }>;
}

/**
 * Record an idea when a dated proposal is declined.
 *
 * This is the first half of the task's loop. The proposal's own category is
 * inherited unless the caller overrides it, so the next briefing for that
 * category returns the idea without anyone restating what it is about.
 *
 * The declined proposal is NOT touched: a verdict is a record and this adds a
 * second record beside it. Snoozing the proposal instead would re-raise that
 * same dated itinerary at that same price, which is the defect this table
 * exists to fix.
 *
 * @param tx - An open transaction. This function never opens its own.
 * @param proposalId - The proposal being declined.
 * @param input - The idea to keep.
 * @returns The new idea's id and the category it was filed under.
 * @throws {Error} When the proposal or a named entity does not exist.
 */
export async function recordIdeaFromDecline(
  tx: PgDb,
  proposalId: string,
  input: IdeaFromDecline,
): Promise<{ idea_id: string; category: string }> {
  const [proposal] = await tx
    .select({ id: proposals.id, goalId: proposals.goalId })
    .from(proposals)
    .where(eq(proposals.id, proposalId))
    .limit(1);
  if (!proposal) throw new Error(`No proposal ${proposalId}`);

  /**
   * The proposal's own goal decides the category when the caller does not,
   * because an idea filed under the wrong category is an idea the next
   * briefing never sees.
   */
  let category: GoalCategory = input.category ?? "travel";
  if (!input.category && proposal.goalId) {
    const [goal] = await tx
      .select({ category: goals.category })
      .from(goals)
      .where(eq(goals.id, proposal.goalId))
      .limit(1);
    if (goal) category = goal.category;
  }

  const links = input.entities ?? [];
  if (links.length > 0) {
    const ids = links.map((link) => link.entity_id);
    const found = await tx.select({ id: entities.id }).from(entities).where(inArray(entities.id, ids));
    const known = new Set(found.map((row) => row.id));
    const missing = ids.filter((id) => !known.has(id));
    if (missing.length > 0) throw new Error(`No such entity: ${missing.join(", ")}`);
  }

  const [created] = await tx
    .insert(ideas)
    .values({
      title: input.title,
      category,
      rationale: input.rationale ?? "",
      targetMonthStart: input.target_month_start ?? null,
      targetMonthEnd: input.target_month_end ?? null,
      confidence: input.confidence ?? 0,
      status: "candidate",
      sourceProposalId: proposalId,
      sourceReviewId: input.review_id ?? null,
      revisitAfter: input.revisit_after ?? null,
    })
    .returning({ id: ideas.id });
  if (!created?.id) throw new Error("Idea insert returned no row");

  if (links.length > 0) {
    await tx
      .insert(ideaEntities)
      .values(links.map((link) => ({ ideaId: created.id, entityId: link.entity_id, role: link.role ?? "" })))
      .onConflictDoNothing();
  }

  return { idea_id: created.id, category };
}

/**
 * Promote an idea into a goal, so it is not retyped.
 *
 * The brief's point about accumulation is that the collection is drawn from,
 * not just added to. The new goal inherits the idea's title, category and
 * rationale, and its season becomes the goal's date window projected into the
 * next occurrence of those months — the planning the idea already did, carried
 * over rather than re-entered.
 *
 * Promoting is idempotent in the only way that matters: an idea already
 * promoted returns its existing goal rather than creating a second one.
 *
 * @param tx - An open transaction. This function never opens its own.
 * @param ideaId - The idea.
 * @param options - `asOf` for projecting the season, and the slug to use.
 * @returns The goal's id and slug, and whether it was created now.
 * @throws {Error} When the idea does not exist.
 */
export async function promoteIdeaToGoal(
  tx: PgDb,
  ideaId: string,
  options: { asOf?: string; slug: string },
): Promise<{ goal_id: string; slug: string; created: boolean }> {
  const [idea] = await tx
    .select({
      id: ideas.id,
      title: ideas.title,
      category: ideas.category,
      rationale: ideas.rationale,
      targetMonthStart: ideas.targetMonthStart,
      targetMonthEnd: ideas.targetMonthEnd,
      status: ideas.status,
      promotedGoalId: ideas.promotedGoalId,
    })
    .from(ideas)
    .where(eq(ideas.id, ideaId))
    .limit(1);
  if (!idea) throw new Error(`No idea ${ideaId}`);

  if (idea.promotedGoalId) {
    const [existing] = await tx
      .select({ id: goals.id, slug: goals.slug })
      .from(goals)
      .where(eq(goals.id, idea.promotedGoalId))
      .limit(1);
    if (existing) return { goal_id: existing.id, slug: existing.slug, created: false };
  }

  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);
  const window = projectSeason(
    idea.targetMonthStart == null ? null : Number(idea.targetMonthStart),
    idea.targetMonthEnd == null ? null : Number(idea.targetMonthEnd),
    asOf,
  );

  const [goal] = await tx
    .insert(goals)
    .values({
      slug: options.slug,
      title: idea.title,
      category: idea.category,
      status: "active",
      instructions: idea.rationale,
      windowStart: window?.start ?? null,
      windowEnd: window?.end ?? null,
    })
    .returning({ id: goals.id, slug: goals.slug });
  if (!goal) throw new Error("Goal insert returned no row");

  await tx
    .update(ideas)
    .set({ status: "promoted", promotedGoalId: goal.id, updatedAt: new Date() })
    .where(eq(ideas.id, ideaId));

  return { goal_id: goal.id, slug: goal.slug, created: true };
}

/** The last day of a month in 2000, a leap year, so February gets 29. */
const LAST_DAY_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Turn a season of months into the next real date window.
 *
 * **This delegates to `nextOccurrence` rather than projecting the months
 * itself.** A season of months IS a recurring yearly window, and that
 * function already handles the three cases this needs — a window whose year
 * is meaningless, a window that wraps the new year, and a window still open
 * because it started LAST year — with twenty assertions and nine planted
 * regressions behind it. A second projector written here would be a second
 * definition that can disagree, and the first version of this function had
 * exactly the previous-year bug that one already fixed: promoting a November
 * to February idea in January would have produced next winter's window while
 * this winter's was still open.
 *
 * February is encoded as day 29 against the leap year 2000, because
 * `projectInto` clamps a day to the real month's length — so the end lands on
 * 28 February in a common year and 29 in a leap year without this function
 * knowing which is which.
 *
 * @param start - Month 1-12, or null.
 * @param end - Month 1-12, or null.
 * @param asOf - `YYYY-MM-DD`.
 * @returns The window, or null when the idea has no season.
 * @example
 * ```typescript
 * projectSeason(10, 10, "2027-06-20"); // { start: "2027-10-01", end: "2027-10-31" }
 * projectSeason(10, 10, "2027-11-20"); // { start: "2028-10-01", end: "2028-10-31" }
 * projectSeason(11, 2,  "2028-01-10"); // { start: "2027-11-01", end: "2028-02-29" }
 * ```
 */
export function projectSeason(
  start: number | null,
  end: number | null,
  asOf: string,
): { start: string; end: string } | null {
  if (start == null || end == null) return null;
  if (start < 1 || start > 12 || end < 1 || end > 12) return null;

  const window = nextOccurrence(
    {
      starts_on: `2000-${String(start).padStart(2, "0")}-01`,
      ends_on: `2000-${String(end).padStart(2, "0")}-${String(LAST_DAY_LEAP[end - 1]).padStart(2, "0")}`,
      recurs_yearly: true,
    },
    asOf,
  );
  return window ? { start: window.starts_on, end: window.ends_on } : null;
}
