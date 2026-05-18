"use client";

// Slide-in notification panel rendered on top of /profile/[userId] when the
// URL has ?notifications=open. Reuses the same fetch + click-routing logic as
// /notifications/page.tsx so per-type behavior (clip_tag approve/deny, follow
// → profile, like/comment → hole page via Notification.linkUrl) stays in sync.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getClipThumbnail } from "@/lib/getVideoSrc";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  referenceId: string | null;
  read: boolean;
  createdAt: string;
  tagStatus?: "pending" | "approved" | "denied";
  // True when this is a hero tag — approval also transfers ownership of
  // the Upload to the current user (vs co-star approve which just shows
  // it on their profile). Drives the different button copy.
  isHeroTag?: boolean;
  // Thumbnail of the clip the notification refers to. Used to render a
  // visual preview right inside the notification row so the user can
  // see what they're being asked to claim BEFORE tapping approve.
  // Resolved at fetch-time for any notification with a referenceId
  // pointing to an Upload row.
  clipThumbnail?: string | null;
  // Deep link to the specific clip — built from courseId + holeNumber +
  // clip id at fetch-time so tapping the thumbnail lands the user
  // EXACTLY on the clip they need to evaluate.
  clipDeepLink?: string | null;
}

function NotifIcon({ type }: { type: string }) {
  const icons: Record<string, { bg: string; svg: React.ReactNode }> = {
    clip_tag: { bg: "rgba(77,168,98,0.15)", svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
    trip_invite: { bg: "rgba(100,160,255,0.15)", svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64a0ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.9 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.81 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> },
    comment: { bg: "rgba(255,200,80,0.15)", svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffc850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    mention: { bg: "rgba(255,200,80,0.15)", svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffc850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg> },
    follow: { bg: "rgba(180,120,255,0.15)", svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b478ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> },
    like: { bg: "rgba(255,90,90,0.15)", svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff5a5a" stroke="#ff5a5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
  };
  const { bg, svg } = icons[type] ?? {
    bg: "rgba(255,255,255,0.08)",
    svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  };
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{svg}</div>
  );
}

export default function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  // Animation: mount immediately when opening, delay unmount when closing
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Next frame so the enter transition runs
      const r = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(r);
    } else {
      setEntered(false);
      const t = setTimeout(() => setMounted(false), 240);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const supabase = createClient();
    setLoading(true);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("Notification")
        .select("id, type, title, body, linkUrl, referenceId, read, createdAt")
        .eq("userId", user.id)
        .order("createdAt", { ascending: false })
        .limit(50);

      const notifs: NotificationRow[] = data ?? [];

      const tagNotifs = notifs.filter(n => n.type === "clip_tag" && n.referenceId);
      const tagStatusMap: Record<string, "pending" | "approved" | "denied"> = {};
      const tagIsHeroMap: Record<string, boolean> = {};
      const clipThumbMap: Record<string, string | null> = {};
      const clipLinkMap: Record<string, string | null> = {};
      if (tagNotifs.length > 0) {
        const uploadIds = tagNotifs.map(n => n.referenceId!);
        const [{ data: tagRows }, { data: clipRows }] = await Promise.all([
          supabase.from("UploadTag")
            .select("uploadId, approved, isHero")
            .eq("userId", user.id)
            .in("uploadId", uploadIds),
          // Pull clip media + course context so the notification can
          // show a thumbnail and deep-link to the specific clip.
          supabase.from("Upload")
            .select("id, mediaType, mediaUrl, cloudflareVideoId, thumbnailUrl, courseId, holeId")
            .in("id", uploadIds),
        ]);
        (tagRows || []).forEach((r: { uploadId: string; approved: boolean | null; isHero: boolean | null }) => {
          tagStatusMap[r.uploadId] = r.approved === true ? "approved" : r.approved === false ? "denied" : "pending";
          tagIsHeroMap[r.uploadId] = !!r.isHero;
        });

        // Resolve hole numbers for each clip so we can deep-link to the
        // /holes/{n} route (the hole page is the most context-rich
        // single-clip view in the app).
        const clipsByUploadId = new Map((clipRows || []).map((c: { id: string }) => [c.id, c]));
        const holeIds = [...new Set((clipRows || []).map((c: { holeId: string }) => c.holeId).filter(Boolean))];
        let holeNumberById = new Map<string, number>();
        if (holeIds.length > 0) {
          const { data: holes } = await supabase
            .from("Hole")
            .select("id, holeNumber")
            .in("id", holeIds);
          holeNumberById = new Map((holes || []).map((h: { id: string; holeNumber: number }) => [h.id, h.holeNumber]));
        }
        (clipRows || []).forEach((c: { id: string; mediaType: string; mediaUrl: string; cloudflareVideoId: string | null; thumbnailUrl: string | null; courseId: string; holeId: string }) => {
          clipThumbMap[c.id] = getClipThumbnail(c.mediaType, c.mediaUrl, c.cloudflareVideoId, c.thumbnailUrl);
          const holeNum = holeNumberById.get(c.holeId);
          clipLinkMap[c.id] = holeNum
            ? `/courses/${c.courseId}/holes/${holeNum}?clip=${c.id}`
            : `/courses/${c.courseId}`;
        });
        void clipsByUploadId;
      }

      if (cancelled) return;
      setNotifications(notifs.map(n => ({
        ...n,
        tagStatus: n.type === "clip_tag" && n.referenceId ? (tagStatusMap[n.referenceId] ?? "pending") : undefined,
        isHeroTag: n.type === "clip_tag" && n.referenceId ? !!tagIsHeroMap[n.referenceId] : undefined,
        clipThumbnail: n.type === "clip_tag" && n.referenceId ? (clipThumbMap[n.referenceId] ?? null) : undefined,
        clipDeepLink: n.type === "clip_tag" && n.referenceId ? (clipLinkMap[n.referenceId] ?? n.linkUrl) : undefined,
      })));
      setLoading(false);

      const unreadIds = notifs.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length > 0) {
        await supabase.from("Notification").update({ read: true, updatedAt: new Date().toISOString() }).in("id", unreadIds);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  async function handleTagAction(notifId: string, uploadId: string, approve: boolean, isHero: boolean) {
    if (!userId || acting) return;
    setActing(notifId);
    const supabase = createClient();
    const { count } = await supabase.from("UploadTag").update({ approved: approve }, { count: "exact" }).eq("userId", userId).eq("uploadId", uploadId);
    if ((count ?? 0) === 0) {
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, tagStatus: "denied" } : n));
      setActing(null);
      return;
    }

    // Hero approval = ownership transfer. Move Upload.userId to this user
    // and stamp the original uploader on uploadedByUserId so the
    // attribution chip renders everywhere the clip is shown.
    if (approve && isHero) {
      const { data: upload } = await supabase
        .from("Upload")
        .select("userId, uploadedByUserId")
        .eq("id", uploadId)
        .maybeSingle();
      if (upload && upload.userId !== userId) {
        // Preserve the very first uploader if this clip has been transferred
        // before — uploadedByUserId stays pointing at the original creator.
        const originalUploader = upload.uploadedByUserId ?? upload.userId;
        await supabase
          .from("Upload")
          .update({ userId, uploadedByUserId: originalUploader, updatedAt: new Date().toISOString() })
          .eq("id", uploadId);
        // Reward the original uploader for filming for someone else.
        // Routes through /api/points/award so the leaderboard broadcast
        // fires; REFERENCE_DEDUPED_ACTIONS keeps it once per uploadId.
        fetch("/api/points/award", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "clip_uploaded_for_other",
            recipientUserId: originalUploader,
            referenceId: uploadId,
          }),
        }).catch(() => {});
      }
    }

    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, tagStatus: approve ? "approved" : "denied" } : n));
    setActing(null);
  }

  // Swipe-right to dismiss
  const startX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    startX.current = null;
    if (dx > 60) onClose();
  };

  if (!mounted) return null;

  const PANEL_WIDTH = Math.min(420, typeof window !== "undefined" ? Math.round(window.innerWidth * 0.92) : 360);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200,
          opacity: entered ? 1 : 0, transition: "opacity 220ms ease",
          backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
        }}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Notifications"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "fixed", top: 0, bottom: 0, right: 0, width: PANEL_WIDTH, maxWidth: "92vw",
          background: "#07100a", borderLeft: "1px solid rgba(77,168,98,0.15)",
          zIndex: 201,
          transform: entered ? "translateX(0)" : `translateX(${PANEL_WIDTH}px)`,
          transition: "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          display: "flex", flexDirection: "column",
          boxShadow: entered ? "-10px 0 30px rgba(0,0,0,0.45)" : "none",
        }}
      >
        {/* Header */}
        <div style={{ padding: "calc(20px + env(safe-area-inset-top)) 20px 14px", borderBottom: "1px solid rgba(77,168,98,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>Notifications</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.3)", borderTopColor: "#4da862", animation: "spin 0.8s linear infinite" }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80, paddingBottom: 32, paddingLeft: 32, paddingRight: 32, gap: 16, textAlign: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              </div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>All caught up</div>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", margin: 0, lineHeight: 1.6 }}>Likes, comments, follows, and clip tags will show up here.</p>
              </div>
            </div>
          ) : (
            <div>
              {notifications.map((n) => {
                // Whole row is tappable for non-clip_tag notifications; for
                // clip_tag, the thumbnail itself is the tap target so the
                // approve/decline buttons stay isolated.
                const rowLink = n.type === "clip_tag"
                  ? (n.clipDeepLink ?? n.linkUrl)
                  : n.linkUrl;
                const rowClickable = n.type !== "clip_tag" && !!n.linkUrl && n.linkUrl.startsWith("/");
                const previewClip = () => {
                  const url = rowLink;
                  if (url && url.startsWith("/")) { onClose(); router.push(url); }
                };
                // Hero tags get a gold accent on the thumbnail border,
                // co-star tags get green — visual cue for "this is an
                // ownership claim" vs "this is just a heads up."
                const accent = n.type === "clip_tag"
                  ? (n.isHeroTag ? "rgba(212,160,23,0.6)" : "rgba(77,168,98,0.55)")
                  : "transparent";
                return (
                  <div key={n.id} style={{ background: n.read ? "transparent" : "rgba(77,168,98,0.06)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "14px 18px" }}>
                    <div
                      onClick={() => { if (rowClickable) { onClose(); router.push(n.linkUrl!); } }}
                      style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: rowClickable ? "pointer" : "default" }}
                    >
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        {n.type === "clip_tag" && n.clipThumbnail ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); previewClip(); }}
                            aria-label="Preview clip"
                            style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", background: "rgba(255,255,255,0.05)", border: `1.5px solid ${accent}`, padding: 0, cursor: "pointer", display: "block", position: "relative" }}
                          >
                            <img src={n.clipThumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            {/* Play-glyph overlay so users know it's a clip they can preview */}
                            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, rgba(0,0,0,0.0) 40%, rgba(0,0,0,0.45) 100%)" }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.92)" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }}>
                                <polygon points="6 4 20 12 6 20" />
                              </svg>
                            </span>
                          </button>
                        ) : (
                          <NotifIcon type={n.type} />
                        )}
                        {!n.read && <div style={{ position: "absolute", top: 0, right: 0, width: 8, height: 8, borderRadius: "50%", background: "#4da862", border: "1.5px solid #07100a" }} />}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{n.title}</span>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                            {(() => { const d = new Date(/[Z+]/.test(n.createdAt) ? n.createdAt : n.createdAt + "Z"); return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`; })()}
                          </span>
                        </div>
                        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "4px 0 0", lineHeight: 1.4 }}>{n.body}</p>

                        {n.type === "clip_tag" && n.referenceId && (
                          <div style={{ marginTop: 10 }}>
                            {n.tagStatus === "pending" ? (
                              <>
                                {n.clipThumbnail && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); previewClip(); }}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", padding: "0 0 6px", cursor: "pointer", color: "rgba(255,255,255,0.45)", fontFamily: "'Outfit', sans-serif", fontSize: 11, textDecoration: "underline" }}
                                  >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20" /></svg>
                                    Preview clip before deciding
                                  </button>
                                )}
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={(e) => { e.stopPropagation(); handleTagAction(n.id, n.referenceId!, true, !!n.isHeroTag); }} disabled={acting === n.id} style={{ flex: 1, background: n.isHeroTag ? "rgba(212,160,23,0.15)" : "rgba(77,168,98,0.15)", border: `1px solid ${n.isHeroTag ? "rgba(212,160,23,0.5)" : "rgba(77,168,98,0.4)"}`, borderRadius: 8, padding: "8px 0", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: n.isHeroTag ? "#d4a017" : "#4da862", cursor: "pointer", opacity: acting === n.id ? 0.5 : 1 }}>
                                    {acting === n.id ? "..." : n.isHeroTag ? "Yes, this is my shot" : "Add to my profile"}
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleTagAction(n.id, n.referenceId!, false, !!n.isHeroTag); }} disabled={acting === n.id} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 0", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", cursor: "pointer", opacity: acting === n.id ? 0.5 : 1 }}>
                                    {n.isHeroTag ? "Not me" : "Decline"}
                                  </button>
                                </div>
                              </>
                            ) : n.tagStatus === "approved" ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862" }}>{n.isHeroTag ? "Claimed on your profile" : "Added to your profile"}</span>
                                <button onClick={(e) => { e.stopPropagation(); previewClip(); }} style={{ marginLeft: "auto", background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", cursor: "pointer", textDecoration: "underline" }}>View clip</button>
                              </div>
                            ) : (
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{n.isHeroTag ? "Marked not me" : "Declined"}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
