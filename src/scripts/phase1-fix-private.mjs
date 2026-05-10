#!/usr/bin/env node

/**
 * Phase 1 — Issue 1 fix
 * Two rows came back PRIVATE from enrichment but are public/resort access.
 * Flip them to PUBLIC + isPublic=true.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FIX = [
  { id: "205da5c9-2a88-472f-ac39-414751f0bcf6", display: "Sheep Ranch (Bandon)" },
  { id: "0e1af11a-86ea-4a27-a231-190916ba01b0", display: "Fields Ranch - East Course (PGA Frisco)" },
];

for (const f of FIX) {
  const { error } = await supabase
    .from("Course")
    .update({ courseType: "PUBLIC", isPublic: true, updatedAt: new Date().toISOString() })
    .eq("id", f.id);
  if (error) console.error(`✗ ${f.display}: ${error.message}`);
  else console.log(`✅ ${f.display} → PUBLIC`);
}

const { data } = await supabase
  .from("Course")
  .select("id, name, courseType, isPublic")
  .in("id", FIX.map((f) => f.id));
console.log("\nVerification:");
data?.forEach((r) => console.log(`  ${r.name} → courseType=${r.courseType}, isPublic=${r.isPublic}`));
