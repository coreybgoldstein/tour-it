import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { computeRankScore } from "@/lib/rankScore";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Centralized comment side-effects so the cross-user writes (bumping the
// clip owner's Upload.commentCount/rankScore + notifying the owner /
// mentioned users) run as service_role and survive owner-only RLS on
// Upload + Notification. The browser still inserts/deletes its OWN
// Comment row (Comment has owner-write RLS); it then calls this route to
// reconcile the denormalized counter and fan out notifications.
//
// commentCount is recomputed from the Comment table (source of truth),
// mirroring /api/likes/toggle — no read-modify-write drift.

type Body = {
  uploadId: string;
  action: "posted" | "deleted";
  commentBody?: string;   // used to render the notification + parse @mentions
  mentions?: string[];    // usernames mentioned in the comment (optional)
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
  if (!body.uploadId || (body.action !== "posted" && body.action !== "deleted")) {
    return NextResponse.json({ error: "uploadId and action required" }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1) Recompute the denormalized comment counter from the source of truth.
  const { count, error: countErr } = await admin
    .from("Comment")
    .select("*", { count: "exact", head: true })
    .eq("uploadId", body.uploadId);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  const commentCount = count ?? 0;

  // 2) Upload metadata for rankScore + owner-side notification.
  const { data: upload } = await admin
    .from("Upload")
    .select("userId, courseId, likeCount, createdAt, hole:holeId(holeNumber)")
    .eq("id", body.uploadId)
    .maybeSingle();
  const holeNumber = ((upload?.hole as unknown as { holeNumber: number } | { holeNumber: number }[] | null) instanceof Array
    ? (upload?.hole as unknown as { holeNumber: number }[])[0]?.holeNumber
    : (upload?.hole as unknown as { holeNumber: number } | null)?.holeNumber) ?? null;

  const newRank = upload
    ? computeRankScore(upload.likeCount ?? 0, commentCount, upload.createdAt)
    : undefined;
  await admin
    .from("Upload")
    .update({ commentCount, ...(newRank !== undefined && { rankScore: newRank }) })
    .eq("id", body.uploadId);

  // 3) Notifications + awards only on a new comment.
  if (body.action === "posted" && upload) {
    const clipLink = holeNumber
      ? `/courses/${upload.courseId}/holes/${holeNumber}?clip=${body.uploadId}`
      : `/courses/${upload.courseId}`;
    const { data: commenter } = await admin
      .from("User")
      .select("displayName, username")
      .eq("id", user.id)
      .maybeSingle();
    const commenterName = commenter?.displayName || commenter?.username || "Someone";
    const origin = new URL(req.url).origin;
    const cookie = req.headers.get("cookie") ?? "";

    // 3a) Notify the clip owner (unless commenting on own clip).
    if (upload.userId && upload.userId !== user.id) {
      const now = new Date().toISOString();
      admin.from("Notification").insert({
        id: randomUUID(),
        userId: upload.userId,
        type: "comment",
        title: "New comment",
        body: `${commenterName} commented on your clip`,
        linkUrl: clipLink,
        referenceId: body.uploadId,
        read: false,
        createdAt: now,
        updatedAt: now,
      }).then(() => {});
      fetch(`${origin}/api/push/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ type: "comment_received", recipientUserId: upload.userId, referenceId: body.uploadId }),
      }).catch(() => {});
      fetch(`${origin}/api/points/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ action: "comment_received", recipientUserId: upload.userId, referenceId: body.uploadId }),
      }).catch(() => {});
    }

    // 3b) Notify @mentioned users (resolve usernames -> ids), skipping the
    // commenter and the owner (already notified above).
    const mentions = (body.mentions ?? []).filter(Boolean);
    if (mentions.length > 0) {
      const { data: mentioned } = await admin
        .from("User")
        .select("id")
        .in("username", mentions);
      const snippet = (body.commentBody ?? "").trim().slice(0, 80);
      const ellipsis = (body.commentBody ?? "").trim().length > 80 ? "…" : "";
      const targets = (mentioned ?? [])
        .map((u: { id: string }) => u.id)
        .filter((uid: string) => uid !== user.id && uid !== upload.userId);
      if (targets.length > 0) {
        const now = new Date().toISOString();
        admin.from("Notification").insert(
          targets.map((uid: string) => ({
            id: randomUUID(),
            userId: uid,
            type: "comment_mention",
            title: "You were mentioned",
            body: `${commenterName} tagged you in a comment: "${snippet}${ellipsis}"`,
            linkUrl: clipLink,
            referenceId: body.uploadId,
            read: false,
            createdAt: now,
            updatedAt: now,
          }))
        ).then(() => {});
        for (const uid of targets) {
          fetch(`${origin}/api/push/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie },
            body: JSON.stringify({ type: "comment_mention", recipientUserId: uid, referenceId: body.uploadId }),
          }).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({ commentCount });
}
