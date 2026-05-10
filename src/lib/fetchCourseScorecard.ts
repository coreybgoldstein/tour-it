/**
 * Server-side helper to populate a course's Hole rows from GolfCourseAPI.
 * Used by the on-demand /api/courses/[id]/refresh-scorecard route plus
 * the background batch scripts (which run with the same logic).
 */

import { createClient } from "@supabase/supabase-js";

const KEY = process.env.GOLF_COURSE_API_KEY;
const API_BASE = "https://api.golfcourseapi.com/v1";

type ApiHole = { par: number; yardage: number; handicap: number };
type ApiTee = {
  tee_name: string;
  total_yards: number;
  par_total: number;
  number_of_holes: number;
  holes: ApiHole[];
};
type ApiCourse = {
  id: number;
  club_name: string;
  course_name: string;
  location?: { city: string; state: string };
  tees?: { male?: ApiTee[]; female?: ApiTee[] };
};

function nameScore(a: string | null | undefined, b: string | null | undefined): number {
  const norm = (s: string | null | undefined) =>
    (s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 1);
  const ta = new Set(norm(a));
  const tb = new Set(norm(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hits = 0;
  for (const t of ta) if (tb.has(t)) hits++;
  return hits / Math.max(ta.size, tb.size);
}

function buildSearchQuery(name: string): string {
  return name
    .replace(/\s*-\s*.+$/, "")
    .replace(/\bgolf\b/i, "")
    .replace(/\bclub\b/i, "")
    .replace(/\bcourse\b/i, "")
    .replace(/\bresort\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function layoutHint(name: string): string | null {
  const m = name.match(/[-—]\s*(.+)$/);
  return m ? m[1].trim() : null;
}

function scoreHit(hit: ApiCourse, course: { name: string; city: string | null; state: string | null }): number {
  let score = 0;
  if (hit.location?.state === course.state) score += 30;
  else if (hit.location?.state) return -1;

  const hitCity = (hit.location?.city || "").toLowerCase();
  const ourCity = (course.city || "").toLowerCase();
  if (hitCity && ourCity && (hitCity === ourCity || hitCity.includes(ourCity) || ourCity.includes(hitCity))) score += 15;

  score += nameScore(hit.club_name, course.name) * 30;

  const layout = layoutHint(course.name);
  if (layout) {
    const courseMatch = nameScore(hit.course_name, layout);
    score += courseMatch * 25;
    if (courseMatch === 0 && hit.course_name && hit.course_name !== hit.club_name) score -= 10;
  } else if (!hit.course_name || hit.course_name === hit.club_name) {
    score += 5;
  }
  return score;
}

function pickLongestTee(tees: ApiCourse["tees"], expectedHoles: number): ApiTee | null {
  const all = [...(tees?.male ?? []), ...(tees?.female ?? [])];
  if (all.length === 0) return null;
  const maleMatch = (tees?.male ?? []).filter((t) => (t.holes?.length ?? t.number_of_holes) === expectedHoles);
  const pool = maleMatch.length > 0 ? maleMatch : all.filter((t) => (t.holes?.length ?? t.number_of_holes) === expectedHoles);
  if (pool.length === 0) return null;
  const named = pool.find((t) => /black|tip|champ|tournament/i.test(t.tee_name || ""));
  if (named) return named;
  return [...pool].sort((a, b) => (b.total_yards || 0) - (a.total_yards || 0))[0];
}

export type RefreshResult =
  | { ok: true; matched: true; updated: number; total: number; teeName: string; teeYards: number; clubName: string; courseName: string }
  | { ok: true; matched: false; reason: string }
  | { ok: false; error: string };

export async function refreshCourseScorecard(courseId: string): Promise<RefreshResult> {
  if (!KEY) return { ok: false, error: "GOLF_COURSE_API_KEY not configured" };

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data: course, error: cErr } = await sb
    .from("Course")
    .select("id, name, city, state, holeCount")
    .eq("id", courseId)
    .single();
  if (cErr || !course) return { ok: false, error: "course not found" };
  if (course.holeCount !== 9 && course.holeCount !== 18) {
    return { ok: true, matched: false, reason: `course is ${course.holeCount}h — API only supports 9/18` };
  }

  const q = buildSearchQuery(course.name);
  if (!q) return { ok: true, matched: false, reason: "name too short to search" };

  let hits: ApiCourse[];
  try {
    const r = await fetch(`${API_BASE}/search?search_query=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Key ${KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { ok: false, error: `API search ${r.status}` };
    hits = (await r.json()).courses ?? [];
  } catch (e) {
    return { ok: false, error: `search err: ${(e as Error).message}` };
  }

  const scored = hits
    .map((h) => ({ hit: h, score: scoreHit(h, course) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { ok: true, matched: false, reason: "no candidate matched name+location" };

  const top = scored[0].hit;
  let full: ApiCourse;
  try {
    const r = await fetch(`${API_BASE}/courses/${top.id}`, {
      headers: { Authorization: `Key ${KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { ok: false, error: `API get ${r.status}` };
    full = (await r.json()).course;
  } catch (e) {
    return { ok: false, error: `get err: ${(e as Error).message}` };
  }

  const tee = pickLongestTee(full.tees, course.holeCount);
  if (!tee || !tee.holes?.length) {
    return { ok: true, matched: false, reason: `no ${course.holeCount}-hole tee in API data` };
  }

  // Upsert holes
  const { data: existing } = await sb.from("Hole").select("id, holeNumber").eq("courseId", course.id);
  const byNum: Record<number, string> = {};
  (existing ?? []).forEach((h: any) => (byNum[h.holeNumber] = h.id));

  let updated = 0;
  const now = new Date().toISOString();
  for (let i = 0; i < tee.holes.length; i++) {
    const num = i + 1;
    const apiH = tee.holes[i];
    const dbId = byNum[num];
    if (!dbId) continue;
    const { error } = await sb
      .from("Hole")
      .update({
        par: apiH.par,
        yardage: apiH.yardage,
        handicapRank: apiH.handicap,
        updatedAt: now,
      })
      .eq("id", dbId);
    if (!error) updated++;
  }

  return {
    ok: true,
    matched: true,
    updated,
    total: tee.holes.length,
    teeName: tee.tee_name,
    teeYards: tee.total_yards,
    clubName: full.club_name,
    courseName: full.course_name,
  };
}
