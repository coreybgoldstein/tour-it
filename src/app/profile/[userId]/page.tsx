"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { useLike } from "@/hooks/useLike";

const SHOT_LABEL: Record<string, string> = {
  TEE_SHOT: "Tee Shot", APPROACH: "Approach", CHIP: "Chip", PITCH: "Pitch",
  PUTT: "Putt", BUNKER: "Bunker", LAY_UP: "Layup", FULL_HOLE: "Full Hole",
};

function ProfileFeedCard({
  clip, isActive, courseName, courseLogoUrl, onClose, uploaderInfo, onComment,
}: {
  clip: { id: string; mediaUrl: string; mediaType: string; courseId: string; holeNumber?: number | null; shotType?: string | null; likeCount?: number; commentCount?: number; strategyNote?: string | null; clubUsed?: string | null; windCondition?: string | null; landingZoneNote?: string | null; whatCameraDoesntShow?: string | null; datePlayedAt?: string | null };
  isActive: boolean;
  courseName: string | null;
  courseLogoUrl: string | null;
  onClose: () => void;
  uploaderInfo: { id: string; username: string; avatarUrl: string | null };
  onComment: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const [muted, setMuted] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const { liked, likeCount, toggleLike } = useLike({ uploadId: clip.id, initialLikeCount: clip.likeCount || 0 });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) { v.play().catch(() => {}); setVideoPaused(false); }
    else { v.pause(); v.currentTime = 0; }
  }, [isActive]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (notesOpen) { v.pause(); setVideoPaused(true); }
    else if (isActive) { v.play().catch(() => {}); setVideoPaused(false); }
  }, [notesOpen, isActive]);

  const onTouchStart = (e: React.TouchEvent) => { dragStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    if (e.changedTouches[0].clientY - dragStartY.current > 60) setNotesOpen(false);
    dragStartY.current = null;
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/courses/${clip.courseId}${clip.holeNumber ? `/holes/${clip.holeNumber}` : ""}`;
    const text = `Tour It — ${courseName || ""}${clip.holeNumber ? ` — Hole ${clip.holeNumber}` : ""}`;
    try {
      if (navigator.share) await navigator.share({ title: text, text, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch {}
  };

  const hasNotes = !!(clip.shotType || clip.strategyNote || clip.landingZoneNote || clip.whatCameraDoesntShow || clip.clubUsed || clip.windCondition || clip.datePlayedAt);

  return (
    <div style={{ position: "relative", width: "100%", height: "100svh", background: "#000" }}>
      <style>{`
        .pf-top-bar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 52px 14px 12px; z-index: 20; gap: 10px; }
        .pf-ctrl-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .pf-course-badge { width: 46px; height: 46px; border-radius: 12px; background: rgba(26,158,66,0.2); border: 1.5px solid rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #1a9e42; flex-shrink: 0; overflow: hidden; }
        .pf-right-actions { position: absolute; right: 14px; bottom: 100px; display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 30; }
        .pf-action-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; }
        .pf-action-icon { width: 46px; height: 46px; border-radius: 50%; background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; }
        .pf-action-label { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,0.95); }
      `}</style>

      {clip.mediaType === "VIDEO" ? (
        <video ref={videoRef} src={clip.mediaUrl} loop muted={muted} playsInline
          onClick={() => {
            const v = videoRef.current; if (!v) return;
            if (v.paused) { v.play().catch(() => {}); setVideoPaused(false); }
            else { v.pause(); setVideoPaused(true); }
          }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} />
      ) : (
        <img src={clip.mediaUrl} alt="clip" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}

      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.65) 100%)", pointerEvents: "none", zIndex: 5 }} />

      {videoPaused && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 15, pointerEvents: "none", opacity: 0.7 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </div>
        </div>
      )}

      <div className="pf-top-bar">
        <button onClick={() => router.push(`/courses/${clip.courseId}`)}
          style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <div className="pf-course-badge">
            {courseLogoUrl
              ? <img src={courseLogoUrl} alt={courseName || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#1a9e42" }}>{(courseName || "?").split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase() || "?"}</span>
            }
          </div>
          <div style={{ minWidth: 0, textAlign: "left" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.15, textShadow: "0 1px 6px rgba(0,0,0,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{courseName}</div>
            {clip.holeNumber && (
              <span style={{ display: "inline-flex", alignItems: "center", background: "rgba(0,0,0,0.48)", backdropFilter: "blur(6px)", borderRadius: 99, padding: "2px 8px", marginTop: 3 }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#4ade80" }}>
                  Hole {clip.holeNumber}{clip.datePlayedAt ? ` · ${new Date(clip.datePlayedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                </span>
              </span>
            )}
          </div>
        </button>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button className="pf-ctrl-btn" onClick={() => setMuted(m => !m)}>
            {muted
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            }
          </button>
          <button className="pf-ctrl-btn" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <div className="pf-right-actions">
        <button className="pf-action-btn" onClick={() => router.push(`/profile/${uploaderInfo.id}`)}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {uploaderInfo.avatarUrl
              ? <img src={uploaderInfo.avatarUrl} alt={uploaderInfo.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
          </div>
          <span className="pf-action-label" style={{ maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{uploaderInfo.username}</span>
        </button>

        <button className="pf-action-btn" onClick={toggleLike}>
          <div className="pf-action-icon" style={liked ? { borderColor: "rgba(26,158,66,0.7)", background: "rgba(26,158,66,0.15)" } : {}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? "#1a9e42" : "none"} stroke={liked ? "#1a9e42" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </div>
          <span className="pf-action-label">{likeCount}</span>
        </button>

        <button className="pf-action-btn" onClick={onComment}>
          <div className="pf-action-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <span className="pf-action-label">{clip.commentCount || 0}</span>
        </button>

        {hasNotes && (
          <button className="pf-action-btn" onClick={() => setNotesOpen(true)}>
            <div className="pf-action-icon" style={notesOpen ? { borderColor: "rgba(26,158,66,0.5)", background: "rgba(26,158,66,0.15)" } : {}}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={notesOpen ? "#1a9e42" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
          </button>
        )}

        <button className="pf-action-btn" onClick={handleShare}>
          <div className="pf-action-icon" style={copied ? { borderColor: "rgba(26,158,66,0.5)", background: "rgba(26,158,66,0.2)" } : {}}>
            {copied
              ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#4ade80", letterSpacing: "0.05em" }}>SENT</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginTop: 3 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#fff", letterSpacing: "0.12em", marginRight: "-0.12em" }}>SEND</span>
                  <div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.25)", margin: "2px 0" }} />
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#4ade80", letterSpacing: "0.22em", marginRight: "-0.22em" }}>IT</span>
                </div>
            }
          </div>
          <span style={{ height: 13, display: "block" }} />
        </button>
      </div>

      {notesOpen && (
        <>
          <div onClick={() => setNotesOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 40 }} />
          <div ref={sheetRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50, background: "rgba(10,28,16,0.97)", borderTop: "1px solid rgba(26,158,66,0.2)", borderRadius: "20px 20px 0 0", padding: "20px 20px 100px", backdropFilter: "blur(20px)" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
              {clip.holeNumber ? `Hole ${clip.holeNumber} · ` : ""}Scout Notes
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {clip.shotType && SHOT_LABEL[clip.shotType] && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Shot Type</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#1a9e42" }}>{SHOT_LABEL[clip.shotType]}</span>
                </div>
              )}
              {clip.clubUsed && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Club</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{clip.clubUsed}</span>
                </div>
              )}
              {clip.windCondition && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Wind</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{clip.windCondition.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase())}</span>
                </div>
              )}
              {clip.datePlayedAt && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Played</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{new Date(clip.datePlayedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                </div>
              )}
              {(clip.strategyNote || clip.landingZoneNote || clip.whatCameraDoesntShow) && (
                <div style={{ paddingTop: clip.shotType || clip.clubUsed || clip.windCondition || clip.datePlayedAt ? 6 : 0, borderTop: clip.shotType || clip.clubUsed || clip.windCondition || clip.datePlayedAt ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Notes</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>
                    {[clip.strategyNote, clip.landingZoneNote, clip.whatCameraDoesntShow].filter(Boolean).join("\n\n")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FlagBadge({ label }: { label: string | number }) {
  return (
    <div style={{ background: "#1a5c30", border: "1px solid rgba(255,255,255,0.45)", borderRadius: 3, padding: "2px 6px 3px", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.1)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 10, fontWeight: 700, color: "#fff" }}>{label}</span>
    </div>
  );
}

type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  handicapIndex: number | null;
  homeCourseId: string | null;
  uploadCount: number;
  bio: string | null;
};

type Upload = {
  id: string;
  mediaUrl: string;
  mediaType: string;
  courseId: string;
  holeId: string;
  holeNumber?: number | null;
  createdAt: string;
  userId: string;
  likeCount?: number;
  commentCount?: number;
  shotType?: string | null;
  clubUsed?: string | null;
  windCondition?: string | null;
  strategyNote?: string | null;
  landingZoneNote?: string | null;
  whatCameraDoesntShow?: string | null;
  datePlayedAt?: string | null;
};

type CoursePlayed = {
  id: string;
  name: string;
  city: string;
  state: string;
  logoUrl: string | null;
};

type HomeCourse = { id: string; name: string };

export default function PublicProfilePage() {
  const { userId } = useParams();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [coursesPlayed, setCoursesPlayed] = useState<CoursePlayed[]>([]);
  const [homeCourse, setHomeCourse] = useState<HomeCourse | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserMeta, setCurrentUserMeta] = useState<{ username: string; avatarUrl: string | null } | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Full-screen feed
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedActiveIdx, setFeedActiveIdx] = useState(0);
  const feedScrollRef = useRef<HTMLDivElement>(null);

  // Comment sheet
  const [commentUploadId, setCommentUploadId] = useState<string | null>(null);
  const [commentItems, setCommentItems] = useState<{ id: string; body: string; username: string; avatarUrl: string | null; createdAt: string }[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [mentionResults, setMentionResults] = useState<{ id: string; username: string; displayName: string; avatarUrl: string | null }[]>([]);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const mentionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Followers / Following sheet
  type FollowUser = { id: string; username: string; displayName: string; avatarUrl: string | null };
  const [followSheet, setFollowSheet] = useState<"followers" | "following" | null>(null);
  const [followList, setFollowList] = useState<FollowUser[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setCurrentUserId(authUser.id);
        if (authUser.id === userId) { router.replace("/profile"); return; }
        const { data: me } = await supabase.from("User").select("username, avatarUrl").eq("id", authUser.id).single();
        if (me) setCurrentUserMeta({ username: me.username, avatarUrl: me.avatarUrl });
      }

      const { data: profileData, error: profileError } = await supabase
        .from("User")
        .select("id, username, displayName, avatarUrl, handicapIndex, homeCourseId, uploadCount, bio")
        .eq("id", userId)
        .single();

      if (profileError || !profileData) { setNotFound(true); setLoading(false); return; }
      setProfile(profileData);

      const [{ data: rawUploads }, { count: followers }, { count: following }] = await Promise.all([
        supabase.from("Upload").select("id, mediaUrl, mediaType, courseId, holeId, createdAt, userId, likeCount, commentCount, shotType, clubUsed, windCondition, strategyNote, landingZoneNote, whatCameraDoesntShow, datePlayedAt").eq("userId", userId).order("createdAt", { ascending: false }),
        supabase.from("Follow").select("*", { count: "exact", head: true }).eq("followingId", userId).eq("status", "ACTIVE"),
        supabase.from("Follow").select("*", { count: "exact", head: true }).eq("followerId", userId).eq("status", "ACTIVE"),
      ]);

      let userUploads = rawUploads || [];
      if (userUploads.length > 0) {
        const holeIds = [...new Set(userUploads.map((u: any) => u.holeId).filter(Boolean))];
        if (holeIds.length > 0) {
          const { data: holes } = await supabase.from("Hole").select("id, holeNumber").in("id", holeIds);
          const holeMap = new Map(holes?.map((h: any) => [h.id, h.holeNumber]) || []);
          userUploads = userUploads.map((u: any) => ({ ...u, holeNumber: holeMap.get(u.holeId) || null }));
        }
        const uniqueCourseIds = [...new Set(userUploads.map((u: any) => u.courseId))];
        const { data: courses } = await supabase.from("Course").select("id, name, city, state, logoUrl").in("id", uniqueCourseIds);
        setCoursesPlayed(courses || []);
      }

      setUploads(userUploads);
      setFollowerCount(followers || 0);
      setFollowingCount(following || 0);

      if (authUser) {
        const { data: followRecord } = await supabase.from("Follow").select("id, status").eq("followerId", authUser.id).eq("followingId", userId).single();
        if (followRecord?.status === "ACTIVE") setIsFollowing(true);
      }

      if (profileData.homeCourseId) {
        const { data: hc } = await supabase.from("Course").select("id, name").eq("id", profileData.homeCourseId).single();
        setHomeCourse(hc);
      }

      setLoading(false);
    }

    load();
  }, [userId, router]);

  // Comment load
  useEffect(() => {
    if (!commentUploadId) { setCommentItems([]); return; }
    setLoadingComments(true);
    createClient()
      .from("Comment")
      .select("id, body, createdAt, userId, User:userId(username, avatarUrl)")
      .eq("uploadId", commentUploadId)
      .order("createdAt", { ascending: true })
      .then(({ data }) => {
        if (data) setCommentItems(data.map((c: any) => ({
          id: c.id, body: c.body, createdAt: c.createdAt,
          username: c.User?.username || "golfer",
          avatarUrl: c.User?.avatarUrl || null,
        })));
        setLoadingComments(false);
      });
  }, [commentUploadId]);

  function handleCommentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCommentText(val);
    const cursor = e.target.selectionStart ?? val.length;
    const match = val.slice(0, cursor).match(/@(\w*)$/);
    if (match) {
      const q = match[1];
      if (mentionDebounce.current) clearTimeout(mentionDebounce.current);
      if (q.length < 1) { setMentionResults([]); return; }
      mentionDebounce.current = setTimeout(async () => {
        const { data } = await createClient().from("User").select("id, username, displayName, avatarUrl").ilike("username", `%${q}%`).limit(5);
        setMentionResults(data || []);
      }, 200);
    } else {
      setMentionResults([]);
    }
  }

  function selectMention(username: string) {
    const input = commentInputRef.current;
    if (!input) return;
    const cursor = input.selectionStart ?? commentText.length;
    const before = commentText.slice(0, cursor).replace(/@(\w*)$/, `@${username} `);
    const after = commentText.slice(cursor);
    setCommentText(before + after);
    setMentionResults([]);
    setTimeout(() => { input.focus(); input.setSelectionRange(before.length, before.length); }, 0);
  }

  async function submitComment() {
    if (!commentText.trim() || !currentUserId || !commentUploadId || submittingComment) return;
    setSubmittingComment(true);
    const supabase = createClient();
    const newId = crypto.randomUUID();
    await supabase.from("Comment").insert({ id: newId, userId: currentUserId, uploadId: commentUploadId, body: commentText.trim() });
    const { data: uploadData } = await supabase.from("Upload").select("commentCount").eq("id", commentUploadId).single();
    await supabase.from("Upload").update({ commentCount: (uploadData?.commentCount || 0) + 1 }).eq("id", commentUploadId);
    setCommentItems(prev => [...prev, { id: newId, body: commentText.trim(), createdAt: new Date().toISOString(), username: currentUserMeta?.username || "you", avatarUrl: currentUserMeta?.avatarUrl || null }]);
    setUploads(prev => prev.map(u => u.id === commentUploadId ? { ...u, commentCount: (u.commentCount || 0) + 1 } : u));
    setCommentText("");
    setSubmittingComment(false);
  }

  async function handleFollow() {
    if (!currentUserId || !userId || followLoading) return;
    setFollowLoading(true);
    const supabase = createClient();
    if (isFollowing) {
      await supabase.from("Follow").delete().eq("followerId", currentUserId).eq("followingId", userId);
      setIsFollowing(false);
      setFollowerCount(prev => Math.max(0, prev - 1));
    } else {
      await supabase.from("Follow").insert({ id: crypto.randomUUID(), followerId: currentUserId, followingId: userId, status: "ACTIVE", createdAt: new Date().toISOString() });
      setIsFollowing(true);
      setFollowerCount(prev => prev + 1);
    }
    setFollowLoading(false);
  }

  async function openFollowSheet(type: "followers" | "following") {
    if (!profile) return;
    setFollowSheet(type);
    setFollowList([]);
    setFollowListLoading(true);
    const supabase = createClient();
    const col = type === "followers" ? "followerId" : "followingId";
    const { data } = await supabase.from("Follow").select(col).eq(type === "followers" ? "followingId" : "followerId", profile.id).eq("status", "ACTIVE");
    const ids = (data || []).map((r: any) => r[col]);
    if (ids.length > 0) {
      const { data: users } = await supabase.from("User").select("id, username, displayName, avatarUrl").in("id", ids);
      setFollowList(users || []);
    }
    setFollowListLoading(false);
  }

  if (loading) {
    return (
      <main style={{ background: "#07100a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", fontFamily: "'Outfit', sans-serif" }}>Loading...</div>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main style={{ background: "#07100a", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@300;400;500;600&display=swap');`}</style>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>User not found</h1>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 24 }}>This profile doesn&apos;t exist or has been removed.</p>
        <button onClick={() => router.push("/")} style={{ background: "#2d7a42", border: "none", borderRadius: 10, padding: "10px 24px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Go home</button>
      </main>
    );
  }

  const initials = profile.displayName?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  const openFeed = (idx: number) => {
    setFeedActiveIdx(idx);
    setFeedOpen(true);
    setTimeout(() => {
      feedScrollRef.current?.scrollTo({ top: idx * window.innerHeight, behavior: "instant" });
    }, 0);
  };

  return (
    <main style={{ background: "#07100a", minHeight: "100vh", fontFamily: "'Outfit', sans-serif", color: "#fff", paddingBottom: "80px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        .clip-thumb:active { opacity: 0.75; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Full-screen scroll feed */}
      {feedOpen && (
        <div
          ref={feedScrollRef}
          onScroll={e => {
            const idx = Math.round((e.target as HTMLElement).scrollTop / window.innerHeight);
            setFeedActiveIdx(idx);
          }}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", overflowY: "scroll", scrollSnapType: "y mandatory", scrollbarWidth: "none" }}
        >
          {uploads.map((clip, idx) => (
            <div key={clip.id} style={{ scrollSnapAlign: "start", scrollSnapStop: "always", height: "100svh", width: "100vw", flexShrink: 0 }}>
              <ProfileFeedCard
                clip={clip}
                isActive={idx === feedActiveIdx}
                courseName={coursesPlayed.find(c => c.id === clip.courseId)?.name ?? null}
                courseLogoUrl={coursesPlayed.find(c => c.id === clip.courseId)?.logoUrl ?? null}
                onClose={() => setFeedOpen(false)}
                uploaderInfo={{ id: profile.id, username: profile.username, avatarUrl: profile.avatarUrl }}
                onComment={() => setCommentUploadId(clip.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Top bar */}
      <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      </div>

      {/* Avatar + identity */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 10, paddingBottom: 14 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: profile.avatarUrl ? "transparent" : "#1a3320", border: "3px solid #07100a", outline: "2.5px solid rgba(26,158,66,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px", fontWeight: 600, color: "rgba(255,255,255,0.6)", overflow: "hidden" }}>
            {profile.avatarUrl
              ? <img src={profile.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : initials
            }
          </div>
        </div>

        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 700, color: "#1a9e42", lineHeight: 1.2, marginBottom: 10 }}>@{profile.username}</div>

        {(profile.handicapIndex !== null || homeCourse) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 12 }}>
            {profile.handicapIndex !== null && (
              <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "4px 10px", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                {profile.handicapIndex} hcp
              </div>
            )}
            {homeCourse && (
              <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "4px 10px", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                {homeCourse.name}
              </div>
            )}
          </div>
        )}

        {/* Follow button */}
        {currentUserId && currentUserId !== userId && (
          <button onClick={handleFollow} disabled={followLoading}
            style={{ padding: "10px 32px", borderRadius: 10, border: isFollowing ? "1px solid rgba(255,255,255,0.15)" : "none", background: isFollowing ? "rgba(255,255,255,0.06)" : "#2d7a42", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: isFollowing ? "rgba(255,255,255,0.6)" : "#fff", cursor: "pointer", transition: "all 0.15s", opacity: followLoading ? 0.6 : 1 }}>
            {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
          </button>
        )}
        {!currentUserId && (
          <button onClick={() => router.push("/login")}
            style={{ padding: "10px 32px", borderRadius: 10, background: "#2d7a42", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
            Log in to follow
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", justifyContent: "space-around", padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
        {[
          { num: uploads.length, label: "Clips", onClick: undefined as (() => void) | undefined },
          { num: coursesPlayed.length, label: "Courses", onClick: undefined as (() => void) | undefined },
          { num: followerCount, label: "Followers", onClick: () => openFollowSheet("followers") },
          { num: followingCount, label: "Following", onClick: () => openFollowSheet("following") },
        ].map(s => (
          <div key={s.label} onClick={s.onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: s.onClick ? "pointer" : "default" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#fff" }}>{s.num}</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: s.onClick ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", textDecoration: s.onClick ? "underline" : "none", textDecorationColor: "rgba(255,255,255,0.15)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Courses played */}
      {coursesPlayed.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", padding: "0 20px", marginBottom: 8 }}>Courses</div>
          <div style={{ display: "flex", gap: 6, padding: "0 20px", overflowX: "auto", paddingBottom: 2 }}>
            {coursesPlayed.map(c => (
              <button key={c.id} onClick={() => router.push(`/courses/${c.id}`)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 99, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.3)", flexShrink: 0, display: "block" }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.65)", fontFamily: "'Outfit', sans-serif" }}>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clips grid */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Clips</div>
          {uploads.length > 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Tap to view</div>}
        </div>
        {uploads.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>No clips yet</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>@{profile.username} hasn&apos;t uploaded any clips</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px", padding: "0 20px" }}>
            {uploads.map((upload, i) => (
              <div key={upload.id} className="clip-thumb" onClick={() => openFeed(i)}
                style={{ aspectRatio: "9/16", borderRadius: "6px", overflow: "hidden", position: "relative", cursor: "pointer", background: i % 3 === 0 ? "linear-gradient(180deg,#1a4d22 0%,#2d7a42 50%,#0f2e18 100%)" : i % 3 === 1 ? "linear-gradient(180deg,#0a2e14 0%,#1e5c30 50%,#0a1e10 100%)" : "linear-gradient(180deg,#1e3a10 0%,#3a6020 50%,#122010 100%)", transition: "opacity 0.15s" }}>
                {upload.mediaType === "PHOTO"
                  ? <img src={upload.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <video src={upload.mediaUrl} muted playsInline preload="metadata" onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 0.001; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                }
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }} />
                <div style={{ position: "absolute", bottom: 6, left: 6, right: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1, marginRight: 4 }}>
                    {coursesPlayed.find(c => c.id === upload.courseId)?.name || ""}
                  </div>
                  <FlagBadge label={upload.holeNumber ?? "·"} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />

      {/* Comment sheet */}
      {commentUploadId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150 }} onClick={() => { setCommentUploadId(null); setCommentText(""); }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(13,35,24,0.98)", backdropFilter: "blur(20px)", borderRadius: "20px 20px 0 0", padding: "16px 16px 32px", maxHeight: "70vh", display: "flex", flexDirection: "column" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 16px" }} />
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", textAlign: "center", paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Comments</div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {loadingComments ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading...</div>
              ) : commentItems.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13, padding: "32px 0", lineHeight: 1.6 }}>No comments yet.<br />Be the first to say something!</div>
              ) : commentItems.map(c => (
                <div key={c.id} style={{ display: "flex", gap: 10, paddingBottom: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(26,158,66,0.2)", border: "1px solid rgba(26,158,66,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {c.avatarUrl
                      ? <img src={c.avatarUrl} alt={c.username} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                      : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    }
                  </div>
                  <div>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#1a9e42" }}>@{c.username} </span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{c.body}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
              {mentionResults.length > 0 && (
                <div style={{ position: "absolute", bottom: "calc(100% + 4px)", left: 0, right: 0, background: "#0d1f12", border: "1px solid rgba(26,158,66,0.2)", borderRadius: 10, overflow: "hidden", zIndex: 20 }}>
                  {mentionResults.map(u => (
                    <button key={u.id} onMouseDown={e => { e.preventDefault(); selectMention(u.username); }}
                      style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(26,158,66,0.15)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {u.avatarUrl ? <img src={u.avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={u.username} /> : <span style={{ fontSize: 10, color: "#1a9e42", fontWeight: 700 }}>{u.username[0].toUpperCase()}</span>}
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#fff" }}>{u.displayName}</div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>@{u.username}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  ref={commentInputRef}
                  value={commentText}
                  onChange={handleCommentChange}
                  placeholder={currentUserId ? "Add a comment... use @ to tag" : "Log in to comment"}
                  disabled={!currentUserId}
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }}
                  onKeyDown={e => { if (e.key === "Enter" && commentText.trim()) submitComment(); }}
                />
                <button onClick={submitComment} disabled={!commentText.trim() || submittingComment || !currentUserId}
                  style={{ background: "#2d7a42", border: "none", borderRadius: 10, padding: "10px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: (!commentText.trim() || !currentUserId) ? 0.4 : 1 }}>
                  {submittingComment ? "..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Followers / Following sheet */}
      {followSheet && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setFollowSheet(null)}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} />
          <div onClick={e => e.stopPropagation()} style={{ position: "relative", background: "#0d1f12", borderRadius: "20px 20px 0 0", maxHeight: "70vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.15)", position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)" }} />
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
                {followSheet === "followers" ? "Followers" : "Following"}
              </h2>
              <button onClick={() => setFollowSheet(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ overflowY: "auto", paddingBottom: 40 }}>
              {followListLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid rgba(26,158,66,0.3)", borderTopColor: "#1a9e42", animation: "spin 0.8s linear infinite" }} />
                </div>
              ) : followList.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
                  {followSheet === "followers" ? "No followers yet" : "Not following anyone yet"}
                </div>
              ) : followList.map(u => (
                <button key={u.id} onClick={() => { setFollowSheet(null); router.push(`/profile/${u.id}`); }}
                  style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(26,158,66,0.15)", border: "1px solid rgba(26,158,66,0.2)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {u.avatarUrl
                      ? <img src={u.avatarUrl} alt={u.username || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#1a9e42" }}>{(u.displayName || u.username || "?")[0].toUpperCase()}</span>
                    }
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{u.displayName}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>@{u.username}</div>
                  </div>
                  <svg style={{ marginLeft: "auto" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
