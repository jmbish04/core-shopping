/**
 * Self-check for the self-serve configuration schema (maestro cs-be-1-6).
 *
 * Twelve tables, and the ones that matter are the ones where the EASY design
 * is the wrong one. Each assertion below is a design decision the brief forced,
 * so reverting any of them turns this red:
 *
 * - `travel_window_stance` must carry `neutral`. The brief calls the gap
 *   between the ideal and the frowned-upon ranges "an opportunity for the agent
 *   to persuide us the ROI is there", so a stated neutral window is a real
 *   instruction. A two-value ideal/frowned enum silently turns it into an
 *   absence.
 * - `loyalty_accounts.points_balance` must be NULLABLE. A programme nobody has
 *   checked has an unknown balance; `NOT NULL DEFAULT 0` would tell the agent
 *   it cannot afford a seat it can afford.
 * - the transfer ratio must be two INTEGER columns. One numeric column invites
 *   0.8 where the truth is 5:4.
 * - `trip_history.person_id` must be nullable, because a household trip has no
 *   one person and resets everyone's clock.
 * - `place_kind` must include `country`, because the clearest stance in the
 *   brief ("japan may be played out at this piont") is about a country and the
 *   table is named `venue_stances`.
 * - `venue_stances.until` must exist. `played_out` is temporary; with no expiry
 *   one sentence in 2026 stops Japan being proposed forever.
 * - the three name+person keys must be `NULLS NOT DISTINCT`, or "Adele" exists
 *   four times with a null person and four different affinities.
 * - the hotel brand key must be case-insensitive, or "Hilton" and "hilton" hold
 *   opposite stances.
 *
 * Reads source text and the generated migration rather than importing, because
 * `src/shared/contracts/config.ts` has relative extensionless value imports
 * that plain Node cannot resolve. The behavioural half runs against real
 * Postgres in `pnpm run verify:trip-history`.
 *
 * **These assertions read the GENERATED MIGRATION, so on their own they cannot
 * catch a regression in the schema source.** Measured 2026-10-25 by a peer
 * session: changing `uniqueIndex(...).on(sql\`lower(brand)\`)` to `.on(brand)`
 * in `schemas/config/travel.ts` left this file green at 13 of 13, because the
 * committed SQL still said `lower("brand")`. `scripts/selfcheck-schema-drift.mjs`
 * is the general guard — it fails whenever `drizzle-kit generate` would emit a
 * new migration, which covers every table at once. The two checks below that
 * name a specific claim also assert the schema source, so the claim is guarded
 * even when read alone.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const contractSrc = readFileSync("src/shared/contracts/config.ts", "utf8");
const enumSrc = readFileSync("src/backend/pg/schemas/enums-config.ts", "utf8");
const barrelSrc = readFileSync("src/backend/pg/schema.ts", "utf8");
const schemaSrc = ["people", "loyalty", "travel", "taste"]
  .map((f) => readFileSync(`src/backend/pg/schemas/config/${f}.ts`, "utf8"))
  .join("\n");
const migrationSql = readdirSync("drizzle-pg")
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(`drizzle-pg/${f}`, "utf8"))
  .join("\n");

/** The table body as the migration wrote it, so a column assertion is scoped. */
function createTable(name) {
  const match = migrationSql.match(new RegExp(`CREATE TABLE "${name}" \\(([\\s\\S]*?)\\n\\);`));
  assert.ok(match, `the migration has no CREATE TABLE for "${name}"`);
  return match[1];
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("selfcheck-config-schema");

const TABLES = [
  "people",
  "preferences",
  "hotel_brand_rules",
  "loyalty_programs",
  "loyalty_accounts",
  "transfer_partners",
  "travel_windows",
  "home_airports",
  "taste_artists",
  "taste_genres",
  "venue_stances",
  "trip_history",
];

check("all twelve config tables are created and registered", () => {
  for (const table of TABLES) createTable(table);
  for (const file of ["config/people", "config/loyalty", "config/travel", "config/taste"]) {
    assert.ok(
      barrelSrc.includes(`schemas/${file}"`),
      `${file} is not exported from src/backend/pg/schema.ts, so drizzle-kit cannot see it`,
    );
  }
  assert.ok(barrelSrc.includes('schemas/enums-config"'), "enums-config is not in the barrel");
});

check("every /api/config resource names a real table", () => {
  const listed = [...contractSrc.matchAll(/^\s{2}"([a-z-]+)",$/gm)].map((m) => m[1]);
  const resources = TABLES.map((t) => t.replace(/_/g, "-")).map((t) =>
    t === "trip-history" ? "trip-history" : t,
  );
  for (const resource of resources) {
    assert.ok(listed.includes(resource), `CONFIG_RESOURCES is missing "${resource}"`);
  }
});

check("a travel window can be deliberately neutral, not just ideal or frowned", () => {
  assert.match(
    contractSrc,
    /TRAVEL_WINDOW_STANCES = \["ideal", "neutral", "frowned"\] as const/,
    'the brief\'s "space between" needs a stored neutral stance',
  );
  assert.match(migrationSql, /CREATE TYPE "public"\."travel_window_stance" AS ENUM\([^)]*'neutral'/);
  assert.ok(enumSrc.includes("TRAVEL_WINDOW_STANCES"), "the pg enum does not read the contract");
});

check("a recurring travel window may end before it starts, and says why", () => {
  assert.match(schemaSrc, /recursYearly: boolean\("recurs_yearly"\)/);
  // 28 December to 4 January is one window, so the input schema must not
  // reject ends_on < starts_on when the window recurs.
  assert.match(contractSrc, /w\.recurs_yearly \|\| w\.starts_on <= w\.ends_on/);
});

check("an unmeasured points balance stays null rather than becoming zero", () => {
  const body = createTable("loyalty_accounts");
  assert.match(body, /"points_balance" integer(?!.*NOT NULL)/, "points_balance must be nullable");
  assert.doesNotMatch(body, /"points_balance"[^,]*DEFAULT 0/, "a default of 0 is a measured zero");
  assert.match(body, /"balance_as_of" timestamp with time zone(?!.*NOT NULL)/);
  // and the contract refuses a balance with no measurement date
  assert.match(contractSrc, /a\.points_balance == null \|\| a\.balance_as_of != null/);
});

check("a transfer ratio is two integers, never one float", () => {
  const body = createTable("transfer_partners");
  assert.match(body, /"ratio_from" integer DEFAULT 1 NOT NULL/);
  assert.match(body, /"ratio_to" integer DEFAULT 1 NOT NULL/);
  assert.doesNotMatch(body, /"ratio[^"]*" (numeric|real|double)/, "a ratio must not be a float");
  assert.match(contractSrc, /t\.from_program_id !== t\.to_program_id/, "a programme must not transfer to itself");
});

check("a household trip has no person and so resets everyone's clock", () => {
  const body = createTable("trip_history");
  assert.match(body, /"person_id" uuid(?!.*NOT NULL)/, "person_id must be nullable for a household trip");
  assert.match(body, /"ended_on" date NOT NULL/);
  // the access pattern is "the most recent trip that ended before date D"
  assert.match(migrationSql, /CREATE INDEX "trip_history_ended_idx" ON "trip_history" USING btree \("ended_on"\)/);
  assert.match(
    migrationSql,
    /CREATE INDEX "trip_history_person_ended_idx" ON "trip_history" USING btree \("person_id","ended_on"\)/,
  );
});

check("a stance can be held about a country, and it expires", () => {
  assert.match(
    contractSrc,
    /PLACE_KINDS = \["venue", "city", "destination", "country", "region"\] as const/,
    '"japan may be played out" is a stance about a country',
  );
  assert.match(contractSrc, /PLACE_STANCES = \[[^\]]*"played_out"\]/);
  const body = createTable("venue_stances");
  assert.match(body, /"place_kind" "place_kind"/);
  assert.match(body, /"until" date/, "played_out with no expiry becomes permanent");
  assert.match(migrationSql, /CREATE INDEX "venue_stances_until_idx"/);
});

check("one household row per name, so a null person is not a licence to duplicate", () => {
  // Asserted in the SCHEMA SOURCE too, not only the generated SQL: dropping
  // `.nullsNotDistinct()` from the source leaves the committed migration
  // correct and this check green until someone regenerates.
  assert.equal(
    (schemaSrc.match(/\.nullsNotDistinct\(\)/g) ?? []).length,
    3,
    "the three name+person keys must each call .nullsNotDistinct() in the schema",
  );
  for (const key of [
    ["taste_artists_name_person_key", '"name","performer_type","for_person_id"'],
    ["taste_genres_name_person_key", '"name","for_person_id"'],
    ["venue_stances_place_person_key", '"place_name","place_kind","for_person_id"'],
  ]) {
    assert.ok(
      migrationSql.includes(`CONSTRAINT "${key[0]}" UNIQUE NULLS NOT DISTINCT(${key[1]})`),
      `${key[0]} must be NULLS NOT DISTINCT, or a null person allows duplicates`,
    );
  }
});

check("a hotel brand holds one stance whatever its capitalisation", () => {
  // The schema source, for the same reason as above. This is the exact
  // regression a peer planted on 2026-10-25 that this file used to miss.
  assert.match(
    schemaSrc,
    /uniqueIndex\("hotel_brand_rules_brand_key"\)\.on\(sql`lower\(\$\{t\.brand\}\)`\)/,
    "the brand key must be built over lower(brand) in the schema, not just in the SQL",
  );
  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX "hotel_brand_rules_brand_key" ON "hotel_brand_rules" USING btree \(lower\("brand"\)\)/,
  );
  // the reason is load-bearing: hotel_options.violates_rule has to quote it
  assert.match(createTable("hotel_brand_rules"), /"reason" text DEFAULT '' NOT NULL/);
});

check("preferences is one household row, and the ROI gate is numbers", () => {
  const body = createTable("preferences");
  assert.match(migrationSql, /CREATE UNIQUE INDEX "preferences_scope_key" ON "preferences" USING btree \("scope"\)/);
  for (const column of [
    "min_trip_nights",
    "max_trip_nights",
    "leg_days_min",
    "leg_days_max",
    "home_leg_days_min",
    "home_leg_days_max",
    "min_days_since_last_trip",
    "time_off_notice_days",
    "max_workdays_off",
    "min_premium_legs",
  ]) {
    assert.match(body, new RegExp(`"${column}" integer`), `${column} must be a number, not prose`);
  }
  assert.match(body, /"acceptable_cabins" "cabin_class"\[\]/, "the acceptable cabins are an enum array");
  assert.match(contractSrc, /p\.min_trip_nights <= p\.max_trip_nights/);
  assert.match(contractSrc, /p\.leg_days_min <= p\.leg_days_max/);
  assert.match(contractSrc, /p\.home_leg_days_min <= p\.home_leg_days_max/);
});

check("a guessed taste is not stored as a stated one", () => {
  assert.match(contractSrc, /TASTE_SOURCES = \["manual", "spotify", "agent"\] as const/);
  assert.match(createTable("taste_artists"), /"source" "taste_source" DEFAULT 'manual' NOT NULL/);
  assert.match(migrationSql, /CREATE INDEX "taste_artists_source_idx"/);
  // would_travel is the strongest affinity and must be first, so a sort by the
  // enum's own order ranks "I would fly anywhere for this" above "like"
  assert.match(contractSrc, /TASTE_AFFINITIES = \["would_travel",/);
});

check("taste and stance rows are writable before any entity exists", () => {
  for (const table of ["taste_artists", "venue_stances"]) {
    assert.match(createTable(table), /"entity_id" uuid(?!.*NOT NULL)/, `${table}.entity_id must be optional`);
  }
  assert.match(createTable("venue_stances"), /"place_name" text NOT NULL/);
  assert.match(createTable("taste_artists"), /"name" text NOT NULL/);
});

console.log(`selfcheck-config-schema: ok (${passed} checks)`);
