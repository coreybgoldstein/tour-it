#!/usr/bin/env node
// Audits every Course attached to a TripItinerary. Flags any whose
// isPublic=false OR whose access field is "Private" — those need to
// be swapped for accessible alternatives.

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: itineraries } = await sb
    .from("TripItinerary")
    .select("id, slug, name")
    .order("slug");

  const flagged = [];
  for (const it of itineraries) {
    const { data: stops } = await sb
      .from("TripItineraryStop")
      .select("courseId, day, order")
      .eq("itineraryId", it.id)
      .order("day");
    const ids = (stops ?? []).map((s) => s.courseId);
    if (!ids.length) continue;
    const { data: courses } = await sb
      .from("Course")
      .select("id, name, city, state, isPublic, access")
      .in("id", ids);
    const byId = new Map((courses ?? []).map((c) => [c.id, c]));
    for (const s of stops) {
      const c = byId.get(s.courseId);
      if (!c) continue;
      const accessLower = (c.access || "").toLowerCase();
      const isPrivate = c.isPublic === false || accessLower === "private";
      if (isPrivate) {
        flagged.push({ slug: it.slug, day: s.day, courseId: c.id, name: c.name, city: c.city, state: c.state, isPublic: c.isPublic, access: c.access });
      }
    }
  }

  console.log("\n=== ACCESS AUDIT ===\n");
  if (!flagged.length) {
    console.log("✅ All itinerary courses pass the public/accessible filter.");
  } else {
    console.log(`⚠️  ${flagged.length} stops are private or non-public:\n`);
    for (const f of flagged) {
      console.log(`  [${f.slug}] Day ${f.day}: ${f.name} [${f.city}, ${f.state}]  isPublic=${f.isPublic}  access=${f.access ?? "(null)"}`);
    }
  }
})();
