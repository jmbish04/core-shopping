/**
 * @fileoverview Barrel of every core-shopping Postgres table and enum. Used by
 * drizzle.pg.config.ts (migrations) and `withPg` (typed queries).
 */

export * from "@/backend/pg/schemas/enums";
export * from "@/backend/pg/schemas/goals/goals";
export * from "@/backend/pg/schemas/goals/goal-criteria";
export * from "@/backend/pg/schemas/goals/goal-revisions";
export * from "@/backend/pg/schemas/goals/tags";
export * from "@/backend/pg/schemas/runs/runs";
export * from "@/backend/pg/schemas/catalog/entities";
export * from "@/backend/pg/schemas/catalog/sightings";
