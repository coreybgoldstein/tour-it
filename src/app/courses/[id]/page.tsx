"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { useLike } from "@/hooks/useLike";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useSave } from "@/hooks/useSave";
import { ClipTopPill } from "@/components/clip/ClipTopPill";
import { HoleSideBar } from "@/components/clip/HoleSideBar";
import { HoleIdentityCard } from "@/components/clip/HoleIdentityCard";
import { ClipNoteCaption } from "@/components/clip/ClipNoteCaption";
import { IntelPanel } from "@/components/clip/IntelPanel";
import { sessionMute } from "@/lib/sessionMute";
import EditClipSheet from "@/components/EditClipSheet";
import { HlsVideo } from "@/components/HlsVideo";
import { getVideoSrc } from "@/lib/getVideoSrc";
import { sendPushToUser } from "@/lib/sendPush";
import { formatClipDate } from "@/lib/formatClipDate";
import { getRankColor, getRankRingBorder, isLegend } from "@/lib/rank-styles";
type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  holeCount: number;
  isPublic: boolean;
  courseType: "PUBLIC" | "PRIVATE" | "SEMI_PRIVATE" | null;
  zipCode: string | null;
  yearEstablished: number | null;
  uploadCount: number;
  description: string | null;
  coverImageUrl: string | null;
  logoUrl: string | null;
  scorecardImageUrl: string | null;
};

type Clip = {
  id: string;
  mediaType: string;
  mediaUrl: string;
  cloudflareVideoId?: string | null;
  shotType: string | null;
  clubUsed: string | null;
  strategyNote: string | null;
  landingZoneNote: string | null;
  whatCameraDoesntShow: string | null;
  windCondition: string | null;
  datePlayedAt: string | null;
  rankScore: number;
  holeId: string | null;
  courseId: string;
  likeCount: number;
  commentCount: number;
  holeNumber?: number;
  seriesId?: string | null;
  courseName?: string;
  isForeign?: boolean;
  userId: string;
  createdAt: string;
};

type SuggestedCourse = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
};

const SHOT_LABEL: Record<string, string> = {
  TEE_SHOT: "Tee Shot", APPROACH: "Approach", LAY_UP: "Layup",
  CHIP: "Chip", PITCH: "Pitch", PUTT: "Putt",
  BUNKER: "Bunker", FULL_HOLE: "Full Hole",
};

const COURSE_HEROES: Record<string, { gradient: string; description: string; designer?: string; year?: number }> = {
  "kiawah": {
    gradient: "linear-gradient(160deg, #1a4a2e 0%, #0d3320 30%, #082818 60%, #041a10 100%)",
    description: "Pete Dye's coastal masterpiece on a barrier island. 10 holes within view of the Atlantic. Host of the 1991 Ryder Cup and 2021 PGA Championship.",
    designer: "Pete Dye",
    year: 1991,
  },
  "bethpage": {
    gradient: "linear-gradient(160deg, #162e12 0%, #0e2010 40%, #071508 100%)",
    description: "A public golf mecca on Long Island. The Black Course is one of the most demanding tracks in America — host of two US Opens.",
    designer: "A.W. Tillinghast",
    year: 1936,
  },
  "pebble": {
    gradient: "linear-gradient(160deg, #0a2a3a 0%, #0d3020 40%, #071510 100%)",
    description: "Arguably the finest meeting of land and sea in golf. Eight holes border the Pacific on the Monterey Peninsula.",
    designer: "Jack Neville",
    year: 1919,
  },
  "default": {
    gradient: "linear-gradient(160deg, #1a4d22 0%, #0d2e14 50%, #071208 100%)",
    description: "",
  },
};

function getCourseHero(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("kiawah")) return COURSE_HEROES["kiawah"];
  if (lower.includes("bethpage")) return COURSE_HEROES["bethpage"];
  if (lower.includes("pebble")) return COURSE_HEROES["pebble"];
  return COURSE_HEROES["default"];
}

function FlagBadge({ label, large }: { label: string | number; large?: boolean }) {
  if (large) {
    return (
      <div style={{ background: "#1a5c30", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 4, padding: "6px 14px 7px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 1, background: "rgba(255,255,255,0.5)" }} />
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1, userSelect: "none" }}>{label}</span>
          <div style={{ width: 10, height: 1, background: "rgba(255,255,255,0.5)" }} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: "#1a5c30", border: "1px solid rgba(255,255,255,0.45)", borderRadius: 3, padding: "2px 6px 3px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.1)" }}>
      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 10, fontWeight: 700, color: "#fff", lineHeight: 1, userSelect: "none" }}>{label}</span>
    </div>
  );
}

function FeedCard({ clip, isActive, onClose, onComment, course, uploaderMap, clipIndex, totalClips, holeNumber, holePar, holeYardage, scoutedHoles, holeIndex, onEnded, onReport, onEdit, currentUserId }: {
  clip: Clip; isActive: boolean; onClose: () => void; onComment: () => void;
  course: Course | null; uploaderMap: Record<string, { username: string; avatarUrl: string | null; handicapIndex?: number | null; rank?: string | null }>;
  clipIndex: number; totalClips: number;
  holeNumber?: number | null;
  holePar?: number | null; holeYardage?: number | null;
  scoutedHoles: number[];
  holeIndex: number;
  onEnded: () => void; onReport?: () => void; onEdit?: () => void;
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
  const uploader = uploaderMap[clip.userId];
  const hasNotes = !!(clip.strategyNote || clip.clubUsed || clip.windCondition || clip.landingZoneNote || clip.whatCameraDoesntShow || clip.datePlayedAt);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) { v.play().catch(() => {}); setVideoPaused(false); }
    else { v.pause(); v.currentTime = 0; setIntelOpen(false); }
  }, [isActive]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const handleMuteToggle = () => {
    const next = !muted;
    setMuted(next);
    sessionMute.set(next);
  };

  const handleShare = async () => {
    const base = `${window.location.origin}/courses/${clip.courseId}${clip.holeNumber ? `/holes/${clip.holeNumber}` : ""}`;
    const url = `${base}?clip=${clip.id}`;
    const text = `Tour It — ${course?.name || ""}${clip.holeNumber ? ` — Hole ${clip.holeNumber}` : ""}`;
    try {
      if (navigator.share) await navigator.share({ title: text, text, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch {}
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100svh", ...(isDesktop ? { background: "#000", display: "flex", justifyContent: "center" } : {}) }}>
      <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...(isDesktop ? { maxWidth: 390 } : {}) }}>
      {clip.mediaType === "VIDEO" ? (
        <HlsVideo
          ref={videoRef} src={getVideoSrc(clip.mediaUrl, clip.cloudflareVideoId)} muted={muted} playsInline
          onClick={() => {
            const v = videoRef.current; if (!v) return;
            if (v.paused) { v.play().catch(() => {}); setVideoPaused(false); }
            else { v.pause(); setVideoPaused(true); }
          }}
          onEnded={onEnded}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
        />
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

      <ClipTopPill
        courseLogoUrl={course?.logoUrl ?? null}
        courseName={course?.name ?? ""}
        courseLocation={[course?.city, course?.state].filter(Boolean).join(", ") || null}
        holeNumber={holeNumber}
        muted={muted}
        onMuteToggle={handleMuteToggle}
        onTapCourse={onClose}
        visible={true}
        showParYardage={false}
      />


      <HoleSideBar holeIndex={holeIndex} scoutedHoles={scoutedHoles} />

      <HoleIdentityCard holeNumber={holeNumber} holePar={holePar} clipCount={totalClips} />

      {/* Right rail — Intel → Avatar → Like → Comment → SEND IT → Report */}
      <div style={{ position: "absolute", right: 12, bottom: 100, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, zIndex: 10 }}>
        {hasNotes && (
          <button onClick={() => setIntelOpen(o => !o)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: intelOpen ? "rgba(77,168,98,0.4)" : "rgba(77,168,98,0.25)", backdropFilter: "blur(8px)", border: "1.5px solid #4da862", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "0.5px", color: "rgba(255,255,255,0.85)", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>INTEL</span>
          </button>
        )}
        {/* Avatar — directly below Intel */}
        <button onClick={() => router.push(`/profile/${clip.userId}`)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
          <div className={isLegend(uploader?.rank) ? "legend-ring" : undefined} style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: getRankRingBorder(uploader?.rank), background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {uploader?.avatarUrl
              ? <img src={uploader.avatarUrl} alt={uploader.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
          </div>
        </button>
        <button onClick={toggleLike} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: liked ? "rgba(26,158,66,0.15)" : "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: `1px solid ${liked ? "rgba(26,158,66,0.7)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill={liked ? "#1a9e42" : "none"} stroke={liked ? "#1a9e42" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>{likeCount}</span>
        </button>
        <button onClick={onComment} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>{clip.commentCount || 0}</span>
        </button>
        <button onClick={handleShare} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: copied ? "rgba(26,158,66,0.2)" : "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: `1px solid ${copied ? "rgba(26,158,66,0.5)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {copied
              ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1 }}><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#4ade80", letterSpacing: "0.05em" }}>SENT</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
              : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginTop: 3 }}><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#fff", letterSpacing: "0.12em", marginRight: "-0.12em" }}>SEND</span><div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.25)", margin: "2px 0" }} /><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#4ade80", letterSpacing: "0.22em", marginRight: "-0.22em" }}>IT</span></div>
            }
          </div>
          <span style={{ height: 13, display: "block" }} />
        </button>
        {onReport && (
          <button onClick={onReport} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </div>
            <span style={{ height: 13, display: "block" }} />
          </button>
        )}
        {onEdit && (
          <button onClick={onEdit} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </div>
            <span style={{ height: 13, display: "block" }} />
          </button>
        )}
      </div>

      <ClipNoteCaption note={clip.strategyNote} holeNumber={holeNumber} />

      <IntelPanel
        open={intelOpen}
        onClose={() => setIntelOpen(false)}
        holeNumber={holeNumber ?? undefined}
        holePar={holePar}
        holeYardage={holeYardage}
        clubUsed={clip.clubUsed}
        windCondition={clip.windCondition}
        strategyNote={clip.strategyNote}
        landingZoneNote={clip.landingZoneNote}
        whatCameraDoesntShow={clip.whatCameraDoesntShow}
        datePlayedAt={clip.datePlayedAt}
        uploaderUsername={uploader?.username ?? "golfer"}
        uploaderAvatarUrl={uploader?.avatarUrl}
        uploaderId={clip.userId}
        currentUserId={currentUserId}
        uploaderHandicap={uploader?.handicapIndex ?? null}
      />

      {formatClipDate(clip.datePlayedAt, clip.createdAt) && (
        <div style={{ position: "absolute", ...(holeNumber ? { right: 60, bottom: 76 } : { left: 16, bottom: 108 }), zIndex: 10, pointerEvents: "none" }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.72)", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
            {formatClipDate(clip.datePlayedAt, clip.createdAt)}
          </span>
        </div>
      )}

      </div>{/* end inner wrapper */}
    </div>
  );
}

export default function CourseProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [course, setCourse] = useState<Course | null>(null);
  const [courseClips, setCourseClips] = useState<Clip[]>([]);
  const [suggestedCourses, setSuggestedCourses] = useState<SuggestedCourse[]>([]);
  const [uploaders, setUploaders] = useState<Record<string, { username: string; avatarUrl: string | null; handicapIndex?: number | null; rank?: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [feedOpen, setFeedOpen] = useState(false);
  const [showFeedHint, setShowFeedHint] = useState(false);
  const [feedStartHole, setFeedStartHole] = useState(1);
  const [activeHoleNum, setActiveHoleNum] = useState<number | null>(null);
  const [activeClipByHole, setActiveClipByHole] = useState<Record<number, number>>({});
  const [holeClipsMap, setHoleClipsMap] = useState<Record<number, Clip[]>>({});
  const [extendedClips, setExtendedClips] = useState<Clip[]>([]);
  const [holesWithClips, setHolesWithClips] = useState<number[]>([]);
  const [extendedClip, setExtendedClip] = useState<Clip | null>(null);
  const [hasMoreClips, setHasMoreClips] = useState(false);
  const [loadingMoreClips, setLoadingMoreClips] = useState(false);
  const [editClipInfo, setEditClipInfo] = useState<{ id: string; holeId: string | null; holeNumber: number | null } | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const holeScrollRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const holesWithClipsRef = useRef<number[]>([]);
  const holeMapRef = useRef<Record<string, number>>({});
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [holes, setHoles] = useState<{ id: string; holeNumber: number; par: number; handicapRank: number; yardage: number | null }[]>([]);
  const [scorecardEditMode, setScorecardEditMode] = useState(false);
  const [editedHoles, setEditedHoles] = useState<{ id: string; holeNumber: number; par: number; handicapRank: number; yardage: number | null }[]>([]);
  const [savingScorecard, setSavingScorecard] = useState(false);
  const [scorecardView, setScorecardView] = useState<"digital" | "photo">("digital");
  const [uploadingScorecardPhoto, setUploadingScorecardPhoto] = useState(false);
  const scorecardPhotoRef = useRef<HTMLInputElement>(null);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
const [editDescription, setEditDescription] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [contributeSuccess, setContributeSuccess] = useState(false);
  const [contributeError, setContributeError] = useState<string | null>(null);
  const [editCourseName, setEditCourseName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZip, setEditZip] = useState("");
  const [editYearEstablished, setEditYearEstablished] = useState("");
  const [editCourseType, setEditCourseType] = useState<"PUBLIC" | "PRIVATE" | "SEMI_PRIVATE" | "">("");
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [reportClipId, setReportClipId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [commentUploadId, setCommentUploadId] = useState<string | null>(null);
  const [commentItems, setCommentItems] = useState<{ id: string; body: string; username: string; avatarUrl: string | null; createdAt: string; rank?: string | null }[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [mentionResults, setMentionResults] = useState<{ id: string; username: string; displayName: string; avatarUrl: string | null }[]>([]);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const mentionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { saved, saveType, toggleSave, showPicker, setShowPicker } = useSave({ courseId: id as string });
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [tripStep, setTripStep] = useState<"select" | "create" | "details" | "success">("select");
  const [userTrips, setUserTrips] = useState<{ id: string; name: string; startDate: string | null; endDate: string | null }[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedTripName, setSelectedTripName] = useState("");
  const [newTripName, setNewTripName] = useState("");
  const [newTripStart, setNewTripStart] = useState("");
  const [newTripEnd, setNewTripEnd] = useState("");
  const [tripPlayDate, setTripPlayDate] = useState("");
  const [tripTeeTime, setTripTeeTime] = useState("");
  const [tripAccommodation, setTripAccommodation] = useState("");
  const [savingTrip, setSavingTrip] = useState(false);
  const [tripAddedName, setTripAddedName] = useState("");
  const [tripAddedId, setTripAddedId] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!commentUploadId) { setCommentItems([]); return; }
    setLoadingComments(true);
    createClient()
      .from("Comment")
      .select("id, body, createdAt, userId, User:userId(username, avatarUrl, UserProgression(rank))")
      .eq("uploadId", commentUploadId)
      .order("createdAt", { ascending: true })
      .then(({ data }) => {
        if (data) setCommentItems(data.map((c: any) => ({
          id: c.id, body: c.body, createdAt: c.createdAt,
          username: c.User?.username || "golfer",
          avatarUrl: c.User?.avatarUrl || null,
          rank: (c.User?.UserProgression as any[])?.[0]?.rank || null,
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
      }, 220);
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
    const next = before + after;
    setCommentText(next);
    setMentionResults([]);
    setTimeout(() => { input.focus(); input.setSelectionRange(before.length, before.length); }, 0);
  }

  async function submitComment() {
    if (!commentText.trim() || !user || !commentUploadId || submittingComment) return;
    setSubmittingComment(true);
    const supabase = createClient();
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error } = await supabase.from("Comment").insert({
      id: newId, userId: user.id, uploadId: commentUploadId, body: commentText.trim(),
      createdAt: now, updatedAt: now,
    });
    if (!error) {
      const { data: uploadData } = await supabase.from("Upload").select("commentCount, userId, holeNumber, courseId").eq("id", commentUploadId).single();
      await supabase.from("Upload").update({ commentCount: (uploadData?.commentCount || 0) + 1 }).eq("id", commentUploadId);

      // Notify clip owner (skip if commenting on own clip)
      if (uploadData?.userId && uploadData.userId !== user.id) {
        const { data: commenterProfile } = await supabase.from("User").select("displayName, username").eq("id", user.id).single();
        const commenterName = commenterProfile?.displayName || commenterProfile?.username || "Someone";
        const notifNow = new Date().toISOString();
        const clipLink = uploadData.holeNumber ? `/courses/${uploadData.courseId}/holes/${uploadData.holeNumber}?clip=${commentUploadId}` : `/courses/${uploadData.courseId}`;
        await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: uploadData.userId, type: "comment", title: "New comment", body: `${commenterName} commented on your clip`, linkUrl: clipLink, read: false, createdAt: notifNow, updatedAt: notifNow });
        sendPushToUser(uploadData.userId, "New comment", `${commenterName} commented on your clip`, clipLink);
        fetch("/api/points/award", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "comment_received", recipientUserId: uploadData.userId, referenceId: commentUploadId }) }).catch(() => {});
      }
      setCommentItems(prev => [...prev, {
        id: newId, body: commentText.trim(), createdAt: new Date().toISOString(),
        username: user.user_metadata?.username || "you", avatarUrl: null,
      }]);
      setCourseClips(prev => prev.map((c: Clip) => c.id === commentUploadId ? { ...c, commentCount: (c.commentCount || 0) + 1 } : c));

      // Notify @mentioned users
      const mentions = [...new Set((commentText.match(/@(\w+)/g) || []).map(m => m.slice(1).toLowerCase()))];
      if (mentions.length > 0) {
        const { data: mentionedUsers } = await supabase
          .from("User")
          .select("id, username")
          .in("username", mentions);
        const tagged = (mentionedUsers || []).filter(u => u.id !== user.id);
        if (tagged.length > 0) {
          const commenterName = user.user_metadata?.username || user.user_metadata?.display_name || "Someone";
          const { data: commenterProfile } = await supabase.from("User").select("displayName, username").eq("id", user.id).single();
          const senderName = commenterProfile?.displayName || commenterProfile?.username || commenterName;
          const notifNow = new Date().toISOString();
          await supabase.from("Notification").insert(
            tagged.map(u => ({
              id: crypto.randomUUID(),
              userId: u.id,
              type: "comment_mention",
              title: "You were mentioned",
              body: `${senderName} tagged you in a comment: "${commentText.trim().slice(0, 80)}${commentText.trim().length > 80 ? "…" : ""}"`,
              linkUrl: `/courses/${id}`,
              read: false,
              createdAt: notifNow,
              updatedAt: notifNow,
            }))
          );
          tagged.forEach(u => sendPushToUser(u.id, "You were mentioned", `${senderName} mentioned you in a comment`, `/courses/${id}`));
        }
      }

      setCommentText("");
    }
    setSubmittingComment(false);
  }

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();

    async function loadData() {
      const { data: courseData } = await supabase.from("Course").select("*").eq("id", id).single();
      if (courseData) setCourse(courseData);

      const { data: holesData } = await supabase.from("Hole").select("id, holeNumber, par, handicapRank, yardage").eq("courseId", id).order("holeNumber", { ascending: true });
      const holeMap: Record<string, number> = {};
      holesData?.forEach((h: any) => { holeMap[h.id] = h.holeNumber; });
      holeMapRef.current = holeMap;
      if (holesData) {
        const mapped = holesData.map((h: any) => ({ id: h.id, holeNumber: h.holeNumber, par: h.par || 4, handicapRank: h.handicapRank || h.holeNumber, yardage: h.yardage || null }));
        setHoles(mapped);
        setEditedHoles(mapped);
      }

      const { data: uploads } = await supabase
        .from("Upload").select("*").eq("courseId", id).eq("moderationStatus", "APPROVED").order("rankScore", { ascending: false }).range(0, 49);
      setHasMoreClips((uploads?.length || 0) === 50);

      const clips: Clip[] = (uploads || []).map((u: any) => ({
        ...u,
        holeNumber: u.holeId ? holeMap[u.holeId] : undefined,
        courseName: courseData?.name,
        isForeign: false,
        likeCount: u.likeCount || 0,
      }));

      // Sort by hole number ascending (clips without hole go last)
      clips.sort((a, b) => (a.holeNumber ?? 999) - (b.holeNumber ?? 999));
      setCourseClips(clips);

      // Group by hole for new grid/feed
      const map: Record<number, Clip[]> = {};
      const extended: Clip[] = [];
      for (const clip of clips) {
        if (clip.holeNumber) {
          if (!map[clip.holeNumber]) map[clip.holeNumber] = [];
          map[clip.holeNumber].push(clip);
        } else {
          extended.push(clip);
        }
      }
      setHoleClipsMap(map);
      setExtendedClips(extended);
      const hw = Object.keys(map).map(Number).sort((a, b) => a - b);
      setHolesWithClips(hw);
      holesWithClipsRef.current = hw;

      // Fetch uploader info
      if (clips.length > 0) {
        const userIds = [...new Set(clips.map((c: any) => c.userId).filter(Boolean))];
        const [{ data: users }, { data: progressions }] = await Promise.all([
          supabase.from("User").select("id, username, avatarUrl, handicapIndex").in("id", userIds),
          supabase.from("UserProgression").select("userId, rank").in("userId", userIds),
        ]);
        if (users) {
          const rankMap: Record<string, string> = {};
          progressions?.forEach((p: any) => { rankMap[p.userId] = p.rank; });
          const map: Record<string, { username: string; avatarUrl: string | null; handicapIndex?: number | null; rank?: string | null }> = {};
          users.forEach((u: any) => { map[u.id] = { username: u.username, avatarUrl: u.avatarUrl, handicapIndex: u.handicapIndex ?? null, rank: rankMap[u.id] || null }; });
          setUploaders(map);
        }
      }

      // Fetch 2 suggested courses
      const { data: suggested } = await supabase
        .from("Course")
        .select("id, name, city, state, logoUrl, coverImageUrl")
        .neq("id", id)
        .order("uploadCount", { ascending: false })
        .limit(2);
      setSuggestedCourses(suggested || []);

      setLoading(false);
    }

    loadData();
  }, [id]);

  const loadMoreClips = useCallback(async () => {
    if (loadingMoreClips || !hasMoreClips || !id) return;
    setLoadingMoreClips(true);
    const supabase = createClient();
    const { data: uploads } = await supabase
      .from("Upload").select("*").eq("courseId", id).eq("moderationStatus", "APPROVED")
      .order("rankScore", { ascending: false })
      .range(courseClips.length, courseClips.length + 49);
    if (uploads?.length) {
      const newClips: Clip[] = uploads.map((u: any) => ({
        ...u,
        holeNumber: u.holeId ? holeMapRef.current[u.holeId] : undefined,
        isForeign: false,
        likeCount: u.likeCount || 0,
      }));
      const combined = [...courseClips, ...newClips].sort((a, b) => (a.holeNumber ?? 999) - (b.holeNumber ?? 999));
      setCourseClips(combined);
      const map: Record<number, Clip[]> = {};
      const extended: Clip[] = [];
      for (const clip of combined) {
        if (clip.holeNumber) {
          if (!map[clip.holeNumber]) map[clip.holeNumber] = [];
          map[clip.holeNumber].push(clip);
        } else { extended.push(clip); }
      }
      setHoleClipsMap(map);
      setExtendedClips(extended);
      const hw = Object.keys(map).map(Number).sort((a, b) => a - b);
      setHolesWithClips(hw);
      holesWithClipsRef.current = hw;
      // Fetch uploaders for new clips
      const newUserIds = [...new Set(newClips.map((c) => c.userId).filter(Boolean))];
      if (newUserIds.length > 0) {
        const [{ data: users }, { data: progressions }] = await Promise.all([
          supabase.from("User").select("id, username, avatarUrl, handicapIndex").in("id", newUserIds),
          supabase.from("UserProgression").select("userId, rank").in("userId", newUserIds),
        ]);
        if (users) {
          const rankMap: Record<string, string> = {};
          progressions?.forEach((p: any) => { rankMap[p.userId] = p.rank; });
          const newMap: Record<string, { username: string; avatarUrl: string | null; handicapIndex?: number | null; rank?: string | null }> = {};
          users.forEach((u: any) => { newMap[u.id] = { username: u.username, avatarUrl: u.avatarUrl, handicapIndex: u.handicapIndex ?? null, rank: rankMap[u.id] || null }; });
          setUploaders(prev => ({ ...prev, ...newMap }));
        }
      }
      setHasMoreClips(uploads.length === 50);
    } else {
      setHasMoreClips(false);
    }
    setLoadingMoreClips(false);
  }, [loadingMoreClips, hasMoreClips, id, courseClips]);

  const openContribute = useCallback(() => {
    if (!course) return;
    setEditCourseName(course.name || "");
    setEditCity(course.city || "");
    setEditState(course.state || "");
    setEditZip(course.zipCode || "");
    setEditYearEstablished(course.yearEstablished?.toString() || "");
    setEditCourseType(course.courseType || "");
    setEditDescription(course.description || "");
    setCoverFile(null);
    setCoverPreview(null);
    setLogoFile(null);
    setLogoPreview(null);
    setContributeSuccess(false);
    setContributeOpen(true);
  }, [course]);

  const generateDescription = async () => {
    if (!course || generatingDesc) return;
    setGeneratingDesc(true);
    try {
      const res = await fetch("/api/generate-course-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: course.name, city: course.city, state: course.state }),
      });
      const { description } = await res.json();
      if (description) setEditDescription(description);
    } catch {
      // silently fail — user can type manually
    }
    setGeneratingDesc(false);
  };

  const handleCoverPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleContributeSubmit = async () => {
    setContributeError(null);

    if (!user) {
      setContributeError("You need to be logged in to submit updates. Sign in and try again.");
      return;
    }

    const MAX_BYTES = 8 * 1024 * 1024;
    if (coverFile && coverFile.size > MAX_BYTES) {
      setContributeError(`Cover photo is too large (${(coverFile.size / 1024 / 1024).toFixed(1)} MB). Please resize it to under 8 MB.`);
      return;
    }
    if (logoFile && logoFile.size > MAX_BYTES) {
      setContributeError(`Logo file is too large (${(logoFile.size / 1024 / 1024).toFixed(1)} MB). Please resize it to under 8 MB.`);
      return;
    }

    setContributing(true);
    const supabase = createClient();
    const payload: Record<string, string | number | null> = {};

    if (coverFile) {
      const ext = coverFile.name.split(".").pop();
      const path = `covers/${id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("tour-it-photos").upload(path, coverFile, { upsert: true });
      if (upErr) { setContributing(false); setContributeError(`Cover photo upload failed: ${upErr.message}`); return; }
      payload.coverImageUrl = supabase.storage.from("tour-it-photos").getPublicUrl(path).data.publicUrl;
    }

    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `logos/${id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("tour-it-photos").upload(path, logoFile, { upsert: true });
      if (upErr) { setContributing(false); setContributeError(`Logo upload failed: ${upErr.message}`); return; }
      payload.logoUrl = supabase.storage.from("tour-it-photos").getPublicUrl(path).data.publicUrl;
    }

    if (editDescription.trim()) payload.description = editDescription.trim();
    payload.zipCode = editZip.trim() || null;
    payload.yearEstablished = editYearEstablished ? parseInt(editYearEstablished) : null;
    if (editCourseType) payload.courseType = editCourseType;

    if (Object.keys(payload).length === 0) {
      setContributing(false);
      setContributeError("No changes to submit.");
      return;
    }

    const res = await fetch(`/api/courses/${id}/contribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed to save" }));
      setContributing(false);
      setContributeError(error || "Failed to save");
      return;
    }

    setCourse(prev => prev ? { ...prev, ...payload } : prev);
    if (payload.coverImageUrl) setCoverPreview(null);
    setContributing(false);
    setContributeSuccess(true);
  };

  useEffect(() => {
    if (feedOpen && feedRef.current) {
      const idx = holesWithClipsRef.current.indexOf(feedStartHole);
      feedRef.current.scrollTop = Math.max(0, idx) * window.innerHeight;
      setActiveHoleNum(feedStartHole);
      setActiveClipByHole({});
    }
  }, [feedOpen, feedStartHole]);

  const handleFeedScroll = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const el = feedRef.current;
      if (!el) return;
      const holeIdx = Math.round(el.scrollTop / window.innerHeight);
      const holeNum = holesWithClipsRef.current[holeIdx];
      if (holeNum !== undefined) {
        setActiveHoleNum(holeNum);
        const inner = holeScrollRefs.current[holeNum];
        if (inner) {
          const clipIdx = Math.round(inner.scrollLeft / inner.offsetWidth);
          setActiveClipByHole(prev => ({ ...prev, [holeNum]: clipIdx }));
        }
      }
    }, 50);
  }, []);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", paddingLeft: isDesktop ? 72 : 0 }}>
        {/* Hero skeleton */}
        <div className="skeleton" style={{ width: "100%", height: 220 }} />
        {/* Course name + meta */}
        <div style={{ padding: "20px 20px 0" }}>
          <div className="skeleton" style={{ width: 80, height: 11, marginBottom: 10, borderRadius: 99 }} />
          <div className="skeleton" style={{ width: "65%", height: 26, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8 }}>
            {[60, 72, 52].map(w => <div key={w} className="skeleton" style={{ width: w, height: 24, borderRadius: 99 }} />)}
          </div>
        </div>
        {/* Action bar */}
        <div style={{ display: "flex", gap: 8, padding: "18px 20px" }}>
          {[90, 80, 100].map(w => <div key={w} className="skeleton" style={{ width: w, height: 40, borderRadius: 12 }} />)}
        </div>
        {/* 18-hole grid */}
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 24 }}>
          {[0, 1].map(half => (
            <div key={half}>
              <div className="skeleton" style={{ width: 60, height: 12, marginBottom: 10, borderRadius: 99 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ aspectRatio: "3/4", borderRadius: 10 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <BottomNav />
      </main>
    );
  }

  if (!course) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button onClick={() => router.push("/search")} style={{ background: "#2d7a42", border: "none", borderRadius: 99, padding: "10px 24px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", cursor: "pointer" }}>Back to Search</button>
      </main>
    );
  }

  const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
  const hero = getCourseHero(course.name);

  const mostClippedHole = (() => {
    const entries = Object.entries(holeClipsMap).filter(([, c]) => c.length > 0);
    if (entries.length === 0) return null;
    const sorted = entries.sort(([, a], [, b]) => b.length - a.length);
    return sorted[0][1].length > 1 ? Number(sorted[0][0]) : null;
  })();

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff", fontFamily: "'Outfit', sans-serif", paddingLeft: isDesktop ? 72 : 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
        .feed-modal { position: fixed; inset: 0; z-index: 100; background: #000; overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; touch-action: pan-y; }
        .feed-modal::-webkit-scrollbar { display: none; }
        .feed-hole-page { scroll-snap-align: start; scroll-snap-stop: always; height: 100svh; width: 100vw; display: flex; overflow-x: scroll; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior: contain; touch-action: pan-x; }
        .feed-hole-page::-webkit-scrollbar { display: none; }
        .feed-clip-page { width: 100vw; height: 100svh; flex-shrink: 0; scroll-snap-align: start; scroll-snap-stop: always; }
        .feed-end-snap { scroll-snap-align: start; scroll-snap-stop: always; }
        @keyframes hint-fade { 0% { opacity: 0; transform: translate(-50%,-50%) scale(0.95); } 15% { opacity: 1; transform: translate(-50%,-50%) scale(1); } 75% { opacity: 1; } 100% { opacity: 0; } }
        .clip-thumb { position: relative; aspect-ratio: 3/4; border-radius: 10px; overflow: hidden; background: #0e1a13; cursor: pointer; transition: opacity 0.15s; }
        .clip-thumb:hover { opacity: 0.85; }
        .clip-thumb video, .clip-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
        .hole-empty { position: relative; aspect-ratio: 3/4; border-radius: 10px; overflow: hidden; background: #0a120d; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
        .hole-cell-indicator { display: flex; gap: 3px; position: absolute; bottom: 6px; right: 6px; }
        .hole-dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.4); }
        .hole-dot.active { background: #1a9e42; }
        .top-bar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 36px 14px 12px; z-index: 20; gap: 10px; }
        .back-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .mute-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .course-top-badge { width: 46px; height: 46px; border-radius: 12px; background: rgba(26,158,66,0.2); border: 1.5px solid rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 700; color: #1a9e42; flex-shrink: 0; overflow: hidden; }
        .right-actions { position: absolute; right: 14px; bottom: 100px; display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 30; }
        .action-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; }
        .action-icon { width: 46px; height: 46px; border-radius: 50%; background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; }
        .action-label { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,0.95); }
        .bottom-info { position: absolute; bottom: 0; left: 0; right: 0; padding: 0 16px 88px; z-index: 20; }
      `}</style>

      {/* Hero */}
      <div style={{ position: "relative", width: "100%", minHeight: 220, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        {course.coverImageUrl ? (
          <img src={course.coverImageUrl} alt={course.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : courseClips.find(c => c.mediaType === "PHOTO") ? (
          <img src={courseClips.find(c => c.mediaType === "PHOTO")!.mediaUrl} alt={course.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: hero.gradient }} />
        )}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(7,16,10,0.85) 0%, rgba(7,16,10,0.35) 45%, rgba(0,0,0,0.08) 100%)" }} />

        {/* Add cover photo prompt — only when no cover image */}
        {!course.coverImageUrl && (
          <button
            onClick={openContribute}
            style={{ position: "absolute", top: 52, right: 16, zIndex: 10, display: "flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, padding: "7px 12px", cursor: "pointer" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Add cover photo</span>
          </button>
        )}

        {/* Top left: course logo badge (tap to go back) */}
        <button onClick={() => router.back()} style={{ position: "absolute", top: 52, left: 16, zIndex: 10, width: 46, height: 46, borderRadius: 12, background: "rgba(26,158,66,0.2)", border: "1px solid rgba(26,158,66,0.35)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer", padding: 0 }}>
          {course.logoUrl ? (
            <img
              src={course.logoUrl}
              alt={course.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10, backgroundColor: "#fff" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("style"); }}
            />
          ) : null}
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#1a9e42", display: course.logoUrl ? "none" : "inline" }}>{abbr}</span>
        </button>


        <div style={{ position: "relative", padding: "0 20px 18px", zIndex: 10, marginTop: 100 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 6 }}>
            <span>{[course.city, course.state].filter(s => s?.trim()).join(", ")}{course.city || course.state ? " · " : ""}{course.courseType === "SEMI_PRIVATE" ? "Semi-Private" : course.courseType === "PRIVATE" ? "Private" : "Public"}</span>
            {(course.description || hero.description) && (
              <button onClick={() => setAboutOpen(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="12.01" r="0.1" fill="rgba(255,255,255,0.85)" stroke="rgba(255,255,255,0.85)" strokeWidth="3"/></svg>
              </button>
            )}
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.05, marginBottom: 6, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
            {course.name}
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
            {holes.length > 0 && holes.some(h => h.par) && <span>Par {holes.reduce((s, h) => s + (h.par || 0), 0)}</span>}
            {holes.length > 0 && holes.some(h => h.yardage) && <><span style={{ color: "rgba(255,255,255,0.18)" }}>·</span><span>{holes.reduce((s, h) => s + (h.yardage || 0), 0).toLocaleString()} yds</span></>}
            {courseClips.length > 0 && <><span style={{ color: "rgba(255,255,255,0.18)" }}>·</span><span>{courseClips.length} clips</span></>}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", position: "relative" }}>
            {hero.year && (
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 99, padding: "4px 12px" }}>
                Est. {hero.year}
              </span>
            )}
            {/* Save button — bottom right of hero */}
            <button
              onClick={() => setShowPicker(!showPicker)}
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, background: saved ? "rgba(26,158,66,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${saved ? "rgba(26,158,66,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 99, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill={saved ? "#1a9e42" : "none"} stroke={saved ? "#1a9e42" : "rgba(255,255,255,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              <span style={{ color: saved ? "#1a9e42" : "rgba(255,255,255,0.5)" }}>{saved ? "Saved" : "Save"}</span>
            </button>
            {/* Save picker dropdown */}
            {showPicker && (
              <div style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, background: "rgba(13,35,24,0.98)", border: "1px solid rgba(26,158,66,0.3)", borderRadius: 12, padding: 6, zIndex: 50, minWidth: 160, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                <button onClick={() => toggleSave("PLAYED")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: saveType === "PLAYED" ? "rgba(26,158,66,0.15)" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 16 }}>✓</span>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: saveType === "PLAYED" ? "#1a9e42" : "#fff" }}>Played</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>I&apos;ve played this course</div>
                  </div>
                </button>
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
                <button onClick={() => toggleSave("BUCKET_LIST")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: saveType === "BUCKET_LIST" ? "rgba(26,158,66,0.15)" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 16 }}>⛳</span>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: saveType === "BUCKET_LIST" ? "#1a9e42" : "#fff" }}>Bucket List</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>I want to play this</div>
                  </div>
                </button>
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
                <button
                  onClick={async () => {
                    setShowPicker(false);
                    setTripStep("select");
                    setNewTripName(""); setNewTripStart(""); setNewTripEnd("");
                    setTripPlayDate(""); setTripTeeTime(""); setTripAccommodation("");
                    setSelectedTripId(null); setSelectedTripName("");
                    if (user) {
                      const supabase = createClient();
                      const { data: memberData } = await supabase.from("GolfTripMember").select("tripId").eq("userId", user.id);
                      if (memberData && memberData.length > 0) {
                        const tripIds = memberData.map((m: any) => m.tripId);
                        const { data: tripsData } = await supabase.from("GolfTrip").select("id, name, startDate, endDate").in("id", tripIds).order("createdAt", { ascending: false });
                        setUserTrips(tripsData || []);
                      } else {
                        setUserTrips([]);
                      }
                    }
                    setTripPickerOpen(true);
                  }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left", marginTop: 2 }}
                >
                  <span style={{ fontSize: 16 }}>✈️</span>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>Golf Trip</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Add to a trip itinerary</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

{/* Action bar */}
<div style={{ padding: "14px 20px 16px", display: "flex", gap: 8 }}>
  <button
    onClick={() => setScorecardOpen(true)}
    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "11px 8px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/></svg>
    <span>Scorecard</span>
  </button>
  <button
    onClick={() => router.push(`/upload?courseId=${id}`)}
    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "11px 8px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    <span>Upload</span>
  </button>
  <button
    onClick={openContribute}
    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "11px 8px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    <span>Contribute</span>
  </button>
</div>

      {/* Series card */}
      {(extendedClips.length > 0 || user) && (
        <div style={{ padding: "0 16px 16px" }}>
          {extendedClips.length > 0 ? (
            <button
              onClick={() => setExtendedClip(extendedClips[0])}
              style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>Multi-hole series</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{extendedClips.length} playthrough{extendedClips.length !== 1 ? "s" : ""}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          ) : user ? (
            <button
              onClick={() => router.push(`/upload?courseId=${id}`)}
              style={{ width: "100%", background: "rgba(77,168,98,0.04)", border: "1px dashed rgba(77,168,98,0.2)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(77,168,98,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>Post a multi-hole series</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 1 }}>Front 9, Back 9, Full Round, or 3-hole clips</div>
              </div>
            </button>
          ) : null}
        </div>
      )}

      {/* 18-hole grid — stacked Front 9 / Back 9 */}
      <div style={{ padding: courseClips.length === 0 ? "0 16px" : "0 16px", maxWidth: isDesktop ? 600 : undefined }}>
        {courseClips.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 20px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⛳</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "#fff", marginBottom: 8, lineHeight: 1.2 }}>No intel on this course yet.</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.65, marginBottom: 20, maxWidth: 270 }}>Every golfer who plays here knows something the next one needs to know. Be the first to put it on record.</div>
            <button onClick={() => router.push(`/upload?courseId=${id}`)} style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer", boxShadow: "0 2px 14px rgba(45,122,66,0.35)" }}>
              Post the first clip
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {[{ label: "Front 9", nineHoles: [1,2,3,4,5,6,7,8,9] }, { label: "Back 9", nineHoles: [10,11,12,13,14,15,16,17,18] }].map(({ label, nineHoles }) => {
              const scoutedCount = nineHoles.filter(h => holeClipsMap[h]?.length > 0).length;
              return (
                <div key={label}>
                  {/* Section header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 3, height: 14, background: "#4da862", borderRadius: 1, flexShrink: 0 }} />
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, color: "#4da862", letterSpacing: "1.6px", textTransform: "uppercase" }}>{label}</span>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{scoutedCount} holes scouted</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {nineHoles.map(holeNum => {
                      const clips = holeClipsMap[holeNum];
                      const hasClips = clips && clips.length > 0;
                      const clipCount = clips?.length || 0;
                      const holeData = holes.find(h => h.holeNumber === holeNum);
                      const topClip = clips?.[0];
                      return (
                        <div
                          key={holeNum}
                          onClick={() => { if (hasClips) { setFeedStartHole(holeNum); setFeedOpen(true); if (!localStorage.getItem("ti-feed-hint")) { setShowFeedHint(true); setTimeout(() => { setShowFeedHint(false); localStorage.setItem("ti-feed-hint", "1"); }, 2800); } } else { router.push(`/upload?courseId=${id}&holeNumber=${holeNum}`); } }}
                          style={{ aspectRatio: "3/4", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", cursor: "pointer", position: "relative", overflow: "hidden", background: hasClips ? "#0e1a13" : "#0a120d", border: `1px solid ${hasClips ? "rgba(77,168,98,0.2)" : "rgba(255,255,255,0.04)"}` }}
                        >
                          {/* Background thumbnail for populated tiles */}
                          {hasClips && topClip && (
                            <>
                              {topClip.mediaType === "VIDEO" ? (
                                <HlsVideo src={getVideoSrc(topClip.mediaUrl, topClip.cloudflareVideoId)} muted playsInline preload="metadata" onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 0.001; }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <img src={topClip.mediaUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                              )}
                              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,16,10,0.72) 0%, rgba(7,16,10,0.55) 40%, rgba(7,16,10,0.78) 100%)" }} />
                            </>
                          )}
                          {/* Content */}
                          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
                            {/* Top row: Par + Yardage */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: hasClips ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.35)" }}>
                                {holeData?.par ? `Par ${holeData.par}` : ""}
                              </span>
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: hasClips ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.22)" }}>
                                {holeData?.yardage ? holeData.yardage : ""}
                              </span>
                            </div>
                            {/* Center: hole number */}
                            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: holeNum <= 9 ? 44 : 40, fontWeight: 400, color: hasClips ? "#ffffff" : "rgba(255,255,255,0.3)", letterSpacing: "-1px", lineHeight: 1 }}>{holeNum}</span>
                            </div>
                            {/* Bottom: clip indicator */}
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              {hasClips ? (
                                <>
                                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#4da862", flexShrink: 0 }} />
                                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, color: "#4da862" }}>{clipCount} clip{clipCount !== 1 ? "s" : ""}</span>
                                </>
                              ) : (
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>No clips yet</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Extended Play — horizontal scroll row */}
      {extendedClips.length > 0 && (
        <div style={{ marginTop: 20, paddingBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", marginBottom: 10 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em" }}>Extended Play</div>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 14px 2px", scrollbarWidth: "none" }}>
            {extendedClips.map(clip => (
              <div
                key={clip.id}
                onClick={() => setExtendedClip(clip)}
                style={{ position: "relative", width: 110, flexShrink: 0, aspectRatio: "9/16", borderRadius: 8, overflow: "hidden", background: "#0d2318", cursor: "pointer" }}
              >
                {clip.mediaType === "VIDEO" ? (
                  <HlsVideo src={getVideoSrc(clip.mediaUrl, clip.cloudflareVideoId)} muted playsInline preload="metadata" onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 0.001; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <img src={clip.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)" }} />
                <div style={{ position: "absolute", bottom: 6, right: 6 }}>
                  <div style={{ background: "#1a5c30", border: "1px solid rgba(255,255,255,0.45)", borderRadius: 3, padding: "2px 6px 3px", display: "inline-flex", alignItems: "center" }}>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 9, fontWeight: 700, color: "#fff" }}>
                      {clip.shotType === "FULL_ROUND" ? "Full 18" : clip.shotType === "FRONT_NINE" ? "Front 9" : clip.shotType === "BACK_NINE" ? "Back 9" : clip.shotType === "THREE_HOLE" ? "3 Holes" : "Extended"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Load more clips */}
      {hasMoreClips && (
        <div style={{ padding: "8px 16px 16px", display: "flex", justifyContent: "center" }}>
          <button
            onClick={loadMoreClips}
            disabled={loadingMoreClips}
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "11px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: loadingMoreClips ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)", cursor: loadingMoreClips ? "default" : "pointer" }}
          >
            {loadingMoreClips ? "Loading…" : "Load more clips"}
          </button>
        </div>
      )}

      <div style={{ height: 100 }} />

{/* Contribute link */}

{/* About modal */}
      {aboutOpen && (
        <div onClick={() => setAboutOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "20px 24px 44px" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{course.name}</div>
            {(hero.designer || hero.year) && (
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>
                {hero.designer ? `Designed by ${hero.designer}` : ""}{hero.designer && hero.year ? " · " : ""}{hero.year ? `Est. ${hero.year}` : ""}
              </div>
            )}
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
              {course.description || hero.description}
            </p>
            <button onClick={() => setAboutOpen(false)} style={{ marginTop: 24, width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}

{/* Scorecard modal */}
      {scorecardOpen && (
        <div onClick={() => { if (!scorecardEditMode) setScorecardOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 20px" }} />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 2 }}>Scorecard</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{course.name}</div>
              </div>
              {scorecardView === "digital" && !scorecardEditMode && (
                <button
                  onClick={() => { setEditedHoles([...holes]); setScorecardEditMode(true); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "7px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
              )}
              {scorecardEditMode && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => { setScorecardEditMode(false); setEditedHoles([...holes]); }}
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "7px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                  >Cancel</button>
                  <button
                    onClick={async () => {
                      setSavingScorecard(true);
                      const supabase = createClient();
                      await Promise.all(editedHoles.map(h =>
                        supabase.from("Hole").update({ par: h.par, yardage: h.yardage, handicapRank: h.handicapRank }).eq("id", h.id)
                      ));
                      setHoles([...editedHoles]);
                      setScorecardEditMode(false);
                      setSavingScorecard(false);
                    }}
                    disabled={savingScorecard}
                    style={{ background: "#2d7a42", border: "none", borderRadius: 10, padding: "7px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", opacity: savingScorecard ? 0.6 : 1 }}
                  >{savingScorecard ? "Saving..." : "Save"}</button>
                </div>
              )}
            </div>

            {/* Toggle */}
            {!scorecardEditMode && (
              <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 3, marginBottom: 20 }}>
                {(["digital", "photo"] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setScorecardView(v)}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, background: scorecardView === v ? "rgba(77,168,98,0.2)" : "transparent", color: scorecardView === v ? "#4da862" : "rgba(255,255,255,0.4)", transition: "all 0.15s" }}
                  >{v === "digital" ? "Digital" : "Photo"}</button>
                ))}
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={scorecardPhotoRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file || !course) return;
                setUploadingScorecardPhoto(true);
                const supabase = createClient();
                const ext = file.name.split(".").pop();
                const path = `scorecards/${course.id}.${ext}`;
                const { error: upErr } = await supabase.storage.from("tour-it-photos").upload(path, file, { upsert: true });
                if (!upErr) {
                  const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(path);
                  await supabase.from("Course").update({ scorecardImageUrl: publicUrl }).eq("id", course.id);
                  setCourse(c => c ? { ...c, scorecardImageUrl: publicUrl } : c);
                }
                setUploadingScorecardPhoto(false);
                e.target.value = "";
              }}
            />

            {/* Photo view */}
            {scorecardView === "photo" && (
              <div>
                {course.scorecardImageUrl ? (
                  <div>
                    <img src={course.scorecardImageUrl} alt="Scorecard" style={{ width: "100%", borderRadius: 12, marginBottom: 12 }} />
                    <button
                      onClick={() => scorecardPhotoRef.current?.click()}
                      disabled={uploadingScorecardPhoto}
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                    >{uploadingScorecardPhoto ? "Uploading..." : "Replace photo"}</button>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 20px", border: "1.5px dashed rgba(255,255,255,0.1)", borderRadius: 16 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📷</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>Upload a photo of the official scorecard</div>
                    <button
                      onClick={() => scorecardPhotoRef.current?.click()}
                      disabled={uploadingScorecardPhoto}
                      style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "12px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}
                    >{uploadingScorecardPhoto ? "Uploading..." : "Upload photo"}</button>
                  </div>
                )}
              </div>
            )}

            {/* Digital edit mode */}
            {scorecardView === "digital" && scorecardEditMode && (
              <div>
                <style>{`.sc-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 8px 10px; font-family: 'Outfit', sans-serif; font-size: 14px; color: #fff; outline: none; text-align: center; } .sc-input:focus { border-color: rgba(77,168,98,0.5); }`}</style>
                {[{ label: "Front 9", start: 0, end: 9 }, { label: "Back 9", start: 9, end: 18 }].map(({ label, start, end }) => {
                  const nine = editedHoles.slice(start, end);
                  if (nine.length === 0) return null;
                  return (
                    <div key={label} style={{ marginBottom: 20 }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>{label}</div>
                      {/* Column headers */}
                      <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
                        <div />
                        {["Par", "Yards", "HCP"].map(l => (
                          <div key={l} style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>{l}</div>
                        ))}
                      </div>
                      {nine.map((h, idx) => {
                        const globalIdx = start + idx;
                        return (
                          <div key={h.holeNumber} style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr 1fr", gap: 6, marginBottom: 6, alignItems: "center" }}>
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>{h.holeNumber}</div>
                            <select
                              className="sc-input"
                              value={h.par}
                              onChange={e => {
                                const v = parseInt(e.target.value);
                                setEditedHoles(prev => prev.map((eh, i) => i === globalIdx ? { ...eh, par: v } : eh));
                              }}
                            >
                              {[3, 4, 5].map(p => <option key={p} value={p} style={{ background: "#07100a" }}>{p}</option>)}
                            </select>
                            <input
                              className="sc-input"
                              type="number" min={1}
                              value={h.yardage ?? ""}
                              placeholder="—"
                              onChange={e => {
                                const v = e.target.value === "" ? null : parseInt(e.target.value) || null;
                                setEditedHoles(prev => prev.map((eh, i) => i === globalIdx ? { ...eh, yardage: v } : eh));
                              }}
                            />
                            <select
                              className="sc-input"
                              value={h.handicapRank ?? ""}
                              onChange={e => {
                                const v = e.target.value === "" ? null : parseInt(e.target.value);
                                setEditedHoles(prev => prev.map((eh, i) => i === globalIdx ? { ...eh, handicapRank: v as any } : eh));
                              }}
                            >
                              <option value="" style={{ background: "#07100a" }}>—</option>
                              {Array.from({ length: 18 }, (_, i) => i + 1).map(n => <option key={n} value={n} style={{ background: "#07100a" }}>{n}</option>)}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Digital read mode */}
            {scorecardView === "digital" && !scorecardEditMode && (
              <>
                {[{ label: "Front 9", start: 0, end: 9 }, { label: "Back 9", start: 9, end: 18 }].map(({ label, start, end }) => {
                  const nine = holes.slice(start, end);
                  if (nine.length === 0) return null;
                  const totalPar = nine.reduce((s, h) => s + h.par, 0);
                  const totalYards = nine.reduce((s, h) => s + (h.yardage || 0), 0);
                  const hasYards = nine.some(h => h.yardage);
                  const hasHcp = nine.some(h => h.handicapRank);
                  return (
                    <div key={label} style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>{label}</div>
                      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                          <div style={{ width: 36, padding: "8px 8px", fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", flexShrink: 0 }}>Hole</div>
                          {nine.map(h => <div key={h.holeNumber} style={{ flex: 1, padding: "8px 4px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{h.holeNumber}</div>)}
                          <div style={{ width: 30, padding: "8px 4px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", flexShrink: 0 }}>{label === "Front 9" ? "Out" : "In"}</div>
                        </div>
                        {hasYards && (
                          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                            <div style={{ width: 36, padding: "8px 8px", fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", flexShrink: 0 }}>Yds</div>
                            {nine.map(h => <div key={h.holeNumber} style={{ flex: 1, padding: "8px 4px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{h.yardage || "—"}</div>)}
                            <div style={{ width: 30, padding: "8px 4px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", flexShrink: 0 }}>{totalYards || "—"}</div>
                          </div>
                        )}
                        <div style={{ display: "flex", borderBottom: hasHcp ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                          <div style={{ width: 36, padding: "9px 8px", fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", flexShrink: 0 }}>Par</div>
                          {nine.map(h => <div key={h.holeNumber} style={{ flex: 1, padding: "9px 4px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: h.par === 3 ? "#6bcf7f" : h.par === 5 ? "#f0c55a" : "#fff" }}>{h.par}</div>)}
                          <div style={{ width: 30, padding: "9px 4px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#1a9e42", flexShrink: 0 }}>{totalPar}</div>
                        </div>
                        {hasHcp && (
                          <div style={{ display: "flex" }}>
                            <div style={{ width: 36, padding: "8px 8px", fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", flexShrink: 0 }}>HCP</div>
                            {nine.map(h => <div key={h.holeNumber} style={{ flex: 1, padding: "8px 4px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{h.handicapRank || "—"}</div>)}
                            <div style={{ width: 30, flexShrink: 0 }} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {holes.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "rgba(26,158,66,0.1)", borderRadius: 12, border: "1px solid rgba(26,158,66,0.2)", marginTop: 4 }}>
                    <div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total</div>
                      {holes.some(h => h.yardage) && (
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{holes.reduce((s, h) => s + (h.yardage || 0), 0).toLocaleString()} yds · Championship tees</div>
                      )}
                    </div>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#1a9e42" }}>Par {holes.reduce((s, h) => s + h.par, 0)}</span>
                  </div>
                )}
                {holes.some(h => h.yardage) && (
                  <div style={{ marginTop: 12, fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", lineHeight: 1.5 }}>
                    Yardages shown are from the championship (tips) tees.
                  </div>
                )}
              </>
            )}

            {!scorecardEditMode && (
              <button onClick={() => setScorecardOpen(false)} style={{ marginTop: 20, width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Close</button>
            )}
          </div>
        </div>
      )}

{/* Contribute modal */}
      {contributeOpen && (
        <div onClick={() => setContributeOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Contribute</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 24 }}>Help keep {course.name} accurate and beautiful</div>

            {contributeSuccess ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, color: "#1a9e42", marginBottom: 6 }}>Thanks for contributing!</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Your updates are live.</div>
                <button onClick={() => setContributeOpen(false)} style={{ marginTop: 20, background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px 32px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Done</button>
              </div>
            ) : (
              <>
                {/* Course Info fields */}
                <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Course Info</div>

                  {/* Zip / Year */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Zip Code</label>
                      <input value={editZip} onChange={e => setEditZip(e.target.value)} placeholder="60601"
                        style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Year Est.</label>
                      <input type="number" value={editYearEstablished} onChange={e => setEditYearEstablished(e.target.value)} placeholder="1924" min="1800" max={new Date().getFullYear()}
                        style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }} />
                    </div>
                  </div>

                  {/* Course type */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Access</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["PUBLIC", "SEMI_PRIVATE", "PRIVATE"] as const).map(type => (
                        <button key={type} onClick={() => setEditCourseType(editCourseType === type ? "" : type)}
                          style={{ flex: 1, background: editCourseType === type ? "rgba(77,168,98,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${editCourseType === type ? "rgba(77,168,98,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "10px 6px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: editCourseType === type ? "#4da862" : "rgba(255,255,255,0.45)", cursor: "pointer" }}>
                          {type === "SEMI_PRIVATE" ? "Semi-Private" : type.charAt(0) + type.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Cover photo */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Cover Photo</div>
                  <label style={{ display: "block", cursor: "pointer" }}>
                    <div style={{ width: "100%", height: 140, borderRadius: 12, border: "1.5px dashed rgba(26,158,66,0.4)", background: "rgba(26,158,66,0.05)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                      {coverPreview ? (
                        <img src={coverPreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : course.coverImageUrl ? (
                        <img src={course.coverImageUrl} alt="current" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }} />
                      ) : (
                        <div style={{ textAlign: "center" }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(26,158,66,0.7)" }}>Tap to upload a beauty shot</div>
                        </div>
                      )}
                      {coverPreview && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "4px 10px", borderRadius: 99 }}>Change</span></div>}
                    </div>
                    <input type="file" accept="image/*" onChange={handleCoverPick} style={{ display: "none" }} />
                  </label>
                </div>

                {/* Description */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Course Description</div>
                    <button
                      onClick={generateDescription}
                      disabled={generatingDesc}
                      style={{ background: "none", border: "none", cursor: generatingDesc ? "default" : "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: generatingDesc ? "rgba(26,158,66,0.4)" : "#1a9e42", display: "flex", alignItems: "center", gap: 4, padding: 0 }}
                    >
                      {generatingDesc ? (
                        <>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid rgba(26,158,66,0.3)", borderTopColor: "#1a9e42", animation: "spin 0.6s linear infinite" }} />
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>
                          Generate a draft
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="What makes this course worth playing? Be honest..."
                    rows={4}
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", resize: "none", outline: "none" }}
                  />
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 5 }}>
                    Generate a draft then edit it — you know this course better than any AI.
                  </div>
                </div>

                {/* Course Logo upload */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Course Logo</div>
                  <label style={{ display: "block", cursor: "pointer" }}>
                    <div style={{ width: 80, height: 80, borderRadius: 12, border: "1.5px dashed rgba(26,158,66,0.4)", background: "rgba(26,158,66,0.05)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {logoPreview ? (
                        <img src={logoPreview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10 }} />
                      ) : course.logoUrl ? (
                        <img src={course.logoUrl} alt="current logo" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10, opacity: 0.5 }} />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={handleLogoPick} style={{ display: "none" }} />
                  </label>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>Tap the square to upload a logo image</div>
                </div>

                {contributeError && (
                  <div style={{ background: "rgba(200,60,60,0.12)", border: "1px solid rgba(200,60,60,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,120,120,0.9)", lineHeight: 1.5 }}>
                    {contributeError}
                  </div>
                )}
                <button onClick={handleContributeSubmit} disabled={contributing} style={{ width: "100%", background: contributing ? "rgba(45,122,66,0.5)" : "#2d7a42", border: "none", borderRadius: 12, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: contributing ? "default" : "pointer", boxShadow: "0 2px 12px rgba(45,122,66,0.3)" }}>
                  {contributing ? "Saving..." : "Submit Updates"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Full-screen feed modal — vertical = next hole, horizontal = other clips from same hole */}
      {feedOpen && (
        <div className="feed-modal" ref={feedRef} onScroll={handleFeedScroll} onClick={() => { if (showFeedHint) { setShowFeedHint(false); localStorage.setItem("ti-feed-hint", "1"); } }} style={{ left: isDesktop ? 72 : 0 }}>
          {holesWithClips.map(holeNum => {
            const clips = holeClipsMap[holeNum] || [];
            const isHoleActive = holeNum === activeHoleNum;
            const activeClipIdx = activeClipByHole[holeNum] || 0;
            return (
              <div
                key={holeNum}
                className="feed-hole-page"
                ref={el => { holeScrollRefs.current[holeNum] = el; }}
                onScroll={() => {
                  const inner = holeScrollRefs.current[holeNum];
                  if (!inner) return;
                  const clipIdx = Math.round(inner.scrollLeft / inner.offsetWidth);
                  setActiveClipByHole(prev => ({ ...prev, [holeNum]: clipIdx }));
                }}
              >
                {clips.map((clip, clipIdx) => {
                  const holeData = holes.find(h => h.holeNumber === holeNum);
                  return (
                  <div key={clip.id} className="feed-clip-page">
                    <FeedCard
                      clip={clip}
                      isActive={isHoleActive && clipIdx === activeClipIdx}
                      onClose={() => setFeedOpen(false)}
                      onComment={() => setCommentUploadId(clip.id)}
                      course={course}
                      uploaderMap={uploaders}
                      clipIndex={clipIdx}
                      totalClips={clips.length}
                      holeNumber={holeNum}
                      holePar={holeData?.par}
                      holeYardage={holeData?.yardage}
                      scoutedHoles={holesWithClips}
                      holeIndex={holesWithClips.indexOf(holeNum)}
                      onEnded={() => {
                        if (clipIdx < clips.length - 1) {
                          const hsr = holeScrollRefs.current[holeNum];
                          hsr?.scrollBy({ left: hsr.offsetWidth, behavior: "smooth" });
                        } else {
                          feedRef.current?.scrollBy({ top: window.innerHeight, behavior: "smooth" });
                        }
                      }}
                      onReport={user && clip.userId !== user.id ? () => setReportClipId(clip.id) : undefined}
                      onEdit={user && clip.userId === user.id ? () => setEditClipInfo({ id: clip.id, holeId: clip.holeId ?? null, holeNumber: clip.holeNumber ?? null }) : undefined}
                      currentUserId={user?.id}
                    />
                  </div>
                  );
                })}
              </div>
            );
          })}
          {/* One-time gesture hint */}
          {showFeedHint && (
            <div style={{ position: "fixed", inset: 0, zIndex: 110, pointerEvents: "none" }}>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", animation: "hint-fade 2.8s ease forwards", background: "rgba(0,0,0,0.62)", backdropFilter: "blur(12px)", borderRadius: 16, padding: "16px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.8)", letterSpacing: "0.02em" }}>swipe for more shots</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
                <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.1)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.8)", letterSpacing: "0.02em" }}>scroll for next hole</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
            </div>
          )}

          {/* End card — suggested courses */}
          {suggestedCourses.length > 0 && (
            <div className="feed-end-snap">
              <div style={{ width: "100%", height: "100svh", background: "#07100a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", position: "relative" }}>
                <button onClick={() => setFeedOpen(false)} style={{ position: "absolute", top: 52, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 20 }}>More to scout</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", maxWidth: 360 }}>
                  {suggestedCourses.map(c => (
                    <button key={c.id} onClick={() => { setFeedOpen(false); router.push(`/courses/${c.id}`); }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", cursor: "pointer", textAlign: "left", padding: 0 }}>
                      <div style={{ width: "100%", height: 90, background: "#0d2318", position: "relative", overflow: "hidden" }}>
                        {c.coverImageUrl
                          ? <img src={c.coverImageUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg, #1a4d22 0%, #0d2e14 100%)" }} />
                        }
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)" }} />
                        {c.logoUrl && (
                          <div style={{ position: "absolute", top: 7, right: 7, width: 28, height: 18, borderRadius: 5, overflow: "hidden" }}>
                            <img src={c.logoUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "10px 12px 12px" }}>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: 2 }}>{c.name}</div>
                        {(c.city || c.state) && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{[c.city, c.state].filter(Boolean).join(", ")}</div>}
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setFeedOpen(false)} style={{ marginTop: 20, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 24px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                  Back to {course?.name}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Extended Play full-screen viewer */}
      {extendedClip && (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "#000", display: "flex", flexDirection: "column" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "52px 14px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)", zIndex: 10 }}>
            <button onClick={() => setExtendedClip(null)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
              {extendedClip.shotType === "FULL_ROUND" ? "Full Round" : extendedClip.shotType === "FRONT_NINE" ? "Front 9" : extendedClip.shotType === "BACK_NINE" ? "Back 9" : extendedClip.shotType === "THREE_HOLE" ? "3 Holes" : "Extended Play"}
            </div>
            <div style={{ width: 36 }} />
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {extendedClip.mediaType === "VIDEO" ? (
              <HlsVideo src={getVideoSrc(extendedClip.mediaUrl, extendedClip.cloudflareVideoId)} style={{ width: "100%", height: "100%", objectFit: "cover" }} controls playsInline autoPlay muted />
            ) : (
              <img src={extendedClip.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            )}
          </div>
          {(extendedClip.strategyNote || extendedClip.landingZoneNote || extendedClip.whatCameraDoesntShow) && (
            <div style={{ position: "absolute", bottom: 80, left: 16, right: 80, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
              {[extendedClip.strategyNote, extendedClip.landingZoneNote, extendedClip.whatCameraDoesntShow].filter(Boolean).join(" · ")}
            </div>
          )}
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
                  <button key={opt.value} onClick={() => setReportReason(opt.value)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: reportReason === opt.value ? "rgba(255,255,255,0.06)" : "none", border: reportReason === opt.value ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent", borderRadius: 10, padding: "11px 14px", marginBottom: 6, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.75)", textAlign: "left" }}>
                    {opt.label}
                    {reportReason === opt.value && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                ))}
                <button
                  disabled={!reportReason || submittingReport}
                  onClick={async () => {
                    if (!reportReason || !user) return;
                    setSubmittingReport(true);
                    await createClient().from("ModerationReport").insert({ id: crypto.randomUUID(), reportedById: user.id, uploadId: reportClipId, reason: reportReason, createdAt: new Date().toISOString() });
                    setSubmittingReport(false);
                    setReportDone(true);
                    setTimeout(() => { setReportClipId(null); setReportReason(null); setReportDone(false); }, 1800);
                  }}
                  style={{ width: "100%", marginTop: 8, background: reportReason ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: reportReason ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)", cursor: reportReason ? "pointer" : "not-allowed" }}>
                  {submittingReport ? "Submitting…" : "Submit report"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit clip sheet */}
      {editClipInfo && course && (
        <EditClipSheet
          uploadId={editClipInfo.id}
          courseId={course.id}
          currentHoleId={editClipInfo.holeId}
          currentHoleNumber={editClipInfo.holeNumber}
          currentUserId={user?.id ?? null}
          onClose={() => setEditClipInfo(null)}
          onSaved={(updated) => {
            setCourseClips(prev => prev.map(c => c.id === editClipInfo.id ? { ...c, holeNumber: updated.holeNumber ?? c.holeNumber, holeId: updated.holeId ?? c.holeId, shotType: updated.shotType, clubUsed: updated.clubUsed, windCondition: updated.windCondition, strategyNote: updated.strategyNote } : c));
            setEditClipInfo(null);
          }}
        />
      )}

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
                  <div className={isLegend(c.rank) ? "legend-ring" : undefined} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(26,158,66,0.2)", border: getRankRingBorder(c.rank), overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {c.avatarUrl
                      ? <img src={c.avatarUrl} alt={c.username} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                      : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    }
                  </div>
                  <div>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: getRankColor(c.rank) }}>@{c.username} </span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{c.body}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
              {/* @mention dropdown */}
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
                  placeholder={user ? "Add a comment... use @ to tag" : "Log in to comment"}
                  disabled={!user}
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }}
                  onKeyDown={e => { if (e.key === "Enter" && commentText.trim()) submitComment(); }}
                />
                <button
                  onClick={submitComment}
                  disabled={!commentText.trim() || submittingComment || !user}
                  style={{ background: "#2d7a42", border: "none", borderRadius: 10, padding: "10px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: (!commentText.trim() || !user) ? 0.4 : 1 }}
                >
                  {submittingComment ? "..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Golf Trip picker modal */}
      {tripPickerOpen && (
        <div onClick={() => setTripPickerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "20px 20px 44px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 20px" }} />

            {tripStep === "select" && (
              <>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Add to Golf Trip</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>Select a trip or create a new one</div>
                {userTrips.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    {userTrips.map(trip => (
                      <button key={trip.id} onClick={() => { setSelectedTripId(trip.id); setSelectedTripName(trip.name); setTripStep("details"); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, cursor: "pointer", marginBottom: 8, textAlign: "left" }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, rgba(26,158,66,0.25), rgba(45,122,66,0.15))", border: "1px solid rgba(26,158,66,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 18 }}>✈️</span>
                        </div>
                        <div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{trip.name}</div>
                          {(trip.startDate || trip.endDate) && (
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                              {trip.startDate || ""}{trip.startDate && trip.endDate ? " → " : ""}{trip.endDate || ""}
                            </div>
                          )}
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setTripStep("create")} style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New Trip
                </button>
              </>
            )}

            {tripStep === "create" && (
              <>
                <button onClick={() => setTripStep("select")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.45)", fontSize: 12, fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", gap: 4, marginBottom: 16, padding: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Back
                </button>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 20 }}>New Golf Trip</div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Trip Name *</div>
                  <input value={newTripName} onChange={e => setNewTripName(e.target.value)} placeholder="e.g. Myrtle Beach 2025" style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }} />
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Start Date</div>
                    <input type="date" value={newTripStart} onChange={e => setNewTripStart(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: newTripStart ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>End Date</div>
                    <input type="date" value={newTripEnd} onChange={e => setNewTripEnd(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: newTripEnd ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!newTripName.trim() || !user) return;
                    setSavingTrip(true);
                    const supabase = createClient();
                    const tripId = crypto.randomUUID();
                    await supabase.from("GolfTrip").insert({ id: tripId, name: newTripName.trim(), startDate: newTripStart || null, endDate: newTripEnd || null, createdBy: user.id });
                    await supabase.from("GolfTripMember").insert({ id: crypto.randomUUID(), tripId, userId: user.id, role: "owner" });
                    setSelectedTripId(tripId);
                    setSelectedTripName(newTripName.trim());
                    setSavingTrip(false);
                    setTripStep("details");
                  }}
                  disabled={!newTripName.trim() || savingTrip}
                  style={{ width: "100%", background: !newTripName.trim() ? "rgba(45,122,66,0.4)" : "#2d7a42", border: "none", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: !newTripName.trim() ? "default" : "pointer" }}
                >
                  {savingTrip ? "Creating..." : "Create Trip"}
                </button>
              </>
            )}

            {tripStep === "details" && (
              <>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Course Details</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#1a9e42", marginBottom: 20 }}>Adding {course?.name} to {selectedTripName}</div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Play Date <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>(optional)</span></div>
                  <input type="date" value={tripPlayDate} onChange={e => setTripPlayDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: tripPlayDate ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Tee Time <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>(optional)</span></div>
                  <input type="time" value={tripTeeTime} onChange={e => setTripTeeTime(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: tripTeeTime ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Where you're staying <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>(optional)</span></div>
                  <input value={tripAccommodation} onChange={e => setTripAccommodation(e.target.value)} placeholder="e.g. Marriott Myrtle Beach" style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }} />
                </div>
                <button
                  onClick={async () => {
                    if (!selectedTripId || !id) return;
                    setSavingTrip(true);
                    const supabase = createClient();
                    await supabase.from("GolfTripCourse").insert({ id: crypto.randomUUID(), tripId: selectedTripId, courseId: id as string, playDate: tripPlayDate || null, teeTime: tripTeeTime || null, accommodation: tripAccommodation.trim() || null, sortOrder: 0 });
                    setSavingTrip(false);
                    setTripAddedName(selectedTripName);
                    setTripAddedId(selectedTripId || "");
                    setTripStep("success");
                  }}
                  disabled={savingTrip}
                  style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: savingTrip ? "default" : "pointer", boxShadow: "0 2px 12px rgba(45,122,66,0.3)" }}
                >
                  {savingTrip ? "Adding..." : "Add to Trip ✓"}
                </button>
              </>
            )}

            {tripStep === "success" && (
              <>
                <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(26,158,66,0.15)", border: "1.5px solid rgba(26,158,66,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a9e42" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Course Added!</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 28 }}>{course?.name} is on <span style={{ color: "#1a9e42" }}>{tripAddedName}</span></div>
                  <button
                    onClick={() => { setTripPickerOpen(false); router.push(`/trips/${tripAddedId}`); }}
                    style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", marginBottom: 10, boxShadow: "0 2px 12px rgba(45,122,66,0.3)" }}
                  >
                    View Trip →
                  </button>
                  <button
                    onClick={() => { setTripPickerOpen(false); router.push(`/search?tripId=${tripAddedId}`); }}
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}
                  >
                    + Add Another Course
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <BottomNav />

    </main>
  );
}
