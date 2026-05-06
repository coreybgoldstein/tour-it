import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";

const ALLOWED_FIELDS = new Set(["name", "description", "coverImageUrl", "logoUrl", "city", "state", "zipCode", "yearEstablished", "courseType"]);

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

  // If city or state changed, re-geocode so the course stays on the map
  const cityChanged = "city" in updates && updates.city;
  const stateChanged = "state" in updates && updates.state;
  if (cityChanged || stateChanged) {
    const { data: existing } = await supabase
      .from("Course")
      .select("city, state")
      .eq("id", id)
      .single();
    const city = (updates.city as string | null) ?? existing?.city ?? "";
    const state = (updates.state as string | null) ?? existing?.state ?? "";
    if (city && state) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${city}, ${state}, US`)}&format=json&limit=1`,
          { headers: { "Accept-Language": "en", "User-Agent": "TourIt/1.0" } }
        );
        const geoData = await geoRes.json();
        if (geoData?.[0]) {
          updates.latitude = parseFloat(geoData[0].lat);
          updates.longitude = parseFloat(geoData[0].lon);
        }
      } catch {}
    }
  }

  const { error } = await supabase.from("Course").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
