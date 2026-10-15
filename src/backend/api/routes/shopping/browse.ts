/**
 * @fileoverview Browser runs over the `CORE_BROWSER` binding (maestro cs-be-6-6).
 *
 * - `POST /api/goals/{id}/browse` starts one core-browser job for a goal and
 *   records it as an `agent_runs` row with `client = browser`.
 * - `POST /api/runs/{id}/sync` reads the job back, copies its new events into
 *   `run_events`, and finishes the run when the job is terminal. When the job
 *   succeeded, the findings in its final answer go through `recordSighting`
 *   (cs-be-3-4), so browser and MCP sightings get the same dedupe answer.
 *
 * Every submit spends core-browser budget, so a browse request is refused when
 * the goal is not active, a browser run for it is still running, today's
 * `BROWSER_DAILY_RUN_CAP` is reached, or core-browser's cost guard is tripped.
 * The rules are pure functions in `@/backend/browser` (`gateBrowse`).
 *
 * Mount `browseGoalsRouter` at `/api/goals` and `browseRunsRouter` at `/api/runs`.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq, gte, like, ne, or, sql } from "drizzle-orm";

import {
  BROWSER_JOB_EVENT_KIND,
  browserHealth,
  browserResult,
  browserSubmit,
  buildBrowsePrompt,
  dailyRunCap,
  eventsToCopy,
  gateBrowse,
  jobSummary,
  runStatusForJob,
  type BrowserHealth,
} from "@/backend/browser";
import { findingToSighting, parseBrowserFindings, recordSighting } from "@/backend/catalog";
import { withPg, type PgDb } from "@/backend/pg/client";
import { goalCriteria } from "@/backend/pg/schemas/goals/goal-criteria";
import { goals } from "@/backend/pg/schemas/goals/goals";
import { agentRuns, runEvents, runGoals } from "@/backend/pg/schemas/runs/runs";
import { ErrorEnvelopeSchema } from "@/shared/contracts/common";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BrowseStartedSchema = z
  .object({
    run_id: z.uuid(),
    job_id: z.string(),
    goal_id: z.uuid(),
  })
  .meta({ id: "BrowseStarted" });

const BrowseSyncSchema = z
  .object({
    run_id: z.uuid(),
    job_id: z.string(),
    run_status: z.enum(["running", "succeeded", "failed", "abandoned"]),
    job_status: z.string(),
    events_added: z.number().int().nonnegative(),
    /** Set only by the sync that finished a succeeded run; null otherwise. */
    sightings: z
      .object({
        recorded: z.number().int().nonnegative(),
        new: z.number().int().nonnegative(),
        resighting: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        /** Why no findings could be read from the final answer, when none could. */
        error: z.string().nullable(),
      })
      .nullable(),
  })
  .meta({ id: "BrowseSync" });

/** What recording a succeeded job's findings did. */
type SightingTally = { recorded: number; new: number; resighting: number; failed: number; error: string | null };

/**
 * Record the findings in a succeeded job's final answer as sightings, and log
 * the outcome as one `browser.findings` run event.
 *
 * @param db - A Drizzle client.
 * @param runId - The run.
 * @param events - The job's full events (messages are not truncated here).
 * @returns The tally.
 */
async function recordJobFindings(
  db: PgDb,
  runId: string,
  events: { seq: number; kind: string; message: string | null }[],
): Promise<SightingTally> {
  const tally: SightingTally = { recorded: 0, new: 0, resighting: 0, failed: 0, error: null };
  const [goal] = await db
    .select({ id: goals.id, category: goals.category, currency: goals.currency })
    .from(runGoals)
    .innerJoin(goals, eq(goals.id, runGoals.goalId))
    .where(eq(runGoals.runId, runId))
    .limit(1);
  const parsed = parseBrowserFindings(events);
  const failures: string[] = [];
  if (!goal) tally.error = "the run has no goal";
  else if (!parsed.ok) tally.error = parsed.reason;
  else {
    for (const finding of parsed.findings) {
      const input = findingToSighting(finding, { runId, goalId: goal.id, category: goal.category, currency: goal.currency });
      if (!input) {
        tally.failed++;
        failures.push("a finding with no title and no url");
        continue;
      }
      try {
        const answer = await recordSighting(db, input);
        tally.recorded++;
        if (answer.status === "new") tally.new++;
        else tally.resighting++;
      } catch (error) {
        tally.failed++;
        failures.push(`${input.title}: ${errorText(error)}`);
      }
    }
  }
  const message = tally.error
    ? `No sightings recorded: ${tally.error}`
    : `${tally.recorded.toLocaleString("en-US")} sightings recorded (${tally.new.toLocaleString("en-US")} new, ${tally.resighting.toLocaleString("en-US")} re-sightings), ${tally.failed.toLocaleString("en-US")} failed`;
  await db.insert(runEvents).values({
    runId,
    kind: "browser.findings",
    level: tally.error || tally.failed ? "error" : "info",
    message,
    data: { ...tally, failures: failures.slice(0, 20) },
  });
  return tally;
}

function errorBody(code: string, message: string, details?: unknown) {
  return ErrorEnvelopeSchema.parse({ error: { code, message, ...(details === undefined ? {} : { details }) } });
}

function errorResponse(description: string) {
  return { description, content: { "application/json": { schema: ErrorEnvelopeSchema } } };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const browseGoalsRouter = new OpenAPIHono<{ Bindings: Env }>();
export const browseRunsRouter = new OpenAPIHono<{ Bindings: Env }>();

browseGoalsRouter.openapi(
  createRoute({
    method: "post",
    path: "/{id}/browse",
    tags: ["Goals"],
    summary: "Start a browser run for a goal",
    description:
      "Submits one core-browser job built from the goal and records it as a run with client=browser. Spends core-browser budget; refused when the goal is not active, a browser run for it is running, the daily cap is reached, or the cost guard is tripped.",
    operationId: "goalsBrowse",
    request: { params: z.object({ id: z.string().min(1).max(200) }) },
    responses: {
      202: { description: "Job submitted; poll POST /api/runs/{run_id}/sync.", content: { "application/json": { schema: BrowseStartedSchema } } },
      404: errorResponse("Goal not found."),
      409: errorResponse("Goal not active, or a browser run for it is running."),
      429: errorResponse("Daily browser run cap reached."),
      502: errorResponse("core-browser refused the job."),
      503: errorResponse("core-browser unavailable or its cost guard is tripped."),
    },
  }),
  async (c) => {
    const identifier = c.req.valid("param").id;
    const env = c.env;
    const prepared = await withPg(env, async (db) => {
      const [goal] = await db
        .select()
        .from(goals)
        .where(uuidPattern.test(identifier) ? or(eq(goals.id, identifier), eq(goals.slug, identifier)) : eq(goals.slug, identifier))
        .limit(1);
      if (!goal) return null;
      const criteria = await db
        .select({ label: goalCriteria.label, kind: goalCriteria.kind })
        .from(goalCriteria)
        .where(eq(goalCriteria.goalId, goal.id))
        .orderBy(asc(goalCriteria.position));
      const [{ running }] = await db
        .select({ running: sql<number>`count(*)::int` })
        .from(agentRuns)
        .innerJoin(runGoals, eq(runGoals.runId, agentRuns.id))
        .where(and(eq(runGoals.goalId, goal.id), eq(agentRuns.client, "browser"), eq(agentRuns.status, "running")));
      const [{ today }] = await db
        .select({ today: sql<number>`count(*)::int` })
        .from(agentRuns)
        .where(and(eq(agentRuns.client, "browser"), gte(agentRuns.startedAt, sql`date_trunc('day', now() at time zone 'utc') at time zone 'utc'`)));
      return { goal, criteria, running, today };
    });
    if (!prepared) return c.json(errorBody("goal_not_found", "Goal not found."), 404);
    const { goal, criteria } = prepared;

    let health: BrowserHealth | null = null;
    try {
      health = await browserHealth(env);
    } catch {
      health = null;
    }
    const gate = gateBrowse({
      goalStatus: goal.status,
      runningForGoal: prepared.running,
      startedToday: prepared.today,
      cap: dailyRunCap(env.BROWSER_DAILY_RUN_CAP),
      health,
    });
    if (!gate.ok) return c.json(errorBody(gate.code, gate.reason), gate.status);

    const prompt = buildBrowsePrompt(
      {
        ...goal,
        windowStart: goal.windowStart ? String(goal.windowStart) : null,
        windowEnd: goal.windowEnd ? String(goal.windowEnd) : null,
      },
      criteria,
    );

    // The run is written before the submit, so a submit that fails is still recorded.
    const runId = await withPg(env, (db) =>
      db.transaction(async (tx) => {
        const [run] = await tx
          .insert(agentRuns)
          .values({ client: "browser", model: "core-browser", status: "running", summary: `Browser run for ${goal.title}` })
          .returning({ id: agentRuns.id });
        await tx.insert(runGoals).values({ runId: run.id, goalId: goal.id });
        return run.id;
      }),
    );

    let jobId: string;
    try {
      jobId = (await browserSubmit(env, prompt)).id;
    } catch (error) {
      const message = `core-browser refused the job: ${errorText(error)}`;
      await withPg(env, (db) =>
        db.update(agentRuns).set({ status: "failed", finishedAt: new Date(), error: message }).where(eq(agentRuns.id, runId)),
      );
      return c.json(errorBody("browser_submit_failed", message, { run_id: runId }), 502);
    }

    await withPg(env, async (db) => {
      await db.insert(runEvents).values({
        runId,
        kind: BROWSER_JOB_EVENT_KIND,
        message: `core-browser job ${jobId} submitted`,
        data: { jobId, promptChars: prompt.length },
      });
      await db.update(goals).set({ lastRunAt: new Date() }).where(eq(goals.id, goal.id));
    });
    return c.json(BrowseStartedSchema.parse({ run_id: runId, job_id: jobId, goal_id: goal.id }), 202);
  },
);

browseRunsRouter.openapi(
  createRoute({
    method: "post",
    path: "/{id}/sync",
    tags: ["Runs"],
    summary: "Sync a browser run from its core-browser job",
    description:
      "Reads the run's core-browser job, copies new job events into run_events, and finishes the run when the job is terminal. When the job succeeded, records the findings in its final answer as sightings. No spend.",
    operationId: "runsSync",
    request: { params: z.object({ id: z.uuid() }) },
    responses: {
      200: { description: "Run synced.", content: { "application/json": { schema: BrowseSyncSchema } } },
      404: errorResponse("Run not found."),
      409: errorResponse("The run is not a browser run."),
      502: errorResponse("core-browser did not answer."),
    },
  }),
  async (c) => {
    const runId = c.req.valid("param").id;
    const env = c.env;
    const found = await withPg(env, async (db) => {
      const [run] = await db.select({ id: agentRuns.id, client: agentRuns.client, status: agentRuns.status }).from(agentRuns).where(eq(agentRuns.id, runId));
      if (!run) return null;
      const [jobEvent] = await db
        .select({ data: runEvents.data })
        .from(runEvents)
        .where(and(eq(runEvents.runId, runId), eq(runEvents.kind, BROWSER_JOB_EVENT_KIND)))
        .limit(1);
      const [{ lastSeq }] = await db
        .select({ lastSeq: sql<number>`coalesce(max((${runEvents.data}->>'seq')::int), -1)::int` })
        .from(runEvents)
        .where(and(eq(runEvents.runId, runId), like(runEvents.kind, "browser.%"), ne(runEvents.kind, BROWSER_JOB_EVENT_KIND)));
      return { run, jobId: (jobEvent?.data as { jobId?: string } | null)?.jobId ?? null, lastSeq };
    });
    if (!found) return c.json(errorBody("run_not_found", "Run not found."), 404);
    if (found.run.client !== "browser" || !found.jobId) {
      return c.json(errorBody("not_a_browser_run", "This run has no core-browser job."), 409);
    }
    const jobId = found.jobId;

    let outcome: Awaited<ReturnType<typeof browserResult>>;
    try {
      outcome = await browserResult(env, jobId);
    } catch (error) {
      return c.json(errorBody("browser_unavailable", `core-browser did not answer result(): ${errorText(error)}`), 502);
    }

    const inserts = outcome ? eventsToCopy(outcome.events, found.lastSeq) : [];
    const runStatus = outcome ? runStatusForJob(outcome.job.status) : "failed";
    const sightingTally = await withPg(env, async (db) => {
      if (inserts.length) await db.insert(runEvents).values(inserts.map((e) => ({ ...e, runId })));
      if (found.run.status !== "running" || runStatus === "running") return null;
      // Conditional on status = running, so of two concurrent syncs only one
      // finishes the run, and only that one records the findings.
      const finished = await db
        .update(agentRuns)
        .set({
          status: runStatus,
          finishedAt: new Date(),
          summary: outcome ? jobSummary(outcome.job) : "core-browser has no such job",
          error: outcome ? outcome.job.error : `core-browser has no job ${jobId}`,
        })
        .where(and(eq(agentRuns.id, runId), eq(agentRuns.status, "running")))
        .returning({ id: agentRuns.id });
      if (!finished.length || runStatus !== "succeeded" || !outcome) return null;
      return recordJobFindings(db, runId, outcome.events);
    });

    return c.json(
      BrowseSyncSchema.parse({
        run_id: runId,
        job_id: jobId,
        run_status: found.run.status === "running" ? runStatus : found.run.status,
        job_status: outcome?.job.status ?? "missing",
        events_added: inserts.length,
        sightings: sightingTally,
      }),
      200,
    );
  },
);
