"use client";

const FONT_OPTIONS: { label: string; family: string; weight: number; size: number }[] = [
  { label: "A", family: "'Outfit', sans-serif",            weight: 400, size: 12 },
  { label: "B", family: "'Playfair Display', serif",       weight: 400, size: 12 },
  { label: "C", family: "Georgia, serif",                  weight: 400, size: 12 },
  { label: "D", family: "'Courier New', monospace",        weight: 400, size: 11 },
];

export function ClipNoteCaption({
  note,
  holeNumber,
}: {
  note?: string | null;
  holeNumber?: number | null;
}) {
  if (!note?.trim()) return null;

  const bottom = holeNumber ? 138 : 82;

  return (
    <div
      style={{
        position: "absolute",
        bottom,
        left: 0,
        right: 76,
        zIndex: 10,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        padding: "0 16px",
      }}
    >
      {FONT_OPTIONS.map(({ label, family, weight, size }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%" }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.45)", width: 12, flexShrink: 0, textAlign: "right" }}>
            {label}
          </span>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.42)", borderRadius: 7, padding: "5px 10px" }}>
            <p style={{
              fontFamily: family,
              fontSize: size,
              fontWeight: weight,
              color: "rgba(255,255,255,0.9)",
              lineHeight: 1.45,
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {note}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
