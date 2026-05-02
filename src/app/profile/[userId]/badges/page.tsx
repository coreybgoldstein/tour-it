"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import type { EarnedBadge } from "@/types/badges";

const BADGE_ORDER = [
  "first_clip", "5_clips", "10_clips", "25_clips", "50_clips", "100_clips",
  "course_pioneer", "hole_trailblazer",
  "5_courses", "10_courses", "25_courses",
  "popular_clip", "viral_clip", "legendary_clip",
  "10_followers", "100_followers",
];

const BADGE_EMOJI: Record<string, string> = {
  first_clip: "🎬", "5_clips": "📹", "10_clips": "🎯", "25_clips": "⭐",
  "50_clips": "🏅", "100_clips": "👑", course_pioneer: "🚩",
  hole_trailblazer: "🕳️", "5_courses": "🗺️", "10_courses": "🚗",
  "25_courses": "✈️", popular_clip: "🔥", viral_clip: "💫",
  legendary_clip: "⚡", "10_followers": "👥", "100_followers": "🌟",
};

const RARITY_COLOR: Record<string, string> = {
  COMMON: "rgba(210,210,210,0.6)",
  UNCOMMON: "#4da862",
  RARE: "#60a5fa",
  EPIC: "#a78bfa",
  LEGENDARY: "#fbbf24",
};

const RARITY_GLOW: Record<string, string> = {
  COMMON:    "rgba(200,200,200,0.2)",
  UNCOMMON:  "rgba(77,168,98,0.4)",
  RARE:      "rgba(96,165,250,0.4)",
  EPIC:      "rgba(167,139,250,0.45)",
  LEGENDARY: "rgba(251,191,36,0.6)",
};

type CatalogBadge = { id: string; slug: string; name: string; description: string; category: string; rarity: string };

export default function BadgesPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();

  const [catalog, setCatalog] = useState<CatalogBadge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [selected, setSelected] = useState<{ catalog: CatalogBadge; earned: EarnedBadge | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("Badge").select("id, slug, name, description, category, rarity"),
      supabase.from("UserBadge").select("id, awardedAt, badge:badgeId(slug, name, description, category, rarity)").eq("userId", userId),
    ]).then(([{ data: catalogData }, { data: badgesData }]) => {
      if (catalogData) {
        const sorted = [...catalogData].sort((a, b) => {
          const ia = BADGE_ORDER.indexOf(a.slug);
          const ib = BADGE_ORDER.indexOf(b.slug);
          return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
        });
        setCatalog(sorted);
      }
      if (badgesData) setEarnedBadges(badgesData as unknown as EarnedBadge[]);
      setLoading(false);
    });
  }, [userId]);

  const earnedBySlug = new Map(earnedBadges.map(eb => [eb.badge.slug, eb]));
  const earnedCount = earnedBadges.length;

  function openBadge(badge: CatalogBadge) {
    setSelected({ catalog: badge, earned: earnedBySlug.get(badge.slug) ?? null });
  }

  return (
    <div style={{ minHeight: "100svh", background: "#07100a", color: "#fff", paddingBottom: 80 }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 12px", position: "sticky", top: 0, background: "#07100a", zIndex: 10, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Badges</div>
          {!loading && (
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
              {earnedCount} of {catalog.length} earned
            </div>
          )}
        </div>
      </div>

      {/* Badge grid */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Loading...</div>
        </div>
      ) : (
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {catalog.map(badge => {
              const earned = earnedBySlug.get(badge.slug);
              const emoji = BADGE_EMOJI[badge.slug] || "🏆";
              const glow = RARITY_GLOW[badge.rarity] || "rgba(218,165,32,0.25)";
              return (
                <div
                  key={badge.slug}
                  onClick={() => openBadge(badge)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                  }}
                >
                  <div style={{
                    width: "100%",
                    aspectRatio: "1.4 / 1",
                    borderRadius: 7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: earned
                      ? "linear-gradient(145deg, #7a5008 0%, #b07818 20%, #d4a030 45%, #b07818 70%, #7a5008 100%)"
                      : "linear-gradient(145deg, #0d1f12 0%, #111a0f 55%, #0d1f12 100%)",
                    border: earned
                      ? "1px solid rgba(218,168,30,0.7)"
                      : "1px solid rgba(255,255,255,0.06)",
                    boxShadow: earned
                      ? `0 2px 8px rgba(0,0,0,0.5), 0 0 10px ${glow}, inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.25)`
                      : "inset 0 2px 4px rgba(0,0,0,0.4)",
                  }}>
                    {earned
                      ? <span style={{ fontSize: 22, lineHeight: 1, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>{emoji}</span>
                      : <span style={{ fontSize: 20, lineHeight: 1, opacity: 0.12 }}>{emoji}</span>
                    }
                  </div>
                  <div style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 9,
                    fontWeight: 600,
                    color: earned ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)",
                    textAlign: "center",
                    lineHeight: 1.3,
                    letterSpacing: "0.01em",
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {badge.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Badge detail sheet */}
      {selected && (() => {
        const { catalog: badge, earned } = selected;
        const color = RARITY_COLOR[badge.rarity] || "rgba(210,210,210,0.6)";
        const emoji = BADGE_EMOJI[badge.slug] || "🏆";
        return (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={() => setSelected(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#0d2318", borderRadius: "24px 24px 0 0", padding: "24px 24px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
            >
              <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, marginBottom: 8 }} />
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: earned ? `${color}20` : "rgba(255,255,255,0.04)",
                border: `3px solid ${earned ? color : "rgba(255,255,255,0.1)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 40,
                opacity: earned ? 1 : 0.4,
              }}>
                {emoji}
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", textAlign: "center" }}>{badge.name}</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: earned ? color : "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {badge.rarity} · {badge.category}
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.65)", textAlign: "center", lineHeight: 1.6, maxWidth: 280 }}>
                {badge.description}
              </div>
              {earned
                ? <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                    Earned {new Date(earned.awardedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                : <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>
                    Not yet earned
                  </div>
              }
            </div>
          </div>
        );
      })()}

      <BottomNav />
    </div>
  );
}
