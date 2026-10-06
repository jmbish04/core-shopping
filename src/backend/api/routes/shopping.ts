/**
 * @fileoverview Shopping & Concierge REST API router.
 *
 * Provides endpoints for Mission Control telemetry, Goal Matrix & Rule Engine,
 * HITL Swipe Triage, Turnkey Itineraries, Silent Radar, and Vector Memory.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";

import { getDb } from "../../db";
import {
  agentRunLogs,
  hitlFeedback,
  proposals,
  shoppingGoals,
  silentPriceLogs,
  userPreferenceRules,
} from "../../db/schema";

export const shoppingRouter = new OpenAPIHono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Seed endpoint: Populates rich initial data if database is empty or requested
// ---------------------------------------------------------------------------

shoppingRouter.post("/seed", async (c) => {
  const db = getDb(c.env);

  // Check if already seeded
  const existingGoals = await db.select().from(shoppingGoals).limit(1);
  if (existingGoals.length > 0) {
    const override = c.req.query("force") === "true";
    if (!override) {
      return c.json({ message: "Database already seeded with shopping goals.", seeded: false }, 200);
    }
  }

  const now = new Date();

  // 1. Seed Shopping Goals
  const goalConcerts = {
    id: "goal-concerts-sf",
    title: "San Francisco & Bay Area Concerts / Comedy",
    category: "concert",
    systemPrompt:
      "Monitor local concert presales, ticket drops, and comedy shows in SF/Bay Area within $25-$250 price range. Keep watch for favorite artists (Adele, Pink, Chelsea Handler, ODESZA, Zhou Shen, Sammi Cheng). Flag special $25 local shows for up-and-coming or favorite artists.",
    budgetMin: 25,
    budgetMax: 250,
    pointsPrograms: ["Chase Sapphire Reserve", "Amex Platinum"],
    emergencyTriggers: ["Sammi Cheng anywhere in Asia/US", "Adele SFO or Las Vegas", "ODESZA local $25 surprise show"],
    isActive: true,
    runScheduleCron: "0 8 * * *",
    lastRunAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const goalAsiaVacation = {
    id: "goal-asia-vacation",
    title: "2-3 Week Asia Multi-Leg Turnkey Vacation",
    category: "travel_asia",
    systemPrompt:
      "Find award travel direct business class flights from SFO/OAK/SJC to Taiwan, Singapore, Philippines, or Japan. Match calendar windows where Jason visits home in Singapore and visits a nearby 2-3 day destination (Taipei, Tokyo, Manila). Hotel standards: clean boutique, high floor, subway <400m. Absolutely NO dead-bug properties like Hilton Palm Springs. Include luxury shopping tax refund tips (LV, Gucci), night markets, and mandatory afternoon 90-min nap/spa blocks.",
    budgetMin: 500,
    budgetMax: 3500,
    pointsPrograms: ["Singapore KrisFlyer", "Starlux Airlines", "Chase Ultimate Rewards", "Amex Membership Rewards"],
    emergencyTriggers: ["Starlux Business Class SFO-TPE under 75k points", "Taiwan Pride + Sammi Cheng concert alignment"],
    isActive: true,
    runScheduleCron: "0 12 * * *",
    lastRunAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const goalWorkstation = {
    id: "goal-ai-workstation",
    title: "AI Powered Local Workstation & Hardware Deals",
    category: "hardware",
    systemPrompt:
      "Watch for Amazon Prime Day and B&H deals on Mac Studio M3 Ultra or high VRAM AI workstations. Filter out junk sales and highlight genuine hardware discounts.",
    budgetMin: 1200,
    budgetMax: 3200,
    pointsPrograms: ["Amex Platinum"],
    emergencyTriggers: ["Shark Slurpee Machine under $150", "Mac Studio 64GB under $1800"],
    isActive: true,
    runScheduleCron: "0 18 * * *",
    lastRunAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(shoppingGoals).values([goalConcerts, goalAsiaVacation, goalWorkstation]).onConflictDoNothing();

  // 2. Seed User Preference Rules
  const rules = [
    {
      id: "rule-hotel-blacklist-hilton-ps",
      ruleType: "hotel_blacklist",
      targetEntity: "Hilton Palm Springs",
      sentimentScore: -1.0,
      reasoning: "Dead bugs found in sheets and pillows during friend's wedding trip. Unacceptable hygiene standards.",
      metadata: { severity: "strict_blacklist", category: "cleanliness" },
      updatedAt: now,
    },
    {
      id: "rule-hotel-whitelist-boutique",
      ruleType: "hotel_whitelist",
      targetEntity: "Boutique Transit-Connected Hotels",
      sentimentScore: 0.95,
      reasoning: "High cleanliness scores, quiet rooms, MTR/subway station within 400 meters, non-resort/non-convention feel.",
      metadata: { maxWalkMinutes: 5, elevatorRequired: true },
      updatedAt: now,
    },
    {
      id: "rule-loyalty-balances",
      ruleType: "loyalty_balance",
      targetEntity: "Points Inventory",
      sentimentScore: 1.0,
      reasoning: "Chase Sapphire Reserve (280k pts), Amex Platinum (320k pts), Singapore KrisFlyer (110k pts). Target redemption >= 1.8c/pt.",
      metadata: { chase: 280000, amex: 320000, krisflyer: 110000, minCentsPerPoint: 1.8 },
      updatedAt: now,
    },
    {
      id: "rule-travel-pace",
      ruleType: "travel_season",
      targetEntity: "Pace & Downtime Buffer",
      sentimentScore: 0.9,
      reasoning: "Max 2-3 days per city (4-5 days in Singapore). Mandatory 90-min afternoon downtime/nap block before evening dining or show.",
      metadata: { maxDaysPerCity: 3, singaporeDays: 5, mandatoryRestMinutes: 90 },
      updatedAt: now,
    },
  ];

  await db.insert(userPreferenceRules).values(rules).onConflictDoNothing();

  // 3. Seed Turnkey Proposals
  const proposalOdessa = {
    id: "prop-odessa-sf",
    goalId: "goal-concerts-sf",
    dedupHash: "hash-odessa-sf-2026",
    title: "ODESZA Surprise Intimate SF DJ Set ($25)",
    description: "Special popup show announced at The Independent SF. Similar vibe to your favorite electronic concerts, incredible venue acoustics.",
    sourceUrl: "https://example.com/tickets/odesza-sf",
    imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80",
    cashPrice: 25,
    pointsRequired: 0,
    pointsProgram: "Cash",
    startDate: new Date(now.getTime() + 14 * 86400000),
    endDate: new Date(now.getTime() + 14 * 86400000),
    location: "The Independent, San Francisco",
    itineraryPlan: {
      legs: [
        {
          city: "San Francisco",
          days: 1,
          hotel: { name: "N/A (Local Show)", why: "Drive or Muni from home", transitWalkMinutes: 0 },
          activities: [
            { time: "18:30", name: "Pre-concert dinner at Nopa (SF Restaurant Week deal)", transit: "10 min walk", bookingUrl: "https://example.com/nopa" },
            { time: "20:00", name: "Doors open at The Independent", transit: "5 min walk" },
            { time: "21:00", name: "ODESZA Intimate Set", transit: "Venue" },
          ],
          adventureForks: [
            { title: "Option A: Late night dessert at Bob's Donuts", description: "Fresh warm donuts 2 blocks away." },
            { title: "Option B: Speakeasy cocktail at Moongate Lounge", description: "Craft cocktails pre-show." },
          ],
        },
      ],
    },
    qualityScore: 96,
    uniquenessScore: 98,
    status: "pending_triage",
    createdAt: now,
  };

  const proposalTaiwanPride = {
    id: "prop-taiwan-singapore",
    goalId: "goal-asia-vacation",
    dedupHash: "hash-tpe-sin-2026",
    title: "Taipei Pride & Luxury Shopping + Singapore Home Trip (Starlux Business & KrisFlyer)",
    description: "SFO -> TPE Starlux Business Class (65k Amex points transfer) -> TPE to SIN KrisFlyer -> SIN to SFO direct. Includes boutique MTR hotel in Ximending, Louis Vuitton tax refund counter guide, and built-in nap blocks.",
    sourceUrl: "https://example.com/flights/starlux-tpe-sin",
    imageUrl: "https://images.unsplash.com/photo-1508248467071-086d55920b33?auto=format&fit=crop&w=800&q=80",
    cashPrice: 420,
    pointsRequired: 115000,
    pointsProgram: "Starlux + KrisFlyer",
    startDate: new Date(now.getTime() + 45 * 86400000),
    endDate: new Date(now.getTime() + 61 * 86400000),
    location: "Taipei (3 Days) -> Singapore (5 Days)",
    itineraryPlan: {
      legs: [
        {
          city: "Taipei",
          days: 3,
          hotel: { name: "Kimpton Da An Taipei", why: "Boutique, quiet high floor, 3 min walk to Zhongxiao Fuxing MRT", transitWalkMinutes: 3 },
          activities: [
            { time: "09:00", name: "Breakfast & Soy Milk at Fu Hang Dou Jiang", transit: "MRT Bannan Line, 8 mins" },
            { time: "11:00", name: "Breeze Xinyi LV/Gucci Luxury Shopping (Claim 5% instant tourist VAT refund)", transit: "12 mins MRT" },
            { time: "14:00 - 15:30", name: "MANDATORY REST & NAP BLOCK", transit: "Hotel Room / Hotel Spa" },
            { time: "17:00", name: "Taipei Pride Parade Main Avenue & Night Market Food Crawl", transit: "Walk 5 mins" },
          ],
          adventureForks: [
            { title: "Option A: Jiufen Old Street Sunset Tea", description: "Scenic mountain village tea house detour." },
            { title: "Option B: Beitou Thermal Hot Spring Massage", description: "Private hot spring bath 30 mins away." },
          ],
        },
        {
          city: "Singapore",
          days: 5,
          hotel: { name: "The Clan Hotel Singapore", why: "Modern luxury boutique near Telok Ayer MTR and hawker centers", transitWalkMinutes: 2 },
          activities: [
            { time: "10:00", name: "Family reunion lunch at Lau Pa Sat & Maxwell Hawker", transit: "Walk 4 mins" },
            { time: "14:30 - 16:00", name: "MANDATORY AFTERNOON POOLSIDE NAP", transit: "Hotel Sky Pool" },
            { time: "19:30", name: "Night Safari private VIP tram experience", transit: "Grab 20 mins" },
          ],
          adventureForks: [
            { title: "Option A: Gardens by the Bay Cloud Forest Night Walk", description: "Light show and cooled conservatory." },
            { title: "Option B: Cocktail tour at Jigger & Pony", description: "Asia's top ranked speakeasy cocktail bar." },
          ],
        },
      ],
    },
    qualityScore: 94,
    uniquenessScore: 92,
    status: "pending_triage",
    createdAt: now,
  };

  const proposalSammiCheng = {
    id: "prop-sammi-cheng-tw",
    goalId: "goal-concerts-sf",
    dedupHash: "hash-sammi-cheng-tpe",
    title: "Sammi Cheng World Tour in Taipei Arena",
    description: "Sammi Cheng concert in Taipei Arena. Conflicts with Jason's work conference on Google Calendar, so tracked silently in background for secondary price drops.",
    sourceUrl: "https://example.com/tickets/sammi-cheng-taipei",
    imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
    cashPrice: 180,
    pointsRequired: 0,
    pointsProgram: "Cash",
    startDate: new Date(now.getTime() + 30 * 86400000),
    endDate: new Date(now.getTime() + 30 * 86400000),
    location: "Taipei Arena, Taiwan",
    itineraryPlan: {
      legs: [
        {
          city: "Taipei",
          days: 2,
          hotel: { name: "Hotel Indigo Taipei North", why: "Near arena, high acoustics score", transitWalkMinutes: 4 },
          activities: [
            { time: "19:00", name: "Sammi Cheng Concert VIP Section", transit: "Walk 4 mins" },
          ],
          adventureForks: [],
        },
      ],
    },
    qualityScore: 99,
    uniquenessScore: 95,
    status: "silent_tracking",
    createdAt: now,
  };

  await db.insert(proposals).values([proposalOdessa, proposalTaiwanPride, proposalSammiCheng]).onConflictDoNothing();

  // 4. Seed Silent Price Logs
  const priceLogs = [
    {
      id: "log-sammi-1",
      proposalId: "prop-sammi-cheng-tw",
      loggedPrice: 220,
      notes: "Initial StubHub ticket price listing.",
      loggedAt: new Date(now.getTime() - 48 * 3600000),
    },
    {
      id: "log-sammi-2",
      proposalId: "prop-sammi-cheng-tw",
      loggedPrice: 180,
      notes: "Price drop detected on secondary market ($40 decrease). Logged silently without user alert due to calendar conflict.",
      loggedAt: now,
    },
  ];

  await db.insert(silentPriceLogs).values(priceLogs).onConflictDoNothing();

  // 5. Seed Agent Run Logs
  const runLog = {
    id: "run-log-1",
    goalId: "goal-asia-vacation",
    agentName: "Agentic-Browser-Worker-Asia",
    status: "completed",
    stepTrace: [
      { step: "Calendar Gap Analysis", tool: "google-workspace-mcp", durationMs: 120, status: "success", details: "Scanned Google Calendar for 14-day PTO windows and buffer days." },
      { step: "Artist Affinity Query", tool: "spotify-api", durationMs: 180, status: "success", details: "Retrieved top affinity artists (ODESZA, Sammi Cheng, Adele)." },
      { step: "Direct Award Flight Scrape", tool: "award-flight-scraper", durationMs: 840, status: "success", details: "Found Starlux Business Class availability SFO-TPE for 65k points." },
      { step: "Hotel Hygiene Sentiment Crawl", tool: "reddit-hotel-sentinel", durationMs: 420, status: "success", details: "Verified Kimpton Da An cleanliness score (0.98). Confirmed NO Hilton Palm Springs overlap." },
      { step: "Dedup & Vector Memory Check", tool: "mcp-core-shopping", durationMs: 95, status: "success", details: "Checked past proposals & HITL vector memory. Candidate cleared all filters." },
    ],
    uniquenessIndex: 94,
    qualityScore: 96,
    createdAt: now,
  };

  await db.insert(agentRunLogs).values([runLog]).onConflictDoNothing();

  return c.json({ message: "Seed completed successfully!", ok: true }, 200);
});

// ---------------------------------------------------------------------------
// GET /ops: Mission Control Telemetry & Agent Run Queue
// ---------------------------------------------------------------------------

shoppingRouter.get("/ops", async (c) => {
  const db = getDb(c.env);

  const [activeGoalsList, proposalsList, runsList] = await Promise.all([
    db.select().from(shoppingGoals),
    db.select().from(proposals),
    db.select().from(agentRunLogs).orderBy(desc(agentRunLogs.createdAt)).limit(20),
  ]);

  const activeGoalsCount = activeGoalsList.filter((g) => g.isActive).length;
  const totalYield = proposalsList.length;
  const valueCaptured = proposalsList.reduce((acc, p) => acc + (p.cashPrice ? Math.round(p.cashPrice * 0.25) : 150), 0);

  // Generate dual line chart history (Uniqueness vs Quality)
  const chartHistory = [
    { time: "00:00", uniqueness: 82, quality: 88 },
    { time: "04:00", uniqueness: 86, quality: 90 },
    { time: "08:00", uniqueness: 92, quality: 94 },
    { time: "12:00", uniqueness: 89, quality: 91 },
    { time: "16:00", uniqueness: 95, quality: 96 },
    { time: "20:00", uniqueness: 94, quality: 95 },
  ];

  return c.json({
    kpis: {
      activeGoals: activeGoalsCount,
      totalGoals: activeGoalsList.length,
      discoveryYield: totalYield,
      valueCapturedUsd: valueCaptured,
      mcpLatencyMs: 84,
      scraperStatus: "operational",
    },
    chartHistory,
    runQueue: runsList,
    goals: activeGoalsList,
  });
});

// ---------------------------------------------------------------------------
// GET & POST /goals
// ---------------------------------------------------------------------------

shoppingRouter.get("/goals", async (c) => {
  const db = getDb(c.env);
  const rows = await db.select().from(shoppingGoals).orderBy(desc(shoppingGoals.createdAt));
  return c.json({ data: rows, total: rows.length });
});

shoppingRouter.post("/goals", async (c) => {
  const body = await c.req.json();
  const db = getDb(c.env);
  const now = new Date();
  const id = body.id || `goal-${Date.now()}`;

  const newGoal = {
    id,
    title: body.title || "New Shopping Goal",
    category: body.category || "concert",
    systemPrompt: body.systemPrompt || "Monitor opportunities matching budget and travel constraints.",
    budgetMin: body.budgetMin || 0,
    budgetMax: body.budgetMax || 1000,
    pointsPrograms: body.pointsPrograms || [],
    emergencyTriggers: body.emergencyTriggers || [],
    isActive: body.isActive ?? true,
    runScheduleCron: body.runScheduleCron || "0 12 * * *",
    lastRunAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(shoppingGoals).values(newGoal);
  return c.json(newGoal, 201);
});

shoppingRouter.get("/goals/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb(c.env);
  const [row] = await db.select().from(shoppingGoals).where(eq(shoppingGoals.id, id)).limit(1);
  if (!row) return c.json({ error: "Goal not found." }, 404);
  return c.json(row);
});

shoppingRouter.patch("/goals/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const db = getDb(c.env);

  const [row] = await db
    .update(shoppingGoals)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(shoppingGoals.id, id))
    .returning();

  if (!row) return c.json({ error: "Goal not found." }, 404);
  return c.json(row);
});

// ---------------------------------------------------------------------------
// GET & POST /rules
// ---------------------------------------------------------------------------

shoppingRouter.get("/rules", async (c) => {
  const db = getDb(c.env);
  const rows = await db.select().from(userPreferenceRules).orderBy(desc(userPreferenceRules.updatedAt));
  return c.json({ data: rows });
});

shoppingRouter.post("/rules", async (c) => {
  const body = await c.req.json();
  const db = getDb(c.env);
  const now = new Date();
  const id = body.id || `rule-${Date.now()}`;

  const newRule = {
    id,
    ruleType: body.ruleType,
    targetEntity: body.targetEntity,
    sentimentScore: body.sentimentScore ?? 0,
    reasoning: body.reasoning,
    metadata: body.metadata || {},
    updatedAt: now,
  };

  await db.insert(userPreferenceRules).values(newRule).onConflictDoUpdate({
    target: userPreferenceRules.id,
    set: { ...newRule, updatedAt: now },
  });

  return c.json(newRule, 201);
});

// ---------------------------------------------------------------------------
// GET & POST /triage (HITL Arena)
// ---------------------------------------------------------------------------

shoppingRouter.get("/triage", async (c) => {
  const db = getDb(c.env);
  const pending = await db.select().from(proposals).where(eq(proposals.status, "pending_triage")).orderBy(desc(proposals.createdAt));
  return c.json({ data: pending, total: pending.length });
});

shoppingRouter.post("/triage/:id", async (c) => {
  const id = c.req.param("id");
  const { action, rejectionReasonTags, userNotes } = await c.req.json();
  const db = getDb(c.env);

  let newStatus: "swiped_right" | "swiped_left" | "silent_tracking" = "swiped_right";
  if (action === "swipe_left") newStatus = "swiped_left";
  if (action === "silent_track") newStatus = "silent_tracking";

  const [updatedProposal] = await db
    .update(proposals)
    .set({ status: newStatus })
    .where(eq(proposals.id, id))
    .returning();

  if (!updatedProposal) return c.json({ error: "Proposal not found." }, 404);

  // Record HITL feedback entry
  const feedbackId = `fb-${Date.now()}`;
  await db.insert(hitlFeedback).values({
    id: feedbackId,
    proposalId: id,
    swipeAction: action,
    rejectionReasonTags: rejectionReasonTags || [],
    userNotes: userNotes || "",
    createdAt: new Date(),
  });

  return c.json({ proposal: updatedProposal, ok: true });
});

// ---------------------------------------------------------------------------
// GET /itineraries
// ---------------------------------------------------------------------------

shoppingRouter.get("/itineraries", async (c) => {
  const db = getDb(c.env);
  const rows = await db.select().from(proposals).where(or(eq(proposals.status, "swiped_right"), eq(proposals.status, "pending_triage")));
  return c.json({ data: rows, total: rows.length });
});

shoppingRouter.get("/itineraries/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb(c.env);
  const [row] = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  if (!row) return c.json({ error: "Itinerary not found." }, 404);
  return c.json(row);
});

// ---------------------------------------------------------------------------
// GET /radar (Silent Tracking Grid)
// ---------------------------------------------------------------------------

shoppingRouter.get("/radar", async (c) => {
  const db = getDb(c.env);
  const trackedProposals = await db.select().from(proposals).where(eq(proposals.status, "silent_tracking"));
  const priceLogsList = await db.select().from(silentPriceLogs).orderBy(desc(silentPriceLogs.loggedAt));

  return c.json({
    data: trackedProposals.map((p) => ({
      ...p,
      priceLogs: priceLogsList.filter((l) => l.proposalId === p.id),
    })),
  });
});

// ---------------------------------------------------------------------------
// GET /memory (Agent Vector Memory Manager)
// ---------------------------------------------------------------------------

shoppingRouter.get("/memory", async (c) => {
  const db = getDb(c.env);
  const [rules, feedback] = await Promise.all([
    db.select().from(userPreferenceRules),
    db.select().from(hitlFeedback),
  ]);

  const memoryItems = [
    {
      id: "mem-1",
      scope: "Hotels & Hospitality",
      preference: "Blacklisted Hilton Palm Springs due to dead bugs and hygiene incident.",
      confidence: 0.98,
      source: "User Explicit Feedback",
    },
    {
      id: "mem-2",
      scope: "Airlines & Cabins",
      preference: "Prefers direct SFO/OAK -> Asia business class on points (Starlux, KrisFlyer).",
      confidence: 0.95,
      source: "Calibrated Learning",
    },
    {
      id: "mem-3",
      scope: "Shopping & Luxury",
      preference: "Target LV/Gucci luxury shopping in Asia with tourist tax refund optimization.",
      confidence: 0.92,
      source: "Goal Prompt & Swipe Data",
    },
    {
      id: "mem-4",
      scope: "Downtime & Pace",
      preference: "Mandatory 90-minute afternoon nap/rest buffer in itinerary before evening activities.",
      confidence: 0.96,
      source: "Goal Rules",
    },
  ];

  return c.json({ memoryItems, rules, feedback });
});
