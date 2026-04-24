"use client";

export function HoleProgressStrip({
  totalHoles = 18,
  currentHole,
  scoutedHoles,
  visible,
}: {
  totalHoles?: number;
  currentHole?: number | null;
  scoutedHoles: number[];
  visible: boolean;
}) {
  const scoutedSet = new Set(scoutedHoles);
  return (
    <div
      style={{
        position: "absolute",
        top: 54,
        left: 12,
        right: 12,
        zIndex: 20,
        display: "flex",
        gap: 2,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s",
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: totalHoles }, (_, i) => {
        const h = i + 1;
        const isCurrent = h === currentHole;
        const isScouted = scoutedSet.has(h);
        return (
          <div
            key={h}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: isCurrent
                ? "#4da862"
                : isScouted
                ? "rgba(77,168,98,0.45)"
                : "rgba(255,255,255,0.12)",
              transition: "background 0.2s",
            }}
          />
        );
      })}
    </div>
  );
}
