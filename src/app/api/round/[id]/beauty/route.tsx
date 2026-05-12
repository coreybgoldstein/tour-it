import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

// 1080×1920 shareable beauty shot of an upcoming round. Vertical for IG Story /
// iMessage / SMS native ratio. System fonts for now (the prior runtime font-
// fetch from Google Fonts was failing on Vercel edge and silently returning a
// 0-byte response — iMessage rendered that as an un-previewable PNG icon).
// We'll re-add brand fonts once we bundle the .ttf files locally.

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

function errorImage(message: string): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#07100a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, padding: 80, textAlign: "center" }}>
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

    const [tripRes, tcRes, memberRes, gameRes] = await Promise.all([
      sb.from("GolfTrip").select("id, name, startDate, endDate, imageUrl").eq("id", id).maybeSingle(),
      sb.from("GolfTripCourse").select("courseId, playDate, teeTime").eq("tripId", id),
      sb.from("GolfTripMember").select("userId").eq("tripId", id),
      sb.from("TripGame").select("format, players").eq("tripId", id).order("createdAt", { ascending: false }).limit(1),
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
    const tourItLogo = `${origin}/tour-it-logo-full.png`;

    const game = gameRows?.[0];
    const formatLabel = game
      ? (({ nassau: "Nassau", skins: "Skins", match: "Match Play", stroke: "Stroke Play" } as Record<string, string>)[game.format] ?? game.format.toUpperCase())
      : null;
    const players: Player[] = game && Array.isArray(game.players) ? (game.players as unknown as Player[]) : [];

    const golferAvatars = (users ?? []).slice(0, 8);

    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#07100a", color: "#fff" }}>

          {/* ════ HERO COVER (top 720px) ════ */}
          <div style={{ position: "relative", display: "flex", width: "100%", height: 720 }}>
            {cover ? (
              <img src={cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #1c4425 0%, #07100a 100%)" }} />
            )}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,16,10,0.25) 0%, rgba(7,16,10,0.30) 40%, rgba(7,16,10,0.95) 100%)" }} />

            <div style={{ position: "absolute", top: 44, right: 56, display: "flex" }}>
              <img src={tourItLogo} alt="" style={{ height: 60, width: "auto" }} />
            </div>

            <div style={{ position: "absolute", left: 56, right: 56, bottom: 56, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "rgba(255,255,255,0.78)", textTransform: "uppercase", fontWeight: 700 }}>Upcoming Round</div>
              <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                {logo && (
                  <div style={{ width: 110, height: 110, borderRadius: 24, background: "#fff", display: "flex", overflow: "hidden", flexShrink: 0 }}>
                    <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", fontSize: 66, fontWeight: 900, lineHeight: 1.02, maxWidth: 820 }}>{courseName}</div>
                  {courseLocation && <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,0.65)", marginTop: 8 }}>{courseLocation}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* ════ BODY ════ */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "48px 56px", gap: 40 }}>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", fontWeight: 700 }}>When</div>
              <div style={{ display: "flex", fontSize: 76, fontWeight: 900, lineHeight: 1, marginTop: 8 }}>{date}</div>
              {teeTime && <div style={{ display: "flex", fontSize: 38, color: "#4da862", fontWeight: 700, marginTop: 16 }}>Tee off at {teeTime}</div>}
            </div>

            {players.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "rgba(77,168,98,0.95)", textTransform: "uppercase", fontWeight: 700 }}>
                  {formatLabel}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {players.slice(0, 5).map((p, i) => {
                    const strokes = p.netStrokes ?? p.courseHandicap ?? 0;
                    const sh = Array.isArray(p.strokeHoles) ? p.strokeHoles : [];
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 22 }}>
                        <div style={{ width: 64, height: 64, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid rgba(255,255,255,0.18)" }}>
                          {p.avatarUrl
                            ? <img src={p.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#fff" }}>{(p.displayName || "?").slice(0, 1).toUpperCase()}</div>
                          }
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                            <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: "#fff" }}>{p.displayName}</div>
                            {strokes > 0 && (
                              <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>
                                {strokes} {strokes === 1 ? "stroke" : "strokes"}
                              </div>
                            )}
                          </div>
                          {strokes === 0 ? (
                            <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>Plays scratch</div>
                          ) : sh.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                              {sh.map(h => (
                                <div key={h} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 8, background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.45)" }}>
                                  <span style={{ display: "flex", fontSize: 18, fontWeight: 700, color: "#4da862" }}>{h}</span>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "rgba(77,168,98,0.95)", textTransform: "uppercase", fontWeight: 700 }}>Golfers</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                    {golferAvatars.map(u => (
                      <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.04)", borderRadius: 999, padding: "10px 22px 10px 10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ width: 56, height: 56, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(255,255,255,0.18)" }}>
                          {u.avatarUrl
                            ? <img src={u.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: "#fff" }}>{(u.displayName || u.username || "?").slice(0, 1).toUpperCase()}</div>
                          }
                        </div>
                        <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#fff" }}>{u.displayName || u.username}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            <div style={{ display: "flex", flex: 1 }} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 26 }}>
              <img src={tourItLogo} alt="Tour It" style={{ height: 64, width: "auto" }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ display: "flex", fontSize: 18, color: "rgba(255,255,255,0.5)", letterSpacing: 4, textTransform: "uppercase", fontWeight: 700 }}>Scout Before You Play</div>
                <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.85)", fontWeight: 700, marginTop: 4 }}>touritgolf.com</div>
              </div>
            </div>
          </div>
        </div>
      ),
      { width: W, height: H }
    );
  } catch (err) {
    // Edge runtime swallows uncaught errors and returns 0 bytes — surface them
    // explicitly so any future regression isn't invisible to the user.
    console.error("Beauty shot render failed", err);
    return errorImage(`Render error: ${err instanceof Error ? err.message : "unknown"}`);
  }
}
