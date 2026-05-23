#!/usr/bin/env node
// One-off verification: read back the three seeded courses and confirm
// what landed (URL types, hole counts, scorecard sanity).
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const NAMES = ["Pine Valley Golf Club", "Trout National - The Reserve", "Rodeo Dunes"];

for (const name of NAMES) {
  const { data } = await supabase.from("Course").select("id, name, city, state, zipCode, description, logoUrl, coverImageUrl, yearEstablished, courseType, holeCount").ilike("name", name).limit(1);
  const c = data?.[0];
  if (!c) { console.log(`\n${name}: NOT FOUND`); continue; }
  console.log(`\n${c.name}  (${c.city}, ${c.state})`);
  console.log(`  id=${c.id}`);
  console.log(`  zip=${c.zipCode}  year=${c.yearEstablished}  type=${c.courseType}  holeCount=${c.holeCount}`);
  console.log(`  description: ${c.description ? c.description.slice(0, 80) + "…" : "(null)"}`);
  console.log(`  logoUrl: ${c.logoUrl ? c.logoUrl.startsWith("https://") && c.logoUrl.includes("supabase") ? "✓ supabase storage" : c.logoUrl.slice(0, 80) : "(null)"}`);
  console.log(`  coverImageUrl: ${c.coverImageUrl ? c.coverImageUrl.startsWith("https://") && c.coverImageUrl.includes("supabase") ? "✓ supabase storage" : c.coverImageUrl.slice(0, 80) : "(null)"}`);
  const { data: holes } = await supabase.from("Hole").select("holeNumber, par, yardage, handicapRank").eq("courseId", c.id).order("holeNumber");
  const filled = (holes || []).filter(h => h.yardage != null).length;
  const totalPar = (holes || []).reduce((s, h) => s + (h.par || 0), 0);
  const totalYds = (holes || []).reduce((s, h) => s + (h.yardage || 0), 0);
  console.log(`  holes: ${holes?.length ?? 0}  parTotal=${totalPar}  yardageFilled=${filled}/18  yardageTotal=${totalYds || "—"}`);
}
