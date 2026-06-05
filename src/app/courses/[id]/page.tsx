"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import LikesSheet from "@/components/LikesSheet";
import { useLike, seedLikedCache } from "@/hooks/useLike";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useSave } from "@/hooks/useSave";
import { ClipTopPill } from "@/components/clip/ClipTopPill";
import { ClipRail } from "@/components/clip/ClipRail";
import { HoleSideBar } from "@/components/clip/HoleSideBar";
import { HoleIdentityCard } from "@/components/clip/HoleIdentityCard";
import { IntelPanel } from "@/components/clip/IntelPanel";
import { sessionMute } from "@/lib/sessionMute";
import EditClipSheet from "@/components/EditClipSheet";
import { SheetPortal } from "@/components/SheetPortal";
import { HlsVideo } from "@/components/HlsVideo";
import { getVideoSrc, getClipThumbnail } from "@/lib/getVideoSrc";
import { VideoScrubber } from "@/components/clip/VideoScrubber";
import { CommentSwipe } from "@/components/clip/CommentSwipe";
import { sendPushToUser } from "@/lib/sendPush";
import { formatClipDate } from "@/lib/formatClipDate";
import { getRankColor, getRankRingBorder, isLegend } from "@/lib/rank-styles";
import { activeFeaturedTournament } from "@/lib/pgaChampionship";
import { cdnImage } from "@/lib/cdnImage";
import CaddieBookIcon from "@/components/CaddieBookIcon";
import { OfficialCourseBadge } from "@/components/course/OfficialCourseBadge";
import ClaimCourseSheet from "@/components/course/ClaimCourseSheet";
import FromTheCourseBlock from "@/components/course/FromTheCourseBlock";
import { type OfficialMedia } from "@/components/course/OfficialMediaCard";
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
  // ── Operator layer (Course-claim feature, 2026-05-30) ─────────────
  // isClaimed flips when at least one CourseClaim is VERIFIED.
  // officialDescription supersedes `description` ONLY when isClaimed
  // is true; the UGC description stays primary on unclaimed courses.
  // teeSheetUrl renders a "Book a tee time" button inside the
  // FromTheCourseBlock when set.
  isClaimed: boolean;
  officialDescription: string | null;
  teeSheetUrl: string | null;
  membershipInquiryUrl: string | null;
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
  // Original uploader (set when ownership was transferred via approved
  // hero tag). When uploadedByUsername is non-null, the "uploaded by @x"
  // attribution chip renders beneath the username row.
  uploadedByUserId?: string | null;
  uploadedByUsername?: string | null;
  createdAt: string;
  // Operator media folded into the feed. When true this "clip" is a
  // CourseOfficialMedia row mapped into Clip shape — it has no Upload
  // backing, so FeedCard suppresses like/comment/follow/report and shows
  // a "From the course" highlight instead of an uploader row.
  isOfficial?: boolean;
  officialCaption?: string | null;
};

type SuggestedCourse = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
};

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

// Tee colors users can rate (slope/rating). Swatch drives the editor chip.
const TEE_COLORS: { color: string; label: string; swatch: string }[] = [
  { color: "BLACK", label: "Black", swatch: "#111317" },
  { color: "BLUE", label: "Blue", swatch: "#3b6fd4" },
  { color: "WHITE", label: "White", swatch: "#e9e9ea" },
  { color: "GOLD", label: "Gold", swatch: "#c8a23a" },
  { color: "GREEN", label: "Green", swatch: "#4da862" },
  { color: "RED", label: "Red", swatch: "#d2484b" },
];

const SHOT_LABEL: Record<string, string> = {
  TEE_SHOT: "Tee Shot", APPROACH: "Approach", LAY_UP: "Layup",
  CHIP: "Chip", PITCH: "Pitch", PUTT: "Putt",
  BUNKER: "Bunker", FULL_HOLE: "Full Hole",
};

// Map an operator CourseOfficialMedia row into a Clip so it can live
// natively inside the hole feeds / Extended Play rail next to UGC. The
// `official-` id prefix keeps it from colliding with real Upload ids,
// and isOfficial flips FeedCard into its no-engagement "From the course"
// presentation.
function officialMediaToClip(m: OfficialMedia, courseId: string, courseName?: string): Clip {
  return {
    id: `official-${m.id}`,
    mediaType: m.mediaType === "image" ? "PHOTO" : "VIDEO",
    mediaUrl: m.url,
    cloudflareVideoId: m.cloudflareVideoId,
    shotType: null, clubUsed: null, strategyNote: null, landingZoneNote: null,
    whatCameraDoesntShow: null, windCondition: null, datePlayedAt: null,
    rankScore: 0, holeId: null, courseId,
    likeCount: 0, commentCount: 0,
    holeNumber: m.holeNumber ?? undefined,
    courseName, userId: "", createdAt: "",
    isOfficial: true, officialCaption: m.caption,
  };
}

// Fold operator media into a freshly-built UGC hole map + Extended Play
// list. Hole-assigned media leads its hole bucket (and fans out across
// ranges); course-level media leads the Extended Play rail. Returns the
// merged map/extended plus the holes that now have any content.
function foldOfficialMedia(
  media: OfficialMedia[],
  map: Record<number, Clip[]>,
  extended: Clip[],
  courseId: string,
  courseName?: string,
): { map: Record<number, Clip[]>; extended: Clip[]; holesWithContent: number[] } {
  const mergedMap: Record<number, Clip[]> = { ...map };
  for (const m of media) {
    if (m.holeNumber == null) continue;
    const start = m.holeNumber;
    const end = m.holeRangeEnd && m.holeRangeEnd > start ? m.holeRangeEnd : start;
    for (let h = start; h <= end; h++) {
      mergedMap[h] = [officialMediaToClip(m, courseId, courseName), ...(mergedMap[h] ?? [])];
    }
  }
  const courseLevel = media
    .filter(m => m.holeNumber == null)
    .map(m => officialMediaToClip(m, courseId, courseName));
  const holesWithContent = Object.keys(mergedMap).map(Number).sort((a, b) => a - b);
  return { map: mergedMap, extended: [...courseLevel, ...extended], holesWithContent };
}

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
      <div style={{ background: "#1a5c30", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 4, padding: "6px 14px 7px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.1), 0 2px 6px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 1, background: "rgba(255,255,255,0.5)" }} />
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1, userSelect: "none" }}>{label}</span>
          <div style={{ width: 10, height: 1, background: "rgba(255,255,255,0.5)" }} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: "#1a5c30", border: "1px solid rgba(255,255,255,0.45)", borderRadius: 3, padding: "2px 6px 3px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.1), 0 1px 4px rgba(0,0,0,0.4)" }}>
      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 10, fontWeight: 700, color: "#fff", lineHeight: 1, userSelect: "none" }}>{label}</span>
    </div>
  );
}

function FeedCard({ clip, isActive, onClose, onComment, onShowLikes, course, uploaderMap, clipIndex, totalClips, holeNumber, holePar, holeYardage, holeDescription, scoutedHoles, holeIndex, onEnded, onReport, onEdit, currentUserId, followingIds, onFollow, likedIds, commentedIds, commentOpen }: {
  clip: Clip; isActive: boolean; onClose: () => void; onComment: () => void;
  // Open the "Who liked this" sheet for this clip.
  onShowLikes?: (uploadId: string) => void;
  course: Course | null; uploaderMap: Record<string, { username: string; avatarUrl: string | null; handicapIndex?: number | null; rank?: string | null }>;
  clipIndex: number; totalClips: number;
  holeNumber?: number | null;
  holePar?: number | null; holeYardage?: number | null;
  holeDescription?: string | null;
  scoutedHoles: number[];
  holeIndex: number;
  onEnded: () => void; onReport?: () => void; onEdit?: () => void;
  currentUserId?: string | null;
  followingIds?: Set<string>; onFollow?: (userId: string) => void;
  // Pre-batched set of clip IDs the current user has liked (see useLike).
  // Eliminates per-clip Supabase round-trip → no heart flicker on mount.
  likedIds?: Set<string>;
  // Mirror for comments — set of clip IDs the user has commented on.
  // Drives the green filled-comment-button state so the same clip
  // looks the same on the home feed, the course feed modal, and the
  // user profile (clip uniformity rule, CLAUDE.md).
  commentedIds?: Set<string>;
  // When true, the parent's comment sheet is open. Pauses the video so
  // onEnded can't fire and auto-advance to the next clip while the user types.
  commentOpen?: boolean;
}) {
  const commented = !!commentedIds?.has(clip.id);
  // Operator media folded into the feed — no Upload backing, so we hide
  // like/comment/follow/report and show a "From the course" highlight
  // in place of the uploader row.
  const isOfficial = !!clip.isOfficial;
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [muted, setMuted] = useState(sessionMute.get());
  const [videoPaused, setVideoPaused] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const { liked, likeCount, toggleLike } = useLike({
    uploadId: clip.id,
    initialLikeCount: clip.likeCount || 0,
    initialLiked: likedIds ? likedIds.has(clip.id) : undefined,
    currentUserId: currentUserId ?? null,
  });
  const uploader = uploaderMap[clip.userId];
  const isSystemUploader = uploader?.username === "tourit";
  // Intel button shows when EITHER the uploader added scout notes OR the course has a seeded hole description (e.g. PGA Championship hole preview)
  const hasNotes = !!(clip.strategyNote || clip.clubUsed || clip.windCondition || clip.landingZoneNote || clip.whatCameraDoesntShow || clip.datePlayedAt || holeDescription);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive && !commentOpen) {
      v.play().catch(() => {});
      setVideoPaused(false);
    } else if (isActive && commentOpen) {
      // Comment sheet open — pause without reset; resumes on close.
      v.pause();
      setVideoPaused(true);
    } else {
      v.pause();
      v.currentTime = 0;
      setIntelOpen(false);
    }
  }, [isActive, commentOpen]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const handleMuteToggle = () => {
    const next = !muted;
    setMuted(next);
    sessionMute.set(next);
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

      {clip.mediaType === "VIDEO" && <VideoScrubber videoRef={videoRef} left={holeNumber ? 100 : 16} />}

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
        holePar={holePar}
        holeYardage={holeYardage}
        muted={muted}
        onMuteToggle={handleMuteToggle}
        onTapCourse={onClose}
        onBack={onClose}
        visible={true}
      />


      <HoleSideBar holeIndex={holeIndex} scoutedHoles={scoutedHoles} />

      <HoleIdentityCard holeNumber={holeNumber} holePar={holePar} clipCount={totalClips} flush />

      {/* Right rail — Intel → Avatar → Like → Comment → SEND IT → Report */}
      <ClipRail
        zIndex={10}
        onIntel={hasNotes && !isOfficial ? () => setIntelOpen(o => !o) : undefined}
        intelActive={intelOpen}
        showEngagement={!isOfficial}
        liked={liked}
        likeCount={likeCount}
        onToggleLike={toggleLike}
        onShowLikes={onShowLikes ? () => onShowLikes(clip.id) : undefined}
        commented={commented}
        commentCount={clip.commentCount || 0}
        onComment={onComment}
        sharePath={`/courses/${clip.courseId}${clip.holeNumber ? `/holes/${clip.holeNumber}` : ""}?clip=${clip.id}`}
        shareTitle={`Tour It — ${course?.name || ""}${clip.holeNumber ? ` — Hole ${clip.holeNumber}` : ""}`}
        kebab={onEdit ? "options" : onReport ? "report" : undefined}
        onKebab={onEdit ?? onReport}
      />

      <IntelPanel
        open={intelOpen}
        onClose={() => setIntelOpen(false)}
        holeNumber={holeNumber ?? undefined}
        holePar={holePar}
        holeYardage={holeYardage}
        holeDescription={holeDescription}
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

      {isOfficial && (
        // "From the course" highlight — replaces the uploader row for
        // operator media. Course logo + name + a green pill so it reads
        // as native feed content that's clearly posted by the course.
        <div style={{ position: "absolute", left: !holeNumber ? 16 : holeNumber >= 10 ? 105 : 80, right: 80,
          bottom: clip.mediaType === "VIDEO"
            ? `calc(130px + env(safe-area-inset-bottom))`
            : `calc(85px + env(safe-area-inset-bottom))`,
          zIndex: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 7 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(126,200,140,0.6)", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {course?.logoUrl
                ? <img src={cdnImage(course.logoUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7ed28b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></svg>}
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 800, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>{course?.name ?? "The course"}</span>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", background: "rgba(7,16,10,0.7)", border: "1px solid rgba(126,200,140,0.7)", borderRadius: 99, fontFamily: "'Outfit', sans-serif", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7ed28b", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></svg>
            From the course
          </span>
          {clip.officialCaption && (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.92)", lineHeight: 1.35, textShadow: "0 1px 4px rgba(0,0,0,0.85)", maxWidth: "100%" }}>{clip.officialCaption}</span>
          )}
        </div>
      )}

      {!isOfficial && (uploader?.username || formatClipDate(clip.datePlayedAt, clip.createdAt)) && (
        // Avatar + username + date — anchored at the same bottom offset as
        // the tour-the-feed uploader row. left shifts right when there's a
        // hole number so the row clears the HoleIdentityCard bottom-left.
        <div style={{ position: "absolute", left: !holeNumber ? 16 : holeNumber >= 10 ? 105 : 80, right: 80,
          bottom: `calc(22px + env(safe-area-inset-bottom))`,
          zIndex: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => router.push(`/profile/${clip.userId}`)} aria-label={`Open ${uploader?.username || "uploader"}'s profile`} style={{ display: "flex", alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              <div className={isLegend(uploader?.rank) ? "legend-ring" : undefined} style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", border: getRankRingBorder(uploader?.rank), background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {uploader?.avatarUrl
                  ? <img src={cdnImage(uploader.avatarUrl)} alt={uploader.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
              </div>
            </button>
            {uploader?.username && <span onClick={() => router.push(`/profile/${clip.userId}`)} style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 800, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.9)", cursor: "pointer" }}>{uploader.username}</span>}
            {formatClipDate(clip.datePlayedAt, clip.createdAt) && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 400, color: "rgba(255,255,255,0.65)", textShadow: "0 1px 3px rgba(0,0,0,0.8)", pointerEvents: "none" }}>{formatClipDate(clip.datePlayedAt, clip.createdAt)}</span>}
            {clip.mediaType !== "VIDEO" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, pointerEvents: "none" }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
          </div>
          {clip.uploadedByUsername && (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/profile/${clip.uploadedByUserId ?? ""}`); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99, padding: "3px 9px 3px 7px", cursor: "pointer", textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>
                uploaded by @{clip.uploadedByUsername}
              </span>
            </button>
          )}
        </div>
      )}

      </div>{/* end inner wrapper */}
    </div>
  );
}

export default function CourseProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromMap = searchParams.get("from") === "map";
  const fromTripIdea = searchParams.get("from") === "trip-idea";
  const tripIdeaSlug = fromTripIdea ? searchParams.get("slug") : null;
  const fromFeed = searchParams.get("from") === "feed";
  const scorecardParam = searchParams.get("scorecard");
  const scorecardAutoOpenedRef = useRef(false);
  const isDesktop = useIsDesktop();
  const [course, setCourse] = useState<Course | null>(null);
  const [courseClips, setCourseClips] = useState<Clip[]>([]);
  // Pre-batched set of uploadIds the current user has liked across the
  // visible clips on this course. Populated by one Supabase query after
  // clips + user are both ready — eliminates per-clip like-state fetches
  // and the heart-flicker that came with them.
  const [likedIds, setLikedIds] = useState<Set<string> | undefined>(undefined);
  // Mirrors home feed: set of upload IDs the current user has commented
  // on. Drives the green "you commented" state on the FeedCard's
  // comment button. Same pattern, same source — keeps the clip's
  // comment state uniform whether you see it on the home feed, the
  // course profile feed modal, or your own profile.
  const [commentedIds, setCommentedIds] = useState<Set<string> | undefined>(undefined);
  // "Who liked this" sheet — opens from the like-count tap on a clip.
  const [likesUploadId, setLikesUploadId] = useState<string | null>(null);
  const prefetchedLikesRef = useRef<string>("");
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
  // Raw operator media list, kept so loadMoreClips can re-fold it into
  // the rebuilt hole map / Extended Play rail (the rebuild is UGC-only).
  const officialMediaRef = useRef<OfficialMedia[]>([]);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [holes, setHoles] = useState<{ id: string; holeNumber: number; par: number; handicapRank: number; yardage: number | null; imageUrl: string | null; description: string | null }[]>([]);
  const [scorecardEditMode, setScorecardEditMode] = useState(false);
  const [editedHoles, setEditedHoles] = useState<{ id: string; holeNumber: number; par: number; handicapRank: number; yardage: number | null; imageUrl: string | null; description: string | null }[]>([]);
  const [savingScorecard, setSavingScorecard] = useState(false);
  // Tee ratings (slope/rating per color) — drive the per-player Course
  // Handicap calc in games. Loaded from TeeBox (one entry per color); edited
  // as strings so inputs can sit empty. Saved back to all of a color's holes.
  const [courseTees, setCourseTees] = useState<{ color: string; slope: number | null; rating: number | null }[]>([]);
  const [editedTees, setEditedTees] = useState<{ color: string; slope: string; rating: string }[]>([]);
  const seedEditedTees = () => {
    const seeded = courseTees.map(t => ({
      color: t.color,
      slope: t.slope != null ? String(t.slope) : "",
      rating: t.rating != null ? String(t.rating) : "",
    }));
    setEditedTees(seeded.length > 0 ? seeded : [{ color: "WHITE", slope: "", rating: "" }]);
  };
  const [scorecardView, setScorecardView] = useState<"digital" | "photo">("digital");
  const [uploadingScorecardPhoto, setUploadingScorecardPhoto] = useState(false);
  const scorecardPhotoRef = useRef<HTMLInputElement>(null);
  const [extractingScorecard, setExtractingScorecard] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState<string | null>(null);
  const [extractionConfidence, setExtractionConfidence] = useState<Record<number, { par?: string; yardage?: string; handicapRank?: string }>>({});
  const [contributeOpen, setContributeOpen] = useState(false);
  // Course-claim flow — opened from the "Are you the course?" row
  // inside the Contribute sheet. Kept page-level so the Contribute
  // sheet can close itself before the claim sheet mounts (avoids
  // a brief moment with two stacked overlays).
  const [claimSheetOpen, setClaimSheetOpen] = useState(false);
  // NOTE: do NOT call useKeyboardAwareSheet here — the global
  // <KeyboardSync> + `.tourit-sheet` CSS already drives the lift via
  // --keyboard-height. The legacy hook sets inline `bottom` /
  // `maxHeight` that race with the CSS and end up clamping the sheet
  // to a tiny strip when the keyboard opens (see 2026-05-24 fix).
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
const [editDescription, setEditDescription] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editHoleCount, setEditHoleCount] = useState<9 | 18>(18);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [caddieOpen, setCaddieOpen] = useState(false);
  const [caddieData, setCaddieData] = useState<Record<number, { overview?: string; tee?: string; approach?: string; green?: string; general?: string }> | null>(null);
  const [caddieLoading, setCaddieLoading] = useState(false);
  const [caddieError, setCaddieError] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [contributeSuccess, setContributeSuccess] = useState(false);
  const [contributeError, setContributeError] = useState<string | null>(null);
  const [editCourseName, setEditCourseName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZip, setEditZip] = useState("");
  const [logoLightboxOpen, setLogoLightboxOpen] = useState(false);
  const [editYearEstablished, setEditYearEstablished] = useState("");
  const [editCourseType, setEditCourseType] = useState<"PUBLIC" | "PRIVATE" | "SEMI_PRIVATE" | "">("");
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [user, setUser] = useState<any>(null);
  // True only when the logged-in user is the verified operator of THIS
  // course (a CourseManager row). Gates the owner hamburger menu in the
  // header. Admins are intentionally excluded — they manage courses they
  // don't own from the admin dashboard, so the "Course owner" menu never
  // appears on a course they don't actually manage.
  const [isManager, setIsManager] = useState(false);
  const [managerMenuOpen, setManagerMenuOpen] = useState(false);
  const [reportClipId, setReportClipId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());
  const [commentUploadId, setCommentUploadId] = useState<string | null>(null);
  const [commentItems, setCommentItems] = useState<{ id: string; body: string; username: string; avatarUrl: string | null; createdAt: string; userId: string; rank?: string | null }[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [mentionResults, setMentionResults] = useState<{ id: string; username: string; displayName: string; avatarUrl: string | null }[]>([]);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const mentionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { saved, saveType, toggleSave, showPicker, setShowPicker } = useSave({ courseId: id as string });

  // Batch-fetch the current user's like state for every visible clip on
  // this course in a single Supabase query. Mirrors the home-feed pattern
  // — see useLike.ts. Without this, each FeedCard runs its own auth + Like
  // select on mount and the heart visibly flickers from unfilled to filled.
  useEffect(() => {
    if (!user?.id || courseClips.length === 0) return;
    const uploadIds = courseClips.map(c => c.id);
    // Dedupe-by-content so we don't re-run when courseClips reorders.
    const key = user.id + ":" + uploadIds.slice().sort().join(",");
    if (prefetchedLikesRef.current === key) return;
    prefetchedLikesRef.current = key;
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      // Batch likes + comments in one round-trip so the FeedCard
      // renders with both filled states correct on first paint.
      const [{ data: likeData }, { data: commentData }] = await Promise.all([
        supabase.from("Like").select("uploadId").eq("userId", user.id).in("uploadId", uploadIds),
        supabase.from("Comment").select("uploadId").eq("userId", user.id).in("uploadId", uploadIds),
      ]);
      if (cancelled) return;
      if (likeData) {
        const liked = likeData.map(r => r.uploadId);
        seedLikedCache(user.id, liked, uploadIds);
        setLikedIds(new Set(liked));
      }
      if (commentData) {
        // Dedupe — a user can leave multiple comments on the same
        // clip, but we only care about "has commented at least once."
        setCommentedIds(new Set(commentData.map(r => r.uploadId)));
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, courseClips]);
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  // NOTE: useKeyboardAwareSheet removed 2026-05-25 — the hook's
  // inline bottom/maxHeight raced with the .tourit-sheet CSS-driven
  // --keyboard-height lift and collapsed the sheet to a strip when
  // the keyboard opened. The global KeyboardSync now handles both.
  // Brief "Sent!" confirmation state for the Send pill in the hero.
  // navigator.share opens the iOS share sheet directly (no app feedback
  // needed since the OS provides it); the fallback path that copies the
  // course URL to clipboard uses this flag to show the user something
  // actually happened.
  const [courseShared, setCourseShared] = useState(false);
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
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const [{ data: follows }, { data: mgr }] = await Promise.all([
          supabase.from("Follow").select("followingId").eq("followerId", data.user.id).eq("status", "ACTIVE"),
          supabase.from("CourseManager").select("id").eq("courseId", id).eq("userId", data.user.id).maybeSingle(),
        ]);
        setFollowingIds(new Set((follows || []).map((f: any) => f.followingId)));
        // Owner hamburger is gated on actual course ownership — a CourseManager
        // row for THIS course. Admins manage other courses via the admin
        // dashboard, not this menu, so being an admin no longer surfaces a
        // misleading "Course owner" menu on courses they don't manage.
        setIsManager(!!mgr);
      }
    });
  }, [id]);

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
          userId: c.userId,
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
      // Flip the comment button to its "you commented" filled state
      // immediately so the FeedCard mirrors the home-feed UX.
      setCommentedIds(prev => {
        const next = new Set(prev ?? []);
        next.add(commentUploadId);
        return next;
      });
      // Upload has no holeNumber column — join Hole to get the
      // number (matches the home-feed pattern fixed 2026-05-25).
      const { data: uploadData } = await supabase
        .from("Upload")
        .select("commentCount, likeCount, createdAt, userId, courseId, hole:holeId(holeNumber)")
        .eq("id", commentUploadId)
        .single();
      const holeNumber = ((uploadData?.hole as unknown as { holeNumber: number } | { holeNumber: number }[] | null) instanceof Array
        ? (uploadData?.hole as unknown as { holeNumber: number }[])[0]?.holeNumber
        : (uploadData?.hole as unknown as { holeNumber: number } | null)?.holeNumber) ?? null;
      const newCommentCount = (uploadData?.commentCount || 0) + 1;
      const { computeRankScore } = await import("@/lib/rankScore");
      const newRank = uploadData ? computeRankScore(uploadData.likeCount || 0, newCommentCount, uploadData.createdAt) : undefined;
      await supabase.from("Upload").update({ commentCount: newCommentCount, ...(newRank !== undefined && { rankScore: newRank }) }).eq("id", commentUploadId);

      // Notify clip owner (skip if commenting on own clip)
      if (uploadData?.userId && uploadData.userId !== user.id) {
        const { data: commenterProfile } = await supabase.from("User").select("displayName, username").eq("id", user.id).single();
        const commenterName = commenterProfile?.displayName || commenterProfile?.username || "Someone";
        const notifNow = new Date().toISOString();
        const clipLink = holeNumber ? `/courses/${uploadData.courseId}/holes/${holeNumber}?clip=${commentUploadId}` : `/courses/${uploadData.courseId}`;
        await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: uploadData.userId, type: "comment", title: "New comment", body: `${commenterName} commented on your clip`, linkUrl: clipLink, referenceId: commentUploadId, read: false, createdAt: notifNow, updatedAt: notifNow });
        sendPushToUser("comment_received", uploadData.userId, commentUploadId);
        fetch("/api/points/award", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "comment_received", recipientUserId: uploadData.userId, referenceId: commentUploadId }) }).catch(() => {});
      }
      setCommentItems(prev => [...prev, {
        id: newId, body: commentText.trim(), createdAt: new Date().toISOString(),
        userId: user.id,
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
          tagged.forEach(u => sendPushToUser("comment_mention", u.id, id as string));
        }
      }

      setCommentText("");
    }
    setSubmittingComment(false);
  }

  async function deleteComment(c: { id: string; userId: string }) {
    if (!user || c.userId !== user.id || !commentUploadId) return;
    const supabase = createClient();
    const { error } = await supabase.from("Comment").delete().eq("id", c.id).eq("userId", user.id);
    if (error) return;
    const { data: uploadData } = await supabase
      .from("Upload")
      .select("commentCount, likeCount, createdAt")
      .eq("id", commentUploadId)
      .single();
    const newCommentCount = Math.max(0, (uploadData?.commentCount || 1) - 1);
    const { computeRankScore } = await import("@/lib/rankScore");
    const newRank = uploadData ? computeRankScore(uploadData.likeCount || 0, newCommentCount, uploadData.createdAt) : undefined;
    await supabase.from("Upload").update({ commentCount: newCommentCount, ...(newRank !== undefined && { rankScore: newRank }) }).eq("id", commentUploadId);
    const remaining = commentItems.filter(ci => ci.id !== c.id);
    setCommentItems(remaining);
    setCourseClips(prev => prev.map((cl: Clip) => cl.id === commentUploadId ? { ...cl, commentCount: Math.max(0, (cl.commentCount || 0) - 1) } : cl));
    if (!remaining.some(ci => ci.userId === user.id)) {
      setCommentedIds(prev => { const next = new Set(prev ?? []); next.delete(commentUploadId); return next; });
    }
  }

  async function saveCommentEdit() {
    if (!user || !editingCommentId || !editingCommentText.trim()) return;
    const body = editingCommentText.trim();
    const supabase = createClient();
    const { error } = await supabase.from("Comment").update({ body, updatedAt: new Date().toISOString() }).eq("id", editingCommentId).eq("userId", user.id);
    if (error) return;
    setCommentItems(prev => prev.map(ci => ci.id === editingCommentId ? { ...ci, body } : ci));
    setEditingCommentId(null);
    setEditingCommentText("");
  }

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();

    async function loadData() {
      const { data: courseData } = await supabase.from("Course").select("*").eq("id", id).single();
      if (courseData) setCourse(courseData);

      const { data: holesData } = await supabase.from("Hole").select("id, holeNumber, par, handicapRank, yardage, imageUrl, description").eq("courseId", id).order("holeNumber", { ascending: true });
      const holeMap: Record<string, number> = {};
      holesData?.forEach((h: any) => { holeMap[h.id] = h.holeNumber; });
      holeMapRef.current = holeMap;
      if (holesData) {
        const mapped = holesData.map((h: any) => ({ id: h.id, holeNumber: h.holeNumber, par: h.par || 4, handicapRank: h.handicapRank || h.holeNumber, yardage: h.yardage || null, imageUrl: h.imageUrl || null, description: h.description || null }));
        setHoles(mapped);
        setEditedHoles(mapped);

        // Deep-link: ?scorecard=1 opens the sheet, ?scorecard=edit opens it
        // in edit mode. Used by the trip game-detail "Verify scorecard" button.
        if (scorecardParam && !scorecardAutoOpenedRef.current) {
          scorecardAutoOpenedRef.current = true;
          setScorecardOpen(true);
          if (scorecardParam === "edit") setScorecardEditMode(true);
        }
      }

      // Tee ratings — one entry per color (slope/rating repeat across a
      // color's holes, so dedupe).
      const { data: teeData } = await supabase.from("TeeBox").select("color, slope, rating").eq("courseId", id);
      const teeByColor = new Map<string, { color: string; slope: number | null; rating: number | null }>();
      for (const t of (teeData ?? []) as Array<{ color: string; slope: number | null; rating: number | null }>) {
        if (!teeByColor.has(t.color)) teeByColor.set(t.color, { color: t.color, slope: t.slope, rating: t.rating });
        else {
          const e = teeByColor.get(t.color)!;
          if (e.slope == null && t.slope != null) e.slope = t.slope;
          if (e.rating == null && t.rating != null) e.rating = t.rating;
        }
      }
      setCourseTees(Array.from(teeByColor.values()));

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

      // Group by hole for new grid/feed.
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
      // Newest-first within each hole bucket — the page-level fetch is
      // sorted by rankScore for recall, but inside a hole users expect
      // the most recent clip up front.
      for (const holeNum of Object.keys(map)) {
        map[Number(holeNum)].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      }
      extended.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      setHoleClipsMap(map);
      setExtendedClips(extended);
      const hw = Object.keys(map).map(Number).sort((a, b) => a - b);
      setHolesWithClips(hw);
      holesWithClipsRef.current = hw;

      // Fetch uploader info (current owners + original uploaders for any
      // clip that had its ownership transferred via an approved hero tag).
      if (clips.length > 0) {
        const ownerIds = [...new Set(clips.map((c: any) => c.userId).filter(Boolean))];
        const originalUploaderIds = [...new Set(clips.map((c: any) => c.uploadedByUserId).filter(Boolean) as string[])];
        const allUserIds = [...new Set([...ownerIds, ...originalUploaderIds])];
        const [{ data: users }, { data: progressions }] = await Promise.all([
          supabase.from("User").select("id, username, avatarUrl, handicapIndex").in("id", allUserIds),
          supabase.from("UserProgression").select("userId, rank").in("userId", ownerIds),
        ]);
        if (users) {
          const rankMap: Record<string, string> = {};
          progressions?.forEach((p: any) => { rankMap[p.userId] = p.rank; });
          const map: Record<string, { username: string; avatarUrl: string | null; handicapIndex?: number | null; rank?: string | null }> = {};
          users.forEach((u: any) => { map[u.id] = { username: u.username, avatarUrl: u.avatarUrl, handicapIndex: u.handicapIndex ?? null, rank: rankMap[u.id] || null }; });
          setUploaders(map);
          // Stamp uploadedByUsername onto each clip so FeedCard can render
          // the attribution chip without an extra lookup. Mutating extended
          // (state already captured) and the in-memory clips list both.
          for (const c of [...clips, ...extended]) {
            const u: any = c;
            if (u.uploadedByUserId && u.uploadedByUserId !== u.userId) {
              const orig = users.find((x: any) => x.id === u.uploadedByUserId);
              u.uploadedByUsername = orig?.username ?? null;
            }
          }
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

      // Official media (operator uploads) folded natively into the feed.
      // Hole-assigned media is prepended to its hole bucket (operator
      // content leads each hole); ranges fan out across every covered
      // hole. Course-level media goes to the Extended Play rail. Each
      // item carries an isOfficial flag so FeedCard shows the "From the
      // course" highlight instead of an uploader/engagement row.
      try {
        const omRes = await fetch(`/api/courses/${id}/official-media`);
        if (omRes.ok) {
          const omJson: { media: OfficialMedia[] } = await omRes.json();
          const list = Array.isArray(omJson.media) ? omJson.media : [];
          officialMediaRef.current = list;
          if (list.length > 0) {
            const folded = foldOfficialMedia(list, map, extended, id as string, courseData?.name);
            setHoleClipsMap(folded.map);
            setExtendedClips(folded.extended);
            setHolesWithClips(folded.holesWithContent);
            holesWithClipsRef.current = folded.holesWithContent;
          }
        }
      } catch {
        // Non-fatal — UGC grid still renders without official media.
      }

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
      // Newest-first within each hole bucket — the page-level fetch
      // is sorted by rankScore for recall, but inside a hole users
      // expect the most recent clip up front.
      for (const holeNum of Object.keys(map)) {
        map[Number(holeNum)].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      }
      extended.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      // Re-fold operator media so it survives the UGC-only rebuild.
      const folded = foldOfficialMedia(officialMediaRef.current, map, extended, id as string, course?.name);
      setHoleClipsMap(folded.map);
      setExtendedClips(folded.extended);
      setHolesWithClips(folded.holesWithContent);
      holesWithClipsRef.current = folded.holesWithContent;
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

  const openTripPicker = useCallback(async () => {
    setTripStep("select");
    setNewTripName(""); setNewTripStart(""); setNewTripEnd("");
    setTripPlayDate(""); setTripTeeTime(""); setTripAccommodation("");
    setSelectedTripId(null); setSelectedTripName("");
    if (user) {
      const supabase = createClient();
      const { data: memberData } = await supabase.from("GolfTripMember").select("tripId").eq("userId", user.id).eq("status", "accepted");
      if (memberData && memberData.length > 0) {
        const tripIds = memberData.map((m: { tripId: string }) => m.tripId);
        const { data: tripsData } = await supabase.from("GolfTrip").select("id, name, startDate, endDate").in("id", tripIds).order("createdAt", { ascending: false });
        setUserTrips(tripsData || []);
      } else {
        setUserTrips([]);
      }
    }
    setTripPickerOpen(true);
  }, [user]);

  const openContribute = useCallback(() => {
    if (!course) return;
    setEditCourseName(course.name || "");
    setEditCity(course.city || "");
    setEditState(course.state || "");
    setEditZip(course.zipCode || "");
    setEditYearEstablished(course.yearEstablished?.toString() || "");
    setEditCourseType(course.courseType || "");
    setEditDescription(course.description || "");
    setEditWebsite((course as any).websiteUrl || "");
    setEditHoleCount(course.holeCount === 9 ? 9 : 18);
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

    if (editCourseName.trim()) payload.name = editCourseName.trim();
    if (editDescription.trim()) payload.description = editDescription.trim();
    if (editWebsite.trim()) {
      // Auto-prepend https:// for raw domains so the API normalizer accepts it
      let url = editWebsite.trim();
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      payload.websiteUrl = url;
    }
    if (editCity.trim()) payload.city = editCity.trim();
    if (editState.trim()) payload.state = editState.trim();
    payload.zipCode = editZip.trim() || null;
    payload.yearEstablished = editYearEstablished ? parseInt(editYearEstablished) : null;
    if (editCourseType) payload.courseType = editCourseType;
    if (editHoleCount === 9 || editHoleCount === 18) payload.holeCount = editHoleCount;

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
      <main style={{ minHeight: "100dvh", background: "#07100a", paddingLeft: isDesktop ? 72 : 0 }}>
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
      <main style={{ minHeight: "100dvh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button onClick={() => router.push("/tour")} style={{ background: "#2d7a42", border: "none", borderRadius: 99, padding: "10px 24px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", cursor: "pointer" }}>Back to Search</button>
      </main>
    );
  }

  const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
  const hero = getCourseHero(course.name);

  // If this course is hosting a major right now (e.g. Aronimink during PGA
  // Championship week), light up the hero with the same gold treatment used
  // on the home-page card.
  const tournament = activeFeaturedTournament();
  const isHostingMajor = tournament?.courseId === course.id;
  const PGA_GOLD = "#d4a017";

  const mostClippedHole = (() => {
    const entries = Object.entries(holeClipsMap).filter(([, c]) => c.length > 0);
    if (entries.length === 0) return null;
    const sorted = entries.sort(([, a], [, b]) => b.length - a.length);
    return sorted[0][1].length > 1 ? Number(sorted[0][0]) : null;
  })();

  // Caddie Book — the written intel golfers logged, bucketed per hole by the
  // shot phase the clip was filmed at (tee / approach / green). No metadata
  // chips for now; just the notes. This raw bucketing is fed to the synthesis
  // route, which de-duplicates and condenses each phase.
  const phaseOf = (shotType: string | null): "tee" | "approach" | "green" | "general" => {
    switch (shotType) {
      case "TEE_SHOT": return "tee";
      case "APPROACH": case "LAY_UP": return "approach";
      case "CHIP": case "PITCH": case "PUTT": case "BUNKER": return "green";
      default: return "general";
    }
  };
  const caddieBookRaw = (() => {
    const holeMeta = new Map(holes.map(h => [h.holeNumber, h]));
    // Union of holes that carry a seeded description and holes that have
    // clips — a course book should cover both editorial intel and UGC.
    const holeNums = new Set<number>([
      ...holes.filter(h => h.description).map(h => h.holeNumber),
      ...Object.keys(holeClipsMap).map(Number),
    ]);
    return [...holeNums]
      .sort((a, b) => a - b)
      .map(holeNum => {
        const meta = holeMeta.get(holeNum);
        const clips = holeClipsMap[holeNum] ?? [];
        const buckets: { tee: string[]; approach: string[]; green: string[]; general: string[] } = { tee: [], approach: [], green: [], general: [] };
        clips.forEach(c => {
          const notes = [c.strategyNote, c.landingZoneNote, c.whatCameraDoesntShow].filter(Boolean) as string[];
          if (notes.length === 0) return;
          buckets[phaseOf(c.shotType)].push(...notes);
        });
        return {
          holeNum,
          par: meta?.par ?? null,
          yardage: meta?.yardage ?? null,
          overview: meta?.description ?? null,
          ...buckets,
        };
      })
      .filter(h => h.overview || h.tee.length || h.approach.length || h.green.length || h.general.length);
  })();

  const openCaddieBook = () => {
    setCaddieOpen(true);
    if (caddieData || caddieLoading || caddieBookRaw.length === 0) return;
    setCaddieLoading(true);
    setCaddieError(false);
    fetch("/api/caddie-book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: id, courseName: course.name, holes: caddieBookRaw }),
    })
      .then(r => r.json())
      .then((data: { holes?: { holeNumber: number; overview?: string; tee?: string; approach?: string; green?: string; general?: string }[] }) => {
        const map: Record<number, { overview?: string; tee?: string; approach?: string; green?: string; general?: string }> = {};
        (data.holes ?? []).forEach(h => { map[h.holeNumber] = { overview: h.overview, tee: h.tee, approach: h.approach, green: h.green, general: h.general }; });
        setCaddieData(map);
      })
      .catch(() => setCaddieError(true))
      .finally(() => setCaddieLoading(false));
  };

  return (
    <main style={{ minHeight: "100dvh", background: "#07100a", color: "#fff", fontFamily: "'Outfit', sans-serif", paddingLeft: isDesktop ? 72 : 0 }}>
      <style>{`
        
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
        /* Outer feed (vertical between holes). overscroll-behavior: contain
           stops the rubber-band scroll past top/bottom from chaining out
           to the body. */
        .feed-modal { position: fixed; inset: 0; z-index: 100; background: #000; overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; touch-action: pan-y; overscroll-behavior: contain; }
        .feed-modal::-webkit-scrollbar { display: none; }
        .feed-hole-page { scroll-snap-align: start; scroll-snap-stop: always; height: 100svh; width: 100vw; display: flex; overflow-x: scroll; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior-x: contain; overscroll-behavior-y: auto; touch-action: pan-x pan-y; }
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
        /* Notch-aware: pad past the iOS safe-area-inset-top so the back+mute
           buttons clear the notch / Dynamic Island in the Capacitor WebView. */
        .top-bar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: calc(12px + env(safe-area-inset-top)) 14px 12px; z-index: 20; gap: 10px; }
        .back-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .mute-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .course-top-badge { width: 46px; height: 46px; border-radius: 12px; background: rgba(26,158,66,0.2); border: 1.5px solid rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 700; color: #1a9e42; flex-shrink: 0; overflow: hidden; }
        .right-actions { position: absolute; right: 14px; bottom: 100px; display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 30; }
        .action-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; }
        .action-icon { width: 46px; height: 46px; border-radius: 50%; background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; }
        .action-label { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,0.95); }
        .bottom-info { position: absolute; bottom: 0; left: 0; right: 0; padding: 0 16px 88px; z-index: 20; }
      `}</style>

      {/* Hero — slightly shorter than before; course name overlay anchored
          tight to the bottom so it sits closer to the hole-grid below. */}
      <div style={{ position: "relative", width: "100%", minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        {course.coverImageUrl ? (
          <img src={cdnImage(course.coverImageUrl)} alt={course.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
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
            style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 8px)", right: 16, zIndex: 10, display: "flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, padding: "7px 12px", cursor: "pointer" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Add cover photo</span>
          </button>
        )}

        {/* PGA Championship crest — top-right of hero during tournament week.
            Mirrors the home-card treatment so the major announcement is
            recognizable across surfaces. */}
        {isHostingMajor && tournament && (
          <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 8px)", right: 16, zIndex: 10, width: 58, height: 58, borderRadius: 12, background: "#fff", border: `1.5px solid ${PGA_GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 4px 14px rgba(0,0,0,0.45), 0 0 16px rgba(212,160,23,0.25)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tournament.logoSrc}
              alt={tournament.label}
              style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                const parent = el.parentElement;
                if (parent && !parent.dataset.fallback) {
                  parent.dataset.fallback = "1";
                  parent.innerHTML = `<div style="font-family:'Outfit',sans-serif;font-weight:900;color:${PGA_GOLD};line-height:1;text-align:center"><div style="font-size:14px">PGA</div><div style="margin-top:3px;font-size:9px">2026</div></div>`;
                }
              }}
            />
          </div>
        )}

        {/* Back pill — shown when arrived from /map, a trip-idea page, or a feed clip */}
        {(fromMap || fromTripIdea || fromFeed) && (
          <button
            onClick={() => {
              if (fromTripIdea && tripIdeaSlug) {
                router.push(`/trip-ideas/${tripIdeaSlug}`);
              } else {
                router.back();
              }
            }}
            style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 8px)", left: 16, zIndex: 11, display: "flex", alignItems: "center", gap: 6, background: "rgba(7,16,10,0.85)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 99, padding: "8px 14px 8px 10px", cursor: "pointer", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>{fromTripIdea ? "Trip" : fromFeed ? "Video" : "Map"}</span>
          </button>
        )}

        {/* Top left: course logo badge — tap to expand if logo exists, else go back.
            Matches the crest treatment on home + profile thumbnails: white bg,
            subtle white-18% border, classy drop shadow.
            Position adjusts based on whether the back-to-Map pill is also
            showing: when it is, the logo slots in BELOW the pill instead
            of overlapping it. Beta tester reported this top-left stack
            felt cluttered on the Stonebridge / Noonan courses. */}
        <button
          onClick={() => course.logoUrl ? setLogoLightboxOpen(true) : router.back()}
          style={{ position: "absolute", top: (fromMap || fromTripIdea || fromFeed) ? "calc(env(safe-area-inset-top, 0px) + 58px)" : "calc(env(safe-area-inset-top, 0px) + 8px)", left: 16, zIndex: 10, width: 46, height: 46, borderRadius: 12, background: "#fff", border: "1.5px solid rgba(255,255,255,0.22)", boxShadow: "0 3px 10px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer", padding: 0 }}
        >
          {course.logoUrl ? (
            <img
              src={cdnImage(course.logoUrl)}
              alt={course.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10, backgroundColor: "#fff" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("style"); }}
            />
          ) : null}
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#1a9e42", display: course.logoUrl ? "none" : "inline" }}>{abbr}</span>
        </button>

        {/* Manager hamburger — the in-app entry point to the manage
            dashboard. Only rendered for the verified operator (or an
            admin); standout green so it's unmistakable against the hero
            imagery. Shifts left of the PGA badge when a major is hosting
            so the two top-right elements don't overlap. */}
        {isManager && (
          <button
            onClick={() => setManagerMenuOpen(true)}
            aria-label="Course owner menu"
            style={{ position: "absolute", top: (fromMap || fromTripIdea || fromFeed) ? "calc(env(safe-area-inset-top, 0px) + 58px)" : "calc(env(safe-area-inset-top, 0px) + 8px)", right: (isHostingMajor && tournament) ? 84 : 16, zIndex: 11, width: 46, height: 46, borderRadius: 12, background: "#2d7a42", border: "1.5px solid #4da862", boxShadow: "0 3px 12px rgba(45,122,66,0.55), 0 0 14px rgba(77,168,98,0.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        )}

        {/* Logo lightbox */}
        {logoLightboxOpen && course.logoUrl && (
          <div
            onClick={() => setLogoLightboxOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <img
              src={cdnImage(course.logoUrl)}
              alt={course.name}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: "80vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 16, backgroundColor: "#fff", padding: 16, boxShadow: "0 8px 48px rgba(0,0,0,0.6)" }}
            />
            <button
              onClick={() => setLogoLightboxOpen(false)}
              style={{ position: "absolute", top: 56, right: 20, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}


        <div style={{ position: "relative", padding: "0 20px 14px", zIndex: 10, marginTop: (fromMap || fromTripIdea || fromFeed) ? "calc(env(safe-area-inset-top, 0px) + 118px)" : "calc(env(safe-area-inset-top, 0px) + 68px)" }}>
          {(() => {
            // Universal Google Maps URL — WKWebView on iOS intercepts and
            // offers "Open in Maps" / "Open in Google Maps." Constructed
            // from name + city + state + zip so fuzzy resolution works
            // even without lat/lng on the course row.
            const mapsQuery = [course.name, course.city, course.state, course.zipCode].filter(Boolean).join(", ");
            const mapsUrl = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}` : null;
            return (
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.7)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 6 }}>
                {mapsUrl ? (
                  <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span>{[[course.city, course.state].filter(s => s?.trim()).join(", "), course.courseType === "SEMI_PRIVATE" ? "Semi-Private" : course.courseType === "PRIVATE" ? "Private" : course.courseType === "PUBLIC" ? "Public" : ""].filter(Boolean).join(" · ")}</span>
                  </a>
                ) : (
                  <span>{[[course.city, course.state].filter(s => s?.trim()).join(", "), course.courseType === "SEMI_PRIVATE" ? "Semi-Private" : course.courseType === "PRIVATE" ? "Private" : course.courseType === "PUBLIC" ? "Public" : ""].filter(Boolean).join(" · ")}</span>
                )}
                {(course.description || hero.description) && (
                  <button onClick={() => setAboutOpen(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="12.01" r="0.1" fill="rgba(255,255,255,0.85)" stroke="rgba(255,255,255,0.85)" strokeWidth="3"/></svg>
                  </button>
                )}
              </div>
            );
          })()}
          {isHostingMajor && tournament && (
            <div style={{ display: "inline-flex", alignItems: "center", background: PGA_GOLD, borderRadius: 99, padding: "3px 10px", marginBottom: 8 }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 800, color: "#0a1d10", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                {tournament.pillText}
              </span>
            </div>
          )}
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.05, marginBottom: 6, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
            {course.name}
          </div>
          {/* "Managed by course" badge — shown ONLY when the course
              has been claimed + verified. The dashed Claim CTA was
              removed from this slot 2026-05-30 per UX feedback —
              the claim entry now lives inside the Contribute sheet
              ("Are you the course?" row) so it's discoverable but
              doesn't compete with the rest of the header for
              attention. */}
          {course.isClaimed && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <OfficialCourseBadge />
            </div>
          )}
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
            {holes.length > 0 && holes.some(h => h.par) && <span>Par {holes.reduce((s, h) => s + (h.par || 0), 0)}</span>}
            {holes.length > 0 && holes.some(h => h.yardage) && <><span style={{ color: "rgba(255,255,255,0.35)" }}>·</span><span>{holes.reduce((s, h) => s + (h.yardage || 0), 0).toLocaleString()} yds</span></>}
            {(() => {
              const rated = courseTees.filter(t => t.slope != null);
              if (rated.length === 0) return null;
              const tips = rated.reduce((a, b) => ((b.slope ?? 0) > (a.slope ?? 0) ? b : a));
              return <><span style={{ color: "rgba(255,255,255,0.35)" }}>·</span><span>Slope {tips.slope}</span></>;
            })()}
            {/* "X clips" removed 2026-05-24 — the hero meta line was
                getting too busy alongside Par + yards + pills below.
                Clip count is still surfaced inside each hole tile. */}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", position: "relative" }}>
            {/* Est. {year} pill removed from the hero on 2026-05-23 —
                it competed for attention with Directions / Plan Round /
                Save / SEND IT. The year now lives in the course info
                line further down ("Designed by X · Est. YYYY"). */}
            {(course.city || course.state || course.zipCode) && (() => {
              const mapsQuery = [course.name, course.city, course.state, course.zipCode].filter(Boolean).join(", ");
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
              return (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#4da862", background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 99, padding: "4px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  Directions
                </a>
              );
            })()}
            {/* Plan Round — opens the dual-path planning sheet */}
            <button
              onClick={() => setPlanOpen(true)}
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#4da862", background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 99, padding: "4px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Plan Round
            </button>
            {/* Save button — bottom right of hero */}
            <button
              onClick={() => setShowPicker(!showPicker)}
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, background: saved ? "rgba(26,158,66,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${saved ? "rgba(26,158,66,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 99, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill={saved ? "#1a9e42" : "none"} stroke={saved ? "#1a9e42" : "rgba(255,255,255,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              <span style={{ color: saved ? "#1a9e42" : "rgba(255,255,255,0.5)" }}>{saved ? "Saved" : "Save"}</span>
            </button>
            {/* Share pill — paper-airplane icon (the universal share
                glyph) so the affordance reads instantly without copy.
                Opens the native share sheet; falls back to clipboard
                with a green "Sent" state when navigator.share
                is unavailable. The recipient's link preview is driven
                by the per-course Open Graph image we already generate
                at /courses/[id]/opengraph-image — iMessage / WhatsApp /
                Slack all fetch that automatically when the URL unfurls. */}
            <button
              onClick={async () => {
                if (!course) return;
                const url = `${window.location.origin}/courses/${course.id}`;
                try {
                  // Share JUST the url (no text/title). When iMessage gets
                  // a URL bundled with body text it sometimes drops the
                  // rich Open Graph preview and renders the URL as plain
                  // text — and the OG card is the whole point. Sending
                  // url-only lets iMessage cleanly unfurl into the
                  // course preview card we render at
                  // /courses/[id]/opengraph-image.
                  if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share) {
                    await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({ url });
                  } else {
                    await navigator.clipboard.writeText(url);
                    setCourseShared(true);
                    setTimeout(() => setCourseShared(false), 2000);
                  }
                } catch {
                  // User cancelled the share sheet — no-op.
                }
              }}
              aria-label="Share this course"
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 11,
                background: courseShared ? "rgba(26,158,66,0.2)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${courseShared ? "rgba(26,158,66,0.5)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 99,
                padding: "4px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {courseShared ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1a9e42" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style={{ color: "#1a9e42", fontWeight: 600 }}>Sent</span>
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                  <span style={{ color: "rgba(255,255,255,0.5)" }}>Share</span>
                </>
              )}
            </button>
            {/* Save picker — bottom sheet. Portaled so it escapes the
                course-hero's stacking context (transforms on parent
                blocks were trapping the sheet under the BottomNav). */}
            {showPicker && (
              <SheetPortal>
                <div className="tourit-sheet-backdrop" onClick={() => setShowPicker(false)} />
                <div className="tourit-sheet tourit-sheet--auto">
                  <div className="tourit-sheet-grip" />
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12, paddingLeft: 4 }}>Save Course</div>
                  <button onClick={() => toggleSave("PLAYED")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 12px", background: saveType === "PLAYED" ? "rgba(26,158,66,0.12)" : "transparent", border: `1px solid ${saveType === "PLAYED" ? "rgba(26,158,66,0.35)" : "transparent"}`, borderRadius: 12, cursor: "pointer", textAlign: "left", marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: saveType === "PLAYED" ? "rgba(26,158,66,0.2)" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={saveType === "PLAYED" ? "#1a9e42" : "rgba(255,255,255,0.6)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: saveType === "PLAYED" ? "#1a9e42" : "#fff" }}>Played</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>I&apos;ve played this course</div>
                    </div>
                  </button>
                  <button onClick={() => toggleSave("BUCKET_LIST")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 12px", background: saveType === "BUCKET_LIST" ? "rgba(26,158,66,0.12)" : "transparent", border: `1px solid ${saveType === "BUCKET_LIST" ? "rgba(26,158,66,0.35)" : "transparent"}`, borderRadius: 12, cursor: "pointer", textAlign: "left", marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: saveType === "BUCKET_LIST" ? "rgba(26,158,66,0.2)" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={saveType === "BUCKET_LIST" ? "#1a9e42" : "rgba(255,255,255,0.6)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: saveType === "BUCKET_LIST" ? "#1a9e42" : "#fff" }}>Bucket List</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>I want to play this</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowPicker(false); openTripPicker(); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 12px", background: "transparent", border: "1px solid transparent", borderRadius: 12, cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff" }}>Golf Trip</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Add to a trip itinerary</div>
                    </div>
                  </button>
                </div>
              </SheetPortal>
            )}
          </div>
        </div>
      </div>

      {/* "From the course" official-info block — rendered only when
          the course has been claimed + verified. Sits ABOVE the UGC
          feed but never replaces it; UGC clips remain the primary
          scrolling experience below. The block self-hides if there's
          no operator content yet (officialDescription empty + no
          staff + no teeSheetUrl). */}
      {course.isClaimed && (
        <FromTheCourseBlock
          courseId={course.id}
          officialDescription={course.officialDescription}
          teeSheetUrl={course.teeSheetUrl}
          membershipInquiryUrl={course.membershipInquiryUrl}
        />
      )}

      {/* Claim sheet — entry lives in the Contribute sheet now
          ("Are you the course?" row). Closed by default; opens via
          setClaimSheetOpen(true). */}
      <ClaimCourseSheet
        courseId={course.id}
        courseName={course.name}
        open={claimSheetOpen}
        onClose={() => setClaimSheetOpen(false)}
      />

      {/* Course-owner menu — opens from the manager hamburger. Slides up
          from the bottom like every other Tour It sheet. Holds the manage
          dashboard entry (edit official info, upload logo/cover, post
          official media). */}
      {managerMenuOpen && (
        <>
          <div className="tourit-sheet-backdrop" onClick={() => setManagerMenuOpen(false)} />
          <div className="tourit-sheet tourit-sheet--auto" onClick={e => e.stopPropagation()}>
            <div className="tourit-sheet-grip" />
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(126,200,140,0.85)", marginBottom: 12 }}>Course owner</div>
            <button
              onClick={() => { setManagerMenuOpen(false); router.push(`/courses/${id}/manage`); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 14px", background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 12, cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff" }}>Manage course</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>Edit official info, logo, cover & media</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(126,200,140,0.7)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button onClick={() => setManagerMenuOpen(false)} style={{ marginTop: 14, width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Close</button>
          </div>
        </>
      )}

{/* Course-completion nudge — shows when key fields are still null so users
    know there's something useful (and points-earning) they can do. Counts
    logo, cover, description, year, and zip as the "completion" set; one
    pill per missing field collapses into a single summary at >=3 missing. */}
{(() => {
  const missing: string[] = [];
  if (!course.logoUrl) missing.push("logo");
  if (!course.coverImageUrl) missing.push("cover photo");
  if (!course.description) missing.push("description");
  if (!course.yearEstablished) missing.push("year");
  if (!course.zipCode) missing.push("zip");
  if (missing.length === 0) return null;
  const label = missing.length >= 3
    ? `Help complete this course profile — ${missing.length} fields missing`
    : `Add the ${missing.join(" & ")} to complete this profile`;
  // Earnable points per the points config: cover/logo/year/zip/desc each
  // grant a course-field action (10-25 pts). Conservatively cite the
  // ballpark for the visible missing count.
  const ptsEstimate = missing.length * 15;
  return (
    <button
      onClick={openContribute}
      style={{ width: "calc(100% - 40px)", margin: "0 20px 10px", display: "flex", alignItems: "center", gap: 10, background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.35)", borderRadius: 12, padding: "9px 12px", cursor: "pointer", textAlign: "left" }}
    >
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(212,160,23,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4a017" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.25 }}>{label}</div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, color: "rgba(212,160,23,0.85)", marginTop: 1, letterSpacing: "0.01em" }}>Earn up to {ptsEstimate} pts</div>
      </div>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
    </button>
  );
})()}

{/* Action bar — compact horizontal pills (icon + label on one row) */}
<div style={{ padding: "10px 20px 12px", display: "flex", gap: 8 }}>
  <button
    onClick={() => setScorecardOpen(true)}
    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "7px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/></svg>
    <span>Scorecard</span>
  </button>
  <button
    onClick={() => router.push(`/upload?courseId=${id}`)}
    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "7px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    <span>Upload</span>
  </button>
  <button
    onClick={openContribute}
    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "7px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    <span>Contribute</span>
  </button>
</div>

      {/* Series card — only when real multi-hole UGC content exists.
          Operator course-level media also lives in extendedClips but is
          surfaced by the Extended Play rail below, not counted as a
          "playthrough" here. */}
      {(() => {
        const seriesClips = extendedClips.filter(c => !c.isOfficial);
        if (seriesClips.length === 0) return null;
        return (
        <div style={{ padding: "0 16px 16px" }}>
          <button
            onClick={() => setExtendedClip(seriesClips[0])}
            style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>Multi-hole series</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{seriesClips.length} playthrough{seriesClips.length !== 1 ? "s" : ""}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
        );
      })()}

      {/* Caddie Book — course-wide intel digest: seeded per-hole overviews
          plus golfers' written scout notes, condensed by /api/caddie-book.
          Entry point lives above the hole grid so it reads as the "whole
          course at a glance" before drilling into individual holes. Only
          surfaced once there's intel (a description or notes) to synthesize. */}
      {caddieBookRaw.length > 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <button
            onClick={openCaddieBook}
            style={{ width: "100%", background: "linear-gradient(135deg, rgba(45,122,66,0.16) 0%, rgba(13,35,24,0.6) 100%)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CaddieBookIcon size={26} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 800, color: "#fff" }}>Caddie Book</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>
                Course intel across {caddieBookRaw.length} hole{caddieBookRaw.length !== 1 ? "s" : ""}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      )}

      {/* Holes grid — Front 9 always; Back 9 only on 18-hole courses.
          Show the grid whenever EITHER there are user clips OR we've seeded
          hole imagery (Aronimink during PGA week, etc). Generic empty state
          only fires when the course is truly blank. */}
      {(() => {
        const hasHoleImagery = holes.some(h => h.imageUrl);
        const isEmpty = courseClips.length === 0 && !hasHoleImagery;
        return (
      <div style={{ padding: "0 16px", maxWidth: isDesktop ? 600 : undefined }}>
        {isEmpty ? (
          <div style={{ textAlign: "center", padding: "28px 20px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* Flag-on-pin icon — replaces the ⛳ emoji that was rendering
                as a bright red iOS flag. Stroke-style SVG in the Tour It
                green palette so it sits inside the rest of the app's
                visual language. Subtle circular green-tinted backdrop
                gives it presence without dominating the empty state. */}
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.18)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {/* Pin */}
                <line x1="7" y1="3" x2="7" y2="22" />
                {/* Flag */}
                <path d="M7 4 L17 4 L14.5 7.5 L17 11 L7 11" fill="rgba(77,168,98,0.25)" />
                {/* Ground line + dot at base */}
                <line x1="3.5" y1="21" x2="14" y2="21" strokeWidth="1.2" />
                <circle cx="7" cy="21" r="1" fill="#4da862" stroke="none" />
              </svg>
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "#fff", marginBottom: 8, lineHeight: 1.2 }}>No intel on this course yet.</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.65, marginBottom: 20, maxWidth: 270 }}>Every golfer who plays here knows something the next one needs to know. Be the first to put it on record.</div>
            <button onClick={() => router.push(`/upload?courseId=${id}`)} style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer", boxShadow: "0 2px 14px rgba(45,122,66,0.35)" }}>
              Post the first clip
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {(course.holeCount === 9
              ? [{ label: "9 Holes", nineHoles: [1,2,3,4,5,6,7,8,9] }]
              : [{ label: "Front 9", nineHoles: [1,2,3,4,5,6,7,8,9] }, { label: "Back 9", nineHoles: [10,11,12,13,14,15,16,17,18] }]
            ).map(({ label, nineHoles }) => {
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
                      const hasBg = hasClips || !!holeData?.imageUrl;
                      return (
                        <div
                          key={holeNum}
                          onClick={() => {
                            if (hasClips) {
                              setFeedStartHole(holeNum);
                              setFeedOpen(true);
                              if (!localStorage.getItem("ti-feed-hint")) { setShowFeedHint(true); setTimeout(() => { setShowFeedHint(false); localStorage.setItem("ti-feed-hint", "1"); }, 2800); }
                            } else {
                              // No clips yet → land on the hole detail page so the
                              // seeded photo + description show, then user can choose
                              // to upload from there. Don't blast straight to upload.
                              router.push(`/courses/${id}/holes/${holeNum}`);
                            }
                          }}
                          style={{ aspectRatio: "3/4", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", cursor: "pointer", position: "relative", overflow: "hidden", background: hasBg ? "#0e1a13" : "#0a120d", border: `1px solid ${hasClips ? "rgba(77,168,98,0.2)" : hasBg ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)"}` }}
                        >
                          {/* Background thumbnail. Prefer the top user clip
                              when one exists; otherwise fall back to the
                              official hole photo seeded on the Course (so
                              majors/featured courses look rich before clips
                              start landing). */}
                          {hasClips && topClip ? (
                            <>
                              {/* Static thumbnail, not a mounted player — this
                                  is a grid hero tile; mounting HlsVideo here
                                  loads the manifest + first segment per tile. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={getClipThumbnail(topClip.mediaType, topClip.mediaUrl, topClip.cloudflareVideoId)} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,16,10,0.45) 0%, rgba(7,16,10,0.25) 40%, rgba(7,16,10,0.5) 100%)" }} />
                            </>
                          ) : holeData?.imageUrl ? (
                            <>
                              <img src={cdnImage(holeData.imageUrl)} alt={`Hole ${holeNum}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,16,10,0.55) 0%, rgba(7,16,10,0.35) 40%, rgba(7,16,10,0.7) 100%)" }} />
                            </>
                          ) : null}
                          {/* Content */}
                          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
                            {/* Top row — Par pill (color-coded by par)
                                + Yardage with "YDS" suffix. Brand-green
                                bias on empty tiles so the page reads as
                                Tour It even before any clips land. */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                              {holeData?.par ? (
                                <span style={{
                                  fontFamily: "'Outfit', sans-serif",
                                  fontSize: 9,
                                  fontWeight: 800,
                                  letterSpacing: "0.1em",
                                  textTransform: "uppercase",
                                  padding: "2px 7px",
                                  borderRadius: 99,
                                  color: holeData.par === 3 ? "#d4a017" : holeData.par === 5 ? "#fbbf24" : "#4da862",
                                  // Solid dark base so the par text + colored
                                  // border read clearly against any tile bg
                                  // (clip thumbnail, course-hole photo, or the
                                  // empty dark fill). Previous tinted-only
                                  // background was too faint to register at
                                  // 9px — user reported "make the pill
                                  // background darker so you can see it."
                                  background: "rgba(7,16,10,0.78)",
                                  border: `1px solid ${holeData.par === 3 ? "rgba(212,160,23,0.55)" : holeData.par === 5 ? "rgba(251,191,36,0.55)" : "rgba(77,168,98,0.55)"}`,
                                  boxShadow: hasBg && !hasClips ? "0 1px 3px rgba(0,0,0,0.45)" : undefined,
                                }}>
                                  PAR {holeData.par}
                                </span>
                              ) : <span />}
                              {holeData?.yardage ? (
                                <span style={{
                                  fontFamily: "'Outfit', sans-serif",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.04em",
                                  color: hasBg ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.55)",
                                  textShadow: hasBg && !hasClips ? "0 1px 3px rgba(0,0,0,0.65)" : undefined,
                                  display: "inline-flex",
                                  alignItems: "baseline",
                                  gap: 2,
                                }}>
                                  {holeData.yardage}
                                  <span style={{ fontSize: 8, fontWeight: 600, color: hasBg ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.3)" }}>YDS</span>
                                </span>
                              ) : null}
                            </div>
                            {/* Center: hole number — brand green with
                                soft glow so even an empty hole tile feels
                                alive. Stays white when a clip thumbnail
                                is the background (the glow would clash
                                with the live video). */}
                            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{
                                fontFamily: "'Playfair Display', serif",
                                fontSize: holeNum <= 9 ? 52 : 46,
                                fontWeight: 700,
                                color: hasClips ? "#ffffff" : "#4da862",
                                letterSpacing: "-1px",
                                lineHeight: 1,
                                textShadow: hasClips
                                  ? "0 2px 8px rgba(0,0,0,0.6)"
                                  : "0 0 14px rgba(77,168,98,0.55), 0 0 28px rgba(77,168,98,0.28), 0 1px 4px rgba(0,0,0,0.5)",
                              }}>{holeNum}</span>
                            </div>
                            {/* Bottom: clip indicator — only when there
                                ARE clips. Aggregate likes/comments
                                pills removed 2026-05-24 to keep the
                                hole grid clean; per-clip engagement
                                still lives on user profile thumbnails. */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                              {hasClips ? (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#4da862", flexShrink: 0 }} />
                                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, color: "#4da862" }}>{clipCount} clip{clipCount !== 1 ? "s" : ""}</span>
                                </div>
                              ) : <span />}
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
        );
      })()}

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
                {/* Grid tile: static thumbnail, not a mounted HLS player. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getClipThumbnail(clip.mediaType, clip.mediaUrl, clip.cloudflareVideoId)} alt="clip" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)" }} />
                {clip.isOfficial && (
                  <div style={{ position: "absolute", top: 6, left: 6, display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", background: "rgba(7,16,10,0.78)", border: "1px solid rgba(126,200,140,0.7)", borderRadius: 99 }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#7ed28b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></svg>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 7.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7ed28b" }}>Course</span>
                  </div>
                )}
                <div style={{ position: "absolute", bottom: 6, right: 6 }}>
                  <div style={{ background: "#1a5c30", border: "1px solid rgba(255,255,255,0.45)", borderRadius: 3, padding: "2px 6px 3px", display: "inline-flex", alignItems: "center" }}>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 9, fontWeight: 700, color: "#fff" }}>
                      {clip.isOfficial ? "Course" : clip.shotType === "FULL_ROUND" ? "Full 18" : clip.shotType === "FRONT_NINE" ? "Front 9" : clip.shotType === "BACK_NINE" ? "Back 9" : clip.shotType === "THREE_HOLE" ? "3 Holes" : "Extended"}
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
            {(() => {
              // Prefer the curated `hero.year` (set in COURSE_HEROES for
              // famous tracks) and fall back to the seeded
              // course.yearEstablished from the DB so seeded courses still
              // show "Est. YYYY" when no hero override exists. Year pill
              // was removed from the hero on 2026-05-23 — this About
              // sheet is the canonical place to surface it.
              const yr = hero.year ?? course.yearEstablished ?? null;
              if (!hero.designer && !yr) return null;
              return (
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>
                  {hero.designer ? `Designed by ${hero.designer}` : ""}{hero.designer && yr ? " · " : ""}{yr ? `Est. ${yr}` : ""}
                </div>
              );
            })()}
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
              {/* Prefer the operator-authored description when the
                  course has been claimed; fall back to the UGC
                  description otherwise. The FromTheCourseBlock above
                  already renders officialDescription with its own
                  framing, so this is purely a fallback for the
                  legacy About sheet. */}
              {(course.isClaimed && course.officialDescription)
                ? course.officialDescription
                : (course.description || hero.description)}
            </p>
            <button onClick={() => setAboutOpen(false)} style={{ marginTop: 24, width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}

{/* Caddie Book sheet — per-hole intel digest. The notes golfers logged are
          bucketed by shot phase (tee/approach/green) on the client, then sent
          to /api/caddie-book where Claude de-duplicates and condenses each
          phase using only the supplied notes. Result is cached for the session. */}
      {caddieOpen && (
        <div onClick={() => setCaddieOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "20px 24px 44px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 20px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CaddieBookIcon size={28} />
              </div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff" }}>Caddie Book</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{course.name}</div>
              </div>
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, margin: "12px 0 18px" }}>
              The intel scouts have logged here, condensed hole by hole — off the tee, on the approach, and around the green.
            </p>
            {caddieBookRaw.length === 0 ? (
              <div style={{ textAlign: "center", padding: "8px 0 24px" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, marginBottom: 16, maxWidth: 280, marginInline: "auto" }}>
                  No written scout notes on this course yet. Add the club, the line, what the camera doesn&apos;t show — and it&apos;ll start filling the book.
                </div>
                <button onClick={() => { setCaddieOpen(false); router.push(`/upload?courseId=${id}`); }} style={{ background: "#2d7a42", border: "none", borderRadius: 11, padding: "11px 24px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Add intel</button>
              </div>
            ) : caddieLoading ? (
              <div style={{ textAlign: "center", padding: "32px 0", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                Reading the scout notes…
              </div>
            ) : caddieError ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>Couldn&apos;t assemble the Caddie Book just now.</div>
                <button onClick={openCaddieBook} style={{ background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 10, padding: "9px 20px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#4da862", cursor: "pointer" }}>Try again</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {caddieBookRaw.map(h => {
                  // Prefer the AI-condensed synthesis when present, but fall
                  // back to the raw seeded overview and logged notes so the
                  // book never renders blank for a hole the banner counted —
                  // the count comes from caddieBookRaw, so the render must too.
                  const s = caddieData?.[h.holeNum];
                  const overview = (s?.overview?.trim() || h.overview?.trim()) || "";
                  const sections = ([
                    ["Tee", s?.tee?.trim() || h.tee.join("; ")],
                    ["Approach", s?.approach?.trim() || h.approach.join("; ")],
                    ["Around the green", s?.green?.trim() || h.green.join("; ")],
                    [null, s?.general?.trim() || h.general.join("; ")],
                  ] as [string | null, string][]).filter(([, v]) => v && v.trim());
                  if (!overview && sections.length === 0) return null;
                  return (
                    <div key={h.holeNum} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px" }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 10 }}>
                        Hole {h.holeNum}
                        {(h.par != null || h.yardage != null) && (
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.4)", marginLeft: 8 }}>
                            {[h.par != null ? `Par ${h.par}` : null, h.yardage != null ? `${h.yardage} yds` : null].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                      {overview && (
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: sections.length ? 12 : 0 }}>{overview}</div>
                      )}
                      {sections.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {sections.map(([label, text], i) => (
                            <div key={i}>
                              {label && (
                                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#4da862", marginBottom: 4 }}>{label}</div>
                              )}
                              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 1.55 }}>{text}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={() => setCaddieOpen(false)} style={{ marginTop: 20, width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Close</button>
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
                  onClick={() => {
                    const template = holes.length > 0 ? [...holes] :
                      Array.from({ length: 18 }, (_, i) => ({ id: `new-${i + 1}`, holeNumber: i + 1, par: 4, handicapRank: i + 1, yardage: null, imageUrl: null, description: null }));
                    setEditedHoles(template);
                    seedEditedTees();
                    setScorecardEditMode(true);
                  }}
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
                      const saved: typeof editedHoles = [];
                      for (const h of editedHoles) {
                        if (h.id.startsWith("new-")) {
                          const now = new Date().toISOString();
                          const { data } = await supabase.from("Hole").insert({ courseId: id, holeNumber: h.holeNumber, par: h.par, yardage: h.yardage, handicapRank: h.handicapRank, createdAt: now, updatedAt: now }).select("id").single();
                          saved.push(data ? { ...h, id: data.id } : h);
                        } else {
                          await supabase.from("Hole").update({ par: h.par, yardage: h.yardage, handicapRank: h.handicapRank }).eq("id", h.id);
                          saved.push(h);
                        }
                      }
                      setHoles(saved);
                      setEditedHoles(saved);

                      // Tee slope/rating: write across every hole of each color
                      // (TeeBox stores them per hole; yardage column is required,
                      // so preserve any existing yardage, else fall back to the
                      // hole yardage, else 0).
                      const nextCourseTees: typeof courseTees = [];
                      for (const t of editedTees) {
                        const slopeNum = t.slope.trim() === "" ? null : parseInt(t.slope);
                        const ratingNum = t.rating.trim() === "" ? null : parseFloat(t.rating);
                        if ((slopeNum == null || Number.isNaN(slopeNum)) && (ratingNum == null || Number.isNaN(ratingNum))) continue;
                        const cleanSlope = slopeNum != null && !Number.isNaN(slopeNum) ? slopeNum : null;
                        const cleanRating = ratingNum != null && !Number.isNaN(ratingNum) ? ratingNum : null;
                        const { data: existingTees } = await supabase.from("TeeBox").select("id, holeId, yardage").eq("courseId", id).eq("color", t.color);
                        const exByHole = new Map((existingTees ?? []).map((r: any) => [r.holeId, r]));
                        const now = new Date().toISOString();
                        const rows = saved.map(h => {
                          const ex = exByHole.get(h.id);
                          return {
                            id: ex?.id ?? crypto.randomUUID(),
                            courseId: id,
                            holeId: h.id,
                            color: t.color,
                            yardage: ex?.yardage ?? h.yardage ?? 0,
                            slope: cleanSlope,
                            rating: cleanRating,
                            updatedAt: now,
                          };
                        });
                        await supabase.from("TeeBox").upsert(rows, { onConflict: "holeId,color" });
                        nextCourseTees.push({ color: t.color, slope: cleanSlope, rating: cleanRating });
                      }
                      setCourseTees(nextCourseTees);

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

            {/* AI extraction banner */}
            {(extractingScorecard || extractionMessage) && (
              <div
                role="status"
                style={{
                  marginBottom: 16,
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: extractingScorecard ? "rgba(77,168,98,0.12)" : "rgba(240,197,90,0.10)",
                  border: `1px solid ${extractingScorecard ? "rgba(77,168,98,0.35)" : "rgba(240,197,90,0.30)"}`,
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 12,
                  color: extractingScorecard ? "#4da862" : "rgba(255,255,255,0.75)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {extractingScorecard && (
                  <span
                    aria-hidden
                    style={{
                      width: 12,
                      height: 12,
                      border: "2px solid rgba(77,168,98,0.35)",
                      borderTopColor: "#4da862",
                      borderRadius: "50%",
                      animation: "tourit-spin 0.7s linear infinite",
                      flexShrink: 0,
                    }}
                  />
                )}
                <span>{extractionMessage ?? "Tour It is reading your scorecard…"}</span>
                <style>{`@keyframes tourit-spin { to { transform: rotate(360deg); } }`}</style>
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
                let publicUrl: string | null = null;
                if (!upErr) {
                  publicUrl = supabase.storage.from("tour-it-photos").getPublicUrl(path).data.publicUrl;
                  await supabase.from("Course").update({ scorecardImageUrl: publicUrl }).eq("id", course.id);
                  setCourse(c => c ? { ...c, scorecardImageUrl: publicUrl } : c);
                }
                setUploadingScorecardPhoto(false);
                e.target.value = "";

                if (!publicUrl) return;

                // Kick off AI extraction. Fill nulls on existing holes, full-fill new ones.
                setExtractingScorecard(true);
                setExtractionMessage("Tour It is reading your scorecard…");
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const token = session?.access_token;
                  if (!token) throw new Error("Not signed in");

                  const res = await fetch(`/api/courses/${course.id}/scorecard-extract`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ imageUrl: publicUrl }),
                  });
                  const data = await res.json();
                  if (!res.ok || !data?.ok) {
                    setExtractionMessage(data?.error ?? "Couldn't read that scorecard");
                    window.setTimeout(() => setExtractionMessage(null), 12000);
                    return;
                  }

                  const holeCount: number = data.holeCount === 9 ? 9 : 18;
                  type ExtractedHole = { holeNumber: number; par: number | null; handicapRank: number | null; yardage: number | null; confidence?: { par?: string; yardage?: string; handicapRank?: string } };
                  const byNum: Record<number, ExtractedHole> = {};
                  const confByNum: Record<number, { par?: string; yardage?: string; handicapRank?: string }> = {};
                  for (const h of (data.holes as ExtractedHole[])) {
                    if (typeof h?.holeNumber !== "number" || h.holeNumber < 1 || h.holeNumber > 18) continue;
                    byNum[h.holeNumber] = h;
                    confByNum[h.holeNumber] = h.confidence ?? { par: "low", yardage: "low", handicapRank: "low" };
                  }

                  // Photo is treated as source of truth. AI-extracted values
                  // overwrite existing scorecard data when present; existing
                  // values are only preserved when AI returned null for that
                  // field. User can still revert any cell in edit mode before
                  // tapping Save.
                  const merged: typeof editedHoles = [];
                  for (let n = 1; n <= holeCount; n++) {
                    const existing = holes.find(h => h.holeNumber === n);
                    const ex = byNum[n];
                    if (!existing) {
                      merged.push({
                        id: "__new__",
                        holeNumber: n,
                        par: typeof ex?.par === "number" ? ex.par : 4,
                        yardage: typeof ex?.yardage === "number" ? ex.yardage : null,
                        handicapRank: typeof ex?.handicapRank === "number" ? ex.handicapRank : (null as unknown as number),
                        imageUrl: null,
                        description: null,
                      });
                    } else {
                      merged.push({
                        ...existing,
                        par: typeof ex?.par === "number" ? ex.par : existing.par,
                        yardage: typeof ex?.yardage === "number" ? ex.yardage : existing.yardage,
                        handicapRank: typeof ex?.handicapRank === "number" ? ex.handicapRank : existing.handicapRank,
                      });
                    }
                  }

                  setEditedHoles(merged);
                  setExtractionConfidence(confByNum);
                  seedEditedTees();
                  setScorecardView("digital");
                  setScorecardEditMode(true);
                  setExtractionMessage(`Filled from photo — review and save${data.tee ? ` (yardages from ${data.tee} tee)` : ""}`);
                  window.setTimeout(() => setExtractionMessage(null), 6000);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "Extraction failed";
                  setExtractionMessage(msg);
                  window.setTimeout(() => setExtractionMessage(null), 4500);
                } finally {
                  setExtractingScorecard(false);
                }
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
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Upload a photo of the scorecard</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>Tour It will read it and fill the digital scorecard for you</div>
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
                        const conf = extractionConfidence[h.holeNumber];
                        const confStyle = (level: string | undefined) =>
                          level === "low" ? { borderColor: "rgba(240,197,90,0.6)", background: "rgba(240,197,90,0.05)" } as const :
                          level === "medium" ? { borderColor: "rgba(240,197,90,0.3)" } as const :
                          undefined;
                        return (
                          <div key={h.holeNumber} style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr 1fr", gap: 6, marginBottom: 6, alignItems: "center" }}>
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>{h.holeNumber}</div>
                            <select
                              className="sc-input"
                              value={h.par}
                              style={confStyle(conf?.par)}
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
                              style={confStyle(conf?.yardage)}
                              onChange={e => {
                                const v = e.target.value === "" ? null : parseInt(e.target.value) || null;
                                setEditedHoles(prev => prev.map((eh, i) => i === globalIdx ? { ...eh, yardage: v } : eh));
                              }}
                            />
                            <select
                              className="sc-input"
                              value={h.handicapRank ?? ""}
                              style={confStyle(conf?.handicapRank)}
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

                {/* Tee ratings editor — drives the per-player Course Handicap in games */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Tee Ratings</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 10, lineHeight: 1.4 }}>Slope &amp; course rating per tee. Used to calculate how many strokes each player gets in a game.</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 28px", gap: 6, marginBottom: 6 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tee</div>
                    {["Slope", "Rating"].map(l => (
                      <div key={l} style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>{l}</div>
                    ))}
                    <div />
                  </div>
                  {editedTees.map((t, idx) => {
                    const meta = TEE_COLORS.find(c => c.color === t.color);
                    return (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 28px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 14, height: 14, borderRadius: "50%", background: meta?.swatch ?? "#888", border: "1px solid rgba(255,255,255,0.25)", flexShrink: 0 }} />
                          <select
                            className="sc-input"
                            style={{ textAlign: "left", padding: "8px 6px" }}
                            value={t.color}
                            onChange={e => {
                              const v = e.target.value;
                              setEditedTees(prev => prev.map((et, i) => i === idx ? { ...et, color: v } : et));
                            }}
                          >
                            {TEE_COLORS.map(c => <option key={c.color} value={c.color} style={{ background: "#07100a" }}>{c.label}</option>)}
                          </select>
                        </div>
                        <input
                          className="sc-input"
                          type="number" min={55} max={155}
                          inputMode="numeric"
                          value={t.slope}
                          placeholder="—"
                          onChange={e => setEditedTees(prev => prev.map((et, i) => i === idx ? { ...et, slope: e.target.value } : et))}
                        />
                        <input
                          className="sc-input"
                          type="number" step="0.1" min={50} max={85}
                          inputMode="decimal"
                          value={t.rating}
                          placeholder="—"
                          onChange={e => setEditedTees(prev => prev.map((et, i) => i === idx ? { ...et, rating: e.target.value } : et))}
                        />
                        <button
                          aria-label="Remove tee"
                          onClick={() => setEditedTees(prev => prev.filter((_, i) => i !== idx))}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.45)", cursor: "pointer", padding: 0 }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      </div>
                    );
                  })}
                  {editedTees.length < TEE_COLORS.length && (
                    <button
                      onClick={() => {
                        const used = new Set(editedTees.map(t => t.color));
                        const next = TEE_COLORS.find(c => !used.has(c.color));
                        if (next) setEditedTees(prev => [...prev, { color: next.color, slope: "", rating: "" }]);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.55)", cursor: "pointer" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                      Add tee
                    </button>
                  )}
                </div>
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
                {courseTees.some(t => t.slope != null || t.rating != null) && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Tee Ratings</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {courseTees.filter(t => t.slope != null || t.rating != null).map(t => {
                        const meta = TEE_COLORS.find(c => c.color === t.color);
                        return (
                          <div key={t.color} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 12px" }}>
                            <span style={{ width: 12, height: 12, borderRadius: "50%", background: meta?.swatch ?? "#888", border: "1px solid rgba(255,255,255,0.25)" }} />
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{meta?.label ?? t.color}</span>
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{t.rating != null ? t.rating.toFixed(1) : "—"} / {t.slope ?? "—"}</span>
                          </div>
                        );
                      })}
                    </div>
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

{/* Contribute modal — portaled out of the hero's stacking context so
        it sits above BottomNav. Uses the .tourit-sheet--full variant
        since the form has many fields. */}
      {contributeOpen && (
        <SheetPortal>
          <div className="tourit-sheet-backdrop" onClick={() => setContributeOpen(false)} />
          <div id="course-contribute-sheet" className="tourit-sheet tourit-sheet--full" onClick={e => e.stopPropagation()}>
            <div className="tourit-sheet-grip" />
            {/* Small round close button — tap target separate from the
                drag handle so users always have an explicit exit. */}
            <button
              onClick={() => setContributeOpen(false)}
              aria-label="Close"
              style={{ position: "absolute", top: 12, right: 14, width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 1 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4, flexShrink: 0 }}>Contribute</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 16, flexShrink: 0 }}>Help keep {course.name} accurate and beautiful</div>

            {contributeSuccess ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, color: "#1a9e42", marginBottom: 6 }}>Thanks for contributing!</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Your updates are live.</div>
                <button onClick={() => setContributeOpen(false)} style={{ marginTop: 20, background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px 32px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Done</button>
              </div>
            ) : (
              <>
                <div className="tourit-sheet-body">
                {/* "Are you the course?" row — opens ClaimCourseSheet.
                    Lives here (inside Contribute) rather than under the
                    course title per UX feedback — discoverable without
                    competing with the rest of the header. Only shown
                    when the course is NOT already claimed; once claimed,
                    operator info is edited from /courses/[id]/manage. */}
                {!course.isClaimed && (
                  <button
                    onClick={() => { setContributeOpen(false); setClaimSheetOpen(true); }}
                    style={{ width: "100%", marginBottom: 18, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 12, cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff" }}>Are you the course?</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(126,200,140,0.85)", marginTop: 1 }}>
                        Claim this page to manage official info, staff, and tee sheet.
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(126,200,140,0.7)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                )}

                {/* Course Info fields */}
                <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Course Info</div>

                  {/* Course Name */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Course Name</label>
                    <input value={editCourseName} onChange={e => setEditCourseName(e.target.value)} placeholder={course.name}
                      style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }} />
                  </div>

                  {/* City / State */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>City</label>
                      <input value={editCity} onChange={e => setEditCity(e.target.value)} placeholder="Augusta"
                        style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>State</label>
                      <select value={editState} onChange={e => setEditState(e.target.value)}
                        style={{ width: "100%", background: "rgba(30,50,35,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: editState ? "#fff" : "rgba(255,255,255,0.35)", outline: "none", appearance: "none" }}>
                        <option value="" style={{ background: "#0d1f12" }}>—</option>
                        {US_STATES.map(s => <option key={s} value={s} style={{ background: "#0d1f12" }}>{s}</option>)}
                      </select>
                    </div>
                  </div>

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

                  {/* Holes (9 / 18) */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Holes</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {([9, 18] as const).map(n => (
                        <button key={n} onClick={() => setEditHoleCount(n)}
                          style={{ flex: 1, background: editHoleCount === n ? "rgba(77,168,98,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${editHoleCount === n ? "rgba(77,168,98,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "10px 6px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: editHoleCount === n ? "#4da862" : "rgba(255,255,255,0.45)", cursor: "pointer" }}>
                          {n} holes
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
                        <img src={cdnImage(course.coverImageUrl)} alt="current" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }} />
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
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Course Description</div>
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="What makes this course worth playing? Be honest..."
                    rows={4}
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", resize: "none", outline: "none" }}
                  />
                </div>

                {/* Course Logo upload */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Course Logo</div>
                  <label style={{ display: "block", cursor: "pointer" }}>
                    <div style={{ width: 80, height: 80, borderRadius: 12, border: "1.5px dashed rgba(26,158,66,0.4)", background: "rgba(26,158,66,0.05)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {logoPreview ? (
                        <img src={logoPreview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10 }} />
                      ) : course.logoUrl ? (
                        <img src={cdnImage(course.logoUrl)} alt="current logo" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10, opacity: 0.5 }} />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={handleLogoPick} style={{ display: "none" }} />
                  </label>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>Tap the square to upload a logo image</div>
                </div>

                {/* Website URL */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Website URL <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "rgba(255,255,255,0.25)", marginLeft: 4 }}>(optional · +10 pts)</span></div>
                  <input
                    type="url"
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    value={editWebsite}
                    onChange={e => setEditWebsite(e.target.value)}
                    placeholder="course.com or https://course.com"
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 13px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }}
                  />
                </div>

                {contributeError && (
                  <div style={{ background: "rgba(200,60,60,0.12)", border: "1px solid rgba(200,60,60,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,120,120,0.9)", lineHeight: 1.5 }}>
                    {contributeError}
                  </div>
                )}
                </div>
                {/* Sticky submit row — always reachable above the keyboard
                    so users don't have to scroll the long form to find it.
                    Lives outside .tourit-sheet-body so the body scrolls
                    independently. */}
                <div className="tourit-sheet-footer">
                  <button onClick={handleContributeSubmit} disabled={contributing} style={{ width: "100%", background: contributing ? "rgba(45,122,66,0.5)" : "#2d7a42", border: "none", borderRadius: 12, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: contributing ? "default" : "pointer", boxShadow: "0 2px 12px rgba(45,122,66,0.3)" }}>
                    {contributing ? "Saving..." : "Submit Updates"}
                  </button>
                </div>
              </>
            )}
          </div>
        </SheetPortal>
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
                      commentOpen={!!commentUploadId}
                      course={course}
                      uploaderMap={uploaders}
                      clipIndex={clipIdx}
                      totalClips={clips.length}
                      holeNumber={holeNum}
                      holePar={holeData?.par}
                      holeYardage={holeData?.yardage}
                      holeDescription={holeData?.description ?? null}
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
                      onReport={!clip.isOfficial && user && clip.userId !== user.id ? () => setReportClipId(clip.id) : undefined}
                      onEdit={!clip.isOfficial && user && clip.userId === user.id ? () => setEditClipInfo({ id: clip.id, holeId: clip.holeId ?? null, holeNumber: clip.holeNumber ?? null }) : undefined}
                      currentUserId={user?.id}
                      followingIds={followingIds}
                      likedIds={likedIds}
                      commentedIds={commentedIds}
                      onShowLikes={(uploadId) => setLikesUploadId(uploadId)}
                      onFollow={async (targetId: string) => {
                        if (!user?.id || followingInProgress.has(targetId)) return;
                        setFollowingInProgress(s => new Set(s).add(targetId));
                        const sb = createClient();
                        if (followingIds.has(targetId)) {
                          await sb.from("Follow").delete().eq("followerId", user.id).eq("followingId", targetId);
                          setFollowingIds(s => { const n = new Set(s); n.delete(targetId); return n; });
                        } else {
                          await sb.from("Follow").insert({ followerId: user.id, followingId: targetId, status: "ACTIVE", createdAt: new Date().toISOString() });
                          setFollowingIds(s => new Set(s).add(targetId));
                        }
                        setFollowingInProgress(s => { const n = new Set(s); n.delete(targetId); return n; });
                      }}
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
                          ? <img src={cdnImage(c.coverImageUrl)} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg, #1a4d22 0%, #0d2e14 100%)" }} />
                        }
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)" }} />
                        {c.logoUrl && (
                          <div style={{ position: "absolute", top: 7, right: 7, width: 28, height: 18, borderRadius: 5, overflow: "hidden" }}>
                            <img src={cdnImage(c.logoUrl)} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
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
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "calc(20px + env(safe-area-inset-top)) 14px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)", zIndex: 10 }}>
            <button onClick={() => setExtendedClip(null)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            {extendedClip.isOfficial ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "rgba(7,16,10,0.7)", border: "1px solid rgba(126,200,140,0.7)", borderRadius: 99, fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7ed28b" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></svg>
                From the course
              </div>
            ) : (
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                {extendedClip.shotType === "FULL_ROUND" ? "Full Round" : extendedClip.shotType === "FRONT_NINE" ? "Front 9" : extendedClip.shotType === "BACK_NINE" ? "Back 9" : extendedClip.shotType === "THREE_HOLE" ? "3 Holes" : "Extended Play"}
              </div>
            )}
            <div style={{ width: 36 }} />
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {extendedClip.mediaType === "VIDEO" ? (
              <HlsVideo src={getVideoSrc(extendedClip.mediaUrl, extendedClip.cloudflareVideoId)} style={{ width: "100%", height: "100%", objectFit: "cover" }} controls playsInline autoPlay muted />
            ) : (
              <img src={extendedClip.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            )}
          </div>
          {(extendedClip.officialCaption || extendedClip.strategyNote || extendedClip.landingZoneNote || extendedClip.whatCameraDoesntShow) && (
            <div style={{ position: "absolute", bottom: 80, left: 16, right: 80, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
              {extendedClip.isOfficial
                ? extendedClip.officialCaption
                : [extendedClip.strategyNote, extendedClip.landingZoneNote, extendedClip.whatCameraDoesntShow].filter(Boolean).join(" · ")}
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

      {/* Comment sheet — comments variant (50vh). Keyboard appears
          only when the user taps the input, not on sheet open. */}
      {commentUploadId && (
        <SheetPortal>
          <div className="tourit-sheet-backdrop" onClick={() => { setCommentUploadId(null); setCommentText(""); }} />
          <div className="tourit-sheet tourit-sheet--comments" onClick={e => e.stopPropagation()}>
            <div className="tourit-sheet-grip" />
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", textAlign: "center", paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Comments</div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {loadingComments ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading...</div>
              ) : commentItems.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13, padding: "32px 0", lineHeight: 1.6 }}>No comments yet.<br />Be the first to say something!</div>
              ) : commentItems.map(c => (
                <CommentSwipe
                  key={c.id}
                  isMine={!!user && c.userId === user.id}
                  bg="#0d2318"
                  onEdit={() => { setEditingCommentId(c.id); setEditingCommentText(c.body); }}
                  onDelete={() => deleteComment(c)}
                >
                  <div style={{ display: "flex", gap: 10, padding: "0 0 14px" }}>
                    <div className={isLegend(c.rank) ? "legend-ring" : undefined} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(26,158,66,0.2)", border: getRankRingBorder(c.rank), overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {c.avatarUrl
                        ? <img src={cdnImage(c.avatarUrl)} alt={c.username} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: getRankColor(c.rank) }}>@{c.username} </span>
                      {editingCommentId === c.id ? (
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <input
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value)}
                            autoFocus
                            style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }}
                            onKeyDown={(e) => { if (e.key === "Enter" && editingCommentText.trim()) saveCommentEdit(); }}
                          />
                          <button onClick={saveCommentEdit} disabled={!editingCommentText.trim()} style={{ background: "#2d7a42", border: "none", borderRadius: 8, padding: "6px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: !editingCommentText.trim() ? 0.4 : 1 }}>Save</button>
                          <button onClick={() => { setEditingCommentId(null); setEditingCommentText(""); }} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "6px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Cancel</button>
                        </div>
                      ) : (
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{c.body}</span>
                      )}
                    </div>
                  </div>
                </CommentSwipe>
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
                        {u.avatarUrl ? <img src={cdnImage(u.avatarUrl)} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={u.username} /> : <span style={{ fontSize: 10, color: "#1a9e42", fontWeight: 700 }}>{u.username[0].toUpperCase()}</span>}
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
        </SheetPortal>
      )}

      {/* Golf Trip picker modal */}
      {/* Plan Your Round sheet — dual path: schedule (live) or book (coming soon) */}
      {planOpen && (
        <SheetPortal>
          <div className="tourit-sheet-backdrop" onClick={() => setPlanOpen(false)} />
          <div id="course-plan-sheet" className="tourit-sheet tourit-sheet--auto" onClick={e => e.stopPropagation()}>
            <div className="tourit-sheet-grip" />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Plan Your Round</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>at {course.name}</div>

            {/* Path 1 — single round → Tee Up's Quick Round flow, pre-loaded
                with this course. Trip picker stays available via Save → Trip
                for multi-day itineraries. */}
            <button
              onClick={() => { setPlanOpen(false); router.push(`/tee-up?openQuickRound=${course.id}`); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 14px", background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 14, cursor: "pointer", textAlign: "left", marginBottom: 12 }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(77,168,98,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff" }}>Add to Your Upcoming Rounds Page</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>Schedule a single round, invite friends</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
            </button>

            {/* Path 2 — book through external platform (coming soon placeholder) */}
            <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, opacity: 0.75 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>Book a Tee Time</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>GolfNow and other partners — coming soon</div>
              </div>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 99, padding: "3px 8px", flexShrink: 0 }}>Soon</span>
            </div>
          </div>
        </SheetPortal>
      )}

      {tripPickerOpen && (
        <SheetPortal>
          <div className="tourit-sheet-backdrop" onClick={() => setTripPickerOpen(false)} />
          <div id="course-trip-picker" className="tourit-sheet" onClick={e => e.stopPropagation()}>
            <div className="tourit-sheet-grip" />

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
                    fetch("/api/points/award", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_trip", referenceId: tripId }) }).catch(() => {});
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
        </SheetPortal>
      )}

      {!feedOpen && <BottomNav />}

      {/* "Who liked this" sheet — opens from the like-count tap on any
          FeedCard. Page-level mount so it works from inside the feed
          modal too. */}
      <LikesSheet
        open={!!likesUploadId}
        uploadId={likesUploadId}
        onClose={() => setLikesUploadId(null)}
      />

    </main>
  );
}
