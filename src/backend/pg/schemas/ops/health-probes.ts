/**
 * @fileoverview `health_probes`: rows the health check writes and reads back to
 * prove a committed write is visible to the next request (maestro 5492781d5118).
 *
 * One row per probe, keyed by the probe's name and overwritten in place, so the
 * table holds a fixed handful of rows and needs no retention job. It references
 * nothing and nothing references it: it is operational state, not shopper data,
 * which is why the probe does not write a goal.
 */

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const healthProbes = pgTable("health_probes", {
  /** The probe's name, e.g. "read_after_write". One row each. */
  id: text("id").primaryKey(),
  /** A fresh random value per write; the read-back must return exactly this. */
  nonce: text("nonce").notNull(),
  writtenAt: timestamp("written_at", { withTimezone: true }).notNull().defaultNow(),
});
