import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, anon, { auth: { persistSession: false } });

async function read(table) {
  const { data, error } = await sb.from(table).select("id").limit(3);
  console.log(`  anon SELECT ${table.padEnd(8)} -> ${error ? "ERR " + error.message : (data?.length ?? 0) + " rows"}`);
}

async function tryWrite(table, patch) {
  const { data: row } = await sb.from(table).select("id").limit(1).single();
  if (!row) { console.log(`  anon UPDATE ${table.padEnd(8)} -> no row to test`); return; }
  const { data, error } = await sb.from(table).update(patch).eq("id", row.id).select("id");
  console.log(`  anon UPDATE ${table.padEnd(8)} -> ${error ? "DENIED (" + error.code + ")" : (data?.length ?? 0) + " rows changed"}`);
}

async function main() {
  console.log("Reads (should return rows):");
  await read("Course");
  await read("Hole");
  await read("TeeBox");
  console.log("\nWrites (should be denied / 0 rows):");
  await tryWrite("Course", { updatedAt: new Date().toISOString() });
  await tryWrite("Hole", { par: 99 });
}
main();
