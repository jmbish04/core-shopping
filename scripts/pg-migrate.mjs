/**
 * Apply drizzle-pg/ migrations to core_shopping as core_shopping_owner.
 *
 * Runs from a machine on the LAN with LXC 109 (192.168.1.50). Workers Builds
 * cannot reach it, so CI deploys do NOT migrate; /api/health instead compares
 * the newest bundled migration with the database ledger and fails the verdict
 * when the database is behind (cs-be-0-5).
 *
 * Usage: pnpm run migrate:pg
 */
import { spawnSync } from "node:child_process";

import { requireSecret } from "./tokens.mjs";

const env = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? "192.168.1.50",
  PGUSER: "core_shopping_owner",
  PGDATABASE: "core_shopping",
  PGPASSWORD: requireSecret("CORE_SHOPPING_PG_OWNER_PASSWORD"),
};
const run = spawnSync("pnpm", ["exec", "drizzle-kit", "migrate", "--config", "drizzle.pg.config.ts"], { env, stdio: "inherit" });
process.exit(run.status ?? 1);
