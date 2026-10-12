/**
 * @fileoverview The `core_browser_binding` health check, as a pure function.
 *
 * It takes the RPC stub as an argument and has no value imports, so
 * `scripts/selfcheck-core-browser.mjs` drives every branch with fake stubs.
 *
 * Severity, stated once, because a check without one is decoration:
 *
 * | What happened                                   | Status | Why                                               |
 * |-------------------------------------------------|--------|---------------------------------------------------|
 * | `CORE_BROWSER` binding absent                    | fail   | `wrangler.jsonc` declares it; absent is a defect  |
 * | `health()` threw (core-browser down, no such entrypoint) | fail | the binding is declared and does not work  |
 * | no answer inside the timeout                     | timeout | counted as a failure by the verdict             |
 * | answer is not the `BrowserHealth` shape          | fail   | the contract in `types.ts` drifted                |
 * | core-browser answered, the VM browser is not ready | warn | the LAN VM can be off; this Worker's own API still works |
 * | core-browser answered, its cost guard is tripped | warn   | `submit` refuses jobs until the guard resets      |
 * | all of the above fine                            | ok     |                                                   |
 */

import type { BrowserHealth, CoreBrowserRpc } from "./types";

/** How long the probe waits for core-browser before it reports `timeout`. */
export const CORE_BROWSER_PROBE_TIMEOUT_MS = 10_000;

/** The probe's verdict; the health route adds the name, category and duration. */
export interface CoreBrowserProbeResult {
  status: "ok" | "warn" | "fail" | "timeout";
  message: string;
  details?: Record<string, unknown>;
}

function isBrowserHealth(value: unknown): value is BrowserHealth {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const lease = v.lease as Record<string, unknown> | undefined;
  const guard = v.guard as Record<string, unknown> | undefined;
  return (
    typeof v.ok === "boolean" &&
    typeof v.cdpConnected === "boolean" &&
    !!lease &&
    typeof lease.held === "boolean" &&
    !!guard &&
    typeof guard.ok === "boolean"
  );
}

/**
 * Ask core-browser for its health and classify the answer.
 *
 * @param stub - The `CORE_BROWSER` stub, or `undefined` when the binding is absent.
 * @param timeoutMs - How long to wait for the answer.
 * @returns The verdict. Never throws.
 * @example
 * ```typescript
 * const result = await probeCoreBrowser(coreBrowserStub(env));
 * ```
 */
export async function probeCoreBrowser(
  stub: Pick<CoreBrowserRpc, "health"> | undefined,
  timeoutMs: number = CORE_BROWSER_PROBE_TIMEOUT_MS,
): Promise<CoreBrowserProbeResult> {
  if (!stub || typeof stub.health !== "function") {
    return { status: "fail", message: "CORE_BROWSER service binding not present" };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = Symbol("timeout");
  let answer: unknown;
  try {
    answer = await Promise.race([
      stub.health(),
      new Promise<typeof timedOut>((resolve) => {
        timer = setTimeout(() => resolve(timedOut), timeoutMs);
      }),
    ]);
  } catch (error) {
    return {
      status: "fail",
      message: `core-browser did not answer CoreBrowserRpc.health(): ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  } finally {
    clearTimeout(timer);
  }

  if (answer === timedOut) {
    return {
      status: "timeout",
      message: `core-browser did not answer CoreBrowserRpc.health() within ${timeoutMs.toLocaleString("en-US")} ms`,
    };
  }
  if (!isBrowserHealth(answer)) {
    return {
      status: "fail",
      message: "core-browser answered health() with an unexpected shape; the contract in src/backend/browser/types.ts has drifted",
      details: { answer: answer as Record<string, unknown> },
    };
  }

  const details = {
    browserReady: answer.ok,
    cdpConnected: answer.cdpConnected,
    leaseHeld: answer.lease.held,
    guardState: answer.guard.state,
  };
  if (!answer.ok) {
    return {
      status: "warn",
      message: answer.cdpConnected
        ? "core-browser is reachable, but BrowserOS on the agent-browser VM did not report ok"
        : "core-browser is reachable, but the agent-browser VM browser cannot be driven (CDP not connected, or the VM is unreachable)",
      details,
    };
  }
  if (!answer.guard.ok) {
    return {
      status: "warn",
      message: `core-browser is reachable and the browser is ready, but its cost guard is ${answer.guard.state}: ${answer.guard.reason}. New jobs are refused.`,
      details,
    };
  }
  return {
    status: "ok",
    message: answer.lease.held
      ? "core-browser reachable via CORE_BROWSER.health(); the agent-browser VM is ready and a job holds the browser"
      : "core-browser reachable via CORE_BROWSER.health(); the agent-browser VM is ready and idle",
    details,
  };
}
