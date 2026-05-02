"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

const RARITY_GLOW: Record<string, string> = {
  COMMON:    "rgba(200,200,200,0.2)",
  UNCOMMON:  "rgba(77,168,98,0.4)",
  RARE:      "rgba(96,165,250,0.4)",
  EPIC:      "rgba(167,139,250,0.45)",
  LEGENDARY: "rgba(251,191,36,0.6)",
};

type CatalogBadge = { id: string; slug: string; name: string; description: string; category: string; rarity: string };

function Nameplate({ badge, earnedBadge, onClick }: {
  badge: CatalogBadge;
  earnedBadge: EarnedBadge | undefined;
  onClick: () => void;
}) {
  const earned = !!earnedBadge;
  const emoji  = BADGE_EMOJI[badge.slug] || "🏆";
  const glow   = RARITY_GLOW[badge.rarity] || "rgba(218,165,32,0.25)";

  return (
    <div
      onClick={earned ? onClick : undefined}
      style={{
        aspectRatio: "1.4 / 1",
        borderRadius: 5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: earned ? "pointer" : "default",
        background: earned
          ? "linear-gradient(145deg, #7a5008 0%, #b07818 20%, #d4a030 45%, #b07818 70%, #7a5008 100%)"
          : "linear-gradient(145deg, #150c04 0%, #1e1208 55%, #150c04 100%)",
        border: earned
          ? "1px solid rgba(218,168,30,0.7)"
          : "1px solid rgba(70,40,10,0.5)",
        boxShadow: earned
          ? `0 2px 8px rgba(0,0,0,0.5), 0 0 10px ${glow}, inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.25)`
          : "inset 0 2px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {earned && (
        <span style={{ fontSize: 22, lineHeight: 1, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>
          {emoji}
        </span>
      )}
    </div>
  );
}

// Badge grid only — no background, no avatar. Profile page wraps this in the wood section.
export default function TrophyPlaque({
  earnedBadges,
  onBadgePress,
}: {
  earnedBadges: EarnedBadge[];
  onBadgePress: (eb: EarnedBadge) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogBadge[]>([]);

  useEffect(() => {
    createClient()
      .from("Badge")
      .select("id, slug, name, description, category, rarity")
      .then(({ data }) => {
        if (!data) return;
        const sorted = [...data].sort((a, b) => {
          const ia = BADGE_ORDER.indexOf(a.slug);
          const ib = BADGE_ORDER.indexOf(b.slug);
          return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
        });
        setCatalog(sorted);
      });
  }, []);

  if (catalog.length === 0) return null;

  const earnedBySlug = new Map(earnedBadges.map(eb => [eb.badge.slug, eb]));

  return (
    <div style={{ padding: "4px 14px 18px" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10,
      }}>
        {catalog.map(badge => (
          <Nameplate
            key={badge.slug}
            badge={badge}
            earnedBadge={earnedBySlug.get(badge.slug)}
            onClick={() => { const eb = earnedBySlug.get(badge.slug); if (eb) onBadgePress(eb); }}
          />
        ))}
        {/* Pad to full row if needed */}
        {catalog.length % 4 !== 0 && Array.from({ length: 4 - (catalog.length % 4) }).map((_, i) => (
          <div key={`pad-${i}`} style={{ aspectRatio: "1.4 / 1", borderRadius: 5, background: "linear-gradient(145deg, #150c04 0%, #1e1208 55%, #150c04 100%)", border: "1px solid rgba(70,40,10,0.4)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)" }} />
        ))}
      </div>
    </div>
  );
}
