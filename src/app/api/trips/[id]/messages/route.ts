import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function sb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getAuthedUser() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  return user;
}

async function getDbUser(email: string) {
  const { data } = await sb().from("User").select("id").eq("email", email).single();
  return data;
}

async function isMember(tripId: string, userId: string): Promise<boolean> {
  const { data } = await sb().from("GolfTripMember").select("id").eq("tripId", tripId).eq("userId", userId).maybeSingle();
  return !!data;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthedUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getDbUser(user.email);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isMember(id, dbUser.id))) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data: messages } = await sb()
    .from("TripMessage")
    .select("id, body, createdAt, userId")
    .eq("tripId", id)
    .order("createdAt", { ascending: true })
    .limit(200);

  if (!messages || messages.length === 0) return NextResponse.json({ messages: [] });

  const userIds = [...new Set(messages.map((m: any) => m.userId))];
  const { data: users } = await sb()
    .from("User")
    .select("id, displayName, avatarUrl")
    .in("id", userIds);

  const userMap = Object.fromEntries((users || []).map((u: any) => [u.id, u]));
  const enriched = messages.map((m: any) => ({
    ...m,
    user: userMap[m.userId] || { id: m.userId, displayName: "Golfer", avatarUrl: null },
  }));

  return NextResponse.json({ messages: enriched });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthedUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getDbUser(user.email);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isMember(id, dbUser.id))) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  const msgId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error } = await sb().from("TripMessage").insert({
    id: msgId,
    tripId: id,
    userId: dbUser.id,
    body: body.trim(),
    createdAt: now,
    updatedAt: now,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: userData } = await sb()
    .from("User")
    .select("id, displayName, avatarUrl")
    .eq("id", dbUser.id)
    .single();

  return NextResponse.json({
    message: {
      id: msgId,
      body: body.trim(),
      createdAt: now,
      userId: dbUser.id,
      user: userData || { id: dbUser.id, displayName: "Golfer", avatarUrl: null },
    },
  });
}
