/**
 * @fileoverview The goal-to-occasion links and the due-goal read
 * (maestro cs-gap-occasion-calendar).
 *
 * Mounted at `/api/goals` alongside the goals router, so a goal viewport reads
 * its occasions from the same prefix as everything else about a goal. Kept in
 * its own file rather than appended to `routes/shopping/goals.ts` so this work
 * never collides with another session editing that router.
 *
 * `GET /api/goals/due` is what `cs-be-7-1`'s cron will read. The cron itself is
 * NOT built here: there is no `scheduled` handler and no `triggers.crons` in
 * `wrangler.jsonc`, and cs-be-7-1 owns a six-branch handler (lesson synthesis,
 * retention purge, Spotify sync, calendar sync, the stale-goal detector and
 * the browser-run scheduler). Adding a one-branch handler would be rewritten
 * by that task, and committing a cron trigger starts it running in production
 * on the next merge — an outward-facing change that belongs with the task that
 * owns it. The rule is here, tested, with one definition; the schedule that
 * calls it arrives with its own task.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq, or, sql } from "drizzle-orm";

import { withPg } from "@/backend/pg/client";
import { goals } from "@/backend/pg/schemas/goals/goals";
import {
  goalsDueByOccasion,
  occasionsForGoal,
  setGoalOccasions,
} from "@/backend/pg/queries/occasions";
import { ErrorEnvelopeSchema } from "@/shared/contracts/common";

const identifierParam = z.object({ id: z.string().min(1).max(200) });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** `YYYY-MM-DD`, defaulting to today in UTC. A local default would move a
 * goal's due day for anyone west of UTC. */
const asOfQuery = z.object({
  as_of: z.iso
    .date()
    .optional()
    .transform((value) => value ?? new Date().toISOString().slice(0, 10)),
  only_due: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

const dueSchema = z
  .object({
    occasion_id: z.string(),
    label: z.string(),
    window: z.object({ starts_on: z.string(), ends_on: z.string() }),
    lead_days: z.number().int(),
    due_on: z.string(),
    is_due: z.boolean(),
    reason: z.string(),
  })
  .nullable();

const dueGoalsResponse = z.object({
  as_of: z.string(),
  goals: z.array(
    z.object({
      goal_id: z.string(),
      slug: z.string(),
      title: z.string(),
      status: z.string(),
      due: dueSchema,
    }),
  ),
});

const goalOccasionsResponse = z.object({
  as_of: z.string(),
  occasions: z.array(
    z.object({
      occasion_id: z.string(),
      label: z.string(),
      kind: z.string(),
      lead_days_override: z.number().int().nullable(),
      due: dueSchema,
    }),
  ),
});

const setLinksBody = z.object({
  items: z
    .array(
      z.object({
        occasion_id: z.string().uuid(),
        lead_days_override: z.number().int().min(0).max(365).nullish(),
      }),
    )
    .max(100),
});

function errorBody(code: string, message: string, details?: unknown) {
  return ErrorEnvelopeSchema.parse({
    error: { code, message, ...(details === undefined ? {} : { details }) },
  });
}

/** Goal-occasion router. Mount at `/api/goals`. */
export const goalOccasionsRouter = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        errorBody(
          "invalid_goal_occasions",
          "This input is not valid.",
          result.error.issues.map((issue) => ({
            path: issue.path.map(String).join(".") || "(root)",
            message: issue.message,
          })),
        ),
        400,
      );
    }
  },
});

goalOccasionsRouter.openapi(
  createRoute({
    method: "get",
    path: "/due",
    tags: ["Goals"],
    summary: "Goals an occasion makes due",
    description:
      "Reads the occasion calendar, so a goal is due BEFORE a window opens rather than during it. Each goal's reason says which occasion and how far ahead.",
    operationId: "goalsDueByOccasion",
    request: { query: asOfQuery },
    responses: {
      200: {
        description: "Goals with a linked occasion, soonest-due first.",
        content: { "application/json": { schema: dueGoalsResponse } },
      },
    },
  }),
  async (c) => {
    const { as_of, only_due } = c.req.valid("query");
    const rows = await withPg(c.env, (db) => goalsDueByOccasion(db, as_of, { onlyDue: only_due }));
    return c.json({ as_of, goals: rows }, 200);
  },
);

async function resolveGoalId(env: Env, identifier: string): Promise<string | null> {
  return withPg(env, async (db) => {
    const where = uuidPattern.test(identifier)
      ? or(eq(goals.id, identifier), eq(goals.slug, identifier))!
      : eq(goals.slug, identifier);
    const [row] = await db.select({ id: goals.id }).from(goals).where(where).limit(1);
    return row?.id ?? null;
  });
}

goalOccasionsRouter.openapi(
  createRoute({
    method: "get",
    path: "/{id}/occasions",
    tags: ["Goals"],
    summary: "Occasions this goal wakes for",
    operationId: "goalOccasionsList",
    request: { params: identifierParam, query: asOfQuery },
    responses: {
      200: {
        description:
          "Every link, soonest first. A link whose occasion is inactive or closed is returned with a null verdict rather than dropped, so a surface can say it is linked but silent.",
        content: { "application/json": { schema: goalOccasionsResponse } },
      },
      404: {
        description: "No such goal.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const { as_of } = c.req.valid("query");
    const goalId = await resolveGoalId(c.env, c.req.valid("param").id);
    if (!goalId) return c.json(errorBody("goal_not_found", "Goal not found."), 404);
    const rows = await withPg(c.env, (db) => occasionsForGoal(db, goalId, as_of));
    return c.json({ as_of, occasions: rows }, 200);
  },
);

goalOccasionsRouter.openapi(
  createRoute({
    method: "put",
    path: "/{id}/occasions",
    tags: ["Goals"],
    summary: "Set which occasions this goal wakes for",
    description: "Replaces the whole set, in one transaction.",
    operationId: "goalOccasionsSet",
    request: {
      params: identifierParam,
      body: { content: { "application/json": { schema: setLinksBody } } },
    },
    responses: {
      200: {
        description: "What changed.",
        content: {
          "application/json": {
            schema: z.object({ linked: z.number().int(), removed: z.number().int() }),
          },
        },
      },
      400: {
        description: "An occasion id that does not exist.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
      404: {
        description: "No such goal.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const goalId = await resolveGoalId(c.env, c.req.valid("param").id);
    if (!goalId) return c.json(errorBody("goal_not_found", "Goal not found."), 404);
    const { items } = c.req.valid("json");
    try {
      const result = await withPg(c.env, (db) =>
        db.transaction((tx) => setGoalOccasions(tx, goalId, items)),
      );
      return c.json(result, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/No such occasion/.test(message)) {
        return c.json(
          errorBody("occasion_not_found", message, [{ path: "items", message }]),
          400,
        );
      }
      throw error;
    }
  },
);
