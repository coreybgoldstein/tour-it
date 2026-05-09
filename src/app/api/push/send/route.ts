import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_TYPES = new Set([
  "follow_received",
  "comment_received",
  "like_milestone",
  "new_clip",
  "new_clips",
  "tag",
  "trip_invite",
  "comment_mention",
]);

async function getSenderName(userId: string): Promise<string> {
  const { data } = await sb.from("User").select("displayName, username").eq("id", userId).single();
  return data?.displayName || data?.username || "Someone";
}

async function deliverPush(recipientUserId: string, title: string, body: string, url: string) {
  const { data: target } = await sb.from("User").select("pushSubscription").eq("id", recipientUserId).single();
  if (!target?.pushSubscription) return { ok: false, reason: "no subscription" };
  try {
    const subscription = JSON.parse(target.pushSubscription);
    await webpush.sendNotification(subscription, JSON.stringify({ title, body, url }));
    return { ok: true };
  } catch (err: any) {
    if (err.statusCode === 410) {
      await sb.from("User").update({ pushSubscription: null }).eq("id", recipientUserId);
    }
    return { ok: false, error: err.message };
  }
}

export async function POST(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`push:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const { type, referenceId, recipientUserId, likeCount } = await req.json();

  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid notification type" }, { status: 400 });
  }
  if (!recipientUserId) {
    return NextResponse.json({ error: "Missing recipientUserId" }, { status: 400 });
  }

  let title: string;
  let body: string;
  let url: string;

  if (type === "follow_received") {
    const { data: follow } = await sb.from("Follow").select("id").eq("followerId", user.id).eq("followingId", recipientUserId).maybeSingle();
    if (!follow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const name = await getSenderName(user.id);
    title = "New follower";
    body = `${name} started following you`;
    url = `/profile/${user.id}`;

  } else if (type === "comment_received") {
    if (!referenceId) return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });
    const { data: upload } = await sb.from("Upload").select("userId, courseId, holeNumber").eq("id", referenceId).maybeSingle();
    if (!upload || upload.userId !== recipientUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data: comment } = await sb.from("Comment").select("id").eq("uploadId", referenceId).eq("userId", user.id).maybeSingle();
    if (!comment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const name = await getSenderName(user.id);
    title = "New comment";
    body = `${name} commented on your clip`;
    url = upload.holeNumber
      ? `/courses/${upload.courseId}/holes/${upload.holeNumber}?clip=${referenceId}`
      : `/courses/${upload.courseId}`;

  } else if (type === "like_milestone") {
    if (!referenceId || !likeCount) return NextResponse.json({ error: "Missing referenceId or likeCount" }, { status: 400 });
    const { data: upload } = await sb.from("Upload").select("userId, courseId, holeNumber").eq("id", referenceId).maybeSingle();
    if (!upload || upload.userId !== recipientUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data: like } = await sb.from("Like").select("id").eq("uploadId", referenceId).eq("userId", user.id).maybeSingle();
    if (!like) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const count = Number(likeCount).toLocaleString();
    title = `${count} likes!`;
    body = `Your clip hit ${count} likes 🎯`;
    url = upload.holeNumber
      ? `/courses/${upload.courseId}/holes/${upload.holeNumber}?clip=${referenceId}`
      : `/courses/${upload.courseId}`;

  } else if (type === "new_clip") {
    if (!referenceId) return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });
    const { data: upload } = await sb.from("Upload").select("userId, courseId, holeNumber").eq("id", referenceId).maybeSingle();
    if (!upload || upload.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const [name, courseRow] = await Promise.all([
      getSenderName(user.id),
      sb.from("Course").select("name").eq("id", upload.courseId).single(),
    ]);
    const courseName = courseRow.data?.name || "a course";
    const holeLabel = upload.holeNumber ? ` — Hole ${upload.holeNumber}` : "";
    title = "New clip";
    body = `${name} posted at ${courseName}${holeLabel}`;
    url = upload.holeNumber
      ? `/courses/${upload.courseId}/holes/${upload.holeNumber}?clip=${referenceId}`
      : `/courses/${upload.courseId}`;

  } else if (type === "new_clips") {
    // Batch upload — referenceId = courseId
    if (!referenceId) return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });
    const [name, courseRow] = await Promise.all([
      getSenderName(user.id),
      sb.from("Course").select("name").eq("id", referenceId).single(),
    ]);
    const courseName = courseRow.data?.name || "a course";
    title = "New clips";
    body = `${name} posted at ${courseName}`;
    url = `/courses/${referenceId}`;

  } else if (type === "tag") {
    if (!referenceId) return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });
    const { data: upload } = await sb.from("Upload").select("userId, courseId, holeNumber").eq("id", referenceId).maybeSingle();
    if (!upload || upload.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const [name, courseRow] = await Promise.all([
      getSenderName(user.id),
      sb.from("Course").select("name").eq("id", upload.courseId).single(),
    ]);
    const courseName = courseRow.data?.name || "a course";
    const holeLabel = upload.holeNumber ? ` — Hole ${upload.holeNumber}` : "";
    title = "You were tagged in a clip";
    body = `${name} tagged you at ${courseName}${holeLabel}`;
    url = `/courses/${upload.courseId}`;

  } else if (type === "trip_invite") {
    if (!referenceId) return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });
    const { data: trip } = await sb.from("Trip").select("name").eq("id", referenceId).maybeSingle();
    if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const name = await getSenderName(user.id);
    title = "You've been invited!";
    body = `${name} added you to "${trip.name}"`;
    url = `/trips/${referenceId}`;

  } else {
    // comment_mention — referenceId = courseId
    if (!referenceId) return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });
    const name = await getSenderName(user.id);
    title = "You were mentioned";
    body = `${name} mentioned you in a comment`;
    url = `/courses/${referenceId}`;
  }

  const result = await deliverPush(recipientUserId, title, body, url);
  return NextResponse.json(result);
}
