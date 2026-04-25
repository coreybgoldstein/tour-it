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
        top: 80,
        bottom: 168,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
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
            boxShadow: i === holeIndex ? "0 0 0 2px #4da862" : "none",
          }}
        />
      ))}
    </div>
  );
}
