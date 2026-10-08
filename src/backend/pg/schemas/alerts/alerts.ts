/**
 * @fileoverview Critical alerts and the printed receipt (maestro cs-be-8-2).
 *
 * `delivery` and `suppressed_reason` are the pair that makes the quiet policy
 * auditable: every alert records whether paper moved and, when it did not,
 * WHICH rule stopped it. Without that, a queue that goes quiet is
 * indistinguishable from a printer that silently broke.
 */

import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { alertDelivery, alertSeverity, alertStatus, alertTrigger } from "@/backend/pg/schemas/enums-m3";
import { entities } from "@/backend/pg/schemas/catalog/entities";
import { goals } from "@/backend/pg/schemas/goals/goals";
import { proposals } from "@/backend/pg/schemas/proposals/proposals";

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trigger: alertTrigger("trigger").notNull(),
    severity: alertSeverity("severity").notNull().default("normal"),
    status: alertStatus("status").notNull().default("unread"),
    delivery: alertDelivery("delivery").notNull().default("listed"),
    title: text("title").notNull(),
    message: text("message").notNull().default(""),
    /** One line a person reads off paper while standing up. */
    whyNow: text("why_now").notNull().default(""),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "set null" }),
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "set null" }),
    actionUrl: text("action_url"),
    priceCents: integer("price_cents"),
    msrpCents: integer("msrp_cents"),
    budgetMaxCents: integer("budget_max_cents"),
    currency: text("currency"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** The dopamine Worker's NOTIF- id; present only when it printed. */
    dopamineNotificationId: text("dopamine_notification_id"),
    printedAt: timestamp("printed_at", { withTimezone: true }),
    /** Names the rule that refused the print, e.g. "weekly cap reached (5)". */
    suppressedReason: text("suppressed_reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
    actedAt: timestamp("acted_at", { withTimezone: true }),
  },
  (t) => [
    index("alerts_status_created_idx").on(t.status, t.createdAt),
    // The print caps count over a window, per entity and trigger.
    index("alerts_printed_idx").on(t.printedAt),
    index("alerts_entity_trigger_idx").on(t.entityId, t.trigger, t.printedAt),
    index("alerts_goal_idx").on(t.goalId, t.createdAt),
  ],
);
