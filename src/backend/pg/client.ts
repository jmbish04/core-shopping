/**
 * @fileoverview Postgres access for core-shopping domain data (maestro cs-be-0-3).
 *
 * Domain tables live in Postgres (core_shopping on LXC 109, pgvector) reached
 * through the HYPERDRIVE binding. Cloudflare's guidance: node-postgres (`pg`)
 * with Drizzle (Drizzle + Postgres.js over Hyperdrive is unsupported), one new
 * Client per request — Hyperdrive owns the real pool, so connecting is cheap.
 *
 * D1 (`@/backend/db`) still holds sessions, mirrored logs and the /lab template
 * tables. Never put shopper data there.
 *
 * @example
 * const goals = await withPg(env, (db) => db.select().from(pgSchema.goals));
 */

import { Client } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import * as pgSchema from "@/backend/pg/schema";

export { pgSchema };
export type PgDb = NodePgDatabase<typeof pgSchema>;

/**
 * Run `fn` with a Drizzle client on a fresh Hyperdrive connection, always
 * closing it afterwards.
 *
 * @param env - Worker bindings; must carry HYPERDRIVE.
 * @param fn - Work to do with the database.
 * @returns Whatever `fn` returns.
 * @throws Re-throws connection and query errors unchanged.
 */
export async function withPg<T>(env: Pick<Env, "HYPERDRIVE">, fn: (db: PgDb) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
  await client.connect();
  try {
    return await fn(drizzle(client, { schema: pgSchema }));
  } finally {
    await client.end().catch(() => {});
  }
}
