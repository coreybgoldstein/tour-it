// ============================================================
// Tour It — Points System Configuration
// ============================================================

export const PointAction = {
  // Onboarding
  SIGNUP:                  "signup",
  COMPLETE_PROFILE:        "complete_profile",
  ENABLE_NOTIFICATIONS:    "enable_notifications",

  // Content contribution
  UPLOAD_CLIP:             "upload_clip",
  UPLOAD_FIRST_FOR_HOLE:   "upload_first_for_hole",
  UPLOAD_FIRST_FOR_COURSE: "upload_first_for_course",

  // Social
  LIKE_RECEIVED:           "like_received",
  COMMENT_RECEIVED:        "comment_received",
  FOLLOW_RECEIVED:         "follow_received",
  CLIP_SAVED:              "clip_saved",

  // Milestones (one-time)
  MILESTONE_10_LIKES:      "milestone_10_likes",
  MILESTONE_100_LIKES:     "milestone_100_likes",
  MILESTONE_1000_LIKES:    "milestone_1000_likes",

  // Reversals
  UNLIKE_RECEIVED:         "unlike_received",
  UNSAVE_RECEIVED:         "unsave_received",
  UPLOAD_DELETED:          "upload_deleted",
} as const;

export type PointActionKey = typeof PointAction[keyof typeof PointAction];

// Points awarded per action
export const POINT_VALUES: Record<PointActionKey, number> = {
  [PointAction.SIGNUP]:                    50,
  [PointAction.COMPLETE_PROFILE]:          25,
  [PointAction.ENABLE_NOTIFICATIONS]:      10,

  [PointAction.UPLOAD_CLIP]:               20,
  [PointAction.UPLOAD_FIRST_FOR_HOLE]:     50,
  [PointAction.UPLOAD_FIRST_FOR_COURSE]:  100,

  [PointAction.LIKE_RECEIVED]:              2,
  [PointAction.COMMENT_RECEIVED]:           3,
  [PointAction.FOLLOW_RECEIVED]:            5,
  [PointAction.CLIP_SAVED]:                 4,

  [PointAction.MILESTONE_10_LIKES]:        25,
  [PointAction.MILESTONE_100_LIKES]:      100,
  [PointAction.MILESTONE_1000_LIKES]:     500,

  [PointAction.UNLIKE_RECEIVED]:           -2,
  [PointAction.UNSAVE_RECEIVED]:           -4,
  [PointAction.UPLOAD_DELETED]:           -20,
};

// One-time actions — only ever award once per user (enforced in awardPoints)
export const ONE_TIME_ACTIONS = new Set<PointActionKey>([
  PointAction.SIGNUP,
  PointAction.COMPLETE_PROFILE,
  PointAction.ENABLE_NOTIFICATIONS,
]);

// Rank tiers — must match RankTier enum in schema.prisma
export const RANK_TIERS = [
  { rank: "CADDIE",     minLevel: 1,   maxLevel: 10  },
  { rank: "LOCAL",      minLevel: 11,  maxLevel: 25  },
  { rank: "MARSHAL",    minLevel: 26,  maxLevel: 45  },
  { rank: "COURSE_PRO", minLevel: 46,  maxLevel: 70  },
  { rank: "TOUR_PRO",   minLevel: 71,  maxLevel: 90  },
  { rank: "LEGEND",     minLevel: 91,  maxLevel: 100 },
] as const;

export type RankTierKey = typeof RANK_TIERS[number]["rank"];

export const RANK_COLORS: Record<RankTierKey, string> = {
  CADDIE:     "rgba(190,190,190,0.75)",
  LOCAL:      "#4da862",
  MARSHAL:    "#60a5fa",
  COURSE_PRO: "#a78bfa",
  TOUR_PRO:   "#f97316",
  LEGEND:     "#fbbf24",
};

// Level curve: points required to reach level n
// floor(50 * (n - 1)^2.3) — cheap early levels, expensive late ones
export function pointsForLevel(n: number): number {
  if (n <= 1) return 0;
  return Math.floor(50 * Math.pow(n - 1, 2.3));
}

// Max level
export const MAX_LEVEL = 100;
