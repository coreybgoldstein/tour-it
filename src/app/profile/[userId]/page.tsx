"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { useLike } from "@/hooks/useLike";
import { useIsDesktop } from "@/hooks/useIsDesktop";

const SHOT_LABEL: Record<string, string> = {
  TEE_SHOT: "Tee Shot", APPROACH: "Approach", CHIP: "Chip", PITCH: "Pitch",
  PUTT: "Putt", BUNKER: "Bunker", LAY_UP: "Layup", FULL_HOLE: "Full Hole",
};

function ProfileFeedCard({
  clip, isActive, courseName, courseLogoUrl, onClose, onOptions, onReport, uploaderInfo, onComment, isOwner,
}: {
  clip: { id: string; mediaUrl: string; mediaType: string; courseId: string; holeNumber?: number | null; shotType?: string | null; isTagged?: boolean; likeCount?: number; commentCount?: number; strategyNote?: string | null; clubUsed?: string | null; windCondition?: string | null; landingZoneNote?: string | null; whatCameraDoesntShow?: string | null; datePlayedAt?: string | null };
  isActive: boolean;
  courseName: string | null;
  courseLogoUrl: string | null;
  onClose: () => void;
  onOptions?: () => void;
  onReport?: () => void;
  uploaderInfo: { id: string; username: string; avatarUrl: string | null };
  onComment: () => void;
  isOwner: boolean;
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
    const v = videoRef.current; if (!v) return;
    if (isActive) { v.play().catch(() => {}); setVideoPaused(false); }
    else { v.pause(); v.currentTime = 0; }
  }, [isActive]);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
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
    <div style={{ position: "relative", width: "100%", height: "100svh", background: "#000", display: "flex", justifyContent: "center" }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 390, height: "100%", overflow: "hidden" }}>
      <style>{`
        .pf-top-bar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 36px 14px 12px; z-index: 20; gap: 10px; }
        .pf-ctrl-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .pf-course-badge { width: 46px; height: 46px; border-radius: 12px; background: rgba(26,158,66,0.2); border: 1.5px solid rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #1a9e42; flex-shrink: 0; overflow: hidden; }
        .pf-right-actions { position: absolute; right: 14px; bottom: 100px; display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 30; }
        .pf-action-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; }
        .pf-action-icon { width: 46px; height: 46px; border-radius: 50%; background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; }
        .pf-action-label { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,0.95); }
      `}</style>

      {clip.mediaType === "VIDEO" ? (
        <video ref={videoRef} src={clip.mediaUrl} loop muted={muted} playsInline
          onClick={() => { const v = videoRef.current; if (!v) return; if (v.paused) { v.play().catch(() => {}); setVideoPaused(false); } else { v.pause(); setVideoPaused(true); } }}
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
          {isOwner && !clip.isTagged && onOptions ? (
            <button className="pf-ctrl-btn" onClick={onOptions}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </button>
          ) : !isOwner && onReport ? (
            <button className="pf-ctrl-btn" onClick={onReport}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </button>
          ) : null}
          <button className="pf-ctrl-btn" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <div className="pf-right-actions">
        <button className="pf-action-btn" onClick={() => router.push(`/profile/${uploaderInfo.id}`)}>
          <div style={{ position: "relative", width: 44, height: 44 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {uploaderInfo.avatarUrl ? <img src={uploaderInfo.avatarUrl} alt={uploaderInfo.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            </div>
            {clip.isTagged && (
              <div style={{ position: "absolute", bottom: -1, right: -1, width: 17, height: 17, borderRadius: "50%", background: "#4da862", border: "2px solid #07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              </div>
            )}
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
      </div>{/* end inner wrapper */}
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

type UserProfile = { id: string; username: string; displayName: string; avatarUrl: string | null; handicapIndex: number | null; homeCourseId: string | null; uploadCount: number; bio: string | null };
type Upload = { id: string; mediaUrl: string; mediaType: string; courseId: string; holeId: string; holeNumber?: number | null; createdAt: string; userId: string; likeCount?: number; commentCount?: number; shotType?: string | null; clubUsed?: string | null; windCondition?: string | null; strategyNote?: string | null; landingZoneNote?: string | null; whatCameraDoesntShow?: string | null; datePlayedAt?: string | null; isTagged?: boolean };
type CoursePlayed = { id: string; name: string; city: string; state: string; logoUrl: string | null };
type HomeCourse = { id: string; name: string };
type SavedCourse = { id: string; courseId: string; saveType: "PLAYED" | "BUCKET_LIST"; course: { id: string; name: string; city: string; state: string } };
type EditTagUser = { id: string; username: string; displayName: string; avatarUrl: string | null };
type FollowUser = { id: string; username: string; displayName: string; avatarUrl: string | null };

export default function ProfilePage() {
  const { userId } = useParams();
  const router = useRouter();
  const isDesktop = useIsDesktop();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [taggedUploads, setTaggedUploads] = useState<Upload[]>([]);
  const [coursesPlayed, setCoursesPlayed] = useState<CoursePlayed[]>([]);
  const [homeCourse, setHomeCourse] = useState<HomeCourse | null>(null);
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [coursesTab, setCoursesTab] = useState<"BUCKET_LIST" | "PLAYED" | "UPLOADED">("BUCKET_LIST");
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserMeta, setCurrentUserMeta] = useState<{ username: string; avatarUrl: string | null } | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Owner: edit profile
  const [showEdit, setShowEdit] = useState(false);
  const [editHandicap, setEditHandicap] = useState("");
  const [editHomeCourseSearch, setEditHomeCourseSearch] = useState("");
  const [editHomeCourseResults, setEditHomeCourseResults] = useState<HomeCourse[]>([]);
  const [editHomeCourseLoading, setEditHomeCourseLoading] = useState(false);
  const editHomeCourseDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Owner: clip edit/delete
  const [selectedClip, setSelectedClip] = useState<Upload | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editData, setEditData] = useState<{ holeNumber: number | null; shotType: string; strategyNote: string; clubUsed: string; windCondition: string; landingZoneNote: string; whatCameraDoesntShow: string; taggedUsers: EditTagUser[]; originalTagIds: Set<string> } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editTagInput, setEditTagInput] = useState("");
  const [editTagResults, setEditTagResults] = useState<EditTagUser[]>([]);
  const editTagDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Feed
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedActiveIdx, setFeedActiveIdx] = useState(0);
  const feedScrollRef = useRef<HTMLDivElement>(null);

  // Comments
  const [commentUploadId, setCommentUploadId] = useState<string | null>(null);
  const [commentItems, setCommentItems] = useState<{ id: string; body: string; username: string; avatarUrl: string | null; createdAt: string }[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [mentionResults, setMentionResults] = useState<{ id: string; username: string; displayName: string; avatarUrl: string | null }[]>([]);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const mentionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Followers/Following
  const [followSheet, setFollowSheet] = useState<"followers" | "following" | null>(null);
  const [followList, setFollowList] = useState<FollowUser[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  // Delete account
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Report clip
  const [reportClipId, setReportClipId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  // Edit home course debounce
  useEffect(() => {
    if (editHomeCourseDebounce.current) clearTimeout(editHomeCourseDebounce.current);
    if (!editHomeCourseSearch.trim()) { setEditHomeCourseResults([]); return; }
    setEditHomeCourseLoading(true);
    editHomeCourseDebounce.current = setTimeout(async () => {
      const { data } = await createClient().from("Course").select("id, name").ilike("name", `%${editHomeCourseSearch.trim()}%`).limit(6);
      setEditHomeCourseResults(data || []);
      setEditHomeCourseLoading(false);
    }, 200);
  }, [editHomeCourseSearch]);

  // Edit tag debounce
  useEffect(() => {
    if (editTagDebounce.current) clearTimeout(editTagDebounce.current);
    if (!editTagInput.trim()) { setEditTagResults([]); return; }
    editTagDebounce.current = setTimeout(async () => {
      const taggedIds = new Set(editData?.taggedUsers.map(u => u.id) || []);
      const { data } = await createClient().from("User").select("id, username, displayName, avatarUrl").ilike("username", `%${editTagInput.trim()}%`).limit(6);
      setEditTagResults((data || []).filter((u: EditTagUser) => !taggedIds.has(u.id)));
    }, 280);
  }, [editTagInput, editData?.taggedUsers]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const owner = authUser?.id === userId;
      if (authUser) {
        setCurrentUserId(authUser.id);
        setIsOwner(owner);
        const { data: me } = await supabase.from("User").select("username, avatarUrl").eq("id", authUser.id).single();
        if (me) setCurrentUserMeta({ username: me.username, avatarUrl: me.avatarUrl });
      }

      const { data: profileData, error } = await supabase.from("User").select("id, username, displayName, avatarUrl, handicapIndex, homeCourseId, uploadCount, bio").eq("id", userId).single();
      if (error || !profileData) { setNotFound(true); setLoading(false); return; }
      setProfile(profileData);
      if (owner) setEditHandicap(profileData.handicapIndex?.toString() || "");

      const [{ data: rawUploads }, { count: followers }, { count: following }] = await Promise.all([
        owner
          ? supabase.from("Upload").select("id, mediaUrl, mediaType, courseId, holeId, createdAt, userId, likeCount, commentCount, shotType, clubUsed, windCondition, strategyNote, landingZoneNote, whatCameraDoesntShow, datePlayedAt").eq("userId", userId).order("createdAt", { ascending: false })
          : supabase.from("Upload").select("id, mediaUrl, mediaType, courseId, holeId, createdAt, userId, likeCount, commentCount, shotType, clubUsed, windCondition, strategyNote, landingZoneNote, whatCameraDoesntShow, datePlayedAt").eq("userId", userId).eq("moderationStatus", "APPROVED").order("createdAt", { ascending: false }),
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

      setUploads(userUploads.map((u: any) => ({ ...u, isTagged: false })));
      setFollowerCount(followers || 0);
      setFollowingCount(following || 0);

      if (authUser && !owner) {
        const { data: followRecord } = await supabase.from("Follow").select("id, status").eq("followerId", authUser.id).eq("followingId", userId).single();
        if (followRecord?.status === "ACTIVE") setIsFollowing(true);
      }

      if (profileData.homeCourseId) {
        const { data: hc } = await supabase.from("Course").select("id, name").eq("id", profileData.homeCourseId).single();
        setHomeCourse(hc);
      }

      // Owner-only: tagged clips + saved courses
      if (owner && authUser) {
        const { data: tagRows } = await supabase.from("UploadTag").select("uploadId").eq("userId", authUser.id).eq("approved", true);
        if (tagRows && tagRows.length > 0) {
          const taggedUploadIds = tagRows.map((t: any) => t.uploadId);
          const { data: taggedData } = await supabase.from("Upload").select("id, mediaUrl, mediaType, courseId, holeId, createdAt, userId, likeCount, commentCount, shotType, clubUsed, windCondition, strategyNote, landingZoneNote, whatCameraDoesntShow, datePlayedAt").in("id", taggedUploadIds).order("createdAt", { ascending: false });
          if (taggedData && taggedData.length > 0) {
            const taggedHoleIds = [...new Set(taggedData.map((u: any) => u.holeId).filter(Boolean))];
            const { data: taggedHoles } = await supabase.from("Hole").select("id, holeNumber").in("id", taggedHoleIds);
            const taggedHoleMap = new Map(taggedHoles?.map((h: any) => [h.id, h.holeNumber]) || []);
            setTaggedUploads(taggedData.map((u: any) => ({ ...u, holeNumber: taggedHoleMap.get(u.holeId) || null, isTagged: true })));
          }
        }
        const { data: saves } = await supabase.from("Save").select("id, courseId, saveType").eq("userId", authUser.id).not("courseId", "is", null);
        if (saves && saves.length > 0) {
          const savedCourseIds = saves.map((s: any) => s.courseId);
          const { data: savedCoursesData } = await supabase.from("Course").select("id, name, city, state").in("id", savedCourseIds);
          setSavedCourses(saves.map((s: any) => ({ ...s, course: savedCoursesData?.find((c: any) => c.id === s.courseId) || { id: s.courseId, name: "Unknown", city: "", state: "" } })));
        }
        // Assign avatar if missing
        if (!profileData.avatarUrl) {
          const SUPABASE_STORAGE = "https://awlbxzpevwidowxxvuef.supabase.co/storage/v1/object/public/tour-it-photos";
          const DEFAULT_AVATARS = ["01-coffee","02-burger-messy","03-golf-glove","04-sunscreen","05-rangefinder","06-hotdog","07-protein-bar","08-driver","09-cheeseburger","11-hamburger","12-water-jug","13-bloody-mary","14-cocktail","15-beer-can"].map(n => `${SUPABASE_STORAGE}/default-avatars/${n}.png`);
          const avatarUrl = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
          await supabase.from("User").update({ avatarUrl }).eq("id", authUser.id);
          setProfile(p => p ? { ...p, avatarUrl } : p);
        }
      }

      setLoading(false);
    }
    load();
  }, [userId]);

  // Comment load
  useEffect(() => {
    if (!commentUploadId) { setCommentItems([]); return; }
    setLoadingComments(true);
    createClient().from("Comment").select("id, body, createdAt, userId, User:userId(username, avatarUrl)").eq("uploadId", commentUploadId).order("createdAt", { ascending: true })
      .then(({ data }) => {
        if (data) setCommentItems(data.map((c: any) => ({ id: c.id, body: c.body, createdAt: c.createdAt, username: c.User?.username || "golfer", avatarUrl: c.User?.avatarUrl || null })));
        setLoadingComments(false);
      });
  }, [commentUploadId]);

  function handleCommentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCommentText(val);
    const cursor = e.target.selectionStart ?? val.length;
    const match = val.slice(0, cursor).match(/@(\w*)$/);
    if (match && match[1].length >= 1) {
      if (mentionDebounce.current) clearTimeout(mentionDebounce.current);
      mentionDebounce.current = setTimeout(async () => {
        const { data } = await createClient().from("User").select("id, username, displayName, avatarUrl").ilike("username", `%${match[1]}%`).limit(5);
        setMentionResults(data || []);
      }, 200);
    } else { setMentionResults([]); }
  }

  function selectMention(username: string) {
    const input = commentInputRef.current; if (!input) return;
    const cursor = input.selectionStart ?? commentText.length;
    const before = commentText.slice(0, cursor).replace(/@(\w*)$/, `@${username} `);
    setCommentText(before + commentText.slice(cursor));
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
    setCommentText(""); setSubmittingComment(false);
  }

  async function handleFollow() {
    if (!currentUserId || !userId || followLoading) return;
    setFollowLoading(true);
    const supabase = createClient();
    if (isFollowing) {
      await supabase.from("Follow").delete().eq("followerId", currentUserId).eq("followingId", userId);
      setIsFollowing(false); setFollowerCount(prev => Math.max(0, prev - 1));
    } else {
      await supabase.from("Follow").insert({ id: crypto.randomUUID(), followerId: currentUserId, followingId: userId, status: "ACTIVE", createdAt: new Date().toISOString() });
      setIsFollowing(true); setFollowerCount(prev => prev + 1);
    }
    setFollowLoading(false);
  }

  async function openFollowSheet(type: "followers" | "following") {
    if (!profile) return;
    setFollowSheet(type); setFollowList([]); setFollowListLoading(true);
    const supabase = createClient();
    const col = type === "followers" ? "followerId" : "followingId";
    const { data } = await supabase.from("Follow").select(col).eq(type === "followers" ? "followingId" : "followerId", profile.id).eq("status", "ACTIVE");
    const ids = (data || []).map((r: any) => r[col]);
    if (ids.length > 0) { const { data: users } = await supabase.from("User").select("id, username, displayName, avatarUrl").in("id", ids); setFollowList(users || []); }
    setFollowListLoading(false);
  }

  async function handleLogout() {
    await createClient().auth.signOut();
    router.push("/");
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !profile || !isOwner) return;
    setUploadingAvatar(true);
    const file = e.target.files[0];
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${profile.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("tour-it-photos").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(path);
      await supabase.from("User").update({ avatarUrl: publicUrl }).eq("id", profile.id);
      setProfile(p => p ? { ...p, avatarUrl: publicUrl } : p);
    }
    setUploadingAvatar(false);
  }

  async function handleSaveProfile() {
    if (!profile || !isOwner) return;
    setSaving(true);
    const hcp = editHandicap ? parseFloat(editHandicap) : null;
    await createClient().from("User").update({ handicapIndex: hcp, homeCourseId: homeCourse?.id ?? null, updatedAt: new Date().toISOString() }).eq("id", profile.id);
    setProfile(p => p ? { ...p, handicapIndex: hcp } : p);
    setSaving(false); setShowEdit(false); setEditHomeCourseSearch(""); setEditHomeCourseResults([]);
  }

  async function openClipEdit() {
    if (!selectedClip) return;
    setEditLoading(true); setShowEditSheet(true); setEditTagInput(""); setEditTagResults([]);
    const supabase = createClient();
    const [{ data }, { data: tagRows }] = await Promise.all([
      supabase.from("Upload").select("shotType, clubUsed, windCondition, strategyNote, landingZoneNote, whatCameraDoesntShow").eq("id", selectedClip.id).single(),
      supabase.from("UploadTag").select("userId, user:User(id, username, displayName, avatarUrl)").eq("uploadId", selectedClip.id),
    ]);
    const existingTagged: EditTagUser[] = (tagRows || []).map((r: any) => r.user).filter(Boolean);
    setEditData({ holeNumber: selectedClip.holeNumber ?? null, shotType: data?.shotType || "", strategyNote: data?.strategyNote || "", clubUsed: data?.clubUsed || "", windCondition: data?.windCondition || "", landingZoneNote: data?.landingZoneNote || "", whatCameraDoesntShow: data?.whatCameraDoesntShow || "", taggedUsers: existingTagged, originalTagIds: new Set(existingTagged.map(u => u.id)) });
    setEditLoading(false);
  }

  async function saveClipEdit() {
    if (!selectedClip || !editData || editSaving) return;
    setEditSaving(true);
    const supabase = createClient();
    let holeId = selectedClip.holeId;
    if (editData.holeNumber && editData.holeNumber !== selectedClip.holeNumber) {
      const { data: existing } = await supabase.from("Hole").select("id").eq("courseId", selectedClip.courseId).eq("holeNumber", editData.holeNumber).maybeSingle();
      if (existing?.id) { holeId = existing.id; } else {
        const newId = crypto.randomUUID(); const now = new Date().toISOString();
        await supabase.from("Hole").insert({ id: newId, courseId: selectedClip.courseId, holeNumber: editData.holeNumber, par: 0, uploadCount: 0, createdAt: now, updatedAt: now });
        holeId = newId;
      }
    }
    await supabase.from("Upload").update({ holeId, shotType: editData.shotType || null, clubUsed: editData.clubUsed || null, windCondition: editData.windCondition || null, strategyNote: editData.strategyNote || null, landingZoneNote: editData.landingZoneNote || null, whatCameraDoesntShow: editData.whatCameraDoesntShow || null, updatedAt: new Date().toISOString() }).eq("id", selectedClip.id);
    const currentIds = new Set(editData.taggedUsers.map(u => u.id));
    const removedIds = [...editData.originalTagIds].filter(id => !currentIds.has(id));
    const addedUsers = editData.taggedUsers.filter(u => !editData.originalTagIds.has(u.id));
    if (removedIds.length > 0) await supabase.from("UploadTag").delete().eq("uploadId", selectedClip.id).in("userId", removedIds);
    if (addedUsers.length > 0) {
      const now = new Date().toISOString();
      await supabase.from("UploadTag").insert(addedUsers.map(u => ({ id: crypto.randomUUID(), uploadId: selectedClip.id, userId: u.id, createdAt: now })));
    }
    setUploads(prev => prev.map(u => u.id === selectedClip.id ? { ...u, holeNumber: editData.holeNumber ?? u.holeNumber, holeId } : u));
    setEditSaving(false); setShowEditSheet(false);
  }

  async function handleDeleteClip() {
    if (!selectedClip) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      const url = selectedClip.mediaUrl;
      const bucket = selectedClip.mediaType === "VIDEO" ? "tour-it-videos" : "tour-it-photos";
      const bucketIndex = url.indexOf(`/${bucket}/`);
      if (bucketIndex !== -1) await supabase.storage.from(bucket).remove([url.substring(bucketIndex + bucket.length + 2)]);
      await supabase.from("Upload").delete().eq("id", selectedClip.id);
      setUploads(prev => prev.filter(u => u.id !== selectedClip.id));
    } catch {}
    setDeleting(false); setSelectedClip(null); setConfirmDelete(false);
  }

  if (loading) return (
    <main style={{ background: "#07100a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", fontFamily: "'Outfit', sans-serif" }}>Loading...</div>
    </main>
  );

  if (notFound || !profile) return (
    <main style={{ background: "#07100a", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@300;400;500;600&display=swap');`}</style>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>User not found</h1>
      <button onClick={() => router.push("/")} style={{ background: "#2d7a42", border: "none", borderRadius: 10, padding: "10px 24px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Go home</button>
    </main>
  );

  const initials = profile.displayName?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  const allClips = [
    ...uploads,
    ...(isOwner ? taggedUploads : []),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const openFeed = (idx: number) => {
    setFeedActiveIdx(idx);
    setFeedOpen(true);
    setTimeout(() => { feedScrollRef.current?.scrollTo({ top: idx * window.innerHeight, behavior: "instant" }); }, 0);
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
        <div ref={feedScrollRef}
          onScroll={e => setFeedActiveIdx(Math.round((e.target as HTMLElement).scrollTop / window.innerHeight))}
          style={{ position: "fixed", inset: 0, left: isDesktop ? 72 : 0, zIndex: 100, background: "#000", overflowY: "scroll", scrollSnapType: "y mandatory", scrollbarWidth: "none" }}>
          {allClips.map((clip, idx) => (
            <div key={clip.id + (clip.isTagged ? "-t" : "")} style={{ scrollSnapAlign: "start", scrollSnapStop: "always", height: "100svh", width: "100vw" }}>
              <ProfileFeedCard
                clip={clip}
                isActive={idx === feedActiveIdx}
                courseName={coursesPlayed.find(c => c.id === clip.courseId)?.name ?? null}
                courseLogoUrl={coursesPlayed.find(c => c.id === clip.courseId)?.logoUrl ?? null}
                onClose={() => setFeedOpen(false)}
                onOptions={isOwner ? () => { setFeedOpen(false); setSelectedClip(clip); } : undefined}
                onReport={!isOwner && currentUserId ? () => { setFeedOpen(false); setReportClipId(clip.id); } : undefined}
                uploaderInfo={{ id: profile.id, username: profile.username, avatarUrl: profile.avatarUrl }}
                onComment={() => setCommentUploadId(clip.id)}
                isOwner={isOwner}
              />
            </div>
          ))}
        </div>
      )}

      {/* Owner: clip options sheet (edit or delete) */}
      {isOwner && selectedClip && !showEditSheet && !confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={() => setSelectedClip(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "#0d1f12", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, margin: "0 auto 20px" }} />
            <button onClick={openClipEdit} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, cursor: "pointer", marginBottom: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>Edit clip</span>
            </button>
            <button onClick={() => setConfirmDelete(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "rgba(220,60,60,0.08)", border: "1px solid rgba(220,60,60,0.2)", borderRadius: 14, cursor: "pointer", marginBottom: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(220,60,60,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(220,60,60,0.85)" }}>Delete clip</span>
            </button>
            <button onClick={() => setSelectedClip(null)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.45)", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Owner: edit clip sheet */}
      {isOwner && selectedClip && showEditSheet && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={() => setShowEditSheet(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "#0d1f12", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", maxHeight: "82vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Edit clip</div>
            {editLoading || !editData ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}><div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(26,158,66,0.3)", borderTopColor: "#1a9e42", animation: "spin 0.8s linear infinite" }} /></div>
            ) : (
              <>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Hole</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                      <button key={n} onClick={() => setEditData(d => d ? { ...d, holeNumber: n } : d)}
                        style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${editData.holeNumber === n ? "rgba(26,158,66,0.6)" : "rgba(255,255,255,0.1)"}`, background: editData.holeNumber === n ? "rgba(26,158,66,0.2)" : "rgba(255,255,255,0.04)", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: editData.holeNumber === n ? "#1a9e42" : "rgba(255,255,255,0.45)", cursor: "pointer" }}>{n}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Shot type</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {[{ label: "Tee Shot", value: "TEE_SHOT" }, { label: "Approach", value: "APPROACH" }, { label: "Chip", value: "CHIP" }, { label: "Pitch", value: "PITCH" }, { label: "Putt", value: "PUTT" }, { label: "Bunker", value: "BUNKER" }, { label: "Layup", value: "LAY_UP" }, { label: "Full Hole", value: "FULL_HOLE" }].map(s => (
                      <button key={s.value} onClick={() => setEditData(d => d ? { ...d, shotType: s.value } : d)}
                        style={{ padding: "6px 12px", borderRadius: 99, border: `1px solid ${editData.shotType === s.value ? "rgba(26,158,66,0.6)" : "rgba(255,255,255,0.1)"}`, background: editData.shotType === s.value ? "rgba(26,158,66,0.2)" : "rgba(255,255,255,0.04)", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: editData.shotType === s.value ? "#1a9e42" : "rgba(255,255,255,0.45)", cursor: "pointer", whiteSpace: "nowrap" }}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Notes</div>
                  <textarea value={editData.strategyNote} onChange={e => setEditData(d => d ? { ...d, strategyNote: e.target.value } : d)} rows={4}
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none", resize: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Club used</div>
                  <input value={editData.clubUsed} onChange={e => setEditData(d => d ? { ...d, clubUsed: e.target.value } : d)} placeholder="e.g. 7-iron, Driver…"
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Wind</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {[{ label: "Calm", value: "CALM" }, { label: "Into", value: "INTO" }, { label: "Downwind", value: "DOWNWIND" }, { label: "Left→Right", value: "LEFT_TO_RIGHT" }, { label: "Right→Left", value: "RIGHT_TO_LEFT" }].map(w => (
                      <button key={w.value} onClick={() => setEditData(d => d ? { ...d, windCondition: d.windCondition === w.value ? "" : w.value } : d)}
                        style={{ padding: "6px 12px", borderRadius: 99, border: `1px solid ${editData.windCondition === w.value ? "rgba(26,158,66,0.6)" : "rgba(255,255,255,0.1)"}`, background: editData.windCondition === w.value ? "rgba(26,158,66,0.2)" : "rgba(255,255,255,0.04)", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: editData.windCondition === w.value ? "#1a9e42" : "rgba(255,255,255,0.45)", cursor: "pointer", whiteSpace: "nowrap" }}>{w.label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Tag players</div>
                  {editData.taggedUsers.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {editData.taggedUsers.map(u => (
                        <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(26,158,66,0.12)", border: "1px solid rgba(26,158,66,0.3)", borderRadius: 99, padding: "3px 8px 3px 5px" }}>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#1a9e42" }}>@{u.username}</span>
                          <button onClick={() => setEditData(d => d ? { ...d, taggedUsers: d.taggedUsers.filter(t => t.id !== u.id) } : d)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input value={editTagInput} onChange={e => setEditTagInput(e.target.value)} placeholder="Search by username…"
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box" }} />
                  {editTagResults.length > 0 && (
                    <div style={{ marginTop: 6, background: "rgba(0,0,0,0.3)", borderRadius: 10, overflow: "hidden" }}>
                      {editTagResults.map(u => (
                        <button key={u.id} onClick={() => { setEditData(d => d ? { ...d, taggedUsers: [...d.taggedUsers, u] } : d); setEditTagInput(""); setEditTagResults([]); }}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", background: "rgba(26,158,66,0.15)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {u.avatarUrl ? <img src={u.avatarUrl} alt={u.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10, color: "#1a9e42", fontWeight: 700 }}>{u.username[0]?.toUpperCase()}</span>}
                          </div>
                          <div>
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>@{u.username}</div>
                            {u.displayName && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{u.displayName}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={saveClipEdit} disabled={editSaving}
                  style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 14, padding: "15px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: editSaving ? 0.6 : 1 }}>
                  {editSaving ? "Saving…" : "Save changes"}
                </button>
                <button onClick={() => { setShowEditSheet(false); setConfirmDelete(true); }}
                  style={{ width: "100%", background: "none", border: "1px solid rgba(220,60,60,0.3)", borderRadius: 14, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "rgba(220,100,100,0.8)", cursor: "pointer", marginTop: 10 }}>
                  Delete clip
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Owner: confirm delete */}
      {isOwner && selectedClip && confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
          <div style={{ width: "100%", background: "#0d1f12", borderRadius: "20px 20px 0 0", padding: "28px 20px 40px" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8, textAlign: "center" }}>Delete this clip?</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>This can&apos;t be undone.</div>
            <button onClick={handleDeleteClip} disabled={deleting} style={{ width: "100%", background: "rgba(220,60,60,0.85)", border: "none", borderRadius: 14, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff", cursor: "pointer", marginBottom: 10, opacity: deleting ? 0.6 : 1 }}>
              {deleting ? "Deleting..." : "Yes, delete it"}
            </button>
            <button onClick={() => { setConfirmDelete(false); setSelectedClip(null); }} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Owner: edit profile sheet */}
      {isOwner && showEdit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", zIndex: 150 }} onClick={() => setShowEdit(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "#0d1f12", borderRadius: "20px 20px 0 0", padding: "20px 20px 44px", maxHeight: "56vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, margin: "0 auto 18px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#1a3320", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
                {profile.avatarUrl ? <img src={profile.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#1a9e42" }}>@{profile.username}</div>
              </div>
              <button onClick={() => fileInputRef.current?.click()} style={{ padding: "7px 14px", background: "rgba(26,158,66,0.15)", border: "1px solid rgba(26,158,66,0.3)", borderRadius: 99, fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#1a9e42", cursor: "pointer", whiteSpace: "nowrap" }}>
                {uploadingAvatar ? "Uploading…" : "Change photo"}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6, fontFamily: "'Outfit', sans-serif" }}>Handicap index</label>
              <input type="number" step="0.1" min="-10" max="54" placeholder="e.g. 8.4" value={editHandicap} onChange={e => setEditHandicap(e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "'Outfit', sans-serif" }} />
            </div>
            <div style={{ position: "relative", marginBottom: 20 }}>
              <label style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6, fontFamily: "'Outfit', sans-serif" }}>Home course</label>
              {homeCourse && !editHomeCourseSearch && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(26,158,66,0.08)", border: "1px solid rgba(26,158,66,0.2)", borderRadius: 10, padding: "8px 12px", marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{homeCourse.name}</span>
                  <button onClick={() => setHomeCourse(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}
              <input placeholder={homeCourse ? "Search to change..." : "Search courses..."} value={editHomeCourseSearch} onChange={e => setEditHomeCourseSearch(e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "'Outfit', sans-serif" }} />
              {editHomeCourseLoading && <div style={{ position: "absolute", right: 10, top: 38, width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(26,158,66,0.3)", borderTopColor: "#1a9e42", animation: "spin 0.6s linear infinite" }} />}
              {editHomeCourseResults.length > 0 && (
                <div style={{ position: "absolute", left: 0, right: 0, top: "100%", background: "#0d1f12", border: "1px solid rgba(26,158,66,0.15)", borderRadius: 10, overflow: "hidden", zIndex: 50, marginTop: 4 }}>
                  {editHomeCourseResults.map(c => (
                    <button key={c.id} onClick={() => { setHomeCourse(c); setEditHomeCourseSearch(""); setEditHomeCourseResults([]); }}
                      style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", cursor: "pointer", textAlign: "left" }}>{c.name}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleSaveProfile} style={{ width: "100%", padding: "12px", background: "#1a9e42", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
              <button onClick={() => { setShowEdit(false); setShowDeleteAccount(true); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,100,100,0.45)", padding: "4px 0" }}>
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account confirmation */}
      {showDeleteAccount && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={() => setShowDeleteAccount(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "#0d1f12", borderRadius: "20px 20px 0 0", padding: "24px 20px 44px" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, color: "#fff", marginBottom: 8, textAlign: "center" }}>Delete your account?</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
              All your clips, likes, and data will be permanently deleted. This cannot be undone.
            </div>
            <button
              onClick={async () => {
                setDeletingAccount(true);
                const supabase = createClient();
                await supabase.from("User").delete().eq("id", currentUserId!);
                await supabase.auth.signOut();
                router.replace("/login");
              }}
              disabled={deletingAccount}
              style={{ width: "100%", background: "rgba(200,50,50,0.8)", border: "none", borderRadius: 14, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff", cursor: "pointer", marginBottom: 10, opacity: deletingAccount ? 0.6 : 1 }}
            >
              {deletingAccount ? "Deleting…" : "Yes, delete my account"}
            </button>
            <button onClick={() => setShowDeleteAccount(false)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Report clip sheet */}
      {reportClipId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={() => { setReportClipId(null); setReportReason(null); setReportDone(false); }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "#0d1f12", borderRadius: "20px 20px 0 0", padding: "20px 20px 44px" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, margin: "0 auto 18px" }} />
            {reportDone ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Report submitted</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Thanks for keeping Tour It quality.</div>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>Report clip</div>
                {[
                  { value: "WRONG_HOLE", label: "Wrong hole" },
                  { value: "WRONG_COURSE", label: "Wrong course" },
                  { value: "LOW_QUALITY", label: "Low quality / unviewable" },
                  { value: "INAPPROPRIATE", label: "Inappropriate content" },
                  { value: "SPAM", label: "Spam" },
                  { value: "COPYRIGHT", label: "Copyright issue" },
                  { value: "OTHER", label: "Other" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setReportReason(opt.value)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: reportReason === opt.value ? "rgba(255,255,255,0.06)" : "none", border: reportReason === opt.value ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent", borderRadius: 10, padding: "11px 14px", marginBottom: 6, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.75)", textAlign: "left" }}
                  >
                    {opt.label}
                    {reportReason === opt.value && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                ))}
                <button
                  disabled={!reportReason || submittingReport}
                  onClick={async () => {
                    if (!reportReason || !currentUserId) return;
                    setSubmittingReport(true);
                    await createClient().from("ModerationReport").insert({ id: crypto.randomUUID(), reportedById: currentUserId, uploadId: reportClipId, reason: reportReason, createdAt: new Date().toISOString() });
                    setSubmittingReport(false);
                    setReportDone(true);
                    setTimeout(() => { setReportClipId(null); setReportReason(null); setReportDone(false); }, 1800);
                  }}
                  style={{ width: "100%", marginTop: 8, background: reportReason ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: reportReason ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)", cursor: reportReason ? "pointer" : "not-allowed" }}
                >
                  {submittingReport ? "Submitting…" : "Submit report"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hamburger drawer */}
      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300 }}>
          <div onClick={() => setMenuOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "72vw", maxWidth: 300, background: "#07100a", borderRight: "1px solid rgba(77,168,98,0.18)", display: "flex", flexDirection: "column", paddingTop: 64, paddingBottom: 40 }}>
            <button onClick={() => setMenuOpen(false)} style={{ position: "absolute", top: 18, right: 16, background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div style={{ paddingLeft: 24, paddingBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 36, width: "auto" }} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 12 }}>
              {[
                { label: "My Profile", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, onClick: () => { setMenuOpen(false); router.push("/profile"); } },
                { label: "My Trips", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>, onClick: () => { setMenuOpen(false); router.push("/trips"); } },
                { label: "Privacy Policy", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, onClick: () => { setMenuOpen(false); router.push("/privacy"); } },
                { label: "Contact Us", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, onClick: () => { setMenuOpen(false); window.location.href = "mailto:corey@touritgolf.com"; } },
              ].map(item => (
                <button key={item.label} onClick={item.onClick} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.82)", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 500, textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(77,168,98,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ color: "#4da862", flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
            <button
              onClick={async () => { setMenuOpen(false); await createClient().auth.signOut(); router.push("/login"); }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", background: "none", border: "none", borderTop: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", color: "rgba(255,100,100,0.8)", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 500, width: "100%", textAlign: "left" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Log Out
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", gap: 8 }}>
        {isOwner ? (
          <button onClick={() => setMenuOpen(true)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer" }}>
            <span style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.85)", borderRadius: 99, display: "block" }} />
            <span style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.85)", borderRadius: 99, display: "block" }} />
            <span style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.85)", borderRadius: 99, display: "block" }} />
          </button>
        ) : (
          <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        )}
      </div>

      {/* Avatar + identity */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 10, paddingBottom: 14 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: profile.avatarUrl ? "transparent" : "#1a3320", border: "3px solid #07100a", outline: "2.5px solid rgba(26,158,66,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px", fontWeight: 600, color: "rgba(255,255,255,0.6)", overflow: "hidden" }}>
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (uploadingAvatar ? <span style={{ fontSize: 12 }}>…</span> : initials)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 700, color: "#1a9e42", lineHeight: 1.2 }}>@{profile.username}</div>
          {isOwner && (
            <button onClick={() => setShowEdit(true)} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
        </div>
        {(profile.handicapIndex !== null || homeCourse) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: isOwner ? 0 : 12 }}>
            {profile.handicapIndex !== null && <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "4px 10px", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{profile.handicapIndex} hcp</div>}
            {homeCourse && <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "4px 10px", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{homeCourse.name}</div>}
          </div>
        )}
        {!isOwner && currentUserId && (
          <button onClick={handleFollow} disabled={followLoading} style={{ marginTop: 10, padding: "10px 32px", borderRadius: 10, border: isFollowing ? "1px solid rgba(255,255,255,0.15)" : "none", background: isFollowing ? "rgba(255,255,255,0.06)" : "#2d7a42", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: isFollowing ? "rgba(255,255,255,0.6)" : "#fff", cursor: "pointer", opacity: followLoading ? 0.6 : 1 }}>
            {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
          </button>
        )}
        {!isOwner && !currentUserId && (
          <button onClick={() => router.push("/login")} style={{ marginTop: 10, padding: "10px 32px", borderRadius: 10, background: "#2d7a42", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Log in to follow</button>
        )}
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", justifyContent: "space-around", padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
        {[
          { num: allClips.length, label: "Clips", onClick: undefined as (() => void) | undefined },
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

      {/* Courses section */}
      {isOwner ? (
        (savedCourses.length > 0 || coursesPlayed.length > 0) && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>My courses</div>
              <div style={{ display: "flex", gap: 4 }}>
                {(["BUCKET_LIST", "PLAYED", "UPLOADED"] as const).map(tab => (
                  <button key={tab} onClick={() => setCoursesTab(tab)} style={{ padding: "3px 8px", borderRadius: 99, border: "none", fontSize: 9, fontWeight: 600, cursor: "pointer", background: coursesTab === tab ? "rgba(26,158,66,0.2)" : "rgba(255,255,255,0.05)", color: coursesTab === tab ? "#1a9e42" : "rgba(255,255,255,0.35)" }}>
                    {tab === "BUCKET_LIST" ? "Bucket List" : tab === "PLAYED" ? "Played" : "Uploaded"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, padding: "0 20px", overflowX: "auto", paddingBottom: 2 }}>
              {coursesTab === "BUCKET_LIST" && (savedCourses.filter(s => s.saveType === "BUCKET_LIST").length === 0
                ? <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", padding: "6px 0" }}>No bucket list courses yet</div>
                : savedCourses.filter(s => s.saveType === "BUCKET_LIST").map(s => (
                  <button key={s.id} onClick={() => router.push(`/courses/${s.course.id}`)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(26,158,66,0.18)", borderRadius: 99, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#1a9e42", flexShrink: 0, display: "block" }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>{s.course.name}</span>
                  </button>
                )))}
              {coursesTab === "PLAYED" && (savedCourses.filter(s => s.saveType === "PLAYED").length === 0
                ? <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", padding: "6px 0" }}>No played courses marked yet</div>
                : savedCourses.filter(s => s.saveType === "PLAYED").map(s => (
                  <button key={s.id} onClick={() => router.push(`/courses/${s.course.id}`)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(26,158,66,0.18)", borderRadius: 99, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#1a9e42", flexShrink: 0, display: "block" }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>{s.course.name}</span>
                  </button>
                )))}
              {coursesTab === "UPLOADED" && (coursesPlayed.length === 0
                ? <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", padding: "6px 0" }}>No uploads yet</div>
                : coursesPlayed.map(c => (
                  <button key={c.id} onClick={() => router.push(`/courses/${c.id}`)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 99, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.3)", flexShrink: 0, display: "block" }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.65)" }}>{c.name}</span>
                  </button>
                )))}
            </div>
          </div>
        )
      ) : (
        coursesPlayed.length > 0 && (
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
        )
      )}

      {/* Clips grid */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Clips</div>
          {allClips.length > 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Tap to view</div>}
        </div>
        {allClips.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>No clips yet</div>
            {isOwner && <button onClick={() => router.push("/upload")} style={{ background: "#1a9e42", border: "none", borderRadius: 10, padding: "10px 24px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>Upload a clip</button>}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px", padding: "0 20px" }}>
            {allClips.map((upload, i) => (
              <div key={upload.id + (upload.isTagged ? "-t" : "")} className="clip-thumb" onClick={() => openFeed(i)}
                style={{ aspectRatio: "9/16", borderRadius: "6px", overflow: "hidden", position: "relative", cursor: "pointer", background: i % 3 === 0 ? "linear-gradient(180deg,#1a4d22 0%,#2d7a42 50%,#0f2e18 100%)" : i % 3 === 1 ? "linear-gradient(180deg,#0a2e14 0%,#1e5c30 50%,#0a1e10 100%)" : "linear-gradient(180deg,#1e3a10 0%,#3a6020 50%,#122010 100%)", transition: "opacity 0.15s" }}>
                {upload.mediaType === "PHOTO" ? <img src={upload.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <video src={upload.mediaUrl} muted playsInline preload="metadata" onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 0.001; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }} />
                <div style={{ position: "absolute", bottom: 6, left: 6, right: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1, marginRight: 4 }}>{coursesPlayed.find(c => c.id === upload.courseId)?.name || ""}</div>
                  <FlagBadge label={upload.holeNumber ?? "·"} />
                </div>
                {isOwner && (
                  <div style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: "50%", background: upload.isTagged ? "rgba(26,158,66,0.75)" : "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {upload.isTagged
                      ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                      : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                    }
                  </div>
                )}
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
              {loadingComments ? <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading...</div>
                : commentItems.length === 0 ? <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13, padding: "32px 0", lineHeight: 1.6 }}>No comments yet.<br />Be the first to say something!</div>
                : commentItems.map(c => (
                  <div key={c.id} style={{ display: "flex", gap: 10, paddingBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(26,158,66,0.2)", border: "1px solid rgba(26,158,66,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {c.avatarUrl ? <img src={c.avatarUrl} alt={c.username} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
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
                        {u.avatarUrl ? <img src={u.avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={u.username} /> : <span style={{ fontSize: 10, color: "#1a9e42", fontWeight: 700 }}>{u.username[0]?.toUpperCase()}</span>}
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
                <input ref={commentInputRef} value={commentText} onChange={handleCommentChange}
                  placeholder={currentUserId ? "Add a comment... use @ to tag" : "Log in to comment"} disabled={!currentUserId}
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }}
                  onKeyDown={e => { if (e.key === "Enter" && commentText.trim()) submitComment(); }} />
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
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>{followSheet === "followers" ? "Followers" : "Following"}</h2>
              <button onClick={() => setFollowSheet(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ overflowY: "auto", paddingBottom: 40 }}>
              {followListLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}><div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid rgba(26,158,66,0.3)", borderTopColor: "#1a9e42", animation: "spin 0.8s linear infinite" }} /></div>
              ) : followList.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)" }}>{followSheet === "followers" ? "No followers yet" : "Not following anyone yet"}</div>
              ) : followList.map(u => (
                <button key={u.id} onClick={() => { setFollowSheet(null); router.push(`/profile/${u.id}`); }}
                  style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(26,158,66,0.15)", border: "1px solid rgba(26,158,66,0.2)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {u.avatarUrl ? <img src={u.avatarUrl} alt={u.username || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#1a9e42" }}>{(u.displayName || u.username || "?")[0].toUpperCase()}</span>}
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
