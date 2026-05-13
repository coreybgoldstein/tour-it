"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLike, seedLikedCache } from "@/hooks/useLike";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import BottomNav from "@/components/BottomNav";
import { ClipTopPill } from "@/components/clip/ClipTopPill";
import { IntelPanel } from "@/components/clip/IntelPanel";
import { sessionMute } from "@/lib/sessionMute";
import EditClipSheet from "@/components/EditClipSheet";
import { formatClipDate } from "@/lib/formatClipDate";
import { getRankColor, getRankRingBorder, isLegend } from "@/lib/rank-styles";
import { HlsVideo } from "@/components/HlsVideo";
import { getVideoSrc } from "@/lib/getVideoSrc";
import { VideoScrubber } from "@/components/clip/VideoScrubber";
import { rateLimit } from "@/lib/rateLimit";
import { formatTimeAgo } from "@/lib/formatTimeAgo";
import MayCompetitionBanner from "@/components/MayCompetitionBanner";
import { activeFeaturedTournament, type FeaturedTournament } from "@/lib/pgaChampionship";

type TrendingCourse = {
  id: string;
  name: string;
  city: string;
  state: string;
  uploadCount: number;
  coverImageUrl: string | null;
  logoUrl: string | null;
  isPublic?: boolean;
};


const SHOT_LABEL: Record<string, string> = {
  TEE_SHOT: "Tee Shot", DRIVE: "Tee Shot", APPROACH: "Approach", CHIP: "Chip",
  PITCH: "Pitch", PUTT: "Putt", BUNKER: "Bunker", LAY_UP: "Layup", LAYUP: "Layup",
  FULL_HOLE: "Full Hole", FULL_SWING: "Full Swing",
};

type FeedClip = {
  id: string;
  mediaUrl: string;
  mediaType: string;
  cloudflareVideoId?: string | null;
  courseId: string;
  courseName: string;
  courseLogoUrl: string | null;
  courseCity?: string | null;
  courseState?: string | null;
  holeId: string;
  holeNumber?: number;
  holePar?: number | null;
  holeYardage?: number | null;
  strategyNote: string | null;
  clubUsed: string | null;
  windCondition: string | null;
  conditions?: string | null;
  shotType: string | null;
  username: string;
  avatarUrl: string | null;
  userId: string;
  uploaderHandicap?: number | null;
  rank?: string | null;
  likeCount: number;
  commentCount: number;
  seriesId: string | null;
  seriesOrder: number | null;
  yardageOverlay: string | null;
  datePlayedAt: string | null;
  createdAt: string;
};

type FeedItem =
  | { type: "clip"; clip: FeedClip }
  | { type: "series"; shots: FeedClip[]; seriesId: string; courseName: string; courseLogoUrl: string | null; courseCity?: string | null; courseState?: string | null; courseId: string; holeId: string; holeNumber?: number; username: string; avatarUrl: string | null; userId: string; rank?: string | null };

type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  username: string;
  avatarUrl: string | null;
  rank?: string | null;
};


function TourItLogo({ size = 26 }: { size?: number }) {
  const w = Math.round(size * 0.8);
  return (
    <svg width={w} height={size} viewBox="0 0 60 75" fill="none">
      <defs>
        <clipPath id="ti-clip">
          <path d="M30 68 C16 53 7 44 7 30 A23 23 0 0 1 53 30 C53 44 44 53 30 68Z" />
        </clipPath>
        <linearGradient id="ti-g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d7d35"/>
          <stop offset="100%" stopColor="#1a5520"/>
        </linearGradient>
        <linearGradient id="ti-g2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5ec46a"/>
          <stop offset="100%" stopColor="#3d9046"/>
        </linearGradient>
      </defs>
      {/* White pin border */}
      <path d="M30 72 C14 56 3 46 3 30 A27 27 0 0 1 57 30 C57 46 46 56 30 72Z" fill="white" />
      {/* Dark interior */}
      <path d="M30 68 C16 53 7 44 7 30 A23 23 0 0 1 53 30 C53 44 44 53 30 68Z" fill="#0c1e11" />
      {/* Back rough */}
      <ellipse cx="30" cy="30" rx="22" ry="20" fill="#163d1a" clipPath="url(#ti-clip)" />
      {/* Mid grass */}
      <path d="M12 44 Q14 32 24 28 Q32 24 36 18 Q30 12 22 14 Q14 17 11 26Z" fill="url(#ti-g1)" clipPath="url(#ti-clip)" />
      {/* Fairway S-curve */}
      <path d="M24 52 Q22 40 26 34 Q30 28 32 22 Q28 15 22 17 Q17 20 18 30 Q19 39 22 46Z" fill="#3d8c40" clipPath="url(#ti-clip)" />
      {/* Water hazard */}
      <path d="M35 50 Q43 44 47 36 Q51 27 47 19 Q43 14 39 17 Q37 21 39 28 Q41 35 39 42 Q37 46 35 50Z" fill="#3d9fd4" clipPath="url(#ti-clip)" />
      {/* Water shimmer */}
      <path d="M37 45 Q44 40 47 32 Q49 25 45 19" stroke="rgba(120,210,255,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" clipPath="url(#ti-clip)" />
      {/* Putting green */}
      <ellipse cx="20" cy="40" rx="9" ry="7" fill="url(#ti-g2)" clipPath="url(#ti-clip)" />
      {/* Green highlight */}
      <ellipse cx="18" cy="38" rx="4" ry="2.5" fill="rgba(140,240,150,0.25)" clipPath="url(#ti-clip)" />
      {/* Sand trap */}
      <ellipse cx="25" cy="43" rx="3" ry="1.8" fill="#e8d060" clipPath="url(#ti-clip)" />
      {/* Flag pole */}
      <line x1="19" y1="40" x2="19" y2="13" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      {/* Red flag */}
      <path d="M19 13 L31 17 L19 21Z" fill="#e53e3e" />
    </svg>
  );
}

function LeaderboardsButtonInline() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push("/leaderboards")}
      aria-label="Leaderboards"
      style={{
        position: "relative",
        width: 36, height: 36,
        borderRadius: "50%",
        // Same translucent fill as the homepage hamburger button so the green TopBar shows through identically
        background: "rgba(255,255,255,0.06)",
        border: "1.5px solid #d4a017",
        boxShadow: "0 0 0 1px rgba(212,160,23,0.25), 0 0 8px rgba(212,160,23,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="4" cy="3" r="1"/>
        <circle cx="20" cy="3" r="1"/>
        <path d="M4 4 Q12 8 20 4"/>
        <path d="M4 4 L4 17 L20 17 L20 4"/>
        <line x1="6" y1="10" x2="18" y2="10"/>
        <line x1="6" y1="13.5" x2="18" y2="13.5"/>
        <line x1="12" y1="17" x2="12" y2="20"/>
        <line x1="10" y1="20" x2="14" y2="20"/>
      </svg>
    </button>
  );
}


function CourseCard({ course, onClick, compact, featured }: { course: TrendingCourse; onClick: () => void; compact?: boolean; featured?: FeaturedTournament | null }) {
  const h = compact ? 174 : 188;
  const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
  const GOLD = "#d4a017";
  return (
    <div
      onClick={onClick}
      style={{
        width: 148, height: h, borderRadius: 14, flexShrink: 0, overflow: "hidden",
        cursor: "pointer", position: "relative", background: "rgba(10,28,18,0.95)",
        border: featured ? `1.5px solid ${GOLD}` : "1px solid rgba(26,158,66,0.12)",
        boxShadow: featured ? "0 0 0 1px rgba(212,160,23,0.25), 0 0 14px rgba(212,160,23,0.22)" : undefined,
      }}
    >
      {course.coverImageUrl && (
        <img src={course.coverImageUrl} alt={course.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}
      <div style={{ position: "absolute", inset: 0, background: course.coverImageUrl ? "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.12) 35%, rgba(0,0,0,0.82) 65%, rgba(0,0,0,0.96) 100%)" : "linear-gradient(145deg, rgba(13,35,22,1) 0%, rgba(7,16,10,1) 100%)" }} />

      {!course.coverImageUrl && (
        <div style={{ position: "absolute", top: "32%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {course.logoUrl ? (
            <img src={course.logoUrl} alt={course.name} style={{ width: 68, height: 42, objectFit: "cover", objectPosition: "center", borderRadius: 8, backgroundColor: "#fff" }} />
          ) : (
            <div style={{ width: 46, height: 46, borderRadius: 10, background: "rgba(26,158,66,0.12)", border: "1px solid rgba(26,158,66,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(26,158,66,0.6)" }}>{abbr}</div>
          )}
        </div>
      )}

      {/* PGA Championship badge — top-right corner of the thumbnail.
          Tries the tournament logo asset; falls back to a gold text crest
          when the image isn't present in /public yet. */}
      {featured && (
        <div style={{ position: "absolute", top: 6, right: 6, width: 36, height: 36, borderRadius: 8, background: "#fff", border: `1.5px solid ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.35)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={featured.logoSrc}
            alt={featured.label}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            onError={(e) => {
              // No logo asset yet → swap the <img> for a gold text crest
              const el = e.currentTarget as HTMLImageElement;
              const parent = el.parentElement;
              if (parent && !parent.dataset.fallback) {
                parent.dataset.fallback = "1";
                parent.innerHTML = `<div style="font-family:'Outfit',sans-serif;font-size:9px;font-weight:900;color:${GOLD};line-height:1;letter-spacing:0.04em;text-align:center"><div>PGA</div><div style="margin-top:2px;font-size:7px">2026</div></div>`;
              }
            }}
          />
        </div>
      )}

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 10px 12px" }}>
        {featured && (
          <div style={{ display: "inline-flex", alignItems: "center", background: GOLD, borderRadius: 99, padding: "2px 7px", marginBottom: 4, maxWidth: "100%" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 8, fontWeight: 800, color: "#0a1d10", letterSpacing: "0.04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {featured.pillText}
            </span>
          </div>
        )}
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#fff", lineHeight: 1.35, marginBottom: 3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
          {course.name}
        </div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.35)" }}>
          {[course.city, course.state].filter(s => s?.trim()).join(", ")}
        </div>
        {course.uploadCount > 0 && !featured && (
          <div style={{ marginTop: 5, display: "inline-flex", alignItems: "center", background: "rgba(26,158,66,0.18)", borderRadius: 99, padding: "2px 8px" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "#1a9e42" }}>{course.uploadCount} clips</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RightPanel({ userId, avatarUrl, username, rank, courseId, courseName, liked, onLike, likeCount, onComment, commentCount, onTapUser, onIntel, intelOpen, onReport, onEdit, isFollowing, onFollow }: {
  userId: string; avatarUrl: string | null; username: string; rank?: string | null;
  courseId: string; courseName: string;
  liked: boolean; onLike: () => void; likeCount: number;
  onComment: () => void; commentCount: number;
  onTapUser: () => void;
  onIntel: (() => void) | null; intelOpen: boolean;
  onReport?: () => void;
  onEdit?: () => void;
  isFollowing?: boolean;
  onFollow?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const handleShare = () => {
    const url = `${window.location.origin}/courses/${courseId}`;
    if (navigator.share) navigator.share({ title: courseName, text: `Check out ${courseName} on Tour It`, url }).catch(() => {});
    else { navigator.clipboard.writeText(url).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  return (
    <div style={{ position: "absolute", right: 12, bottom: "calc(100px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, zIndex: 10 }}>
      {/* Intel */}
      {onIntel && (
        <button onClick={onIntel} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: intelOpen ? "#3b8b4c" : "#4da862", border: "1.5px solid #4da862", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(77,168,98,0.35)" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "0.5px", color: "rgba(255,255,255,0.85)", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>INTEL</span>
        </button>
      )}
      {/* Uploader avatar — directly below Intel */}
      <button onClick={onTapUser} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ position: "relative" }}>
          <div className={isLegend(rank) ? "legend-ring" : undefined} style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: getRankRingBorder(rank), background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {avatarUrl
              ? <img src={avatarUrl} alt={username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
          </div>
          {onFollow && !isFollowing && (
            <button onClick={e => { e.stopPropagation(); onFollow(); }} style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: "#2d7a42", border: "1.5px solid #07100a", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, zIndex: 1 }}>
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
            </button>
          )}
        </div>
      </button>
      {/* Like */}
      <button onClick={onLike} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: liked ? "#1a9e42" : "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: `1px solid ${liked ? "#1a9e42" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill={liked ? "#fff" : "none"} stroke={liked ? "#fff" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>{likeCount}</span>
      </button>
      {/* Comment */}
      <button onClick={onComment} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>{commentCount}</span>
      </button>
      {/* SEND IT */}
      <button onClick={handleShare} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: copied ? "rgba(26,158,66,0.2)" : "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: `1px solid ${copied ? "rgba(26,158,66,0.5)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
      {/* Report */}
      {onReport && (
        <button onClick={onReport} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </div>
          <span style={{ height: 13, display: "block" }} />
        </button>
      )}
      {/* Edit (own clips only) */}
      {onEdit && (
        <button onClick={onEdit} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <span style={{ height: 13, display: "block" }} />
        </button>
      )}
    </div>
  );
}

// memo'd — the home feed renders 100-200 of these at once; without memo,
// every scroll-snap tick re-renders all of them and that's what made the
// discovery → first-clip transition judder. Callbacks are intentionally
// excluded from the comparator: they're inline arrows that change ref
// every render, but their closures only read stable refs (router, setters)
// so a stale closure can't go wrong here.
const SeriesCard = memo(function SeriesCardImpl({
  item, isActive, onTapCourse, onTapUser, onComment, currentUserId, followingIds, onFollow, likedIds,
}: {
  item: Extract<FeedItem, { type: "series" }>;
  isActive: boolean;
  onTapCourse: () => void; onTapUser: () => void; onComment: () => void;
  currentUserId?: string | null;
  followingIds?: Set<string>; onFollow?: (userId: string) => void;
  // Pre-batched set of clip IDs the current user has liked — eliminates
  // the per-clip Supabase round-trip that would otherwise make the heart
  // flicker from unfilled to filled on mount.
  likedIds?: Set<string>;
}) {
  const [shotIndex, setShotIndex] = useState(0);
  const [intelOpen, setIntelOpen] = useState(false);
  const [muted, setMuted] = useState(sessionMute.get());
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const activeShot = item.shots[shotIndex];
  const { liked: seriesLiked, likeCount: seriesLikeCount, toggleLike: seriesToggleLike } = useLike({
    uploadId: activeShot?.id || "",
    initialLikeCount: activeShot?.likeCount || 0,
    initialLiked: likedIds ? likedIds.has(activeShot?.id || "") : undefined,
    currentUserId: currentUserId ?? null,
  });
  const handleSeriesLike = currentUserId ? seriesToggleLike : () => router.push("/login");
  const hasNotes = !!(activeShot?.strategyNote || activeShot?.clubUsed || activeShot?.windCondition || activeShot?.datePlayedAt);

  useEffect(() => {
    if (!isActive) {
      Object.values(videoRefs.current).forEach(v => { if (v) { v.pause(); v.currentTime = 0; } });
      setShotIndex(0);
      setIntelOpen(false);
      return;
    }
    const currentMuted = sessionMute.get();
    setMuted(currentMuted);
    Object.values(videoRefs.current).forEach(v => { if (v) v.muted = currentMuted; });
    item.shots.forEach((shot, i) => {
      const el = videoRefs.current[shot.id];
      if (!el) return;
      if (i === shotIndex) { el.currentTime = 0; el.play().catch(() => {}); }
      else { el.pause(); el.currentTime = 0; }
    });
  }, [isActive, shotIndex, item.shots]);

  useEffect(() => {
    Object.values(videoRefs.current).forEach(v => { if (v) v.muted = muted; });
  }, [muted]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      e.stopPropagation();
      if (dx > 0 && shotIndex < item.shots.length - 1) setShotIndex(i => i + 1);
      else if (dx < 0 && shotIndex > 0) setShotIndex(i => i - 1);
    }
  };

  const handleMuteToggle = () => {
    const next = !muted;
    setMuted(next);
    sessionMute.set(next);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100svh", ...(isDesktop ? { background: "#000", display: "flex", justifyContent: "center" } : {}) }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#07100a", ...(isDesktop ? { maxWidth: 390 } : {}) }}>
      {item.shots.map((shot, i) => (
        <div key={shot.id} style={{ position: "absolute", inset: 0, opacity: i === shotIndex ? 1 : 0, transition: "opacity 0.18s", pointerEvents: i === shotIndex ? "auto" : "none" }}>
          {shot.mediaType === "VIDEO" ? (
            <HlsVideo ref={el => { videoRefs.current[shot.id] = el as HTMLVideoElement | null; }} src={getVideoSrc(shot.mediaUrl, shot.cloudflareVideoId)} loop muted={muted} playsInline style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} onClick={() => {}} />
          ) : (
            <img src={shot.mediaUrl} alt="shot" style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} onClick={() => {}} />
          )}
        </div>
      ))}

      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 35%)", pointerEvents: "none", zIndex: 5 }} />

      <ClipTopPill
        courseLogoUrl={item.courseLogoUrl}
        courseName={item.courseName}
        courseLocation={[item.courseCity, item.courseState].filter(Boolean).join(", ") || null}
        holeNumber={item.holeNumber}
        holePar={item.shots[0]?.holePar}
        holeYardage={item.shots[0]?.holeYardage}
        muted={muted}
        onMuteToggle={handleMuteToggle}
        onTapCourse={onTapCourse}
        visible={true}
      />

      {/* Shot progress dots */}
      {item.shots.length > 1 && (
        <div style={{ position: "absolute", top: 116, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, zIndex: 20, pointerEvents: "none" }}>
          {item.shots.map((_, i) => (
            <div key={i} style={{ height: 3, borderRadius: 99, background: i === shotIndex ? "#1a9e42" : "rgba(255,255,255,0.3)", width: i === shotIndex ? 22 : 7, transition: "all 0.3s" }} />
          ))}
        </div>
      )}

      {activeShot?.yardageOverlay && (
        <div style={{ position: "absolute", top: "42%", left: 16, zIndex: 10, pointerEvents: "none" }}>
          <div style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px", backdropFilter: "blur(8px)" }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff" }}>{activeShot.yardageOverlay}</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.6)", marginLeft: 5 }}>yds</span>
          </div>
        </div>
      )}

      {shotIndex > 0 && (
        <button onClick={() => setShotIndex(i => i - 1)} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      )}
      {shotIndex < item.shots.length - 1 && (
        <button onClick={() => setShotIndex(i => i + 1)} style={{ position: "absolute", right: 76, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      )}

      <RightPanel userId={item.userId} avatarUrl={item.avatarUrl} username={item.username} rank={item.rank} courseId={item.courseId} courseName={item.courseName} liked={seriesLiked} onLike={handleSeriesLike} likeCount={seriesLikeCount} onComment={onComment} commentCount={item.shots[0]?.commentCount || 0} onTapUser={onTapUser} onIntel={hasNotes ? () => setIntelOpen(o => !o) : null} intelOpen={intelOpen} isFollowing={followingIds?.has(item.userId)} onFollow={currentUserId && currentUserId !== item.userId ? () => onFollow?.(item.userId) : undefined} />

      <IntelPanel
        open={intelOpen}
        onClose={() => setIntelOpen(false)}
        holeNumber={item.holeNumber}
        holePar={item.shots[0]?.holePar}
        holeYardage={item.shots[0]?.holeYardage}
        clubUsed={activeShot?.clubUsed}
        windCondition={activeShot?.windCondition}
        conditions={activeShot?.conditions}
        strategyNote={activeShot?.strategyNote}
        datePlayedAt={activeShot?.datePlayedAt}
        uploaderUsername={item.username}
        uploaderAvatarUrl={item.avatarUrl}
        uploaderId={item.userId}
        currentUserId={currentUserId}
        uploaderHandicap={item.shots[0]?.uploaderHandicap}
      />
      </div>{/* end inner wrapper */}
    </div>
  );
}, (prev, next) => (
  prev.item === next.item
  && prev.isActive === next.isActive
  && prev.currentUserId === next.currentUserId
  && prev.followingIds === next.followingIds
  && prev.likedIds === next.likedIds
));

// memo'd for the same reason as SeriesCard above — avoid re-rendering 100+
// idle clips on every scroll-snap tick. The active card's own state still
// drives its own re-renders via useState/useEffect; this only cuts the
// "parent re-rendered, so I re-render too" cascade.
const VideoCard = memo(function VideoCardImpl({
  clip, isActive, onTapCourse, onTapUser, onComment, onEnded, onReport, onEdit, currentUserId, followingIds, onFollow, likedIds,
}: {
  clip: FeedClip; isActive: boolean;
  onTapCourse: () => void; onTapUser: () => void; onComment: () => void;
  onEnded: () => void;
  followingIds?: Set<string>; onFollow?: (userId: string) => void;
  onReport?: () => void;
  onEdit?: () => void;
  currentUserId?: string | null;
  // Pre-batched set of clip IDs the current user has liked (see SeriesCard).
  likedIds?: Set<string>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { liked, likeCount, toggleLike } = useLike({
    uploadId: clip.id,
    initialLikeCount: clip.likeCount || 0,
    initialLiked: likedIds ? likedIds.has(clip.id) : undefined,
    currentUserId: currentUserId ?? null,
  });
  const [videoPaused, setVideoPaused] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const [muted, setMuted] = useState(sessionMute.get());
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const hasNotes = !!(clip.strategyNote || clip.clubUsed || clip.windCondition || clip.datePlayedAt);
  const handleLike = currentUserId ? toggleLike : () => router.push("/login");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      const currentMuted = sessionMute.get();
      setMuted(currentMuted);
      video.muted = currentMuted;
      video.play().catch(() => {});
      setVideoPaused(false);
    } else {
      video.pause();
      video.currentTime = 0;
      setIntelOpen(false);
    }
  }, [isActive]);

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
        <HlsVideo ref={videoRef} src={getVideoSrc(clip.mediaUrl, clip.cloudflareVideoId)} muted={muted} playsInline
          onClick={() => {
            const v = videoRef.current; if (!v) return;
            if (v.paused) { v.play().catch(() => {}); setVideoPaused(false); }
            else { v.pause(); setVideoPaused(true); }
          }}
          onEnded={onEnded}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} />
      ) : (
        <img src={clip.mediaUrl} alt="clip" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}

      {clip.mediaType === "VIDEO" && <VideoScrubber videoRef={videoRef} />}

      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 35%)", pointerEvents: "none", zIndex: 5 }} />

      {videoPaused && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 15, pointerEvents: "none", opacity: 0.7 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </div>
        </div>
      )}

      <ClipTopPill
        courseLogoUrl={clip.courseLogoUrl}
        courseName={clip.courseName}
        courseLocation={[clip.courseCity, clip.courseState].filter(Boolean).join(", ") || null}
        holeNumber={clip.holeNumber}
        holePar={clip.holePar}
        holeYardage={clip.holeYardage}
        muted={muted}
        onMuteToggle={handleMuteToggle}
        onTapCourse={onTapCourse}
        visible={true}
      />

      {clip.yardageOverlay && (
        <div style={{ position: "absolute", top: "42%", left: 16, zIndex: 10, pointerEvents: "none" }}>
          <div style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px", backdropFilter: "blur(8px)" }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff" }}>{clip.yardageOverlay}</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.6)", marginLeft: 5 }}>yds</span>
          </div>
        </div>
      )}

      <RightPanel userId={clip.userId} avatarUrl={clip.avatarUrl} username={clip.username} rank={clip.rank} courseId={clip.courseId} courseName={clip.courseName} liked={liked} onLike={handleLike} likeCount={likeCount} onComment={onComment} commentCount={clip.commentCount} onTapUser={onTapUser} onIntel={hasNotes ? () => setIntelOpen(o => !o) : null} intelOpen={intelOpen} onReport={onReport} onEdit={onEdit} isFollowing={followingIds?.has(clip.userId)} onFollow={currentUserId && currentUserId !== clip.userId ? () => onFollow?.(clip.userId) : undefined} />

      {(clip.username || formatClipDate(clip.datePlayedAt, clip.createdAt)) && (
        <div style={{ position: "absolute", left: 16, bottom: clip.mediaType === "VIDEO" ? 112 : 88, zIndex: 10, display: "flex", alignItems: "center", gap: 8 }}>
          {clip.username && <span onClick={onTapUser} style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 800, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.9)", cursor: "pointer" }}>{clip.username}</span>}
          {formatClipDate(clip.datePlayedAt, clip.createdAt) && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 400, color: "rgba(255,255,255,0.65)", textShadow: "0 1px 3px rgba(0,0,0,0.8)", pointerEvents: "none" }}>{formatClipDate(clip.datePlayedAt, clip.createdAt)}</span>}
          {clip.mediaType !== "VIDEO" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, pointerEvents: "none" }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
        </div>
      )}

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
        datePlayedAt={clip.datePlayedAt}
        uploaderUsername={clip.username}
        uploaderAvatarUrl={clip.avatarUrl}
        uploaderId={clip.userId}
        currentUserId={currentUserId}
        uploaderHandicap={clip.uploaderHandicap}
      />
      </div>{/* end inner wrapper */}
    </div>
  );
}, (prev, next) => (
  prev.clip === next.clip
  && prev.isActive === next.isActive
  && prev.currentUserId === next.currentUserId
  && prev.followingIds === next.followingIds
  && prev.likedIds === next.likedIds
));


export default function Home() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [user, setUser] = useState<any>(undefined); // undefined = auth not yet checked, null = confirmed logged out
  const [userProfile, setUserProfile] = useState<any>(null);
  const [trendingCourses, setTrendingCourses] = useState<TrendingCourse[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  // Pre-batched set of uploadIds the current user has liked across the
  // entire visible feed. Populated by a single Supabase query after the
  // feed and the auth user are both available; eliminates the per-clip
  // round-trip that would otherwise make the heart flicker on mount.
  const [likedIds, setLikedIds] = useState<Set<string> | undefined>(undefined);
  // Track which course routes we've already prefetched so we don't re-fire
  // the request when the feed or near-me data refreshes.
  const prefetchedCoursesRef = useRef<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [commentUploadId, setCommentUploadId] = useState<string | null>(null);
  const [commentItems, setCommentItems] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [splashVisible, setSplashVisible] = useState(false);
  const [splashFading, setSplashFading] = useState(false);
  const [showScrollHint] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nearMeCourses, setNearMeCourses] = useState<TrendingCourse[]>([]);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [nearMeRadius, setNearMeRadius] = useState(50);
  const [publicOnly, setPublicOnly] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [reportClipId, setReportClipId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [editClipInfo, setEditClipInfo] = useState<{ id: string; courseId: string; holeId: string | null; holeNumber: number | null } | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());
  const feedRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  // Auto-fetch near-me if geolocation permission already granted (no prompt)
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.permissions?.query({ name: "geolocation" as PermissionName })
      .then(result => {
        if (result.state === "granted") fetchNearMe();
        else if (result.state === "denied") setLocationStatus("denied");
      })
      .catch(() => {
        // Permissions API unavailable — auto-fetch if we have cached coords
        try {
          const raw = localStorage.getItem("tour-it-location");
          if (raw) { const { ts } = JSON.parse(raw); if (Date.now() - ts < 86400000 * 7) fetchNearMe(); }
        } catch {}
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user ?? null);
      if (data.user) {
        // Logged-in users never see the onboarding modal, even if Safari cleared localStorage
        setShowOnboarding(false);
        localStorage.setItem("tour-it-onboarded", "1");
        const { data: profile } = await supabase.from("User").select("username, avatarUrl, displayName").eq("id", data.user.id).single();
        setUserProfile(profile);
        import("@/lib/registerPush").then(({ registerPush }) => registerPush(data.user!.id));
        const { data: follows } = await supabase.from("Follow").select("followingId").eq("followerId", data.user.id).eq("status", "ACTIVE");
        setFollowingIds(new Set((follows || []).map((f: any) => f.followingId)));
      }
    });

    (async () => {
      const { data } = await supabase
        .from("Course")
        .select("id, name, city, state, uploadCount, coverImageUrl, logoUrl")
        .gt("uploadCount", 0)
        .limit(40);
      if (!data) return;
      const shuffled = [...data].sort(() => Math.random() - 0.5);
      let picked = shuffled.slice(0, 10);

      // During tournament week, anchor the featured course (e.g. PGA Aronimink)
      // to the first position. Falls back gracefully if it's already in the
      // list (move to front) or not yet in trending (fetch it directly).
      const featured = activeFeaturedTournament();
      if (featured) {
        const already = picked.find(c => c.id === featured.courseId);
        if (already) {
          picked = [already, ...picked.filter(c => c.id !== featured.courseId)];
        } else {
          const { data: fc } = await supabase
            .from("Course")
            .select("id, name, city, state, uploadCount, coverImageUrl, logoUrl")
            .eq("id", featured.courseId)
            .maybeSingle();
          if (fc) picked = [fc, ...picked.slice(0, 9)];
        }
      }
      setTrendingCourses(picked);
    })();

    async function loadFeed() {
      let seenIds: Set<string>;
      try { seenIds = new Set<string>(JSON.parse(sessionStorage.getItem("tour_feed_seen") || "[]")); }
      catch { seenIds = new Set(); }

      // Get current user from cached session to exclude own clips from discovery
      const { data: { session } } = await supabase.auth.getSession();
      const currentUid = session?.user?.id ?? null;

      const SELECT = "id, mediaUrl, cloudflareVideoId, mediaType, courseId, holeId, strategyNote, clubUsed, windCondition, shotType, likeCount, commentCount, userId, seriesId, seriesOrder, yardageOverlay, datePlayedAt, createdAt";
      const { data: allUploads } = await supabase
        .from("Upload").select(SELECT).eq("moderationStatus", "APPROVED")
        .eq("mediaType", "VIDEO")
        .order("createdAt", { ascending: false }).limit(200);

      // Exclude own clips
      const allEligible = (allUploads || []).filter(u => !currentUid || u.userId !== currentUid);
      if (allEligible.length === 0) { setLoading(false); return; }

      // Exclude already-seen clips; reset if all have been seen
      let pool = allEligible.filter(u => !seenIds.has(u.id));
      if (pool.length === 0) {
        sessionStorage.removeItem("tour_feed_seen");
        seenIds = new Set();
        pool = allEligible;
      }

      // Full shuffle — true variety on every load
      const shuffled = [...pool].sort(() => Math.random() - 0.5);

      // 5-slide course spacing: no same course within 5 consecutive slots
      const recentCourses: string[] = [];
      const uploads: typeof shuffled = [];
      for (const clip of shuffled) {
        if (!recentCourses.slice(-5).includes(clip.courseId)) {
          uploads.push(clip);
          recentCourses.push(clip.courseId);
        }
        if (uploads.length >= 15) break;
      }

      // Fallback if course-spacing over-filtered
      const finalUploads = uploads.length > 0 ? uploads : shuffled.slice(0, 15);

      // Persist seen IDs for this session (cap at 100)
      sessionStorage.setItem(
        "tour_feed_seen",
        JSON.stringify([...seenIds, ...finalUploads.map(u => u.id)].slice(-100))
      );

      if (finalUploads.length === 0) { setLoading(false); return; }

      const courseIds = [...new Set(finalUploads.map((u: any) => u.courseId))];
      const userIds = [...new Set(finalUploads.map((u: any) => u.userId))];
      const holeIds = [...new Set(finalUploads.map((u: any) => u.holeId).filter(Boolean))];

      const [{ data: courses }, { data: users }, { data: holes }, { data: progressions }] = await Promise.all([
        supabase.from("Course").select("id, name, logoUrl, city, state").in("id", courseIds),
        supabase.from("User").select("id, username, avatarUrl, handicapIndex").in("id", userIds),
        supabase.from("Hole").select("id, holeNumber, par, yardage").in("id", holeIds),
        supabase.from("UserProgression").select("userId, rank").in("userId", userIds),
      ]);

      const rankMap: Record<string, string> = {};
      progressions?.forEach((p: any) => { rankMap[p.userId] = p.rank; });

      const enriched: FeedClip[] = finalUploads.map((u: any) => {
        const hole = holes?.find((h: any) => h.id === u.holeId);
        const user = users?.find((usr: any) => usr.id === u.userId);
        const course = courses?.find((c: any) => c.id === u.courseId);
        return {
          ...u,
          commentCount: u.commentCount || 0,
          courseName: course?.name || "Unknown Course",
          courseLogoUrl: course?.logoUrl || null,
          courseCity: course?.city || null,
          courseState: course?.state || null,
          username: user?.username || "golfer",
          avatarUrl: user?.avatarUrl || null,
          uploaderHandicap: user?.handicapIndex ?? null,
          rank: rankMap[u.userId] || null,
          holeNumber: hole?.holeNumber || undefined,
          holePar: hole?.par ?? null,
          holeYardage: hole?.yardage ?? null,
        };
      });

      const seriesMap: Record<string, FeedClip[]> = {};
      const singleClips: FeedClip[] = [];
      enriched.forEach(clip => {
        if (clip.seriesId) {
          if (!seriesMap[clip.seriesId]) seriesMap[clip.seriesId] = [];
          seriesMap[clip.seriesId].push(clip);
        } else {
          singleClips.push(clip);
        }
      });

      const seriesItems: FeedItem[] = Object.entries(seriesMap).map(([seriesId, shots]) => {
        const sorted = shots.sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0));
        const first = sorted[0];
        return { type: "series", seriesId, shots: sorted, courseName: first.courseName, courseLogoUrl: first.courseLogoUrl, courseCity: first.courseCity, courseState: first.courseState, courseId: first.courseId, holeId: first.holeId, holeNumber: first.holeNumber, username: first.username, avatarUrl: first.avatarUrl, userId: first.userId, rank: first.rank };
      });

      const singleItems: FeedItem[] = singleClips.map(clip => ({ type: "clip", clip }));

      // Interleave: insert one series after every 4 single clips so a long series doesn't dominate
      const interleaved: FeedItem[] = [];
      let si = 0;
      seriesItems.forEach((series, si2) => {
        const start = si2 * 4;
        const end = Math.min(start + 4, singleItems.length);
        for (let j = start; j < end; j++) interleaved.push(singleItems[j]);
        si = end;
        interleaved.push(series);
      });
      while (si < singleItems.length) interleaved.push(singleItems[si++]);
      setFeedItems(interleaved);
      feedCursorRef.current = allUploads![allUploads!.length - 1].createdAt;
      hasMoreRef.current = (allUploads?.length ?? 0) >= 200;
      setLoading(false);
    }

    loadFeed().catch(() => setLoading(false));
  }, []);

  // Batch-pre-seed the like-state cache once we have both feed clips and
  // an authenticated user. Without this, every clip's useLike runs its
  // own Supabase round-trip on mount and the heart visibly animates from
  // unfilled → filled when the data lands. After this seeding, the cache
  // is hit on every useLike mount → no flicker.
  useEffect(() => {
    if (!user?.id || feedItems.length === 0) return;
    const allUploadIds: string[] = [];
    for (const item of feedItems) {
      if (item.type === "clip") allUploadIds.push(item.clip.id);
      else for (const shot of item.shots) allUploadIds.push(shot.id);
    }
    if (allUploadIds.length === 0) return;
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("Like")
        .select("uploadId")
        .eq("userId", user.id)
        .in("uploadId", allUploadIds);
      if (cancelled || !data) return;
      const liked = data.map(r => r.uploadId);
      seedLikedCache(user.id, liked, allUploadIds);
      // Also push into HomePage state so any clip cards that already
      // mounted (rendered before this fetch landed) re-render with
      // the correct initialLiked — useLike has a useEffect that listens
      // to initialLiked changes.
      setLikedIds(new Set(liked));
    })();
    return () => { cancelled = true; };
  }, [user?.id, feedItems]);

  // Prefetch the routes for the trending + near-me course tiles on the
  // discovery screen so that tapping one feels instant — Next.js fetches
  // the RSC payload + course route bundle in the background while the
  // user is still scrolling the home feed. Without this, every course
  // tile tap incurs a full network round-trip for the page payload.
  useEffect(() => {
    const ids = new Set<string>();
    for (const c of trendingCourses) ids.add(c.id);
    for (const c of nearMeCourses) ids.add(c.id);
    for (const id of ids) {
      if (prefetchedCoursesRef.current.has(id)) continue;
      prefetchedCoursesRef.current.add(id);
      router.prefetch(`/courses/${id}`);
    }
  }, [trendingCourses, nearMeCourses, router]);

  const handleFollow = useCallback(async (targetId: string) => {
    if (!user?.id) { router.push("/login"); return; }
    if (followingInProgress.has(targetId)) return;
    setFollowingInProgress(s => new Set(s).add(targetId));
    const supabase = createClient();
    if (followingIds.has(targetId)) {
      await supabase.from("Follow").delete().eq("followerId", user.id).eq("followingId", targetId);
      setFollowingIds(s => { const n = new Set(s); n.delete(targetId); return n; });
    } else {
      await supabase.from("Follow").insert({ followerId: user.id, followingId: targetId, status: "ACTIVE", createdAt: new Date().toISOString() });
      setFollowingIds(s => new Set(s).add(targetId));
    }
    setFollowingInProgress(s => { const n = new Set(s); n.delete(targetId); return n; });
  }, [user, followingIds, followingInProgress, router]);

  const handleScroll = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const feed = feedRef.current;
      if (!feed) return;
      // Slot 0 = discovery section; feed clips start at slot 1 → feedItems index 0
      const rawIndex = Math.round(feed.scrollTop / window.innerHeight);
      setActiveIndex(rawIndex - 1);
    }, 50);
  }, []);

  const loadMoreFeed = useCallback(async () => {
    if (!feedCursorRef.current || loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const currentUid = session?.user?.id ?? null;
    const { data: rawUploads } = await supabase
      .from("Upload")
      .select("id, mediaUrl, cloudflareVideoId, mediaType, courseId, holeId, strategyNote, clubUsed, windCondition, shotType, likeCount, commentCount, userId, seriesId, seriesOrder, yardageOverlay, datePlayedAt, createdAt")
      .eq("moderationStatus", "APPROVED")
      .order("createdAt", { ascending: false })
      .lt("createdAt", feedCursorRef.current)
      .limit(25);
    const uploads = (rawUploads || []).filter(u => !currentUid || u.userId !== currentUid);

    if (!uploads || uploads.length === 0) {
      hasMoreRef.current = false;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }

    const courseIds = [...new Set(uploads.map((u: any) => u.courseId))];
    const userIds = [...new Set(uploads.map((u: any) => u.userId))];
    const holeIds = [...new Set(uploads.map((u: any) => u.holeId).filter(Boolean))];

    const [{ data: courses }, { data: users }, { data: holes }, { data: progressions }] = await Promise.all([
      supabase.from("Course").select("id, name, logoUrl, city, state").in("id", courseIds),
      supabase.from("User").select("id, username, avatarUrl, handicapIndex").in("id", userIds),
      supabase.from("Hole").select("id, holeNumber, par, yardage").in("id", holeIds),
      supabase.from("UserProgression").select("userId, rank").in("userId", userIds),
    ]);

    const rankMap: Record<string, string> = {};
    progressions?.forEach((p: any) => { rankMap[p.userId] = p.rank; });

    const enriched: FeedClip[] = uploads.map((u: any) => {
      const hole = holes?.find((h: any) => h.id === u.holeId);
      const user = users?.find((usr: any) => usr.id === u.userId);
      const course = courses?.find((c: any) => c.id === u.courseId);
      return {
        ...u,
        commentCount: u.commentCount || 0,
        courseName: course?.name || "Unknown Course",
        courseLogoUrl: course?.logoUrl || null,
        courseCity: course?.city || null,
        courseState: course?.state || null,
        username: user?.username || "golfer",
        avatarUrl: user?.avatarUrl || null,
        uploaderHandicap: user?.handicapIndex ?? null,
        rank: rankMap[u.userId] || null,
        holeNumber: hole?.holeNumber || undefined,
        holePar: hole?.par ?? null,
        holeYardage: hole?.yardage ?? null,
      };
    });

    const seriesMap: Record<string, FeedClip[]> = {};
    const singleClips: FeedClip[] = [];
    enriched.forEach(clip => {
      if (clip.seriesId) {
        if (!seriesMap[clip.seriesId]) seriesMap[clip.seriesId] = [];
        seriesMap[clip.seriesId].push(clip);
      } else {
        singleClips.push(clip);
      }
    });

    const newItems: FeedItem[] = [
      ...Object.entries(seriesMap).map(([seriesId, shots]) => {
        const sorted = shots.sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0));
        const first = sorted[0];
        return { type: "series" as const, seriesId, shots: sorted, courseName: first.courseName, courseLogoUrl: first.courseLogoUrl, courseId: first.courseId, holeId: first.holeId, holeNumber: first.holeNumber, username: first.username, avatarUrl: first.avatarUrl, userId: first.userId };
      }),
      ...singleClips.map(clip => ({ type: "clip" as const, clip })),
    ];

    setFeedItems(prev => [...prev, ...newItems]);
    feedCursorRef.current = rawUploads![rawUploads!.length - 1].createdAt;
    hasMoreRef.current = rawUploads!.length >= 25;
    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    if (feedItems.length === 0) return;
    if (activeIndex >= feedItems.length - 3) loadMoreFeed();
  }, [activeIndex, feedItems.length, loadMoreFeed]);

  useEffect(() => {
    const today = new Date().toDateString();
    const lastSplash = localStorage.getItem("tour-it-splash-date");
    if (lastSplash !== today) {
      localStorage.setItem("tour-it-splash-date", today);
      setSplashVisible(true);
      const fadeTimer = setTimeout(() => setSplashFading(true), 2000);
      const hideTimer = setTimeout(() => setSplashVisible(false), 2600);
      setTimeout(() => { clearTimeout(fadeTimer); clearTimeout(hideTimer); }, 2700);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("tour-it-onboarded")) setShowOnboarding(true);

    // Check for ?welcome=1 from post-signup onboarding redirect
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("welcome") === "1") {
        setShowWelcome(true);
        window.history.replaceState({}, "", "/");
      }
    }

    // Auto-load near me if previously granted (fresh cache only)
    try {
      const raw = localStorage.getItem("tour-it-location");
      if (raw) {
        const { ts } = JSON.parse(raw);
        if (Date.now() - ts < 3600000) fetchNearMe(); // only auto-call with fresh cache
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!commentUploadId) { setCommentItems([]); return; }
    setLoadingComments(true);
    const supabase = createClient();
    supabase
      .from("Comment")
      .select("id, body, createdAt, userId, user:User(username, avatarUrl, UserProgression(rank))")
      .eq("uploadId", commentUploadId)
      .order("createdAt", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setCommentItems(data.map((c: any) => ({
            id: c.id,
            body: c.body,
            createdAt: c.createdAt,
            username: c.user?.username || "golfer",
            avatarUrl: c.user?.avatarUrl || null,
            rank: (c.user?.UserProgression as any[])?.[0]?.rank || null,
          })));
        }
        setLoadingComments(false);
      });
  }, [commentUploadId]);

  function dismissOnboarding() {
    localStorage.setItem("tour-it-onboarded", "1");
    setShowOnboarding(false);
  }

  async function submitComment() {
    if (!commentText.trim() || !user || !commentUploadId || submittingComment) return;
    setSubmittingComment(true);
    const supabase = createClient();
    const id = crypto.randomUUID();
    const { error } = await supabase.from("Comment").insert({
      id,
      uploadId: commentUploadId,
      userId: user.id,
      body: commentText.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (!error) {
      const { data: uploadData } = await supabase.from("Upload").select("commentCount, likeCount, createdAt, userId").eq("id", commentUploadId).single();
      const newCommentCount = (uploadData?.commentCount || 0) + 1;
      const { computeRankScore } = await import("@/lib/rankScore");
      const newRank = uploadData ? computeRankScore(uploadData.likeCount || 0, newCommentCount, uploadData.createdAt) : undefined;
      await supabase.from("Upload").update({ commentCount: newCommentCount, ...(newRank !== undefined && { rankScore: newRank }) }).eq("id", commentUploadId);
      if (uploadData?.userId && uploadData.userId !== user.id) {
        fetch("/api/points/award", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "comment_received", recipientUserId: uploadData.userId, referenceId: commentUploadId }) }).catch(() => {});
      }
      setCommentItems(prev => [...prev, {
        id,
        body: commentText.trim(),
        createdAt: new Date().toISOString(),
        username: userProfile?.username || "golfer",
        avatarUrl: userProfile?.avatarUrl || null,
      }]);
      setFeedItems(prev => prev.map(item => {
        if (item.type === "clip" && item.clip.id === commentUploadId) {
          return { ...item, clip: { ...item.clip, commentCount: item.clip.commentCount + 1 } };
        }
        return item;
      }));
      setCommentText("");
    }
    setSubmittingComment(false);
  }

  function fetchNearMe(radiusOverride?: number, publicOnlyOverride?: boolean) {
    if (!navigator.geolocation) return;
    setLocationStatus("loading");
    const radius = radiusOverride ?? nearMeRadius;
    const onlyPublic = publicOnlyOverride ?? publicOnly;

    async function doFetch(lat: number, lng: number) {
      const MILES_PER_DEGREE = 69;
      const RANGE = radius / MILES_PER_DEGREE;
      let query = createClient()
        .from("Course")
        .select("id, name, city, state, uploadCount, coverImageUrl, logoUrl, isPublic")
        .gte("latitude", lat - RANGE).lte("latitude", lat + RANGE)
        .gte("longitude", lng - RANGE).lte("longitude", lng + RANGE);
      if (onlyPublic) query = query.eq("isPublic", true);
      const { data } = await query.order("uploadCount", { ascending: false }).limit(20);
      setNearMeCourses(data || []);
      setLocationStatus("granted");
    }

    // Use cached coords if fresh (< 1h) for instant display, but always refresh in background
    let usedCache = false;
    try {
      const raw = localStorage.getItem("tour-it-location");
      if (raw) {
        const { lat, lng, ts } = JSON.parse(raw);
        if (Date.now() - ts < 3600000) { doFetch(lat, lng); usedCache = true; }
      }
    } catch {}

    // Always request fresh location to keep coords current
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        localStorage.setItem("tour-it-location", JSON.stringify({ lat, lng, ts: Date.now() }));
        // If we didn't use cache, fetch now; if we did, silently update for next load
        if (!usedCache) doFetch(lat, lng);
      },
      () => {
        if (!usedCache) setLocationStatus("idle");
      }
    );
  }

  return (
    <main style={{ height: "100svh", background: "#07100a", overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        /* iOS paints the area behind the status bar / notch using the html (root)
           element's background, not the body. Both need the green + speckle so the
           TopBar visually extends to the very top of the screen. */
        html, body {
          background:
            radial-gradient(rgba(77,168,98,0.07) 1px, transparent 1px) 0 0 / 16px 16px,
            linear-gradient(180deg, #1c4425 0, #1c4425 env(safe-area-inset-top), #07100a env(safe-area-inset-top));
        }
        body { overflow: hidden; }
        @keyframes pulse-ring { 0%,100% { transform: scale(1); opacity: 0.18; } 50% { transform: scale(1.18); opacity: 0.07; } }
        .feed { height: 100svh; overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
        .feed::-webkit-scrollbar { display: none; }
        .feed-item { scroll-snap-align: start; scroll-snap-stop: always; }
        .courses-row { display: flex; gap: 12px; overflow-x: auto; scrollbar-width: none; padding: 0 20px 4px; }
        .courses-row::-webkit-scrollbar { display: none; }
        @keyframes splash-logo-in { 0% { opacity: 0; transform: scale(0.82); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes splash-tagline-in { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes splash-fade-out { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .splash-logo { animation: splash-logo-in 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .splash-tagline { animation: splash-tagline-in 0.5s ease forwards 0.5s; opacity: 0; }
        .splash-fade-out { animation: splash-fade-out 0.6s ease forwards; }
      `}</style>

      {/* ── Hamburger drawer ── */}
      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          {/* Backdrop */}
          <div onClick={() => setMenuOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
          {/* Panel */}
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "72vw", maxWidth: 300, background: "#07100a", borderRight: "1px solid rgba(77,168,98,0.18)", display: "flex", flexDirection: "column", paddingTop: 64, paddingBottom: 40 }}>
            {/* Close */}
            <button onClick={() => setMenuOpen(false)} style={{ position: "absolute", top: 18, right: 16, background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            {/* Logo mark + invite button */}
            <div style={{ paddingLeft: 24, paddingRight: 16, paddingBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 36, width: "auto" }} />
              <button onClick={() => { setMenuOpen(false); router.push("/invite"); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 99, padding: "7px 14px", cursor: "pointer" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#4da862" }}>Invite</span>
              </button>
            </div>

            {/* Nav items */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 12 }}>
              {[
                { label: "About Tour It", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>, onClick: () => { setMenuOpen(false); router.push("/about"); } },
                { label: "Leaderboard", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>, onClick: () => { setMenuOpen(false); router.push("/leaderboards"); } },
                { label: "My Trips", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>, onClick: () => { setMenuOpen(false); router.push("/trips"); } },
                { label: "App Feedback", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, onClick: () => { setMenuOpen(false); router.push("/feedback"); } },
                { label: "Privacy Policy", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, onClick: () => { setMenuOpen(false); router.push("/privacy"); } },
                { label: "Terms of Service", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, onClick: () => { setMenuOpen(false); router.push("/terms"); } },
                { label: "Contact Us", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, onClick: () => { setMenuOpen(false); window.location.href = "mailto:corey@touritgolf.com"; } },
              ].map(item => (
                <button key={item.label} onClick={item.onClick} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.82)", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 500, textAlign: "left", transition: "background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(77,168,98,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ color: "#4da862", flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>

            {/* Log out */}
            {user && (
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  router.push("/login");
                }}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", background: "none", border: "none", borderTop: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", color: "rgba(255,100,100,0.8)", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 500, width: "100%", textAlign: "left" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Log Out
              </button>
            )}
          </div>
        </div>
      )}

      <div
        ref={feedRef}
        className="feed"
        onScroll={handleScroll}
        style={{
          paddingLeft: isDesktop ? 72 : 0,
          // Logged-out users don't get the immersive snap behavior — discovery
          // grows past 100svh for them and snap-locking the scroll would fight
          // the natural scroll. Logged-in users keep the TikTok-style snap.
          ...(user === null ? { scrollSnapType: "none" } : {}),
        }}
      >

        {/* ── Discovery section ──
            Logged-in users get a fixed 100svh box (so the scroll-snap feed
            beneath snaps cleanly). Logged-out users have extra height from the
            Join nudge and can't interact with the immersive clip feed anyway,
            so we let this section grow and scroll like a normal page — no
            overlap, nothing clipped, no awkward TOUR THE FEED button. */}
        <div className="feed-item" style={user === null
          ? { minHeight: "100svh", background: "#07100a", display: "flex", flexDirection: "column", overflow: "visible", position: "relative" }
          : { height: "100svh", background: "#07100a", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }
        }>
          {/* Green header bar */}
          <div style={{ position: "relative", background: "linear-gradient(180deg, #1c4425 0%, #102916 100%)", borderBottom: "1px solid rgba(77,168,98,0.35)", flexShrink: 0 }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(77,168,98,0.07) 1px, transparent 1px)", backgroundSize: "16px 16px", pointerEvents: "none" }} />
            {/* 3-col row: hamburger | logo | bell */}
            <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", paddingTop: "calc(env(safe-area-inset-top) + 12px)", paddingBottom: 14, paddingLeft: 16, paddingRight: 16, position: "relative", zIndex: 1 }}>
              {/* Hamburger */}
              <button onClick={() => setMenuOpen(true)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: isDesktop ? "none" : "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer" }}>
                <span style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.85)", borderRadius: 99, display: "block" }} />
                <span style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.85)", borderRadius: 99, display: "block" }} />
                <span style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.85)", borderRadius: 99, display: "block" }} />
              </button>
              {/* Logo — centered on mobile, left-aligned on desktop */}
              <div style={{ display: "flex", justifyContent: isDesktop ? "flex-start" : "center" }}>
                <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: isDesktop ? 68 : 56, width: "auto" }} />
              </div>
              {/* Bell — right-aligned in third column */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <LeaderboardsButtonInline />
              </div>
            </div>
          </div>

          {/* May Competition banner — only renders in May 2026 */}
          <MayCompetitionBanner />

          {/* Hero text */}
          <div style={{ padding: "20px 20px 14px", flexShrink: 0 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 900, color: "#fff", lineHeight: 1.12 }}>
              Scout your next round
            </div>
          </div>

          {/* Search CTA */}
          <div style={{ padding: "0 20px 20px", flexShrink: 0 }}>
            <button
              onClick={() => router.push("/search")}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, background: "rgba(26,158,66,0.07)", border: "1.5px solid rgba(26,158,66,0.55)", borderRadius: 14, padding: "16px 18px", cursor: "pointer", boxShadow: "0 0 18px rgba(26,158,66,0.2), inset 0 0 10px rgba(26,158,66,0.04)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a9e42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "rgba(26,158,66,0.85)" }}>Find a course — name, city, or state</span>
            </button>
          </div>

          {/* Logged-out sign-up nudge */}
          {user === null && (
            <div style={{ padding: "0 20px 18px", flexShrink: 0 }}>
              <button
                onClick={() => router.push("/signup")}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(26,158,66,0.07)", border: "1px solid rgba(26,158,66,0.22)", borderRadius: 12, padding: "12px 16px", cursor: "pointer" }}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>Save courses. Upload clips. Scout smarter.</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Takes 30 seconds</div>
                </div>
                <div style={{ background: "#2d7a42", borderRadius: 8, padding: "7px 14px", flexShrink: 0, marginLeft: 12 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#fff" }}>Join</span>
                </div>
              </button>
            </div>
          )}

          {/* Popular courses — dedupe against near me. Active featured
              tournament (e.g. PGA Championship at Aronimink) keeps its spot
              even when it would dedupe against the near-me row, and is shown
              first with a gold-framed treatment. */}
          {(() => {
            const featured = activeFeaturedTournament();
            const nearMeIds = new Set(nearMeCourses.map(c => c.id));
            const deduped = trendingCourses.filter(c => !nearMeIds.has(c.id) || c.id === featured?.courseId);
            return (
              <div style={{ flexShrink: 0 }}>
                <div style={{ padding: "0 20px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>
                  Popular on Tour It
                </div>
                <div className="courses-row">
                  {deduped.length > 0 ? deduped.map(course => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      onClick={() => router.push(`/courses/${course.id}`)}
                      compact
                      featured={featured && course.id === featured.courseId ? featured : null}
                    />
                  )) : [1, 2, 3].map(i => (
                    <div key={i} style={{ width: 148, height: 174, borderRadius: 14, flexShrink: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }} />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Courses Near Me */}
          {locationStatus !== "denied" && (
            <div style={{ flexShrink: 0, marginTop: 10 }}>
              <div style={{ padding: "0 20px 10px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", flexShrink: 0 }}>
                  Courses Near Me
                </div>
                <button onClick={() => router.push("/map")} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(26,158,66,0.18)", border: "1px solid rgba(26,158,66,0.45)", borderRadius: 99, padding: "3px 9px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3,11 3,20 9,17 15,20 21,17 21,8 15,11 9,8"/><line x1="9" y1="8" x2="9" y2="17"/><line x1="15" y1="11" x2="15" y2="20"/></svg>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "#4da862" }}>Map</span>
                </button>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap", flexShrink: 0 }}>
                  {locationStatus === "granted" && [10, 25, 50].map(r => (
                    <button key={r} onClick={() => { setNearMeRadius(r); fetchNearMe(r); }} style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: nearMeRadius === r ? "#fff" : "rgba(255,255,255,0.35)", background: nearMeRadius === r ? "rgba(26,158,66,0.22)" : "transparent", border: `1px solid ${nearMeRadius === r ? "rgba(26,158,66,0.45)" : "rgba(255,255,255,0.08)"}`, borderRadius: 99, padding: "3px 9px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      {r}mi
                    </button>
                  ))}
                  {locationStatus === "idle" && (
                    <button onClick={() => fetchNearMe()} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(26,158,66,0.1)", border: "1px solid rgba(26,158,66,0.25)", borderRadius: 99, padding: "4px 12px", cursor: "pointer" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1a9e42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "#1a9e42" }}>Enable</span>
                    </button>
                  )}
                </div>
              </div>
              {locationStatus === "idle" && (
                <div style={{ padding: "0 20px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.2)", lineHeight: 1.5 }}>
                  Tap Enable to find courses within {nearMeRadius} miles of you.
                </div>
              )}
              {locationStatus === "loading" && (
                <div className="courses-row">
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ width: 148, height: 174, borderRadius: 14, flexShrink: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }} />
                  ))}
                </div>
              )}
              {locationStatus === "granted" && nearMeCourses.length > 0 && (
                <div className="courses-row">
                  {nearMeCourses.map(course => (
                    <CourseCard key={course.id} course={course} onClick={() => router.push(`/courses/${course.id}`)} compact />
                  ))}
                </div>
              )}
              {locationStatus === "granted" && nearMeCourses.length === 0 && (
                <div style={{ padding: "0 20px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
                  No courses found within {nearMeRadius} miles.
                </div>
              )}
            </div>
          )}

          {/* Bridge to feed — only shown to signed-in users. The discovery
              section is already cramped for logged-out viewers (extra Join
              nudge at top), and the immersive clip feed below requires login
              for liking/saving/commenting anyway. The scroll-down hint
              previously overlapped the courses-near-me row on smaller phones. */}
          {showScrollHint && user !== null && (
            <button
              onClick={() => feedRef.current?.scrollBy({ top: window.innerHeight, behavior: "smooth" })}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingBottom: 92, paddingTop: 14, background: "linear-gradient(to top, rgba(7,16,10,0.95) 0%, transparent 100%)", border: "none", cursor: "pointer", gap: 8, zIndex: 5 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.92)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: "2.8px", textTransform: "uppercase", color: "rgba(255,255,255,0.72)" }}>
                Tour the feed
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.92)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          )}

        </div>

        {/* ── Feed loading skeleton ── */}
        {loading && (
          <div className="feed-item" style={{ height: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "#07100a" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2.5px solid rgba(77,168,98,0.25)", borderTopColor: "#4da862", animation: "spin 0.9s linear infinite" }} />
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Loading clips…</span>
          </div>
        )}

        {/* ── Feed clips ── */}
        {!loading && feedItems.map((item, i) => (
          <div key={item.type === "clip" ? item.clip.id : item.seriesId} className="feed-item">
            {item.type === "series" ? (
              <SeriesCard item={item} isActive={i === activeIndex} onTapUser={() => router.push(`/profile/${item.userId}`)} onTapCourse={() => router.push(`/courses/${item.courseId}`)} onComment={() => setCommentUploadId(item.shots[0]?.id || null)} currentUserId={user?.id} followingIds={followingIds} onFollow={handleFollow} likedIds={likedIds} />
            ) : (
              <VideoCard clip={item.clip} isActive={i === activeIndex} onTapUser={() => router.push(`/profile/${item.clip.userId}`)} onTapCourse={() => router.push(`/courses/${item.clip.courseId}`)} onComment={() => setCommentUploadId(item.clip.id)} onEnded={() => feedRef.current?.scrollBy({ top: window.innerHeight, behavior: "smooth" })} onReport={user && item.clip.userId !== user.id ? () => setReportClipId(item.clip.id) : undefined} onEdit={user && item.clip.userId === user.id ? () => setEditClipInfo({ id: item.clip.id, courseId: item.clip.courseId, holeId: item.clip.holeId ?? null, holeNumber: item.clip.holeNumber ?? null }) : undefined} currentUserId={user?.id} followingIds={followingIds} onFollow={handleFollow} likedIds={likedIds} />
            )}
          </div>
        ))}

        {!loading && feedItems.length === 0 && (
          <div className="feed-item" style={{ height: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 32, textAlign: "center" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(26,158,66,0.08)", border: "1px solid rgba(26,158,66,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg>
            </div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>Be the first to scout</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1.6, maxWidth: 260 }}>No clips yet. Upload hole footage and help golfers scout before they play.</div>
            </div>
            {user && <button onClick={() => router.push("/upload")} style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px 32px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>Upload a clip</button>}
            {!user && <a href="/signup" style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px 32px", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "'Outfit', sans-serif" }}>Join Tour It</a>}
          </div>
        )}
      </div>

      {loadingMore && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", zIndex: 30, background: "rgba(0,0,0,0.6)", borderRadius: 99, padding: "6px 16px", backdropFilter: "blur(8px)" }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Loading more...</span>
        </div>
      )}

      {/* Comment sheet */}
      {commentUploadId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150 }} onClick={() => { setCommentUploadId(null); setCommentText(""); }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", maxHeight: "72vh", display: "flex", flexDirection: "column" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "12px auto 8px" }} />
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", textAlign: "center", paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Comments</div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {loadingComments ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, padding: "24px 0" }}>Loading...</div>
              ) : commentItems.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13, padding: "32px 0", lineHeight: 1.6 }}>No comments yet.<br />Be the first to say something!</div>
              ) : commentItems.map(c => (
                <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <div className={isLegend(c.rank) ? "legend-ring" : undefined} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(26,158,66,0.2)", border: getRankRingBorder(c.rank), overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {c.avatarUrl ? <img src={c.avatarUrl} alt={c.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: getRankColor(c.rank) }}>@{c.username} </span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.82)" }}>{c.body}</span>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>{formatTimeAgo(c.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 16px 36px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {!user && (
                <div style={{ textAlign: "center", padding: "8px 0 10px" }}>
                  <a href="/login" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#4da862", fontWeight: 500 }}>Sign in to leave a comment</a>
                </div>
              )}
              {user && (
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a comment..." style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }} onKeyDown={e => { if (e.key === "Enter" && commentText.trim()) submitComment(); }} />
                  <button onClick={submitComment} disabled={!commentText.trim() || submittingComment} style={{ background: "#2d7a42", border: "none", borderRadius: 10, padding: "10px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: !commentText.trim() ? 0.4 : 1 }}>
                    {submittingComment ? "..." : "Post"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Welcome moment — shown after signup/onboarding */}
      {showWelcome && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowWelcome(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "24px 24px 0 0", padding: "28px 24px 52px" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, margin: "0 auto 24px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 10 }}>
              You&apos;re in. Welcome to Tour It.
            </div>
            <div style={{ background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>You earned <strong style={{ color: "#4da862" }}>50 points</strong> for signing up. Keep going.</span>
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 28 }}>
              Every course on here gets better when golfers who&apos;ve played it contribute. Start by uploading a clip from a course you know.
            </div>
            <button
              onClick={() => { setShowWelcome(false); router.push("/search"); }}
              style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 14, padding: "16px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff", cursor: "pointer", boxShadow: "0 2px 16px rgba(45,122,66,0.4)", marginBottom: 12 }}
            >
              Find my home course
            </button>
            <button
              onClick={() => setShowWelcome(false)}
              style={{ width: "100%", background: "none", border: "none", padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", cursor: "pointer" }}
            >
              Explore first
            </button>
          </div>
        </div>
      )}

      {/* Onboarding */}
      {showOnboarding && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "24px 24px 0 0", padding: "28px 24px", paddingBottom: "max(96px, calc(env(safe-area-inset-bottom) + 96px))" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 40, width: "auto", maxWidth: "80%" }} />
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", marginTop: 14, marginBottom: 8 }}>Welcome to Tour It</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>Scout any golf course before you play — real clips from golfers who&apos;ve already been there.</div>
            </div>
            {[
              { icon: "🎥", title: "Watch hole-by-hole clips", desc: "See tee shots, approaches, and putts from real rounds" },
              { icon: "📌", title: "Save courses to your list", desc: "Build your bucket list and track rounds you've played" },
              { icon: "⛳", title: "Upload your own footage", desc: "Help other golfers by sharing your course knowledge" },
            ].map(f => (
              <div key={f.title} style={{ display: "flex", gap: 14, marginBottom: 18, alignItems: "flex-start" }}>
                <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1.2 }}>{f.icon}</span>
                <div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
            {!user ? (
              <>
                <button onClick={() => router.push("/signup")} style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 14, padding: "16px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff", cursor: "pointer", marginTop: 8, boxShadow: "0 2px 16px rgba(45,122,66,0.4)" }}>
                  Create an account
                </button>
                <button onClick={dismissOnboarding} style={{ width: "100%", background: "none", border: "none", padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)", cursor: "pointer", marginTop: 4 }}>
                  Browse without an account
                </button>
                <div style={{ textAlign: "center", marginTop: 2 }}>
                  <button onClick={() => router.push("/login")} style={{ background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(26,158,66,0.7)", cursor: "pointer", textDecoration: "underline" }}>
                    Already have an account? Sign in
                  </button>
                </div>
              </>
            ) : (
              <button onClick={dismissOnboarding} style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 14, padding: "16px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff", cursor: "pointer", marginTop: 8, boxShadow: "0 2px 16px rgba(45,122,66,0.4)" }}>
                Start Scouting
              </button>
            )}
          </div>
        </div>
      )}

      <BottomNav />

      {/* Report clip sheet */}
      {reportClipId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", zIndex: 150 }} onClick={() => { setReportClipId(null); setReportReason(null); setReportDone(false); }}>
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
                    if (!rateLimit(`report:${user.id}`, 5, 60000)) { setReportDone(true); setTimeout(() => { setReportClipId(null); setReportReason(null); setReportDone(false); }, 1800); return; }
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
      {editClipInfo && (
        <EditClipSheet
          uploadId={editClipInfo.id}
          courseId={editClipInfo.courseId}
          currentHoleId={editClipInfo.holeId}
          currentHoleNumber={editClipInfo.holeNumber}
          currentUserId={user?.id ?? null}
          onClose={() => setEditClipInfo(null)}
          onSaved={(updated) => {
            setFeedItems(prev => prev.map(item => {
              if (item.type === "clip" && item.clip.id === editClipInfo.id) {
                return { ...item, clip: { ...item.clip, holeNumber: updated.holeNumber ?? item.clip.holeNumber, holeId: updated.holeId ?? item.clip.holeId, shotType: updated.shotType, clubUsed: updated.clubUsed, windCondition: updated.windCondition, strategyNote: updated.strategyNote } };
              }
              return item;
            }));
            setEditClipInfo(null);
          }}
        />
      )}

      {/* ── Splash screen ── */}
      {splashVisible && (
        <div className={splashFading ? "splash-fade-out" : ""} style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "#07100a",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 10,
        }}>
          <div className="splash-logo">
            <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 90, width: "auto", maxWidth: "82vw" }} />
          </div>
          <div className="splash-tagline" style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 400,
            color: "rgba(255,255,255,0.45)", letterSpacing: "0.05em",
          }}>
            See the shots before you play them.
          </div>
        </div>
      )}
    </main>
  );
}
