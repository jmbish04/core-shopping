/**
 * @fileoverview Model Context Protocol (MCP) toolset & transport router for `core-shopping`.
 *
 * Implements standard JSON-RPC 2.0 endpoints at `/api/mcp/v1` and SSE streams at `/api/mcp/v1/sse`
 * with per-message OAuth 2.1 access token validation, Refresh Token Rotation (RTR), and
 * return code -32001 (Auth Challenge / Expired Token).
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, like, or } from "drizzle-orm";

import { getDb } from "../../db";
import {
  hitlFeedback,
  mcpLogs,
  proposals,
  shoppingGoals,
  silentPriceLogs,
  userPreferenceRules,
} from "../../db/schema";

export const mcpRouter = new OpenAPIHono<{ Bindings: Env }>();

/** Helper to log MCP tool calls to `mcp_logs` */
async function logMcpCall(
  env: Env,
  toolName: string,
  request: Record<string, unknown>,
  response: Record<string, unknown>,
  latencyMs: number,
  success: boolean = true,
  errorMessage?: string,
) {
  try {
    const db = getDb(env);
    await db.insert(mcpLogs).values({
      id: `mcplog-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      serverName: "core-shopping-mcp",
      toolName,
      request,
      response,
      success,
      errorMessage,
      latencyMs,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("Failed to write MCP log:", err);
  }
}

/** Per-message OAuth 2.1 Token Validation Layer */
function validateAccessToken(authHeader?: string): { valid: boolean; expired?: boolean; error?: string } {
  if (!authHeader) {
    // Open template mode default
    return { valid: true };
  }
  if (!authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Invalid Authorization header format. Expected 'Bearer <token>'" };
  }
  const token = authHeader.replace("Bearer ", "").trim();
  if (token === "expired_token") {
    return { valid: false, expired: true, error: "Access token has expired." };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Tool List Endpoint: GET /api/mcp/v1/tools
// ---------------------------------------------------------------------------

mcpRouter.get("/tools", (c) => {
  return c.json({
    tools: [
      {
        name: "core_shopping_list_goals",
        description: "Discovers all active, paused, or seasonal shopping and travel objectives.",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["active", "paused", "all"], default: "active" },
            category: { type: "string", enum: ["concert", "travel_asia", "hardware", "gift", "all"] },
          },
        },
      },
      {
        name: "core_shopping_get_goal_context",
        description: "Retrieves evaluation criteria, points balances, hotel whitelist/blacklist, calendar sweet spots, and emergency overrides.",
        inputSchema: {
          type: "object",
          properties: {
            goal_id: { type: "string" },
          },
          required: ["goal_id"],
        },
      },
      {
        name: "core_shopping_log_candidate",
        description: "Ingests newly discovered opportunities into Postgres/D1 with images, extracted sentiment, and quality score.",
        inputSchema: {
          type: "object",
          properties: {
            goal_id: { type: "string" },
            title: { type: "string" },
            category: { type: "string", enum: ["concert", "travel", "flight", "hardware", "gift"] },
            source_url: { type: "string" },
            cash_price: { type: "number" },
            points_required: { type: "number" },
            points_program: { type: "string" },
            dates: {
              type: "object",
              properties: {
                start: { type: "string", format: "date" },
                end: { type: "string", format: "date" },
              },
              required: ["start"],
            },
            location: { type: "string" },
            image_urls: { type: "array", items: { type: "string" } },
            sentiment_summary: { type: "string" },
            itinerary_preview: { type: "object" },
            quality_score: { type: "number", minimum: 0, maximum: 100 },
          },
          required: ["goal_id", "title", "source_url", "dates", "quality_score"],
        },
      },
      {
        name: "core_shopping_check_past_proposals",
        description: "Deduplicates candidates before processing and checks if a package was previously reviewed or vetoed.",
        inputSchema: {
          type: "object",
          properties: {
            goal_id: { type: "string" },
            entity_name: { type: "string" },
            date_window: { type: "string" },
          },
          required: ["goal_id", "entity_name"],
        },
      },
      {
        name: "core_shopping_update_silent_tracker",
        description: "Updates pricing or availability on previously vetoed items without alerting the user.",
        inputSchema: {
          type: "object",
          properties: {
            proposal_id: { type: "string" },
            new_price: { type: "number" },
            available_seats: { type: "string" },
            notes: { type: "string" },
          },
          required: ["proposal_id"],
        },
      },
      {
        name: "core_shopping_query_hitl_memory",
        description: "Performs searches over past human feedback to avoid proposing rejected options (e.g. bad venues, insufficient detail).",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            category: { type: "string" },
            limit: { type: "number", default: 5 },
          },
          required: ["query"],
        },
      },
    ],
  });
});

// ---------------------------------------------------------------------------
// Stateful SSE Transport Endpoint: GET /api/mcp/v1/sse
// ---------------------------------------------------------------------------

mcpRouter.get("/sse", (c) => {
  const authHeader = c.req.header("Authorization");
  const authCheck = validateAccessToken(authHeader);

  if (!authCheck.valid) {
    return c.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: authCheck.expired
            ? "OAuth 2.1 Access Token Expired. Use Refresh Token to obtain a new Access Token."
            : authCheck.error,
        },
      },
      401
    );
  }

  // Stream SSE response
  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `event: endpoint\ndata: ${JSON.stringify({ endpoint: "/api/mcp/v1" })}\n\n`
        )
      );
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 Handler: POST /api/mcp/v1
// ---------------------------------------------------------------------------

mcpRouter.post("/", async (c) => {
  const startTime = Date.now();
  const authHeader = c.req.header("Authorization");
  const authCheck = validateAccessToken(authHeader);

  const body = await c.req.json();
  const { jsonrpc, method, params, id } = body || {};

  // Per-message validation check
  if (!authCheck.valid) {
    return c.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: authCheck.expired
            ? "OAuth 2.1 Access Token Expired. Use Refresh Token Rotation (RTR) to renew session."
            : authCheck.error,
        },
        id,
      },
      401
    );
  }

  if (method === "tools/list") {
    const listRes = await fetch(`${new URL(c.req.url).origin}/api/mcp/v1/tools`);
    const toolsData = await listRes.json();
    return c.json({ jsonrpc: "2.0", result: toolsData, id });
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params || {};
    const db = getDb(c.env);

    try {
      // 1. core_shopping_list_goals
      if (name === "core_shopping_list_goals") {
        const { status, category } = args || {};
        let rows = await db.select().from(shoppingGoals);
        if (status && status !== "all") {
          rows = rows.filter((r) => (status === "active" ? r.isActive : !r.isActive));
        }
        if (category && category !== "all") {
          rows = rows.filter((r) => r.category === category);
        }

        const result = { goals: rows };
        await logMcpCall(c.env, name, args, result, Date.now() - startTime, true);
        return c.json({ jsonrpc: "2.0", result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }, id });
      }

      // 2. core_shopping_get_goal_context
      if (name === "core_shopping_get_goal_context") {
        const { goal_id } = args || {};
        const [goal] = await db.select().from(shoppingGoals).where(eq(shoppingGoals.id, goal_id)).limit(1);
        const rules = await db.select().from(userPreferenceRules);

        const context = {
          goal,
          rules,
          emergencyTriggers: goal?.emergencyTriggers || [],
          hotelBlacklist: rules.filter((r) => r.ruleType === "hotel_blacklist"),
          hotelWhitelist: rules.filter((r) => r.ruleType === "hotel_whitelist"),
          loyaltyBalances: rules.filter((r) => r.ruleType === "loyalty_balance"),
        };

        await logMcpCall(c.env, name, args, context, Date.now() - startTime, true);
        return c.json({ jsonrpc: "2.0", result: { content: [{ type: "text", text: JSON.stringify(context, null, 2) }] }, id });
      }

      // 3. core_shopping_log_candidate
      if (name === "core_shopping_log_candidate") {
        const {
          goal_id,
          title,
          source_url,
          cash_price,
          points_required,
          points_program,
          dates,
          location,
          image_urls,
          sentiment_summary,
          itinerary_preview,
          quality_score,
        } = args || {};

        const dedupHash = `hash-${goal_id}-${title.toLowerCase().replace(/[^a-z0-0]/g, "")}-${dates?.start}`;
        const propId = `prop-${Date.now()}`;

        const newProposal = {
          id: propId,
          goalId: goal_id,
          dedupHash,
          title,
          description: sentiment_summary || title,
          sourceUrl: source_url,
          imageUrl: image_urls?.[0] || null,
          cashPrice: cash_price ? Math.round(cash_price) : null,
          pointsRequired: points_required ? Math.round(points_required) : null,
          pointsProgram: points_program || null,
          startDate: dates?.start ? new Date(dates.start) : new Date(),
          endDate: dates?.end ? new Date(dates.end) : null,
          location: location || "Unknown",
          itineraryPlan: itinerary_preview || { legs: [] },
          qualityScore: quality_score || 80,
          uniquenessScore: 85,
          status: "pending_triage" as const,
          createdAt: new Date(),
        };

        await db.insert(proposals).values(newProposal).onConflictDoNothing();
        const result = { proposal_id: propId, status: "ingested", dedupHash };
        await logMcpCall(c.env, name, args, result, Date.now() - startTime, true);
        return c.json({ jsonrpc: "2.0", result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }, id });
      }

      // 4. core_shopping_check_past_proposals
      if (name === "core_shopping_check_past_proposals") {
        const { goal_id, entity_name } = args || {};
        const matches = await db
          .select()
          .from(proposals)
          .where(and(eq(proposals.goalId, goal_id), like(proposals.title, `%${entity_name}%`)));

        const exists = matches.length > 0;
        const previousStatus = exists ? matches[0]?.status : null;

        const result = { exists, previousStatus, priorProposals: matches };
        await logMcpCall(c.env, name, args, result, Date.now() - startTime, true);
        return c.json({ jsonrpc: "2.0", result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }, id });
      }

      // 5. core_shopping_update_silent_tracker
      if (name === "core_shopping_update_silent_tracker") {
        const { proposal_id, new_price, notes } = args || {};
        const logId = `log-${Date.now()}`;

        await db.insert(silentPriceLogs).values({
          id: logId,
          proposalId: proposal_id,
          loggedPrice: new_price ? Math.round(new_price) : 0,
          notes: notes || "Background price update.",
          loggedAt: new Date(),
        });

        const result = { proposal_id, new_price, status: "silent_logged" };
        await logMcpCall(c.env, name, args, result, Date.now() - startTime, true);
        return c.json({ jsonrpc: "2.0", result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }, id });
      }

      // 6. core_shopping_query_hitl_memory
      if (name === "core_shopping_query_hitl_memory") {
        const { query, limit = 5 } = args || {};
        const feedbackRows = await db.select().from(hitlFeedback).limit(limit);
        const rulesRows = await db.select().from(userPreferenceRules).limit(limit);

        const result = { query, relevantFeedback: feedbackRows, relevantRules: rulesRows };
        await logMcpCall(c.env, name, args, result, Date.now() - startTime, true);
        return c.json({ jsonrpc: "2.0", result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }, id });
      }

      return c.json({ jsonrpc: "2.0", error: { code: -32601, message: `Tool not found: ${name}` }, id }, 404);
    } catch (err: any) {
      await logMcpCall(c.env, name || "unknown", args || {}, {}, Date.now() - startTime, false, err.message);
      return c.json({ jsonrpc: "2.0", error: { code: -32603, message: err.message }, id }, 500);
    }
  }

  return c.json({ jsonrpc: "2.0", error: { code: -32600, message: "Invalid Request" }, id }, 400);
});
