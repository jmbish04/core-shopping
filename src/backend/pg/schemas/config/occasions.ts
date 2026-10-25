/**
 * @fileoverview `occasions` and `goal_occasions` (maestro
 * cs-gap-occasion-calendar): windows a goal must wake up BEFORE.
 *
 * The brief names two outright — "anticipating upcoming sales like Amazon
 * Prime Day" and "SF restaraunt week [we always forget]" — plus the dated
 * personal ones: "a wedding gift, anniversary gift, holiday gift".
 *
 * Nothing held them. `travel_windows` says whether a date range is a good time
 * to travel, with a stance vocabulary built for travel. `events.sales_end_at`
 * is per-entity and only exists once an event has already been FOUND, which is
 * the wrong way round: these are the cases where being found at all depends on
 * looking early.
 *
 * `lead_days` is the column that answers the task. A goal linked to Prime Day
 * with a lead of 21 days becomes due three weeks before the window opens, not
 * during it and not after.
 */

import { index, integer, boolean, pgTable, text, timestamp, uniqueIndex, uuid, date } from "drizzle-orm/pg-core";

import { occasionKind } from "@/backend/pg/schemas/enums-config";
import { people } from "@/backend/pg/schemas/config/people";
import { goals } from "@/backend/pg/schemas/goals/goals";

export const occasions = pgTable(
  "occasions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    kind: occasionKind("kind").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    /**
     * When set, the YEAR in `starts_on` and `ends_on` is ignored and only
     * month and day matter, so one row covers every July. A recurring window
     * may therefore end before it starts (28 December to 4 January), which is
     * why the resolver projects month-day pairs into a year rather than
     * subtracting dates.
     */
    recursYearly: boolean("recurs_yearly").notNull().default(false),
    /** How many days before the window opens a linked goal becomes due. */
    leadDays: integer("lead_days").notNull().default(14),
    notes: text("notes").notNull().default(""),
    /** Whose occasion, for a personal one. Null means the household's. */
    forPersonId: uuid("for_person_id").references(() => people.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("occasions_active_idx").on(t.isActive, t.startsOn),
    index("occasions_kind_idx").on(t.kind),
    index("occasions_person_idx").on(t.forPersonId),
  ],
);
export type OccasionRow = typeof occasions.$inferSelect;

/**
 * Which occasions a goal should wake for.
 *
 * A link rather than a column on `goals`, because the relationship is
 * many-to-many in both directions and both directions are real: Prime Day
 * wakes the gift sweep AND the workstation goal, and the gift sweep wakes for
 * Prime Day AND for a birthday.
 *
 * `lead_days_override` exists because the right lead is a property of the
 * PAIR, not of the occasion. Booking a restaurant for SF Restaurant Week
 * wants a fortnight; shipping a gift that has to arrive by the date wants
 * longer. Null means the occasion's own `lead_days`.
 */
export const goalOccasions = pgTable(
  "goal_occasions",
  {
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    occasionId: uuid("occasion_id")
      .notNull()
      .references(() => occasions.id, { onDelete: "cascade" }),
    leadDaysOverride: integer("lead_days_override"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("goal_occasions_pk").on(t.goalId, t.occasionId),
    index("goal_occasions_occasion_idx").on(t.occasionId),
  ],
);
export type GoalOccasionRow = typeof goalOccasions.$inferSelect;
