/**
 * @fileoverview The idea bank API (maestro cs-gap-idea-bank).
 *
 * Mount at `/api/ideas` from the root API application.
 *
 * Not a `/api/config/*` resource, although it is close to one in shape. An
 * idea is not configuration: it is something the system LEARNED, it carries a
 * confidence, and it is written by the review loop rather than typed into a
 * settings page. It belongs beside `lessons` on `/brain`, which is why it
 * lives under `/api/ideas` and reads from `pg/queries/ideas.ts`.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq, sql } from "drizzle-orm";

import { withPg } from "@/backend/pg/client";
import { generateGoalSlug } from "@/backend/api/routes/shopping/goals";
import {
  ideasForBriefing,
  promoteIdeaToGoal,
  recordIdeaFromDecline,
} from "@/backend/pg/queries/ideas";
import { ideaEntities, ideas } from "@/backend/pg/schemas/hitl/ideas";
import { goals } from "@/backend/pg/schemas/goals/goals";
import { ErrorEnvelopeSchema } from "@/shared/contracts/common";
import { IDEA_STATUSES, IdeaInputSchema, IdeaPatchSchema } from "@/shared/contracts/config";
import { GOAL_CATEGORIES } from "@/shared/contracts/goals";

const idParam = z.object({ id: z.string().uuid() });

const listQuery = z.object({
  category: z.enum(GOAL_CATEGORIES).optional(),
  status: z.enum(IDEA_STATUSES).optional(),
  as_of: z.iso
    .date()
    .optional()
    .transform((value) => value ?? new Date().toISOString().slice(0, 10)),
});

const entityRef = z.object({
  entity_id: z.string(),
  role: z.string(),
  title: z.string(),
  kind: z.string(),
});

const ideaRow = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  rationale: z.string(),
  target_month_start: z.number().int().nullable(),
  target_month_end: z.number().int().nullable(),
  season: z.string().nullable(),
  confidence: z.number(),
  status: z.string(),
  source_proposal_id: z.string().nullable(),
  source_review_id: z.string().nullable(),
  revisit_after: z.string().nullable(),
  promoted_goal_id: z.string().nullable(),
  entities: z.array(entityRef),
  created_at: z.string(),
});

const listResponse = z.object({ as_of: z.string(), ideas: z.array(ideaRow) });

function errorBody(code: string, message: string, details?: unknown) {
  return ErrorEnvelopeSchema.parse({
    error: { code, message, ...(details === undefined ? {} : { details }) },
  });
}

function fieldErrors(issues: z.core.$ZodIssue[]) {
  return issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "(root)",
    message: issue.message,
  }));
}

/** Idea bank router. */
export const ideasRouter = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        errorBody("invalid_idea", "This idea is not valid.", fieldErrors(result.error.issues)),
        400,
      );
    }
  },
});

ideasRouter.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Brain"],
    summary: "List ideas",
    description:
      "Candidate ideas by default, and only those whose revisit_after has passed. A promoted idea already became a goal and a dropped one was turned down, so handing either to an agent would re-propose a decided thing.",
    operationId: "ideasList",
    request: { query: listQuery },
    responses: {
      200: {
        description: "Ideas, highest confidence first, with their entities resolved.",
        content: { "application/json": { schema: listResponse } },
      },
    },
  }),
  async (c) => {
    const { category, status, as_of } = c.req.valid("query");
    const rows = await withPg(c.env, (db) =>
      ideasForBriefing(db, {
        asOf: as_of,
        ...(category ? { categories: [category] } : {}),
        ...(status ? { statuses: [status] } : {}),
      }),
    );
    return c.json({ as_of, ideas: rows }, 200);
  },
);

ideasRouter.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Brain"],
    summary: "Record an idea",
    operationId: "ideasCreate",
    request: { body: { content: { "application/json": { schema: IdeaInputSchema } } } },
    responses: {
      201: { description: "The created idea.", content: { "application/json": { schema: ideaRow } } },
      400: {
        description: "Invalid idea; details carry a path per field.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const input = c.req.valid("json");
    const row = await withPg(c.env, (db) =>
      db.transaction(async (tx) => {
        const [created] = await tx
          .insert(ideas)
          .values({
            title: input.title,
            category: input.category,
            rationale: input.rationale,
            targetMonthStart: input.target_month_start ?? null,
            targetMonthEnd: input.target_month_end ?? null,
            confidence: input.confidence,
            status: input.status,
            sourceProposalId: input.source_proposal_id ?? null,
            sourceReviewId: input.source_review_id ?? null,
            revisitAfter: input.revisit_after ?? null,
          })
          .returning({ id: ideas.id });
        if (!created?.id) throw new Error("Idea insert returned no row");
        if (input.entities.length > 0) {
          await tx
            .insert(ideaEntities)
            .values(
              input.entities.map((link) => ({
                ideaId: created.id,
                entityId: link.entity_id,
                role: link.role,
              })),
            )
            .onConflictDoNothing();
        }
        const [row] = await ideasForBriefing(tx, { statuses: [input.status] }).then((rows) =>
          rows.filter((candidate) => candidate.id === created.id),
        );
        return row;
      }),
    );
    return c.json(row, 201);
  },
);

ideasRouter.openapi(
  createRoute({
    method: "patch",
    path: "/{id}",
    tags: ["Brain"],
    summary: "Update an idea",
    operationId: "ideasPatch",
    request: {
      params: idParam,
      body: { content: { "application/json": { schema: IdeaPatchSchema } } },
    },
    responses: {
      200: { description: "The updated idea.", content: { "application/json": { schema: ideaRow } } },
      400: {
        description: "Invalid changes.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
      404: {
        description: "No such idea.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const id = c.req.valid("param").id;
    const patch = c.req.valid("json");
    const result = await withPg(c.env, (db) =>
      db.transaction(async (tx) => {
        const [current] = await tx.select().from(ideas).where(eq(ideas.id, id)).limit(1);
        if (!current) return { kind: "missing" as const };
        // Merged and re-validated in full, so "both months or neither" holds on
        // a patch that only sent one of them.
        const merged = IdeaInputSchema.safeParse({
          title: patch.title ?? current.title,
          category: patch.category ?? current.category,
          rationale: patch.rationale ?? current.rationale,
          target_month_start: Object.hasOwn(patch, "target_month_start")
            ? patch.target_month_start
            : current.targetMonthStart,
          target_month_end: Object.hasOwn(patch, "target_month_end")
            ? patch.target_month_end
            : current.targetMonthEnd,
          confidence: patch.confidence ?? current.confidence,
          status: patch.status ?? current.status,
          source_proposal_id: current.sourceProposalId,
          source_review_id: current.sourceReviewId,
          revisit_after: Object.hasOwn(patch, "revisit_after")
            ? patch.revisit_after
            : current.revisitAfter,
          entities: [],
        });
        if (!merged.success) return { kind: "invalid" as const, issues: merged.error.issues };
        await tx
          .update(ideas)
          .set({
            title: merged.data.title,
            category: merged.data.category,
            rationale: merged.data.rationale,
            targetMonthStart: merged.data.target_month_start ?? null,
            targetMonthEnd: merged.data.target_month_end ?? null,
            confidence: merged.data.confidence,
            status: merged.data.status,
            revisitAfter: merged.data.revisit_after ?? null,
            updatedAt: new Date(),
          })
          .where(eq(ideas.id, id));
        const [row] = await ideasForBriefing(tx, { statuses: [merged.data.status] }).then((rows) =>
          rows.filter((candidate) => candidate.id === id),
        );
        return { kind: "ok" as const, row };
      }),
    );
    if (result.kind === "missing") return c.json(errorBody("idea_not_found", "No such idea."), 404);
    if (result.kind === "invalid")
      return c.json(
        errorBody("invalid_idea", "These changes are not valid.", fieldErrors(result.issues)),
        400,
      );
    return c.json(result.row, 200);
  },
);

const declineBody = z.object({
  title: z.string().trim().min(1).max(300),
  rationale: z.string().max(8_000).optional(),
  category: z.enum(GOAL_CATEGORIES).optional(),
  target_month_start: z.number().int().min(1).max(12).nullish(),
  target_month_end: z.number().int().min(1).max(12).nullish(),
  confidence: z.number().min(0).max(1).optional(),
  revisit_after: z.iso.date().nullish(),
  review_id: z.string().uuid().nullish(),
  entities: z
    .array(z.object({ entity_id: z.string().uuid(), role: z.string().max(80).optional() }))
    .max(50)
    .optional(),
});

ideasRouter.openapi(
  createRoute({
    method: "post",
    path: "/from-proposal/{id}",
    tags: ["Brain"],
    summary: "Keep an idea from a declined proposal",
    description:
      "The declined proposal is not touched: a verdict is a record and this adds a second record beside it. Snoozing the proposal instead would re-raise that same dated itinerary at that same price, which is what this table exists to fix.",
    operationId: "ideasFromProposal",
    request: {
      params: idParam,
      body: { content: { "application/json": { schema: declineBody } } },
    },
    responses: {
      201: {
        description: "The idea that was kept, and the category it was filed under.",
        content: {
          "application/json": {
            schema: z.object({ idea_id: z.string(), category: z.string() }),
          },
        },
      },
      400: {
        description: "An entity that does not exist.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
      404: {
        description: "No such proposal.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const proposalId = c.req.valid("param").id;
    const body = c.req.valid("json");
    try {
      const result = await withPg(c.env, (db) =>
        db.transaction((tx) => recordIdeaFromDecline(tx, proposalId, body)),
      );
      return c.json(result, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/^No proposal /.test(message))
        return c.json(errorBody("proposal_not_found", message), 404);
      if (/No such entity/.test(message))
        return c.json(errorBody("entity_not_found", message, [{ path: "entities", message }]), 400);
      throw error;
    }
  },
);

ideasRouter.openapi(
  createRoute({
    method: "post",
    path: "/{id}/promote",
    tags: ["Brain"],
    summary: "Promote an idea into a goal",
    description:
      "The goal inherits the idea's title, category and rationale, and its season becomes the goal's window projected into the next occurrence of those months — the planning the idea already did, carried over rather than retyped. An idea already promoted returns its existing goal rather than creating a second.",
    operationId: "ideasPromote",
    request: {
      params: idParam,
      body: {
        content: {
          "application/json": {
            schema: z.object({ as_of: z.iso.date().optional() }).optional(),
          },
        },
        required: false,
      },
    },
    responses: {
      200: {
        description: "The goal, and whether it was created now.",
        content: {
          "application/json": {
            schema: z.object({
              goal_id: z.string(),
              slug: z.string(),
              created: z.boolean(),
            }),
          },
        },
      },
      404: {
        description: "No such idea.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const id = c.req.valid("param").id;
    const asOf = c.req.valid("json")?.as_of;
    try {
      const result = await withPg(c.env, (db) =>
        db.transaction(async (tx) => {
          const [idea] = await tx
            .select({ title: ideas.title })
            .from(ideas)
            .where(eq(ideas.id, id))
            .limit(1);
          if (!idea) throw new Error(`No idea ${id}`);
          // The slug is allocated under the same advisory lock the goals
          // router uses, so two promotions cannot race to the same slug.
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext('goals:slug'))`);
          const base = generateGoalSlug(idea.title);
          const existing = await tx
            .select({ slug: goals.slug })
            .from(goals)
            .where(sql`${goals.slug} = ${base} or ${goals.slug} like ${`${base}-%`}`);
          const slug = generateGoalSlug(
            idea.title,
            existing.map((row) => row.slug),
          );
          return promoteIdeaToGoal(tx, id, { slug, ...(asOf ? { asOf } : {}) });
        }),
      );
      return c.json(result, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/^No idea /.test(message)) return c.json(errorBody("idea_not_found", message), 404);
      throw error;
    }
  },
);
