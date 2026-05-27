import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Nightly safety-net for Upload.commentCount drift.
//
// The client-side comment submit paths do a read-modify-write:
//   SELECT Upload.commentCount → +1 → UPDATE
// If the UPDATE silently fails (network blip, RLS hiccup, ...) the
// Comment row still lands but the counter stays stale. The home feed
// then shows "0 comments" next to a visibly-commented clip — exactly
// the bug Jack Parodi's post hit on 2026-05-27.
//
// This route recomputes Upload.commentCount from COUNT(Comment) and
// writes back any drift. Idempotent. Wired to Vercel cron (see
// vercel.json) to run nightly.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Auth: either Vercel-cron signed header or our INTERNAL_API_SECRET
  // so it can be hit manually for ad-hoc resync.
  const auth = req.headers.get("authorization");
  const isCron = req.headers.get("x-vercel-cron") === "1";
  const ok = isCron || auth === `Bearer ${process.env.INTERNAL_API_SECRET}`;
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
    const PAGE = 1000;
    const out: T[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await sb.from(table).select(columns).range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      if (!data?.length) break;
      out.push(...(data as T[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return out;
  }

  const comments = await fetchAll<{ uploadId: string | null }>("Comment", "uploadId");
  const trueCount = new Map<string, number>();
  for (const c of comments) {
    if (!c.uploadId) continue;
    trueCount.set(c.uploadId, (trueCount.get(c.uploadId) ?? 0) + 1);
  }

  const uploads = await fetchAll<{ id: string; commentCount: number | null }>(
    "Upload", "id, commentCount"
  );

  let drift = 0;
  let updates = 0;
  const examples: { id: string; stored: number; trueCount: number }[] = [];
  for (const u of uploads) {
    const expected = trueCount.get(u.id) ?? 0;
    const stored = u.commentCount ?? 0;
    if (expected === stored) continue;
    drift++;
    if (examples.length < 10) examples.push({ id: u.id, stored, trueCount: expected });
    const { error } = await sb.from("Upload").update({ commentCount: expected }).eq("id", u.id);
    if (!error) updates++;
  }

  return NextResponse.json({
    ok: true,
    totalUploads: uploads.length,
    drift,
    updates,
    examples,
  });
}
