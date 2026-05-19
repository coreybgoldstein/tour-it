type DirectionsCourse = {
  name?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function directionsUrl(c: DirectionsCourse): string {
  if (c.latitude != null && c.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`;
  }
  const q = encodeURIComponent([c.name, c.city, c.state].filter(Boolean).join(", "));
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

/**
 * Small navigation pill — opens Google Maps directions to the course.
 * Stops click propagation so it works inside tappable card rows.
 */
export function DirectionsButton({
  course,
  label = false,
  size = "sm",
}: {
  course: DirectionsCourse;
  label?: boolean;
  size?: "sm" | "md";
}) {
  const icon = size === "md" ? 14 : 12;
  return (
    <a
      href={directionsUrl(course)}
      target="_blank"
      rel="noreferrer"
      onClick={e => e.stopPropagation()}
      title={`Directions to ${course.name ?? "course"}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: label ? 5 : 0,
        padding: size === "md" ? "6px 10px" : (label ? "4px 8px" : 0),
        width: label ? undefined : (size === "md" ? 28 : 26),
        height: label ? undefined : (size === "md" ? 28 : 26),
        justifyContent: "center",
        borderRadius: 99,
        background: "rgba(77,168,98,0.12)",
        border: "1px solid rgba(77,168,98,0.3)",
        color: "#4da862",
        fontFamily: "'Outfit', sans-serif",
        fontSize: size === "md" ? 11 : 10,
        fontWeight: 600,
        textDecoration: "none",
        cursor: "pointer",
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
      </svg>
      {label && "Directions"}
    </a>
  );
}
