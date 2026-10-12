/**
 * @fileoverview The one place this Worker talks to the `CORE_BROWSER` binding.
 *
 * The generated `Service` type knows nothing about `CoreBrowserRpc`'s methods,
 * because they live in another Worker's source tree, so the cast happens here
 * once. A service binding, not `fetch`: it needs no API key, because the
 * binding is itself the trust boundary, and a Worker that fetches another
 * Worker's workers.dev hostname on the same account gets Cloudflare error 1042.
 */

import type { BrowserHealth, BrowserJob, BrowserJobEvent, CoreBrowserRpc } from "./types";

/**
 * The core-browser stub, typed.
 *
 * @param env - The Worker environment carrying the `CORE_BROWSER` binding.
 * @returns The RPC stub, or `undefined` when the binding is absent.
 */
export function coreBrowserStub(env: Env): CoreBrowserRpc | undefined {
  return (env as unknown as { CORE_BROWSER?: CoreBrowserRpc }).CORE_BROWSER;
}

function requireStub(env: Env): CoreBrowserRpc {
  const stub = coreBrowserStub(env);
  if (!stub) throw new Error("CORE_BROWSER service binding not present");
  return stub;
}

/**
 * Queue one scrape on the agent-browser VM.
 *
 * Each call creates a job and counts against core-browser's daily job ceiling,
 * so never call this in a loop without a bound of your own.
 *
 * @param env - The Worker environment.
 * @param prompt - What the browser agent should do, in plain language.
 * @returns The new job's id; poll it with `browserResult`.
 * @throws When the prompt is empty or core-browser's cost guard is tripped.
 * @example
 * ```typescript
 * const { id } = await browserSubmit(env, "Find the price of a Weber Spirit E-325 at Home Depot");
 * ```
 */
export function browserSubmit(env: Env, prompt: string): Promise<{ id: string }> {
  return requireStub(env).submit(prompt);
}

/**
 * A job and its timeline.
 *
 * @param env - The Worker environment.
 * @param jobId - An id from `browserSubmit`.
 * @returns The job and its events, or `null` when core-browser has no such job.
 */
export function browserResult(
  env: Env,
  jobId: string,
): Promise<{ job: BrowserJob; events: BrowserJobEvent[] } | null> {
  return requireStub(env).result(jobId);
}

/**
 * One raw BrowserOS tool call, for probes only.
 *
 * @param env - The Worker environment.
 * @param tool - The BrowserOS MCP tool name.
 * @param args - The tool's arguments.
 * @returns The tool's result, verbatim.
 * @throws While a job holds the browser lease.
 */
export function browserToolCall(env: Env, tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
  return requireStub(env).call(tool, args);
}

/**
 * core-browser's health: tunnel, BrowserOS, CDP, lease and cost guard. No spend.
 *
 * @param env - The Worker environment.
 * @returns The health object, verbatim.
 */
export function browserHealth(env: Env): Promise<BrowserHealth> {
  return requireStub(env).health();
}
