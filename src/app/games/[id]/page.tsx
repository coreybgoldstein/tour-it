"use client";

/**
 * Dedicated game page.
 *
 * Lives at /games/[id]. Users land here right after creating a game
 * via the unified CreateGameSheet (2026-05-24 refactor) and from
 * GameCard taps in the Tee-Up Games tab. The page reads a TripGame
 * row and surfaces enough context — format, stakes, players, course
 * — that the user can confirm what they just set up.
 *
 * Score entry, winner declaration, and the full game scoreboard
 * continue to live on the trip page so we don't have to duplicate
 * that complex UI. A "Open scoreboard" CTA pushes users to the trip
 * page with `?game=<id>` so the right game card is in view.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import BackButton from "@/components/BackButton";
import { gameFormatLabel } from "@/lib/gameFormats";
import { cdnImage } from "@/lib/cdnImage";

type GameRow = {
  id: string;
  tripId: string;
  courseId: string;
  courseName: string;
  format: string;
  formatConfig: {
    frontAmount?: string;
    backAmount?: string;
    totalAmount?: string;
    skinsAmount?: string;
    wager?: number;
    holes?: number[];
    stake?: number;
    winner?: string | null;
    winners?: Record<string, string>;
  } | null;
  players: Array<{ userId: string; displayName: string; avatarUrl: string | null; handicapIndex: number; teamId: string }>;
  shareText: string | null;
  createdAt: string;
};

type TripRow = {
  id: string;
  name: string;
  startDate: string | null;
};

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const gameId = params?.id as string;

  const [game, setGame] = useState<GameRow | null>(null);
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [courseLogoUrl, setCourseLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("TripGame")
        .select("id, tripId, courseId, courseName, format, formatConfig, players, shareText, createdAt")
        .eq("id", gameId)
        .single();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Membership gate — anyone with a game id could previously
      // read stakes + players (audit 2026-05-25). A user must be a
      // GolfTripMember on the underlying trip to see the page.
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!authUser) {
        router.replace(`/login?next=/games/${gameId}`);
        return;
      }
      const { data: membership } = await supabase
        .from("GolfTripMember")
        .select("id")
        .eq("tripId", (data as { tripId: string }).tripId)
        .eq("userId", authUser.id)
        .maybeSingle();
      if (cancelled) return;
      if (!membership) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setGame(data as GameRow);

      const [{ data: tripData }, { data: courseData }] = await Promise.all([
        supabase.from("GolfTrip").select("id, name, startDate").eq("id", data.tripId).single(),
        supabase.from("Course").select("logoUrl").eq("id", data.courseId).single(),
      ]);
      if (cancelled) return;
      if (tripData) setTrip(tripData as TripRow);
      if (courseData) setCourseLogoUrl((courseData as { logoUrl: string | null }).logoUrl);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [gameId, router]);

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={{ padding: 40, color: "rgba(255,255,255,0.4)", fontFamily: "'Outfit', sans-serif", fontSize: 13, textAlign: "center" }}>Loading…</div>
        <BottomNav />
      </main>
    );
  }

  if (notFound || !game) {
    return (
      <main style={pageStyle}>
        <div style={{ padding: "60px 24px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 8 }}>Game not found</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 20 }}>This game may have been deleted or the link is incorrect.</div>
          <button onClick={() => router.push("/tee-up")} style={primaryBtnStyle}>Back to Tee Up</button>
        </div>
        <BottomNav />
      </main>
    );
  }

  const formatLabel = gameFormatLabel(game.format);
  const cfg = game.formatConfig ?? {};
  const stakesLine = (() => {
    if (game.format === "nassau") return `$${cfg.frontAmount ?? "?"} / $${cfg.backAmount ?? "?"} / $${cfg.totalAmount ?? "?"}`;
    if (game.format === "skins") return `$${cfg.skinsAmount ?? "?"} / skin`;
    if (game.format === "best_ball") return cfg.wager ? `$${cfg.wager} / team` : "No stakes set";
    if (game.format === "closest_to_pin" || game.format === "longest_drive") {
      const holes = cfg.holes ?? [];
      const stake = cfg.stake ?? 0;
      const h = holes.length === 0 ? "" : holes.length === 1 ? `Hole ${holes[0]}` : `${holes.length} holes`;
      return `${h}${stake > 0 ? ` · $${stake}/hole` : ""}`;
    }
    return "";
  })();

  const dateLabel = trip?.startDate
    ? new Date(trip.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <main style={pageStyle}>
      <div style={{ padding: "24px 20px 100px", maxWidth: 520, margin: "0 auto" }}>
        {/* Back chip — falls back to the parent trip on cold deep-link open */}
        <div style={{ marginBottom: 16 }}>
          <BackButton label="Back" fallback={`/trips/${game.tripId}`} />
        </div>

        {/* Hero card — mirrors GameCard's active treatment */}
        <div style={{
          background: "linear-gradient(135deg, rgba(77,168,98,0.18) 0%, rgba(45,122,66,0.08) 100%)",
          border: "1px solid rgba(77,168,98,0.4)",
          borderRadius: 18,
          padding: "18px 18px 16px",
          marginBottom: 18,
          boxShadow: "0 6px 24px rgba(0,0,0,0.28)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: courseLogoUrl ? "#fff" : "rgba(77,168,98,0.15)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {courseLogoUrl
                ? <img src={cdnImage(courseLogoUrl)} alt={game.courseName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.6"><path d="M4 21h16M12 15V2"/></svg>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)", marginBottom: 3 }}>
                Game{dateLabel ? ` · ${dateLabel}` : ""}
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>{formatLabel}</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>
                {game.courseName}{stakesLine ? ` · ` : ""}<span style={{ color: "#4da862", fontWeight: 600 }}>{stakesLine}</span>
              </div>
            </div>
          </div>

          {/* Players */}
          <div style={{ paddingTop: 12, borderTop: "1px solid rgba(77,168,98,0.2)" }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>
              Players · {game.players.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {game.players.map(p => (
                <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", background: "rgba(77,168,98,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {p.avatarUrl
                      ? <img src={cdnImage(p.avatarUrl)} alt={p.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>}
                  </div>
                  <div style={{ flex: 1, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff" }}>{p.displayName}</div>
                  {game.players.length === 2 && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#4da862", background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 99, padding: "1px 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Team {p.teamId}
                    </div>
                  )}
                  {p.handicapIndex !== 0 && (
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                      HI {p.handicapIndex}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Open scoreboard CTA — score entry + winner declaration lives
            on the trip page where the full scoreboard UI already
            exists. Deep-link with ?game=<id> so the trip page can
            scroll the right game card into view. */}
        <button
          onClick={() => router.push(`/trips/${game.tripId}?game=${game.id}`)}
          style={primaryBtnStyle}
        >
          Open Scoreboard
        </button>
        <button
          onClick={() => router.push(`/trips/${game.tripId}`)}
          style={{ ...secondaryBtnStyle, marginTop: 10 }}
        >
          View Round
        </button>
      </div>
      <BottomNav />
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100svh",
  background: "#07100a",
  color: "#fff",
  paddingTop: "calc(env(safe-area-inset-top) + 12px)",
};

const primaryBtnStyle: React.CSSProperties = {
  width: "100%",
  background: "#2d7a42",
  border: "none",
  borderRadius: 12,
  padding: "14px",
  fontFamily: "'Outfit', sans-serif",
  fontSize: 14,
  fontWeight: 700,
  color: "#fff",
  cursor: "pointer",
  boxShadow: "0 2px 12px rgba(45,122,66,0.4)",
};

const secondaryBtnStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  padding: "13px",
  fontFamily: "'Outfit', sans-serif",
  fontSize: 14,
  fontWeight: 600,
  color: "rgba(255,255,255,0.85)",
  cursor: "pointer",
};
