"use client";

export function ClipTopPill({
  courseLogoUrl, courseName,
  holeNumber, holePar, holeYardage,
  muted, onMuteToggle,
  onTapCourse,
  visible,
}: {
  courseLogoUrl: string | null;
  courseName: string;
  holeNumber?: number | null;
  holePar?: number | null;
  holeYardage?: number | null;
  muted: boolean;
  onMuteToggle: () => void;
  onTapCourse: () => void;
  visible: boolean;
}) {
  const abbr = courseName
    .split(" ")
    .filter((w) => w.length > 2)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase() || "?";

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        right: 12,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 8,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {/* Pill */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(8px)",
          borderRadius: 999,
          padding: "5px 12px 5px 5px",
          display: "flex",
          alignItems: "center",
          gap: 7,
          overflow: "hidden",
        }}
      >
        {/* Logo + course name → course page */}
        <button
          onClick={onTapCourse}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, minWidth: 0, flexShrink: 1, overflow: "hidden" }}
        >
          <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(26,158,66,0.2)", border: "1px solid rgba(26,158,66,0.3)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {courseLogoUrl
              ? <img src={courseLogoUrl} alt={courseName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 7, fontWeight: 700, color: "#1a9e42" }}>{abbr}</span>
            }
          </div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {courseName}
          </span>
        </button>

        {/* Hole info */}
        {holeNumber && (
          <>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, flexShrink: 0 }}>·</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, color: "#4da862", flexShrink: 0 }}>
              Hole {holeNumber}
            </span>
            {holePar != null && (
              <>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, flexShrink: 0 }}>·</span>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.75)", flexShrink: 0 }}>
                  Par {holePar}
                </span>
              </>
            )}
            {holeYardage != null && (
              <>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, flexShrink: 0 }}>·</span>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.75)", flexShrink: 0 }}>
                  {holeYardage} yds
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* Mute button */}
      <button
        onClick={onMuteToggle}
        style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
      >
        {muted
          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        }
      </button>
    </div>
  );
}
