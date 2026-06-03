// CaddieBookIcon — Tour It's custom "Caddie Book" mark: a closed yardage
// book (cover + spine) with a flag planted in a cup on the cover. Green-
// stroke silhouette to match the rest of the UI icon set. Holds up down
// to ~24px nav/pill sizes.

export default function CaddieBookIcon({
  size = 24,
  color = "#4da862",
  strokeWidth = 2,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="11" y="7" width="26" height="35" rx="3.5" />
      <line x1="16" y1="9.5" x2="16" y2="39.5" />
      <line x1="25" y1="14.5" x2="25" y2="31" />
      <path d="M25 14.8 L31 16.6 L25 18.4 Z" fill={color} stroke="none" />
      <ellipse cx="25" cy="31.3" rx="3.4" ry="1.2" />
    </svg>
  );
}
