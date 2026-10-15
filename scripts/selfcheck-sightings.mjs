/**
 * Self-check for sightings (maestro cs-be-4-1, cs-be-3-4, cs-be-6-6 step 3):
 * canonical URLs, fingerprints, price parsing, the price delta, and reading a
 * core-browser final answer.
 *
 * In each fixture the wrong answer is the easy one:
 * - two URLs that differ only in tracking params must be EQUAL, and two that
 *   differ in an identity param must DIFFER, so "keep everything" and "drop
 *   everything" both fail
 * - the event date is a late-evening Pacific time, so a UTC date is a day off
 * - the same show from two sellers must share a fingerprint, so a fingerprint
 *   that folds in the URL or the seller fails
 * - the final answer quotes the format before the real object, and carries a
 *   "}" inside a string, so "first match" and "naive brace count" both fail
 * - "$40 - $80" is a range; a parser that takes the first number fails
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { canonicalUrl, urlDomain, normText, dayOf, fingerprintFor, sha256Hex } =
  await import("../src/backend/catalog/canonical.ts");
const { priceToCents, priceDelta, parseBrowserFindings, findingToSighting, kindForCategory } =
  await import("../src/backend/catalog/findings.ts");
const { buildBrowsePrompt } = await import("../src/backend/browser/runs.ts");

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("selfcheck-sightings");

await check(
  "canonicalUrl drops tracking and affiliate params, sorts the rest, normalizes host and path",
  async () => {
    assert.equal(
      canonicalUrl(
        "http://WWW.SeatGeek.com:80/adele-tickets/?utm_source=x&utm_medium=y&fbclid=abc&b=2&a=1&tag=aff-20#dates",
      ),
      "https://seatgeek.com/adele-tickets?a=1&b=2",
    );
  },
);

await check(
  "two URLs that differ only in tracking are equal; an identity param keeps them apart",
  async () => {
    const a = canonicalUrl("https://www.ticketmaster.com/event/1C00?irclickid=Z1&gclid=Q");
    const b = canonicalUrl("https://ticketmaster.com/event/1C00/");
    const c = canonicalUrl("https://ticketmaster.com/event/1C01");
    const d = canonicalUrl("https://shop.example.com/p?id=7");
    const e = canonicalUrl("https://shop.example.com/p?id=8");
    assert.equal(a, b);
    assert.notEqual(b, c);
    assert.notEqual(d, e, "id is identity and must survive");
  },
);

await check("canonicalUrl refuses what is not an http(s) URL", async () => {
  for (const bad of [
    "javascript:alert(1)",
    "ftp://x.com/a",
    "not a url",
    "",
    null,
    undefined,
    42,
  ]) {
    assert.equal(canonicalUrl(bad), null, String(bad));
  }
  assert.equal(urlDomain(canonicalUrl("https://www.Example.com/x")), "example.com");
});

await check("sha256Hex is the real SHA-256", async () => {
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

await check("normText folds accents, case, punctuation, & and a leading 'the'", async () => {
  assert.equal(normText("  The Beyoncé — RENAISSANCE: Tour!! "), "beyonce renaissance tour");
  assert.equal(normText("Simon & Garfunkel"), "simon and garfunkel");
  assert.equal(normText(null), "");
});

await check("dayOf keeps the printed date, not the UTC date", async () => {
  assert.equal(dayOf("2026-11-02T23:30:00-08:00"), "2026-11-02");
  assert.equal(dayOf("2026-11-02"), "2026-11-02");
  assert.equal(dayOf("Nov 2"), "");
});

await check(
  "one show from two sellers shares an event fingerprint; another night does not",
  async () => {
    const h = {
      title: "Chelsea Handler",
      performer: "Chelsea Handler",
      venue: "The Masonic",
      startsAt: "2026-11-14T20:00:00-08:00",
    };
    const a = fingerprintFor("event", h, { urlHash: "aaa" });
    const b = fingerprintFor(
      "event",
      { ...h, title: "chelsea handler!", performer: "CHELSEA HANDLER" },
      { urlHash: "bbb" },
    );
    const c = fingerprintFor(
      "event",
      { ...h, startsAt: "2026-11-15T20:00:00-08:00" },
      { urlHash: "aaa" },
    );
    assert.deepEqual(a, {
      fingerprint: "event:chelsea handler|masonic|2026-11-14",
      basis: "attrs",
    });
    assert.equal(a.fingerprint, b.fingerprint);
    assert.notEqual(a.fingerprint, c.fingerprint);
  },
);

await check("thin hints fall back url, then email + title, then title, then nothing", async () => {
  const thin = { title: "Chelsea Handler" };
  assert.deepEqual(fingerprintFor("event", thin, { urlHash: "h1" }), {
    fingerprint: "event:url:h1",
    basis: "url",
  });
  assert.deepEqual(fingerprintFor("event", thin, { emailMessageId: "<m1@x>" }), {
    fingerprint: "event:email:<m1@x>|chelsea handler",
    basis: "email",
  });
  assert.deepEqual(fingerprintFor("event", thin), {
    fingerprint: "event:title:chelsea handler",
    basis: "title",
  });
  assert.equal(fingerprintFor("event", { title: "  " }), null);
});

await check("flight, product and hotel fingerprints use their own attributes", async () => {
  assert.equal(
    fingerprintFor("flight", {
      origin: "sfo",
      destination: "jfk",
      departOn: "2026-12-20",
      carrier: "JetBlue",
      cabin: "business",
    }).fingerprint,
    "flight:SFO-JFK|2026-12-20||jetblue|business",
  );
  assert.equal(
    fingerprintFor("product", { brand: "Sony", model: "WH-1000XM6" }).fingerprint,
    "product:sony|wh 1000xm6|",
  );
  assert.equal(
    fingerprintFor("product", { brand: "Sony" }, { urlHash: "u" }).basis,
    "url",
    "brand alone is not a product",
  );
  assert.equal(
    fingerprintFor("hotel", { title: "Hotel Zetta", city: "San Francisco" }).fingerprint,
    "hotel:hotel zetta|san francisco",
  );
});

await check("priceToCents reads one amount and refuses ranges, negatives and words", async () => {
  assert.equal(priceToCents("$1,299.99"), 129999);
  assert.equal(priceToCents("USD 40"), 4000);
  assert.equal(priceToCents(19.99), 1999);
  assert.equal(priceToCents(75.25), 7525);
  assert.equal(priceToCents("$40 - $80"), null);
  assert.equal(priceToCents(-5), null);
  assert.equal(priceToCents("free"), null);
  assert.equal(priceToCents(null), null);
});

await check(
  "priceDelta: a drop, a currency mismatch, a zero previous price, no previous",
  async () => {
    const seenAt = new Date("2026-10-01T00:00:00Z");
    assert.deepEqual(priceDelta({ priceCents: 10000, currency: "USD", seenAt }, 7525, "usd"), {
      previous_cents: 10000,
      current_cents: 7525,
      delta_cents: -2475,
      delta_pct: -24.8,
      currency: "USD",
      previous_seen_at: "2026-10-01T00:00:00.000Z",
    });
    assert.equal(priceDelta({ priceCents: 10000, currency: "EUR", seenAt }, 7525, "USD"), null);
    assert.equal(
      priceDelta({ priceCents: 0, currency: "USD", seenAt }, 500, "USD").delta_pct,
      null,
    );
    assert.equal(priceDelta(null, 500, "USD"), null);
    assert.equal(priceDelta({ priceCents: 100, currency: "USD", seenAt }, null, "USD"), null);
  },
);

await check("parseBrowserFindings reads the real empty answer from run ba777743", async () => {
  const message =
    'No current Adele, Pink, Chelsea Handler, or under-$40 small-artist Bay Area offers with visible prices were confirmed on the pages visited, so per the rule against reporting unseen prices the findings are empty. Final answer: {"findings":[]}';
  assert.deepEqual(parseBrowserFindings([{ seq: 25, kind: "ai_decision", message }]), {
    ok: true,
    findings: [],
  });
});

await check(
  "parseBrowserFindings takes the last object of the last decision, string-aware",
  async () => {
    const final =
      'Format is {"findings":[{"title","url"}]}. Final answer: {"findings":[{"title":"Chelsea Handler } live","url":"https://x.com/a","price":"$75.25"}]}';
    const events = [
      { seq: 30, kind: "lease", message: "stopped: done" },
      { seq: 29, kind: "ai_decision", message: final },
      { seq: 12, kind: "ai_decision", message: '{"findings":[{"title":"stale"}]}' },
    ];
    const r = parseBrowserFindings(events);
    assert.equal(r.ok, true);
    assert.equal(r.findings.length, 1);
    assert.equal(r.findings[0].title, "Chelsea Handler } live");
  },
);

await check("parseBrowserFindings says why when there is nothing to read", async () => {
  const r = parseBrowserFindings([
    { seq: 1, kind: "ai_decision", message: "I could not finish." },
    { seq: 2, kind: "error", message: '{"findings":[{"title":"x"}]}' },
  ]);
  assert.equal(r.ok, false);
  assert.match(r.reason, /findings/);
  assert.equal(
    parseBrowserFindings([{ seq: 1, kind: "ai_decision", message: '{"findings":[{"title":' }]).ok,
    false,
  );
});

await check(
  "findingToSighting: named kind, category fallback, seller is not the venue, no-name findings dropped",
  async () => {
    const ctx = { runId: "r", goalId: "g", category: "experience", currency: "USD" };
    const s = findingToSighting(
      {
        title: "Chelsea Handler",
        url: "https://seatgeek.com/x",
        price: "$75.25",
        seller: "SeatGeek",
        dates: "2026-11-14",
        notes: "row M",
      },
      ctx,
    );
    assert.equal(s.kind, "event");
    assert.equal(s.priceCents, 7525);
    assert.equal(s.currency, "USD");
    assert.equal(s.seller, "SeatGeek");
    assert.equal(s.hints.venue, null, "the seller must never become the venue");
    assert.equal(s.hints.startsAt, "2026-11-14");
    assert.equal(findingToSighting({ kind: "hotel", title: "Zetta" }, ctx).kind, "hotel");
    assert.equal(findingToSighting({ kind: "spaceship", title: "Zetta" }, ctx).kind, "event");
    assert.equal(
      findingToSighting({ title: "No price" }, ctx).currency,
      null,
      "no price, no currency guess",
    );
    assert.equal(findingToSighting({ url: "https://a.com/x" }, ctx).title, "https://a.com/x");
    assert.equal(findingToSighting({ notes: "nothing" }, ctx), null);
    assert.equal(kindForCategory("gift"), "product");
  },
);

await check("the browse prompt asks for kind, venue and city", async () => {
  const p = buildBrowsePrompt(
    {
      title: "SF shows",
      category: "experience",
      status: "active",
      instructions: "",
      systemPrompt: "",
      budgetMinCents: null,
      budgetMaxCents: null,
      currency: "USD",
      windowStart: null,
      windowEnd: null,
      timeNotes: "",
      breakRules: [],
    },
    [],
  );
  const tail = p.split("\n").at(-1);
  for (const f of ['\\"kind\\"', '\\"venue\\"', '\\"city\\"'])
    assert.ok(tail.includes(f.replace(/\\/g, "")), f);
});

await check(
  "the sync finishes the run conditionally and records findings only from that finish",
  async () => {
    const b = readFileSync(resolve(root, "src/backend/api/routes/shopping/browse.ts"), "utf8");
    assert.match(
      b,
      /\.where\(and\(eq\(agentRuns\.id, runId\), eq\(agentRuns\.status, "running"\)\)\)\s*\.returning/,
    );
    assert.match(
      b,
      /if \(!finished\.length \|\| runStatus !== "succeeded" \|\| !outcome\) return null;\s*return recordJobFindings\(db, runId, outcome\.events\);/,
    );
    const i = readFileSync(resolve(root, "src/backend/api/index.ts"), "utf8");
    assert.match(i, /app\.route\("\/api\/sightings", sightingsRouter\)/);
  },
);

console.log(`selfcheck-sightings: ${passed} checks passed`);
