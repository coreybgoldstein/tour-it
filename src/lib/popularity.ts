// Shared "Popular on Tour It" ranking. Used by both home variants so the
// Popular bucket means the same thing everywhere. Replaces the old random
// shuffle of courses-with-uploads, which made "popular" meaningless.

export type PopularityInput = {
  uploadCount?: number | null;
  saveCount?: number | null;
  viewCount?: number | null;
};

// Uploads are the strongest signal (someone actually scouted the course),
// saves show intent to play, views show passive interest. Weighted so a
// course can't ride view count alone to the top.
export function popularityScore(c: PopularityInput): number {
  const uploads = c.uploadCount ?? 0;
  const saves = c.saveCount ?? 0;
  const views = c.viewCount ?? 0;
  return uploads * 3 + saves * 2 + views * 0.2;
}

export function byPopularity<T extends PopularityInput>(a: T, b: T): number {
  return popularityScore(b) - popularityScore(a);
}
