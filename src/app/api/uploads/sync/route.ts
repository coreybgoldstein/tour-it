import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Centralized post-upload side-effects so the cross-user writes survive
// owner-only RLS on UploadTag + Notification. The browser still inserts
// its OWN Upload row (owner-write RLS); it then calls this route to:
//   1) hero-tag — insert the UploadTag(isHero) on the tagged user + send
//      them a "claim this clip" Notification (ownership transfers on
//      approval). Verified the upload belongs to the caller first.
//   2) follower fan-out — notify the uploader's followers of the new
//      clip(s). Recipients are resolved server-side from the actor's
//      Follow rows, so the client can't target arbitrary users.
// Notifications run as service_role; push is forwarded to /api/push/send.

type Body = {
  uploadId?: string;
  heroUserId?: string;
  courseId: string;
  courseName: string;
  holeNumber?: number | null;
  notifyFollowers?: { clipCount: number; batch: boolean };
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
  if (!body.courseId || !body.courseName) {
    return NextResponse.json({ error: "courseId and courseName required" }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: actor } = await admin
    .from("User")
    .select("displayName, username")
    .eq("id", user.id)
    .maybeSingle();
  const actorName = actor?.displayName || actor?.username || "Someone";
  const origin = new URL(req.url).origin;
  const cookie = req.headers.get("cookie") ?? "";
  const now = new Date().toISOString();

  // 1) Hero tag — only if the upload genuinely belongs to the caller.
  if (body.heroUserId && body.uploadId && body.heroUserId !== user.id) {
    const { data: upload } = await admin
      .from("Upload")
      .select("userId")
      .eq("id", body.uploadId)
      .maybeSingle();
    if (upload?.userId === user.id) {
      const clipLink = body.holeNumber
        ? `/courses/${body.courseId}/holes/${body.holeNumber}?clip=${body.uploadId}`
        : `/courses/${body.courseId}`;
      await admin.from("UploadTag").insert({
        id: randomUUID(),
        uploadId: body.uploadId,
        userId: body.heroUserId,
        isHero: true,
        createdAt: now,
      });
      await admin.from("Notification").insert({
        id: randomUUID(),
        userId: body.heroUserId,
        type: "clip_tag",
        title: `${actorName} uploaded a clip of you`,
        body: `${actorName} says this is your shot at ${body.courseName}${body.holeNumber ? ` — Hole ${body.holeNumber}` : ""}. Claim it on your profile?`,
        linkUrl: clipLink,
        referenceId: body.uploadId,
        read: false,
        createdAt: now,
        updatedAt: now,
      });
      fetch(`${origin}/api/push/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ type: "tag", recipientUserId: body.heroUserId, referenceId: body.uploadId }),
      }).catch(() => {});
    }
  }

  // 2) Follower fan-out — recipients resolved from the actor's Follow rows.
  if (body.notifyFollowers) {
    const { data: followers } = await admin
      .from("Follow")
      .select("followerId")
      .eq("followingId", user.id)
      .eq("status", "ACTIVE");
    if (followers?.length) {
      const { clipCount, batch } = body.notifyFollowers;
      const holeLabel = body.holeNumber ? ` — Hole ${body.holeNumber}` : "";
      const title = batch ? "New clips" : "New clip";
      const text = batch
        ? `${actorName} posted ${clipCount} clip${clipCount > 1 ? "s" : ""} at ${body.courseName}`
        : `${actorName} posted a clip at ${body.courseName}${holeLabel}`;
      const linkUrl = batch || !body.uploadId
        ? `/courses/${body.courseId}`
        : `/courses/${body.courseId}/holes/${body.holeNumber}?clip=${body.uploadId}`;
      await admin.from("Notification").insert(
        followers.map((f: { followerId: string }) => ({
          id: randomUUID(),
          userId: f.followerId,
          type: "new_clip",
          title,
          body: text,
          linkUrl,
          read: false,
          createdAt: now,
          updatedAt: now,
        }))
      );
      const pushType = batch ? "new_clips" : "new_clip";
      const pushRef = batch ? body.courseId : body.uploadId;
      for (const f of followers) {
        fetch(`${origin}/api/push/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie },
          body: JSON.stringify({ type: pushType, recipientUserId: f.followerId, referenceId: pushRef }),
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true });
}
