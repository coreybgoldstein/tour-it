"use client";

// OfficialMediaCard — renders one CourseOfficialMedia item with a
// "FROM THE COURSE" pill so the user can immediately tell this is
// operator content vs UGC. Same 9:16-ish card silhouette as the
// existing clip thumbnails so it slots into clip rails without
// looking like a different surface.
//
// Tap → opens a lightweight fullscreen viewer (image in a lightbox,
// HLS video player for flyovers / videos). Reuses the same
// HlsVideo + getVideoSrc plumbing user clips use, so playback
// behaves identically — autoplay muted, tap to toggle sound.

import { useState } from "react";
import { cdnImage } from "@/lib/cdnImage";
import { HlsVideo } from "@/components/HlsVideo";

export type OfficialMedia = {
  id: string;
  holeNumber: number | null;
  holeRangeEnd: number | null;
  mediaType: "image" | "flyover" | "video";
  url: string;
  cloudflareVideoId: string | null;
  caption: string | null;
};

export function formatOfficialMediaHole(m: OfficialMedia): string {
  if (m.holeNumber == null) return "Course-level";
  if (m.holeRangeEnd != null && m.holeRangeEnd > m.holeNumber) {
    return `Holes ${m.holeNumber}-${m.holeRangeEnd}`;
  }
  return `Hole ${m.holeNumber}`;
}

export default function OfficialMediaCard({ media, width = 132 }: { media: OfficialMedia; width?: number }) {
  const [open, setOpen] = useState(false);

  const isVideo = media.mediaType !== "image";
  const thumbnail = isVideo && media.cloudflareVideoId
    ? `https://videodelivery.net/${media.cloudflareVideoId}/thumbnails/thumbnail.jpg`
    : media.url;
  const displaySrc = isVideo && media.cloudflareVideoId
    ? `https://videodelivery.net/${media.cloudflareVideoId}/manifest/video.m3u8`
    : media.url;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          flexShrink: 0,
          width,
          aspectRatio: "9 / 16",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(126,200,140,0.4)",
          background: "#0a120d",
          position: "relative",
          padding: 0,
          cursor: "pointer",
          boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
        }}
      >
        {/* Background thumbnail */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cdnImage(thumbnail)}
          alt={media.caption ?? formatOfficialMediaHole(media)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />

        {/* Subtle dark gradient so the pill + caption read on any image */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.0) 55%, rgba(0,0,0,0.78) 100%)" }} />

        {/* Top: FROM THE COURSE pill */}
        <div style={{ position: "absolute", top: 8, left: 8, right: 8, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 8px",
            background: "rgba(7,16,10,0.78)",
            border: "1px solid rgba(126,200,140,0.7)",
            borderRadius: 99,
            fontFamily: "'Inter', sans-serif",
            fontSize: 8.5, fontWeight: 800,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: "#7ed28b",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" />
            </svg>
            From the course
          </span>
        </div>

        {/* Center: play disc on videos */}
        {isVideo && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 38, height: 38, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="none">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          </div>
        )}

        {/* Bottom: caption + hole label */}
        <div style={{ position: "absolute", left: 8, right: 8, bottom: 8 }}>
          {media.caption && (
            <div style={{
              fontFamily: "'Inter', sans-serif", fontSize: 11.5, fontWeight: 700,
              color: "#fff",
              lineHeight: 1.2,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden", textOverflow: "ellipsis",
              textShadow: "0 1px 3px rgba(0,0,0,0.6)",
              marginBottom: 2,
            }}>
              {media.caption}
            </div>
          )}
          <div style={{
            fontFamily: "'Inter', sans-serif", fontSize: 9, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: "rgba(126,200,140,0.95)",
          }}>
            {formatOfficialMediaHole(media)}
          </div>
        </div>
      </button>

      {open && (
        <OfficialMediaFullscreen media={media} displaySrc={displaySrc} thumbnail={thumbnail} isVideo={isVideo} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

// Lightweight fullscreen viewer for a single official-media item.
// Reuses HlsVideo for videos (autoplay, tap to toggle mute). For
// images it's just the image centered with a close button.
function OfficialMediaFullscreen({ media, displaySrc, thumbnail, isVideo, onClose }: {
  media: OfficialMedia; displaySrc: string; thumbnail: string; isVideo: boolean; onClose: () => void;
}) {
  const [muted, setMuted] = useState(true);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.96)", display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(env(safe-area-inset-top, 0) + 40px) 12px calc(env(safe-area-inset-bottom, 0) + 24px)" }}>
      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
        style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0) + 14px)", right: 14, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>

      {/* FROM THE COURSE pill — anchored top-left so it's visible
          on top of either the image or the playing video. */}
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0) + 14px)", left: 14, zIndex: 2, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", background: "rgba(7,16,10,0.78)", border: "1px solid rgba(126,200,140,0.7)", borderRadius: 99, fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7ed28b", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" />
        </svg>
        From the course · {formatOfficialMediaHole(media)}
      </div>

      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 720, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        {isVideo ? (
          <HlsVideo
            src={displaySrc}
            poster={cdnImage(thumbnail)}
            autoPlay
            muted={muted}
            playsInline
            controls
            onClick={() => setMuted((m) => !m)}
            style={{ width: "100%", maxHeight: "75vh", borderRadius: 12, background: "#000" }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cdnImage(media.url)} alt={media.caption ?? "Official media"} style={{ width: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 12, background: "#000" }} />
        )}
        {media.caption && (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.82)", textAlign: "center", lineHeight: 1.4, padding: "0 12px" }}>
            {media.caption}
          </div>
        )}
      </div>
    </div>
  );
}
