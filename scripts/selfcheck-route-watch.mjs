/**
 * Self-check for route watch (maestro cs-gap-route-watch).
 *
 * The brief asks to watch "SFO, OAK, and SJC for new routes being annouced with
 * direct flights". An announcement carries no dates, so before this existed the
 * flight fingerprint returned null for one (it requires `departOn`) and the same
 * route reported by two sites became two entities under the URL basis.
 *
 * In each fixture the wrong answer is the easy one:
 * - the two announcements of one route quote DIFFERENT first-service dates and
 *   sit on different URLs, so a key that folds in either date or the URL fails
 * - a dated fare on the same city pair must stay a separate `flight` entity, so
 *   collapsing route and flight into one kind fails
 * - the two carriers on one city pair must stay apart, so dropping the carrier
 *   from the key fails
 * - "Taipei" is not an airport code and must be refused, so a parser that takes
 *   the first three letters ("TAI") fails
 */
import assert from "node:assert/strict";

import { readFileSync, readdirSync } from "node:fs";

// Only modules free of extensionless value imports can be imported here; that is
// why the contracts and the Drizzle schema are asserted as source text below.
const { fingerprintFor } = await import("../src/backend/catalog/canonical.ts");
const { airportCode, findingToSighting, BROWSER_FINDING_KINDS } = await import(
  "../src/backend/catalog/findings.ts"
);

const contractSrc = readFileSync("src/shared/contracts/catalog.ts", "utf8");
const schemaSrc = readFileSync("src/backend/pg/schemas/catalog/entities.ts", "utf8");
const migrationSql = readdirSync("drizzle-pg")
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(`drizzle-pg/${f}`, "utf8"))
  .join("\n");

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("selfcheck-route-watch");

await check("route is an entity kind, and a browser finding may name it", async () => {
  assert.match(contractSrc, /ENTITY_KINDS = \[[\s\S]*?"route",[\s\S]*?\] as const/);
  assert.match(
    contractSrc,
    /ROUTE_STATUSES = \["announced", "scheduled", "flying", "discontinued"\] as const/,
  );
  assert.ok(BROWSER_FINDING_KINDS.includes("route"), "a browser finding cannot name a route");
});

await check(
  "two announcements of one route share a fingerprint although their dates and URLs differ",
  async () => {
    const a = fingerprintFor(
      "route",
      { origin: "SFO", destination: "TPE", carrier: "STARLUX", serviceStartsOn: "2027-04-01" },
      { urlHash: "hash-of-one-blog" },
    );
    const b = fingerprintFor(
      "route",
      { origin: "sfo", destination: " tpe ", carrier: "starlux", serviceStartsOn: "2027-05-15" },
      { urlHash: "hash-of-another-blog" },
    );
    assert.equal(a.basis, "attrs", "a route must be identified by its attributes, not its URL");
    assert.equal(b.basis, "attrs");
    assert.equal(a.fingerprint, b.fingerprint);
  },
);

await check("a dated fare on the same city pair is a different entity", async () => {
  const route = fingerprintFor("route", { origin: "SFO", destination: "TPE", carrier: "STARLUX" });
  const fare = fingerprintFor("flight", {
    origin: "SFO",
    destination: "TPE",
    carrier: "STARLUX",
    departOn: "2027-04-10",
    cabin: "business",
  });
  assert.ok(route && fare);
  assert.notEqual(route.fingerprint, fare.fingerprint);
  assert.ok(route.fingerprint.startsWith("route:"));
  assert.ok(fare.fingerprint.startsWith("flight:"));
});

await check("two carriers on one city pair stay apart", async () => {
  const starlux = fingerprintFor("route", { origin: "SFO", destination: "TPE", carrier: "STARLUX" });
  const eva = fingerprintFor("route", { origin: "SFO", destination: "TPE", carrier: "EVA Air" });
  assert.notEqual(starlux.fingerprint, eva.fingerprint);
});

await check("a route with no city pair falls back rather than inventing an identity", async () => {
  const byUrl = fingerprintFor(
    "route",
    { title: "New nonstop announced", carrier: "STARLUX" },
    { urlHash: "abc" },
  );
  assert.equal(byUrl.basis, "url");
  assert.equal(fingerprintFor("route", {}, {}), null);
});

await check("airportCode reads a code and refuses a city name", async () => {
  assert.equal(airportCode("SFO"), "SFO");
  assert.equal(airportCode("sjc"), "SJC");
  assert.equal(airportCode("San Francisco (SFO)"), "SFO");
  assert.equal(airportCode("Taipei"), null, "a city name is not a code");
  assert.equal(airportCode("Taipei Taoyuan"), null);
  assert.equal(airportCode(""), null);
  assert.equal(airportCode(null), null);
  assert.equal(airportCode(42), null);
});

await check("a browser route finding becomes a sighting that dedupes on the city pair", async () => {
  const ctx = { runId: "run-1", goalId: "goal-1", category: "travel", currency: "USD" };
  const one = findingToSighting(
    {
      kind: "route",
      title: "STARLUX adds SFO-Taipei nonstop",
      url: "https://example.com/a",
      origin: "San Francisco (SFO)",
      destination: "TPE",
      carrier: "STARLUX",
      nonstop: "yes",
      service_starts_on: "2027-04-01",
      seat_product: "A350 Business",
    },
    ctx,
  );
  const two = findingToSighting(
    {
      kind: "route",
      title: "New nonstop: San Francisco to Taipei on STARLUX",
      url: "https://other.example.com/b",
      origin: "SFO",
      destination: "Taipei (TPE)",
      carrier: "starlux",
      nonstop: true,
      service_starts_on: "2027-05-15",
    },
    ctx,
  );
  assert.equal(one.kind, "route");
  assert.equal(one.hints.origin, "SFO");
  assert.equal(one.hints.destination, "TPE");
  assert.equal(one.hints.nonstop, true);
  assert.equal(one.hints.serviceStartsOn, "2027-04-01");
  assert.equal(one.hints.seatProduct, "A350 Business");
  // No fare was quoted, so no price and no currency may be invented.
  assert.equal(one.priceCents, null);
  assert.equal(one.currency, null);

  const fpOne = fingerprintFor("route", one.hints, { urlHash: "a" });
  const fpTwo = fingerprintFor("route", two.hints, { urlHash: "b" });
  assert.equal(fpOne.fingerprint, fpTwo.fingerprint, "the second report must be a re-sighting");
});

await check("a dated flight finding now carries its city pair too", async () => {
  const sighting = findingToSighting(
    {
      kind: "flight",
      title: "SFO-SIN business on points",
      origin: "SFO",
      destination: "SIN",
      carrier: "Singapore Airlines",
      dates: "2027-03-14",
      price: "$1,299.00",
    },
    { runId: "r", goalId: "g", category: "travel", currency: "USD" },
  );
  assert.equal(sighting.hints.origin, "SFO");
  assert.equal(sighting.hints.destination, "SIN");
  assert.equal(sighting.priceCents, 129_900);
  const fp = fingerprintFor("flight", sighting.hints, { urlHash: "x" });
  assert.equal(fp.basis, "attrs", "a dated flight with a city pair must not fall back to its URL");
});

await check("the routes kind table exists in the schema and in a migration", async () => {
  assert.match(schemaSrc, /export const routes = pgTable\(\s*"routes"/);
  for (const col of ["origin", "destination", "carrier", "nonstop", "service_starts_on"]) {
    assert.match(schemaSrc, new RegExp(`"${col}"`), `routes is missing ${col}`);
  }
  assert.match(migrationSql, /CREATE TABLE "routes"/, "no migration creates the routes table");
  assert.match(migrationSql, /ADD VALUE 'route'/, "no migration adds route to entity_kind");
});

await check("recordSighting writes a routes row for a route sighting", async () => {
  const recordSrc = readFileSync("src/backend/catalog/record.ts", "utf8");
  assert.match(
    recordSrc,
    /kind === "route" && h\.origin && h\.destination/,
    "insertKindRow does not handle a route, so a route entity gets no routes row",
  );
});

await check("the browser prompt asks for a route and its city pair", async () => {
  const promptSrc = readFileSync("src/backend/browser/runs.ts", "utf8");
  assert.match(promptSrc, /event, product, flight, route, hotel, experience/);
  assert.match(promptSrc, /origin and destination are IATA codes/);
});

console.log(`selfcheck-route-watch: ${passed} checks passed`);
