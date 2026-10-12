/**
 * Self-check for the read-after-write health probe (maestro 5492781d5118).
 *
 * The probe drives real Drizzle queries into a fake node-postgres client that
 * holds one table in memory. Each failure mode the probe exists for gets its
 * own fixture, and in each one the WRONG verdict is the easy one:
 *
 * - a query cache that does not invalidate on write must turn the check RED;
 *   this is the Hyperdrive caching failure, and the probe is pointless if a
 *   cached read can pass it
 * - the prime read and the read-back must be the SAME SQL text, or a cache
 *   keyed on SQL would serve the read-back fresh by accident and hide the bug
 * - each step must open its OWN connection: a probe that reads in the writing
 *   session is the old in-transaction check over again
 * - an uncached store passes, on the first run (no row yet) and on later runs
 * - the read must not call now() or another volatile function, which would make
 *   it uncacheable and the probe unable to fail
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const ALIASES = [
  ["@/backend/", "src/backend/"],
  ["@/shared/", "src/shared/"],
];

registerHooks({
  resolve(specifier, context, next) {
    for (const [prefix, dir] of ALIASES) {
      if (specifier.startsWith(prefix)) {
        let target = resolvePath(root, dir, specifier.slice(prefix.length));
        if (!/\.[cm]?[jt]sx?$/.test(target)) {
          target = existsSync(`${target}.ts`) ? `${target}.ts` : resolvePath(target, "index.ts");
        }
        return next(pathToFileURL(target).href, context);
      }
    }
    if (
      context.parentURL?.startsWith(pathToFileURL(resolvePath(root, "src")).href) &&
      /^\.\.?\//.test(specifier) &&
      !/\.[cm]?[jt]sx?$/.test(specifier)
    ) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});

const { readAfterWriteProbe, READ_AFTER_WRITE_PROBE_ID } = await import(
  "../src/backend/health/read-after-write.ts"
);
const { drizzle } = await import("drizzle-orm/node-postgres");

/**
 * An in-memory `health_probes` behind a fake pg client. `cached: true` puts a
 * Hyperdrive-style cache in front of reads: keyed on SQL text + params, and
 * never invalidated by a write.
 */
function fakeDatabase({ cached }) {
  const table = new Map();
  const cache = new Map();
  const log = [];
  let connections = 0;
  const run = (text, values = []) => {
    const lower = text.toLowerCase();
    if (lower.startsWith("select")) {
      const key = `${text}|${JSON.stringify(values)}`;
      if (cached && cache.has(key)) return cache.get(key);
      const row = table.get(values[0]);
      const result = { rows: row ? [[row.nonce]] : [], fields: [{ name: "nonce" }], rowCount: row ? 1 : 0 };
      if (cached) cache.set(key, result);
      return result;
    }
    if (lower.startsWith("insert")) {
      // values: id, nonce, written_at, then the ON CONFLICT set values
      table.set(values[0], { nonce: values[1] });
      return { rows: [], fields: [], rowCount: 1 };
    }
    throw new Error(`unexpected SQL: ${text}`);
  };
  const open = async (fn) => {
    connections += 1;
    const id = connections;
    const client = {
      query: async (config, maybeValues) => {
        const text = typeof config === "string" ? config : config.text;
        const values = (typeof config === "string" ? undefined : config.values) ?? maybeValues ?? [];
        log.push({ connection: id, text, values });
        return run(text, values);
      },
    };
    return fn(drizzle(client));
  };
  return { open, log, table, connectionsUsed: () => connections };
}

// --- an honest store passes, first run and later runs ---------------------
{
  const db = fakeDatabase({ cached: false });
  const first = await readAfterWriteProbe(db.open, "nonce-1");
  assert.equal(first.status, "ok", first.message);
  assert.deepEqual(first.details, { primed: null, wrote: "nonce-1", readBack: "nonce-1" });
  const second = await readAfterWriteProbe(db.open, "nonce-2");
  assert.equal(second.status, "ok");
  assert.deepEqual(second.details, { primed: "nonce-1", wrote: "nonce-2", readBack: "nonce-2" });
  assert.equal(db.table.size, 1, "one row, overwritten in place: the table cannot grow");
  assert.ok(db.table.has(READ_AFTER_WRITE_PROBE_ID));
}

// --- a cache that ignores writes turns the check red ----------------------
{
  const db = fakeDatabase({ cached: true });
  db.table.set(READ_AFTER_WRITE_PROBE_ID, { nonce: "before" });
  const result = await readAfterWriteProbe(db.open, "after");
  assert.equal(result.status, "fail", "a stale cached read must fail the probe");
  assert.deepEqual(result.details, { primed: "before", wrote: "after", readBack: "before" });
  assert.match(result.message, /before the write/);
  assert.equal(db.table.get(READ_AFTER_WRITE_PROBE_ID).nonce, "after", "the write itself did land");
}
// ...and on a brand-new table, where the cache holds "no row" from the prime.
{
  const db = fakeDatabase({ cached: true });
  const result = await readAfterWriteProbe(db.open, "first");
  assert.equal(result.status, "fail");
  assert.deepEqual(result.details, { primed: null, wrote: "first", readBack: null });
}

// --- structure: three statements, three connections, identical reads ------
{
  const db = fakeDatabase({ cached: false });
  await readAfterWriteProbe(db.open, "n");
  assert.equal(db.log.length, 3);
  assert.deepEqual(db.log.map((e) => e.connection), [1, 2, 3], "each step opens its own connection");
  assert.match(db.log[0].text, /^select/i);
  assert.match(db.log[1].text, /^insert/i);
  assert.match(db.log[1].text, /on conflict/i, "the write is an upsert, so the row is reused");
  assert.equal(db.log[0].text, db.log[2].text, "the prime read and the read-back are the same SQL");
  assert.deepEqual(db.log[0].values, db.log[2].values);
  assert.doesNotMatch(db.log[0].text, /now\(|random\(|clock_timestamp|current_timestamp/i,
    "the read must stay cacheable, or the probe cannot fail");
}

// --- a random nonce by default --------------------------------------------
{
  const db = fakeDatabase({ cached: false });
  const a = await readAfterWriteProbe(db.open);
  const b = await readAfterWriteProbe(db.open);
  assert.notEqual(a.details.wrote, b.details.wrote, "every run writes a new value");
}

console.log("selfcheck-read-after-write: ok");
