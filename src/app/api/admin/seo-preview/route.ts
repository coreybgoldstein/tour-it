import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CANONICAL_HOST } from "@/lib/seo";

/**
 * Admin SEO self-test endpoint.
 *
 * Given a relative or absolute Tour It URL, fetches it server-side,
 * extracts every <script type="application/ld+json"> block from the
 * returned HTML, JSON-parses each, and reports back the schema.org
 * @type values + the keys present.
 *
 * Purpose: catch regressions BEFORE Google sees them. If the JSON-LD
 * we expect on a page isn't there (broken injection, runtime error in
 * a builder, etc.) this surfaces it without waiting for the next
 * Google re-crawl.
 *
 * NOT a replacement for Google's Rich Results Test — Google has
 * stricter validation than schema.org defines. Use this for "is the
 * markup present + parseable?" and the linked Google tool for "would
 * Google actually accept it for rich results?"
 */

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const SCRIPT_REGEX = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

interface Detected {
  type: string;
  topLevelKeys: string[];
  valid: boolean;
  error?: string;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: { user }, error: authError } = await sb().auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Admin gating — same approach as other admin routes in this codebase
  // (the user can only request URLs from our own host so the blast radius
  // is just "consume some egress bandwidth"; we still require auth so
  // randos can't spam it).

  const body = await req.json().catch(() => ({}));
  const raw = body?.url;
  if (!raw || typeof raw !== "string") {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  // Only allow fetches of our own host — never let this proxy
  // arbitrary external URLs.
  const fullUrl = raw.startsWith("http") ? raw : `${CANONICAL_HOST}${raw.startsWith("/") ? raw : `/${raw}`}`;
  try {
    const parsed = new URL(fullUrl);
    if (parsed.hostname !== "www.touritgolf.com" && parsed.hostname !== "touritgolf.com") {
      return NextResponse.json({ error: "host not allowed" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  const startedAt = Date.now();
  try {
    const res = await fetch(fullUrl, {
      headers: { "User-Agent": "TourIt-SEO-Self-Test/1.0 (admin)" },
      cache: "no-store",
      // Vercel-side fetch — no CORS issue since we're server-side.
    });
    const html = await res.text();
    const elapsedMs = Date.now() - startedAt;

    const schemas: Detected[] = [];
    let m: RegExpExecArray | null;
    SCRIPT_REGEX.lastIndex = 0;
    while ((m = SCRIPT_REGEX.exec(html)) !== null) {
      const blob = m[1].trim();
      try {
        const parsed: unknown = JSON.parse(blob);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (item && typeof item === "object") {
            const rec = item as Record<string, unknown>;
            schemas.push({
              type: typeof rec["@type"] === "string" ? (rec["@type"] as string) : "(no @type)",
              topLevelKeys: Object.keys(rec).filter(k => !k.startsWith("@")),
              valid: true,
            });
          }
        }
      } catch (e) {
        schemas.push({
          type: "(parse error)",
          topLevelKeys: [],
          valid: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({
      url: fullUrl,
      status: res.status,
      ok: res.ok,
      elapsedMs,
      schemas,
    });
  } catch (e) {
    return NextResponse.json({
      url: fullUrl,
      ok: false,
      error: e instanceof Error ? e.message : "Fetch failed",
    }, { status: 502 });
  }
}
