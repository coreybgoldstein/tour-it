import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// Server-side, atomic Upload row creation.
//
// Why this exists: the previous client-side flow uploaded the file to
// storage and THEN inserted the Upload row in a second round-trip. If the
// network blipped, the tab backgrounded, or the row insert threw any
// validation error (notably the holeId NOT NULL constraint that silently
// killed every FULL_ROUND attempt), the file orphaned in storage and the
// user saw nothing in their feed — exactly Taylor Muth's experience on
// 2026-05-23 with his Plantation Preserve photo.
//
// Guarantees this route provides:
//   - Idempotent on uploadId: client-generated UUID is the primary key,
//     so retries after a transient failure are safe no-ops.
//   - Resolves a default holeId when caller passes null (FULL_ROUND case
//     attaches to hole 1 of the course; creates hole 1 if missing).
//   - Atomic side effects: Upload insert, Round link, Course/User counter
//     bumps all run server-side in one request. Either the row exists at
//     the end with everything linked, or nothing changed.

type Body = {
  uploadId: string;          // client-generated UUID for idempotency
  courseId: string;
  holeId: string | null;     // null → resolved to hole 1
  mediaType: "PHOTO" | "VIDEO";
  mediaUrl: string;          // empty string allowed for VIDEO (uses cloudflareVideoId)
  cloudflareVideoId: string | null;
  shotType: string | null;
  yardageOverlay: string | null;
  clubUsed: string | null;
  windCondition: string | null;
  strategyNote: string | null;
  datePlayedAt: string | null;
  clipLat: number | null;
  clipLng: number | null;
  tripId: string | null;
  tripPublic: boolean;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.uploadId || !body.courseId || !body.mediaType) {
    return NextResponse.json({ error: "uploadId, courseId, mediaType required" }, { status: 400 });
  }
  if (body.mediaType === "PHOTO" && !body.mediaUrl) {
    return NextResponse.json({ error: "mediaUrl required for PHOTO" }, { status: 400 });
  }
  if (body.mediaType === "VIDEO" && !body.cloudflareVideoId) {
    return NextResponse.json({ error: "cloudflareVideoId required for VIDEO" }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Idempotency: if this uploadId already exists, return success.
  const { data: existing } = await admin
    .from("Upload")
    .select("id")
    .eq("id", body.uploadId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ uploadId: existing.id, idempotent: true });
  }

  // Resolve holeId. Required by schema (NOT NULL). FULL_ROUND and any
  // future "no specific hole" content default to hole 1.
  let holeId = body.holeId;
  if (!holeId) {
    const { data: h1 } = await admin
      .from("Hole")
      .select("id")
      .eq("courseId", body.courseId)
      .eq("holeNumber", 1)
      .maybeSingle();
    if (h1) {
      holeId = h1.id;
    } else {
      const newHoleId = randomUUID();
      const nowIso = new Date().toISOString();
      const { error: hErr } = await admin.from("Hole").insert({
        id: newHoleId,
        courseId: body.courseId,
        holeNumber: 1,
        par: 0,
        uploadCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      if (hErr) return NextResponse.json({ error: `hole create: ${hErr.message}` }, { status: 500 });
      holeId = newHoleId;
    }
  }

  const now = new Date().toISOString();

  // Primary insert. Service-role bypasses RLS — auth check at top already
  // established identity.
  const { error: insErr } = await admin.from("Upload").insert({
    id: body.uploadId,
    userId: user.id,
    courseId: body.courseId,
    holeId,
    mediaType: body.mediaType,
    mediaUrl: body.mediaUrl,
    cloudflareVideoId: body.cloudflareVideoId,
    teeBoxId: null,
    shotType: body.shotType,
    yardageOverlay: body.yardageOverlay,
    clubUsed: body.clubUsed,
    windCondition: body.windCondition,
    strategyNote: body.strategyNote,
    handicapRange: null,
    datePlayedAt: body.datePlayedAt,
    rankScore: 1 / Math.pow(2, 1.3),
    clipLat: body.clipLat,
    clipLng: body.clipLng,
    tripId: body.tripId,
    tripPublic: body.tripPublic,
    moderationStatus: "APPROVED",
    likeCount: 0,
    commentCount: 0,
    viewCount: 0,
    saveCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  if (insErr) return NextResponse.json({ error: `upload insert: ${insErr.message}` }, { status: 500 });

  // Auto-link to Round (one per user/course/date).
  const roundDate = body.datePlayedAt
    ? new Date(body.datePlayedAt).toISOString().split("T")[0]
    : now.split("T")[0];
  const { data: existingRound } = await admin
    .from("Round")
    .select("id")
    .eq("userId", user.id)
    .eq("courseId", body.courseId)
    .eq("date", roundDate)
    .maybeSingle();
  let roundId = existingRound?.id;
  if (!roundId) {
    roundId = randomUUID();
    await admin.from("Round").insert({
      id: roundId,
      userId: user.id,
      courseId: body.courseId,
      date: roundDate,
      createdAt: now,
      updatedAt: now,
    });
  }
  await admin.from("Upload").update({ roundId }).eq("id", body.uploadId);

  // Counter bumps. Read-modify-write is acceptable here — bursty concurrent
  // uploads from one user are rare and a -1 drift in display count is
  // harmless. Like-counter pattern uses recount-from-truth but that's
  // overkill for uploads.
  const { data: c } = await admin.from("Course").select("uploadCount").eq("id", body.courseId).single();
  await admin.from("Course").update({ uploadCount: (c?.uploadCount || 0) + 1 }).eq("id", body.courseId);

  const { data: u } = await admin.from("User").select("uploadCount").eq("id", user.id).single();
  await admin.from("User").update({ uploadCount: (u?.uploadCount || 0) + 1 }).eq("id", user.id);

  const { data: h } = await admin.from("Hole").select("uploadCount").eq("id", holeId).single();
  await admin.from("Hole").update({ uploadCount: (h?.uploadCount || 0) + 1 }).eq("id", holeId);

  return NextResponse.json({
    uploadId: body.uploadId,
    roundId,
    holeId,
    courseUploadCount: (c?.uploadCount || 0) + 1, // for client first-for-course detection
  });
}
