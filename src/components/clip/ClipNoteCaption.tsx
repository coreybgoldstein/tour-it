"use client";

export function ClipNoteCaption({
  note,
  holeNumber,
}: {
  note?: string | null;
  holeNumber?: number | null;
}) {
  if (!note?.trim()) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: holeNumber ? 170 : 114,
        left: 16,
        right: 76,
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "inline-block",
          maxWidth: "100%",
          background: "rgba(0,0,0,0.68)",
          borderRadius: 8,
          padding: "6px 10px",
        }}
      >
        <p
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 12,
            fontWeight: 400,
            color: "rgba(255,255,255,0.92)",
            lineHeight: 1.5,
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {note}
        </p>
      </div>
    </div>
  );
}
