"use client";

import { useEffect, useRef, useState } from "react";

export function VideoScrubber({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (!draggingRef.current && video.duration && isFinite(video.duration))
        setProgress(video.currentTime / video.duration);
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [videoRef]);

  // Reset speed display when video changes
  useEffect(() => { setSpeed(1); }, [videoRef]);

  const seekTo = (clientX: number) => {
    const track = trackRef.current;
    const video = videoRef.current;
    if (!track || !video || !video.duration || !isFinite(video.duration)) return;
    const rect = track.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = p * video.duration;
    setProgress(p);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const next = speed === 1 ? 0.5 : speed === 0.5 ? 2 : 1;
    video.playbackRate = next;
    setSpeed(next);
  };

  return (
    <div style={{ position: "absolute", bottom: 80, left: 0, right: 0, zIndex: 110, display: "flex", alignItems: "center", gap: 8, padding: "0 14px" }}>
      {/* Seek track */}
      <div
        ref={trackRef}
        style={{ flex: 1, height: 28, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}
        onPointerDown={(e) => {
          draggingRef.current = true;
          setDragging(true);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          seekTo(e.clientX);
        }}
        onPointerMove={(e) => { if (draggingRef.current) seekTo(e.clientX); }}
        onPointerUp={() => { draggingRef.current = false; setDragging(false); }}
        onPointerCancel={() => { draggingRef.current = false; setDragging(false); }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: "100%", height: dragging ? 5 : 3, background: "rgba(255,255,255,0.22)", borderRadius: 99, position: "relative", transition: "height 0.12s" }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${progress * 100}%`, background: "#4da862", borderRadius: 99 }} />
          {dragging && (
            <div style={{
              position: "absolute", top: "50%", left: `${progress * 100}%`,
              transform: "translate(-50%, -50%)",
              width: 13, height: 13, borderRadius: "50%",
              background: "#4da862", boxShadow: "0 0 6px rgba(77,168,98,0.7)",
            }} />
          )}
        </div>
      </div>

      {/* Speed toggle */}
      <div
        onClick={cycleSpeed}
        style={{
          flexShrink: 0,
          padding: "3px 8px",
          background: speed !== 1 ? "rgba(77,168,98,0.25)" : "rgba(0,0,0,0.45)",
          backdropFilter: "blur(6px)",
          border: `1px solid ${speed !== 1 ? "rgba(77,168,98,0.55)" : "rgba(255,255,255,0.18)"}`,
          borderRadius: 20,
          fontFamily: "'Outfit', sans-serif",
          fontSize: 11, fontWeight: 700,
          color: speed !== 1 ? "#4da862" : "rgba(255,255,255,0.65)",
          cursor: "pointer",
          userSelect: "none",
          minWidth: 34,
          textAlign: "center" as const,
        }}
      >
        {speed === 0.5 ? "0.5×" : speed === 2 ? "2×" : "1×"}
      </div>
    </div>
  );
}

export function PhotoBadge() {
  return (
    <div style={{
      position: "absolute",
      top: "50%", left: "50%",
      transform: "translate(-50%, 32px)",
      zIndex: 110,
      background: "rgba(0,0,0,0.52)",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 24,
      padding: "7px 14px",
      display: "flex",
      alignItems: "center",
      gap: 6,
      pointerEvents: "none",
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.82)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.82)", letterSpacing: "0.05em" }}>PHOTO</span>
    </div>
  );
}
