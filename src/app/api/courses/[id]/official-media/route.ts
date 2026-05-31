import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCourseManager } from "@/lib/courseManagerAuth";

// GET    /api/courses/[id]/official-media  → list (public)
// POST   /api/courses/[id]/official-media  → create (manager only)
//
// Note: official media is rendered in the "From the course" block
// and the hole-detail official section. It NEVER joins the UGC feed
// — that's the whole point of keeping it as a separate table from
// Upload.

const MEDIA_TYPES = new Set(["image", "flyover", "video"]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id: courseId } = await params;
  const url = new URL(_req.url);
  const holeParam = url.searchParams.get("hole");

  let q = supabase
    .from("CourseOfficialMedia")
    .select("id, holeNumber, holeRangeEnd, mediaType, url, cloudflareVideoId, caption, sortOrder, createdAt")
    .eq("courseId", courseId)
    .order("sortOrder", { ascending: true });

  if (holeParam === "course") {
    q = q.is("holeNumber", null);
  } else if (holeParam) {
    const n = parseInt(holeParam, 10);
    if (!Number.isNaN(n)) {
      // Match a single-hole row OR a range row that covers this hole.
      // PostgREST .or filter — both branches AND'd against the
      // existing eq("courseId").
      q = q.or(`and(holeNumber.eq.${n},holeRangeEnd.is.null),and(holeNumber.lte.${n},holeRangeEnd.gte.${n})`);
    }
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ media: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id: courseId } = await params;
  const auth = await requireCourseManager(supabase, courseId);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const mediaType = String(body.mediaType ?? "").trim();
  const url = String(body.url ?? "").trim();
  const cloudflareVideoId = body.cloudflareVideoId ? String(body.cloudflareVideoId).trim().slice(0, 200) || null : null;
  const caption = body.caption ? String(body.caption).trim().slice(0, 500) || null : null;
  const holeNumber = body.holeNumber == null ? null : Math.max(1, Math.min(18, Math.floor(Number(body.holeNumber))));
  const holeRangeEnd = body.holeRangeEnd == null ? null : Math.max(1, Math.min(18, Math.floor(Number(body.holeRangeEnd))));
  // Range validation — end must be > start when both set; same-hole
  // (start==end) collapses to a single-hole row with end=null.
  let finalRangeEnd: number | null = null;
  if (holeNumber != null && holeRangeEnd != null && holeRangeEnd > holeNumber) {
    finalRangeEnd = holeRangeEnd;
  }
  const sortOrder = typeof body.sortOrder === "number" ? Math.max(0, Math.min(9999, Math.floor(body.sortOrder))) : 0;

  if (!MEDIA_TYPES.has(mediaType)) {
    return NextResponse.json({ error: "mediaType must be image | flyover | video" }, { status: 400 });
  }
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("CourseOfficialMedia")
    .insert({
      id: crypto.randomUUID(),
      courseId,
      holeNumber,
      holeRangeEnd: finalRangeEnd,
      mediaType,
      url: url.slice(0, 500),
      cloudflareVideoId,
      caption,
      sortOrder,
      createdAt: new Date().toISOString(),
    })
    .select("id, holeNumber, holeRangeEnd, mediaType, url, cloudflareVideoId, caption, sortOrder, createdAt")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ media: data });
}
