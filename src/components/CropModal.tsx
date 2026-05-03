"use client";

import { useState, useEffect, useRef } from "react";

export function CropModal({ file, aspect, label, onDone, onClose }: {
  file: File; aspect: number; label: string;
  onDone: (blob: Blob) => void; onClose: () => void;
}) {
  const [imgSrc, setImgSrc] = useState("");
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, ox: 0, oy: 0 });
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const FW = 300;
  const FH = Math.round(FW / aspect);

  useEffect(() => {
    const r = new FileReader();
    r.onload = e => setImgSrc(e.target?.result as string);
    r.readAsDataURL(file);
  }, [file]);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setNat({ w, h });
    const s = Math.max(FW / w, FH / h);
    setMinScale(s);
    setScale(s);
    setPos({ x: 0, y: 0 });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: pos.x, oy: pos.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const { startX, startY, ox, oy } = dragRef.current;
    setPos({ x: ox + e.clientX - startX, y: oy + e.clientY - startY });
  };
  const onMouseUp = () => setDragging(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    lastTouchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!lastTouchRef.current) return;
    const t = e.touches[0];
    setPos(p => ({ x: p.x + t.clientX - lastTouchRef.current!.x, y: p.y + t.clientY - lastTouchRef.current!.y }));
    lastTouchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = () => { lastTouchRef.current = null; };

  const confirm = () => {
    if (!imgRef.current || !imgSrc) return;
    const canvas = document.createElement("canvas");
    canvas.width = FW; canvas.height = FH;
    const ctx = canvas.getContext("2d")!;
    const sw = nat.w * scale, sh = nat.h * scale;
    ctx.drawImage(imgRef.current, (FW - sw) / 2 + pos.x, (FH - sh) / 2 + pos.y, sw, sh);
    canvas.toBlob(blob => { if (blob) onDone(blob); }, "image/jpeg", 0.92);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(14px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 300, gap: 16, padding: 20 }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff" }}>Crop {label}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Drag to position · slider to zoom</div>

      <div
        style={{ width: FW, height: FH, position: "relative", overflow: "hidden", borderRadius: 10, border: "2px solid rgba(255,255,255,0.25)", cursor: dragging ? "grabbing" : "grab", touchAction: "none", background: "#000" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      >
        {imgSrc && (
          <img
            ref={imgRef} src={imgSrc} alt="" onLoad={onImgLoad} draggable={false}
            style={{ position: "absolute", width: nat.w * scale, height: nat.h * scale, left: "50%", top: "50%", transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`, userSelect: "none", pointerEvents: "none" }}
          />
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, width: FW }}>
        <span style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}>−</span>
        <input type="range" min={minScale} max={minScale * 4} step={0.01} value={scale}
          onChange={e => setScale(parseFloat(e.target.value))} style={{ flex: 1, accentColor: "#4da862" }} />
        <span style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}>+</span>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.65)", cursor: "pointer" }}>Cancel</button>
        <button onClick={confirm} style={{ padding: "10px 22px", borderRadius: 10, background: "#2d7a42", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Use this crop</button>
      </div>
    </div>
  );
}
