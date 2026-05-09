import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE = "tour_it_referral";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: NextRequest) {
  const { inviterId } = await req.json();
  if (!inviterId || typeof inviterId !== "string") {
    return NextResponse.json({ error: "Missing inviterId" }, { status: 400 });
  }

  const jar = await cookies();
  const existing = jar.get(COOKIE);

  // First-touch wins — never overwrite an existing referral cookie
  if (existing) {
    return NextResponse.json({ ok: true, set: false });
  }

  jar.set(COOKIE, inviterId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });

  return NextResponse.json({ ok: true, set: true });
}
