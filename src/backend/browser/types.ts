/**
 * @fileoverview The wire contract of core-browser's `CoreBrowserRpc` entrypoint.
 *
 * core-browser drives BrowserOS on the `agent-browser` VM (Proxmox VM 130) on
 * the LAN, through a Cloudflare Tunnel that only core-browser holds. This
 * Worker never talks to the VM: it calls core-browser over the `CORE_BROWSER`
 * service binding, and core-browser applies its cost guard, its job queue and
 * its single-tenant browser lease on every call.
 *
 * Types only, no behaviour, so a plain-Node self-check can import the modules
 * that use them. Mirrors core-browser `master` at af08ce8 (2026-10-12):
 * `src/rpc.ts`, `src/backend/jobs.ts`, `src/backend/db/schemas/browser/*`.
 */

/** Who created a core-browser job. Jobs created over this binding are `rpc`. */
export type BrowserJobSource = "mcp" | "rpc" | "http" | "ui";

/** One scrape job, as core-browser's `jobs` table stores it. */
export interface BrowserJob {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  prompt: string;
  source: BrowserJobSource;
  workflowId: string | null;
  sessionId: string | null;
  tabId: number | null;
  /** Unix seconds. */
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
  stepCount: number;
  /** Micro-USD: an integer, 1,000,000 = $1.00. */
  costUsd: number;
}

/** One step of a job's timeline (`job_events`). */
export interface BrowserJobEvent {
  id: number;
  jobId: string;
  seq: number;
  /** Unix seconds. */
  ts: number;
  kind: "navigate" | "act" | "read" | "screenshot" | "ai_decision" | "error" | "lease";
  url: string | null;
  title: string | null;
  message: string | null;
  screenshotKey: string | null;
  durationMs: number | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
}

/** core-browser's single-tenant browser lease, as `BrowserLease.status()` reports it. */
export type BrowserLeaseStatus =
  | { held: false }
  | { held: true; jobId: string; epoch: number; remainingMs: number };

/** core-browser's cost guard. `ok: false` means `submit` refuses new jobs. */
export interface BrowserCostGuard {
  ok: boolean;
  state: string;
  reason: string;
}

/** What `CoreBrowserRpc.health()` returns. */
export interface BrowserHealth {
  /** BrowserOS answered `status: ok` AND its CDP connection is up. */
  ok: boolean;
  /** `false` means the tunnel works but the browser cannot be driven. */
  cdpConnected: boolean;
  lease: BrowserLeaseStatus;
  guard: BrowserCostGuard;
}

/**
 * Every method `CoreBrowserRpc` exposes. Call them through the wrappers in
 * `rpc.ts`; this interface exists so the cast happens once.
 */
export interface CoreBrowserRpc {
  /** Queue one scrape. Throws when the prompt is empty or the cost guard is tripped. */
  submit(prompt: string): Promise<{ id: string }>;
  /** The job and its full event timeline, or `null` for an unknown id. */
  result(jobId: string): Promise<{ job: BrowserJob; events: BrowserJobEvent[] } | null>;
  /**
   * One raw BrowserOS tool call, for probes only. Throws while a job holds the
   * lease, so it cannot disturb a running scrape. It does not take the lease.
   */
  call(tool: string, args?: Record<string, unknown>): Promise<unknown>;
  /** Tunnel, BrowserOS and CDP state, plus the lease and the cost guard. No spend. */
  health(): Promise<BrowserHealth>;
}
