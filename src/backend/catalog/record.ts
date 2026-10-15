/**
 * @fileoverview `recordSighting` (maestro cs-be-3-4): store one sighting and
 * return the dedupe answer. Every caller uses this one function: the
 * `POST /api/sightings` route, browser runs (`POST /api/runs/{id}/sync`), and
 * the MCP server when it lands (cs-be-3-1).
 *
 * In one transaction it:
 * 1. Finds the entity by fingerprint (following `merged_into_id`), then by an
 *    earlier sighting of the same canonical URL, else creates it.
 * 2. Upserts the source by (kind, domain).
 * 3. Inserts the sighting, and a price observation when it has a price.
 * 4. Bumps `entities.sighting_count` and `last_seen_at`.
 * 5. Reads every earlier proposal that carried the entity, with its latest
 *    verdict that was not undone.
 *
 * Write set, stated so a test can pin it: `entities` (insert or update one
 * row), the entity's kind table (insert once, on create), `sources` (upsert at
 * most one row), `sightings` (one row), `price_observations` (at most one
 * row). Nothing else.
 */

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import type { PgDb } from "@/backend/pg/client";
import type { SightingDedupe } from "@/shared/contracts";

import {
  entities,
  events,
  flights,
  hotels,
  products,
  sources,
} from "@/backend/pg/schemas/catalog/entities";
import { priceObservations, sightings } from "@/backend/pg/schemas/catalog/sightings";
import { goals } from "@/backend/pg/schemas/goals/goals";
import { agentRuns } from "@/backend/pg/schemas/runs/runs";

import {
  canonicalUrl,
  dayOf,
  fingerprintFor,
  sha256Hex,
  urlDomain,
  type EntityHints,
} from "./canonical";
import { priceDelta, type SightingInput } from "./findings";

/** A sighting that cannot be recorded, with the HTTP status that fits. */
export class SightingError extends Error {
  readonly code: "unidentifiable" | "goal_not_found" | "run_not_found";
  readonly status: 400 | 404;

  constructor(code: SightingError["code"], message: string, status: 400 | 404 = 400) {
    super(message);
    this.name = "SightingError";
    this.code = code;
    this.status = status;
  }
}

type Tx = Parameters<Parameters<PgDb["transaction"]>[0]>[0];

/** A merge chain longer than this is a cycle or corruption; stop there. */
const MAX_MERGE_HOPS = 8;

async function resolveMerged(tx: Tx, id: string): Promise<string> {
  let current = id;
  for (let hop = 0; hop < MAX_MERGE_HOPS; hop++) {
    const [row] = await tx
      .select({ next: entities.mergedIntoId })
      .from(entities)
      .where(eq(entities.id, current));
    if (!row?.next) return current;
    current = row.next;
  }
  return current;
}

function attrsFrom(hints: EntityHints, seller: string | null | undefined): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(hints)) if (v != null && v !== "") attrs[k] = v;
  if (seller) attrs.seller = seller;
  return attrs;
}

function timestampOf(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function insertKindRow(
  tx: Tx,
  kind: string,
  entityId: string,
  h: EntityHints,
): Promise<void> {
  if (kind === "event") {
    await tx
      .insert(events)
      .values({ entityId, startsAt: timestampOf(h.startsAt), city: h.city ?? "" })
      .onConflictDoNothing();
  } else if (kind === "product") {
    await tx
      .insert(products)
      .values({ entityId, brand: h.brand ?? "", model: h.model ?? "", variant: h.variant ?? "" })
      .onConflictDoNothing();
  } else if (kind === "flight" && h.origin && h.destination) {
    await tx
      .insert(flights)
      .values({
        entityId,
        origin: h.origin.toUpperCase(),
        destination: h.destination.toUpperCase(),
        carrier: h.carrier ?? "",
        departOn: dayOf(h.departOn) || null,
        returnOn: dayOf(h.returnOn) || null,
      })
      .onConflictDoNothing();
  } else if (kind === "hotel" && (h.propertyName || h.title)) {
    await tx
      .insert(hotels)
      .values({ entityId, propertyName: (h.propertyName || h.title) as string, city: h.city ?? "" })
      .onConflictDoNothing();
  }
}

/**
 * Store one sighting and answer whether it is new.
 *
 * @param db - A Drizzle client from `withPg`.
 * @param input - The sighting.
 * @returns The dedupe answer.
 * @throws {SightingError} When nothing identifies the sighting, or `goalId` / `runId` does not exist.
 * @example
 * ```typescript
 * const answer = await withPg(env, (db) => recordSighting(db, { kind: "event", title: "Adele", url }));
 * if (answer.prior_proposals.length) { ... }
 * ```
 */
export async function recordSighting(db: PgDb, input: SightingInput): Promise<SightingDedupe> {
  const hints: EntityHints = { title: input.title, ...input.hints };
  const canonical = canonicalUrl(input.url);
  const urlHash = canonical ? await sha256Hex(canonical) : null;
  const fp = fingerprintFor(input.kind, hints, { urlHash, emailMessageId: input.emailMessageId });
  if (!fp)
    throw new SightingError(
      "unidentifiable",
      "The sighting has no title, no URL and no identifying attributes.",
    );

  return db.transaction(async (tx) => {
    if (input.goalId) {
      const [g] = await tx.select({ id: goals.id }).from(goals).where(eq(goals.id, input.goalId));
      if (!g) throw new SightingError("goal_not_found", `No goal ${input.goalId}.`, 404);
    }
    if (input.runId) {
      const [r] = await tx
        .select({ id: agentRuns.id })
        .from(agentRuns)
        .where(eq(agentRuns.id, input.runId));
      if (!r) throw new SightingError("run_not_found", `No run ${input.runId}.`, 404);
    }

    // 1. The entity.
    let matchedBy: SightingDedupe["matched_by"] = "fingerprint";
    let entityId: string | null = null;
    const [byFp] = await tx
      .select({ id: entities.id })
      .from(entities)
      .where(eq(entities.fingerprint, fp.fingerprint));
    if (byFp) entityId = await resolveMerged(tx, byFp.id);
    if (!entityId && urlHash) {
      const [byUrl] = await tx
        .select({ id: sightings.entityId })
        .from(sightings)
        .innerJoin(entities, eq(entities.id, sightings.entityId))
        .where(and(eq(sightings.urlHash, urlHash), eq(entities.kind, input.kind as never)))
        .orderBy(desc(sightings.seenAt))
        .limit(1);
      if (byUrl) {
        entityId = await resolveMerged(tx, byUrl.id);
        matchedBy = "url";
      }
    }
    if (!entityId) {
      const [created] = await tx
        .insert(entities)
        .values({
          kind: input.kind as never,
          fingerprint: fp.fingerprint,
          title: input.title,
          summary: input.excerpt ?? "",
          attrs: attrsFrom(input.hints ?? {}, input.seller),
        })
        .onConflictDoNothing({ target: entities.fingerprint })
        .returning({ id: entities.id });
      if (created) {
        entityId = created.id;
        matchedBy = "created";
        await insertKindRow(tx, input.kind, entityId, hints);
      } else {
        // A concurrent writer created it between the read and the insert.
        const [raced] = await tx
          .select({ id: entities.id })
          .from(entities)
          .where(eq(entities.fingerprint, fp.fingerprint));
        entityId = await resolveMerged(tx, raced.id);
      }
    }
    const isResighting = matchedBy !== "created";

    // The previous priced sighting, read before this one is written.
    const [previous] = await tx
      .select({
        priceCents: sightings.priceCents,
        currency: sightings.currency,
        seenAt: sightings.seenAt,
      })
      .from(sightings)
      .where(and(eq(sightings.entityId, entityId), isNotNull(sightings.priceCents)))
      .orderBy(desc(sightings.seenAt))
      .limit(1);

    // 2. The source.
    const domain = urlDomain(canonical);
    let sourceId: string | null = null;
    if (domain) {
      const kind = (input.sourceKind ?? "web") as never;
      const [src] = await tx
        .insert(sources)
        .values({ kind, domain })
        .onConflictDoUpdate({
          target: [sources.kind, sources.domain],
          set: { domain: sql`excluded.domain` },
        })
        .returning({ id: sources.id });
      sourceId = src.id;
    }

    // 3. The sighting and its price.
    const [sighting] = await tx
      .insert(sightings)
      .values({
        entityId,
        runId: input.runId ?? null,
        goalId: input.goalId ?? null,
        sourceId,
        url: input.url ?? null,
        urlCanonical: canonical,
        urlHash,
        emailMessageId: input.emailMessageId ?? null,
        title: input.title,
        excerpt: input.excerpt ?? "",
        priceCents: input.priceCents ?? null,
        msrpCents: input.msrpCents ?? null,
        currency: input.currency ?? null,
        onSale: input.onSale ?? null,
        availability: input.availability ?? null,
        agentScore: input.agentScore ?? null,
        agentRationale: input.agentRationale ?? "",
        isResighting,
        // clock_timestamp, not now(): now() is fixed for the whole transaction, so two
        // sightings in one transaction would tie and "the latest" would be arbitrary.
        seenAt: sql`clock_timestamp()`,
      })
      .returning({ id: sightings.id });
    if (input.priceCents != null) {
      await tx.insert(priceObservations).values({
        entityId,
        sightingId: sighting.id,
        seller: input.seller ?? domain ?? "",
        priceCents: input.priceCents,
        currency: input.currency ?? "USD",
        observedAt: sql`clock_timestamp()`,
      });
    }

    // 4. The entity's counters.
    const [counted] = await tx
      .update(entities)
      .set({ sightingCount: sql`${entities.sightingCount} + 1`, lastSeenAt: sql`clock_timestamp()` })
      .where(eq(entities.id, entityId))
      .returning({ count: entities.sightingCount });

    // 5. Earlier proposals that carried this entity. Raw SQL with explicit
    // aliases: Drizzle writes a bare "id" inside a subquery (see runs.ts).
    const prior = await tx.execute<{
      proposal_id: string;
      status: SightingDedupe["prior_proposals"][number]["status"];
      title: string;
      created_at: Date;
      decided_at: Date | null;
      verdict: SightingDedupe["prior_proposals"][number]["verdict"];
      reason_codes: string[] | null;
      note: string | null;
    }>(sql`
      select p.id as proposal_id, p.status, p.title, p.created_at, p.decided_at,
             r.verdict, r.reason_codes, r.note
      from proposals p
      left join lateral (
        select rv.verdict, rv.reason_codes, rv.note
        from reviews rv
        where rv.proposal_id = p.id and rv.undone_at is null
        order by rv.created_at desc
        limit 1
      ) r on true
      where p.id in (select pi.proposal_id from proposal_items pi where pi.entity_id = ${entityId})
      order by p.created_at desc
      limit 20`);

    return {
      status: isResighting ? "resighting" : "new",
      matched_by: matchedBy,
      entity_id: entityId,
      sighting_id: sighting.id,
      fingerprint: fp.fingerprint,
      fingerprint_basis: fp.basis,
      sighting_count: counted.count,
      price_delta: priceDelta(
        previous && previous.priceCents != null
          ? {
              priceCents: previous.priceCents,
              currency: previous.currency,
              seenAt: previous.seenAt,
            }
          : null,
        input.priceCents,
        input.currency,
      ),
      prior_proposals: prior.rows.map((p) => ({
        proposal_id: p.proposal_id,
        status: p.status,
        title: p.title,
        created_at: new Date(p.created_at).toISOString(),
        decided_at: p.decided_at ? new Date(p.decided_at).toISOString() : null,
        verdict: p.verdict ?? null,
        reason_codes: p.reason_codes ?? [],
        note: p.note ?? "",
      })),
    };
  });
}
