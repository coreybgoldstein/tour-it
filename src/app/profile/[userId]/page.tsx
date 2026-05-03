"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { useLike } from "@/hooks/useLike";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { ClipTopPill } from "@/components/clip/ClipTopPill";
import { IntelPanel } from "@/components/clip/IntelPanel";
import { sessionMute } from "@/lib/sessionMute";
import { formatClipDate } from "@/lib/formatClipDate";
import { HlsVideo } from "@/components/HlsVideo";
import { getVideoSrc } from "@/lib/getVideoSrc";
import ProgressionTracker from "@/components/ProgressionTracker";
import { rateLimit } from "@/lib/rateLimit";
import { getRankColor, getRankRingBorder, isLegend } from "@/lib/rank-styles";

const SHOT_LABEL: Record<string, string> = {
  TEE_SHOT: "Tee Shot", APPROACH: "Approach", CHIP: "Chip", PITCH: "Pitch",
  PUTT: "Putt", BUNKER: "Bunker", LAY_UP: "Layup", FULL_HOLE: "Full Hole",
};

function ProfileFeedCard({
  clip, isActive, courseName, courseLogoUrl, courseLocation, onClose, onOptions, onReport, uploaderInfo, onComment, isOwner, currentUserId,
}: {
  clip: { id: string; mediaUrl: string; mediaType: string; cloudflareVideoId?: string | null; courseId: string; holeNumber?: number | null; holePar?: number | null; holeYardage?: number | null; shotType?: string | null; isTagged?: boolean; likeCount?: number; commentCount?: number; strategyNote?: string | null; clubUsed?: string | null; windCondition?: string | null; conditions?: string | null; landingZoneNote?: string | null; whatCameraDoesntShow?: string | null; datePlayedAt?: string | null; createdAt?: string | null };
  isActive: boolean;
  courseName: string | null;
  courseLogoUrl: string | null;
  courseLocation?: string | null;
  onClose: () => void;
  onOptions?: () => void;
  onReport?: () => void;
  uploaderInfo: { id: string; username: string; avatarUrl: string | null; handicapIndex?: number | null; rank?: string | null };
  onComment: () => void;
  isOwner: boolean;
  currentUserId?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [muted, setMuted] = useState(sessionMute.get());
  const [videoPaused, setVideoPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const { liked, likeCount, toggleLike } = useLike({ uploadId: clip.id, initialLikeCount: clip.likeCount || 0 });
  const hasNotes = !!(clip.strategyNote || clip.landingZoneNote || clip.whatCameraDoesntShow || clip.clubUsed || clip.windCondition || clip.datePlayedAt);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    if (isActive) { v.play().catch(() => {}); setVideoPaused(false); }
    else { v.pause(); v.currentTime = 0; setIntelOpen(false); }
  }, [isActive]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const handleMuteToggle = () => { const n = !muted; setMuted(n); sessionMute.set(n); };

  const handleShare = async () => {
    const url = `${window.location.origin}/courses/${clip.courseId}${clip.holeNumber ? `/holes/${clip.holeNumber}` : ""}`;
    try {
      if (navigator.share) await navigator.share({ title: courseName || "", url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch {}
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100svh", ...(isDesktop ? { background: "#000", display: "flex", justifyContent: "center" } : {}) }}>
      <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...(isDesktop ? { maxWidth: 390 } : {}) }}>

      {clip.mediaType === "VIDEO" ? (
        <HlsVideo ref={videoRef} src={getVideoSrc(clip.mediaUrl, clip.cloudflareVideoId)} loop muted={muted} playsInline
          onClick={() => { const v = videoRef.current; if (!v) return; if (v.paused) { v.play().catch(() => {}); setVideoPaused(false); } else { v.pause(); setVideoPaused(true); } }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} />
      ) : (
        <img src={clip.mediaUrl} alt="clip" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}

      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.65) 100%)", pointerEvents: "none", zIndex: 5 }} />

      {/* Close button */}
      <button onClick={onClose} style={{ position: "absolute", top: 52, left: 16, zIndex: 30, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      </button>

      {videoPaused && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 15, pointerEvents: "none", opacity: 0.7 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </div>
        </div>
      )}

      <ClipTopPill
        courseLogoUrl={courseLogoUrl}
        courseName={courseName ?? ""}
        courseLocation={courseLocation}
        holeNumber={clip.holeNumber}
        holePar={clip.holePar}
        holeYardage={clip.holeYardage}
        muted={muted}
        onMuteToggle={handleMuteToggle}
        onTapCourse={() => router.push(`/courses/${clip.courseId}`)}
        visible={true}
      />

      {/* Right rail: Intel → Avatar → Edit → Like → Comment → SEND IT */}
      <div style={{ position: "absolute", right: 12, bottom: 100, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, zIndex: 30 }}>
        {hasNotes && (
          <button onClick={() => setIntelOpen(o => !o)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: intelOpen ? "rgba(77,168,98,0.4)" : "rgba(77,168,98,0.25)", backdropFilter: "blur(8px)", border: "1.5px solid #4da862", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "0.5px", color: "rgba(255,255,255,0.85)", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>INTEL</span>
          </button>
        )}
        {/* Uploader avatar — directly below Intel */}
        <button onClick={() => router.push(`/profile/${uploaderInfo.id}`)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ position: "relative", width: 40, height: 40 }}>
            <div className={isLegend(uploaderInfo.rank) ? "legend-ring" : undefined} style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: getRankRingBorder(uploaderInfo.rank), background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {uploaderInfo.avatarUrl ? <img src={uploaderInfo.avatarUrl} alt={uploaderInfo.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            </div>
            {clip.isTagged && (
              <div style={{ position: "absolute", bottom: -1, right: -1, width: 15, height: 15, borderRadius: "50%", background: "#4da862", border: "2px solid #07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              </div>
            )}
          </div>
        </button>
        {/* Edit — own clips only */}
        {isOwner && !clip.isTagged && onOptions && (
          <button onClick={onOptions} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.8)" }}>Edit</span>
          </button>
        )}
        {/* Like */}
        <button onClick={toggleLike} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: liked ? "rgba(26,158,66,0.15)" : "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: `1px solid ${liked ? "rgba(26,158,66,0.7)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill={liked ? "#1a9e42" : "none"} stroke={liked ? "#1a9e42" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>{likeCount}</span>
        </button>
        {/* Comment */}
        <button onClick={onComment} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>{clip.commentCount || 0}</span>
        </button>
        {/* SEND IT */}
        <button onClick={handleShare} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: copied ? "rgba(26,158,66,0.2)" : "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: `1px solid ${copied ? "rgba(26,158,66,0.5)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {copied
              ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1 }}><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#4ade80", letterSpacing: "0.05em" }}>SENT</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
              : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginTop: 3 }}><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#fff", letterSpacing: "0.12em", marginRight: "-0.12em" }}>SEND</span><div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.25)", margin: "2px 0" }} /><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#4ade80", letterSpacing: "0.22em", marginRight: "-0.22em" }}>IT</span></div>
            }
          </div>
          <span style={{ height: 13, display: "block" }} />
        </button>
      </div>

      <IntelPanel
        open={intelOpen}
        onClose={() => setIntelOpen(false)}
        holeNumber={clip.holeNumber}
        holePar={clip.holePar}
        holeYardage={clip.holeYardage}
        clubUsed={clip.clubUsed}
        windCondition={clip.windCondition}
        conditions={clip.conditions}
        strategyNote={clip.strategyNote}
        landingZoneNote={clip.landingZoneNote}
        whatCameraDoesntShow={clip.whatCameraDoesntShow}
        datePlayedAt={clip.datePlayedAt}
        uploaderUsername={uploaderInfo.username}
        uploaderAvatarUrl={uploaderInfo.avatarUrl}
        uploaderId={uploaderInfo.id}
        currentUserId={currentUserId}
        uploaderHandicap={uploaderInfo.handicapIndex}
      />
      {formatClipDate(clip.datePlayedAt, clip.createdAt) && (
        <div style={{ position: "absolute", left: 16, bottom: 108, zIndex: 10, pointerEvents: "none" }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.45)", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
            {formatClipDate(clip.datePlayedAt, clip.createdAt)}
          </span>
        </div>
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

const RARITY_COLOR: Record<string, string> = {
  COMMON: "rgba(210,210,210,0.6)",
  UNCOMMON: "#4da862",
  RARE: "#60a5fa",
  EPIC: "#a78bfa",
  LEGENDARY: "#fbbf24",
};

const BADGE_EMOJI: Record<string, string> = {
  first_clip: "🎬", "5_clips": "📹", "10_clips": "🎯", "25_clips": "⭐",
  "50_clips": "🏅", "100_clips": "👑", course_pioneer: "🚩",
  hole_trailblazer: "🕳️", "5_courses": "🗺️", "10_courses": "🚗",
  "25_courses": "✈️", popular_clip: "🔥", viral_clip: "💫",
  legendary_clip: "⚡", "10_followers": "👥", "100_followers": "🌟",
};


type UserProfile = { id: string; username: string; displayName: string; avatarUrl: string | null; handicapIndex: number | null; homeCourseId: string | null; uploadCount: number; bio: string | null };
type Upload = { id: string; mediaUrl: string; cloudflareVideoId?: string | null; mediaType: string; courseId: string; holeId: string; holeNumber?: number | null; createdAt: string; userId: string; likeCount?: number; commentCount?: number; shotType?: string | null; clubUsed?: string | null; windCondition?: string | null; strategyNote?: string | null; landingZoneNote?: string | null; whatCameraDoesntShow?: string | null; datePlayedAt?: string | null; isTagged?: boolean };
type CoursePlayed = { id: string; name: string; city: string; state: string; logoUrl: string | null };
type HomeCourse = { id: string; name: string };
type SavedCourse = { id: string; courseId: string; saveType: "PLAYED" | "BUCKET_LIST"; course: { id: string; name: string; city: string; state: string } };
type Round = { id: string; courseId: string; date: string; totalScore: number | null; fairwaysHit: number | null; putts: number | null; notes: string | null; createdAt: string };
type EarnedBadge = import("@/types/badges").EarnedBadge;
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
  const [rounds, setRounds] = useState<Round[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<EarnedBadge | null>(null);
  const [profileTab, setProfileTab] = useState<"clips" | "rounds">("clips");
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserMeta, setCurrentUserMeta] = useState<{ username: string; avatarUrl: string | null } | null>(null);
  const [profileRank, setProfileRank] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Owner: edit profile
  const [showEdit, setShowEdit] = useState(false);
  const [editHandicap, setEditHandicap] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editHomeCourseSearch, setEditHomeCourseSearch] = useState("");
  const [editHomeCourseResults, setEditHomeCourseResults] = useState<HomeCourse[]>([]);
  const [editHomeCourseLoading, setEditHomeCourseLoading] = useState(false);
  const editHomeCourseDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
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
  const [commentItems, setCommentItems] = useState<{ id: string; body: string; username: string; avatarUrl: string | null; createdAt: string; rank?: string | null }[]>([]);
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
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

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

      const [{ data: profileData, error }, { data: progData }] = await Promise.all([
        supabase.from("User").select("id, username, displayName, avatarUrl, handicapIndex, homeCourseId, uploadCount, bio").eq("id", userId).single(),
        supabase.from("UserProgression").select("rank").eq("userId", userId).single(),
      ]);
      if (error || !profileData) { setNotFound(true); setLoading(false); return; }
      setProfile(profileData);
      if (progData?.rank) setProfileRank(progData.rank);
      if (owner) {
        setEditHandicap(profileData.handicapIndex?.toString() || "");
        setEditDisplayName(profileData.displayName || "");
        setEditBio(profileData.bio || "");
      }

      const [{ data: rawUploads }, { count: followers }, { count: following }] = await Promise.all([
        owner
          ? supabase.from("Upload").select("id, mediaUrl, cloudflareVideoId, mediaType, courseId, holeId, createdAt, userId, likeCount, commentCount, shotType, clubUsed, windCondition, strategyNote, landingZoneNote, whatCameraDoesntShow, datePlayedAt").eq("userId", userId).order("createdAt", { ascending: false })
          : supabase.from("Upload").select("id, mediaUrl, cloudflareVideoId, mediaType, courseId, holeId, createdAt, userId, likeCount, commentCount, shotType, clubUsed, windCondition, strategyNote, landingZoneNote, whatCameraDoesntShow, datePlayedAt").eq("userId", userId).eq("moderationStatus", "APPROVED").order("createdAt", { ascending: false }),
        supabase.from("Follow").select("*", { count: "exact", head: true }).eq("followingId", userId).eq("status", "ACTIVE"),
        supabase.from("Follow").select("*", { count: "exact", head: true }).eq("followerId", userId).eq("status", "ACTIVE"),
      ]);

      let userUploads = rawUploads || [];
      if (userUploads.length > 0) {
        const holeIds = [...new Set(userUploads.map((u: any) => u.holeId).filter(Boolean))];
        if (holeIds.length > 0) {
          const { data: holes } = await supabase.from("Hole").select("id, holeNumber, par, yardage").in("id", holeIds);
          const holeMap = new Map(holes?.map((h: any) => [h.id, { holeNumber: h.holeNumber, par: h.par, yardage: h.yardage }]) || []);
          userUploads = userUploads.map((u: any) => {
            const hd = holeMap.get(u.holeId);
            return { ...u, holeNumber: hd?.holeNumber || null, holePar: hd?.par ?? null, holeYardage: hd?.yardage ?? null };
          });
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
          const { data: taggedData } = await supabase.from("Upload").select("id, mediaUrl, cloudflareVideoId, mediaType, courseId, holeId, createdAt, userId, likeCount, commentCount, shotType, clubUsed, windCondition, strategyNote, landingZoneNote, whatCameraDoesntShow, datePlayedAt").in("id", taggedUploadIds).order("createdAt", { ascending: false });
          if (taggedData && taggedData.length > 0) {
            const taggedHoleIds = [...new Set(taggedData.map((u: any) => u.holeId).filter(Boolean))];
            const { data: taggedHoles } = await supabase.from("Hole").select("id, holeNumber, par, yardage").in("id", taggedHoleIds);
            const taggedHoleMap = new Map(taggedHoles?.map((h: any) => [h.id, { holeNumber: h.holeNumber, par: h.par, yardage: h.yardage }]) || []);
            setTaggedUploads(taggedData.map((u: any) => {
              const hd = taggedHoleMap.get(u.holeId);
              return { ...u, holeNumber: hd?.holeNumber || null, holePar: hd?.par ?? null, holeYardage: hd?.yardage ?? null, isTagged: true };
            }));
          }
        }
      }

      const { data: roundsData } = await supabase.from("Round").select("id, courseId, date, totalScore, fairwaysHit, putts, notes, createdAt").eq("userId", userId as string).order("date", { ascending: false });
      setRounds(roundsData || []);
      if (roundsData && roundsData.length > 0) {
        const knownIds = new Set(userUploads.map((u: any) => u.courseId));
        const missing = [...new Set((roundsData as any[]).map(r => r.courseId).filter((id: string) => !knownIds.has(id)))];
        if (missing.length > 0) {
          const { data: roundCourses } = await supabase.from("Course").select("id, name, city, state, logoUrl").in("id", missing);
          if (roundCourses?.length) setCoursesPlayed(prev => { const seen = new Set(prev.map(c => c.id)); return [...prev, ...(roundCourses as any[]).filter(c => !seen.has(c.id))]; });
        }
      }

      const { data: badgesData } = await supabase.from("UserBadge").select("id, awardedAt, badge:badgeId(slug, name, description, category, rarity)").eq("userId", userId as string).order("awardedAt", { ascending: false });
      setEarnedBadges((badgesData || []) as unknown as EarnedBadge[]);

      setLoading(false);
    }
    load();
  }, [userId]);

  // Comment load
  useEffect(() => {
    const anyOpen = menuOpen || feedOpen || showEdit;
    document.body.style.overflow = anyOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen, feedOpen, showEdit]);

  useEffect(() => {
    if (!commentUploadId) { setCommentItems([]); return; }
    setLoadingComments(true);
    createClient().from("Comment").select("id, body, createdAt, userId, User:userId(username, avatarUrl, UserProgression(rank))").eq("uploadId", commentUploadId).order("createdAt", { ascending: true })
      .then(({ data }) => {
        if (data) setCommentItems(data.map((c: any) => ({ id: c.id, body: c.body, createdAt: c.createdAt, username: c.User?.username || "golfer", avatarUrl: c.User?.avatarUrl || null, rank: (c.User?.UserProgression as any[])?.[0]?.rank || null })));
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
    const { data: uploadData } = await supabase.from("Upload").select("commentCount, userId").eq("id", commentUploadId).single();
    await supabase.from("Upload").update({ commentCount: (uploadData?.commentCount || 0) + 1 }).eq("id", commentUploadId);
    if (uploadData?.userId && uploadData.userId !== currentUserId) {
      fetch("/api/points/award", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "comment_received", recipientUserId: uploadData.userId, referenceId: commentUploadId }) }).catch(() => {});
    }
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
      await supabase.from("Follow").insert({ id: crypto.randomUUID(), followerId: currentUserId, followingId: userId as string, status: "ACTIVE", createdAt: new Date().toISOString() });
      setIsFollowing(true); setFollowerCount(prev => prev + 1);
      // Notify the person being followed
      const { data: follower } = await supabase.from("User").select("displayName, username").eq("id", currentUserId).single();
      const followerName = follower?.displayName || follower?.username || "Someone";
      const now = new Date().toISOString();
      await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: userId as string, type: "follow", title: "New follower", body: `${followerName} started following you`, linkUrl: `/profile/${currentUserId}`, read: false, createdAt: now, updatedAt: now });
      fetch("/api/push/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, title: "New follower", body: `${followerName} started following you`, url: `/profile/${currentUserId}` }) }).catch(() => {});
      fetch("/api/points/award", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "follow_received", recipientUserId: userId }) }).catch(() => {});
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
    const dn = editDisplayName.trim() || profile.displayName;
    await createClient().from("User").update({ handicapIndex: isNaN(hcp!) ? null : hcp, displayName: dn, bio: editBio.trim() || null, homeCourseId: homeCourse?.id ?? null, updatedAt: new Date().toISOString() }).eq("id", profile.id);
    setProfile(p => p ? { ...p, handicapIndex: isNaN(hcp!) ? null : hcp, displayName: dn, bio: editBio.trim() || null } : p);
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
    if (!selectedClip || !editData || editSaving || !isOwner || !currentUserId) return;
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
    await supabase.from("Upload").update({ holeId, shotType: editData.shotType || null, clubUsed: editData.clubUsed || null, windCondition: editData.windCondition || null, strategyNote: editData.strategyNote || null, landingZoneNote: editData.landingZoneNote || null, whatCameraDoesntShow: editData.whatCameraDoesntShow || null, updatedAt: new Date().toISOString() }).eq("id", selectedClip.id).eq("userId", currentUserId);
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
    if (!selectedClip || !isOwner || !currentUserId) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      const url = selectedClip.mediaUrl;
      const bucket = selectedClip.mediaType === "VIDEO" ? "tour-it-videos" : "tour-it-photos";
      const bucketIndex = url.indexOf(`/${bucket}/`);
      if (bucketIndex !== -1) await supabase.storage.from(bucket).remove([url.substring(bucketIndex + bucket.length + 2)]);
      await supabase.from("Upload").delete().eq("id", selectedClip.id).eq("userId", currentUserId);
      fetch("/api/points/award", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "upload_deleted", referenceId: selectedClip.id }) }).catch(() => {});
      setUploads(prev => prev.filter(u => u.id !== selectedClip.id));
    } catch {}
    setDeleting(false); setSelectedClip(null); setConfirmDelete(false);
  }

  if (loading) return (
    <main style={{ background: "#07100a", minHeight: "100vh", paddingLeft: isDesktop ? 72 : 0, maxWidth: isDesktop ? 760 : undefined }}>
      {/* Banner */}
      <div className="skeleton" style={{ width: "100%", height: 130 }} />
      {/* Avatar + name row */}
      <div style={{ padding: "0 20px", marginTop: -32, marginBottom: 16 }}>
        <div className="skeleton" style={{ width: 72, height: 72, borderRadius: "50%", marginBottom: 12, border: "3px solid #07100a" }} />
        <div className="skeleton" style={{ width: 140, height: 18, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 90, height: 13, borderRadius: 99 }} />
      </div>
      {/* Stats row */}
      <div style={{ display: "flex", gap: 24, padding: "0 20px 20px" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="skeleton" style={{ width: 28, height: 18 }} />
            <div className="skeleton" style={{ width: 44, height: 11, borderRadius: 99 }} />
          </div>
        ))}
      </div>
      {/* Clip grid */}
      <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(6, 1fr)" : "repeat(3, 1fr)", gap: "2px", padding: "0 20px" }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ aspectRatio: "9/16", borderRadius: 6 }} />
        ))}
      </div>
      <BottomNav />
    </main>
  );

  if (notFound || !profile) return (
    <main style={{ background: "#07100a", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@300;400;500;600&display=swap');`}</style>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>User not found</h1>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", margin: 0 }}>This profile doesn&apos;t exist or may have been removed.</p>
      </div>
      <button onClick={() => router.push("/")} style={{ background: "#2d7a42", border: "none", borderRadius: 10, padding: "12px 32px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Go home</button>
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
    <main style={{ background: "#07100a", minHeight: "100vh", fontFamily: "'Outfit', sans-serif", color: "#fff", paddingBottom: isDesktop ? 0 : "80px", paddingLeft: isDesktop ? 72 : 0, maxWidth: isDesktop ? 760 : undefined }}>
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
                courseLocation={(() => { const c = coursesPlayed.find(c => c.id === clip.courseId); return c ? [c.city, c.state].filter(Boolean).join(", ") || null : null; })()}
                onClose={() => setFeedOpen(false)}
                onOptions={isOwner ? () => { setFeedOpen(false); setSelectedClip(clip); } : undefined}
                onReport={!isOwner && currentUserId ? () => { setFeedOpen(false); setReportClipId(clip.id); } : undefined}
                uploaderInfo={{ id: profile.id, username: profile.username, avatarUrl: profile.avatarUrl, handicapIndex: profile.handicapIndex, rank: profileRank }}
                onComment={() => setCommentUploadId(clip.id)}
                isOwner={isOwner}
                currentUserId={currentUserId}
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

      {/* Avatar lightbox */}
      {showAvatarModal && profile.avatarUrl && (
        <div onClick={() => setShowAvatarModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 300, gap: 20 }}>
          <img src={profile.avatarUrl} alt="avatar" style={{ width: 240, height: 240, borderRadius: "50%", objectFit: "cover", outline: `3px solid ${getRankColor(profileRank)}` }} onClick={e => e.stopPropagation()} />
          {isOwner && (
            <button onClick={e => { e.stopPropagation(); setShowAvatarModal(false); fileInputRef.current?.click(); }} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, padding: "9px 22px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
              Change photo
            </button>
          )}
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
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "#0d1f12", borderRadius: "20px 20px 0 0", padding: "20px 20px 44px", maxHeight: "80vh", overflowY: "auto" }}>
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
              <label style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6, fontFamily: "'Outfit', sans-serif" }}>Display name</label>
              <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} placeholder="Your name or nickname"
                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "'Outfit', sans-serif" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6, fontFamily: "'Outfit', sans-serif" }}>Bio</label>
              <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Tell the golf community about yourself..." rows={3}
                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "'Outfit', sans-serif", resize: "none", boxSizing: "border-box" }} />
            </div>
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText(""); }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "#0d1f12", borderRadius: "20px 20px 0 0", padding: "24px 20px 44px" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, color: "#fff", marginBottom: 8, textAlign: "center" }}>Delete your account?</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>
              All your clips, comments, likes, and data will be permanently deleted. This cannot be undone.
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 8, textAlign: "center" }}>Type <strong style={{ color: "rgba(200,80,80,0.9)" }}>DELETE</strong> to confirm</div>
              <input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${deleteConfirmText === "DELETE" ? "rgba(200,80,80,0.6)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "#fff", outline: "none", textAlign: "center", letterSpacing: "0.05em" }}
              />
            </div>
            <button
              onClick={async () => {
                if (deleteConfirmText !== "DELETE") return;
                setDeletingAccount(true);
                const res = await fetch("/api/user/delete", { method: "DELETE" });
                if (res.ok) {
                  await createClient().auth.signOut();
                  router.replace("/login");
                } else {
                  setDeletingAccount(false);
                }
              }}
              disabled={deletingAccount || deleteConfirmText !== "DELETE"}
              style={{ width: "100%", background: deleteConfirmText === "DELETE" ? "rgba(200,50,50,0.85)" : "rgba(200,50,50,0.25)", border: "none", borderRadius: 14, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: deleteConfirmText === "DELETE" ? "#fff" : "rgba(255,255,255,0.3)", cursor: deleteConfirmText === "DELETE" ? "pointer" : "default", marginBottom: 10, transition: "all 0.15s" }}
            >
              {deletingAccount ? "Deleting…" : "Yes, delete my account"}
            </button>
            <button onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText(""); }} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Cancel</button>
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
                    if (!rateLimit(`report:${currentUserId}`, 5, 60000)) { setReportDone(true); setTimeout(() => { setReportClipId(null); setReportReason(null); setReportDone(false); }, 1800); return; }
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
                { label: "About Tour It", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, onClick: () => { setMenuOpen(false); router.push("/about"); } },
                { label: "Leaderboard", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>, onClick: () => { setMenuOpen(false); router.push("/leaderboards"); } },
                { label: "My Trips", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>, onClick: () => { setMenuOpen(false); router.push("/trips"); } },
                { label: "Privacy Policy", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, onClick: () => { setMenuOpen(false); router.push("/privacy"); } },
                { label: "Terms of Service", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, onClick: () => { setMenuOpen(false); router.push("/terms"); } },
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

      {/* Left-aligned identity band */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 8px" }}>
        {/* Avatar — 64px, rank-colored ring */}
        <div
          className={isLegend(profileRank) ? "legend-ring" : undefined}
          onClick={() => setShowAvatarModal(true)}
          style={{ width: 72, height: 72, borderRadius: "50%", background: profile.avatarUrl ? "transparent" : "#1a3320", border: "3px solid #07100a", outline: `2.5px solid ${getRankColor(profileRank)}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 600, color: "rgba(255,255,255,0.6)", overflow: "hidden", cursor: "pointer", flexShrink: 0 }}
        >
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (uploadingAvatar ? <span style={{ fontSize: 11 }}>…</span> : initials)}
        </div>

        {/* Identity stack */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: @username + edit pencil */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 25, fontWeight: 700, color: getRankColor(profileRank), lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.username}</div>
            {isOwner && (
              <button onClick={() => setShowEdit(true)} style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                  <path d="m15 5 4 4"/>
                </svg>
              </button>
            )}
          </div>

          {/* Row 2: hcp + home course + badges pills */}
          {(profile.handicapIndex !== null || homeCourse || earnedBadges.length > 0) && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
              {profile.handicapIndex !== null && <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "3px 8px", fontSize: 12, color: "rgba(255,255,255,0.82)" }}>{profile.handicapIndex} hcp</div>}
              {homeCourse && (
                <div onClick={() => router.push(`/courses/${homeCourse.id}`)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "3px 8px", fontSize: 12, color: "rgba(255,255,255,0.82)", cursor: "pointer" }}>{homeCourse.name}</div>
              )}
              {earnedBadges.length > 0 && (
                <div onClick={() => router.push(`/profile/${userId}/badges`)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "3px 8px", fontSize: 12, color: "rgba(255,255,255,0.82)", cursor: "pointer" }}>🏅 {earnedBadges.length} badges</div>
              )}
            </div>
          )}

          {/* Row 3: followers · following */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <button onClick={() => openFollowSheet("followers")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(255,255,255,0.62)", fontFamily: "'Outfit', sans-serif", fontSize: 13 }}><span style={{ fontWeight: 700 }}>{followerCount}</span> followers</button>
            <span style={{ margin: "0 4px", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>·</span>
            <button onClick={() => openFollowSheet("following")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(255,255,255,0.62)", fontFamily: "'Outfit', sans-serif", fontSize: 13 }}><span style={{ fontWeight: 700 }}>{followingCount}</span> following</button>
          </div>
        </div>

        {/* Follow button — right side of band for non-owners */}
        {!isOwner && currentUserId && (
          <button onClick={handleFollow} disabled={followLoading} style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 10, border: isFollowing ? "1px solid rgba(255,255,255,0.15)" : "none", background: isFollowing ? "rgba(255,255,255,0.06)" : "#2d7a42", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: isFollowing ? "rgba(255,255,255,0.6)" : "#fff", cursor: "pointer", opacity: followLoading ? 0.6 : 1 }}>
            {followLoading ? "…" : isFollowing ? "Following" : "Follow"}
          </button>
        )}
        {!isOwner && !currentUserId && (
          <button onClick={() => router.push("/login")} style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 10, background: "#2d7a42", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Follow</button>
        )}
      </div>

      {/* Progression tracker */}
      <ProgressionTracker userId={userId as string} isOwner={isOwner} />

      {/* Quiet badge entry point */}
      {earnedBadges.length > 0 && (
        <div style={{ paddingLeft: 16, marginBottom: 8 }}>
          <button
            onClick={() => router.push(`/profile/${userId}/badges`)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.32)", letterSpacing: "0.01em" }}
          >
            🏅 {earnedBadges.length} badge{earnedBadges.length !== 1 ? "s" : ""} earned →
          </button>
        </div>
      )}

      {/* Clips / Rounds tabs with counts */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 0 }}>
        {(["clips", "rounds"] as const).map(tab => {
          const count = tab === "clips" ? allClips.length : rounds.length;
          const active = profileTab === tab;
          return (
            <button key={tab} onClick={() => setProfileTab(tab)} style={{ flex: 1, padding: "12px 0", background: "none", border: "none", borderBottom: `2px solid ${active ? "#4da862" : "transparent"}`, cursor: "pointer", marginBottom: -1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: active ? "#fff" : "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {tab === "clips" ? "Clips" : "Rounds"}
              </span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: active ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.2)", background: active ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)", borderRadius: 10, padding: "1px 6px", letterSpacing: 0 }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Clips grid */}
      {profileTab === "clips" && (
        <div style={{ paddingTop: 12 }}>
          {allClips.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(26,158,66,0.07)", border: "1px solid rgba(26,158,66,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg>
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>{isOwner ? "You haven't uploaded any clips yet" : "No clips yet"}</div>
              {isOwner && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.25)", lineHeight: 1.5, maxWidth: 220 }}>Upload hole footage to start building your scouting profile.</div>}
              {isOwner && <button onClick={() => router.push("/upload")} style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "11px 28px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4, fontFamily: "'Outfit', sans-serif" }}>Upload a clip</button>}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(6, 1fr)" : "repeat(3, 1fr)", gap: "2px", padding: "0 20px" }}>
              {allClips.map((upload, i) => (
                <div key={upload.id + (upload.isTagged ? "-t" : "")} className="clip-thumb" onClick={() => openFeed(i)}
                  style={{ aspectRatio: "9/16", borderRadius: "6px", overflow: "hidden", position: "relative", cursor: "pointer", background: i % 3 === 0 ? "linear-gradient(180deg,#1a4d22 0%,#2d7a42 50%,#0f2e18 100%)" : i % 3 === 1 ? "linear-gradient(180deg,#0a2e14 0%,#1e5c30 50%,#0a1e10 100%)" : "linear-gradient(180deg,#1e3a10 0%,#3a6020 50%,#122010 100%)", transition: "opacity 0.15s" }}>
                  {upload.mediaType === "PHOTO"
                    ? <img src={upload.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : upload.cloudflareVideoId
                      ? <img src={`https://videodelivery.net/${upload.cloudflareVideoId}/thumbnails/thumbnail.jpg?time=0s&width=400`} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg></div>
                  }
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
      )}

      {/* Rounds list */}
      {profileTab === "rounds" && (
        <div style={{ padding: "16px 20px 32px" }}>
          {rounds.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>No rounds logged yet</div>
              {isOwner && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Rounds are logged automatically when you upload a clip</div>}
            </div>
          ) : (
            rounds.map(r => {
              const course = coursesPlayed.find(c => c.id === r.courseId);
              const [y, m, d] = r.date.split("-").map(Number);
              const dateStr = new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              return (
                <div key={r.id} onClick={() => router.push(`/profile/${userId}/rounds/${r.id}`)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, marginBottom: 8, cursor: "pointer" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course?.name || "Unknown Course"}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{dateStr}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0, marginLeft: 12 }}>
                    {r.totalScore != null && (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{r.totalScore}</div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>Score</div>
                      </div>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Badge detail sheet */}
      {selectedBadge && (() => {
        const color = RARITY_COLOR[selectedBadge.badge.rarity] || "rgba(210,210,210,0.6)";
        const emoji = BADGE_EMOJI[selectedBadge.badge.slug] || "🏆";
        const earnedDate = new Date(selectedBadge.awardedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setSelectedBadge(null)}>
            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#0d2318", borderRadius: "24px 24px 0 0", padding: "24px 24px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, marginBottom: 8 }} />
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: `${color}20`, border: `3px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>{emoji}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", textAlign: "center" }}>{selectedBadge.badge.name}</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.1em" }}>{selectedBadge.badge.rarity} · {selectedBadge.badge.category}</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.65)", textAlign: "center", lineHeight: 1.6, maxWidth: 280 }}>{selectedBadge.badge.description}</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Earned {earnedDate}</div>
            </div>
          </div>
        );
      })()}

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
                    <div className={isLegend(c.rank) ? "legend-ring" : undefined} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(26,158,66,0.2)", border: `1px solid ${getRankColor(c.rank)}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {c.avatarUrl ? <img src={c.avatarUrl} alt={c.username} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                    </div>
                    <div>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: getRankColor(c.rank) }}>@{c.username} </span>
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
