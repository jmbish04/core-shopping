/**
 * Drizzle config for the core-shopping Postgres database (domain data).
 * The D1 config is drizzle.config.ts; the two never share a ledger.
 *
 * `generate` needs no credentials. `migrate` is run by scripts/pg-migrate.mjs,
 * which fills PG* env vars from the tokens CLI as core_shopping_owner.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/backend/pg/schema.ts",
  out: "./drizzle-pg",
  dbCredentials: {
    host: process.env.PGHOST ?? "192.168.1.50",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? "core_shopping_owner",
    password: process.env.PGPASSWORD ?? "",
    database: process.env.PGDATABASE ?? "core_shopping",
    // ponytail: LAN-only origin with a self-signed cert; encrypted but unverified.
    // Production traffic goes through Hyperdrive with verify-full mTLS instead.
    ssl: { rejectUnauthorized: false },
  },
  migrations: { table: "__drizzle_migrations", schema: "drizzle" },
});
