/**
 * @fileoverview Critical-alert contracts (maestro cs-c-11): the few findings
 * worth interrupting a day for, and the printed receipt that carries them.
 *
 * The API path is `/api/alerts`, not `/api/notifications`: the template's
 * notifications API already exists and backs the `/lab` reference pages, and
 * two different things under one path is how a later refactor deletes the
 * wrong one. The USER-facing route is still `/notifications` — the receipt
 * barcode opens `/notifications/{id}`.
 *
 * Printing is deliberately rare. Everything here is built so that the DEFAULT
 * is silence: an alert must clear a trigger, pass the caps, and miss quiet
 * hours before any paper moves. A daily digest is not a feature of this
 * system, it is the failure mode it is designed to avoid — paper that always
 * prints is paper nobody reads.
 */

import { z } from "zod";

import { Id, IsoDateTime, type ListFields } from "./common";

export const ALERT_TRIGGERS = [
  /** A deal whose window closes soon and which matches strongly. */
  "deal_ending",
  /** A long-watched goal whose price has finally fallen inside its budget. */
  "price_in_budget",
  /** An explicit "if you ever see this, tell me" rule on the goal fired. */
  "break_rules",
  /** Something already liked has reappeared cheaper. */
  "liked_cheaper",
] as const;

export const ALERT_SEVERITIES = ["critical", "high", "normal"] as const;
export const ALERT_STATUSES = ["unread", "read", "acted", "dismissed"] as const;
/** How far an alert actually got. `listed` never touched the printer. */
export const ALERT_DELIVERIES = ["printed", "listed", "declined"] as const;

export const AlertTriggerSchema = z.enum(ALERT_TRIGGERS).meta({ id: "AlertTrigger" });
export const AlertSeveritySchema = z.enum(ALERT_SEVERITIES).meta({ id: "AlertSeverity" });

export const AlertSchema = z
  .object({
    id: Id,
    trigger: AlertTriggerSchema,
    severity: AlertSeveritySchema,
    status: z.enum(ALERT_STATUSES),
    delivery: z.enum(ALERT_DELIVERIES),
    title: z.string(),
    message: z.string(),
    /** Why now, in one line a person reads off paper while standing up. */
    why_now: z.string(),
    goal_id: Id.nullable(),
    proposal_id: Id.nullable(),
    entity_id: Id.nullable(),
    image_url: z.string().nullable(),
    action_url: z.string().nullable(),
    price_cents: z.number().int().nullable(),
    msrp_cents: z.number().int().nullable(),
    budget_max_cents: z.number().int().nullable(),
    currency: z.string().nullable(),
    /** When acting late stops being worth it; drives the countdown. */
    expires_at: IsoDateTime.nullable(),
    /** The dopamine Worker's own NOTIF- id, present only when it printed. */
    dopamine_notification_id: z.string().nullable(),
    printed_at: IsoDateTime.nullable(),
    /** Set when the policy refused to print; always states which rule. */
    suppressed_reason: z.string().default(""),
    created_at: IsoDateTime,
    read_at: IsoDateTime.nullable(),
    acted_at: IsoDateTime.nullable(),
  })
  .meta({ id: "Alert" });
export type Alert = z.infer<typeof AlertSchema>;

/**
 * What an agent sends to MCP `flag_critical`.
 *
 * The agent states its case; it does not decide whether paper moves. The
 * server applies the policy, because an agent that could print on its own
 * would eventually print every day.
 */
export const FlagCriticalSchema = z
  .object({
    trigger: AlertTriggerSchema,
    title: z.string().min(1).max(200),
    message: z.string().max(2_000).default(""),
    why_now: z.string().min(1).max(500),
    goal_id: Id.nullish(),
    proposal_id: Id.nullish(),
    entity_id: Id.nullish(),
    action_url: z.string().nullish(),
    price_cents: z.number().int().nullish(),
    currency: z.string().nullish(),
    expires_at: IsoDateTime.nullish(),
    /** The agent's own read; the server may lower it, never raise it. */
    urgency: AlertSeveritySchema.default("normal"),
  })
  .meta({ id: "FlagCritical" });

/** The honest answer: what happened, and which rule decided it. */
export const FlagCriticalResultSchema = z
  .object({
    alert_id: Id,
    delivery: z.enum(ALERT_DELIVERIES),
    printed: z.boolean(),
    /** Names the rule when not printed, e.g. "weekly print cap reached (3)". */
    reason: z.string(),
    viewport_url: z.string(),
  })
  .meta({ id: "FlagCriticalResult" });

/**
 * The caps, in one place, editable from Settings.
 *
 * Every field here exists to stop printing, not to enable it. Tests assert
 * what must NOT print, because a policy only tested on its happy path is a
 * policy that prints every day.
 */
export const AlertPolicySchema = z
  .object({
    max_prints_per_day: z.number().int().min(0).default(2),
    max_prints_per_week: z.number().int().min(0).default(5),
    /** Local time, 24h "HH:MM". Nothing prints inside this window. */
    quiet_hours_start: z.string().default("22:00"),
    quiet_hours_end: z.string().default("08:00"),
    /** One print per entity per trigger, ever, unless this many days pass. */
    repeat_entity_after_days: z.number().int().min(0).default(30),
    /** Below this match score nothing prints, whatever the trigger. */
    min_match_score: z.number().min(0).max(1).default(0.7),
    /** A deal only counts as "ending" inside this window. */
    deal_ending_within_hours: z.number().int().min(1).default(72),
    enabled: z.boolean().default(true),
  })
  .meta({ id: "AlertPolicy" });
export type AlertPolicy = z.infer<typeof AlertPolicySchema>;

export const ALERT_LIST_FIELDS = {
  title: { type: "text", label: "Title", sortable: true },
  trigger: { type: "select", label: "Trigger", groupable: true, sortable: true, options: ALERT_TRIGGERS },
  severity: { type: "select", label: "Severity", groupable: true, sortable: true, options: ALERT_SEVERITIES },
  status: { type: "select", label: "Status", groupable: true, options: ALERT_STATUSES },
  delivery: { type: "select", label: "Delivery", groupable: true, options: ALERT_DELIVERIES },
  goal_id: { type: "select", label: "Goal", groupable: true },
  created_at: { type: "date", label: "Raised", sortable: true },
  expires_at: { type: "date", label: "Expires", sortable: true },
} as const satisfies ListFields;
