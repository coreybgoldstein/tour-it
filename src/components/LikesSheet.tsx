"use client";

/**
 * Bottom sheet listing every user who liked a given clip.
 *
 * Per the standing CLAUDE.md rule, this is a bottom sheet using the
 * custom-overlay pattern — same shape as CreateGameSheet so it always
 * fills the available vertical space and the host page can't bleed
 * through behind it.
 *
 * The sheet opens from any clip surface that wants a "see who liked
 * this" affordance — typically by tapping the heart count below the
 * like button. It pulls `Like` rows for the upload, joins each like
 * back to its `User` row (username, displayName, avatar), and renders
 * a scrollable list with profile tap-throughs.
 *
 * Usage:
 *   <LikesSheet open={open} uploadId={clip.id} onClose={() => setOpen(false)} />
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cdnImage } from "@/lib/cdnImage";

type Liker = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  likedAt: string;
};

export interface LikesSheetProps {
  open: boolean;
  uploadId: string | null;
  onClose: () => void;
}

export default function LikesSheet({ open, uploadId, onClose }: LikesSheetProps) {
  const router = useRouter();
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !uploadId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      // One round-trip: Like rows for this upload, joined to the
      // liker's User profile. Order newest first so the most recent
      // engagement is at the top.
      const { data } = await supabase
        .from("Like")
        .select("userId, createdAt, User:userId(username, displayName, avatarUrl)")
        .eq("uploadId", uploadId)
        .order("createdAt", { ascending: false });
      if (cancelled) return;
      // Supabase types the joined `User` as an array even when the
      // relation is one-to-one. Cast through unknown and normalize
      // to a single User object (first element of the array, or the
      // object itself if the type evolves).
      type RawRow = { userId: string; createdAt: string; User: { username: string; displayName: string | null; avatarUrl: string | null } | Array<{ username: string; displayName: string | null; avatarUrl: string | null }> | null };
      const rows = (data ?? []) as unknown as RawRow[];
      const list: Liker[] = rows.map(r => {
        const u = Array.isArray(r.User) ? r.User[0] : r.User;
        return {
          userId: r.userId,
          username: u?.username ?? "golfer",
          displayName: u?.displayName ?? null,
          avatarUrl: u?.avatarUrl ?? null,
          likedAt: r.createdAt,
        };
      });
      setLikers(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, uploadId]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 240,
        background: "rgba(0,0,0,0.78)",
        display: "flex",
        // Bottom-anchored half-sheet (~1/3 of screen). Doesn't stretch
        // full-height like the wizards because the content is short
        // and a tall sheet wasted screen real estate.
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#0d2318",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          borderTop: "1px solid rgba(77,168,98,0.3)",
          display: "flex",
          flexDirection: "column",
          // Cap at ~half the viewport, min ~bottom third for breathing
          // room. Content scrolls internally via the body's
          // overflow-y when the like list overflows.
          minHeight: "min(36vh, 320px)",
          maxHeight: "60vh",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.14)", borderRadius: 99, margin: "10px auto 6px", flexShrink: 0 }} />

        <div style={{ padding: "10px 20px 14px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)", marginBottom: 4 }}>
              Likes · {likers.length}
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff" }}>
              Who liked this
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 20px 20px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.4)", fontFamily: "'Outfit', sans-serif", fontSize: 13 }}>Loading…</div>
          ) : likers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>No likes yet — be the first.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {likers.map(liker => (
                <button
                  key={liker.userId}
                  onClick={() => { onClose(); router.push(`/profile/${liker.userId}`); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", background: "rgba(77,168,98,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {liker.avatarUrl
                      ? <img src={cdnImage(liker.avatarUrl)} alt={liker.displayName ?? liker.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{liker.displayName || liker.username}</div>
                    {liker.displayName && (
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>@{liker.username}</div>
                    )}
                  </div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
