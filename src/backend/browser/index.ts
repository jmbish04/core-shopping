/**
 * @fileoverview core-browser — the only door from this Worker to a real browser.
 *
 * The `CORE_BROWSER` service binding calls core-browser's `CoreBrowserRpc`
 * entrypoint. core-browser drives BrowserOS on the `agent-browser` VM
 * (Proxmox VM 130) through a Cloudflare Tunnel, behind its cost guard, its job
 * queue and a single-tenant browser lease. Import from here
 * (`@/backend/browser`), not from the files inside.
 *
 * | File       | Owns                                             |
 * |------------|--------------------------------------------------|
 * | `types.ts` | The wire contract, mirrored from core-browser    |
 * | `rpc.ts`   | The typed cast of the binding, and its wrappers  |
 * | `probe.ts` | The `core_browser_binding` health check          |
 * | `runs.ts`  | Browser runs: goal to prompt, job to run (cs-be-6-6) |
 *
 * @example
 * import { browserSubmit, browserResult } from "@/backend/browser";
 *
 * const { id } = await browserSubmit(env, "Find the current price of item X at store Y");
 * const outcome = await browserResult(env, id); // poll until job.status is terminal
 */

export { browserHealth, browserResult, browserSubmit, browserToolCall, coreBrowserStub } from "./rpc";
export {
  BROWSE_PROMPT_MAX_CHARS,
  BROWSER_JOB_EVENT_KIND,
  DEFAULT_BROWSER_DAILY_RUN_CAP,
  buildBrowsePrompt,
  dailyRunCap,
  eventsToCopy,
  gateBrowse,
  jobSummary,
  runStatusForJob,
  type BrowseCriterion,
  type BrowseGoal,
  type BrowseRefusal,
} from "./runs";
export { CORE_BROWSER_PROBE_TIMEOUT_MS, probeCoreBrowser, type CoreBrowserProbeResult } from "./probe";
export type {
  BrowserCostGuard,
  BrowserHealth,
  BrowserJob,
  BrowserJobEvent,
  BrowserJobSource,
  BrowserLeaseStatus,
  CoreBrowserRpc,
} from "./types";
