#!/usr/bin/env node
/**
 * make-favicon.mjs — an icon that depicts WHAT THIS PROJECT IS, on a tile whose
 * colours are unique to THIS WORKER.
 *
 * Two halves, two jobs:
 *   - The pictogram says what the project does. A roofing-complaint tracker gets
 *     a hard hat, a budget guardian a shield, a job scout a binoculars. It is
 *     CHOSEN by the agent after reading the project. Never the project's initials
 *     — two letters on a square identify nothing, and the script no longer has a
 *     way to produce them.
 *   - The tile's gradient is DERIVED from the Worker name (hash → hue, second hue,
 *     radius, fill style), so thirty Workers that all picked "database" still
 *     look different, and nobody picks a colour.
 *
 * Pictograms come from Lucide — already the frontend's icon library
 * (components.json "iconLibrary": "lucide"), ISC licensed, pinned below so a
 * regeneration is byte-stable. Custom art is allowed via --icon-file.
 *
 * Usage:
 *   node scripts/make-favicon.mjs --search "roof complaint contractor"   # find candidates
 *   node scripts/make-favicon.mjs --icon hard-hat                        # generate
 *   node scripts/make-favicon.mjs --icon-file art/mark.svg               # custom art
 *   node scripts/make-favicon.mjs                                        # regenerate: reuses
 *                                                                        # the icon recorded in
 *                                                                        # public/favicon.svg
 *   node scripts/make-favicon.mjs --self-check
 *
 * Name resolution for the palette: --name, wrangler.jsonc, package.json, cwd.
 * --color "#hex" swaps the derived gradient for a flat brand colour.
 *
 * Writes into public/: favicon.svg .ico .png(32), icon-128.png,
 * apple-touch-icon.png(180), logo.svg, og.png. Where each must be wired:
 * "Every Worker ships an icon" in ~/AGENTS-cloudflare-workers.md.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const LUCIDE = "1.44.0"; // bump deliberately; regenerate every project that uses it
const CDN = `https://cdn.jsdelivr.net/npm/lucide-static@${LUCIDE}`;

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]?.startsWith("--") ? true : (arr[i + 1] ?? true)]);
    return acc;
  }, []),
);

// ---- identity: palette derived from the Worker name -------------------------

function fromConfig(file, strip) {
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file, "utf8");
    // ponytail: wrangler.jsonc allows comments AND trailing commas. Stripping
    // only the comments leaves "}," before a closing brace, which JSON.parse
    // rejects — so this silently returned null and the caller fell through to
    // package.json. On a repo whose package.json still carries the template
    // name, that hands two different Workers the same palette, which is the one
    // thing the derived-hue scheme exists to prevent. Measured on core-shopping
    // 2026-10-08: wrangler.jsonc failed at line 17 and the mark came out under
    // "core-template-cf-reui".
    const text = strip
      ? raw
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/(^|\s)\/\/.*$/gm, "$1")
          .replace(/,(\s*[}\]])/g, "$1")
      : raw;
    return JSON.parse(text).name ?? null;
  } catch {
    return null;
  }
}

// FNV-1a. Deterministic, dependency-free, well-spread for short strings.
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Stable, distinct palette and geometry for a name. Normalised first, so
 * "Core Guardian", "core-guardian" and "core_guardian" are the same Worker.
 */
export function identity(name) {
  const h = hash(String(name).toLowerCase().replace(/[^a-z0-9]/g, ""));
  const hue = h % 360;
  const hue2 = (hue + 35 + ((h >>> 9) % 110)) % 360;
  return {
    hue,
    from: `hsl(${hue} 72% 56%)`,
    to: `hsl(${hue2} 68% 40%)`,
    radiusRatio: 0.16 + ((h >>> 17) % 20) / 100, // .16–.35
    variant: (h >>> 5) % 3, // 0 linear, 1 diagonal, 2 radial
    angle: (h >>> 21) % 4,
  };
}

// ---- pictogram -------------------------------------------------------------

/** Pull viewBox + inner markup out of an SVG document. */
export function parseSvg(svg) {
  const open = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!open) throw new Error("not an SVG");
  const viewBox = open.match(/viewBox="([^"]+)"/i)?.[1] ?? "0 0 24 24";
  const inner = svg.slice(svg.indexOf(open) + open.length, svg.lastIndexOf("</svg>")).trim();
  // ponytail: strips <script> and on* handlers from custom art, not a full
  // sanitiser. Icons come from Lucide or from the repo's own designer, never users.
  const clean = inner.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "");
  return { viewBox, inner: clean };
}

/** Compose the tile + pictogram. `stroked` = Lucide line art (recolour to white). */
export function compose({ size, id, name, icon, flat }) {
  const r = Math.round(size * id.radiusRatio);
  const pad = Math.round(size * 0.2);
  const box = size - pad * 2;
  const gid = `g${id.hue}`;
  const [x2, y2] = [["1", "1"], ["1", "0"], ["0", "1"], ["1", "1"]][id.angle];
  const defs = flat
    ? ""
    : id.variant === 2
      ? `<defs><radialGradient id="${gid}" cx="30%" cy="25%"><stop offset="0" stop-color="${id.from}"/><stop offset="1" stop-color="${id.to}"/></radialGradient></defs>`
      : `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${id.from}"/><stop offset="1" stop-color="${id.to}"/></linearGradient></defs>`;
  const art = icon.stroked
    ? `<svg x="${pad}" y="${pad}" width="${box}" height="${box}" viewBox="${icon.viewBox}" fill="none" stroke="#fff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${icon.inner}</svg>`
    : `<svg x="${pad}" y="${pad}" width="${box}" height="${box}" viewBox="${icon.viewBox}">${icon.inner}</svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${name}" data-icon="${icon.ref}">
  ${defs}
  <rect width="${size}" height="${size}" rx="${r}" fill="${flat ?? `url(#${gid})`}"/>
  ${art}
</svg>`;
}

async function lucideTags() {
  const res = await fetch(`${CDN}/tags.json`);
  if (!res.ok) throw new Error(`lucide tags.json: HTTP ${res.status}`);
  return res.json();
}

/** Rank Lucide icons against free-text words describing the project. */
export function rank(tags, query, limit = 15) {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  return Object.entries(tags)
    .map(([name, t]) => {
      // Whole words only: substring matching ranks "baby" for "roof" via "childproof".
      const nameWords = new Set(name.split("-"));
      const tagWords = new Set(t.join(" ").toLowerCase().split(/[^a-z0-9]+/));
      const score = words.reduce((s, w) => s + (nameWords.has(w) ? 3 : tagWords.has(w) ? 1 : 0), 0);
      return { name, score, tags: t.slice(0, 6) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

async function resolveIcon(outDir) {
  if (typeof args["icon-file"] === "string") {
    const { viewBox, inner } = parseSvg(readFileSync(args["icon-file"], "utf8"));
    return { viewBox, inner, stroked: false, ref: `file:${basename(args["icon-file"])}` };
  }
  let name = typeof args.icon === "string" ? args.icon : null;
  if (!name) {
    // Regeneration: reuse the pictogram recorded in the last favicon.svg.
    const prev = join(outDir, "favicon.svg");
    const rec = existsSync(prev) ? readFileSync(prev, "utf8").match(/data-icon="lucide:([a-z0-9-]+)"/)?.[1] : null;
    if (rec) name = rec;
  }
  if (!name) {
    console.error(`make-favicon: choose a pictogram that depicts what this project DOES.

  Initials are not an icon — this script will not generate them. Read the
  project (README, wrangler.jsonc, what its routes do), then:

    node scripts/make-favicon.mjs --search "<words describing the project>"
    node scripts/make-favicon.mjs --icon <lucide-name>

  Or supply real art:  --icon-file path/to/mark.svg`);
    process.exit(1);
  }
  const res = await fetch(`${CDN}/icons/${name}.svg`);
  if (!res.ok) {
    console.error(`make-favicon: no Lucide icon "${name}" (HTTP ${res.status}). Try --search.`);
    process.exit(1);
  }
  return { ...parseSvg(await res.text()), stroked: true, ref: `lucide:${name}` };
}

// ---- self-check (offline) --------------------------------------------------

function selfCheck() {
  const eq = (a, b, m) => { if (a !== b) throw new Error(`${m}: ${a} !== ${b}`); };
  const ne = (a, b, m) => { if (a === b) throw new Error(`${m}: both ${a}`); };
  eq(identity("core-guardian").hue, identity("core-guardian").hue, "stable");
  eq(identity("Core Guardian").hue, identity("core-guardian").hue, "case/separator insensitive");
  ne(identity("core-guardian").hue, identity("core-bridge").hue, "distinct per worker");
  ne(identity("9to5").hue, identity("9to5-scout").hue, "sibling workers differ");

  const fixture = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 15v-3a6 6 0 0 1 6-6"/></svg>';
  const icon = { ...parseSvg(fixture), stroked: true, ref: "lucide:hard-hat" };
  const out = compose({ size: 64, id: identity("roof"), name: "roof", icon, flat: null });
  if (!out.includes('d="M4 15v-3a6 6 0 0 1 6-6"')) throw new Error("pictogram path missing from output");
  if (!out.includes('data-icon="lucide:hard-hat"')) throw new Error("icon choice not recorded");
  if (/<text\b/.test(out)) throw new Error("output contains text — initials are forbidden");
  eq(parseSvg('<svg viewBox="0 0 10 10"><script>x()</script><g onclick="y()"/></svg>').inner, "<g/>", "custom art sanitised");

  const r = rank({ "hard-hat": ["construction", "roof"], "shield": ["security"], "baby": ["childproof"] }, "roof construction");
  eq(r[0].name, "hard-hat", "search ranks a tag match");
  eq(r.some((x) => x.name === "baby"), false, "no substring matches");
  console.log("self-check ok");
}

// ---- CLI -------------------------------------------------------------------

const isCli = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isCli) {
  if (args["self-check"]) {
    selfCheck();
    process.exit(0);
  }
  if (typeof args.search === "string") {
    const hits = rank(await lucideTags(), args.search);
    if (!hits.length) console.log("no matches — try broader words (what the project does, not its name)");
    for (const h of hits) console.log(`${h.name.padEnd(28)} ${h.tags.join(", ")}`);
    console.log(`\nPreview: https://lucide.dev/icons/<name>   Then: --icon <name>`);
    process.exit(0);
  }

  const name =
    (typeof args.name === "string" && args.name) ||
    fromConfig(join(process.cwd(), "wrangler.jsonc"), true) ||
    fromConfig(join(process.cwd(), "wrangler.json"), true) ||
    fromConfig(join(process.cwd(), "package.json"), false) ||
    basename(process.cwd());
  const id = identity(name);
  const flat = typeof args.color === "string" ? args.color : null;
  const outDir = join(process.cwd(), "public");
  mkdirSync(outDir, { recursive: true });

  const icon = await resolveIcon(outDir);
  writeFileSync(join(outDir, "favicon.svg"), compose({ size: 64, id, name, icon, flat }));
  writeFileSync(join(outDir, "logo.svg"), compose({ size: 256, id, name, icon, flat }));
  console.log(`✅ public/favicon.svg, public/logo.svg — "${name}": ${icon.ref} on hue ${id.hue}${flat ? ` (flat ${flat})` : ""}`);

  // Raster versions. Required: older browsers need favicon.ico, and the MCP
  // `icons` spec only makes image/png and image/jpeg mandatory for clients.
  // ponytail: shells out to sharp-cli rather than embedding a rasterizer. Needs
  // network on first run; on failure you get the commands to run yourself.
  const raster = [
    ["favicon.png", 32],
    ["icon-128.png", 128], // MCP icons[] — same-origin https, served unauthenticated
    ["apple-touch-icon.png", 180],
    ["og.png", 1200],
  ];
  try {
    for (const [file, size] of raster) {
      execFileSync(
        "npx",
        ["-y", "sharp-cli", "-i", join(outDir, "logo.svg"), "-o", join(outDir, file), "resize", String(size), String(size)],
        { stdio: "ignore" },
      );
    }
    const ico = execFileSync("npx", ["-y", "png-to-ico", join(outDir, "favicon.png")], { maxBuffer: 8 * 1024 * 1024 });
    writeFileSync(join(outDir, "favicon.ico"), ico);
    console.log(`✅ ${raster.map(([f]) => f).join(", ")}, favicon.ico`);
  } catch (err) {
    console.error(`\n⚠️  Raster generation failed (${err.message.split("\n")[0]}). Run by hand:
  npx -y sharp-cli -i public/logo.svg -o public/favicon.png resize 32 32
  npx -y sharp-cli -i public/logo.svg -o public/icon-128.png resize 128 128
  npx -y sharp-cli -i public/logo.svg -o public/apple-touch-icon.png resize 180 180
  npx -y png-to-ico public/favicon.png > public/favicon.ico
An app with no favicon.ico and no PNG icon is not finished.`);
    process.exitCode = 1;
  }
}
