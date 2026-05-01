import { RANK_COLORS, type RankTierKey } from "@/config/points-system";

export function getRankColor(rank: string | null | undefined): string {
  if (!rank) return "rgba(255,255,255,0.55)";
  return RANK_COLORS[rank as RankTierKey] ?? "rgba(255,255,255,0.55)";
}

export function getRankRingBorder(rank: string | null | undefined): string {
  return `2px solid ${getRankColor(rank)}`;
}

export function isLegend(rank: string | null | undefined): boolean {
  return rank === "LEGEND";
}
