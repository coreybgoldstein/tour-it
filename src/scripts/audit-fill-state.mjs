#!/usr/bin/env node

/**
 * Audit: per-course rundown of what's filled vs null.
 * Shows Course-level fields + scorecard completeness for every itinerary
 * course plus the 8 recently-touched (Bay Harbor x4, Boyne x3, Sandy Pond).
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const RECENT_IDS = [
  "6ec71cee-6f23-49fd-932c-0c8e5073847b", // The Heather
  "ab62620e-8e8f-4512-a442-b5bc59254dfe", // Donald Ross Memorial
  "d41249cf-79eb-4617-ba53-4f63e1f128f2", // Arthur Hills
  "4dfe48b7-a3af-493d-a69c-b689dc46ed9b", // Bay Harbor (parent)
  "c4c10379-9b9b-40f5-9b02-d9f5eb3d2c71", // Bay Harbor - The Links
  "d9bc637f-ae62-43b3-a911-048ff13bac15", // Bay Harbor - The Quarry
  "8f5495fe-ade2-4f6c-b4eb-76938aec5c9a", // Bay Harbor - The Preserve
  "7df3777e-ad81-4012-a6e7-40bb8dc48527", // Sandy Pond Links
];

async function main() {
  const { data: stops } = await sb.from("TripItineraryStop").select("courseId");
  const ids = [...new Set([...(stops ?? []).map((s) => s.courseId), ...RECENT_IDS])];

  const { data: courses } = await sb
    .from("Course")
    .select("id, name, city, state, holeCount, description, coverImageUrl, logoUrl, yearEstablished, courseType, websiteUrl, phone, zipCode, latitude, longitude")
    .in("id", ids);

  const COURSE_FIELDS = [
    ["description", "desc"],
    ["coverImageUrl", "cover"],
    ["logoUrl", "logo"],
    ["yearEstablished", "year"],
    ["courseType", "type"],
    ["websiteUrl", "site"],
    ["phone", "phone"],
    ["zipCode", "zip"],
    ["latitude", "lat"],
  ];

  console.log("\n=================================================");
  console.log("Tour It — Course + Scorecard fill audit");
  console.log("=================================================\n");

  const rows = [];
  for (const c of courses) {
    const filled = COURSE_FIELDS
      .map(([k, label]) => (c[k] !== null && c[k] !== undefined && c[k] !== "" ? label : null))
      .filter(Boolean);
    const missing = COURSE_FIELDS
      .map(([k, label]) => (c[k] !== null && c[k] !== undefined && c[k] !== "" ? null : label))
      .filter(Boolean);

    const { data: holes } = await sb
      .from("Hole")
      .select("par, yardage, handicapRank")
      .eq("courseId", c.id)
      .order("holeNumber");
    const total = holes?.length ?? 0;
    const yards = (holes ?? []).filter((h) => h.yardage != null).length;
    const pars = (holes ?? []).filter((h) => h.par != null && h.par !== 4).length;
    const hcps = (holes ?? []).filter((h) => h.handicapRank != null).length;

    rows.push({ c, filled, missing, total, yards, pars, hcps });
  }

  rows.sort((a, b) => a.c.name.localeCompare(b.c.name));

  for (const r of rows) {
    const { c, filled, missing, total, yards, hcps } = r;
    const sc = total === 0 ? "(no holes)" : `${yards}/${total} yds · ${hcps}/${total} hcp`;
    console.log(`${c.name}`);
    console.log(`  ${c.city || "?"}, ${c.state || "?"} · ${c.holeCount}h`);
    console.log(`  ✅ filled:  ${filled.join(", ") || "(nothing)"}`);
    if (missing.length > 0) console.log(`  ⚠  missing: ${missing.join(", ")}`);
    console.log(`  📋 scorecard: ${sc}`);
    console.log();
  }

  // Summary
  const all = rows.length;
  const fullCourse = rows.filter((r) => r.missing.length === 0).length;
  const fullScorecard = rows.filter((r) => r.total > 0 && r.yards === r.total).length;
  console.log("=================================================");
  console.log(`Courses audited: ${all}`);
  console.log(`Course profile complete (all 9 fields): ${fullCourse}`);
  console.log(`Scorecard complete (all holes have yardage): ${fullScorecard}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
