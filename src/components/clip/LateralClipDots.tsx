"use client";

export function LateralClipDots({ clipIndex, clipCount }: { clipIndex: number; clipCount: number }) {
  if (clipCount <= 1) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 10,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: clipCount }, (_, i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: i === clipIndex ? 28 : 18,
            background: i === clipIndex ? "#fff" : "rgba(255,255,255,0.35)",
            borderRadius: 2,
            transition: "all 0.2s",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          writingMode: "vertical-rl" as const,
          fontFamily: "'Outfit', sans-serif",
          fontSize: 9,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "1.2px",
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        {clipIndex + 1} OF {clipCount}
      </div>
    </div>
  );
}
