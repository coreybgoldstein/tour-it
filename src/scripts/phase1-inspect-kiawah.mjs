#!/usr/bin/env node

/**
 * Phase 1 — Issue 4b inspect
 * Look at both Kiawah Ocean Course rows and count dependent rows in each FK table
 * before deciding which to delete.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ROWS = [
  "647bbdcd-23ac-4105-9825-1eea55d2222b", // Kiawah Island Golf Resort - The Ocean Course (target)
  "a3edabfe-b2d6-4343-a309-4ae71f178e1b", // Kiawah Island Ocean Course (dup)
];

const TABLES = ["Hole", "TeeBox", "Upload", "Save", "View", "GolfTripStop", "TripFormat", "CourseContribution", "CourseFieldContribution"];

for (const id of ROWS) {
  const { data: row } = await supabase
    .from("Course")
    .select("*")
    .eq("id", id)
    .single();

  console.log(`\n═══ ${id} ═══`);
  console.log(`  name:           ${row.name}`);
  console.log(`  city/state/zip: ${row.city} / ${row.state} / ${row.zipCode}`);
  console.log(`  description:    ${row.description ? row.description.slice(0, 80) + "…" : "(null)"}`);
  console.log(`  courseType:     ${row.courseType}`);
  console.log(`  yearEst:        ${row.yearEstablished}`);
  console.log(`  cover/logo:     ${row.coverImageUrl ? "✓" : "(null)"} / ${row.logoUrl ? "✓" : "(null)"}`);
  console.log(`  website/phone:  ${row.websiteUrl ? "✓" : "(null)"} / ${row.phone ? "✓" : "(null)"}`);
  console.log(`  lat/lng:        ${row.latitude} / ${row.longitude}`);

  console.log(`  Dependents:`);
  for (const t of TABLES) {
    const { count, error } = await supabase
      .from(t)
      .select("id", { count: "exact", head: true })
      .eq("courseId", id);
    if (error) console.log(`    ${t}: ✗ ${error.message}`);
    else console.log(`    ${t}: ${count}`);
  }
}
