"use client";

export function ClipTopPill({
  courseLogoUrl, courseName,
  holeNumber, holePar, holeYardage,
  muted, onMuteToggle,
  onTapCourse,
  visible,
  showParYardage = true,
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
  showParYardage?: boolean;
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
      {/* Pill — entire pill navigates to course page */}
      <button
        onClick={onTapCourse}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 1,
          minWidth: 0,
          maxWidth: "calc(100% - 48px)",
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(8px)",
          borderRadius: 999,
          padding: "5px 12px 5px 5px",
          overflow: "hidden",
          border: "none",
          cursor: "pointer",
        }}
      >
        <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(26,158,66,0.2)", border: "1px solid rgba(26,158,66,0.3)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {courseLogoUrl
            ? <img src={courseLogoUrl} alt={courseName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 8, fontWeight: 700, color: "#1a9e42" }}>{abbr}</span>
          }
        </div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {courseName}
        </span>

        {/* Hole number — never truncated */}
        {holeNumber && (
          <>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, flexShrink: 0 }}>·</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "#4da862", flexShrink: 0, whiteSpace: "nowrap" }}>
              Hole {holeNumber}
            </span>
            {showParYardage && holePar != null && (
              <>
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, flexShrink: 0 }}>·</span>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.75)", flexShrink: 0, whiteSpace: "nowrap" }}>
                  Par {holePar}
                </span>
              </>
            )}
            {showParYardage && holeYardage != null && (
              <>
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, flexShrink: 0 }}>·</span>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.75)", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {holeYardage} yds
                </span>
              </>
            )}
          </>
        )}
      </button>

      {/* Mute button — always pinned to far right */}
      <button
        onClick={onMuteToggle}
        style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginLeft: "auto" }}
      >
        {muted
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        }
      </button>
    </div>
  );
}
