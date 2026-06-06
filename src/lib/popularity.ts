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

// Fisher-Yates. Returns a new array so the input pool isn't mutated. Used by
// the "Popular on Tour It" rails to rotate which top courses surface each
// load — every course in the ranked pool is genuinely a top course, so a
// random sample is still legitimately "popular," it just stops the same
// dozen from showing every single time.
export function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
