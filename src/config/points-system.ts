// ============================================================
// Tour It — Points System Configuration
// ============================================================

export const PointAction = {
  // Onboarding
  SIGNUP:                      "signup",
  COMPLETE_PROFILE:            "complete_profile",
  ENABLE_NOTIFICATIONS:        "enable_notifications",

  // Content contribution
  UPLOAD_CLIP:                 "upload_clip",
  UPLOAD_FIRST_FOR_HOLE:       "upload_first_for_hole",
  UPLOAD_FIRST_FOR_COURSE:     "upload_first_for_course",
  UPLOAD_SERIES:               "upload_series",

  // Intel on clip (per upload)
  ADD_CLUB_TO_CLIP:            "add_club_to_clip",
  ADD_WIND_TO_CLIP:            "add_wind_to_clip",
  ADD_STRATEGY_NOTE:           "add_strategy_note",
  INTEL_COMPLETE_BONUS:        "intel_complete_bonus",

  // Course data contribution (first-to-fill)
  ADD_COVER_PHOTO:             "add_cover_photo",
  ADD_COURSE_LOGO:             "add_course_logo",
  ADD_YEAR_ESTABLISHED:        "add_year_established",
  ADD_COURSE_TYPE:             "add_course_type",
  ADD_ZIP_CODE:                "add_zip_code",
  ADD_WEBSITE_URL:             "add_website_url",
  ADD_COURSE_DESCRIPTION:      "add_course_description",
  COURSE_PROFILE_COMPLETE:     "course_profile_complete",

  // Scorecard / rounds
  ADD_HOLE_PAR:                "add_hole_par",
  ADD_HOLE_YARDAGE:            "add_hole_yardage",
  SCORECARD_COMPLETE:          "scorecard_complete",
  FIRST_SCORECARD_FOR_COURSE:  "first_scorecard_for_course",
  LOG_FIRST_ROUND:             "log_first_round",
  LOG_COMPLETE_ROUND:          "log_complete_round",

  // Social
  LIKE_RECEIVED:               "like_received",
  COMMENT_RECEIVED:            "comment_received",
  FOLLOW_RECEIVED:             "follow_received",
  CLIP_SAVED:                  "clip_saved",

  // Milestones (one-time)
  MILESTONE_10_LIKES:          "milestone_10_likes",
  MILESTONE_100_LIKES:         "milestone_100_likes",
  MILESTONE_1000_LIKES:        "milestone_1000_likes",

  // Streak milestones (one-time)
  STREAK_4_WEEKS:              "streak_4_weeks",
  STREAK_8_WEEKS:              "streak_8_weeks",
  STREAK_12_WEEKS:             "streak_12_weeks",
  STREAK_26_WEEKS:             "streak_26_weeks",
  STREAK_52_WEEKS:             "streak_52_weeks",

  // Referrals
  REFERRAL_SIGNUP:             "referral_signup",

  // Reversals
  UNLIKE_RECEIVED:             "unlike_received",
  UNSAVE_RECEIVED:             "unsave_received",
  UPLOAD_DELETED:              "upload_deleted",
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
  [PointAction.UPLOAD_SERIES]:             30,

  [PointAction.ADD_CLUB_TO_CLIP]:           5,
  [PointAction.ADD_WIND_TO_CLIP]:           5,
  [PointAction.ADD_STRATEGY_NOTE]:          5,
  [PointAction.INTEL_COMPLETE_BONUS]:       5,

  [PointAction.ADD_COVER_PHOTO]:           25,
  [PointAction.ADD_COURSE_LOGO]:           15,
  [PointAction.ADD_YEAR_ESTABLISHED]:      10,
  [PointAction.ADD_COURSE_TYPE]:            5,
  [PointAction.ADD_ZIP_CODE]:               5,
  [PointAction.ADD_WEBSITE_URL]:           10,
  [PointAction.ADD_COURSE_DESCRIPTION]:    30,
  [PointAction.COURSE_PROFILE_COMPLETE]:   50,

  [PointAction.ADD_HOLE_PAR]:               3,
  [PointAction.ADD_HOLE_YARDAGE]:           3,
  [PointAction.SCORECARD_COMPLETE]:        30,
  [PointAction.FIRST_SCORECARD_FOR_COURSE]: 50,
  [PointAction.LOG_FIRST_ROUND]:           25,
  [PointAction.LOG_COMPLETE_ROUND]:        15,

  [PointAction.LIKE_RECEIVED]:              2,
  [PointAction.COMMENT_RECEIVED]:           3,
  [PointAction.FOLLOW_RECEIVED]:            5,
  [PointAction.CLIP_SAVED]:                 4,

  [PointAction.MILESTONE_10_LIKES]:        25,
  [PointAction.MILESTONE_100_LIKES]:      100,
  [PointAction.MILESTONE_1000_LIKES]:     500,

  [PointAction.STREAK_4_WEEKS]:           150,
  [PointAction.STREAK_8_WEEKS]:           350,
  [PointAction.STREAK_12_WEEKS]:          600,
  [PointAction.STREAK_26_WEEKS]:         1500,
  [PointAction.STREAK_52_WEEKS]:         4000,

  [PointAction.REFERRAL_SIGNUP]:          100,

  [PointAction.UNLIKE_RECEIVED]:           -2,
  [PointAction.UNSAVE_RECEIVED]:           -4,
  [PointAction.UPLOAD_DELETED]:           -20,
};

// One-time actions — only ever award once per user (enforced in awardPoints)
export const ONE_TIME_ACTIONS = new Set<PointActionKey>([
  PointAction.SIGNUP,
  PointAction.COMPLETE_PROFILE,
  PointAction.ENABLE_NOTIFICATIONS,
  PointAction.LOG_FIRST_ROUND,
  PointAction.MILESTONE_10_LIKES,
  PointAction.MILESTONE_100_LIKES,
  PointAction.MILESTONE_1000_LIKES,
  PointAction.STREAK_4_WEEKS,
  PointAction.STREAK_8_WEEKS,
  PointAction.STREAK_12_WEEKS,
  PointAction.STREAK_26_WEEKS,
  PointAction.STREAK_52_WEEKS,
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
  LOCAL:      "#2dd4bf",
  MARSHAL:    "#60a5fa",
  COURSE_PRO: "#a78bfa",
  TOUR_PRO:   "#f97316",
  LEGEND:     "#fbbf24",
};

// Level curve: points required to reach level n
// floor(40 * (n - 1)^1.85) — soft early curve, gated late tiers
export function pointsForLevel(n: number): number {
  if (n <= 1) return 0;
  return Math.floor(40 * Math.pow(n - 1, 1.85));
}

// Max level
export const MAX_LEVEL = 100;
