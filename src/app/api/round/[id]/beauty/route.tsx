import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

// 1080×1920 shareable beauty shot of an upcoming round. Vertical (Instagram
// Story / iMessage friendly), with the cover photo as the hero and a clean
// stack of date/tee-time + game breakdown + golfer avatars + real Tour It
// wordmark below. No stakes — per Corey's spec.

function abbr(name: string): string {
  return name.split(" ").filter(w => w.length > 2).map(w => w[0]).join("").slice(0, 3).toUpperCase() || "?";
}

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

type Player = { userId: string; displayName: string; avatarUrl: string | null; handicapIndex: number };
type HoleHC = { holeNumber: number; handicapRank: number };

function computeStrokes(players: Player[], holeHCs: HoleHC[], slope: number, rating: number, par: number) {
  if (!players.length) return [];
  const minHI = Math.min(...players.map(p => p.handicapIndex));
  return players.map(p => {
    const courseHcp = Math.round(p.handicapIndex * (slope / 113) + (rating - par));
    const minCourseHcp = Math.round(minHI * (slope / 113) + (rating - par));
    const strokes = Math.max(0, courseHcp - minCourseHcp);
    const sortedHoles = [...holeHCs].sort((a, b) => a.handicapRank - b.handicapRank);
    const strokeHoles: number[] = [];
    let remaining = strokes;
    for (let i = 0; i < sortedHoles.length && remaining > 0; i++) {
      strokeHoles.push(sortedHoles[i].holeNumber);
      remaining--;
    }
    return { ...p, strokes, strokeHoles: strokeHoles.sort((a, b) => a - b) };
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = new URL(req.url).origin;
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const [{ data: trip }, { data: tcRows }, { data: memberRows }, { data: gameRows }] = await Promise.all([
    sb.from("GolfTrip").select("id, name, startDate, endDate, imageUrl").eq("id", id).maybeSingle(),
    sb.from("GolfTripCourse").select("courseId, playDate, teeTime").eq("tripId", id),
    sb.from("GolfTripMember").select("userId").eq("tripId", id),
    sb.from("TripGame").select("format, formatConfig, players, holeHandicaps").eq("tripId", id).order("createdAt", { ascending: false }).limit(1),
  ]);

  if (!trip || !tcRows || tcRows.length === 0) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", background: "#07100a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>
          Round not found
        </div>
      ),
      { width: 1080, height: 1920 }
    );
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

  // Compute per-player strokes if a game exists with handicap data
  const game = gameRows?.[0];
  let strokeBreakdown: Array<{ name: string; strokes: number; strokeHoles: number[]; avatarUrl: string | null }> = [];
  let gameLabel: string | null = null;
  if (game && Array.isArray(game.players) && (game.players as unknown as Player[]).length > 0) {
    const players = game.players as unknown as Player[];
    const holeHCs = (game.holeHandicaps as unknown as HoleHC[] | null) ?? [];
    const cfg = (game.formatConfig as unknown as { slope?: number; rating?: number; par?: number }) ?? {};
    const slope = cfg.slope ?? 113;
    const rating = cfg.rating ?? 72;
    const par = cfg.par ?? 72;
    const formatName = ({ nassau: "Nassau", skins: "Skins", match: "Match Play", stroke: "Stroke Play" } as Record<string, string>)[game.format] ?? game.format.toUpperCase();
    gameLabel = formatName;
    if (holeHCs.length > 0) {
      strokeBreakdown = computeStrokes(players, holeHCs, slope, rating, par).map(p => ({
        name: p.displayName,
        strokes: p.strokes,
        strokeHoles: p.strokeHoles,
        avatarUrl: p.avatarUrl,
      }));
    } else {
      strokeBreakdown = players.map(p => ({ name: p.displayName, strokes: 0, strokeHoles: [], avatarUrl: p.avatarUrl }));
    }
  }

  const golferAvatars = (users ?? []).slice(0, 8);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#07100a", color: "#fff" }}>

        {/* ════════ HERO: Cover photo with overlaid course identity (40% of canvas) ════════ */}
        <div style={{ position: "relative", display: "flex", width: "100%", height: 820 }}>
          {cover ? (
            <img src={cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #1c4425 0%, #07100a 100%)" }} />
          )}
          {/* Bottom-fading dark scrim so the overlaid text is legible */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,16,10,0.25) 0%, rgba(7,16,10,0.30) 40%, rgba(7,16,10,0.95) 100%)" }} />

          {/* Top-right small Tour It mark */}
          <div style={{ position: "absolute", top: 44, right: 56, display: "flex", alignItems: "center", gap: 12 }}>
            <img src={tourItLogo} alt="" style={{ height: 56, width: "auto" }} />
          </div>

          {/* Bottom-left overlay: logo + course name + city */}
          <div style={{ position: "absolute", left: 56, right: 56, bottom: 56, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "rgba(255,255,255,0.78)", textTransform: "uppercase", fontWeight: 700 }}>Upcoming Round</div>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              {logo && (
                <div style={{ width: 110, height: 110, borderRadius: 24, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 64, fontWeight: 900, lineHeight: 1.02, maxWidth: 880 }}>{courseName}</div>
                {courseLocation && <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,0.65)", marginTop: 8 }}>{courseLocation}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* ════════ BODY ════════ */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "48px 56px", gap: 40 }}>

          {/* Date + tee time */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", fontWeight: 700 }}>When</div>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 900, lineHeight: 1, marginTop: 6 }}>{date}</div>
            {teeTime && <div style={{ display: "flex", fontSize: 36, color: "#4da862", fontWeight: 800, marginTop: 12 }}>Tee off at {teeTime}</div>}
          </div>

          {/* Game breakdown (only if there's a game) */}
          {strokeBreakdown.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "rgba(77,168,98,0.95)", textTransform: "uppercase", fontWeight: 700 }}>
                {gameLabel}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {strokeBreakdown.slice(0, 5).map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid rgba(255,255,255,0.18)" }}>
                      {p.avatarUrl
                        ? <img src={p.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ display: "flex", fontSize: 22, fontWeight: 800, color: "#fff" }}>{(p.name || "?").slice(0, 1).toUpperCase()}</div>
                      }
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: "#fff" }}>{p.name}</div>
                      {p.strokes === 0
                        ? <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>Plays scratch</div>
                        : <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.78)", marginTop: 2 }}>
                            {p.strokes} {p.strokes === 1 ? "stroke" : "strokes"}
                            {p.strokeHoles.length > 0 && p.strokeHoles.length <= 10 && (
                              <span style={{ color: "rgba(255,255,255,0.45)", marginLeft: 10 }}>· holes {p.strokeHoles.join(", ")}</span>
                            )}
                          </div>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // No game yet — show golfer roster on its own
            golferAvatars.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "rgba(77,168,98,0.95)", textTransform: "uppercase", fontWeight: 700 }}>
                  Golfers
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                  {golferAvatars.map(u => (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.04)", borderRadius: 999, padding: "10px 22px 10px 10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ width: 56, height: 56, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(255,255,255,0.18)" }}>
                        {u.avatarUrl
                          ? <img src={u.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ display: "flex", fontSize: 22, fontWeight: 800, color: "#fff" }}>{(u.displayName || u.username || "?").slice(0, 1).toUpperCase()}</div>
                        }
                      </div>
                      <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#fff" }}>{u.displayName || u.username}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Spacer pushes the footer down */}
          <div style={{ display: "flex", flex: 1 }} />

          {/* Footer — full Tour It wordmark + tagline */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24 }}>
            <img src={tourItLogo} alt="Tour It" style={{ height: 64, width: "auto" }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ display: "flex", fontSize: 18, color: "rgba(255,255,255,0.5)", letterSpacing: 4, textTransform: "uppercase", fontWeight: 700 }}>Scout Before You Play</div>
              <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.85)", fontWeight: 700, marginTop: 4 }}>touritgolf.com</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 }
  );
}
