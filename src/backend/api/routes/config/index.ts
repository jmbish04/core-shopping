/**
 * @fileoverview The configuration API (maestro cs-be-2-8): CRUD and bulk save
 * for every configuration table under `/api/config/*`.
 *
 * Mount at `/api/config` from the root API application.
 *
 * Three things this router is deliberate about:
 *
 * - **Validation errors carry field paths.** Every refusal returns
 *   `{ error: { code, message, details: [{ path, message }] } }` built from
 *   Zod's own issues, so a settings form can mark the field that is wrong
 *   rather than showing one banner for a page of inputs.
 * - **A bulk save that DELETES has to ask.** `PUT /api/config/{resource}`
 *   takes a `mode`: `upsert` (the default) leaves rows the request did not
 *   mention alone, `replace` deletes them. A grid showing the whole list means
 *   `replace`, but a client that sends a partial list under a default of
 *   `replace` would silently destroy the rest, so the destructive reading is
 *   never what happens when the field is left out.
 * - **A PATCH is re-validated in full.** A partial schema cannot check that a
 *   minimum does not exceed a maximum the request did not send, so the patch is
 *   merged onto the stored row and re-parsed with the complete input schema —
 *   the same shape as the goal patch in `routes/shopping/goals.ts`.
 *
 * `preferences` is one household row rather than a collection, so it gets its
 * own two routes instead of being bent into a list that is always length one.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq, inArray, notInArray, sql } from "drizzle-orm";

import { ListQueryError, runList, type ColumnMap } from "@/backend/api/list/index";
import { withPg, type PgDb } from "@/backend/pg/client";
import { preferences } from "@/backend/pg/schemas/config/people";
import {
  CONFIG_RESOURCE_SPECS,
  toRow,
  toWire,
  type ConfigResourceSpec,
} from "@/backend/api/routes/config/resources";
import { ErrorEnvelopeSchema, ListQuerySchema, listEnvelope } from "@/shared/contracts/common";
import {
  BulkSaveModeSchema,
  BulkSaveResultSchema,
  PreferencesInputSchema,
  PreferencesPatchSchema,
  PreferencesSchema,
  type BulkSaveResult,
} from "@/shared/contracts/config";

const idParam = z.object({ id: z.string().uuid() });

/** The one error shape, with Zod's field paths kept. */
function errorBody(code: string, message: string, details?: unknown) {
  return ErrorEnvelopeSchema.parse({
    error: { code, message, ...(details === undefined ? {} : { details }) },
  });
}

/**
 * Turn Zod issues into `{ path, message }`, so a form can mark the field.
 *
 * @param issues - Issues from a failed `safeParse`.
 * @returns One entry per issue, the path dotted (`items.2.ends_on`).
 */
function fieldErrors(issues: z.core.$ZodIssue[]): Array<{ path: string; message: string }> {
  return issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "(root)",
    message: issue.message,
  }));
}

/** A permissive row envelope: the resource's own schema is the OpenAPI shape. */
const anyRow = z.record(z.string(), z.unknown());

/** One page of a configuration list, in the shared envelope's shape. */
export interface ConfigListPage {
  items: Array<Record<string, unknown>>;
  total: number;
  page: number;
  page_size: number;
  groups?: Array<{ key: string | null; count: number; subtotals?: Record<string, number> }>;
}

/** The household preferences, with whether they have ever been saved. */
export type PreferencesView = { persisted: boolean } & Record<string, unknown>;

/**
 * Load one row by id, in the wire shape.
 *
 * @param db - A Drizzle client or transaction.
 * @param spec - The resource.
 * @param id - The row's uuid.
 * @returns The row, or null when it does not exist.
 */
async function loadOne(
  db: PgDb,
  spec: ConfigResourceSpec,
  id: string,
): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select()
    .from(spec.table)
    .where(eq(sql`${spec.table}.id`, id))
    .limit(1);
  return row ? toWire(spec.table, row as Record<string, unknown>) : null;
}

/**
 * List one configuration resource, exactly as `GET /api/config/{resource}` does.
 *
 * Exported so `pnpm run verify:config-api` can drive the real query against
 * real Postgres: the list goes through the shared engine, so a filter, a sort
 * or a group that an empty table would answer identically either way is only
 * provable with rows in it.
 *
 * @param db - A Drizzle client from `withPg`.
 * @param spec - The resource to list.
 * @param query - A parsed {@link ListQuerySchema}.
 * @returns The shared list envelope, rows in the wire shape.
 * @throws {ListQueryError} When the query names a field the resource does not declare.
 */
export async function listConfig(
  db: PgDb,
  spec: ConfigResourceSpec,
  query: z.infer<typeof ListQuerySchema>,
): Promise<ConfigListPage> {
  const result = await runList<Record<string, unknown>>(db, {
    fields: spec.fields,
    columns: spec.columns as ColumnMap<typeof spec.fields>,
    query,
    from: spec.table,
    fallback: spec.fallback,
    searchColumns: spec.search,
  });
  return { ...result, items: result.items.map((row) => toWire(spec.table, row)) };
}

/**
 * Apply one resource's bulk save inside a caller-owned transaction.
 *
 * Exported so `POST /api/config/bulk` can apply several resources in ONE
 * transaction: a settings page with two sections either saves both or neither.
 *
 * @param tx - An open transaction. This function never opens its own.
 * @param spec - The resource.
 * @param body - The parsed `{ mode, items }`.
 * @returns How many rows were created, updated and deleted.
 * @throws {Error} Re-throws a constraint violation so the caller's transaction rolls back.
 */
export async function applyBulk(
  tx: PgDb,
  spec: ConfigResourceSpec,
  body: { mode: "upsert" | "replace"; items: Array<Record<string, unknown>> },
): Promise<BulkSaveResult> {
  let created = 0;
  let updated = 0;
  let deleted = 0;
  const keptIds: string[] = [];

  for (const item of body.items) {
    const { id, ...fields } = item as { id?: string };
    const values = toRow(spec.table, fields as Record<string, unknown>);
    if (id) {
      const rows = await tx
        .update(spec.table)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(sql`${spec.table}.id`, id))
        .returning({ id: sql<string>`id` });
      if (rows.length === 0) {
        // A client sent an id this table does not have. Never silently insert
        // it under that id: the row may have been deleted by someone else, and
        // resurrecting it would undo their delete.
        throw new BulkRowMissing(spec.resource, id);
      }
      updated += 1;
      keptIds.push(id);
    } else {
      const rows = await tx.insert(spec.table).values(values).returning({ id: sql<string>`id` });
      created += 1;
      if (rows[0]?.id) keptIds.push(String(rows[0].id));
    }
  }

  if (body.mode === "replace") {
    const rows =
      keptIds.length > 0
        ? await tx
            .delete(spec.table)
            .where(notInArray(sql`${spec.table}.id`, keptIds))
            .returning({ id: sql<string>`id` })
        : await tx.delete(spec.table).returning({ id: sql<string>`id` });
    deleted = rows.length;
  }

  return { resource: spec.resource, created, updated, deleted };
}

/** A bulk item named an id the table does not have. */
export class BulkRowMissing extends Error {
  readonly resource: string;
  readonly rowId: string;

  constructor(resource: string, rowId: string) {
    super(`${resource} has no row ${rowId}`);
    this.name = "BulkRowMissing";
    this.resource = resource;
    this.rowId = rowId;
  }
}

/**
 * Configuration API router.
 *
 * The `defaultHook` is what makes a body rejected AT THE BOUNDARY read like
 * every other error this API returns. Without it `@hono/zod-openapi` answers
 * with its own `{ success: false, error: { name: "ZodError", message: "<the
 * whole thing as a JSON string>" } }`, which is a second error shape for a
 * client to handle and which `lib/api.ts` cannot read (`ApiError.message`
 * becomes "[object Object]" — maestro `4c72d164b9f5`). Measured live on
 * 2026-10-25: `POST /api/config/people` with a bad slug answered in that shape
 * while this router's own bulk routes answered in the project envelope.
 *
 * No other router in this repo sets one, so the same inconsistency exists on
 * every other POST and PATCH; fixing those is its own change rather than a
 * silent rewrite of their error contracts here.
 */
export const shopperConfigRouter = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        errorBody(
          "invalid_config_input",
          "This configuration input is not valid.",
          fieldErrors(result.error.issues),
        ),
        400,
      );
    }
  },
});

// ---------------------------------------------------------------------------
// preferences — one household row, so not a collection.
// ---------------------------------------------------------------------------

/** The scope of the one row every surface reads. */
export const HOUSEHOLD_SCOPE = "household";

/**
 * Read the household preferences, or the defaults when nothing is stored.
 *
 * `persisted` says which it is. The defaults are the SAME values the column
 * defaults apply at insert time, so the effective configuration is identical
 * either way — but a settings page that cannot tell "never saved" from "saved
 * exactly these" would show a stale Save button, and reporting an empty table
 * as a set of real stored choices is exactly the absence-as-verdict mistake
 * this project has already paid for.
 *
 * @param db - A Drizzle client from `withPg`.
 * @returns The stored row, or the parsed defaults with `persisted: false`.
 */
export async function readPreferences(db: PgDb): Promise<PreferencesView> {
  const [row] = await db
    .select()
    .from(preferences)
    .where(eq(preferences.scope, HOUSEHOLD_SCOPE))
    .limit(1);
  if (row) return { persisted: true, ...toWire(preferences, row as Record<string, unknown>) };
  return {
    persisted: false,
    id: null,
    scope: HOUSEHOLD_SCOPE,
    updated_at: null,
    ...PreferencesInputSchema.parse({}),
  };
}

const preferencesResponse = z
  .object({ persisted: z.boolean() })
  .and(PreferencesSchema.partial().and(anyRow));

shopperConfigRouter.openapi(
  createRoute({
    method: "get",
    path: "/preferences",
    tags: ["Config"],
    summary: "Read household preferences",
    operationId: "configPreferencesGet",
    responses: {
      200: {
        description: "The household row, or the defaults with persisted false.",
        content: { "application/json": { schema: preferencesResponse } },
      },
    },
  }),
  async (c) => c.json(await withPg(c.env, readPreferences), 200),
);

shopperConfigRouter.openapi(
  createRoute({
    method: "put",
    path: "/preferences",
    tags: ["Config"],
    summary: "Save household preferences",
    operationId: "configPreferencesSave",
    request: { body: { content: { "application/json": { schema: PreferencesPatchSchema } } } },
    responses: {
      200: {
        description: "The saved row.",
        content: { "application/json": { schema: preferencesResponse } },
      },
      400: {
        description: "Invalid preferences; details carry a path per field.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const patch = c.req.valid("json") as Record<string, unknown>;
    const result = await withPg(c.env, (db) =>
      db.transaction(async (tx) => {
        const current = await readPreferences(tx);
        const { persisted, id, scope, updated_at, ...currentFields } = current;
        // Merged, then validated in full: a minimum cannot be checked against a
        // maximum the request did not send.
        const parsed = PreferencesInputSchema.safeParse({ ...currentFields, ...patch });
        if (!parsed.success) return { kind: "invalid" as const, issues: parsed.error.issues };
        const values = toRow(preferences, parsed.data as Record<string, unknown>);
        await tx
          .insert(preferences)
          .values({ scope: HOUSEHOLD_SCOPE, ...values })
          .onConflictDoUpdate({
            target: preferences.scope,
            set: { ...values, updatedAt: new Date() },
          });
        return { kind: "ok" as const, row: await readPreferences(tx) };
      }),
    );
    if (result.kind === "invalid") {
      return c.json(
        errorBody(
          "invalid_preferences",
          "These preferences are not valid.",
          fieldErrors(result.issues),
        ),
        400,
      );
    }
    return c.json(result.row, 200);
  },
);

// ---------------------------------------------------------------------------
// The eleven collections, from one description each.
// ---------------------------------------------------------------------------

for (const spec of CONFIG_RESOURCE_SPECS) {
  const listResponse = listEnvelope(anyRow);
  const notFound = {
    description: `No such ${spec.label} row.`,
    content: { "application/json": { schema: ErrorEnvelopeSchema } },
  } as const;
  const invalid = {
    description: "Invalid input; details carry a path per field.",
    content: { "application/json": { schema: ErrorEnvelopeSchema } },
  } as const;

  shopperConfigRouter.openapi(
    createRoute({
      method: "get",
      path: `/${spec.resource}`,
      tags: ["Config"],
      summary: `List ${spec.label}`,
      operationId: `config${spec.operation}List`,
      request: { query: ListQuerySchema },
      responses: {
        200: {
          description: `Paginated ${spec.label}.`,
          content: { "application/json": { schema: listResponse } },
        },
        400: invalid,
      },
    }),
    async (c) => {
      const query = c.req.valid("query");
      try {
        const page = await withPg(c.env, (db) => listConfig(db, spec, query));
        return c.json(page, 200);
      } catch (error) {
        if (error instanceof ListQueryError) {
          return c.json(errorBody("invalid_list_query", error.message, error.problems), 400);
        }
        throw error;
      }
    },
  );

  shopperConfigRouter.openapi(
    createRoute({
      method: "post",
      path: `/${spec.resource}`,
      tags: ["Config"],
      summary: `Create ${spec.label}`,
      operationId: `config${spec.operation}Create`,
      request: { body: { content: { "application/json": { schema: spec.input } } } },
      responses: {
        201: {
          description: "The created row.",
          content: { "application/json": { schema: spec.row } },
        },
        400: invalid,
      },
    }),
    async (c) => {
      const input = c.req.valid("json") as Record<string, unknown>;
      const row = await withPg(c.env, async (db) => {
        const [created] = await db
          .insert(spec.table)
          .values(toRow(spec.table, input))
          .returning({ id: sql<string>`id` });
        if (!created?.id) throw new Error(`${spec.resource} insert returned no row`);
        return loadOne(db, spec, String(created.id));
      });
      return c.json(row, 201);
    },
  );

  shopperConfigRouter.openapi(
    createRoute({
      method: "get",
      path: `/${spec.resource}/{id}`,
      tags: ["Config"],
      summary: `Get one of the ${spec.label}`,
      operationId: `config${spec.operation}Get`,
      request: { params: idParam },
      responses: {
        200: { description: "The row.", content: { "application/json": { schema: spec.row } } },
        404: notFound,
      },
    }),
    async (c) => {
      const row = await withPg(c.env, (db) => loadOne(db, spec, c.req.valid("param").id));
      if (!row) return c.json(errorBody("config_row_not_found", `No such ${spec.label} row.`), 404);
      return c.json(row, 200);
    },
  );

  shopperConfigRouter.openapi(
    createRoute({
      method: "patch",
      path: `/${spec.resource}/{id}`,
      tags: ["Config"],
      summary: `Update ${spec.label}`,
      operationId: `config${spec.operation}Patch`,
      request: {
        params: idParam,
        body: { content: { "application/json": { schema: spec.patch } } },
      },
      responses: {
        200: {
          description: "The updated row.",
          content: { "application/json": { schema: spec.row } },
        },
        400: invalid,
        404: notFound,
      },
    }),
    async (c) => {
      const id = c.req.valid("param").id;
      const patch = c.req.valid("json") as Record<string, unknown>;
      const result = await withPg(c.env, (db) =>
        db.transaction(async (tx) => {
          const current = await loadOne(tx, spec, id);
          if (!current) return { kind: "missing" as const };
          const { id: _id, created_at, updated_at, ...fields } = current;
          // Merged and re-validated in full, so the cross-field rules hold on a
          // patch that only sent one side of a pair.
          const parsed = spec.input.safeParse({ ...fields, ...patch });
          if (!parsed.success) return { kind: "invalid" as const, issues: parsed.error.issues };
          await tx
            .update(spec.table)
            .set({ ...toRow(spec.table, parsed.data as Record<string, unknown>), updatedAt: new Date() })
            .where(eq(sql`${spec.table}.id`, id));
          return { kind: "ok" as const, row: await loadOne(tx, spec, id) };
        }),
      );
      if (result.kind === "missing")
        return c.json(errorBody("config_row_not_found", `No such ${spec.label} row.`), 404);
      if (result.kind === "invalid")
        return c.json(
          errorBody("invalid_config_row", `This ${spec.label} row is not valid.`, fieldErrors(result.issues)),
          400,
        );
      return c.json(result.row, 200);
    },
  );

  shopperConfigRouter.openapi(
    createRoute({
      method: "delete",
      path: `/${spec.resource}/{id}`,
      tags: ["Config"],
      summary: `Delete ${spec.label}`,
      operationId: `config${spec.operation}Delete`,
      request: { params: idParam },
      responses: {
        200: {
          description: "The id that was deleted.",
          content: { "application/json": { schema: z.object({ id: z.string() }) } },
        },
        404: notFound,
      },
    }),
    async (c) => {
      const id = c.req.valid("param").id;
      const rows = await withPg(c.env, (db) =>
        db
          .delete(spec.table)
          .where(eq(sql`${spec.table}.id`, id))
          .returning({ id: sql<string>`id` }),
      );
      if (rows.length === 0)
        return c.json(errorBody("config_row_not_found", `No such ${spec.label} row.`), 404);
      return c.json({ id }, 200);
    },
  );

  shopperConfigRouter.openapi(
    createRoute({
      method: "put",
      path: `/${spec.resource}`,
      tags: ["Config"],
      summary: `Save all ${spec.label} in one request`,
      description:
        "mode upsert leaves rows the request did not mention alone; mode replace deletes them.",
      operationId: `config${spec.operation}BulkSave`,
      request: {
        body: {
          content: {
            "application/json": {
              schema: z.object({
                mode: BulkSaveModeSchema,
                items: z.array(anyRow).max(500),
              }),
            },
          },
        },
      },
      responses: {
        200: {
          description: "What the save changed.",
          content: { "application/json": { schema: BulkSaveResultSchema } },
        },
        400: invalid,
        404: notFound,
      },
    }),
    async (c) => {
      const body = c.req.valid("json");
      const validated = validateBulkItems(spec, body.items);
      if ("issues" in validated) {
        return c.json(
          errorBody("invalid_config_rows", `These ${spec.label} rows are not valid.`, validated.issues),
          400,
        );
      }
      try {
        const result = await withPg(c.env, (db) =>
          db.transaction((tx) => applyBulk(tx, spec, { mode: body.mode, items: validated.items })),
        );
        return c.json(result, 200);
      } catch (error) {
        if (error instanceof BulkRowMissing) {
          return c.json(
            errorBody("config_row_not_found", error.message, [
              { path: "items", message: error.message },
            ]),
            404,
          );
        }
        throw error;
      }
    },
  );
}

/**
 * Validate every item in a bulk save, reporting the INDEX of each bad row.
 *
 * One banner for a page of inputs is useless, so a failure names
 * `items.2.ends_on` rather than "invalid request".
 *
 * @param spec - The resource.
 * @param items - The raw items as sent.
 * @returns The parsed items, or the field errors with their indices.
 */
export function validateBulkItems(
  spec: ConfigResourceSpec,
  items: Array<Record<string, unknown>>,
):
  | { items: Array<Record<string, unknown>> }
  | { issues: Array<{ path: string; message: string }> } {
  const parsed: Array<Record<string, unknown>> = [];
  const issues: Array<{ path: string; message: string }> = [];
  items.forEach((item, index) => {
    const { id, ...fields } = item as { id?: unknown };
    if (id !== undefined && (typeof id !== "string" || !z.string().uuid().safeParse(id).success)) {
      issues.push({ path: `items.${index}.id`, message: "An id must be a uuid" });
      return;
    }
    const result = spec.input.safeParse(fields);
    if (!result.success) {
      for (const issue of fieldErrors(result.error.issues)) {
        issues.push({ path: `items.${index}.${issue.path}`, message: issue.message });
      }
      return;
    }
    parsed.push(id === undefined ? (result.data as Record<string, unknown>) : { id, ...(result.data as object) });
  });
  return issues.length > 0 ? { issues } : { items: parsed };
}

// ---------------------------------------------------------------------------
// One request, several resources, one transaction.
// ---------------------------------------------------------------------------

const bulkAllBody = z.object({
  mode: BulkSaveModeSchema,
  resources: z.record(z.string(), z.array(anyRow).max(500)),
});

shopperConfigRouter.openapi(
  createRoute({
    method: "post",
    path: "/bulk",
    tags: ["Config"],
    summary: "Save several configuration resources in one transaction",
    description:
      "A settings page with more than one section either saves every section or none of them.",
    operationId: "configBulkSave",
    request: { body: { content: { "application/json": { schema: bulkAllBody } } } },
    responses: {
      200: {
        description: "What each resource's save changed.",
        content: {
          "application/json": { schema: z.object({ results: z.array(BulkSaveResultSchema) }) },
        },
      },
      400: {
        description: "An unknown resource, or invalid rows; details carry a path per field.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
      404: {
        description: "An item named a row that does not exist.",
        content: { "application/json": { schema: ErrorEnvelopeSchema } },
      },
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const planned: Array<{ spec: ConfigResourceSpec; items: Array<Record<string, unknown>> }> = [];
    const issues: Array<{ path: string; message: string }> = [];

    for (const [resource, items] of Object.entries(body.resources)) {
      const spec = CONFIG_RESOURCE_SPECS.find((candidate) => candidate.resource === resource);
      if (!spec) {
        issues.push({ path: `resources.${resource}`, message: `Unknown resource "${resource}"` });
        continue;
      }
      const validated = validateBulkItems(spec, items);
      if ("issues" in validated) {
        for (const issue of validated.issues) {
          issues.push({ path: `resources.${resource}.${issue.path}`, message: issue.message });
        }
        continue;
      }
      planned.push({ spec, items: validated.items });
    }

    if (issues.length > 0) {
      return c.json(errorBody("invalid_config_rows", "These configuration rows are not valid.", issues), 400);
    }

    try {
      const results = await withPg(c.env, (db) =>
        db.transaction(async (tx) => {
          const out: BulkSaveResult[] = [];
          for (const { spec, items } of planned) {
            out.push(await applyBulk(tx, spec, { mode: body.mode, items }));
          }
          return out;
        }),
      );
      return c.json({ results }, 200);
    } catch (error) {
      if (error instanceof BulkRowMissing) {
        return c.json(
          errorBody("config_row_not_found", error.message, [
            { path: `resources.${error.resource}`, message: error.message },
          ]),
          404,
        );
      }
      throw error;
    }
  },
);
