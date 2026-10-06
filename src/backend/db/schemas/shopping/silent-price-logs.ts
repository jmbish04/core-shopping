import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const SILENT_PRICE_LOGS_TABLE_DESCRIPTION =
  "Background price and availability tracking logs for deferred or schedule-vetoed experience proposals.";

export const SILENT_PRICE_LOGS_COLUMN_DESCRIPTIONS: Record<string, string> = {
  id: "Unique price log ID.",
  proposalId: "Referenced proposal ID.",
  loggedPrice: "Current observed cash price or award points requirement.",
  notes: "Agent observation notes (e.g. secondary market price drop on StubHub).",
  loggedAt: "Log timestamp.",
};

export const silentPriceLogs = sqliteTable("silent_price_logs", {
  id: text("id").primaryKey(),
  proposalId: text("proposal_id").notNull(),
  loggedPrice: integer("logged_price").notNull(),
  notes: text("notes"),
  loggedAt: integer("logged_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertSilentPriceLogSchema = createInsertSchema(silentPriceLogs);
export const selectSilentPriceLogSchema = createSelectSchema(silentPriceLogs);
export type SilentPriceLogRow = typeof silentPriceLogs.$inferSelect;
export type NewSilentPriceLogRow = typeof silentPriceLogs.$inferInsert;
