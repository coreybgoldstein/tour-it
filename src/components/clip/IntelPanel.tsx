"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function IntelPanel({
  open,
  onClose,
  holeNumber,
  holePar,
  holeYardage,
  clubUsed,
  windCondition,
  conditions,
  strategyNote,
  landingZoneNote,
  whatCameraDoesntShow,
  datePlayedAt,
  uploaderUsername,
  uploaderAvatarUrl,
  uploaderId,
  currentUserId,
  uploaderHandicap,
}: {
  open: boolean;
  onClose: () => void;
  holeNumber?: number | null;
  holePar?: number | null;
  holeYardage?: number | null;
  clubUsed?: string | null;
  windCondition?: string | null;
  conditions?: string | null;
  strategyNote?: string | null;
  landingZoneNote?: string | null;
  whatCameraDoesntShow?: string | null;
  datePlayedAt?: string | null;
  uploaderUsername: string;
  uploaderAvatarUrl?: string | null;
  uploaderId?: string;
  currentUserId?: string | null;
  uploaderHandicap?: number | null;
}) {
  const router = useRouter();
  const dragStartY = useRef<number | null>(null);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnClip = !!(currentUserId && uploaderId && currentUserId === uploaderId);
  const showFollow = !isOwnClip && !!uploaderId && !!currentUserId;

  useEffect(() => {
    if (!open || !showFollow) return;
    createClient()
      .from("Follow")
      .select("id")
      .eq("followerId", currentUserId!)
      .eq("followingId", uploaderId!)
      .maybeSingle()
      .then(({ data }) => setIsFollowing(!!data));
  }, [open, showFollow, currentUserId, uploaderId]);

  const handleFollow = async () => {
    if (!currentUserId || !uploaderId || followLoading) return;
    setFollowLoading(true);
    const supabase = createClient();
    if (isFollowing) {
      await supabase.from("Follow").delete().eq("followerId", currentUserId).eq("followingId", uploaderId);
      setIsFollowing(false);
    } else {
      await supabase.from("Follow").insert({ followerId: currentUserId, followingId: uploaderId });
      setIsFollowing(true);
    }
    setFollowLoading(false);
  };

  const uploaderNotes = [strategyNote, landingZoneNote, whatCameraDoesntShow]
    .filter(Boolean)
    .join("\n\n");

  const onTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    if (e.changedTouches[0].clientY - dragStartY.current > 60) onClose();
    dragStartY.current = null;
  };

  if (!open) return null;

  const formatWind = (w: string) =>
    w.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

  return (
    <>
      {/* Dim overlay */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 145, background: "rgba(7,16,10,0.35)" }}
      />
      {/* Panel */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 150,
          background: "rgba(10,18,13,0.96)",
          backdropFilter: "blur(20px)",
          borderRadius: "18px 18px 0 0",
          borderTop: "1px solid rgba(77,168,98,0.2)",
          padding: "18px 18px 28px",
          maxHeight: "70vh",
          overflowY: "auto",
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 32, height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 2, margin: "0 auto 14px" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 500, color: "#4da862", letterSpacing: "1.4px", textTransform: "uppercase" }}>
              {holeNumber ? `Hole ${holeNumber} · ` : ""}Scout Notes
            </div>
            {(holePar != null || holeYardage != null) && (
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 3 }}>
                {[holePar != null ? `Par ${holePar}` : null, holeYardage != null ? `${holeYardage} yards` : null].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Data cards */}
        {(clubUsed || windCondition || conditions || holeYardage != null) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: uploaderNotes ? 14 : 16 }}>
            {clubUsed && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "1.2px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 4 }}>Club</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "#fff" }}>{clubUsed}</div>
              </div>
            )}
            {holeYardage != null && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "1.2px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 4 }}>Played From</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "#fff" }}>{holeYardage} yds</div>
              </div>
            )}
            {windCondition && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "1.2px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 4 }}>Wind</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "#fff" }}>{formatWind(windCondition)}</div>
              </div>
            )}
            {conditions && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "1.2px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 4 }}>Conditions</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "#fff" }}>{conditions}</div>
              </div>
            )}
          </div>
        )}

        {/* Uploader notes */}
        {uploaderNotes && (
          <div style={{ background: "rgba(77,168,98,0.06)", border: "1px solid rgba(77,168,98,0.15)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "1.2px", color: "#4da862", textTransform: "uppercase", marginBottom: 6 }}>Uploader Notes</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, whiteSpace: "pre-line" }}>
              {uploaderNotes}
            </div>
          </div>
        )}

        {/* Attribution */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => uploaderId && router.push(`/profile/${uploaderId}`)}
            style={{ background: "none", border: "none", padding: 0, cursor: uploaderId ? "pointer" : "default", flexShrink: 0 }}
          >
            <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.25)", background: "rgba(45,122,66,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {uploaderAvatarUrl
                ? <img src={uploaderAvatarUrl} alt={uploaderUsername} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              }
            </div>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 500, color: "#fff" }}>@{uploaderUsername}</span>
              {uploaderHandicap != null && (
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 500, color: "#4da862", background: "rgba(77,168,98,0.2)", borderRadius: 999, padding: "1px 6px" }}>
                  {uploaderHandicap} HCP
                </span>
              )}
            </div>
            {datePlayedAt && (
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>
                Uploaded {new Date(datePlayedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            )}
          </div>
          {showFollow && isFollowing !== null && (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              style={{
                background: isFollowing ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "6px 12px",
                fontFamily: "'Outfit', sans-serif",
                fontSize: 11,
                fontWeight: 500,
                color: isFollowing ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)",
                cursor: "pointer",
                flexShrink: 0,
                opacity: followLoading ? 0.6 : 1,
              }}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
