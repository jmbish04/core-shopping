/**
 * @fileoverview Postgres enums for the judgment loop (proposals, HITL, alerts).
 * Values come from `@/shared/contracts` so the database and API cannot disagree.
 */

import { pgEnum } from "drizzle-orm/pg-core";

import {
  ALERT_DELIVERIES,
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  ALERT_TRIGGERS,
  CABINS,
  LESSON_SCOPES,
  LESSON_STATUSES,
  PROPOSAL_KINDS,
  PROPOSAL_STATUSES,
  REASON_POLARITIES,
  TRANSIT_MODES,
  VERDICTS,
} from "@/shared/contracts";

export const proposalStatus = pgEnum("proposal_status", PROPOSAL_STATUSES);
export const proposalKind = pgEnum("proposal_kind", PROPOSAL_KINDS);
export const itineraryItemKind = pgEnum("itinerary_item_kind", [
  "meal", "activity", "transit", "rest", "shopping", "checkin", "flight", "free",
]);
export const transitMode = pgEnum("transit_mode", TRANSIT_MODES);
export const flightCabin = pgEnum("flight_cabin", CABINS);
export const verdict = pgEnum("verdict", VERDICTS);
export const reasonPolarity = pgEnum("reason_polarity", REASON_POLARITIES);
export const lessonScope = pgEnum("lesson_scope", LESSON_SCOPES);
export const lessonStatus = pgEnum("lesson_status", LESSON_STATUSES);
export const alertTrigger = pgEnum("alert_trigger", ALERT_TRIGGERS);
export const alertSeverity = pgEnum("alert_severity", ALERT_SEVERITIES);
export const alertStatus = pgEnum("alert_status", ALERT_STATUSES);
export const alertDelivery = pgEnum("alert_delivery", ALERT_DELIVERIES);
