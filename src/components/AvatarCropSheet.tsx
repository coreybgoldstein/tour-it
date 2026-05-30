"use client";

// AvatarCropSheet — full-screen overlay that lets the user pan and
// zoom a picked image inside a round 280px frame before uploading.
//
// Why we have it: the profile-picture flow used to take the file as
// it was and save it. iOS picker doesn't give the user a crop step,
// so phones in portrait mode would land with the subject squashed
// or the wrong region visible inside the round avatar frame.
//
// Interactions:
//   - One-finger drag → pan the image
//   - Two-finger pinch → zoom (clamped to fit the frame)
//   - Mouse wheel  → zoom on desktop
//   - Save → renders the cropped region to a 512×512 JPEG blob and
//     hands it back to the caller via onSave
//
// Output is a square 512×512 JPEG at quality 0.9 — small enough for
// fast upload, large enough that retina-rendered avatars still look
// sharp at 240px (the biggest place the avatar shows).

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
  saving?: boolean;
};

const FRAME = 280;                 // visible round frame, on-screen pixels
const OUTPUT_SIZE = 512;           // canvas output dimensions

export default function AvatarCropSheet({ src, onCancel, onSave, saving }: Props) {
  // Pan offset (in screen px) of the image relative to the frame center.
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  // Image scale. 1.0 = the image's "cover" fit inside the frame
  // (smaller edge equals frame size). User can zoom in further.
  const [scale, setScale] = useState(1);
  // Natural image dimensions, captured after onLoad.
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Gesture state stored in refs so React re-renders don't reset
  // mid-interaction.
  const gestureRef = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    initialTx: number;
    initialTy: number;
    initialScale: number;
    initialDistance: number;
    initialMidpoint: { x: number; y: number };
  }>({
    pointers: new Map(),
    initialTx: 0,
    initialTy: 0,
    initialScale: 1,
    initialDistance: 0,
    initialMidpoint: { x: 0, y: 0 },
  });

  // Min scale = "image fits round frame entirely by its smaller
  // edge" — we don't let the user zoom out past that so the frame
  // is always covered.
  const minScale = 1;
  const maxScale = 4;

  function clampOffsets(nextTx: number, nextTy: number, nextScale: number) {
    if (!natural) return { tx: nextTx, ty: nextTy };
    const baseDim = Math.min(natural.w, natural.h);
    const scaledImgW = (natural.w / baseDim) * FRAME * nextScale;
    const scaledImgH = (natural.h / baseDim) * FRAME * nextScale;
    const halfImgW = scaledImgW / 2;
    const halfImgH = scaledImgH / 2;
    const halfFrame = FRAME / 2;
    // The frame must stay covered by the image — so the image's
    // edges can never cross past the frame's edges in any direction.
    const maxOffsetX = Math.max(0, halfImgW - halfFrame);
    const maxOffsetY = Math.max(0, halfImgH - halfFrame);
    return {
      tx: Math.max(-maxOffsetX, Math.min(maxOffsetX, nextTx)),
      ty: Math.max(-maxOffsetY, Math.min(maxOffsetY, nextTy)),
    };
  }

  // ── Pointer + wheel gesture handling ─────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      const g = gestureRef.current;
      g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (g.pointers.size === 1) {
        g.initialTx = tx;
        g.initialTy = ty;
        g.initialScale = scale;
      } else if (g.pointers.size === 2) {
        const pts = Array.from(g.pointers.values());
        g.initialDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        g.initialScale = scale;
        g.initialMidpoint = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        g.initialTx = tx;
        g.initialTy = ty;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const g = gestureRef.current;
      if (!g.pointers.has(e.pointerId)) return;
      g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (g.pointers.size === 1) {
        // Single finger / mouse drag → pan
        const p = g.pointers.get(e.pointerId)!;
        const start = [...g.pointers.values()][0];
        const dx = p.x - (start.x - (tx - g.initialTx));
        const dy = p.y - (start.y - (ty - g.initialTy));
        // Simpler: store the drag origin separately. Below we just
        // diff from the initial finger position and apply on top of
        // initialTx/Ty.
        // Actually using a cleaner formulation:
        const init = g.pointers.get(e.pointerId)!; // current
        // (Use raw deltas accumulated since pointerDown.)
        void dx; void dy; void init;
      }
      if (g.pointers.size === 2) {
        const pts = Array.from(g.pointers.values());
        const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const nextScale = Math.max(minScale, Math.min(maxScale, g.initialScale * (distance / g.initialDistance)));
        const { tx: ctx, ty: cty } = clampOffsets(g.initialTx, g.initialTy, nextScale);
        setScale(nextScale);
        setTx(ctx);
        setTy(cty);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      gestureRef.current.pointers.delete(e.pointerId);
      try { el.releasePointerCapture(e.pointerId); } catch {}
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = Math.max(minScale, Math.min(maxScale, scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
      const { tx: ctx, ty: cty } = clampOffsets(tx, ty, next);
      setScale(next);
      setTx(ctx);
      setTy(cty);
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx, ty, scale, natural]);

  // Single-finger drag via React props (cleaner than the pointer-move
  // path above for simple panning). Captures startX/Y on the element.
  const dragOrigin = useRef<{ x: number; y: number; tx0: number; ty0: number } | null>(null);
  const onMouseDownDrag = (e: React.PointerEvent) => {
    if (gestureRef.current.pointers.size > 1) return;
    dragOrigin.current = { x: e.clientX, y: e.clientY, tx0: tx, ty0: ty };
  };
  const onMouseMoveDrag = (e: React.PointerEvent) => {
    if (!dragOrigin.current || gestureRef.current.pointers.size > 1) return;
    const dx = e.clientX - dragOrigin.current.x;
    const dy = e.clientY - dragOrigin.current.y;
    const next = clampOffsets(dragOrigin.current.tx0 + dx, dragOrigin.current.ty0 + dy, scale);
    setTx(next.tx);
    setTy(next.ty);
  };
  const onMouseUpDrag = () => { dragOrigin.current = null; };

  // Render and upload → render the visible round region (FRAME px
  // wide on screen) to a 512×512 canvas, encode as JPEG.
  async function commit() {
    if (!natural) return;
    const baseDim = Math.min(natural.w, natural.h);
    // Image's on-screen rendered size at the chosen scale.
    const renderedW = (natural.w / baseDim) * FRAME * scale;
    const renderedH = (natural.h / baseDim) * FRAME * scale;
    // The frame's center is at (FRAME/2, FRAME/2) of the on-screen
    // image space, displaced by (tx, ty). So the source rectangle
    // we draw from is centered on:
    //   imageCenterX_inImagePx = (renderedW/2 - tx) / scaleToImage
    // where scaleToImage = renderedW / natural.w.
    const scaleToImage = natural.w / renderedW;
    const cx = (renderedW / 2 - tx) * scaleToImage;
    const cy = (renderedH / 2 - ty) * scaleToImage;
    const srcSize = FRAME * scaleToImage; // size of the visible square in image px
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
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.96)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: "calc(env(safe-area-inset-top, 0) + 40px) 20px calc(env(safe-area-inset-bottom, 0) + 24px)" }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(126,200,140,0.9)" }}>
        Position & zoom
      </div>

      {/* Round frame with the image rendered inside. overflow:hidden
          clips the image to the circle so the user's eye is anchored
          on the framed region. Touch events captured on this
          container drive pan + zoom. */}
      <div
        ref={containerRef}
        onPointerDown={onMouseDownDrag}
        onPointerMove={onMouseMoveDrag}
        onPointerUp={onMouseUpDrag}
        onPointerCancel={onMouseUpDrag}
        style={{
          width: FRAME, height: FRAME, borderRadius: "50%",
          background: "#000",
          overflow: "hidden",
          touchAction: "none",
          outline: "3px solid #4da862",
          cursor: "grab",
          position: "relative",
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
              willChange: "left, top, width, height",
            } as React.CSSProperties;
          })()}
        />
      </div>

      {/* Zoom slider — accessible alternative to pinch on devices
          where two-finger gestures don't fire reliably inside the
          WebView. */}
      <div style={{ width: Math.min(FRAME, 320), display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>−</span>
        <input
          type="range"
          min={minScale * 100}
          max={maxScale * 100}
          value={scale * 100}
          onChange={(e) => {
            const next = Number(e.target.value) / 100;
            const c = clampOffsets(tx, ty, next);
            setScale(next);
            setTx(c.tx);
            setTy(c.ty);
          }}
          style={{ flex: 1, accentColor: "#4da862" }}
        />
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>+</span>
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
