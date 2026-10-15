/**
 * @fileoverview Pure rules for recording sightings (maestro cs-be-3-4) and for
 * turning a core-browser job's final answer into sightings (cs-be-6-6).
 *
 * No value imports, so `scripts/selfcheck-sightings.mjs` drives every rule in
 * plain Node. The database work is in `record.ts`.
 */

import type { EntityHints } from "./canonical";

/** One sighting, as `recordSighting` accepts it from an agent or a browser run. */
export interface SightingInput {
  kind: string;
  title: string;
  url?: string | null;
  emailMessageId?: string | null;
  sourceKind?: string | null;
  excerpt?: string | null;
  priceCents?: number | null;
  msrpCents?: number | null;
  currency?: string | null;
  onSale?: boolean | null;
  availability?: string | null;
  seller?: string | null;
  agentScore?: number | null;
  agentRationale?: string | null;
  hints?: EntityHints;
  runId?: string | null;
  goalId?: string | null;
}

/** The change since the entity's previous priced sighting. */
export interface PriceDelta {
  previous_cents: number;
  current_cents: number;
  delta_cents: number;
  /** Percent of the previous price, one decimal; null when the previous price was 0. */
  delta_pct: number | null;
  currency: string | null;
  previous_seen_at: string;
}

/**
 * The price change between two sightings. Prices in different currencies are
 * not compared.
 *
 * @param previous - The previous priced sighting, or null.
 * @param currentCents - This sighting's price, or null.
 * @param currency - This sighting's currency.
 * @returns The delta, or `null` when either price is missing or the currencies differ.
 */
export function priceDelta(
  previous: { priceCents: number; currency: string | null; seenAt: Date } | null,
  currentCents: number | null | undefined,
  currency: string | null | undefined,
): PriceDelta | null {
  if (!previous || currentCents == null) return null;
  const a = (previous.currency ?? "").toUpperCase();
  const b = (currency ?? "").toUpperCase();
  if (a && b && a !== b) return null;
  const delta = currentCents - previous.priceCents;
  return {
    previous_cents: previous.priceCents,
    current_cents: currentCents,
    delta_cents: delta,
    // Half away from zero, so a drop and a rise of the same size print the same number.
    delta_pct:
      previous.priceCents === 0
        ? null
        : (Math.sign(delta) * Math.round(Math.abs(delta / previous.priceCents) * 1000)) / 10,
    currency: b || a || null,
    previous_seen_at: previous.seenAt.toISOString(),
  };
}

/**
 * A price as integer cents.
 *
 * @param value - `75.25`, `"$75.25"`, `"75"`, `"1,299.00"`, `"USD 40"`, or null.
 * @returns Cents, or `null` when no single non-negative amount can be read.
 * @example
 * priceToCents("$1,299.99"); // 129999
 */
export function priceToCents(value: unknown): number | null {
  if (typeof value === "number")
    return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
  if (typeof value !== "string") return null;
  const amounts = value.match(/\d[\d,]*(?:\.\d+)?/g);
  // ponytail: "$40 - $80" is a range, not a price; refuse rather than guess.
  if (!amounts || amounts.length !== 1) return null;
  const n = Number(amounts[0].replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Entity kinds a browser finding may name. */
export const BROWSER_FINDING_KINDS = ["event", "product", "flight", "hotel", "experience"] as const;

/**
 * The entity kind to use when a finding names none, from the goal category.
 *
 * @param category - The goal category.
 * @returns An entity kind.
 */
export function kindForCategory(category: string): string {
  switch (category) {
    case "experience":
      return "event";
    case "product":
    case "gift":
    case "deal":
      return "product";
    case "research":
      return "review_snippet";
    default:
      return "experience";
  }
}

/**
 * The JSON object that starts at `start`, balanced with string awareness.
 *
 * @param text - The text.
 * @param start - Index of a `{`.
 * @returns The object text, or `null` when it never closes.
 */
function balancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/** One raw finding from the browser agent's final answer. */
export interface BrowserFinding {
  kind?: unknown;
  title?: unknown;
  url?: unknown;
  price?: unknown;
  currency?: unknown;
  seller?: unknown;
  dates?: unknown;
  venue?: unknown;
  city?: unknown;
  notes?: unknown;
}

/** What {@link parseBrowserFindings} read. */
export type ParsedFindings =
  | { ok: true; findings: BrowserFinding[] }
  | { ok: false; reason: string };

/**
 * The `{"findings":[...]}` object from a browser job's final answer. It reads
 * the LAST `ai_decision` message that carries one, and the last such object
 * inside that message (the agent may quote the format earlier).
 *
 * @param events - The job's events, any order.
 * @returns The findings, or why there are none to read.
 */
export function parseBrowserFindings(
  events: { seq: number; kind: string; message: string | null }[],
): ParsedFindings {
  const decisions = events
    .filter((e) => e.kind === "ai_decision" && e.message)
    .sort((a, b) => b.seq - a.seq);
  for (const e of decisions) {
    const text = e.message as string;
    let at = text.lastIndexOf('{"findings"');
    while (at >= 0) {
      const body = balancedObject(text, at);
      if (body) {
        try {
          const parsed = JSON.parse(body) as { findings?: unknown };
          if (Array.isArray(parsed.findings)) {
            return {
              ok: true,
              findings: parsed.findings.filter(
                (f): f is BrowserFinding => !!f && typeof f === "object",
              ),
            };
          }
        } catch {
          // not JSON; try an earlier occurrence
        }
      }
      at = at > 0 ? text.lastIndexOf('{"findings"', at - 1) : -1;
    }
  }
  return { ok: false, reason: 'no ai_decision event carries a {"findings":[...]} object' };
}

function str(value: unknown, max = 500): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

/**
 * A browser finding as a {@link SightingInput}. A finding with no title and no
 * URL is not a sighting.
 *
 * @param finding - The raw finding.
 * @param ctx - The run, the goal and its category.
 * @returns The input, or `null` when the finding names nothing.
 */
export function findingToSighting(
  finding: BrowserFinding,
  ctx: { runId: string; goalId: string; category: string; currency: string },
): SightingInput | null {
  const url = str(finding.url, 2_000);
  const title = str(finding.title) ?? url;
  if (!title) return null;
  const named = str(finding.kind, 40);
  const kind =
    named && (BROWSER_FINDING_KINDS as readonly string[]).includes(named)
      ? named
      : kindForCategory(ctx.category);
  const dates = str(finding.dates, 100);
  const currency =
    str(finding.currency, 3)?.toUpperCase() ??
    (priceToCents(finding.price) == null ? null : ctx.currency);
  return {
    kind,
    title,
    url,
    sourceKind: "web",
    excerpt: str(finding.notes, 2_000),
    priceCents: priceToCents(finding.price),
    currency,
    seller: str(finding.seller, 200),
    agentRationale: str(finding.notes, 2_000),
    hints: {
      title,
      performer: kind === "event" ? title : null,
      // The seller is never the venue: two sellers of one show must share a fingerprint.
      venue: str(finding.venue, 200),
      city: str(finding.city, 200),
      startsAt: dates,
      departOn: kind === "flight" ? dates : null,
    },
    runId: ctx.runId,
    goalId: ctx.goalId,
  };
}
