#!/usr/bin/env node

/**
 * Tour It — Harvest cover-photo CANDIDATES for top courses (no DB writes)
 *
 * For each course in top-courses-data-gaps.json (the curated top-public set
 * missing a coverImageUrl), gather wide, high-res candidate photos from:
 *   - Wikipedia REST originalimage
 *   - GolfPass travel-advisor hero (og:image)
 *   - the club/resort website og:image + twitter:image
 *   - extra URLs supplied per-course in EXTRA (hand-picked official galleries)
 *
 * Downloads every valid candidate (width >= 1000, aspect 1.3–2.7) to
 * /tmp/top-covers/{rank}-{slug}-{source}-{n}.{ext} and writes a manifest.json.
 *
 * NOTHING is uploaded or written to the DB. A human (Claude) then views the
 * candidates and picks the genuine on-course shots before commit-top-covers.mjs
 * uploads the chosen files.
 *
 * Usage:
 *   node src/scripts/harvest-top-covers.mjs                 (all 40)
 *   node src/scripts/harvest-top-covers.mjs --only <rank,rank>
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OUT_DIR = "/tmp/top-covers";
mkdirSync(OUT_DIR, { recursive: true });

// Per-course extra candidate URLs (hand-picked official/media galleries).
// Keyed by rank. Filled in as we learn which sources have great on-course shots.
const EXTRA = {};

// ── args ──
const onlyArg = (() => {
  const i = process.argv.indexOf("--only");
  if (i === -1) return null;
  return new Set((process.argv[i + 1] || "").split(",").map((s) => parseInt(s, 10)));
})();

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function safeFetch(url, opts = {}) {
  const c = new AbortController();
  const to = setTimeout(() => c.abort(), opts.timeout || 15000);
  try {
    return await fetch(url, {
      signal: c.signal, redirect: "follow",
      headers: { "User-Agent": UA, Accept: opts.accept || "text/html,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", ...(opts.headers || {}) },
    });
  } catch { return null; } finally { clearTimeout(to); }
}
async function fetchText(url, opts) { const r = await safeFetch(url, opts); if (!r || !r.ok) return null; try { return await r.text(); } catch { return null; } }
async function fetchJson(url, opts) { const r = await safeFetch(url, opts); if (!r || !r.ok) return null; try { return await r.json(); } catch { return null; } }
async function fetchBuffer(url) {
  const r = await safeFetch(url, { accept: "image/*,*/*;q=0.8" });
  if (!r || !r.ok) return null;
  try { return { buf: Buffer.from(await r.arrayBuffer()), ct: (r.headers.get("content-type") || "").toLowerCase() }; }
  catch { return null; }
}

// ── image inspection (jpeg/png/webp) ──
function fmt(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50) return "png";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return "webp";
  return null;
}
function pngSize(b) { return b.length < 24 ? null : { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; }
function jpegSize(b) {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1]; i += 2;
    if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
      if (i + 7 > b.length) return null;
      return { height: b.readUInt16BE(i + 3), width: b.readUInt16BE(i + 5) };
    }
    if (i + 2 > b.length) return null;
    i += b.readUInt16BE(i);
  }
  return null;
}
function webpSize(b) {
  if (b.length < 30) return null;
  const c = b.slice(12, 16).toString("ascii");
  if (c === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (c === "VP8L") { const b0 = b[21], b1 = b[22], b2 = b[23], b3 = b[24]; return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) }; }
  if (c === "VP8X") return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
  return null;
}
function inspect(b) {
  const f = fmt(b); if (!f) return null;
  const s = f === "png" ? pngSize(b) : f === "jpeg" ? jpegSize(b) : webpSize(b);
  if (!s || !s.width || !s.height) return null;
  return { format: f, ...s };
}
const extOf = (f) => (f === "jpeg" ? "jpg" : f);

// Quality bar: wide landscape, genuinely high-res.
function goodCover(info) {
  if (!info) return false;
  if (info.width < 1000) return false;
  const ar = info.width / info.height;
  return ar >= 1.3 && ar <= 2.7;
}

// ── sources ──
async function fromWikipedia(course) {
  const tries = [course.name];
  if (!/golf|country club/i.test(course.name)) tries.push(`${course.name} Golf Club`, `${course.name} (golf course)`);
  const out = [];
  for (const q of tries) {
    const enc = encodeURIComponent(q.replace(/\s+/g, "_"));
    const d = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${enc}`, { headers: { "Api-User-Agent": "TourIt/1.0 (corey@touritgolf.com)" } });
    await sleep(150);
    if (!d || d.type === "disambiguation") continue;
    const blob = `${d.title || ""} ${d.description || ""} ${d.extract || ""}`.toLowerCase();
    if (!blob.includes("golf")) continue;
    if (d.originalimage?.source) out.push(d.originalimage.source);
  }
  return out;
}

async function ddg(query, hostNeedle, pathPrefix = "") {
  const html = await fetchText(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  if (!html) return [];
  const all = html.match(/https?:\/\/[A-Za-z0-9._\-/?=&%~#@!$+,;:'()*]+/g) || [];
  const out = new Set();
  for (let u of all) {
    u = u.replace(/&amp;/g, "&");
    try { const p = new URL(u); if (!p.hostname.includes(hostNeedle)) continue; if (pathPrefix && !p.pathname.startsWith(pathPrefix)) continue; out.add(p.toString()); } catch {}
  }
  return [...out];
}

async function fromGolfPass(course) {
  const pages = await ddg(`site:golfpass.com travel-advisor ${course.name} ${course.city || ""}`, "golfpass.com", "/travel-advisor/courses/");
  const out = [];
  for (const url of [...new Set(pages.map((u) => u.replace(/[?#].*$/, "")))].slice(0, 3)) {
    const html = await fetchText(url); await sleep(600);
    if (!html) continue;
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (og && !/logo/i.test(og[1])) out.push(og[1].replace(/&amp;/g, "&"));
  }
  return out;
}

async function fromCommons(course) {
  // Wikimedia Commons file search — returns several real photos to view/choose.
  const queries = [
    `${course.name}`,
    `${course.name} golf ${course.state || ""}`.trim(),
  ];
  const out = [];
  const seen = new Set();
  for (const q of queries) {
    const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search` +
      `&gsrsearch=${encodeURIComponent(q + " golf")}&gsrnamespace=6&gsrlimit=12` +
      `&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1600&format=json`;
    const d = await fetchJson(api, { headers: { "Api-User-Agent": "TourIt/1.0 (corey@touritgolf.com)" } });
    await sleep(150);
    const pages = d?.query?.pages;
    if (!pages) continue;
    for (const k of Object.keys(pages)) {
      const ii = pages[k].imageinfo?.[0];
      if (!ii) continue;
      const mime = (ii.mime || "").toLowerCase();
      if (!/jpeg|png|webp/.test(mime)) continue; // skip svg/tiff/pdf
      const u = ii.thumburl || ii.url;
      if (u && !seen.has(u)) { seen.add(u); out.push(u); }
    }
  }
  return out;
}

async function fromWebsite(course) {
  if (!course.websiteUrl) return [];
  let t = course.websiteUrl.trim();
  if (!/^https?:\/\//i.test(t)) t = "https://" + t;
  const html = await fetchText(t);
  if (!html) return [];
  const out = [];
  for (const re of [/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i]) {
    const m = html.match(re);
    if (m) {
      let u = m[1].replace(/&amp;/g, "&");
      if (/\.aspx|getImage\.gif|clubessential|logo/i.test(u)) continue;
      if (/^\/\//.test(u)) u = "https:" + u;
      else if (/^\//.test(u)) { try { const b = new URL(t); u = `${b.protocol}//${b.host}${u}`; } catch {} }
      if (/^https?:/i.test(u)) out.push(u);
    }
  }
  return out;
}

function slugify(s) { return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }

async function main() {
  const gaps = JSON.parse(readFileSync(path.join(REPO_ROOT, "top-courses-data-gaps.json"), "utf8")).gaps;
  const targets = gaps.filter((g) => !onlyArg || onlyArg.has(g.rank));

  // pull websiteUrl for each
  const ids = targets.map((t) => t.courseId);
  const byId = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from("Course").select("id, name, city, state, websiteUrl").in("id", ids.slice(i, i + 100));
    for (const r of data || []) byId.set(r.id, r);
  }

  const manifest = [];
  for (const t of targets) {
    const c = byId.get(t.courseId) || { id: t.courseId, name: t.name, city: t.city, state: t.state };
    process.stderr.write(`\n#${t.rank} ${c.name} (${c.state})\n`);
    const sources = [];
    try { for (const u of await fromWikipedia(c)) sources.push(["wikipedia", u]); } catch {}
    try { for (const u of await fromCommons(c)) sources.push(["commons", u]); } catch {}
    try { for (const u of await fromGolfPass(c)) sources.push(["golfpass", u]); } catch {}
    try { for (const u of await fromWebsite(c)) sources.push(["website", u]); } catch {}
    for (const u of EXTRA[t.rank] || []) sources.push(["extra", u]);

    const seen = new Set();
    let n = 0;
    const saved = [];
    for (const [src, url] of sources) {
      if (seen.has(url)) continue; seen.add(url);
      const got = await fetchBuffer(url);
      if (!got) { process.stderr.write(`   ✗ ${src}: fetch failed\n`); continue; }
      const info = inspect(got.buf);
      if (!info) { process.stderr.write(`   ✗ ${src}: not an image\n`); continue; }
      if (!goodCover(info)) { process.stderr.write(`   ✗ ${src}: ${info.width}x${info.height} (below bar)\n`); continue; }
      n++;
      const file = path.join(OUT_DIR, `${String(t.rank).padStart(3, "0")}-${slugify(c.name)}-${src}-${n}.${extOf(info.format)}`);
      writeFileSync(file, got.buf);
      saved.push({ source: src, url, file, width: info.width, height: info.height });
      process.stderr.write(`   ✓ ${src}: ${info.width}x${info.height} -> ${path.basename(file)}\n`);
    }
    manifest.push({ rank: t.rank, courseId: t.courseId, name: c.name, city: c.city, state: c.state, candidates: saved });
  }

  writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  const withCands = manifest.filter((m) => m.candidates.length > 0).length;
  process.stderr.write(`\nDone. ${withCands}/${manifest.length} courses have >=1 candidate. Manifest: ${OUT_DIR}/manifest.json\n`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
