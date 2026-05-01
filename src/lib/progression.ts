import { pointsForLevel, MAX_LEVEL, RANK_TIERS, type RankTierKey } from "@/config/points-system";

// Returns the level a user is at given total points
export function computeLevel(totalPoints: number): number {
  let level = 1;
  for (let n = 2; n <= MAX_LEVEL; n++) {
    if (totalPoints >= pointsForLevel(n)) {
      level = n;
    } else {
      break;
    }
  }
  return level;
}

// Returns progress within current level: { current, required, pct }
export function levelProgress(totalPoints: number): {
  current: number;
  required: number;
  pct: number;
} {
  const level = computeLevel(totalPoints);
  if (level >= MAX_LEVEL) return { current: 0, required: 0, pct: 100 };
  const floorPts = pointsForLevel(level);
  const ceilPts  = pointsForLevel(level + 1);
  const current  = totalPoints - floorPts;
  const required = ceilPts - floorPts;
  return { current, required, pct: Math.min(100, Math.round((current / required) * 100)) };
}

// Returns rank tier for a given level
export function computeRank(level: number): RankTierKey {
  for (const tier of RANK_TIERS) {
    if (level >= tier.minLevel && level <= tier.maxLevel) return tier.rank;
  }
  return "LEGEND";
}

// Display label for a rank tier
export function rankLabel(rank: RankTierKey): string {
  const labels: Record<RankTierKey, string> = {
    CADDIE:     "Caddie",
    LOCAL:      "Local",
    MARSHAL:    "Marshal",
    COURSE_PRO: "Course Pro",
    TOUR_PRO:   "Tour Pro",
    LEGEND:     "Legend",
  };
  return labels[rank] ?? rank;
}
