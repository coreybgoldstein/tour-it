import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/courseManagerAuth";

// GET /api/admin/claims?status=PENDING
// Lists course claims with a domain-match hint between the claimant's
// work email and the course's existing websiteUrl. Used by the admin
// /admin/claims surface.
export async function GET(req: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "PENDING";
  if (!["PENDING", "VERIFIED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data: claims, error } = await supabase
    .from("CourseClaim")
    .select("id, courseId, userId, status, claimantName, claimantRole, claimantEmail, verificationNote, requestedAt, reviewedAt")
    .eq("status", status)
    .order("requestedAt", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const courseIds = Array.from(new Set((claims ?? []).map((c: any) => c.courseId)));
  const userIds = Array.from(new Set((claims ?? []).map((c: any) => c.userId)));

  const [{ data: courses }, { data: users }] = await Promise.all([
    courseIds.length
      ? supabase.from("Course").select("id, name, city, state, websiteUrl, isClaimed").in("id", courseIds)
      : Promise.resolve({ data: [] as any[] }),
    userIds.length
      ? supabase.from("User").select("id, username, displayName, avatarUrl").in("id", userIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const courseById = new Map((courses ?? []).map((c: any) => [c.id, c]));
  const userById = new Map((users ?? []).map((u: any) => [u.id, u]));

  // Domain-match hint: claimantEmail @ part vs hostname of course.websiteUrl.
  // Strict TLD-aware compare (registrable-ish) — strip www. + match the
  // last 2 dot-separated labels so "tournament.pinehurst.com" and
  // "membership.pinehurst.com" both match a claim from @pinehurst.com.
  function domainMatch(email: string | null, websiteUrl: string | null): boolean {
    if (!email || !websiteUrl) return false;
    const at = email.split("@")[1]?.toLowerCase();
    if (!at) return false;
    try {
      const host = new URL(/^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`).hostname.toLowerCase().replace(/^www\./, "");
      const tail = (s: string) => s.split(".").slice(-2).join(".");
      return tail(at) === tail(host);
    } catch { return false; }
  }

  const enriched = (claims ?? []).map((c: any) => {
    const course = courseById.get(c.courseId) as any;
    const claimant = userById.get(c.userId) as any;
    return {
      ...c,
      course: course ? { id: course.id, name: course.name, city: course.city, state: course.state, websiteUrl: course.websiteUrl, isClaimed: course.isClaimed } : null,
      claimant: claimant ? { id: claimant.id, username: claimant.username, displayName: claimant.displayName, avatarUrl: claimant.avatarUrl } : null,
      domainMatchHint: domainMatch(c.claimantEmail, course?.websiteUrl ?? null),
    };
  });

  return NextResponse.json({ claims: enriched });
}
