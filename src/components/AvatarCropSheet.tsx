"use client";

// AvatarCropSheet — full-screen overlay for picking, positioning,
// and zooming a profile photo before uploading.
//
// Gestures: pinch to zoom, finger drag to pan. No mouse wheel, no
// slider — clean mobile-native interaction model per user direction.
// Pinch zooms around the gesture midpoint so the pixel under the
// user's fingers stays put as they spread.
//
// Output is a 512×512 JPEG q=0.9 — sharp at the 240px retina
// lightbox, light enough for fast upload.

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
  saving?: boolean;
};

const FRAME = 280;
const OUTPUT_SIZE = 512;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

export default function AvatarCropSheet({ src, onCancel, onSave, saving }: Props) {
  // Pan offset (screen px) of the image relative to the frame center.
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  // 1.0 = image's smaller edge equals frame size (cover fit). User
  // can zoom in further; the clamp blocks zoom-out past 1.
  const [scale, setScale] = useState(1);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Refs hold gesture state because re-renders during the gesture
  // would otherwise reset our anchors.
  const stateRef = useRef({ tx: 0, ty: 0, scale: 1, natural: null as { w: number; h: number } | null });
  useEffect(() => { stateRef.current = { tx, ty, scale, natural }; }, [tx, ty, scale, natural]);

  function clampOffsets(nextTx: number, nextTy: number, nextScale: number, nat: { w: number; h: number } | null) {
    if (!nat) return { tx: nextTx, ty: nextTy };
    const baseDim = Math.min(nat.w, nat.h);
    const w = (nat.w / baseDim) * FRAME * nextScale;
    const h = (nat.h / baseDim) * FRAME * nextScale;
    const halfFrame = FRAME / 2;
    const maxOffsetX = Math.max(0, w / 2 - halfFrame);
    const maxOffsetY = Math.max(0, h / 2 - halfFrame);
    return {
      tx: Math.max(-maxOffsetX, Math.min(maxOffsetX, nextTx)),
      ty: Math.max(-maxOffsetY, Math.min(maxOffsetY, nextTy)),
    };
  }

  // ── Pointer-based gesture loop ────────────────────────────────────
  // Single-pointer  → pan
  // Two-pointer     → pinch zoom around the midpoint, plus track
  //                   midpoint drift so panning while pinching feels
  //                   natural too.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    type Pt = { x: number; y: number };
    const pts = new Map<number, Pt>();
    let mode: "none" | "pan" | "pinch" = "none";

    // Snapshot of state at the start of the current gesture.
    let panStart = { px: 0, py: 0, tx0: 0, ty0: 0 };
    let pinchStart = {
      distance: 0,
      mx: 0,           // midpoint x in container-local px
      my: 0,
      scale0: 1,
      tx0: 0,
      ty0: 0,
      // Container-local position of the image pixel under the midpoint.
      // We want THIS to stay under the (possibly drifting) midpoint as
      // the user spreads / pinches. Computed once at gesture start.
      anchorImgX: 0,
      anchorImgY: 0,
    };

    const rect = () => el.getBoundingClientRect();

    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pts.size === 1) {
        mode = "pan";
        panStart = { px: e.clientX, py: e.clientY, tx0: stateRef.current.tx, ty0: stateRef.current.ty };
      } else if (pts.size === 2) {
        mode = "pinch";
        const [a, b] = [...pts.values()];
        const r = rect();
        const mx = (a.x + b.x) / 2 - r.left - r.width / 2;   // container-centered
        const my = (a.y + b.y) / 2 - r.top - r.height / 2;
        const s = stateRef.current;
        pinchStart = {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          mx, my,
          scale0: s.scale,
          tx0: s.tx,
          ty0: s.ty,
          // Where on the IMAGE (in image space) is the pixel under the
          // midpoint right now? That's the pixel we want to keep there.
          anchorImgX: (mx - s.tx) / s.scale,
          anchorImgY: (my - s.ty) / s.scale,
        };
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      e.preventDefault();

      if (mode === "pan" && pts.size === 1) {
        const dx = e.clientX - panStart.px;
        const dy = e.clientY - panStart.py;
        const s = stateRef.current;
        const c = clampOffsets(panStart.tx0 + dx, panStart.ty0 + dy, s.scale, s.natural);
        setTx(c.tx);
        setTy(c.ty);
      } else if (mode === "pinch" && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const r = rect();
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const ratio = dist / pinchStart.distance;
        const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStart.scale0 * ratio));

        // Track the midpoint so the user can pinch AND drag at once.
        const mxNow = (a.x + b.x) / 2 - r.left - r.width / 2;
        const myNow = (a.y + b.y) / 2 - r.top - r.height / 2;

        // Place the image so the anchor (image-space pixel from gesture
        // start) lands under the current midpoint at the new scale.
        //   midpoint = tx + anchorImgX * scale
        // ⇒ tx = midpoint - anchorImgX * scale
        const nextTx = mxNow - pinchStart.anchorImgX * nextScale;
        const nextTy = myNow - pinchStart.anchorImgY * nextScale;

        const s = stateRef.current;
        const c = clampOffsets(nextTx, nextTy, nextScale, s.natural);
        setScale(nextScale);
        setTx(c.tx);
        setTy(c.ty);
      }
    };

    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      try { el.releasePointerCapture(e.pointerId); } catch {}
      if (pts.size === 0) {
        mode = "none";
      } else if (pts.size === 1) {
        // Transition pinch → pan with the remaining finger.
        mode = "pan";
        const remaining = [...pts.values()][0];
        const s = stateRef.current;
        panStart = { px: remaining.x, py: remaining.y, tx0: s.tx, ty0: s.ty };
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove, { passive: false });
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, []);

  async function commit() {
    if (!natural) return;
    const baseDim = Math.min(natural.w, natural.h);
    const renderedW = (natural.w / baseDim) * FRAME * scale;
    const renderedH = (natural.h / baseDim) * FRAME * scale;
    // Image-space coordinates of the visible square.
    const scaleToImage = natural.w / renderedW;
    const cx = (renderedW / 2 - tx) * scaleToImage;
    const cy = (renderedH / 2 - ty) * scaleToImage;
    const srcSize = FRAME * scaleToImage;
    const srcX = cx - srcSize / 2;
    const srcY = cy - srcSize / 2;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
      img.src = src;
    });
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    canvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, "image/jpeg", 0.9);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.96)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "calc(env(safe-area-inset-top, 0) + 40px) 20px calc(env(safe-area-inset-bottom, 0) + 24px)" }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(126,200,140,0.9)" }}>
        Pinch to zoom · drag to position
      </div>

      <div
        ref={containerRef}
        style={{
          width: FRAME, height: FRAME, borderRadius: "50%",
          background: "#000",
          overflow: "hidden",
          touchAction: "none",
          outline: "3px solid #4da862",
          position: "relative",
          // userSelect off so a long press during pinch doesn't trigger
          // iOS's image action sheet.
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          onLoad={(e) => {
            const im = e.currentTarget;
            setNatural({ w: im.naturalWidth, h: im.naturalHeight });
          }}
          draggable={false}
          style={(() => {
            if (!natural) return { display: "none" };
            const baseDim = Math.min(natural.w, natural.h);
            const w = (natural.w / baseDim) * FRAME * scale;
            const h = (natural.h / baseDim) * FRAME * scale;
            return {
              position: "absolute",
              left: `calc(50% + ${tx}px)`,
              top: `calc(50% + ${ty}px)`,
              width: w,
              height: h,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
              willChange: "left, top, width, height",
            } as React.CSSProperties;
          })()}
        />
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, padding: "11px 26px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: saving ? 0.5 : 1 }}
        >
          Cancel
        </button>
        <button
          onClick={commit}
          disabled={saving}
          style={{ background: "#2d7a42", border: "1px solid #4da862", borderRadius: 99, padding: "11px 26px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 2px 10px rgba(45,122,66,0.4)", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : "Save photo"}
        </button>
      </div>
    </div>
  );
}
