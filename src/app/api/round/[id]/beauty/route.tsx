import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

// 1080×1920 shareable beauty shot of an upcoming round. Strava-inspired
// composition: Tour It mark up top, cover photo as a rounded inset card,
// course identity + date/time + game block stacked beneath on the Tour It
// brand green. Fonts are bundled next to this file (variable .ttf). The Tour
// It logo lives in /public and is fetched at request time + inlined as a data
// URL so the edge function bundle stays under the 1MB compressed limit.

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function fmtTime12(t: string | null | undefined): string | null {
  if (!t) return null;
  const [hh, mm] = t.split(":").map(Number);
  if (Number.isNaN(hh)) return null;
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm ?? 0).padStart(2, "0")} ${period}`;
}

type Player = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  handicapIndex: number;
  courseHandicap?: number;
  netStrokes?: number;
  strokeHoles?: number[];
};

const W = 1080;
const H = 1920;
const FF_OUTFIT = "Outfit, sans-serif";
const FF_PLAYFAIR = "'Playfair Display', serif";

async function loadFonts() {
  try {
    const [playfair, outfit] = await Promise.all([
      fetch(new URL("./PlayfairDisplay.ttf", import.meta.url)).then(r => r.arrayBuffer()),
      fetch(new URL("./Outfit.ttf", import.meta.url)).then(r => r.arrayBuffer()),
    ]);
    return [
      { name: "Playfair Display", data: playfair, style: "normal" as const, weight: 900 as const },
      { name: "Outfit", data: outfit, style: "normal" as const, weight: 500 as const },
      { name: "Outfit", data: outfit, style: "normal" as const, weight: 700 as const },
    ];
  } catch {
    return [];
  }
}

// Pull the Tour It logo from /public at request time and inline as a data URL.
// Doing it here (rather than bundling next to the route) keeps us under the
// edge function's 1MB compressed bundle limit, and inlining as data: makes
// Satori render it deterministically (its own image fetch is flaky).
async function loadLogoDataUrl(origin: string): Promise<string | null> {
  try {
    const res = await fetch(`${origin}/tour-it-logo-full.png`);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64");
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}

function errorImage(message: string): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#07100a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, padding: 80, textAlign: "center", fontFamily: FF_OUTFIT }}>
        {message}
      </div>
    ),
    { width: W, height: H }
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const origin = new URL(req.url).origin;
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const [tripRes, tcRes, memberRes, gameRes, fonts, bundledLogo] = await Promise.all([
      sb.from("GolfTrip").select("id, name, startDate, endDate, imageUrl").eq("id", id).maybeSingle(),
      sb.from("GolfTripCourse").select("courseId, playDate, teeTime").eq("tripId", id),
      sb.from("GolfTripMember").select("userId").eq("tripId", id),
      sb.from("TripGame").select("format, players").eq("tripId", id).order("createdAt", { ascending: false }).limit(1),
      loadFonts(),
      loadLogoDataUrl(origin),
    ]);
    const trip = tripRes.data;
    const tcRows = tcRes.data;
    const memberRows = memberRes.data;
    const gameRows = gameRes.data;

    if (!trip || !tcRows || tcRows.length === 0) {
      return errorImage("Round not found");
    }

    const tc = tcRows[0];
    const { data: course } = await sb.from("Course").select("id, name, city, state, logoUrl, coverImageUrl").eq("id", tc.courseId).maybeSingle();
    const memberIds = (memberRows ?? []).map(m => m.userId);
    const { data: users } = await sb.from("User").select("id, username, displayName, avatarUrl").in("id", memberIds.length ? memberIds : [""]);

    const date = fmtDate(tc.playDate || trip.startDate);
    const teeTime = fmtTime12(tc.teeTime);

    const cover = trip.imageUrl || course?.coverImageUrl || null;
    const logo = course?.logoUrl || null;
    const courseName = course?.name ?? "Course";
    const courseLocation = [course?.city, course?.state].filter(Boolean).join(", ");
    const tourItLogo = bundledLogo ?? `${origin}/tour-it-logo-full.png`;

    const game = gameRows?.[0];
    const formatLabel = game
      ? (({ nassau: "Nassau", skins: "Skins", match: "Match Play", stroke: "Stroke Play" } as Record<string, string>)[game.format] ?? game.format.toUpperCase())
      : null;
    const players: Player[] = game && Array.isArray(game.players) ? (game.players as unknown as Player[]) : [];
    const golferAvatars = (users ?? []).slice(0, 8);

    // Auto-shrink course-name font for long titles so it always fits one line
    const courseNameSize = courseName.length > 32 ? 46 : courseName.length > 22 ? 54 : 62;

    return new ImageResponse(
      (
        <div style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          // Tour It brand green gradient with a soft top vignette — matches the
          // home page's safe-area-inset treatment but pushed deeper
          background: "linear-gradient(180deg, #1c4425 0%, #0a1d10 55%, #07100a 100%)",
          color: "#fff",
          fontFamily: FF_OUTFIT,
          padding: "70px 56px 56px",
        }}>

          {/* ════ TOP: Big Tour It wordmark + tagline ════ */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <img src={tourItLogo} alt="Tour It" style={{ height: 130, width: "auto" }} />
            <div style={{ display: "flex", fontSize: 18, letterSpacing: 8, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", fontWeight: 700 }}>
              Upcoming Round
            </div>
          </div>

          {/* ════ COVER CARD ════ */}
          <div style={{
            display: "flex", width: "100%", height: 620,
            marginTop: 36,
            borderRadius: 36,
            overflow: "hidden",
            position: "relative",
            boxShadow: "0 30px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
            background: "#0d1f12",
          }}>
            {cover ? (
              <img src={cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #2d7a42 0%, #1c4425 100%)" }} />
            )}
            {/* Bottom-fade scrim so the overlaid text reads */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 35%, rgba(7,16,10,0.72) 78%, rgba(7,16,10,0.95) 100%)" }} />

            {/* Top-left logo chip on the cover */}
            {logo && (
              <div style={{ position: "absolute", top: 24, left: 24, display: "flex", width: 92, height: 92, borderRadius: 20, background: "#fff", overflow: "hidden", boxShadow: "0 8px 20px rgba(0,0,0,0.5)" }}>
                <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}

            {/* Bottom — course identity */}
            <div style={{ position: "absolute", left: 32, right: 32, bottom: 28, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", fontFamily: FF_PLAYFAIR, fontSize: courseNameSize, fontWeight: 900, lineHeight: 1.04, color: "#fff" }}>{courseName}</div>
              {courseLocation && (
                <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.75)", fontWeight: 500, letterSpacing: 0.5 }}>{courseLocation}</div>
              )}
            </div>
          </div>

          {/* ════ DATE + TEE TIME ════ */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 36, gap: 6 }}>
            <div style={{ display: "flex", fontFamily: FF_PLAYFAIR, fontSize: 56, fontWeight: 900, lineHeight: 1, color: "#fff" }}>{date}</div>
            {teeTime && <div style={{ display: "flex", fontSize: 30, color: "#4da862", fontWeight: 700, marginTop: 8 }}>Tee off at {teeTime}</div>}
          </div>

          {/* ════ GAME or GOLFERS ════ */}
          {players.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 32, gap: 14 }}>
              <div style={{ display: "flex", fontSize: 18, letterSpacing: 6, color: "rgba(77,168,98,0.95)", textTransform: "uppercase", fontWeight: 700 }}>
                {formatLabel}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {players.slice(0, 4).map((p, i) => {
                  const strokes = p.netStrokes ?? p.courseHandicap ?? 0;
                  const sh = Array.isArray(p.strokeHoles) ? p.strokeHoles : [];
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, background: "rgba(255,255,255,0.04)", borderRadius: 18, padding: "14px 18px", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ width: 56, height: 56, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid rgba(255,255,255,0.15)" }}>
                        {p.avatarUrl
                          ? <img src={p.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: "#fff" }}>{(p.displayName || "?").slice(0, 1).toUpperCase()}</div>
                        }
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#fff" }}>{p.displayName}</div>
                          {strokes > 0 && (
                            <div style={{ display: "flex", fontSize: 18, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>
                              {strokes} {strokes === 1 ? "stroke" : "strokes"}
                            </div>
                          )}
                        </div>
                        {strokes === 0 ? (
                          <div style={{ display: "flex", fontSize: 17, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Plays scratch</div>
                        ) : sh.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                            {sh.slice(0, 12).map(h => (
                              <div key={h} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 6, background: "rgba(77,168,98,0.22)", border: "1px solid rgba(77,168,98,0.5)" }}>
                                <span style={{ display: "flex", fontSize: 15, fontWeight: 700, color: "#4da862" }}>{h}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            golferAvatars.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 32, gap: 14 }}>
                <div style={{ display: "flex", fontSize: 18, letterSpacing: 6, color: "rgba(77,168,98,0.95)", textTransform: "uppercase", fontWeight: 700 }}>Golfers</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {golferAvatars.map(u => (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.04)", borderRadius: 999, padding: "8px 22px 8px 8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ width: 48, height: 48, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(255,255,255,0.18)" }}>
                        {u.avatarUrl
                          ? <img src={u.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: "#fff" }}>{(u.displayName || u.username || "?").slice(0, 1).toUpperCase()}</div>
                        }
                      </div>
                      <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: "#fff" }}>{u.displayName || u.username}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Spacer pushes footer to the bottom */}
          <div style={{ display: "flex", flex: 1 }} />

          {/* ════ FOOTER ════ */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", fontSize: 18, letterSpacing: 5, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", fontWeight: 700 }}>
              Scout Before You Play · touritgolf.com
            </div>
          </div>
        </div>
      ),
      {
        width: W,
        height: H,
        fonts: fonts.length ? fonts : undefined,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  } catch (err) {
    console.error("Beauty shot render failed", err);
    return errorImage(`Render error: ${err instanceof Error ? err.message : "unknown"}`);
  }
}
