"use client";

import { useEffect, useState } from "react";
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

const RARITY_ORDER: Record<string, number> = { LEGENDARY: 0, EPIC: 1, RARE: 2, UNCOMMON: 3, COMMON: 4 };

function selectHeroBadges(badges: EarnedBadge[], heroBadgeIds: string[] | null): (EarnedBadge | null)[] {
  let result: (EarnedBadge | null)[];
  if (heroBadgeIds && heroBadgeIds.length > 0) {
    const byId = new Map(badges.map(b => [b.id, b]));
    result = heroBadgeIds.slice(0, 6).map(id => byId.get(id) ?? null);
  } else {
    const sorted = [...badges].sort((a, b) => {
      const ra = RARITY_ORDER[a.badge.rarity] ?? 5;
      const rb = RARITY_ORDER[b.badge.rarity] ?? 5;
      if (ra !== rb) return ra - rb;
      return new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime();
    });
    result = sorted.slice(0, 6) as (EarnedBadge | null)[];
  }
  while (result.length < 6) result.push(null);
  return result;
}

// Avatar size 88px
// Arc positions: [cy (badge center Y from avatar top), cx (badge center X from avatar left, negative = left side)]
const LEFT_ARC  = [{ cy: 22, cx: -38 }, { cy: 44, cx: -50 }, { cy: 66, cx: -38 }];
const RIGHT_ARC = [{ cy: 22, cx: 126 }, { cy: 44, cx: 138 }, { cy: 66, cx: 126 }];
const BADGE_SIZE = 35;

function BadgeCircle({ eb, cx, cy, delay, onClick }: {
  eb: EarnedBadge | null;
  cx: number;
  cy: number;
  delay: number;
  onClick?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!eb) return null;
  const color = RARITY_COLOR[eb.badge.rarity] || "rgba(210,210,210,0.6)";
  const emoji = BADGE_EMOJI[eb.badge.slug] || "🏆";
  const r = BADGE_SIZE / 2;

  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        width: BADGE_SIZE,
        height: BADGE_SIZE,
        left: cx - r,
        top: cy - r,
        borderRadius: "50%",
        background: `${color}18`,
        border: `1.5px solid ${color}80`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 15,
        cursor: "pointer",
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.55)",
        transition: "opacity 0.3s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        zIndex: 2,
      }}
    >
      {emoji}
    </div>
  );
}

export default function HeroBadgeWings({
  badges,
  heroBadgeIds,
  children,
  onBadgePress,
}: {
  badges: EarnedBadge[];
  heroBadgeIds: string[] | null;
  children: React.ReactNode;
  onBadgePress: (badge: EarnedBadge) => void;
}) {
  const display = selectHeroBadges(badges, heroBadgeIds);
  const left  = display.slice(0, 3);
  const right = display.slice(3, 6);

  return (
    <div style={{ position: "relative", width: 88, height: 88 }}>
      {left.map((eb, i) => (
        <BadgeCircle
          key={eb?.id ?? `l${i}`}
          eb={eb}
          cx={LEFT_ARC[i].cx}
          cy={LEFT_ARC[i].cy}
          delay={i * 90}
          onClick={eb ? () => onBadgePress(eb) : undefined}
        />
      ))}
      {right.map((eb, i) => (
        <BadgeCircle
          key={eb?.id ?? `r${i}`}
          eb={eb}
          cx={RIGHT_ARC[i].cx}
          cy={RIGHT_ARC[i].cy}
          delay={(i + 3) * 90}
          onClick={eb ? () => onBadgePress(eb) : undefined}
        />
      ))}
      {children}
    </div>
  );
}
