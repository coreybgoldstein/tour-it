import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const names = ["Aronimink", "Sleepy Hollow", "Boca Raton", "Somerset Hills", "Boca Grove", "Seawane"];
for (const n of names) {
  const { data } = await sb
    .from("Course")
    .select("id, name, city, state, latitude, longitude, logoUrl, coverImageUrl, uploadCount")
    .ilike("name", `%${n}%`)
    .limit(3);
  for (const c of data ?? []) {
    console.log(`${c.name} — ${c.city}, ${c.state}`);
    console.log(`  id: ${c.id}  uploads: ${c.uploadCount ?? 0}  cover: ${!!c.coverImageUrl}  logo: ${!!c.logoUrl}`);
    if (c.latitude) console.log(`  lat/lng: ${c.latitude}, ${c.longitude}`);
  }
}
