import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listCity(city, state) {
  const { data } = await supabase
    .from("Course")
    .select("id, name, city, state, courseType")
    .ilike("city", `%${city}%`)
    .eq("state", state)
    .order("name");
  console.log(`\n${city}, ${state} — ${data?.length || 0} courses`);
  data?.forEach((c) => console.log(`  • ${c.name}  [${c.id}] ${c.courseType || ""}`));
}

await listCity("Bandon", "OR");
await listCity("Pinehurst", "NC");
await listCity("Myrtle", "SC");
await listCity("North Myrtle", "SC");
await listCity("Houston", "TX");
await listCity("Roscommon", "MI");
await listCity("Nekoosa", "WI");
await listCity("Rome", "WI");
