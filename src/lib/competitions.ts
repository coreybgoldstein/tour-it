export function isMayActive(): boolean {
  const now = new Date();
  return now.getMonth() === 4 && now.getFullYear() === 2026;
}
