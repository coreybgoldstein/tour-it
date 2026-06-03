export function isMayActive(): boolean {
  const now = new Date();
  return now.getMonth() === 4 && now.getFullYear() === 2026;
}

// June 2026 — Wilson Golf-sponsored prize pack.
export function isJuneActive(): boolean {
  const now = new Date();
  return now.getMonth() === 5 && now.getFullYear() === 2026;
}
