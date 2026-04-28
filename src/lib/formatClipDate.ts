export function formatClipDate(datePlayedAt?: string | null, createdAt?: string | null): string | null {
  const raw = datePlayedAt || createdAt;
  if (!raw) return null;

  const date = new Date(raw);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return null;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 21) return `${diffDays} days ago`;

  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = String(date.getFullYear()).slice(-2);
  return `${m}/${d}/${y}`;
}
