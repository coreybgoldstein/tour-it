import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

// Returns a 1200×630 shareable PNG for an upcoming-round trip.
// Renders course logo + course name + date + tee time + game format + each
// player's strokes (with the specific hole numbers they get a stroke on) over
// the round's cover photo. No stakes — per Corey's spec.

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

function computeStrokesPerHole(players: Player[], holeHCs: HoleHC[], slope: number, rating: number, par: number) {
  if (!players.length) return [];
  const minHI = Math.min(...players.map(p => p.handicapIndex));
  // Course handicap = round(HI * slope/113 + (rating - par)). Strokes given is the delta from the minimum course handicap.
  const ranksByHole = new Map(holeHCs.map(h => [h.holeNumber, h.handicapRank]));
  return players.map(p => {
    const courseHcp = Math.round(p.handicapIndex * (slope / 113) + (rating - par));
    const minCourseHcp = Math.round(minHI * (slope / 113) + (rating - par));
    const strokes = Math.max(0, courseHcp - minCourseHcp);
    const sortedHoles = [...holeHCs].sort((a, b) => a.handicapRank - b.handicapRank);
    const strokeHoles: number[] = [];
    let remaining = strokes;
    // First pass: assign one stroke per hole in handicap-rank order
    for (let i = 0; i < sortedHoles.length && remaining > 0; i++) {
      strokeHoles.push(sortedHoles[i].holeNumber);
      remaining--;
    }
    // Second pass (rare): if strokes > 18, double up on the hardest holes — skip rendering, just count
    return { ...p, strokes, strokeHoles: strokeHoles.sort((a, b) => a - b) };
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
        <div style={{ width: "100%", height: "100%", background: "#07100a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>
          Round not found
        </div>
      ),
      { width: 1200, height: 630 }
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
      strokeBreakdown = computeStrokesPerHole(players, holeHCs, slope, rating, par).map(p => ({
        name: p.displayName,
        strokes: p.strokes,
        strokeHoles: p.strokeHoles,
        avatarUrl: p.avatarUrl,
      }));
    } else {
      strokeBreakdown = players.map(p => ({ name: p.displayName, strokes: 0, strokeHoles: [], avatarUrl: p.avatarUrl }));
    }
  }

  // Avatars row (golfers in the trip) — fall back to abbreviated initials when no avatar.
  const golferAvatars = (users ?? []).slice(0, 6);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", color: "#fff", background: "#0b140e" }}>
        {/* Cover background */}
        {cover && (
          <img src={cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {/* Tour It signature green gradient when no cover, plus dark scrim either way for legibility */}
        {!cover && (
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #1c4425 0%, #07100a 100%)" }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,16,10,0.35) 0%, rgba(7,16,10,0.85) 60%, rgba(7,16,10,0.95) 100%)" }} />

        {/* Foreground content */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", padding: "44px 56px", justifyContent: "space-between" }}>
          {/* Top — logo + course */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 78, height: 78, borderRadius: 16, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              {logo
                ? <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ display: "flex", fontFamily: "serif", fontSize: 28, fontWeight: 900, color: "#1c4425" }}>{abbr(courseName)}</div>
              }
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 18, letterSpacing: 4, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", fontWeight: 700 }}>Upcoming Round</div>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 900, lineHeight: 1.05, marginTop: 4, maxWidth: 880 }}>{courseName}</div>
              {courseLocation && <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>{courseLocation}</div>}
            </div>
          </div>

          {/* Middle — date + tee time */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", fontSize: 56, fontWeight: 900, lineHeight: 1 }}>{date}</div>
            {teeTime && <div style={{ display: "flex", fontSize: 28, color: "#4da862", fontWeight: 700, marginTop: 4 }}>Tee off at {teeTime}</div>}
          </div>

          {/* Game breakdown (only if there's a game with players) */}
          {strokeBreakdown.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", fontSize: 18, letterSpacing: 4, color: "rgba(77,168,98,0.95)", textTransform: "uppercase", fontWeight: 700 }}>
                {gameLabel}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {strokeBreakdown.slice(0, 6).map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "#fff", minWidth: 200 }}>{p.name}</div>
                    {p.strokes === 0
                      ? <div style={{ display: "flex", fontSize: 20, color: "rgba(255,255,255,0.55)" }}>Plays scratch</div>
                      : <div style={{ display: "flex", fontSize: 20, color: "rgba(255,255,255,0.85)" }}>
                          {p.strokes} {p.strokes === 1 ? "stroke" : "strokes"}
                          {p.strokeHoles.length > 0 && p.strokeHoles.length <= 12 && (
                            <span style={{ color: "rgba(255,255,255,0.45)", marginLeft: 8 }}>· holes {p.strokeHoles.join(", ")}</span>
                          )}
                        </div>
                    }
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // No game yet — show golfer roster
            golferAvatars.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", fontSize: 18, letterSpacing: 4, color: "rgba(77,168,98,0.95)", textTransform: "uppercase", fontWeight: 700 }}>
                  Golfers
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  {golferAvatars.map((u, i) => (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 56, height: 56, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
                        {u.avatarUrl
                          ? <img src={u.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ display: "flex", fontSize: 18, fontWeight: 700, color: "#fff" }}>{(u.displayName || u.username || "?").slice(0, 1).toUpperCase()}</div>
                        }
                      </div>
                      {i < 2 && <div style={{ display: "flex", fontSize: 18, color: "rgba(255,255,255,0.7)" }}>{u.displayName || u.username}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Footer — Tour It wordmark */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", width: 32, height: 32, borderRadius: 8, background: "#4da862", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#07100a" }}>T</div>
              <div style={{ display: "flex", fontSize: 22, fontWeight: 800, color: "rgba(255,255,255,0.85)", letterSpacing: 2 }}>TOUR IT</div>
            </div>
            <div style={{ display: "flex", fontSize: 16, color: "rgba(255,255,255,0.45)" }}>touritgolf.com</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
