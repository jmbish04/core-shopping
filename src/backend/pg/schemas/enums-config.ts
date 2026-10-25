/**
 * @fileoverview Postgres enums for the self-serve configuration tables
 * (maestro cs-be-1-6). Values come from `@/shared/contracts` so the database
 * and the API cannot disagree.
 */

import { pgEnum } from "drizzle-orm/pg-core";

import {
  BRAND_STANCES,
  LOYALTY_PROGRAM_KINDS,
  PERSON_RELATIONSHIPS,
  PLACE_KINDS,
  PLACE_STANCES,
  TASTE_AFFINITIES,
  TASTE_SOURCES,
  TASTE_TIERS,
  TRAVEL_WINDOW_STANCES,
  TRIP_KINDS,
  IDEA_STATUSES,
  OCCASION_KINDS,
  TRIP_SOURCES,
  WISHLIST_STATUSES,
} from "@/shared/contracts";

export const personRelationship = pgEnum("person_relationship", PERSON_RELATIONSHIPS);
export const brandStance = pgEnum("brand_stance", BRAND_STANCES);
export const loyaltyProgramKind = pgEnum("loyalty_program_kind", LOYALTY_PROGRAM_KINDS);
export const travelWindowStance = pgEnum("travel_window_stance", TRAVEL_WINDOW_STANCES);
export const tasteTier = pgEnum("taste_tier", TASTE_TIERS);
export const tasteAffinity = pgEnum("taste_affinity", TASTE_AFFINITIES);
export const tasteSource = pgEnum("taste_source", TASTE_SOURCES);
export const placeKind = pgEnum("place_kind", PLACE_KINDS);
export const placeStance = pgEnum("place_stance", PLACE_STANCES);
export const tripKind = pgEnum("trip_kind", TRIP_KINDS);
export const tripSource = pgEnum("trip_source", TRIP_SOURCES);
export const wishlistStatus = pgEnum("wishlist_status", WISHLIST_STATUSES);
export const occasionKind = pgEnum("occasion_kind", OCCASION_KINDS);
export const ideaStatus = pgEnum("idea_status", IDEA_STATUSES);
