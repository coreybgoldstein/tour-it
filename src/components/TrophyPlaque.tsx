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
  COMMON:    "rgba(200,200,200,0.25)",
  UNCOMMON:  "rgba(77,168,98,0.45)",
  RARE:      "rgba(96,165,250,0.45)",
  EPIC:      "rgba(167,139,250,0.5)",
  LEGENDARY: "rgba(251,191,36,0.65)",
};

type CatalogBadge = { id: string; slug: string; name: string; description: string; category: string; rarity: string };

function Nameplate({ badge, earnedBadge, onClick }: {
  badge: CatalogBadge;
  earnedBadge: EarnedBadge | undefined;
  onClick: () => void;
}) {
  const earned = !!earnedBadge;
  const emoji  = BADGE_EMOJI[badge.slug] || "🏆";
  const glow   = RARITY_GLOW[badge.rarity] || "rgba(218,165,32,0.3)";

  return (
    <div
      onClick={earned ? onClick : undefined}
      style={{
        height: 38,
        borderRadius: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        cursor: earned ? "pointer" : "default",
        background: earned
          ? "linear-gradient(135deg, #9a6e0a 0%, #c8962e 25%, #e8c55a 50%, #c8962e 75%, #9a6e0a 100%)"
          : "linear-gradient(135deg, #1a1008 0%, #221609 60%, #1a1008 100%)",
        border: earned
          ? "1px solid rgba(255,215,0,0.65)"
          : "1px solid rgba(90,50,15,0.35)",
        boxShadow: earned
          ? `0 0 8px ${glow}, inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.2)`
          : "inset 0 1px 0 rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.02)",
        padding: "0 6px",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {earned ? (
        <>
          <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
          <span style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 8,
            fontWeight: 800,
            color: "#1e0e00",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 90,
          }}>
            {badge.name}
          </span>
        </>
      ) : (
        <span style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 9,
          color: "rgba(120,75,25,0.35)",
          letterSpacing: "0.12em",
        }}>
          ─ ─ ─
        </span>
      )}
    </div>
  );
}

export default function TrophyPlaque({
  earnedBadges,
  avatarUrl,
  username,
  profileRank,
  onBadgePress,
}: {
  earnedBadges: EarnedBadge[];
  avatarUrl: string | null;
  username: string;
  profileRank: string | null;
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

  const earnedBySlug = new Map(earnedBadges.map(eb => [eb.badge.slug, eb]));

  // Split around center: avatar divides top half from bottom half
  const half       = Math.ceil(catalog.length / 2);
  const topBadges  = catalog.slice(0, half);
  const botBadges  = catalog.slice(half);

  if (catalog.length === 0) return null;

  const initials = username?.[0]?.toUpperCase() || "?";

  return (
    <div style={{
      margin: "0 16px 16px",
      borderRadius: 8,
      overflow: "hidden",
      border: "2px solid rgba(184,134,11,0.5)",
      boxShadow: "0 6px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.3)",
      // Oak wood background: subtle grain via overlapping gradients
      background: `
        repeating-linear-gradient(88deg,
          transparent 0px, transparent 22px,
          rgba(0,0,0,0.07) 22px, rgba(0,0,0,0.07) 23px
        ),
        repeating-linear-gradient(178deg,
          transparent 0px, transparent 14px,
          rgba(255,255,255,0.025) 14px, rgba(255,255,255,0.025) 15px
        ),
        linear-gradient(162deg,
          #5c2b0c 0%, #7a3e1a 7%,
          #66321200 15%, #8b4a22 22%,
          #6b3412 32%, #7e3f19 42%,
          #5a2a0b 52%, #7a3e1a 62%,
          #8b4a22 72%, #66341200 80%,
          #7a3e1a 90%, #5c2b0c 100%
        )
      `,
    }}>
      <div style={{ padding: "12px 10px" }}>

        {/* Top nameplates grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 11 }}>
          {topBadges.map(badge => (
            <Nameplate
              key={badge.slug}
              badge={badge}
              earnedBadge={earnedBySlug.get(badge.slug)}
              onClick={() => { const eb = earnedBySlug.get(badge.slug); if (eb) onBadgePress(eb); }}
            />
          ))}
        </div>

        {/* Avatar divider row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, rgba(218,165,32,0.45))" }} />
          <div style={{
            width: 68,
            height: 68,
            borderRadius: "50%",
            border: "2.5px solid rgba(218,165,32,0.8)",
            boxShadow: "0 0 14px rgba(218,165,32,0.35), 0 0 0 1px rgba(0,0,0,0.6)",
            overflow: "hidden",
            flexShrink: 0,
            background: "#2a1a08",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt={username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "rgba(218,165,32,0.7)" }}>{initials}</span>
            }
          </div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, rgba(218,165,32,0.45))" }} />
        </div>

        {/* Bottom nameplates grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {botBadges.map(badge => (
            <Nameplate
              key={badge.slug}
              badge={badge}
              earnedBadge={earnedBySlug.get(badge.slug)}
              onClick={() => { const eb = earnedBySlug.get(badge.slug); if (eb) onBadgePress(eb); }}
            />
          ))}
          {/* Pad to even columns if needed */}
          {botBadges.length % 2 !== 0 && (
            <div style={{ height: 38, borderRadius: 3, background: "linear-gradient(135deg, #1a1008 0%, #221609 100%)", border: "1px solid rgba(90,50,15,0.25)", opacity: 0.5 }} />
          )}
        </div>

      </div>
    </div>
  );
}
