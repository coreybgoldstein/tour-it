"use client";

import type { EarnedBadge } from "@/types/badges";

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

export default function TrophyShelf({ badges, isOwner, onEditPress, onBadgePress }: {
  badges: EarnedBadge[];
  isOwner: boolean;
  onEditPress: () => void;
  onBadgePress: (badge: EarnedBadge) => void;
}) {
  if (badges.length === 0) return null;

  return (
    <div style={{ position: "relative", margin: "0 0 4px" }}>
      <div
        style={{
          overflowX: "auto",
          scrollbarWidth: "none",
          display: "flex",
          gap: 7,
          paddingLeft: 16,
          paddingRight: isOwner ? 44 : 16,
          paddingTop: 4,
          paddingBottom: 6,
        }}
      >
        {badges.map(eb => {
          const color = RARITY_COLOR[eb.badge.rarity] || "rgba(210,210,210,0.6)";
          const emoji = BADGE_EMOJI[eb.badge.slug] || "🏆";
          return (
            <div
              key={eb.id}
              onClick={() => onBadgePress(eb)}
              title={eb.badge.name}
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: `${color}18`,
                border: `1px solid ${color}65`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {emoji}
            </div>
          );
        })}
      </div>
      {/* Fade gradient on right edge */}
      <div style={{
        position: "absolute",
        top: 0,
        right: isOwner ? 36 : 0,
        bottom: 0,
        width: 40,
        background: "linear-gradient(to right, transparent, #07100a)",
        pointerEvents: "none",
      }} />
      {/* Edit affordance — owner only */}
      {isOwner && (
        <button
          onClick={onEditPress}
          style={{
            position: "absolute",
            top: "50%",
            right: 8,
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "rgba(255,255,255,0.3)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      )}
    </div>
  );
}
