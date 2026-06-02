"use client";

export function ClipTopPill({
  courseLogoUrl, courseName, courseLocation,
  holeNumber, holePar, holeYardage,
  muted, onMuteToggle,
  onTapCourse,
  onBack,
  visible,
  showParYardage = true,
}: {
  courseLogoUrl: string | null;
  courseName: string;
  courseLocation?: string | null;
  holeNumber?: number | null;
  holePar?: number | null;
  holeYardage?: number | null;
  muted: boolean;
  onMuteToggle: () => void;
  onTapCourse: () => void;
  // Opt-in back chevron, aligned to the pill height. Only the course
  // feed-modal passes this (it's a full-screen experience with no
  // BottomNav); home/profile/hole surfaces omit it to stay uniform.
  onBack?: () => void;
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
        // Push the pill below the iOS notch / Dynamic Island in Capacitor.
        // On surfaces without a status bar (web desktop) this just becomes 12px.
        top: "calc(12px + env(safe-area-inset-top))",
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
      {/* Back chevron — only rendered when onBack is supplied (course
          feed-modal). Same 32px circle geometry + height as the mute
          button so it sits level with the pill. */}
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back"
          style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.72)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      )}

      {/* Course unit — entire unit navigates to course page. The flag
          badge is a standalone full-height circle; the pill body has a
          squared (flush) left edge tucked behind the badge with a rounded
          right end cap, so badge + body read as one connected capsule. */}
      <button
        onClick={onTapCourse}
        style={{
          display: "inline-flex",
          alignItems: "center",
          flexShrink: 1,
          minWidth: 0,
          maxWidth: "calc(100% - 48px)",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        {/* Flag badge — standalone rounded square (unchanged shape), same
            height as the pill body, sits on top of the body's flush left
            edge to hide the seam. */}
        <div style={{ width: 40, height: 40, borderRadius: 9, background: "#fff", border: "1.5px solid rgba(255,255,255,0.30)", boxShadow: "0 2px 6px rgba(0,0,0,0.35)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative", zIndex: 1 }}>
          {courseLogoUrl
            ? <img src={courseLogoUrl} alt={courseName} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
            : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#1a5c30" }}>{abbr}</span>
          }
        </div>

        {/* Pill body — solid flat color (no backdrop blur) so it reads as one
            consistent surface across every clip surface. Squared left edge
            (-20 margin) tucks behind the badge; 20px right radius = half the
            40px height for a clean semicircle end cap. */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, height: 40, background: "rgba(0,0,0,0.72)", borderRadius: "0 20px 20px 0", paddingLeft: 28, paddingRight: 14, marginLeft: -20, overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {courseName}
          </span>
          {courseLocation && (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 400, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
              {courseLocation}
            </span>
          )}
        </div>

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
        </div>
      </button>

      {/* Mute button — always pinned to far right */}
      <button
        onClick={onMuteToggle}
        style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.72)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginLeft: "auto" }}
      >
        {muted
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        }
      </button>
    </div>
  );
}
