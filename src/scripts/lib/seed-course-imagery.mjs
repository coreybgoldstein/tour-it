// Shared seeder used by all per-course "fill in hole imagery + intel" scripts.
// Given a courseId and an array of {holeNumber, imageUrl, description}, this
// helper uploads each photo to Supabase Storage, sets Hole.imageUrl /
// description, and creates an @tourit Upload row per hole so the regular
// populated swipe view kicks in (no special empty-state UI required).
//
// Used by:
//   seed-aronimink-holes.mjs (the original)
//   seed-sleepy-hollow.mjs   (the namesake script)
//   seed-the-heather.mjs     (partial photo coverage)
//   seed-ngla.mjs            (Phase 1 batch)
//   seed-fishers-island.mjs  ( "      "    )
//   seed-somerset-hills.mjs  ( "      "    )
//   seed-whippoorwill.mjs    ( "      "    )

import "dotenv/config";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BUCKET = "tour-it-photos";
const UA = "Mozilla/5.0 (compatible; tour-it-seeder/1.0)";

export async function getTouritUserId() {
  const { data, error } = await sb.from("User").select("id").eq("username", "tourit").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("@tourit system user missing — run seed-tourit-system-user.mjs");
  return data.id;
}

async function fetchBytes(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function uploadToStorage(path, bytes, contentType) {
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * @param {{ courseId: string, holes: Array<{holeNumber: number, imageUrl?: string|null, description?: string|null}>, courseDescription?: string|null, courseYear?: number|null }} cfg
 */
export async function seedCourseImagery(cfg) {
  const { courseId, holes, courseDescription, courseYear } = cfg;

  // Optionally bump the course-level description / year if provided + missing
  if (courseDescription || courseYear) {
    const { data: c } = await sb.from("Course").select("description, yearEstablished, name").eq("id", courseId).maybeSingle();
    if (!c) throw new Error(`Course ${courseId} not found`);
    const patch = {};
    if (courseDescription && !c.description) patch.description = courseDescription;
    if (courseYear && !c.yearEstablished) patch.yearEstablished = courseYear;
    if (Object.keys(patch).length) {
      patch.updatedAt = new Date().toISOString();
      await sb.from("Course").update(patch).eq("id", courseId);
      console.log(`[${c.name}] course meta updated`);
    } else {
      console.log(`[${c.name}] course meta already set, skipping`);
    }
  }

  const { data: holeRows, error } = await sb
    .from("Hole")
    .select("id, holeNumber, imageUrl, description")
    .eq("courseId", courseId)
    .order("holeNumber");
  if (error) throw error;
  const byNumber = new Map((holeRows ?? []).map(h => [h.holeNumber, h]));

  const touritId = await getTouritUserId();
  let photos = 0, intel = 0, uploads = 0;

  for (const cfgHole of holes) {
    const h = byNumber.get(cfgHole.holeNumber);
    if (!h) { console.warn(`  Hole ${cfgHole.holeNumber}: missing in DB, skipping`); continue; }

    const patch = { updatedAt: new Date().toISOString() };
    let finalImageUrl = h.imageUrl;

    if (cfgHole.imageUrl && !h.imageUrl) {
      try {
        const bytes = await fetchBytes(cfgHole.imageUrl);
        const isPng = cfgHole.imageUrl.includes(".png");
        const ext = isPng ? "png" : "jpg";
        finalImageUrl = await uploadToStorage(
          `course-images/${courseId}-hole-${cfgHole.holeNumber}.${ext}`,
          bytes,
          isPng ? "image/png" : "image/jpeg"
        );
        patch.imageUrl = finalImageUrl;
        photos++;
        console.log(`  Hole ${String(cfgHole.holeNumber).padStart(2)}: ${(bytes.length / 1024).toFixed(0)}KB`);
      } catch (e) {
        console.warn(`  Hole ${cfgHole.holeNumber}: photo failed — ${e.message ?? e}`);
      }
    }

    if (cfgHole.description) { patch.description = cfgHole.description; intel++; }
    if (Object.keys(patch).length > 1) await sb.from("Hole").update(patch).eq("id", h.id);

    // Idempotent @tourit Upload row for holes with an image
    if (finalImageUrl) {
      const { data: dup } = await sb
        .from("Upload")
        .select("id")
        .eq("holeId", h.id)
        .eq("userId", touritId)
        .maybeSingle();
      if (!dup) {
        const now = new Date().toISOString();
        await sb.from("Upload").insert({
          id: randomUUID(),
          userId: touritId,
          courseId,
          holeId: h.id,
          mediaType: "PHOTO",
          mediaUrl: finalImageUrl,
          shotType: "FULL_HOLE",
          moderationStatus: "APPROVED",
          likeCount: 0, commentCount: 0, viewCount: 0, saveCount: 0, rankScore: 0,
          tripPublic: true,
          createdAt: now,
          updatedAt: now,
        });
        await sb.from("Hole").update({ uploadCount: 1 }).eq("id", h.id);
        uploads++;
      }
    }
  }

  // Resync Course.uploadCount from the actual Upload count
  const { count } = await sb
    .from("Upload")
    .select("id", { count: "exact", head: true })
    .eq("courseId", courseId)
    .eq("moderationStatus", "APPROVED");
  await sb.from("Course").update({ uploadCount: count ?? 0, updatedAt: new Date().toISOString() }).eq("id", courseId);

  console.log(`  → ${photos} photos · ${intel} intel · ${uploads} new @tourit uploads · course total ${count} clips`);
}
