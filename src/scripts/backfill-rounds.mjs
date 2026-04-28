// Backfills Round records from existing Upload rows.
// Groups uploads by userId + courseId + date, creates a Round for each group,
// then sets roundId on each upload.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("Fetching all uploads…");
  const { data: uploads, error } = await supabase
    .from("Upload")
    .select("id, userId, courseId, datePlayedAt, createdAt, roundId")
    .is("roundId", null)
    .order("createdAt", { ascending: true });

  if (error) { console.error(error); process.exit(1); }
  console.log(`Found ${uploads.length} uploads without a roundId`);

  // Group by userId + courseId + date
  const groups = new Map();
  for (const u of uploads) {
    const raw = u.datePlayedAt || u.createdAt;
    const date = raw.split("T")[0];
    const key = `${u.userId}::${u.courseId}::${date}`;
    if (!groups.has(key)) groups.set(key, { userId: u.userId, courseId: u.courseId, date, uploadIds: [] });
    groups.get(key).uploadIds.push(u.id);
  }

  console.log(`Creating ${groups.size} rounds…`);
  let created = 0;
  let linked = 0;

  for (const { userId, courseId, date, uploadIds } of groups.values()) {
    const now = new Date().toISOString();

    // Check if a Round already exists for this combo
    const { data: existing } = await supabase
      .from("Round")
      .select("id")
      .eq("userId", userId)
      .eq("courseId", courseId)
      .eq("date", date)
      .single();

    let roundId;
    if (existing) {
      roundId = existing.id;
    } else {
      const id = randomUUID();
      const { error: insertError } = await supabase
        .from("Round")
        .insert({ id, userId, courseId, date, createdAt: now, updatedAt: now });
      if (insertError) { console.error("Insert error:", insertError); continue; }
      roundId = id;
      created++;
    }

    // Link uploads
    const { error: updateError } = await supabase
      .from("Upload")
      .update({ roundId })
      .in("id", uploadIds);
    if (updateError) { console.error("Update error:", updateError); continue; }
    linked += uploadIds.length;
  }

  console.log(`Done. Created ${created} rounds, linked ${linked} uploads.`);
}

main().catch(e => { console.error(e); process.exit(1); });
