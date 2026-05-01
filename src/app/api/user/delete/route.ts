import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uid = user.id;
  const admin = createAdminClient();

  // Delete in dependency order to avoid FK violations
  // 1. Notifications
  await admin.from("Notification").delete().eq("userId", uid);
  // 2. Comments by user
  await admin.from("Comment").delete().eq("userId", uid);
  // 3. Likes by user
  await admin.from("Like").delete().eq("userId", uid);
  // 4. Upload tags by user
  await admin.from("UploadTag").delete().eq("userId", uid);
  // 5. Follows where user is follower or being followed
  await admin.from("Follow").delete().eq("followerId", uid);
  await admin.from("Follow").delete().eq("followingId", uid);
  // 6. Saves
  await admin.from("Save").delete().eq("userId", uid);
  // 7. Moderation reports submitted by user
  await admin.from("ModerationReport").delete().eq("reporterId", uid);
  // 8. Comments + likes + tags on user's own uploads
  const { data: uploads } = await admin.from("Upload").select("id").eq("userId", uid);
  if (uploads && uploads.length > 0) {
    const uploadIds = uploads.map((u: { id: string }) => u.id);
    await admin.from("Comment").delete().in("uploadId", uploadIds);
    await admin.from("Like").delete().in("uploadId", uploadIds);
    await admin.from("UploadTag").delete().in("uploadId", uploadIds);
    await admin.from("Notification").delete().in("referenceId", uploadIds);
  }
  // 9. Uploads
  await admin.from("Upload").delete().eq("userId", uid);
  // 10. Progression data
  await admin.from("UserBadge").delete().eq("userId", uid);
  await admin.from("UserPointsLedger").delete().eq("userId", uid);
  await admin.from("UserProgression").delete().eq("userId", uid);
  await admin.from("CourseContribution").delete().eq("userId", uid);
  // 11. User row
  await admin.from("User").delete().eq("id", uid);
  // 12. Delete Supabase auth user (requires service role)
  await admin.auth.admin.deleteUser(uid);

  return NextResponse.json({ ok: true });
}
