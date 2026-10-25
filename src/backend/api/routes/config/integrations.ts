/**
 * @fileoverview `GET /api/integrations` (maestro cs-be-2-8, cs-c-08): what
 * every outside service this Worker depends on is doing right now.
 *
 * Mount at `/api/integrations` from the root API application.
 *
 * The declarations and the rules that turn a probe into a verdict live in
 * `integration-rules.ts`, which has no value imports so a plain-Node
 * self-check can drive every branch. This file does the probing: it asks
 * core-browser, core-guardian and Postgres how they are, and merges the
 * answers onto the declarations.
 *
 * Every probe here is a REAL call, not a check that a binding exists. A
 * binding present and a service answering are different facts, and on this
 * project they have differed.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq, gte, sql } from "drizzle-orm";

import { coreBrowserStub, probeCoreBrowser } from "@/backend/browser/index";
import { dailyRunCap } from "@/backend/browser/runs";
import { withPg } from "@/backend/pg/client";
import { agentRuns } from "@/backend/pg/schemas/runs/runs";
import {
  absenceStatus,
  classifyCoreBrowser,
  INTEGRATION_DECLARATIONS,
  INTEGRATION_REQUIREMENTS,
  INTEGRATION_STATUSES,
  overallStatus,
  type ProbeAnswer,
} from "@/backend/api/routes/config/integration-rules";

export {
  absenceStatus,
  classifyCoreBrowser,
  INTEGRATION_DECLARATIONS,
  INTEGRATION_REQUIREMENTS,
  INTEGRATION_STATUSES,
  overallStatus,
};
export type {
  IntegrationDeclaration,
  IntegrationRequirement,
  IntegrationStatus,
  ProbeAnswer,
} from "@/backend/api/routes/config/integration-rules";

const integrationSchema = z.object({
  id: z.string(),
  label: z.string(),
  transport: z.string(),
  requirement: z.enum(INTEGRATION_REQUIREMENTS),
  purpose: z.string(),
  status: z.enum(INTEGRATION_STATUSES),
  message: z.string(),
  /** The Maestro task that builds a planned integration. */
  task: z.string().nullable(),
  /** Whatever that integration can say about itself. Never invented. */
  details: z.record(z.string(), z.unknown()).nullable(),
  /** How long the probe took, or null for one that was not probed. */
  duration_ms: z.number().int().nonnegative().nullable(),
});

const integrationsResponse = z.object({
  status: z.enum(["ok", "degraded", "fail"]),
  checked_at: z.string(),
  integrations: z.array(integrationSchema),
});

/** Integrations API router. */
export const integrationsRouter = new OpenAPIHono<{ Bindings: Env }>();

integrationsRouter.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Config"],
    summary: "Report every declared integration",
    description:
      "The list is declared, not discovered, so a deleted binding reads as a failure and an unbuilt integration reads as a stated gap.",
    operationId: "integrationsList",
    responses: {
      200: {
        description: "Every declared integration with its own status.",
        content: { "application/json": { schema: integrationsResponse } },
      },
    },
  }),
  async (c) => {
    const env = c.env;
    const answers = new Map<string, ProbeAnswer & { durationMs: number | null }>();

    // core-browser: the shared probe, plus today's job count against the cap.
    {
      const started = Date.now();
      const cap = dailyRunCap((env as unknown as Record<string, unknown>).BROWSER_DAILY_RUN_CAP);
      const probe = await probeCoreBrowser(coreBrowserStub(env));
      let jobsToday: number | null = 0;
      try {
        jobsToday = await withPg(env, async (db) => {
          const [row] = await db
            .select({ n: sql<number>`count(*)::int` })
            .from(agentRuns)
            .where(
              and(eq(agentRuns.client, "browser"), gte(agentRuns.startedAt, sql`current_date`)),
            );
          return Number(row?.n ?? 0);
        });
      } catch {
        // The database being unreachable is reported by the postgres entry
        // below. It must not turn core-browser's own verdict into a lie, and a
        // count of 0 would be a measurement nobody took, so the count is
        // reported as UNKNOWN.
        jobsToday = null;
      }
      answers.set("core_browser", {
        ...classifyCoreBrowser(probe, jobsToday, cap),
        durationMs: Date.now() - started,
      });
    }

    // core-guardian: the no-spend use-case listing, the same call /api/health makes.
    {
      const started = Date.now();
      const stub = (env as unknown as { CORE_GUARDIAN?: { useCases?: () => Promise<unknown> } })
        .CORE_GUARDIAN;
      if (!stub || typeof stub.useCases !== "function") {
        answers.set("core_guardian", {
          status: "fail",
          message: "CORE_GUARDIAN service binding not present",
          durationMs: Date.now() - started,
        });
      } else {
        try {
          const useCases = await stub.useCases();
          const count = Array.isArray(useCases) ? useCases.length : null;
          answers.set("core_guardian", {
            status: "ok",
            message:
              count === null
                ? "core-guardian answered."
                : `core-guardian answered with ${count.toLocaleString("en-US")} use cases.`,
            details: {
              use_cases: count,
              project: (env as unknown as Record<string, unknown>).GUARDIAN_PROJECT ?? null,
            },
            durationMs: Date.now() - started,
          });
        } catch (error) {
          answers.set("core_guardian", {
            status: "fail",
            message: `core-guardian refused: ${error instanceof Error ? error.message : String(error)}`,
            durationMs: Date.now() - started,
          });
        }
      }
    }

    // Postgres: a real query, not the presence of the binding.
    {
      const started = Date.now();
      try {
        const tables = await withPg(env, async (db) => {
          const result = await db.execute(
            sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`,
          );
          return Number(result.rows[0]?.n ?? 0);
        });
        answers.set("postgres", {
          status: "ok",
          message: `core_shopping answered with ${tables.toLocaleString("en-US")} tables.`,
          details: { public_tables: tables },
          durationMs: Date.now() - started,
        });
      } catch (error) {
        answers.set("postgres", {
          status: "fail",
          message: `core_shopping unreachable: ${error instanceof Error ? error.message : String(error)}`,
          durationMs: Date.now() - started,
        });
      }
    }

    const integrations = INTEGRATION_DECLARATIONS.map((declaration) => {
      const answer = answers.get(declaration.id);
      if (answer) {
        return {
          ...declaration,
          task: declaration.task ?? null,
          status: answer.status,
          message: answer.message,
          details: answer.details ?? null,
          duration_ms: answer.durationMs,
        };
      }
      return {
        ...declaration,
        task: declaration.task ?? null,
        status: absenceStatus(declaration.requirement),
        message:
          declaration.requirement === "planned"
            ? `Not built yet; ${declaration.task ?? "no task"} builds it.`
            : "Declared, but this Worker has no probe for it.",
        details: null,
        duration_ms: null,
      };
    });

    return c.json(
      {
        status: overallStatus(integrations.map((i) => i.status)),
        checked_at: new Date().toISOString(),
        integrations,
      },
      200,
    );
  },
);
