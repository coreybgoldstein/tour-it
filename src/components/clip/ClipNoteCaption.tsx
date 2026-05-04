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
        bottom: holeNumber ? 138 : 82,
        left: 0,
        right: 76,
        zIndex: 10,
        pointerEvents: "none",
        display: "flex",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <div style={{ background: "rgba(0,0,0,0.42)", borderRadius: 7, padding: "5px 10px", maxWidth: "100%" }}>
        <p
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 11,
            fontWeight: 400,
            color: "rgba(255,255,255,0.9)",
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
