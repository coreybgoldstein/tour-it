import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";
import { awardPoints } from "@/lib/awardPoints";
import { PointAction } from "@/config/points-system";

const ALLOWED_FIELDS = new Set(["name", "description", "coverImageUrl", "logoUrl", "city", "state", "zipCode", "yearEstablished", "courseType", "websiteUrl", "holeCount"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing course id" }, { status: 400 });

  if (!rateLimit(`course-contribute:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many edits — try again later" }, { status: 429 });
  }

  const body = await req.json();

  // Strip any fields not in the allowed list
  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key)) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Validate types
  if ("yearEstablished" in updates && updates.yearEstablished !== null) {
    const yr = Number(updates.yearEstablished);
    if (isNaN(yr) || yr < 1800 || yr > new Date().getFullYear()) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    updates.yearEstablished = yr;
  }
  if ("courseType" in updates && updates.courseType !== null) {
    if (!["PUBLIC", "SEMI_PRIVATE", "PRIVATE"].includes(updates.courseType as string)) {
      return NextResponse.json({ error: "Invalid courseType" }, { status: 400 });
    }
  }
  if ("description" in updates && typeof updates.description === "string") {
    updates.description = updates.description.trim().slice(0, 2000);
  }
  if ("name" in updates && typeof updates.name === "string") {
    updates.name = updates.name.trim().slice(0, 200) || null;
    if (!updates.name) delete updates.name;
  }
  if ("city" in updates && typeof updates.city === "string") {
    updates.city = updates.city.trim().slice(0, 100) || null;
  }
  if ("state" in updates && typeof updates.state === "string") {
    updates.state = updates.state.trim().slice(0, 50) || null;
  }
  if ("zipCode" in updates && typeof updates.zipCode === "string") {
    updates.zipCode = updates.zipCode.trim().slice(0, 10) || null;
  }
  if ("holeCount" in updates) {
    const hc = Number(updates.holeCount);
    if (![9, 18].includes(hc)) {
      return NextResponse.json({ error: "holeCount must be 9 or 18" }, { status: 400 });
    }
    updates.holeCount = hc;
  }
  if ("websiteUrl" in updates && typeof updates.websiteUrl === "string") {
    let url = updates.websiteUrl.trim();
    if (url) {
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      try {
        const u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          return NextResponse.json({ error: "Website must be http(s)" }, { status: 400 });
        }
        updates.websiteUrl = u.toString().slice(0, 500);
      } catch {
        return NextResponse.json({ error: "Invalid website URL" }, { status: 400 });
      }
    } else {
      updates.websiteUrl = null;
    }
  }

  // If city or state changed, re-geocode using course name for precision
  const cityChanged = "city" in updates && updates.city;
  const stateChanged = "state" in updates && updates.state;
  if (cityChanged || stateChanged) {
    const { data: existing } = await supabase
      .from("Course")
      .select("name, city, state")
      .eq("id", id)
      .single();
    const name = existing?.name ?? "";
    const city = (updates.city as string | null) ?? existing?.city ?? "";
    const state = (updates.state as string | null) ?? existing?.state ?? "";
    if (city && state) {
      try {
        const tryGeo = async (q: string) => {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
            { headers: { "Accept-Language": "en", "User-Agent": "TourIt/1.0" } }
          );
          const d = await r.json();
          return d?.[0] ? { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) } : null;
        };
        const exact = name ? await tryGeo(`${name}, ${city}, ${state}, US`) : null;
        const result = exact ?? await tryGeo(`${city}, ${state}, US`);
        if (result) {
          updates.latitude = result.lat;
          updates.longitude = result.lon;
        }
      } catch {}
    }
  }

  // Capture pre-update state so we know which fields went null → set
  const { data: before } = await supabase
    .from("Course")
    .select("description, coverImageUrl, logoUrl, yearEstablished, courseType, zipCode, websiteUrl")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("Course").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If holeCount changed, sync the Hole rows to match. Adds new holes if
  // going from 9 → 18, removes holes 10–18 if going from 18 → 9.
  if ("holeCount" in updates) {
    const hc = updates.holeCount as number;
    const { data: existingHoles } = await supabase
      .from("Hole")
      .select("id, holeNumber")
      .eq("courseId", id);
    const existingNums = new Set((existingHoles ?? []).map((h: any) => h.holeNumber));
    if (hc === 9) {
      const idsToDrop = (existingHoles ?? []).filter((h: any) => h.holeNumber > 9).map((h: any) => h.id);
      if (idsToDrop.length) await supabase.from("Hole").delete().in("id", idsToDrop);
    } else if (hc === 18) {
      const now = new Date().toISOString();
      const toAdd: any[] = [];
      for (let n = 1; n <= 18; n++) {
        if (!existingNums.has(n)) {
          toAdd.push({ id: crypto.randomUUID(), courseId: id, holeNumber: n, par: 4, uploadCount: 0, createdAt: now, updatedAt: now });
        }
      }
      if (toAdd.length) await supabase.from("Hole").insert(toAdd);
    }
  }

  // Award course-field points for any field that went from null/empty to a real value.
  // Each action is referenceId-scoped to the courseId so the same field can't double-award.
  if (before) {
    const FIELD_ACTIONS: Array<[keyof typeof before, typeof PointAction[keyof typeof PointAction]]> = [
      ["description",      PointAction.ADD_COURSE_DESCRIPTION],
      ["coverImageUrl",    PointAction.ADD_COVER_PHOTO],
      ["logoUrl",          PointAction.ADD_COURSE_LOGO],
      ["yearEstablished",  PointAction.ADD_YEAR_ESTABLISHED],
      ["courseType",       PointAction.ADD_COURSE_TYPE],
      ["zipCode",          PointAction.ADD_ZIP_CODE],
      ["websiteUrl",       PointAction.ADD_WEBSITE_URL],
    ];
    for (const [field, action] of FIELD_ACTIONS) {
      const wasEmpty = before[field] === null || before[field] === undefined || before[field] === "";
      const newValue = (updates as Record<string, unknown>)[field as string];
      const isNowSet = newValue !== null && newValue !== undefined && newValue !== "";
      if (wasEmpty && isNowSet) {
        // Don't await — fire-and-forget so the response stays snappy
        awardPoints({ userId: user.id, action, referenceId: `${id}:${field}` }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true });
}
