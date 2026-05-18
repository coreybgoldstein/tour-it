"use client";

import type { ReactNode } from "react";

// Per-type icon styling for notification rows. Each notification type gets
// its own color family + glyph so the list scans cleanly at a glance.
//
// Notes on the design choices below:
//   • trip_invite uses a suitcase glyph (not a phone-handset, which was
//     the wrong metaphor — trips aren't phone calls).
//   • mention runs on teal so it's instantly distinguishable from the
//     yellow comment icon — previously both shared the same hue.
//   • Each entry exposes an `accent` color so callers can match borders
//     and rings to the icon family without re-deriving the value.
const ICONS: Record<string, { bg: string; accent: string; svg: ReactNode }> = {
  clip_tag: {
    bg: "rgba(77,168,98,0.15)",
    accent: "#4da862",
    svg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
  trip_invite: {
    bg: "rgba(100,160,255,0.15)",
    accent: "#64a0ff",
    svg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64a0ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        <line x1="3" y1="13" x2="21" y2="13" />
      </svg>
    ),
  },
  comment: {
    bg: "rgba(255,200,80,0.15)",
    accent: "#ffc850",
    svg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffc850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  mention: {
    bg: "rgba(80,200,200,0.15)",
    accent: "#50c8c8",
    svg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#50c8c8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
      </svg>
    ),
  },
  follow: {
    bg: "rgba(180,120,255,0.15)",
    accent: "#b478ff",
    svg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b478ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
  },
  like: {
    bg: "rgba(255,90,90,0.15)",
    accent: "#ff5a5a",
    svg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff5a5a" stroke="#ff5a5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
};

const FALLBACK = {
  bg: "rgba(255,255,255,0.08)",
  accent: "rgba(255,255,255,0.4)",
  svg: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
};

// Resolves the courseId out of a notification's linkUrl so we can show
// the course logo on the icon. Examples it should match:
//   /courses/abc123
//   /courses/abc123/holes/7
//   /courses/abc123?clip=xyz
// Returns null for non-course links (followers, mentions on non-course
// pages, etc.) so callers can skip the Course lookup entirely.
export function extractCourseIdFromLink(linkUrl: string | null | undefined): string | null {
  if (!linkUrl) return null;
  const m = linkUrl.match(/^\/courses\/([^/?#]+)/);
  return m ? m[1] : null;
}

export function NotifIcon({
  type,
  courseLogoUrl,
}: {
  type: string;
  courseLogoUrl?: string | null;
}) {
  const cfg = ICONS[type] ?? FALLBACK;
  return (
    <div style={{ position: "relative", width: 32, height: 32, flexShrink: 0 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: cfg.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {cfg.svg}
      </div>
      {courseLogoUrl && (
        <img
          src={courseLogoUrl}
          alt=""
          style={{
            position: "absolute",
            bottom: -3,
            right: -3,
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "1.5px solid #07100a",
            background: "#fff",
            objectFit: "cover",
            boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          }}
        />
      )}
    </div>
  );
}
