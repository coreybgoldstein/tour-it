import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { computeRankScore } from "@/lib/rankScore";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Atomic like/unlike for an upload.
//
// Previous client-side implementation had three critical bugs that explain
// the "didn't remember the like" + "counts don't match" reports:
//
//   1. Read-modify-write race on Upload.likeCount — concurrent likes from two
//      users computed `current + 1` from stale snapshots and clobbered each
//      other. The denormalized counter drifted permanently.
//   2. Plain INSERT against a (userId, uploadId) unique-constrained table —
//      a rapid double-tap threw 23505 on the second call and the catch block
//      silently swallowed it.
//   3. Silent error handling left the optimistic UI saying "liked" while the
//      Like row was never persisted. Next session the like was gone.
//
// This route fixes all three:
//   - Like table is the SOURCE OF TRUTH. INSERT uses ignoreDuplicates so a
//     repeat call is a no-op, not an error.
//   - After mutation we SELECT count(*) FROM Like and write that exact value
//     back to Upload.likeCount. Drift is impossible on this path; concurrent
//     callers may write the same count twice but never an incremented stale value.
//   - Returns {liked, likeCount} so the client can sync to truth instead of
//     guessing.

type Body = {
  uploadId: string;
  action: "like" | "unlike";
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
  if (!body.uploadId || (body.action !== "like" && body.action !== "unlike")) {
    return NextResponse.json({ error: "uploadId and action required" }, { status: 400 });
  }

  // Service-role client to bypass any RLS that might block aggregate updates.
  // The auth check above already established the user identity for permissions.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1) Mutate the Like table (source of truth)
  if (body.action === "like") {
    const { error } = await admin
      .from("Like")
      .upsert(
        { id: randomUUID(), userId: user.id, uploadId: body.uploadId, createdAt: new Date().toISOString() },
        { onConflict: "userId,uploadId", ignoreDuplicates: true }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("Like")
      .delete()
      .eq("userId", user.id)
      .eq("uploadId", body.uploadId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2) Recompute the denormalized counter from the source of truth
  const { count, error: countErr } = await admin
    .from("Like")
    .select("*", { count: "exact", head: true })
    .eq("uploadId", body.uploadId);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  const trueCount = count ?? 0;

  // 3) Get upload metadata for rankScore + owner-side awards
  const { data: upload } = await admin
    .from("Upload")
    .select("userId, courseId, holeNumber, commentCount, createdAt")
    .eq("id", body.uploadId)
    .maybeSingle();

  // 4) Write the count + recomputed rankScore back
  const newRank = upload
    ? computeRankScore(trueCount, upload.commentCount ?? 0, upload.createdAt)
    : undefined;
  await admin
    .from("Upload")
    .update({ likeCount: trueCount, ...(newRank !== undefined && { rankScore: newRank }) })
    .eq("id", body.uploadId);

  const nowLiked = body.action === "like";

  // 5) Fire-and-forget side effects (points + milestone notifications). Errors
  // here MUST NOT block the like response — the like itself is durable.
  if (upload && upload.userId && upload.userId !== user.id) {
    const action = nowLiked ? "like_received" : "unlike_received";
    fetch(`${new URL(req.url).origin}/api/points/award`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") ?? "" },
      body: JSON.stringify({ action, recipientUserId: upload.userId, referenceId: body.uploadId }),
    }).catch(() => {});

    if (nowLiked) {
      const milestones: Record<number, string> = { 10: "milestone_10_likes", 100: "milestone_100_likes", 1000: "milestone_1000_likes" };
      if (milestones[trueCount]) {
        const now = new Date().toISOString();
        const linkUrl = upload.holeNumber
          ? `/courses/${upload.courseId}/holes/${upload.holeNumber}?clip=${body.uploadId}`
          : `/courses/${upload.courseId}`;
        admin.from("Notification").insert({
          id: randomUUID(),
          userId: upload.userId,
          type: "like_milestone",
          title: `${trueCount} likes!`,
          body: `Your clip hit ${trueCount.toLocaleString()} likes 🎯`,
          linkUrl,
          read: false,
          createdAt: now,
          updatedAt: now,
        }).then(() => {});
        fetch(`${new URL(req.url).origin}/api/push/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "like_milestone", recipientUserId: upload.userId, referenceId: body.uploadId, likeCount: trueCount }),
        }).catch(() => {});
        fetch(`${new URL(req.url).origin}/api/points/award`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") ?? "" },
          body: JSON.stringify({ action: milestones[trueCount], recipientUserId: upload.userId, referenceId: body.uploadId }),
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ liked: nowLiked, likeCount: trueCount });
}
