"use client";

// SwipeableRow — wraps a card so swiping left reveals Edit (green) +
// Delete (red) actions in Tour It's palette. Touch-driven: locks to the
// horizontal axis only after the gesture clearly moves sideways, so
// vertical list scrolling is never hijacked. The card foreground has its
// own opaque background and covers the actions when closed (no
// overflow:hidden, so the card's drop shadow is preserved). A click while
// open — or right after a drag — is swallowed so it doesn't navigate into
// the card. Shared by the Tee Up list and the trip itinerary so the
// gesture is identical everywhere.

import { useRef, useState } from "react";

export function SwipeableRow({ children, onEdit, onDelete }: { children: React.ReactNode; onEdit?: () => void; onDelete: () => void }) {
  const ACTION_W = onEdit ? 150 : 84;
  const [tx, setTx] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const txRef = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const base = useRef(0);
  const axis = useRef<null | "h" | "v">(null);
  const moved = useRef(false);
  const open = tx <= -ACTION_W + 1;

  const set = (v: number) => { txRef.current = v; setTx(v); };
  const close = () => set(0);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    base.current = txRef.current;
    axis.current = null;
    moved.current = false;
    setSwiping(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!axis.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (axis.current !== "h") return;
    moved.current = true;
    set(Math.max(-ACTION_W, Math.min(0, base.current + dx)));
  }
  function onTouchEnd() {
    setSwiping(false);
    if (axis.current === "h") set(txRef.current <= -ACTION_W / 2 ? -ACTION_W : 0);
  }
  function onClickCapture(e: React.MouseEvent) {
    if (open || moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
      if (open) close();
    }
  }

  const ActionBtn = ({ kind, label, onTap }: { kind: "edit" | "delete"; label: string; onTap: () => void }) => (
    <button
      onClick={() => { close(); onTap(); }}
      style={{ flex: 1, border: "none", cursor: "pointer", background: kind === "edit" ? "#2d7a42" : "rgba(220,80,80,0.95)", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700 }}
    >
      {kind === "edit"
        ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>}
      {label}
    </button>
  );

  return (
    <div style={{ position: "relative", borderRadius: 16 }}>
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: ACTION_W, display: "flex", borderRadius: "0 16px 16px 0", overflow: "hidden" }}>
        {onEdit && <ActionBtn kind="edit" label="Edit" onTap={onEdit} />}
        <ActionBtn kind="delete" label="Delete" onTap={onDelete} />
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClickCapture={onClickCapture}
        style={{ position: "relative", zIndex: 1, background: "#07100a", borderRadius: 16, transform: `translateX(${tx}px)`, transition: swiping ? "none" : "transform 0.25s ease", touchAction: "pan-y" }}
      >
        {children}
      </div>
    </div>
  );
}
