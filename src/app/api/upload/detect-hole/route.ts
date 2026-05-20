import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rateLimit";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type Confidence = "high" | "medium" | "low";
type Reason = "adjacency" | "gps" | "popularity";
interface Candidate {
  holeNumber: number;
  confidence: Confidence;
  reason: Reason;
  detail?: string;
}

// Haversine distance in meters
function distMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = sb();
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`detect-hole:${user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many detections — try again later" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const courseId: string | undefined = body?.courseId;
  const gpsLat: number | undefined = typeof body?.gpsLat === "number" ? body.gpsLat : undefined;
  const gpsLng: number | undefined = typeof body?.gpsLng === "number" ? body.gpsLng : undefined;

  if (!courseId || typeof courseId !== "string") {
    return NextResponse.json({ error: "courseId required" }, { status: 400 });
  }

  // Pull holes for this course (need teeLat/Lng + uploadCount for ranking)
  const { data: holes } = await supabase
    .from("Hole")
    .select("holeNumber, teeLat, teeLng, uploadCount")
    .eq("courseId", courseId)
    .order("holeNumber", { ascending: true });

  if (!holes || holes.length === 0) {
    return NextResponse.json({ ok: true, candidates: [] });
  }

  const candidates: Candidate[] = [];

  // 1) Adjacency: did the user upload a clip on this course in the last 90 min?
  const ninetyMinAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("Upload")
    .select("holeId, createdAt, Hole:holeId(holeNumber)")
    .eq("userId", user.id)
    .eq("courseId", courseId)
    .not("holeId", "is", null)
    .gte("createdAt", ninetyMinAgo)
    .order("createdAt", { ascending: false })
    .limit(3);

  type RecentRow = { holeId: string | null; createdAt: string; Hole: { holeNumber: number } | { holeNumber: number }[] | null };
  const recentRows = (recent as unknown as RecentRow[] | null) ?? [];
  const lastHoleRow = recentRows[0];
  if (lastHoleRow?.Hole) {
    const lastN = Array.isArray(lastHoleRow.Hole) ? lastHoleRow.Hole[0]?.holeNumber : lastHoleRow.Hole.holeNumber;
    if (typeof lastN === "number" && lastN >= 1 && lastN <= 18) {
      const adjacencyMinAgo = Math.round((Date.now() - new Date(lastHoleRow.createdAt).getTime()) / 60000);
      const detail = `Your last clip was on Hole ${lastN} (~${adjacencyMinAgo} min ago)`;
      // Most golfers move forward → N+1 ranks first, then N (same hole, multi-shot), then N-1
      const nextN = lastN + 1 <= 18 ? lastN + 1 : null;
      const prevN = lastN - 1 >= 1 ? lastN - 1 : null;
      if (nextN) candidates.push({ holeNumber: nextN, confidence: "high", reason: "adjacency", detail });
      candidates.push({ holeNumber: lastN, confidence: "medium", reason: "adjacency", detail });
      if (prevN) candidates.push({ holeNumber: prevN, confidence: "low", reason: "adjacency", detail });
    }
  }

  // 2) GPS: if we have user coords AND holes have teeLat/Lng
  if (gpsLat !== undefined && gpsLng !== undefined) {
    const withGeo = holes.filter(h => typeof h.teeLat === "number" && typeof h.teeLng === "number");
    if (withGeo.length > 0) {
      const ranked = withGeo
        .map(h => ({ h, dist: distMeters(gpsLat, gpsLng, h.teeLat as number, h.teeLng as number) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3);
      for (const { h, dist } of ranked) {
        const conf: Confidence = dist < 100 ? "high" : dist < 300 ? "medium" : dist < 500 ? "low" : "low";
        if (dist > 1000) continue;
        candidates.push({
          holeNumber: h.holeNumber,
          confidence: conf,
          reason: "gps",
          detail: `${Math.round(dist)}m from tee`,
        });
      }
    }
  }

  // 3) Popularity floor: top 3 most-clipped holes on this course
  if (candidates.length === 0) {
    const popular = [...holes]
      .filter(h => (h.uploadCount ?? 0) > 0)
      .sort((a, b) => (b.uploadCount ?? 0) - (a.uploadCount ?? 0))
      .slice(0, 3);
    for (const h of popular) {
      candidates.push({
        holeNumber: h.holeNumber,
        confidence: "low",
        reason: "popularity",
        detail: `${h.uploadCount} prior clip${h.uploadCount === 1 ? "" : "s"}`,
      });
    }
  }

  // Dedupe by holeNumber, keeping highest-confidence + most-specific reason per hole.
  // Confidence ranks high > medium > low; reason ranks adjacency > gps > popularity when tied.
  const confRank: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };
  const reasonRank: Record<Reason, number> = { adjacency: 3, gps: 2, popularity: 1 };
  const byHole = new Map<number, Candidate>();
  for (const c of candidates) {
    const existing = byHole.get(c.holeNumber);
    if (!existing) { byHole.set(c.holeNumber, c); continue; }
    const better =
      confRank[c.confidence] > confRank[existing.confidence] ||
      (confRank[c.confidence] === confRank[existing.confidence] &&
        reasonRank[c.reason] > reasonRank[existing.reason]);
    if (better) byHole.set(c.holeNumber, c);
  }

  const sorted = Array.from(byHole.values()).sort((a, b) => {
    const cd = confRank[b.confidence] - confRank[a.confidence];
    if (cd !== 0) return cd;
    return reasonRank[b.reason] - reasonRank[a.reason];
  }).slice(0, 3);

  return NextResponse.json({ ok: true, candidates: sorted });
}
