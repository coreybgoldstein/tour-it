const store = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (store.get(key) ?? []).filter(t => now - t < windowMs);
  if (hits.length >= max) return false;
  hits.push(now);
  store.set(key, hits);
  return true;
}
