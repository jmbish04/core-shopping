/**
 * @fileoverview The integration declarations and the rules that turn a probe's
 * answer into a verdict (maestro cs-be-2-8, cs-c-08).
 *
 * Separate from `integrations.ts`, and carrying NO value imports, so
 * `scripts/selfcheck-integrations.mjs` can drive every branch with fake probe
 * answers. The same reason `browser/probe.ts` is separate from the route that
 * calls it: a rule nothing can exercise is a rule nobody has tested.
 *
 * **The integration list is DECLARED, never discovered.** An endpoint that
 * reported only what it could find would answer "all clear" for a binding
 * someone deleted and "nothing to see" for an integration that was planned and
 * never built, and both of those read as green. So every integration the
 * project intends to have is named below, including the four that do not exist
 * yet, each with the Maestro task that builds it. Missing is then an error or a
 * written-down gap rather than an inference.
 *
 * **Severity is stated, and a failure changes the verdict.** A check that
 * records a component as down and still answers `ok` is worse than no check:
 * it produces a record that reads as diligence.
 *
 * | What happened | Status | Why |
 * |---|---|---|
 * | a `required` integration's binding is absent or broken | `fail` | `wrangler.jsonc` declares it; absent is a defect |
 * | a `required` integration answers but its far end is degraded | `warn` | this Worker's own API still works |
 * | an `optional` integration's binding is absent | `warn` | it is declared optional, so absent is allowed |
 * | a `planned` integration does not exist | `not_built` | stated, with the task that builds it |
 */

/** How an integration's absence should be read. */
export const INTEGRATION_REQUIREMENTS = ["required", "optional", "planned"] as const;
export type IntegrationRequirement = (typeof INTEGRATION_REQUIREMENTS)[number];

/** An integration's verdict. `not_built` is a stated gap, not an outage. */
export const INTEGRATION_STATUSES = ["ok", "warn", "fail", "not_built"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

/** One integration, declared whether or not it exists. */
export interface IntegrationDeclaration {
  id: string;
  label: string;
  /** How it is reached: a service binding, a Hyperdrive config, an API. */
  transport: string;
  requirement: IntegrationRequirement;
  /** What it is for, in one sentence a person reads. */
  purpose: string;
  /** For a `planned` integration, the Maestro task that builds it. */
  task?: string;
}

/** One probe's answer, before the declaration is merged in. */
export interface ProbeAnswer {
  status: IntegrationStatus;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Every integration the project intends to have.
 *
 * The four `planned` entries are here on purpose. Leaving them out would make
 * `/api/integrations` answer "everything is fine" about a system that cannot
 * check a calendar, read listening history, store an image or gather reviews —
 * and the brief asks for all four.
 */
export const INTEGRATION_DECLARATIONS: readonly IntegrationDeclaration[] = [
  {
    id: "core_browser",
    label: "core-browser",
    transport: "service binding CORE_BROWSER -> CoreBrowserRpc",
    requirement: "required",
    purpose:
      "The only door to a real browser: BrowserOS on the agent-browser VM, behind a cost guard and a single-tenant lease.",
  },
  {
    id: "core_guardian",
    label: "core-guardian",
    transport: "service binding CORE_GUARDIAN -> GuardianRpc",
    requirement: "required",
    purpose:
      "Every model call and every embedding, routed and billed against this Worker's own project name.",
  },
  {
    id: "postgres",
    label: "Postgres (core_shopping)",
    transport: "Hyperdrive binding HYPERDRIVE",
    requirement: "required",
    purpose:
      "All shopper data: goals, runs, the catalog, proposals, reviews and this configuration.",
  },
  {
    id: "google_workspace",
    label: "google-workspace-mcp",
    transport: "service binding, not yet declared",
    requirement: "planned",
    purpose:
      "Read the calendar so a proposal's dates can be checked against what is already planned.",
    task: "cs-be-6-1",
  },
  {
    id: "spotify",
    label: "Spotify",
    transport: "API, not yet declared",
    requirement: "planned",
    purpose:
      "Fill taste_artists and taste_genres from listening history, including the rising artists nobody has typed in.",
    task: "cs-be-6-2",
  },
  {
    id: "cloudflare_images",
    label: "Cloudflare Images",
    transport: "Images binding, not yet declared",
    requirement: "planned",
    purpose:
      "Store a picture for a product or a place, deduplicated by a hash of the source URL.",
    task: "cs-be-6-3",
  },
  {
    id: "reviews",
    label: "Reviews and tips ingestion",
    transport: "core-browser plus the review sources",
    requirement: "planned",
    purpose: "Gather real-world reviews and tips for a product, a hotel, an airline or a city.",
    task: "cs-be-6-4",
  },
];

/**
 * Reduce the probes to one verdict.
 *
 * `not_built` is deliberately not a degradation: an integration that is
 * declared `planned` and reports `not_built` is a gap someone wrote down, and
 * turning the page amber forever for it trains a reader to ignore amber.
 *
 * @param statuses - Every integration's status.
 * @returns `fail` if any failed, `degraded` if any warned, else `ok`.
 * @example
 * ```typescript
 * overallStatus(["ok", "not_built"]); // "ok"
 * overallStatus(["ok", "warn"]);      // "degraded"
 * overallStatus(["warn", "fail"]);    // "fail"
 * ```
 */
export function overallStatus(statuses: readonly IntegrationStatus[]): "ok" | "degraded" | "fail" {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "degraded";
  return "ok";
}

/**
 * How a missing binding should be read, given what the declaration promised.
 *
 * @param requirement - The integration's declared requirement.
 * @returns `fail` for required, `warn` for optional, `not_built` for planned.
 * @example
 * ```typescript
 * absenceStatus("required"); // "fail"
 * absenceStatus("planned");  // "not_built"
 * ```
 */
export function absenceStatus(requirement: IntegrationRequirement): IntegrationStatus {
  if (requirement === "required") return "fail";
  if (requirement === "optional") return "warn";
  return "not_built";
}

/**
 * Classify core-browser's health for this endpoint.
 *
 * Takes the result of `probeCoreBrowser`, which is the same function
 * `/api/health` runs, so the two surfaces cannot disagree about whether the
 * browser is up. The one thing this adds is the daily cap: at the ceiling
 * `submit` is refused, so the browser is unavailable TO THIS WORKER even while
 * core-browser itself is perfectly healthy — reporting `ok` there would be
 * true about core-browser and false about what this Worker can do.
 *
 * A `timeout` is a failure. A black-holed tunnel does not answer and does not
 * refuse, so leaving it as its own status would let a hang read as neither.
 *
 * @param probe - The result from `probeCoreBrowser`.
 * @param jobsToday - Browser runs started today, or null when unknown.
 * @param cap - The `BROWSER_DAILY_RUN_CAP` ceiling.
 * @returns The status, the message, and the lease, guard and job counts.
 * @example
 * ```typescript
 * classifyCoreBrowser({ status: "ok", message: "up" }, 20, 20).status; // "warn"
 * ```
 */
export function classifyCoreBrowser(
  probe: { status: "ok" | "warn" | "fail" | "timeout"; message: string; details?: Record<string, unknown> },
  jobsToday: number | null,
  cap: number,
): ProbeAnswer {
  const details: Record<string, unknown> = {
    ...(probe.details ?? {}),
    jobs_today: jobsToday,
    daily_cap: cap,
    jobs_remaining: jobsToday === null ? null : Math.max(0, cap - jobsToday),
  };
  // A timeout is a failure: a black-holed tunnel neither answers nor refuses,
  // so leaving it as its own status would let a hang read as neither.
  const settled: IntegrationStatus = probe.status === "timeout" ? "fail" : probe.status;
  const broken = settled === "fail";
  if (jobsToday !== null && jobsToday >= cap) {
    return {
      status: broken ? "fail" : "warn",
      message: broken
        ? probe.message
        : `core-browser is up, but today's run cap of ${cap.toLocaleString("en-US")} is reached, so no further job will be accepted.`,
      details,
    };
  }
  return { status: settled, message: probe.message, details };
}
