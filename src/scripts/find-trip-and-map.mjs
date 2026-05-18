// Quick helper to find a good trip ID for App Store screenshots and
// confirm what map area has the most populated course logos.
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Trips — prefer ones with names + recent
const { data: trips } = await sb
  .from("GolfTrip")
  .select("id, name, createdAt, ryderCupEnabled")
  .order("createdAt", { ascending: false })
  .limit(8);
console.log("\n=== Trips ===");
for (const t of trips ?? []) {
  console.log(`  ${t.id}  ${t.name ?? "(no name)"}  ${t.createdAt}`);
}

// Courses with both logo + cover, grouped by state — best zone for the map
const { data: courses } = await sb
  .from("Course")
  .select("id, name, city, state, latitude, longitude, logoUrl, coverImageUrl, uploadCount")
  .not("logoUrl", "is", null)
  .not("latitude", "is", null);
const byState = new Map();
for (const c of courses ?? []) {
  if (!byState.has(c.state)) byState.set(c.state, []);
  byState.get(c.state).push(c);
}
console.log("\n=== Courses with logo + lat/lng by state ===");
const sorted = [...byState.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 6);
for (const [state, list] of sorted) {
  const avgLat = list.reduce((s, c) => s + c.latitude, 0) / list.length;
  const avgLng = list.reduce((s, c) => s + c.longitude, 0) / list.length;
  console.log(`  ${state}: ${list.length} courses  (center ~${avgLat.toFixed(3)}, ${avgLng.toFixed(3)})`);
}

// Best-looking courses (cover + logo + activity)
console.log("\n=== Top courses by uploadCount with cover+logo ===");
const top = (courses ?? []).filter(c => c.coverImageUrl).sort((a, b) => (b.uploadCount ?? 0) - (a.uploadCount ?? 0)).slice(0, 8);
for (const c of top) {
  console.log(`  ${c.uploadCount ?? 0}  ${c.name} — ${c.city}, ${c.state}  (${c.id})`);
}
