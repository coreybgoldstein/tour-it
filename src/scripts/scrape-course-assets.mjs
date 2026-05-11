#!/usr/bin/env node

/**
 * Tour It — Real Logo / Cover scraper
 *
 * For each Course in a supplied --ids-file, attempts (in order) to find a real
 * club LOGO and a real club COVER photo from free public sources:
 *
 *   LOGO  sources:  Wikipedia REST → Facebook page og:image → club website og:image
 *   COVER sources:  Wikipedia REST (wide image) → GolfPass hero → club website og:image
 *
 * Validates image bytes, dimensions, and aspect ratio. Uploads winning assets
 * to tour-it-photos/course-images/{courseId}-{logo|cover}.{ext} (upsert) and
 * patches the Course row.
 *
 * Skip rules:
 *   - A logoUrl ending in `-logo.svg` is treated as a Tour It placeholder and
 *     can be overwritten with a real logo.
 *   - A non-placeholder logoUrl is left alone.
 *   - A coverImageUrl is left alone unless the URL is broken (404 / non-image).
 *   - Courses that already have a real logo AND a working cover are skipped
 *     entirely (no network calls made).
 *
 * Usage:
 *   node src/scripts/scrape-course-assets.mjs --ids-file columbia-radius-ids.txt
 *   node src/scripts/scrape-course-assets.mjs --ids-file ids.txt --dry
 *   node src/scripts/scrape-course-assets.mjs --ids-file ids.txt --limit 20
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Args ──────────────────────────────────────────────────────────────────────
function parseArgs() {
  const argv = process.argv.slice(2);
  const out = { idsFile: null, dry: false, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ids-file") out.idsFile = argv[i + 1];
    else if (argv[i] === "--dry") out.dry = true;
    else if (argv[i] === "--limit") out.limit = parseInt(argv[i + 1], 10) || Infinity;
  }
  return out;
}

// ── Network helpers ───────────────────────────────────────────────────────────
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function safeFetch(url, opts = {}) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), opts.timeout || 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept: opts.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...(opts.headers || {}),
      },
    });
    return res;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(to);
  }
}

async function safeFetchText(url, opts = {}) {
  const res = await safeFetch(url, opts);
  if (!res || !res.ok) return null;
  try {
    return await res.text();
  } catch {
    return null;
  }
}

async function safeFetchJson(url, opts = {}) {
  const res = await safeFetch(url, opts);
  if (!res || !res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function safeFetchBuffer(url) {
  const res = await safeFetch(url, { accept: "image/*,*/*;q=0.8" });
  if (!res || !res.ok) return null;
  try {
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    return { buf, contentType: ct };
  } catch {
    return null;
  }
}

// ── Image inspection (pure JS, no native deps) ────────────────────────────────
function detectImageFormat(buf) {
  if (!buf || buf.length < 12) return null;
  const b = buf;
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  // WEBP — RIFF....WEBP
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "webp";
  // GIF
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  // SVG (text)
  const head = b.slice(0, 256).toString("utf8").toLowerCase();
  if (head.includes("<svg") || (head.includes("<?xml") && head.includes("svg"))) return "svg";
  return null;
}

function getPngSize(buf) {
  // IHDR is at byte 16 (width) and 20 (height), big-endian uint32
  if (buf.length < 24) return null;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return { width: w, height: h };
}

function getJpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    i += 2;
    // SOF markers (start of frame)
    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      if (i + 7 > buf.length) return null;
      const h = buf.readUInt16BE(i + 3);
      const w = buf.readUInt16BE(i + 5);
      return { width: w, height: h };
    }
    if (i + 2 > buf.length) return null;
    const seg = buf.readUInt16BE(i);
    i += seg;
  }
  return null;
}

function getWebpSize(buf) {
  // VP8 / VP8L / VP8X
  if (buf.length < 30) return null;
  const fourCC = buf.slice(12, 16).toString("ascii");
  if (fourCC === "VP8 ") {
    const w = buf.readUInt16LE(26) & 0x3fff;
    const h = buf.readUInt16LE(28) & 0x3fff;
    return { width: w, height: h };
  }
  if (fourCC === "VP8L") {
    const b0 = buf[21];
    const b1 = buf[22];
    const b2 = buf[23];
    const b3 = buf[24];
    const w = 1 + (((b1 & 0x3f) << 8) | b0);
    const h = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width: w, height: h };
  }
  if (fourCC === "VP8X") {
    const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width: w, height: h };
  }
  return null;
}

function getGifSize(buf) {
  if (buf.length < 10) return null;
  const w = buf.readUInt16LE(6);
  const h = buf.readUInt16LE(8);
  return { width: w, height: h };
}

function getSvgSize(buf) {
  const head = buf.slice(0, 4096).toString("utf8");
  const wM = head.match(/\bwidth=["'](\d+(?:\.\d+)?)/i);
  const hM = head.match(/\bheight=["'](\d+(?:\.\d+)?)/i);
  if (wM && hM) return { width: parseFloat(wM[1]), height: parseFloat(hM[1]) };
  const vb = head.match(/viewBox=["']([\d.\s-]+)["']/i);
  if (vb) {
    const parts = vb[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4) return { width: parts[2], height: parts[3] };
  }
  return null;
}

function inspectImage(buf) {
  const fmt = detectImageFormat(buf);
  if (!fmt) return null;
  let size = null;
  if (fmt === "png") size = getPngSize(buf);
  else if (fmt === "jpeg") size = getJpegSize(buf);
  else if (fmt === "webp") size = getWebpSize(buf);
  else if (fmt === "gif") size = getGifSize(buf);
  else if (fmt === "svg") size = getSvgSize(buf);
  if (!size || !size.width || !size.height) return null;
  return { format: fmt, width: size.width, height: size.height };
}

function isOgPlaceholder(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  // Generic Facebook fallback / no-image patterns
  return (
    u.includes("fb-no-photo") ||
    u.includes("rsrc.php/v3/yk") || // generic FB silhouette
    u.includes("facebook-logo") ||
    u.endsWith("/static.xx.fbcdn.net/")
  );
}

// ── DuckDuckGo HTML search (no API key required) ──────────────────────────────
// Returns deduped result URLs (the linked target, not DDG's redirector) whose
// host contains `hostNeedle` and whose path starts with `pathPrefix` (may be "").
async function ddgSearch(query, hostNeedle, pathPrefix = "") {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await safeFetchText(url);
  if (!html) return [];
  // Find every plain http(s) URL in the HTML.
  const all = html.match(/https?:\/\/[A-Za-z0-9._\-/?=&%~#@!$+,;:'()*]+/g) || [];
  // DDG wraps target URLs in a redirector: //duckduckgo.com/l/?uddg=<encoded>
  // The plain target URL is usually present too. Filter to ones matching host + path.
  const out = new Set();
  for (let u of all) {
    // Some links are HTML-entity encoded: &amp; → &
    u = u.replace(/&amp;/g, "&");
    try {
      const parsed = new URL(u);
      const host = parsed.hostname;
      if (!host.includes(hostNeedle)) continue;
      if (pathPrefix && !parsed.pathname.startsWith(pathPrefix)) continue;
      // Strip any trailing junk that snuck into the match (commas etc)
      out.add(parsed.toString());
    } catch {
      // ignore malformed
    }
  }
  return [...out];
}

// ── Source 1: Wikipedia ───────────────────────────────────────────────────────
async function tryWikipedia(course) {
  // Try plain name, then name + "Golf Club"/"Country Club" cleanup variants
  const candidates = [course.name];
  if (!/golf|country club/i.test(course.name)) {
    candidates.push(`${course.name} Golf Club`);
  }
  for (const q of candidates) {
    const enc = encodeURIComponent(q.replace(/\s+/g, "_"));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${enc}`;
    const data = await safeFetchJson(url, {
      headers: { "Api-User-Agent": "TourIt/1.0 (corey@touritgolf.com)" },
    });
    await sleep(200);
    if (!data) continue;
    if (data.type === "disambiguation") continue;
    // Only accept if the article mentions golf
    const blob = `${data.title || ""} ${data.description || ""} ${data.extract || ""}`.toLowerCase();
    if (!blob.includes("golf")) continue;
    const original = data.originalimage?.source || null;
    if (original) return original;
  }
  return null;
}

// ── Source 2: Facebook page og:image (via DDG to find the page) ───────────────
async function tryFacebook(course) {
  // Use DDG to find the canonical FB page URL
  const q = `site:facebook.com ${course.name} ${course.city || ""} ${course.state || ""}`.trim();
  const pages = await ddgSearch(q, "facebook.com", "/");
  const candidates = pages
    .map((u) => u.replace(/[?#].*$/, "").replace(/\/$/, ""))
    .filter((u) => {
      const path = u.replace(/^https?:\/\/(?:www\.)?facebook\.com\//, "");
      if (!path) return false;
      const first = path.split("/")[0];
      if (["pages", "login", "sharer", "events", "groups", "watch", "marketplace", "help"].includes(first.toLowerCase())) return false;
      return first.length >= 3;
    });
  const uniq = [...new Set(candidates)].slice(0, 2);
  for (const url of uniq) {
    const finalUrl = url.endsWith("/") ? url : url + "/";
    const html = await safeFetchText(finalUrl);
    await sleep(500);
    if (!html || html.length < 5000) continue; // empty/blocked page
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (!m) continue;
    let imgUrl = m[1].replace(/&amp;/g, "&");
    if (isOgPlaceholder(imgUrl)) continue;
    return imgUrl;
  }
  return null;
}

// ── Source 3: Club website discovery ──────────────────────────────────────────
// Returns { logo: url|null, cover: url|null } based on what we can extract from
// the homepage. Tries og:image (could be either), twitter:image, apple-touch-icon
// link tag, and <img> tags whose src/alt contain "logo".
async function tryClubWebsite(course) {
  if (!course.websiteUrl) return { logo: null, cover: null };
  let target = course.websiteUrl.trim();
  if (!/^https?:\/\//i.test(target)) target = "https://" + target;
  const html = await safeFetchText(target);
  if (!html) return { logo: null, cover: null };

  const baseUrl = (() => {
    try {
      const u = new URL(target);
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  })();
  function abs(u) {
    if (!u) return null;
    u = u.replace(/&amp;/g, "&");
    if (/^data:/i.test(u)) return null;
    if (/^https?:/i.test(u)) return u;
    if (!baseUrl) return null;
    if (u.startsWith("//")) return "https:" + u;
    if (u.startsWith("/")) return baseUrl + u;
    return baseUrl + "/" + u;
  }

  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const tw = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  // apple-touch-icon link tag (highest-resolution available — these are square logos)
  const apples = [...html.matchAll(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/gi)].map(
    (m) => m[1]
  );
  // Also try common extension variants because many sites declare an extensionless
  // path that's actually served via a route-rewrite at .png
  const appleVariants = new Set();
  for (const a of apples) {
    appleVariants.add(a);
    if (!/\.[a-z]{2,4}(\?|$)/i.test(a)) {
      appleVariants.add(a + ".png");
      appleVariants.add(a + "-180x180.png");
    }
  }
  // Common conventional paths
  appleVariants.add("/apple-touch-icon.png");
  appleVariants.add("/apple-touch-icon-180x180.png");
  appleVariants.add("/apple-touch-icon-152x152.png");
  // Logo <img>: src or alt contains "logo"
  const logoImgs = [...html.matchAll(/<img[^>]+>/gi)]
    .map((m) => m[0])
    .filter((tag) => /logo/i.test(tag))
    .map((tag) => {
      // Prefer src="" but fall back to data-src or srcset
      const src = (tag.match(/(?:^|\s)src=["']([^"']+)["']/i) || [])[1];
      return src;
    })
    .filter(Boolean);

  // Reject .aspx and getImage.gif and clubessential per project rules
  const reject = (u) => !u || /\.aspx(\?|$)/i.test(u) || /getImage\.gif/i.test(u) || /clubessential/i.test(u);

  const ogUrl = og ? abs(og[1]) : null;
  const twUrl = tw ? abs(tw[1]) : null;
  const appleUrls = [...appleVariants].map(abs).filter((u) => u && !reject(u));
  const logoImgUrls = logoImgs.map(abs).filter((u) => u && !reject(u));

  return {
    ogImage: !reject(ogUrl) ? ogUrl : null,
    twImage: !reject(twUrl) ? twUrl : null,
    appleIcons: appleUrls,
    logoImgs: logoImgUrls,
  };
}

// ── Source 4: GolfPass hero photo (via DDG site search) ───────────────────────
async function tryGolfPass(course) {
  const q = `site:golfpass.com travel-advisor ${course.name} ${course.city || ""}`.trim();
  const pages = await ddgSearch(q, "golfpass.com", "/travel-advisor/courses/");
  const candidates = [...new Set(pages.map((u) => u.replace(/[?#].*$/, "")))].slice(0, 3);
  await sleep(1000);
  for (const url of candidates) {
    const html = await safeFetchText(url);
    await sleep(1000);
    if (!html) continue;
    // Hero is reliably exposed as og:image (a brightspotcdn URL)
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (og) {
      const imgUrl = og[1].replace(/&amp;/g, "&");
      if (imgUrl && !/logo/i.test(imgUrl)) return imgUrl;
    }
    // Fallback: inline brightspot URL
    const direct = html.match(/https:\/\/golf-pass-brightspot\.s3\.amazonaws\.com\/[A-Za-z0-9\/_.-]+\.(?:jpg|jpeg|png|webp)/i);
    if (direct) return direct[0];
  }
  return null;
}

// ── Validation ────────────────────────────────────────────────────────────────
async function fetchAndInspect(url) {
  if (!url) return null;
  const got = await safeFetchBuffer(url);
  if (!got) return null;
  const info = inspectImage(got.buf);
  if (!info) return null;
  return { ...info, buf: got.buf };
}

function validForLogo(info) {
  if (!info) return false;
  // Min 120px — apple-touch-icons are often 152/180/196, all great for logos.
  if (info.width < 120) return false;
  const ar = info.width / info.height;
  if (ar < 0.5 || ar > 2.0) return false;
  return true;
}

function validForCover(info) {
  if (!info) return false;
  if (info.width < 600) return false;
  const ar = info.width / info.height;
  if (ar < 1.3) return false;
  return true;
}

// ── Upload ────────────────────────────────────────────────────────────────────
function extFor(format) {
  if (format === "jpeg") return "jpg";
  return format;
}

function contentTypeFor(format) {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  if (format === "gif") return "image/gif";
  if (format === "svg") return "image/svg+xml";
  return "application/octet-stream";
}

async function uploadAsset(courseId, kind, info) {
  const ext = extFor(info.format);
  const filePath = `course-images/${courseId}-${kind}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("tour-it-photos")
    .upload(filePath, new Uint8Array(info.buf), {
      contentType: contentTypeFor(info.format),
      upsert: true,
    });
  if (upErr) throw new Error(`upload ${kind} ${filePath}: ${upErr.message}`);
  // Best-effort: delete the legacy placeholder SVG when we upload a non-SVG logo.
  if (kind === "logo" && info.format !== "svg") {
    await supabase.storage
      .from("tour-it-photos")
      .remove([`course-images/${courseId}-logo.svg`])
      .catch(() => {});
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from("tour-it-photos").getPublicUrl(filePath);
  // Add cache-buster to bypass CDN cache of any old asset at the same path
  return `${publicUrl}?v=${Date.now()}`;
}

// ── Helpers for skip detection ────────────────────────────────────────────────
function isPlaceholderLogo(url) {
  if (!url) return true;
  // Our placeholder script writes `-logo.svg` to course-images
  return /-logo\.svg(?:\?.*)?$/i.test(url);
}

async function coverIsBroken(url) {
  if (!url) return true;
  const res = await safeFetch(url, { accept: "image/*" });
  if (!res || !res.ok) return true;
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!ct.startsWith("image/")) return true;
  return false;
}

// ── Per-course pipeline ───────────────────────────────────────────────────────
async function processCourse(course) {
  const result = { logo: "skipped", cover: "skipped" };
  const placeholder = isPlaceholderLogo(course.logoUrl);
  const needLogo = placeholder;
  const needCover = !course.coverImageUrl || (await coverIsBroken(course.coverImageUrl));

  if (!needLogo && !needCover) return result;

  // Cache Wikipedia result — it serves both logo and cover decisions
  let wikiImg = null;
  let wikiInfo = null;
  try {
    wikiImg = await tryWikipedia(course);
    if (wikiImg) wikiInfo = await fetchAndInspect(wikiImg);
  } catch {}

  // Pre-fetch website assets once (covers logo + cover use cases)
  let webAssets = null;
  if ((needLogo || needCover) && course.websiteUrl) {
    try {
      webAssets = await tryClubWebsite(course);
    } catch {}
  }

  async function patchLogo(info, source) {
    try {
      const url = await uploadAsset(course.id, "logo", info);
      await supabase
        .from("Course")
        .update({ logoUrl: url, updatedAt: new Date().toISOString() })
        .eq("id", course.id);
      result.logo = source;
      return true;
    } catch {
      result.logo = "failed";
      return false;
    }
  }

  async function patchCover(info, source) {
    try {
      const url = await uploadAsset(course.id, "cover", info);
      await supabase
        .from("Course")
        .update({ coverImageUrl: url, updatedAt: new Date().toISOString() })
        .eq("id", course.id);
      result.cover = source;
      return true;
    } catch {
      result.cover = "failed";
      return false;
    }
  }

  // ── Logo pipeline ───────────────────────────────────────────────────────────
  if (needLogo) {
    // 1. Wikipedia (if square-ish)
    if (wikiInfo && validForLogo(wikiInfo)) {
      await patchLogo(wikiInfo, "wikipedia");
    }
    // 2. Facebook (DDG -> FB page -> og:image)
    if (result.logo === "skipped") {
      try {
        const fb = await tryFacebook(course);
        if (fb) {
          const info = await fetchAndInspect(fb);
          if (info && validForLogo(info)) await patchLogo(info, "facebook");
        }
      } catch {}
    }
    // 3. Club website — apple-touch-icon, then logo <img>, then og/twitter if square
    if (result.logo === "skipped" && webAssets) {
      const candidates = [
        ...(webAssets.appleIcons || []),
        ...(webAssets.logoImgs || []),
        webAssets.ogImage,
        webAssets.twImage,
      ].filter(Boolean);
      for (const url of candidates) {
        const info = await fetchAndInspect(url);
        if (info && validForLogo(info)) {
          if (await patchLogo(info, "website")) break;
        }
      }
    }
    if (result.logo === "skipped") result.logo = "none";
  }

  // ── Cover pipeline ──────────────────────────────────────────────────────────
  if (needCover) {
    // 1. Wikipedia wide image
    if (wikiInfo && validForCover(wikiInfo)) {
      await patchCover(wikiInfo, "wikipedia");
    }
    // 2. GolfPass
    if (result.cover === "skipped") {
      try {
        const gp = await tryGolfPass(course);
        if (gp) {
          const info = await fetchAndInspect(gp);
          if (info && validForCover(info)) await patchCover(info, "golfpass");
        }
      } catch {}
    }
    // 3. Club website og:image / twitter:image (if wide)
    if (result.cover === "skipped" && webAssets) {
      const candidates = [webAssets.ogImage, webAssets.twImage].filter(Boolean);
      for (const url of candidates) {
        const info = await fetchAndInspect(url);
        if (info && validForCover(info)) {
          if (await patchCover(info, "website")) break;
        }
      }
    }
    if (result.cover === "skipped") result.cover = "none";
  }

  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  if (!args.idsFile) {
    console.error("Usage: --ids-file <file> [--dry] [--limit N]");
    process.exit(1);
  }
  const allIds = readFileSync(args.idsFile, "utf8").split(/\s+/).filter(Boolean);
  const ids = allIds.slice(0, args.limit);
  console.error(`Loaded ${ids.length} of ${allIds.length} course IDs from ${args.idsFile}`);

  // Pull current state in chunks
  const all = [];
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("Course")
      .select("id, name, city, state, websiteUrl, logoUrl, coverImageUrl")
      .in("id", slice);
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    all.push(...(data || []));
  }
  console.error(`Pulled ${all.length} Course rows.`);

  if (args.dry) {
    let placeholders = 0;
    let noCover = 0;
    for (const c of all) {
      if (isPlaceholderLogo(c.logoUrl)) placeholders++;
      if (!c.coverImageUrl) noCover++;
    }
    console.error(`Dry: ${placeholders} placeholder logos, ${noCover} missing covers.`);
    return;
  }

  const counts = {
    logo: { wikipedia: 0, facebook: 0, website: 0, none: 0, failed: 0, skipped: 0 },
    cover: { wikipedia: 0, golfpass: 0, website: 0, none: 0, failed: 0, skipped: 0 },
  };

  let i = 0;
  for (const c of all) {
    i++;
    let r = { logo: "skipped", cover: "skipped" };
    try {
      r = await processCourse(c);
    } catch (e) {
      console.error(`  ! ${c.name}: ${e.message}`);
    }
    counts.logo[r.logo] = (counts.logo[r.logo] || 0) + 1;
    counts.cover[r.cover] = (counts.cover[r.cover] || 0) + 1;
    console.error(`[${i}/${all.length}] ${c.name} — logo: ${r.logo} | cover: ${r.cover}`);
  }

  const N = all.length;
  const realLogo =
    (counts.logo.wikipedia || 0) + (counts.logo.facebook || 0) + (counts.logo.website || 0);
  const realCover =
    (counts.cover.wikipedia || 0) + (counts.cover.golfpass || 0) + (counts.cover.website || 0);

  console.error("\n──── Per-source breakdown ────");
  console.error(
    `LOGOS  — wikipedia: ${counts.logo.wikipedia || 0}, facebook: ${counts.logo.facebook || 0}, website: ${counts.logo.website || 0}, none: ${counts.logo.none || 0}, failed: ${counts.logo.failed || 0}, skipped: ${counts.logo.skipped || 0}`
  );
  console.error(
    `COVERS — wikipedia: ${counts.cover.wikipedia || 0}, golfpass: ${counts.cover.golfpass || 0}, website: ${counts.cover.website || 0}, none: ${counts.cover.none || 0}, failed: ${counts.cover.failed || 0}, skipped: ${counts.cover.skipped || 0}`
  );
  console.error(`TOTAL real logos added: ${realLogo} / ${N}`);
  console.error(`TOTAL real covers added: ${realCover} / ${N}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
