import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const swLat = parseFloat(searchParams.get("swLat") ?? "");
  const swLng = parseFloat(searchParams.get("swLng") ?? "");
  const neLat = parseFloat(searchParams.get("neLat") ?? "");
  const neLng = parseFloat(searchParams.get("neLng") ?? "");

  if ([swLat, swLng, neLat, neLng].some(isNaN)) {
    return NextResponse.json({ error: "Invalid bounds" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("Course")
    .select("id, name, city, state, latitude, longitude, uploadCount, coverImageUrl, logoUrl, isPublic")
    .gte("latitude", swLat)
    .lte("latitude", neLat)
    .gte("longitude", swLng)
    .lte("longitude", neLng)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("uploadCount", { ascending: false })
    .limit(60);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
