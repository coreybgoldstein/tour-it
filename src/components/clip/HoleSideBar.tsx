"use client";

export function HoleSideBar({
  holeIndex,
  scoutedHoles,
}: {
  holeIndex: number;
  scoutedHoles: number[];
}) {
  if (scoutedHoles.length <= 1) return null;
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
        gap: 5,
        maxHeight: "calc(100dvh - 220px)",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {scoutedHoles.map((holeNum, i) => (
        <div
          key={holeNum}
          style={{
            width: 4,
            height: i === holeIndex ? 28 : 18,
            background: i === holeIndex ? "#fff" : "rgba(255,255,255,0.3)",
            borderRadius: 2,
            transition: "all 150ms ease",
            marginBottom: holeNum === 9 ? 7 : 0,
          }}
        />
      ))}
    </div>
  );
}
