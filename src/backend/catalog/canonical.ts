/**
 * @fileoverview Canonicalization and fingerprints (maestro cs-be-4-1): the
 * identity rules that map a sighting onto one `entities` row.
 *
 * No value imports, so `scripts/selfcheck-sightings.mjs` drives every rule in
 * plain Node.
 *
 * Two identities, in the order `recordSighting` tries them:
 *
 * | Identity          | Built from                                        | Stored in                  |
 * |-------------------|---------------------------------------------------|----------------------------|
 * | fingerprint       | per-kind attributes (performer + venue + date...) | `entities.fingerprint` (unique) |
 * | canonical URL     | the URL without tracking and affiliate params     | `sightings.url_hash` (indexed)  |
 *
 * A fingerprint with basis `attrs` names the thing itself, so two sellers of
 * one show map to one entity. When the hints are too thin for that, the
 * fingerprint falls back to the canonical URL (basis `url`), then to the email
 * message id plus title (basis `email`), then to the normalized title (basis
 * `title`). The basis is returned so a caller can tell
 * a strong identity from a weak one.
 *
 * @example
 * const fp = fingerprintFor("event", { title: "Adele", venue: "Chase Center", startsAt: "2026-11-02T20:00:00-08:00" });
 * // { fingerprint: "event:adele|chase center|2026-11-02", basis: "attrs" }
 */

/** Query params that carry tracking or affiliate state, never identity. */
const DROP_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "yclid",
  "twclid",
  "ttclid",
  "li_fat_id",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
  "igshid",
  "si",
  "ref",
  "ref_",
  "referrer",
  "source",
  "spm",
  "tag",
  "linkcode",
  "linkid",
  "ascsubtag",
  "irclickid",
  "irgwc",
  "clickid",
  "click_id",
  "affid",
  "aff_id",
  "affiliate",
  "affiliate_id",
  "aff",
  "subid",
  "sub_id",
  "camref",
  "cjevent",
  "cjdata",
  "ranmid",
  "raneaid",
  "ransiteid",
  "wt.mc_id",
  "cmpid",
  "campaign",
]);
/** Param prefixes that carry tracking state. */
const DROP_PREFIXES = ["utm_", "pk_", "mtm_", "hsa_", "vero_", "oly_"];

/**
 * The canonical form of a URL: scheme `https`, lower-case host without
 * `www.`, no default port, no fragment, no tracking or affiliate params, remaining params
 * sorted, no trailing slash on a non-root path.
 *
 * @param raw - The URL as the agent reported it.
 * @returns The canonical URL, or `null` when `raw` is not an http(s) URL.
 * @example
 * canonicalUrl("https://WWW.Example.com/a/?utm_source=x&b=2&a=1#top"); // "https://example.com/a?a=1&b=2"
 */
export function canonicalUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
  if (!host) return null;
  const kept = [...u.searchParams.entries()]
    .filter(([k]) => {
      const key = k.toLowerCase();
      return !DROP_PARAMS.has(key) && !DROP_PREFIXES.some((p) => key.startsWith(p));
    })
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  const query = kept.length ? `?${new URLSearchParams(kept).toString()}` : "";
  let path = u.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (path === "/") path = "";
  const port =
    u.port &&
    !((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80"))
      ? `:${u.port}`
      : "";
  return `https://${host}${port}${path}${query}`;
}

/**
 * The domain a canonical URL belongs to, for `sources.domain`.
 *
 * @param canonical - A URL from {@link canonicalUrl}.
 * @returns The host, or `null`.
 */
export function urlDomain(canonical: string | null): string | null {
  if (!canonical) return null;
  try {
    return new URL(canonical).hostname;
  } catch {
    return null;
  }
}

/**
 * SHA-256 of a string, as lower-case hex. Used for `sightings.url_hash`.
 *
 * @param text - The input.
 * @returns 64 hex characters.
 */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Text normalized for a fingerprint: no accents, lower case, punctuation as
 * spaces, one space between words, a leading "the " removed.
 *
 * @param value - Any text.
 * @returns The normalized text; `""` for null or blank.
 */
export function normText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^the /, "");
}

/**
 * The calendar date of a date or datetime string, as YYYY-MM-DD in the
 * string's own zone (the date printed on the ticket, not the UTC date).
 *
 * @param value - `2026-11-02`, `2026-11-02T20:00:00-08:00`, or similar.
 * @returns YYYY-MM-DD, or `""` when there is no leading date.
 */
export function dayOf(value: string | null | undefined): string {
  const m = typeof value === "string" ? value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** What an agent can tell us about the thing it saw. All optional. */
export interface EntityHints {
  title?: string | null;
  performer?: string | null;
  venue?: string | null;
  city?: string | null;
  startsAt?: string | null;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  origin?: string | null;
  destination?: string | null;
  carrier?: string | null;
  cabin?: string | null;
  departOn?: string | null;
  returnOn?: string | null;
  propertyName?: string | null;
}

/** How strong a fingerprint is. */
export type FingerprintBasis = "attrs" | "url" | "email" | "title";

/** A fingerprint and what it was built from. */
export interface Fingerprint {
  fingerprint: string;
  basis: FingerprintBasis;
}

function attrsKey(kind: string, h: EntityHints): string | null {
  const n = normText;
  switch (kind) {
    case "event": {
      const who = n(h.performer) || n(h.title);
      const day = dayOf(h.startsAt);
      const where = n(h.venue) || n(h.city);
      return who && day && where ? `${who}|${where}|${day}` : null;
    }
    case "flight": {
      const o = n(h.origin).replace(/ /g, "").toUpperCase();
      const d = n(h.destination).replace(/ /g, "").toUpperCase();
      const out = dayOf(h.departOn);
      return o && d && out
        ? `${o}-${d}|${out}|${dayOf(h.returnOn)}|${n(h.carrier)}|${n(h.cabin)}`
        : null;
    }
    case "product": {
      const brand = n(h.brand);
      const model = n(h.model);
      return brand && model ? `${brand}|${model}|${n(h.variant)}` : null;
    }
    case "hotel": {
      const name = n(h.propertyName) || n(h.title);
      const city = n(h.city);
      return name && city ? `${name}|${city}` : null;
    }
    case "experience": {
      const what = n(h.title);
      const city = n(h.city);
      return what && city ? `${what}|${city}|${dayOf(h.startsAt)}` : null;
    }
    case "performer":
      return n(h.performer) || n(h.title) || null;
    case "venue": {
      const name = n(h.venue) || n(h.title);
      return name ? `${name}|${n(h.city)}` : null;
    }
    default:
      return null;
  }
}

/**
 * The entity fingerprint for a sighting.
 *
 * @param kind - The entity kind (`event`, `flight`, `product`...).
 * @param hints - What the agent saw.
 * @param refs - The sighting's canonical URL hash and email message id, when it has them.
 * @returns The fingerprint and its basis, or `null` when there is no title,
 *   no URL and too few attributes to identify anything.
 * @example
 * fingerprintFor("product", { brand: "Sony", model: "WH-1000XM6" }); // product:sony|wh 1000xm6|
 */
export function fingerprintFor(
  kind: string,
  hints: EntityHints,
  refs: { urlHash?: string | null; emailMessageId?: string | null } = {},
): Fingerprint | null {
  const key = attrsKey(kind, hints);
  if (key) return { fingerprint: `${kind}:${key}`, basis: "attrs" };
  if (refs.urlHash) return { fingerprint: `${kind}:url:${refs.urlHash}`, basis: "url" };
  const title = normText(hints.title);
  // One email can carry several offers, so the message id alone is not an identity.
  const email = refs.emailMessageId?.trim();
  if (email && title) return { fingerprint: `${kind}:email:${email}|${title}`, basis: "email" };
  if (title) return { fingerprint: `${kind}:title:${title}`, basis: "title" };
  return null;
}
