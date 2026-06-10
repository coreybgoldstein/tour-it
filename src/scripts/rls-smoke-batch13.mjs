import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, anon, { auth: { persistSession: false } });

async function probe(label, q) {
  const { data, error } = await q;
  console.log(`  ${label.padEnd(34)} -> ${error ? "DENIED (" + (error.code || error.message) + ")" : (data?.length ?? 0) + " rows OK"}`);
}

async function main() {
  console.log("Should WORK (public columns):");
  await probe("anon select id,username,avatarUrl", sb.from("User").select("id, username, avatarUrl").limit(3));
  await probe("anon select handicapIndex,bio", sb.from("User").select("handicapIndex, bio").limit(3));

  console.log("\nShould be DENIED (PII columns):");
  await probe("anon select email", sb.from("User").select("email").limit(1));
  await probe("anon select ghinNumber", sb.from("User").select("ghinNumber").limit(1));
  await probe("anon select pushSubscription", sb.from("User").select("pushSubscription").limit(1));
  await probe("anon select *", sb.from("User").select("*").limit(1));

  console.log("\nShould be DENIED (cross-user write):");
  const { data: row } = await sb.from("User").select("id").limit(1).single();
  await probe("anon update someone's bio", sb.from("User").update({ bio: "x" }).eq("id", row?.id).select("id"));
}
main();
