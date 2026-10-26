/**
 * @fileoverview `loyalty_programs`, `loyalty_accounts` and `transfer_partners`
 * (maestro cs-be-1-6): "where our loyalty points were with hotels and
 * airlines", and how points move between them.
 *
 * The transfer graph is what makes the brief's "bonus poitns if with points we
 * can convert from our sapphire reserve or amex plat cards" answerable: a
 * KrisFlyer seat is affordable if the KrisFlyer balance covers it OR a partner
 * balance covers it after the ratio is applied.
 *
 * Ratios are two integers, never a float — the same rule as money being
 * integer cents. `1000:800` is exact; `0.8` is a rounding argument waiting to
 * happen.
 */

import { boolean, date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { loyaltyProgramKind } from "@/backend/pg/schemas/enums-config";
import { people } from "@/backend/pg/schemas/config/people";

/**
 * A loyalty currency: KrisFlyer, Hilton Honors, Amex MR, Chase UR.
 *
 * `code` is the id the free-text `points_program` columns elsewhere
 * (`flight_options`, `hotel_options`, `sightings`) are meant to carry. Those
 * are not foreign keys yet, because they are written by agents from scraped
 * text and a failed lookup must not lose the finding; a reconciliation pass
 * belongs with cs-be-7-5's seeding.
 */
export const loyaltyPrograms = pgTable(
  "loyalty_programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    kind: loyaltyProgramKind("kind").notNull(),
    alliance: text("alliance").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("loyalty_programs_kind_idx").on(t.kind, t.name)],
);
export type LoyaltyProgramRow = typeof loyaltyPrograms.$inferSelect;

/**
 * One person's standing in one programme.
 *
 * `points_balance` and `balance_as_of` are both nullable and they travel
 * together: a programme nobody has checked has an UNKNOWN balance, which is
 * not a balance of zero. Rendering null as "0 points" would tell the agent it
 * cannot afford a seat it can afford, which is the absence-is-not-a-verdict
 * rule this project has already paid for once.
 */
export const loyaltyAccounts = pgTable(
  "loyalty_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    programId: uuid("program_id")
      .notNull()
      .references(() => loyaltyPrograms.id, { onDelete: "cascade" }),
    accountLabel: text("account_label").notNull().default(""),
    /** Null means never measured, not empty. */
    pointsBalance: integer("points_balance"),
    /** When the balance was read. Null whenever `points_balance` is null. */
    balanceAsOf: timestamp("balance_as_of", { withTimezone: true }),
    eliteTier: text("elite_tier").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("loyalty_accounts_person_program_key").on(t.personId, t.programId),
    index("loyalty_accounts_program_idx").on(t.programId),
  ],
);
export type LoyaltyAccountRow = typeof loyaltyAccounts.$inferSelect;

/** A transfer route between two programmes, e.g. "Amex MR -> KrisFlyer 1:1". */
export const transferPartners = pgTable(
  "transfer_partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromProgramId: uuid("from_program_id")
      .notNull()
      .references(() => loyaltyPrograms.id, { onDelete: "cascade" }),
    toProgramId: uuid("to_program_id")
      .notNull()
      .references(() => loyaltyPrograms.id, { onDelete: "cascade" }),
    ratioFrom: integer("ratio_from").notNull().default(1),
    ratioTo: integer("ratio_to").notNull().default(1),
    transferDaysMin: integer("transfer_days_min"),
    transferDaysMax: integer("transfer_days_max"),
    bonusNote: text("bonus_note").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    /** A ratio goes stale. Null means it has never been checked. */
    lastVerifiedOn: date("last_verified_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("transfer_partners_pair_key").on(t.fromProgramId, t.toProgramId),
    index("transfer_partners_to_idx").on(t.toProgramId, t.isActive),
  ],
);
export type TransferPartnerRow = typeof transferPartners.$inferSelect;
