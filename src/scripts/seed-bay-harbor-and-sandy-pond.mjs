#!/usr/bin/env node

/**
 * One-off script for the Bay Harbor restructure + Sandy Pond Links seed.
 *
 * 1. Renames existing 'Bay Harbor Golf Club - The Links Quarry' to
 *    'Bay Harbor Golf Club - The Links' and converts to 9 holes.
 * 2. Inserts 'Bay Harbor Golf Club - The Quarry' (9 holes)
 * 3. Inserts 'Bay Harbor Golf Club - The Preserve' (9 holes)
 * 4. Inserts 'Sandy Pond Links' (Riverhead, NY, 18 holes)
 *
 * Each insert is researched via Anthropic API for description / lat-lng /
 * year / phone / website (same prompt pattern as seed-courses-bulk.mjs).
 *
 * Idempotent: rename only fires if the row still has the old name; inserts
 * are skipped if a course with the same exact name already exists.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LINKS_QUARRY_ID = "c4c10379-9b9b-40f5-9b02-d9f5eb3d2c71";

// ── Targets ──────────────────────────────────────────────────────────────────

const NEW_COURSES = [
  {
    name: "Bay Harbor Golf Club - The Quarry",
    city: "Bay Harbor",
    state: "MI",
    holeCount: 9,
    note: "Nine-hole layout at Bay Harbor Golf Club, played through abandoned shale quarries with limestone walls. Arthur Hills design, opened 1998.",
  },
  {
    name: "Bay Harbor Golf Club - The Preserve",
    city: "Bay Harbor",
    state: "MI",
    holeCount: 9,
    note: "Nine-hole layout at Bay Harbor Golf Club, the inland forest nine winding through hardwoods and wetlands. Arthur Hills design, opened 1998.",
  },
  {
    name: "Sandy Pond Links",
    city: "Riverhead",
    state: "NY",
    holeCount: 18,
    note: "Public 18-hole links course on Long Island, NY. Website: sandypondlinks.com",
  },
];

const SEEDER_SYSTEM_PROMPT = `You are a content researcher for Tour It, a golf scouting platform.
Research each course and return a JSON array. One object per course, exactly these fields:
{
  "courseId": "<exact id from input>",
  "courseName": "Official name",
  "city": "City",
  "state": "ST",
  "zipCode": "12345",
  "yearEstablished": 1998,
  "access": "Public" | "Semi-Private" | "Private",
  "holeCount": 9 | 18,
  "phone": "(xxx) xxx-xxxx" or null,
  "websiteUrl": "https://..." or null,
  "latitude": 0,
  "longitude": 0,
  "description": "2–3 sentences in Tour It voice — confident, specific, editorial. Lead with what's distinctive (designer, terrain, signature hole). Include one concrete fact. End with the experience.",
  "coverPhotoUrl": "https://..." or null,
  "logoUrl": "https://..." or null,
  "sourceNotes": "One line on where each asset came from"
}
Image rules: must be direct static .jpg/.png/.webp/.svg URLs, no .aspx, no Clubessential CMS, no transparent logos. Set null if unsure.
Return ONLY a JSON array. No preamble.`;

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
async function ensureUniqueSlug(base) {
  let candidate = base, n = 1;
  while (true) {
    const { data } = await sb.from("Course").select("id").eq("slug", candidate).limit(1);
    if (!data || data.length === 0) return candidate;
    n++; candidate = `${base}-${n}`;
  }
}
function extFromUrl(u) { const m = u.match(/\.(jpg|jpeg|png|webp|svg)(\?|$)/i); return m ? m[1].toLowerCase().replace("jpeg", "jpg") : null; }
function extFromContentType(ct, fb = "jpg") { if (!ct) return fb; if (ct.includes("png")) return "png"; if (ct.includes("webp")) return "webp"; if (ct.includes("svg")) return "svg"; return "jpg"; }

async function uploadImage(imageUrl, courseId, type) {
  if (!imageUrl) return null;
  try {
    const r = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36", Accept: "image/*", Referer: "https://www.google.com/" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) { console.log(`    ⚠ ${type} fetch ${r.status}`); return null; }
    const ct = r.headers.get("content-type") || "";
    const ext = extFromUrl(imageUrl) || extFromContentType(ct);
    const buf = await r.arrayBuffer();
    const path = `course-images/${courseId}-${type}.${ext}`;
    const { error } = await sb.storage.from("tour-it-photos").upload(path, new Uint8Array(buf), { contentType: ct || `image/${ext}`, upsert: true });
    if (error) { console.log(`    ⚠ ${type} upload: ${error.message}`); return null; }
    return sb.storage.from("tour-it-photos").getPublicUrl(path).data.publicUrl;
  } catch (e) { console.log(`    ⚠ ${type} err: ${e.message}`); return null; }
}

const ACCESS_MAP = { Public: "PUBLIC", "Semi-Private": "SEMI_PRIVATE", Private: "PRIVATE" };

async function researchCourses(courses) {
  const list = courses.map((c, i) =>
    `${i + 1}. courseId: "${c.handleId}" | name: "${c.name}" | location: ${c.city}, ${c.state} | hint: ${c.note}`
  ).join("\n");
  console.log(`  🔍 Researching: ${courses.map(c => c.name).join(", ")}`);
  const r = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: SEEDER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Research these courses:\n\n${list}` }],
  });
  const raw = r.content.filter(b => b.type === "text").map(b => b.text).join("");
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { return JSON.parse(m[0]); } catch { return []; }
}

async function ensureHoles(courseId, n) {
  const { data: existing } = await sb.from("Hole").select("holeNumber").eq("courseId", courseId);
  const have = new Set((existing ?? []).map(h => h.holeNumber));
  const now = new Date().toISOString();
  const toAdd = [];
  for (let i = 1; i <= n; i++) {
    if (!have.has(i)) toAdd.push({ id: randomUUID(), courseId, holeNumber: i, par: 4, uploadCount: 0, createdAt: now, updatedAt: now });
  }
  if (toAdd.length) await sb.from("Hole").insert(toAdd);
  // Drop any holes above n (e.g. 18→9 conversion)
  const idsToDrop = (existing ?? []).filter(h => h.holeNumber > n).map(h => h.id);
  if (idsToDrop.length) {
    const { data: full } = await sb.from("Hole").select("id, holeNumber").eq("courseId", courseId).gt("holeNumber", n);
    if (full?.length) await sb.from("Hole").delete().in("id", full.map(h => h.id));
  }
}

async function main() {
  console.log("\n🏌️  Bay Harbor restructure + Sandy Pond Links seed");
  console.log("=====================================================\n");

  // ── 1. Rename Links Quarry → The Links + convert to 9 holes ────────────
  const { data: linksQuarry } = await sb.from("Course").select("id, name, holeCount").eq("id", LINKS_QUARRY_ID).single();
  if (linksQuarry && linksQuarry.name === "Bay Harbor Golf Club - The Links Quarry") {
    console.log(`Renaming '${linksQuarry.name}' → 'Bay Harbor Golf Club - The Links' (9 holes)`);
    await sb.from("Course").update({ name: "Bay Harbor Golf Club - The Links", holeCount: 9, updatedAt: new Date().toISOString() }).eq("id", LINKS_QUARRY_ID);
    await ensureHoles(LINKS_QUARRY_ID, 9);
    console.log(`  ✅ Renamed and trimmed to 9 holes`);
  } else if (linksQuarry?.name === "Bay Harbor Golf Club - The Links") {
    console.log("⏭  'The Links' rename already applied");
    await ensureHoles(LINKS_QUARRY_ID, 9);
  } else {
    console.log(`⚠ Unexpected current name: ${linksQuarry?.name}`);
  }

  // ── 2/3/4. Insert new courses (skip if already exist) ──────────────────
  const targets = [];
  for (const c of NEW_COURSES) {
    const { data: existing } = await sb.from("Course").select("id, name").ilike("name", c.name).eq("state", c.state).limit(1);
    if (existing && existing.length > 0) {
      console.log(`⏭  ${c.name} already exists (${existing[0].id}) — skipping`);
      continue;
    }
    targets.push({ ...c, handleId: `new-${slugify(c.name)}` });
  }

  if (targets.length === 0) {
    console.log("\nNothing left to insert.");
    return;
  }

  const research = await researchCourses(targets);
  const byHandle = {};
  research.forEach(r => { if (r.courseId) byHandle[r.courseId] = r; });

  for (const t of targets) {
    const data = byHandle[t.handleId] ?? research.find(r => r.courseName?.toLowerCase() === t.name.toLowerCase());
    if (!data) { console.log(`  ✗ ${t.name}: no research data`); continue; }

    const finalName = t.name; // Force the user-specified name (preserves Bay Harbor convention)
    const finalCity = data.city || t.city;
    const finalState = data.state || t.state;
    const slug = await ensureUniqueSlug(slugify(`${finalName}-${finalCity}-${finalState}`));
    const id = randomUUID();
    const access = data.access ? ACCESS_MAP[data.access] : "PUBLIC";
    const holeCount = t.holeCount; // Force from target, not Claude
    const yr = Number(data.yearEstablished);
    const yearOk = !isNaN(yr) && yr >= 1800 && yr <= new Date().getFullYear();
    const lat = data.latitude !== null ? Number(data.latitude) : null;
    const lng = data.longitude !== null ? Number(data.longitude) : null;
    const now = new Date().toISOString();

    const row = {
      id,
      name: finalName,
      slug,
      city: finalCity,
      state: finalState,
      country: "US",
      latitude: lat !== null && !isNaN(lat) && lat >= -90 && lat <= 90 ? lat : null,
      longitude: lng !== null && !isNaN(lng) && lng >= -180 && lng <= 180 ? lng : null,
      websiteUrl: data.websiteUrl || null,
      phone: data.phone || null,
      description: data.description ? data.description.trim().slice(0, 2000) : null,
      holeCount,
      isPublic: access === "PUBLIC" || access === "SEMI_PRIVATE",
      courseType: access,
      zipCode: data.zipCode ? String(data.zipCode) : null,
      yearEstablished: yearOk ? yr : null,
      isVerified: false,
      coverImageUrl: null,
      logoUrl: null,
      uploadCount: 0, saveCount: 0, viewCount: 0,
      createdAt: now, updatedAt: now,
    };

    if (data.coverPhotoUrl) {
      const url = await uploadImage(data.coverPhotoUrl, id, "cover");
      if (url) row.coverImageUrl = url;
    }
    if (data.logoUrl) {
      const url = await uploadImage(data.logoUrl, id, "logo");
      if (url) row.logoUrl = url;
    }

    const { error } = await sb.from("Course").insert(row);
    if (error) { console.log(`  ✗ ${finalName}: ${error.message}`); continue; }
    await ensureHoles(id, holeCount);

    console.log(`  ✅ Inserted ${finalName} (${id}, ${holeCount}h, ${access})`);
    if (data.sourceNotes) console.log(`     ${data.sourceNotes}`);
  }

  console.log("\nDone.");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
