"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { getClipThumbnail } from "@/lib/getVideoSrc";
import { NotifIcon, extractCourseIdFromLink } from "@/components/NotifIcon";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  referenceId: string | null;
  read: boolean;
  createdAt: string;
  tagStatus?: "pending" | "approved" | "denied"; // resolved client-side for clip_tag
  isHeroTag?: boolean; // resolved client-side; true = hero tag, ownership transfers on approve
  clipThumbnail?: string | null; // resolved client-side; static thumb URL
  clipDeepLink?: string | null;  // resolved client-side; routes to the exact clip
  courseLogoUrl?: string | null; // resolved client-side; shown as a crest on the icon
}


export default function NotificationsPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null); // notif id being acted on

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("Notification")
        .select("id, type, title, body, linkUrl, referenceId, read, createdAt")
        .eq("userId", user.id)
        .order("createdAt", { ascending: false })
        .limit(50);

      const notifs = data ?? [];

      // Collect every course id referenced by linkUrls so we can batch
      // fetch their logos in a single query. clip_tag rows resolve their
      // course from the Upload row later, so we union both sources.
      const courseIdsFromLinks = new Set<string>();
      for (const n of notifs) {
        const id = extractCourseIdFromLink(n.linkUrl);
        if (id) courseIdsFromLinks.add(id);
      }

      // For clip_tag notifications, look up current approval status
      const tagNotifs = notifs.filter(n => n.type === "clip_tag" && n.referenceId);
      let tagStatusMap: Record<string, "pending" | "approved" | "denied"> = {};
      let tagIsHeroMap: Record<string, boolean> = {};
      let clipThumbMap: Record<string, string | null> = {};
      let clipLinkMap: Record<string, string | null> = {};
      // Upload.id -> Course.id, used to look up the logo for clip_tag rows.
      let clipCourseIdMap: Record<string, string> = {};
      if (tagNotifs.length > 0) {
        const uploadIds = tagNotifs.map(n => n.referenceId!);
        const [{ data: tagRows }, { data: clipRows }] = await Promise.all([
          supabase.from("UploadTag")
            .select("uploadId, approved, isHero")
            .eq("userId", user.id)
            .in("uploadId", uploadIds),
          supabase.from("Upload")
            .select("id, mediaType, mediaUrl, cloudflareVideoId, thumbnailUrl, courseId, holeId")
            .in("id", uploadIds),
        ]);
        (tagRows || []).forEach((r: any) => {
          tagStatusMap[r.uploadId] = r.approved === true ? "approved" : r.approved === false ? "denied" : "pending";
          tagIsHeroMap[r.uploadId] = !!r.isHero;
        });
        const holeIds = [...new Set((clipRows || []).map((c: any) => c.holeId).filter(Boolean))];
        let holeNumberById = new Map<string, number>();
        if (holeIds.length > 0) {
          const { data: holes } = await supabase.from("Hole").select("id, holeNumber").in("id", holeIds);
          holeNumberById = new Map((holes || []).map((h: any) => [h.id, h.holeNumber]));
        }
        (clipRows || []).forEach((c: any) => {
          clipThumbMap[c.id] = getClipThumbnail(c.mediaType, c.mediaUrl, c.cloudflareVideoId, c.thumbnailUrl);
          clipCourseIdMap[c.id] = c.courseId;
          courseIdsFromLinks.add(c.courseId);
          const holeNum = holeNumberById.get(c.holeId);
          clipLinkMap[c.id] = holeNum
            ? `/courses/${c.courseId}/holes/${holeNum}?clip=${c.id}`
            : `/courses/${c.courseId}`;
        });
      }

      // Single batched logo fetch covers both link-derived and clip-derived
      // course references.
      const courseLogoMap: Record<string, string | null> = {};
      if (courseIdsFromLinks.size > 0) {
        const { data: courseRows } = await supabase
          .from("Course")
          .select("id, logoUrl")
          .in("id", [...courseIdsFromLinks]);
        (courseRows || []).forEach((c: any) => {
          courseLogoMap[c.id] = c.logoUrl;
        });
      }

      setNotifications(notifs.map(n => {
        const isClipTag = n.type === "clip_tag" && n.referenceId;
        const courseId = isClipTag
          ? clipCourseIdMap[n.referenceId!]
          : extractCourseIdFromLink(n.linkUrl);
        return {
          ...n,
          tagStatus: isClipTag ? (tagStatusMap[n.referenceId!] ?? "pending") : undefined,
          isHeroTag: isClipTag ? !!tagIsHeroMap[n.referenceId!] : undefined,
          clipThumbnail: isClipTag ? (clipThumbMap[n.referenceId!] ?? null) : undefined,
          clipDeepLink: isClipTag ? (clipLinkMap[n.referenceId!] ?? n.linkUrl) : undefined,
          courseLogoUrl: courseId ? (courseLogoMap[courseId] ?? null) : null,
        };
      }));
      setLoading(false);

      // Mark all as read
      const unreadIds = notifs.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length > 0) {
        await supabase.from("Notification").update({ read: true, updatedAt: new Date().toISOString() }).in("id", unreadIds);
      }
    });
  }, [router]);

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

    // Hero approval = ownership transfer. Reassign Upload.userId to this
    // user; stamp original uploader on uploadedByUserId for the
    // attribution chip. See NotificationsPanel.tsx for the same logic
    // (kept in sync intentionally — two surfaces, one behavior).
    if (approve && isHero) {
      const { data: upload } = await supabase
        .from("Upload")
        .select("userId, uploadedByUserId")
        .eq("id", uploadId)
        .maybeSingle();
      if (upload && upload.userId !== userId) {
        const originalUploader = upload.uploadedByUserId ?? upload.userId;
        await supabase
          .from("Upload")
          .update({ userId, uploadedByUserId: originalUploader, updatedAt: new Date().toISOString() })
          .eq("id", uploadId);
        // Reward the uploader for filming for someone else (once per
        // uploadId, dedupe lives in awardPoints REFERENCE_DEDUPED_ACTIONS).
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

  return (
    <div style={{ minHeight: "100dvh", background: "#07100a", paddingBottom: 100, paddingLeft: isDesktop ? 72 : 0, maxWidth: isDesktop ? 680 : undefined }}>
      {/* Header — top padding includes the iOS safe-area-inset so the title
          never sits under the notch / Dynamic Island in the Capacitor WebView. */}
      <div style={{ padding: "calc(20px + env(safe-area-inset-top)) 20px 16px", borderBottom: "1px solid rgba(77,168,98,0.15)" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>
          Notifications
        </h1>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.3)", borderTopColor: "#4da862", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80, paddingBottom: 32, paddingLeft: 32, paddingRight: 32, gap: 16, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>All caught up</div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", margin: 0, lineHeight: 1.6 }}>Likes, comments, follows, and clip tags will show up here.</p>
          </div>
        </div>
      ) : (
        <div>
          {notifications.map((n) => {
            const rowClickable = n.type !== "clip_tag" && !!n.linkUrl && n.linkUrl.startsWith("/");
            const previewClip = () => {
              const url = n.type === "clip_tag" ? (n.clipDeepLink ?? n.linkUrl) : n.linkUrl;
              if (url && url.startsWith("/")) router.push(url);
            };
            const accent = n.type === "clip_tag"
              ? (n.isHeroTag ? "rgba(212,160,23,0.6)" : "rgba(77,168,98,0.55)")
              : "transparent";
            return (
            <div
              key={n.id}
              style={{ background: n.read ? "transparent" : "rgba(77,168,98,0.06)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "16px 20px" }}
            >
              <div
                onClick={() => { if (rowClickable) { const url = n.linkUrl!; if (url.startsWith("/")) router.push(url); } }}
                style={{ display: "flex", alignItems: "flex-start", gap: 14, cursor: rowClickable ? "pointer" : "default" }}
              >
                {/* Type icon OR clip thumbnail */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {n.type === "clip_tag" && n.clipThumbnail ? (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); previewClip(); }}
                        aria-label="Preview clip"
                        style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", background: "rgba(255,255,255,0.05)", border: `1.5px solid ${accent}`, padding: 0, cursor: "pointer", display: "block", position: "relative" }}
                      >
                        <img src={n.clipThumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, rgba(0,0,0,0.0) 40%, rgba(0,0,0,0.45) 100%)" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.92)" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }}>
                            <polygon points="6 4 20 12 6 20" />
                          </svg>
                        </span>
                      </button>
                      {n.courseLogoUrl && (
                        <img src={n.courseLogoUrl} alt="" style={{ position: "absolute", bottom: -4, right: -4, width: 22, height: 22, borderRadius: "50%", border: "1.5px solid #07100a", background: "#fff", objectFit: "cover", boxShadow: "0 1px 3px rgba(0,0,0,0.4)", pointerEvents: "none" }} />
                      )}
                    </>
                  ) : (
                    <NotifIcon type={n.type} courseLogoUrl={n.courseLogoUrl} />
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
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "4px 0 0", lineHeight: 1.4 }}>
                    {n.body}
                  </p>

                  {/* Approve / Deny for pending clip tags */}
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
                            <button
                              onClick={() => handleTagAction(n.id, n.referenceId!, true, !!n.isHeroTag)}
                              disabled={acting === n.id}
                              style={{ flex: 1, background: n.isHeroTag ? "rgba(212,160,23,0.15)" : "rgba(77,168,98,0.15)", border: `1px solid ${n.isHeroTag ? "rgba(212,160,23,0.5)" : "rgba(77,168,98,0.4)"}`, borderRadius: 8, padding: "8px 0", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: n.isHeroTag ? "#d4a017" : "#4da862", cursor: "pointer", opacity: acting === n.id ? 0.5 : 1 }}
                            >
                              {acting === n.id ? "..." : n.isHeroTag ? "Yes, this is my shot" : "Add to my profile"}
                            </button>
                            <button
                              onClick={() => handleTagAction(n.id, n.referenceId!, false, !!n.isHeroTag)}
                              disabled={acting === n.id}
                              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 0", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", cursor: "pointer", opacity: acting === n.id ? 0.5 : 1 }}
                            >
                              {n.isHeroTag ? "Not me" : "Decline"}
                            </button>
                          </div>
                        </>
                      ) : n.tagStatus === "approved" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862" }}>{n.isHeroTag ? "Claimed on your profile" : "Added to your profile"}</span>
                          <button onClick={previewClip} style={{ marginLeft: "auto", background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", cursor: "pointer", textDecoration: "underline" }}>View clip</button>
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
      <BottomNav />
    </div>
  );
}
