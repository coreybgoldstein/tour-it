"use client";

// Shared right-rail for every clip surface (tour-the-feed, course
// feed-modal, hole page, profile clip viewer, round clip viewer). Keeps
// the action buttons uniform: green circles for INTEL / Like / Comment /
// kebab (heart fills white when liked, comment fills white when you've
// commented), a dark stacked SEND IT button, and a green 3-dot kebab.
// Surfaces that don't have an action (no INTEL, no kebab) just omit the
// matching prop.

import { useState } from "react";

const GREEN = "rgba(77,168,98,0.85)";
const GREEN_ACTIVE = "rgba(77,168,98,0.98)";

function GreenButton({
  onClick, active, label, children,
}: {
  onClick?: (e: React.MouseEvent) => void;
  active?: boolean;
  label?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
      <div style={{ width: 42, height: 42, borderRadius: "50%", background: active ? GREEN_ACTIVE : GREEN, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
        {children}
      </div>
      {label != null && (
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 700, color: "#fff", letterSpacing: "0.04em", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
          {label}
        </span>
      )}
    </button>
  );
}

export function ClipRail({
  bottom = "calc(env(safe-area-inset-bottom, 0px) + 24px)",
  zIndex = 30,
  onIntel,
  intelActive,
  showEngagement = true,
  liked,
  likeCount,
  onToggleLike,
  onShowLikes,
  commented,
  commentCount,
  onComment,
  sharePath,
  shareTitle,
  kebab,
  onKebab,
}: {
  bottom?: string;
  zIndex?: number;
  onIntel?: (e: React.MouseEvent) => void;
  intelActive?: boolean;
  // Operator/"from the course" media has no Upload to engage with —
  // hide the like + comment buttons when false.
  showEngagement?: boolean;
  liked: boolean;
  likeCount: number;
  onToggleLike: (e: React.MouseEvent) => void;
  onShowLikes?: () => void;
  commented?: boolean;
  commentCount: number;
  onComment: (e: React.MouseEvent) => void;
  // Path appended to window.location.origin to build the share URL.
  sharePath: string;
  shareTitle?: string;
  kebab?: "options" | "report";
  onKebab?: (e: React.MouseEvent) => void;
}) {
  const [sent, setSent] = useState(false);

  const share = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = (typeof window !== "undefined" ? window.location.origin : "") + sharePath;
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: shareTitle ?? "Tour It clip", url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch {}
  };

  return (
    <div data-overlay-control style={{ position: "absolute", right: 12, bottom, display: "flex", flexDirection: "column", gap: 14, alignItems: "center", zIndex }}>
      {/* Intel */}
      {onIntel && (
        <GreenButton onClick={onIntel} active={intelActive} label="INTEL">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></svg>
        </GreenButton>
      )}

      {/* Like — heart fills white when liked. Count taps open "who liked". */}
      {showEngagement && (
      <GreenButton
        onClick={onToggleLike}
        active={liked}
        label={onShowLikes && likeCount > 0
          ? <span onClick={(e) => { e.stopPropagation(); onShowLikes(); }} style={{ cursor: "pointer" }}>{likeCount}</span>
          : likeCount}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? "#fff" : "none"} stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </GreenButton>
      )}

      {/* Comment — bubble fills white once you've commented. */}
      {showEngagement && (
      <GreenButton onClick={onComment} active={commented} label={commentCount}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill={commented ? "#fff" : "none"} stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      </GreenButton>
      )}

      {/* Kebab — green circle, bold dots. Owner: edit/delete. Others: report. */}
      {kebab && onKebab && (
        <GreenButton onClick={onKebab} label={null}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" stroke="none">
            <circle cx="5" cy="12" r="2.1" /><circle cx="12" cy="12" r="2.1" /><circle cx="19" cy="12" r="2.1" />
          </svg>
        </GreenButton>
      )}

      {/* SEND IT — dark stacked button, SENT check on share. Always last. */}
      <button onClick={share} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: "50%", background: sent ? "rgba(26,158,66,0.2)" : "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${sent ? "rgba(26,158,66,0.5)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {sent
            ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1 }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#4ade80", letterSpacing: "0.05em" }}>SENT</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
            : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginTop: 3 }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#fff", letterSpacing: "0.12em", marginRight: "-0.12em" }}>SEND</span>
                <div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.25)", margin: "2px 0" }} />
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#4ade80", letterSpacing: "0.22em", marginRight: "-0.22em" }}>IT</span>
              </div>
          }
        </div>
      </button>
    </div>
  );
}
