/**
 * @fileoverview Configuration snapshot routes (maestro cs-gap-config-asof).
 *
 * Mount at `/api/config` from the root API application, beside the
 * configuration resources themselves.
 *
 * `POST /api/config/snapshot` is what `cs-be-3-2`'s briefing calls: it returns
 * the id to record on the run, and stores a new row only when the
 * configuration has actually changed. `GET /api/config/snapshots/{id}/diff` is
 * what a review surface calls to show "the settings at the time, and what has
 * moved since" — which is the thing that makes a verdict explained by a
 * since-changed rule explainable again.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { withPg } from "@/backend/pg/client";
import {
  captureConfigSnapshot,
  configSnapshotForProposal,
  diffConfigSnapshotAgainstNow,
  latestConfigSnapshot,
  readConfigSnapshot,
} from "@/backend/pg/queries/config-snapshot";
import { ErrorEnvelopeSchema } from "@/shared/contracts/common";

const idParam = z.object({ id: z.string().uuid() });

const snapshotSchema = z.object({
  id: z.string(),
  hash: z.string(),
  captured_at: z.string(),
  table_counts: z.record(z.string(), z.number()),
  payload: z.record(z.string(), z.unknown()),
});

const diffSchema = z.object({
  snapshot: snapshotSchema,
  current_hash: z.string(),
  unchanged: z.boolean(),
  changes: z.array(
    z.object({
      table: z.string(),
      row: z.string(),
      change: z.enum(["added", "removed", "changed"]),
      fields: z
        .array(z.object({ field: z.string(), before: z.unknown(), after: z.unknown() }))
        .optional(),
    }),
  ),
});

function errorBody(code: string, message: string) {
  return ErrorEnvelopeSchema.parse({ error: { code, message } });
}

/** Configuration snapshot router. Mount at `/api/config`. */
export const configSnapshotsRouter = new OpenAPIHono<{ Bindings: Env }>();

configSnapshotsRouter.openapi(
  createRoute({
    method: "post",
    path: "/snapshot",
    tags: ["Config"],
    summary: "Capture the configuration as it stands",
    description:
      "Returns the id to record on a run or a proposal. Stores a new row only when the configuration has changed, so reading unchanged configuration a thousand times costs one row.",
    operationId: "configSnapshotCapture",
    responses: {
      200: {
        description: "The snapshot, and whether this call was the first to see it.",
        content: {
          "application/json": {
            schema: z.object({ snapshot: snapshotSchema, created: z.boolean() }),
          },
        },
      },
    },
  }),
  async (c) => {
    const result = await withPg(c.env, (db) => db.transaction((tx) => captureConfigSnapshot(tx)));
    return c.json(result, 200);
  },
);

configSnapshotsRouter.openapi(
  createRoute({
    method: "get",
    path: "/snapshot",
    tags: ["Config"],
    summary: "The newest captured snapshot",
    description: "Read-only. Returns null when nothing has been captured, which is not an empty configuration.",
    operationId: "configSnapshotLatest",
    responses: {
      200: {
        description: "The newest snapshot, or null.",
        content: {
          "application/json": { schema: z.object({ snapshot: snapshotSchema.nullable() }) },
        },
      },
    },
  }),
  async (c) => c.json({ snapshot: await withPg(c.env, latestConfigSnapshot) }, 200),
);

configSnapshotsRouter.openapi(
  createRoute({
    method: "get",
    path: "/snapshots/{id}",
    tags: ["Config"],
    summary: "Read a stored snapshot",
    description:
      "Returns what was STORED, never current configuration. A proposal reviewed in March reads against March's settings.",
    operationId: "configSnapshotGet",
    request: { params: idParam },
    responses: {
      200: { description: "The snapshot.", content: { "application/json": { schema: snapshotSchema } } },
      404: {
        description: "No such snapshot.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const snapshot = await withPg(c.env, (db) => readConfigSnapshot(db, c.req.valid("param").id));
    if (!snapshot) return c.json(errorBody("config_snapshot_not_found", "No such snapshot."), 404);
    return c.json(snapshot, 200);
  },
);

configSnapshotsRouter.openapi(
  createRoute({
    method: "get",
    path: "/snapshots/{id}/diff",
    tags: ["Config"],
    summary: "What has changed since a snapshot",
    description:
      "The settings at the time, diffed against now, field by field. A missing snapshot is a 404 rather than a report of 'no changes' — never recorded and nothing moved are different answers.",
    operationId: "configSnapshotDiff",
    request: { params: idParam },
    responses: {
      200: { description: "The snapshot and every difference.", content: { "application/json": { schema: diffSchema } } },
      404: {
        description: "No such snapshot.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    try {
      const result = await withPg(c.env, (db) =>
        diffConfigSnapshotAgainstNow(db, c.req.valid("param").id),
      );
      return c.json(result, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/No config snapshot/.test(message))
        return c.json(errorBody("config_snapshot_not_found", message), 404);
      throw error;
    }
  },
);

configSnapshotsRouter.openapi(
  createRoute({
    method: "get",
    path: "/snapshot-for-proposal/{id}",
    tags: ["Config"],
    summary: "The configuration a proposal was judged against",
    description:
      "Null when the proposal recorded none, which a surface must show as 'not recorded' rather than rendering today's settings beside an old verdict.",
    operationId: "configSnapshotForProposal",
    request: { params: idParam },
    responses: {
      200: {
        description: "The snapshot, or null when the proposal recorded none.",
        content: {
          "application/json": { schema: z.object({ snapshot: snapshotSchema.nullable() }) },
        },
      },
    },
  }),
  async (c) =>
    c.json(
      {
        snapshot: await withPg(c.env, (db) =>
          configSnapshotForProposal(db, c.req.valid("param").id),
        ),
      },
      200,
    ),
);
