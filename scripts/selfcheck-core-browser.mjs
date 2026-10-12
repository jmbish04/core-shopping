/**
 * Self-check for the core-browser service binding and its health check.
 *
 * `probeCoreBrowser` is driven with fake stubs. In each fixture the WRONG
 * verdict is the easy one:
 *
 * - an answer missing `lease` and `guard` but carrying `ok: true` must FAIL; a
 *   probe that reads only `ok` would pass it
 * - a browser that is not ready (`ok: false`) must WARN, never pass
 * - a tripped cost guard must WARN although the browser is ready
 * - a missing binding, a thrown RPC and a hung RPC must each fail the verdict
 * - the wiring is pinned too: the binding in wrangler.jsonc names the right
 *   service and entrypoint, and the health route actually runs the check
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { probeCoreBrowser } = await import("../src/backend/browser/probe.ts");

const healthy = () => ({
  ok: true,
  cdpConnected: true,
  lease: { held: false },
  guard: { ok: true, state: "active", reason: "cost guard tripped" },
});
const stub = (answer) => ({ health: async () => answer });

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("selfcheck-core-browser");

await check("healthy and idle passes", async () => {
  const r = await probeCoreBrowser(stub(healthy()));
  assert.equal(r.status, "ok");
  assert.match(r.message, /idle/);
  assert.equal(r.details.leaseHeld, false);
});

await check("healthy with a job on the browser passes and says so", async () => {
  const r = await probeCoreBrowser(
    stub({ ...healthy(), lease: { held: true, jobId: "j1", epoch: 3, remainingMs: 1000 } }),
  );
  assert.equal(r.status, "ok");
  assert.match(r.message, /holds the browser/);
});

await check("missing binding fails", async () => {
  const r = await probeCoreBrowser(undefined);
  assert.equal(r.status, "fail");
  assert.match(r.message, /not present/);
});

await check("a stub without health() fails", async () => {
  assert.equal((await probeCoreBrowser({})).status, "fail");
});

await check("a thrown RPC fails and carries the error", async () => {
  const r = await probeCoreBrowser({
    health: async () => {
      throw new Error("Worker \"core-browser\" has no entrypoint named CoreBrowserRpc");
    },
  });
  assert.equal(r.status, "fail");
  assert.match(r.message, /no entrypoint named CoreBrowserRpc/);
});

await check("a hung RPC times out", async () => {
  const t0 = Date.now();
  const r = await probeCoreBrowser({ health: () => new Promise(() => {}) }, 50);
  assert.equal(r.status, "timeout");
  assert.ok(Date.now() - t0 < 1000, "the probe waited far past its timeout");
});

await check("ok:true without lease and guard fails as contract drift", async () => {
  const r = await probeCoreBrowser(stub({ ok: true, cdpConnected: true }));
  assert.equal(r.status, "fail");
  assert.match(r.message, /drifted/);
});

await check("a non-object answer fails", async () => {
  assert.equal((await probeCoreBrowser(stub(null))).status, "fail");
  assert.equal((await probeCoreBrowser(stub("ok"))).status, "fail");
});

await check("VM browser not drivable warns, never passes", async () => {
  const r = await probeCoreBrowser(stub({ ...healthy(), ok: false, cdpConnected: false }));
  assert.equal(r.status, "warn");
  assert.match(r.message, /CDP not connected/);
});

await check("BrowserOS not ok with CDP up warns", async () => {
  const r = await probeCoreBrowser(stub({ ...healthy(), ok: false, cdpConnected: true }));
  assert.equal(r.status, "warn");
});

await check("tripped cost guard warns although the browser is ready", async () => {
  const r = await probeCoreBrowser(
    stub({ ...healthy(), guard: { ok: false, state: "soft-killed", reason: "projected spend over cap" } }),
  );
  assert.equal(r.status, "warn");
  assert.match(r.message, /soft-killed: projected spend over cap/);
});

await check("wrangler.jsonc binds core-browser's CoreBrowserRpc as CORE_BROWSER", async () => {
  const w = readFileSync(resolve(root, "wrangler.jsonc"), "utf8");
  const block = w.match(/\{[^{}]*"binding":\s*"CORE_BROWSER"[^{}]*\}/);
  assert.ok(block, "no CORE_BROWSER service binding in wrangler.jsonc");
  assert.match(block[0], /"service":\s*"core-browser"/);
  assert.match(block[0], /"entrypoint":\s*"CoreBrowserRpc"/);
});

await check("the health route runs the check and counts it in the verdict", async () => {
  const h = readFileSync(resolve(root, "src/backend/api/routes/health.ts"), "utf8");
  const all = h.match(/const checks = await Promise\.all\(\[([\s\S]*?)\]\)/);
  assert.ok(all, "could not find the checks list in health.ts");
  assert.match(all[1], /this\.checkCoreBrowser\(\)/);
  assert.match(h, /name: "core_browser_binding", \.\.\.result/);
});

console.log(`selfcheck-core-browser: ${passed} checks passed`);
