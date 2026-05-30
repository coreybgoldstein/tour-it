"use client";

// AvatarCropSheet — fixed-picture crop model.
//
// The picture is shown at a stable contain-fit size and DOES NOT
// rescale during gestures. A circular crop window sits on top of
// the picture and is what moves + resizes:
//   - Drag (one finger) → move the crop window
//   - Pinch (two fingers) → resize the crop window (smaller =
//     tighter crop = more zoom in the saved result)
// The picture itself never changes dimensions, only the crop
// circle does — per user direction:
//     "pinch to zoom should never be able to change dimensions
//      of the picture"
//
// Output: the contents of the crop circle rendered to a 512×512
// JPEG q=0.9.

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  src: string;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
  saving?: boolean;
};

// On-screen size of the photo viewer (the box the contained image
// renders inside).
const VIEWPORT = 320;
const OUTPUT_SIZE = 512;

export default function AvatarCropSheet({ src, onCancel, onSave, saving }: Props) {
  // Natural image dimensions.
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  // Contain-fit dimensions for rendering the picture inside VIEWPORT.
  // Picture stays at THIS size forever — no scaling on pinch.
  const rendered = useMemo(() => {
    if (!natural) return null;
    const ratio = natural.w / natural.h;
    if (ratio >= 1) {
      // Landscape or square — fit by width.
      const w = VIEWPORT;
      const h = VIEWPORT / ratio;
      return { w, h, x: (VIEWPORT - w) / 2, y: (VIEWPORT - h) / 2 };
    }
    // Portrait — fit by height.
    const h = VIEWPORT;
    const w = VIEWPORT * ratio;
    return { w, h, x: (VIEWPORT - w) / 2, y: (VIEWPORT - h) / 2 };
  }, [natural]);

  // Crop circle: center (cx, cy) in VIEWPORT-coords, diameter d.
  // We default to the largest circle that fits inside the rendered
  // picture, centered.
  const [cx, setCx] = useState(VIEWPORT / 2);
  const [cy, setCy] = useState(VIEWPORT / 2);
  const [d, setD] = useState(VIEWPORT * 0.85);

  useEffect(() => {
    if (!rendered) return;
    const initialD = Math.min(rendered.w, rendered.h) * 0.95;
    setCx(rendered.x + rendered.w / 2);
    setCy(rendered.y + rendered.h / 2);
    setD(initialD);
  }, [rendered]);

  // Clamp the crop circle so it stays fully inside the rendered
  // picture (no transparent gutter inside the saved avatar).
  function clamp(nextCx: number, nextCy: number, nextD: number) {
    if (!rendered) return { cx: nextCx, cy: nextCy, d: nextD };
    const minD = 60;
    const maxD = Math.min(rendered.w, rendered.h);
    const cd = Math.max(minD, Math.min(maxD, nextD));
    const half = cd / 2;
    const minCx = rendered.x + half;
    const maxCx = rendered.x + rendered.w - half;
    const minCy = rendered.y + half;
    const maxCy = rendered.y + rendered.h - half;
    return {
      cx: Math.max(minCx, Math.min(maxCx, nextCx)),
      cy: Math.max(minCy, Math.min(maxCy, nextCy)),
      d: cd,
    };
  }

  // ── Gestures ──────────────────────────────────────────────────────
  const stageRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ cx, cy, d });
  useEffect(() => { stateRef.current = { cx, cy, d }; }, [cx, cy, d]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let mode: "none" | "pan" | "pinch" = "none";

    let panStart = { px: 0, py: 0, cx0: 0, cy0: 0 };
    let pinchStart = { distance: 0, d0: 0, cx0: 0, cy0: 0, mx0: 0, my0: 0 };

    const rect = () => el.getBoundingClientRect();

    const localFromClient = (clientX: number, clientY: number) => {
      const r = rect();
      return { x: clientX - r.left, y: clientY - r.top };
    };

    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        mode = "pan";
        const s = stateRef.current;
        panStart = { px: e.clientX, py: e.clientY, cx0: s.cx, cy0: s.cy };
      } else if (pts.size === 2) {
        mode = "pinch";
        const [a, b] = [...pts.values()];
        const r = rect();
        const mx0 = (a.x + b.x) / 2 - r.left;
        const my0 = (a.y + b.y) / 2 - r.top;
        const s = stateRef.current;
        pinchStart = {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          d0: s.d,
          cx0: s.cx,
          cy0: s.cy,
          mx0, my0,
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
        const c = clamp(panStart.cx0 + dx, panStart.cy0 + dy, stateRef.current.d);
        setCx(c.cx);
        setCy(c.cy);
      } else if (mode === "pinch" && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const r = rect();
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const ratio = dist / pinchStart.distance;
        // Pinching OUT (fingers further apart) → larger crop circle.
        // Pinching IN  (fingers closer)        → smaller crop circle
        //                                        (= tighter crop, more
        //                                        zoom in the saved
        //                                        result).
        const nextD = pinchStart.d0 * ratio;
        // Keep the crop circle anchored to the gesture midpoint —
        // recenter as the midpoint drifts so the user can pinch and
        // pan at the same time naturally.
        const mxNow = (a.x + b.x) / 2 - r.left;
        const myNow = (a.y + b.y) / 2 - r.top;
        const nextCx = pinchStart.cx0 + (mxNow - pinchStart.mx0);
        const nextCy = pinchStart.cy0 + (myNow - pinchStart.my0);
        const c = clamp(nextCx, nextCy, nextD);
        setCx(c.cx);
        setCy(c.cy);
        setD(c.d);
      }
    };

    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      try { el.releasePointerCapture(e.pointerId); } catch {}
      if (pts.size === 0) {
        mode = "none";
      } else if (pts.size === 1) {
        // Pinch ended; transition to pan with the remaining finger.
        mode = "pan";
        const remaining = [...pts.values()][0];
        const s = stateRef.current;
        panStart = { px: remaining.x, py: remaining.y, cx0: s.cx, cy0: s.cy };
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

  // ── Save ──────────────────────────────────────────────────────────
  async function commit() {
    if (!natural || !rendered) return;
    // Convert crop-circle coords (VIEWPORT space) to image-pixel space.
    const containScale = rendered.w / natural.w; // viewport_px / image_px
    const srcD = d / containScale;
    const srcCx = (cx - rendered.x) / containScale;
    const srcCy = (cy - rendered.y) / containScale;
    const srcX = srcCx - srcD / 2;
    const srcY = srcCy - srcD / 2;

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
    ctx.drawImage(img, srcX, srcY, srcD, srcD, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    canvas.toBlob((blob) => { if (blob) onSave(blob); }, "image/jpeg", 0.9);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.96)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "calc(env(safe-area-inset-top, 0) + 40px) 20px calc(env(safe-area-inset-bottom, 0) + 24px)" }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(126,200,140,0.9)", textAlign: "center" }}>
        Drag to position · pinch to resize circle
      </div>

      {/* Stage = fixed VIEWPORT-sized box that contains the picture
          at a stable size. The crop circle is rendered as an overlay
          and is the only thing that responds to gestures. */}
      <div
        ref={stageRef}
        style={{
          width: VIEWPORT, height: VIEWPORT,
          background: "#0a0e0c",
          borderRadius: 10,
          overflow: "hidden",
          touchAction: "none",
          position: "relative",
          userSelect: "none",
          WebkitUserSelect: "none",
          border: "1px solid rgba(126,200,140,0.18)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) => {
            const im = e.currentTarget;
            setNatural({ w: im.naturalWidth, h: im.naturalHeight });
          }}
          style={(() => {
            if (!rendered) return { display: "none" };
            return {
              position: "absolute",
              left: rendered.x,
              top: rendered.y,
              width: rendered.w,
              height: rendered.h,
              pointerEvents: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
              // Crucially: NO scaling. The image stays at `rendered`
              // dimensions for the entire session — pinch only
              // changes the crop circle, not the picture.
            } as React.CSSProperties;
          })()}
        />

        {/* Dim mask outside the crop circle so the area being
            "discarded" reads as inactive. SVG with a transparent
            circle punched out via mask. */}
        {rendered && (
          <svg width={VIEWPORT} height={VIEWPORT} viewBox={`0 0 ${VIEWPORT} ${VIEWPORT}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <defs>
              <mask id="crop-mask">
                <rect width={VIEWPORT} height={VIEWPORT} fill="#fff" />
                <circle cx={cx} cy={cy} r={d / 2} fill="#000" />
              </mask>
            </defs>
            <rect width={VIEWPORT} height={VIEWPORT} fill="rgba(0,0,0,0.55)" mask="url(#crop-mask)" />
            <circle cx={cx} cy={cy} r={d / 2} fill="none" stroke="#4da862" strokeWidth={2.5} />
          </svg>
        )}
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
          disabled={saving || !natural}
          style={{ background: "#2d7a42", border: "1px solid #4da862", borderRadius: 99, padding: "11px 26px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 2px 10px rgba(45,122,66,0.4)", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : "Save photo"}
        </button>
      </div>
    </div>
  );
}
