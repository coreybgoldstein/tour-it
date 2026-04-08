/**
 * Time-decayed engagement score.
 * New clips start at ~0.41 (base=1, age=0hr).
 * Likes and comments push score up; age pulls it down.
 */
export function computeRankScore(
  likeCount: number,
  commentCount: number,
  createdAt: string
): number {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  return (likeCount * 3 + commentCount * 5 + 1) / Math.pow(ageHours + 2, 1.3);
}
