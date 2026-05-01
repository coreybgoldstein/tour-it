"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLike } from "@/hooks/useLike";
import BottomNav from "@/components/BottomNav";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { ClipTopPill } from "@/components/clip/ClipTopPill";
import { HoleSideBar } from "@/components/clip/HoleSideBar";
import { HoleIdentityCard } from "@/components/clip/HoleIdentityCard";
import { IntelPanel } from "@/components/clip/IntelPanel";
import { sessionMute } from "@/lib/sessionMute";
import { formatClipDate } from "@/lib/formatClipDate";
import { HlsVideo } from "@/components/HlsVideo";
import { getVideoSrc } from "@/lib/getVideoSrc";
import { getRankColor, getRankRingBorder, isLegend } from "@/lib/rank-styles";
function FlagBadge({ label }: { label: string | number }) {
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

type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
  logoUrl: string | null;
};

type Hole = {
  id: string;
  holeNumber: number;
  par: number;
  handicap: number | null;
  uploadCount: number;
  yardage?: number | null;
};

type Upload = {
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
  userId: string;
  createdAt: string;
  seriesId: string | null;
  seriesOrder: number | null;
  yardageOverlay: string | null;
  likeCount: number;
  commentCount: number;
};

type CommentItem = {
  id: string;
  body: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
  rank?: string | null;
};

type Series = {
  seriesId: string;
  shots: Upload[];
  username: string;
  avatarUrl: string | null;
};

const SHOT_LABEL: Record<string, string> = {
  TEE_SHOT: "Tee Shot", APPROACH: "Approach", LAY_UP: "Layup",
  CHIP: "Chip", PITCH: "Pitch", PUTT: "Putt",
  BUNKER: "Bunker", FULL_HOLE: "Full Hole", RECOVERY: "Recovery",
};

// Horizontal swipe player for a series
function SeriesPlayer({ series, onClose }: { series: Series; onClose: () => void }) {
  const [shotIndex, setShotIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const touchStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();

  const activeShot = series.shots[shotIndex];

  useEffect(() => {
    // Play active, pause others
    series.shots.forEach((shot, i) => {
      const el = videoRefs.current[shot.id];
      if (!el) return;
      if (i === shotIndex) {
        el.currentTime = 0;
        el.play().catch(() => {});
      } else {
        el.pause();
        el.currentTime = 0;
      }
    });
  }, [shotIndex, series.shots]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 50 && shotIndex < series.shots.length - 1) {
      setShotIndex(prev => prev + 1);
    } else if (delta < -50 && shotIndex > 0) {
      setShotIndex(prev => prev - 1);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, left: isDesktop ? 72 : 0, background: "#000", zIndex: 200 }}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Render all shots, show only active */}
      {series.shots.map((shot, i) => (
        <div key={shot.id} style={{ position: "absolute", inset: 0, opacity: i === shotIndex ? 1 : 0, transition: "opacity 0.2s", pointerEvents: i === shotIndex ? "auto" : "none" }}>
          {shot.mediaType === "VIDEO" ? (
            <HlsVideo
              ref={el => { videoRefs.current[shot.id] = el as HTMLVideoElement | null; }}
              src={getVideoSrc(shot.mediaUrl, shot.cloudflareVideoId)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loop
              playsInline
              muted={muted}
            />
          ) : (
            <img src={shot.mediaUrl} alt="shot" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </div>
      ))}

      {/* Gradients */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.85) 100%)", pointerEvents: "none", zIndex: 5 }} />

      {/* Top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "36px 16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>

        {/* Series title */}
        <div style={{ background: "rgba(180,145,60,0.2)", border: "1px solid rgba(180,145,60,0.4)", borderRadius: 99, padding: "5px 14px" }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#c8a96e" }}>Play a Hole With Me</span>
        </div>

        <button onClick={() => setMuted(m => !m)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          {muted
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          }
        </button>
      </div>

      {/* Shot progress dots */}
      <div style={{ position: "absolute", top: 110, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, zIndex: 10 }}>
        {series.shots.map((_, i) => (
          <div
            key={i}
            onClick={() => setShotIndex(i)}
            style={{ height: 3, borderRadius: 99, background: i === shotIndex ? "#c8a96e" : "rgba(255,255,255,0.3)", width: i === shotIndex ? 24 : 8, transition: "all 0.3s", cursor: "pointer" }}
          />
        ))}
      </div>

      {/* Yardage overlay */}
      {activeShot?.yardageOverlay && (
        <div style={{ position: "absolute", top: "50%", left: 16, transform: "translateY(-50%)", zIndex: 10 }}>
          <div style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px", backdropFilter: "blur(8px)" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{activeShot.yardageOverlay} <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.6)" }}>yds</span></div>
          </div>
        </div>
      )}

      {/* Left/right nav arrows */}
      {shotIndex > 0 && (
        <button onClick={() => setShotIndex(i => i - 1)} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      )}
      {shotIndex < series.shots.length - 1 && (
        <button onClick={() => setShotIndex(i => i + 1)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      )}

      {/* Bottom shot info */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 16px 40px", zIndex: 10 }}>
        {/* Uploader */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.3)", background: "rgba(26,158,66,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {series.avatarUrl
              ? <img src={series.avatarUrl} alt={series.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
          </div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.6)" }}>@{series.username}</span>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>· Shot {shotIndex + 1} of {series.shots.length}</span>
        </div>

        {/* Shot type + club */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {activeShot?.shotType && (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#c8a96e", background: "rgba(180,145,60,0.15)", border: "1px solid rgba(180,145,60,0.3)", borderRadius: 99, padding: "3px 10px" }}>
              {SHOT_LABEL[activeShot.shotType] || activeShot.shotType}
            </span>
          )}
          {activeShot?.clubUsed && (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99, padding: "3px 10px" }}>
              {activeShot.clubUsed}
            </span>
          )}
        </div>

        {/* Notes */}
        {(activeShot?.strategyNote || activeShot?.landingZoneNote || activeShot?.whatCameraDoesntShow) && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
            {[activeShot.strategyNote, activeShot.landingZoneNote, activeShot.whatCameraDoesntShow].filter(Boolean).join(" · ")}
          </div>
        )}

        {/* Swipe hint */}
        {shotIndex === 0 && series.shots.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10, opacity: 0.5 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1 }}>SWIPE FOR NEXT SHOT</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ClipActions({ upload }: { upload: Upload }) {
  const { liked, likeCount, toggleLike } = useLike({
    uploadId: upload.id,
    initialLikeCount: upload.likeCount || 0,
  });
  return (
    <button className="action-btn" onClick={toggleLike}>
      <div className="action-icon" style={liked ? { borderColor: "rgba(26,158,66,0.7)", background: "rgba(26,158,66,0.15)" } : {}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? "#1a9e42" : "none"} stroke={liked ? "#1a9e42" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </div>
      <span className="action-label">{likeCount}</span>
    </button>
  );
}

export default function HolePage() {
  const { id, number } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();
  const [course, setCourse] = useState<Course | null>(null);
  const [hole, setHole] = useState<Hole | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [activeSeries, setActiveSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [intelOpen, setIntelOpen] = useState(false);
  const [muted, setMuted] = useState(sessionMute.get());
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [reportClipId, setReportClipId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [commentUploadId, setCommentUploadId] = useState<string | null>(null);
  const [commentItems, setCommentItems] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  // All holes with upload counts — used to skip empty holes on swipe
  const [holeList, setHoleList] = useState<{holeNumber: number; uploadCount: number}[]>([]);
  const [endOfContent, setEndOfContent] = useState<"prev" | "next" | null>(null);
  const [uploaders, setUploaders] = useState<Record<string, {username: string; avatarUrl: string | null; handicapIndex?: number | null; rank?: string | null}>>({});
  const [videoPaused, setVideoPaused] = useState(false);
  const endOfContentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);

  // Decode multi-hole keys like "front-9", "back-9", "full-18", "3-hole-1-3"
  const MULTI_SHOT_MAP: Record<string, { label: string; shotType: string; group?: string }> = {
    "front-9":  { label: "Front 9",   shotType: "FRONT_NINE" },
    "back-9":   { label: "Back 9",    shotType: "BACK_NINE" },
    "full-18":  { label: "Full 18",   shotType: "FULL_ROUND" },
    ...["1-3","4-6","7-9","10-12","13-15","16-18"].reduce((acc, g) => ({
      ...acc,
      [`3-hole-${g}`]: { label: `Holes ${g.replace("-","–")}`, shotType: "THREE_HOLE", group: g.replace("-","–") },
    }), {} as Record<string, { label: string; shotType: string; group?: string }>),
  };
  const multiHoleKey = MULTI_SHOT_MAP[number as string];

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // Load hole list (uploadCounts) for smart navigation — skip empty holes
  useEffect(() => {
    if (!id || multiHoleKey) return;
    createClient()
      .from("Hole")
      .select("holeNumber, uploadCount")
      .eq("courseId", id)
      .order("holeNumber")
      .then(({ data }) => { if (data) setHoleList(data); });
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
          username: c.User?.username || "golfer",
          avatarUrl: c.User?.avatarUrl || null,
          rank: (c.User?.UserProgression as any[])?.[0]?.rank || null,
        })));
        setLoadingComments(false);
      });
  }, [commentUploadId]);

  async function submitComment() {
    if (!commentText.trim() || !user || !commentUploadId || submittingComment) return;
    setSubmittingComment(true);
    const supabase = createClient();
    const { error } = await supabase.from("Comment").insert({
      userId: user.id, uploadId: commentUploadId, body: commentText.trim(),
    });
    if (!error) {
      const { data: uploadData } = await supabase.from("Upload").select("commentCount").eq("id", commentUploadId).single();
      await supabase.from("Upload").update({ commentCount: (uploadData?.commentCount || 0) + 1 }).eq("id", commentUploadId);
      setCommentItems(prev => [...prev, {
        id: Date.now().toString(), body: commentText.trim(), createdAt: new Date().toISOString(),
        username: user.user_metadata?.username || "you", avatarUrl: null,
      }]);
      setUploads(prev => prev.map(u => u.id === commentUploadId ? { ...u, commentCount: (u.commentCount || 0) + 1 } : u));
      setCommentText("");
    }
    setSubmittingComment(false);
  }

  useEffect(() => {
    if (!id || !number) return;
    const supabase = createClient();

    if (multiHoleKey) {
      // Multi-hole content — no hole lookup needed
      supabase.from("Course").select("id, name, city, state, logoUrl").eq("id", id).single()
        .then(({ data }) => { if (data) setCourse(data); });

      let query = supabase.from("Upload").select("*")
        .eq("courseId", id)
        .eq("shotType", multiHoleKey.shotType)
        .eq("moderationStatus", "APPROVED")
        .order("rankScore", { ascending: false });
      if (multiHoleKey.group) query = query.eq("yardageOverlay", multiHoleKey.group);
      query.then(async ({ data: uploadsData }) => {
        if (uploadsData) {
          const filtered = uploadsData.filter((u: Upload) => !u.seriesId);
          setUploads(filtered);
          if (filtered.length > 0) {
            const userIds = [...new Set(filtered.map((u: Upload) => u.userId))];
            const [{ data: users }, { data: progs }] = await Promise.all([
              supabase.from("User").select("id, username, avatarUrl, handicapIndex").in("id", userIds as string[]),
              supabase.from("UserProgression").select("userId, rank").in("userId", userIds as string[]),
            ]);
            if (users) {
              const rankMap: Record<string, string> = {};
              progs?.forEach((p: any) => { rankMap[p.userId] = p.rank; });
              const map: Record<string, {username: string; avatarUrl: string | null; handicapIndex?: number | null; rank?: string | null}> = {};
              users.forEach((u: any) => { map[u.id] = { username: u.username, avatarUrl: u.avatarUrl, handicapIndex: u.handicapIndex ?? null, rank: rankMap[u.id] || null }; });
              setUploaders(map);
            }
          }
        }
        setLoading(false);
      });
      return;
    }

    Promise.all([
      supabase.from("Course").select("id, name, city, state, logoUrl").eq("id", id).single(),
      supabase.from("Hole").select("*").eq("courseId", id).eq("holeNumber", Number(number)).single(),
    ]).then(async ([courseRes, holeRes]) => {
      if (courseRes.data) setCourse(courseRes.data);
      if (holeRes.data) setHole(holeRes.data);

      if (holeRes.data?.id) {
        const { data: uploadsData } = await supabase
          .from("Upload")
          .select("*")
          .eq("holeId", holeRes.data.id)
          .eq("moderationStatus", "APPROVED")
          .order("rankScore", { ascending: false });

        if (uploadsData) {
          // Separate series from single clips
          const singleClips = uploadsData.filter((u: Upload) => !u.seriesId);
          const seriesClips = uploadsData.filter((u: Upload) => u.seriesId);

          setUploads(singleClips);

          // Fetch uploader info for single clips
          if (singleClips.length > 0) {
            const userIds = [...new Set(singleClips.map((u: Upload) => u.userId))];
            const [{ data: users }, { data: progs }] = await Promise.all([
              supabase.from("User").select("id, username, avatarUrl, handicapIndex").in("id", userIds as string[]),
              supabase.from("UserProgression").select("userId, rank").in("userId", userIds as string[]),
            ]);
            if (users) {
              const rankMap: Record<string, string> = {};
              progs?.forEach((p: any) => { rankMap[p.userId] = p.rank; });
              const map: Record<string, {username: string; avatarUrl: string | null; handicapIndex?: number | null; rank?: string | null}> = {};
              users.forEach((u: any) => { map[u.id] = { username: u.username, avatarUrl: u.avatarUrl, handicapIndex: u.handicapIndex ?? null, rank: rankMap[u.id] || null }; });
              setUploaders(map);
            }
          }

          // Group series clips by seriesId
          const seriesMap: Record<string, Upload[]> = {};
          seriesClips.forEach((clip: Upload) => {
            if (!clip.seriesId) return;
            if (!seriesMap[clip.seriesId]) seriesMap[clip.seriesId] = [];
            seriesMap[clip.seriesId].push(clip);
          });

          // Sort each series by seriesOrder
          const seriesGroups = Object.entries(seriesMap).map(([seriesId, shots]) => ({
            seriesId,
            shots: shots.sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0)),
            username: "golfer",
            avatarUrl: null,
          }));

          // Fetch usernames for series
          if (seriesGroups.length > 0) {
            const userIds = [...new Set(seriesGroups.map(s => s.shots[0]?.userId).filter(Boolean))];
            const [{ data: users }, { data: progs }] = await Promise.all([
              supabase.from("User").select("id, username, avatarUrl, handicapIndex").in("id", userIds),
              supabase.from("UserProgression").select("userId, rank").in("userId", userIds),
            ]);
            const rankMap: Record<string, string> = {};
            progs?.forEach((p: any) => { rankMap[p.userId] = p.rank; });
            const enriched = seriesGroups.map(sg => ({
              ...sg,
              username: users?.find((u: any) => u.id === sg.shots[0]?.userId)?.username || "golfer",
              avatarUrl: users?.find((u: any) => u.id === sg.shots[0]?.userId)?.avatarUrl || null,
            }));
            setSeries(enriched);
            // Also enrich uploaders map with series user rank data
            if (users) {
              const seriesMap: Record<string, {username: string; avatarUrl: string | null; rank?: string | null}> = {};
              users.forEach((u: any) => { seriesMap[u.id] = { username: u.username, avatarUrl: u.avatarUrl, rank: rankMap[u.id] || null }; });
              setUploaders(prev => ({ ...prev, ...seriesMap }));
            }
          }
        }
      }

      setLoading(false);
    });
  }, [id, number]);

  // Jump to linked clip when ?clip= param is present
  useEffect(() => {
    if (!uploads.length) return;
    const clipId = searchParams.get("clip");
    if (!clipId) return;
    const idx = uploads.findIndex(u => u.id === clipId);
    if (idx > 0) setActiveIndex(idx);
  }, [uploads]);

  // Manage video playback for single clips
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([clipId, videoEl]) => {
      if (!videoEl) return;
      const clipIndex = uploads.findIndex(u => u.id === clipId);
      if (clipIndex === activeIndex) {
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
        videoEl.currentTime = 0;
      }
    });
    setIntelOpen(false);
  }, [activeIndex, uploads]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    const deltaX = touchStartX.current - e.changedTouches[0].clientX;

    // Horizontal swipe (left/right) — navigate between holes
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50 && !multiHoleKey) {
      const holeNum = Number(number);
      const dir = deltaX > 0 ? "next" : "prev";
      const candidates = dir === "next"
        ? holeList.filter(h => h.holeNumber > holeNum).sort((a, b) => a.holeNumber - b.holeNumber)
        : holeList.filter(h => h.holeNumber < holeNum).sort((a, b) => b.holeNumber - a.holeNumber);
      const next = candidates.find(h => h.uploadCount > 0);
      if (next) {
        router.push(`/courses/${id}/holes/${next.holeNumber}`);
      } else {
        // No more holes with content — show end-of-content indicator briefly
        if (endOfContentTimer.current) clearTimeout(endOfContentTimer.current);
        setEndOfContent(dir);
        endOfContentTimer.current = setTimeout(() => setEndOfContent(null), 2000);
      }
      return;
    }

    // Vertical swipe — scroll through clips for this hole
    if (deltaY > 50 && activeIndex < uploads.length - 1) {
      setActiveIndex(prev => prev + 1);
    } else if (deltaY < -50 && activeIndex > 0) {
      setActiveIndex(prev => prev - 1);
    }
  };

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Loading...</div>
      </main>
    );
  }

  const handleShare = async () => {
    const activeClipId = uploads[activeIndex]?.id;
    const base = `${window.location.origin}/courses/${id}/holes/${number}`;
    const url = activeClipId ? `${base}?clip=${activeClipId}` : base;
    const shareText = `Tour It — ${course?.name} — ${pageTitle}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: shareText, text: shareText, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  const holeNum = multiHoleKey ? null : Number(number);
  const par = hole?.par || 4;
  const pageTitle = multiHoleKey ? multiHoleKey.label : holeNum ? `Hole ${holeNum}` : "";
  const hasContent = uploads.length > 0 || series.length > 0;
  const courseAbbr = course?.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase() || "?";

  if (!hasContent) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff", display: "flex", flexDirection: "column" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap'); *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff" }}>{course?.name} — {pageTitle}</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg>
          </div>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 8 }}>No clips yet</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)", lineHeight: 1.6, marginBottom: 28 }}>Be the first to upload intel<br/>for {course?.name} — {pageTitle}</p>
          <button onClick={() => router.push(`/upload?courseId=${id}${holeNum ? `&holeNumber=${holeNum}` : ""}`)} style={{ background: "#2d7a42", border: "none", borderRadius: 14, padding: "14px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Upload a clip</button>
        </div>
      </main>
    );
  }

  const activeUpload = uploads[activeIndex];
  const uploader = activeUpload ? uploaders[activeUpload.userId] : null;
  const hasIntel = activeUpload && (activeUpload.shotType || activeUpload.strategyNote || activeUpload.landingZoneNote || activeUpload.whatCameraDoesntShow || activeUpload.clubUsed || activeUpload.windCondition || activeUpload.datePlayedAt);

  return (
    <>
      {/* Series player modal */}
      {activeSeries && (
        <SeriesPlayer series={activeSeries} onClose={() => setActiveSeries(null)} />
      )}

      <main style={{ height: "100dvh", background: "#000", overflow: "hidden", position: "relative" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          .video-el { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
          .photo-el { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
          .gradient-top { position: absolute; top: 0; left: 0; right: 0; height: 140px; background: linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%); z-index: 10; pointer-events: none; }
          .top-bar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 36px 14px 12px; z-index: 20; gap: 10px; }
          .back-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
          .mute-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
          .course-top-badge { width: 46px; height: 46px; border-radius: 12px; background: rgba(26,158,66,0.2); border: 1.5px solid rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 700; color: #1a9e42; flex-shrink: 0; overflow: hidden; }
          .right-actions { position: absolute; right: 12px; bottom: 100px; display: flex; flex-direction: column; align-items: center; gap: 14px; z-index: 30; }
          .action-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; }
          .action-icon { width: 40px; height: 40px; border-radius: 50%; background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; }
          .action-label { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,0.95); }
          .bottom-info { position: absolute; bottom: 0; left: 0; right: 0; padding: 0 16px 88px; z-index: 20; }
          .series-card { background: linear-gradient(135deg, rgba(180,145,60,0.15), rgba(180,145,60,0.05)); border: 1px solid rgba(180,145,60,0.35); border-radius: 14px; padding: 14px; cursor: pointer; transition: all 0.15s; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
          .series-card:active { opacity: 0.8; }
        `}</style>

        {/* Show series cards or single clip feed */}
        {uploads.length > 0 ? (
          <div
            style={{ position: "relative", width: "100%", height: "100dvh", ...(isDesktop ? { background: "#000", display: "flex", justifyContent: "center" } : {}) }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div style={{ position: "relative", width: "100%", maxWidth: isDesktop ? 390 : "100%", height: "100%", overflow: "hidden" }}>
            {activeUpload.mediaType === "PHOTO" ? (
              <img src={activeUpload.mediaUrl} className="photo-el" alt="clip" onClick={() => {}} />
            ) : (
              <HlsVideo
                ref={el => { videoRefs.current[activeUpload.id] = el as HTMLVideoElement | null; }}
                key={activeUpload.id}
                src={getVideoSrc(activeUpload.mediaUrl, activeUpload.cloudflareVideoId)}
                className="video-el"
                autoPlay
                playsInline
                loop
                muted={muted}
                onClick={() => {
                  const el = videoRefs.current[activeUpload.id];
                  if (!el) return;
                  if (el.paused) { el.play().catch(() => {}); setVideoPaused(false); }
                  else { el.pause(); setVideoPaused(true); }
                }}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
              />
            )}

            {/* Pause indicator */}
            {videoPaused && (
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 15, pointerEvents: "none", opacity: 0.7 }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                </div>
              </div>
            )}

            {/* Yardage overlay for single clips */}
            {activeUpload.yardageOverlay && (
              <div style={{ position: "absolute", top: "45%", left: 16, zIndex: 15 }}>
                <div style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px" }}>
                                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff" }}>{activeUpload.yardageOverlay} <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.6)" }}>yds</span></div>
                </div>
              </div>
            )}

            <div className="gradient-top" />

            <ClipTopPill
              courseLogoUrl={course?.logoUrl ?? null}
              courseName={course?.name ?? ""}
              courseLocation={[course?.city, course?.state].filter(Boolean).join(", ") || null}
              holeNumber={holeNum}
              muted={muted}
              onMuteToggle={() => { const n = !muted; setMuted(n); sessionMute.set(n); }}
              onTapCourse={() => router.push(`/courses/${id}`)}
              visible={true}
              showParYardage={false}
            />

            {(() => {
              const scoutedHoles = holeList.filter(h => h.uploadCount > 0).map(h => h.holeNumber);
              return (
                <>
                  <HoleSideBar holeIndex={scoutedHoles.indexOf(holeNum ?? -1)} scoutedHoles={scoutedHoles} />
                  <HoleIdentityCard holeNumber={holeNum} holePar={!multiHoleKey ? par : undefined} clipCount={uploads.length} />
                </>
              );
            })()}

            {/* Right sidebar — Intel → Avatar → Like → Comment → SEND IT → Report */}
            <div className="right-actions">

              {/* Intel */}
              {hasIntel && (
                <button className="action-btn" onClick={() => setIntelOpen(o => !o)}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: intelOpen ? "rgba(77,168,98,0.4)" : "rgba(77,168,98,0.25)", backdropFilter: "blur(8px)", border: "1.5px solid #4da862", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  </div>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "0.5px", color: "rgba(255,255,255,0.85)", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>INTEL</span>
                </button>
              )}

              {/* Uploader avatar — directly below Intel */}
              <button className="action-btn" onClick={() => activeUpload && router.push(`/profile/${activeUpload.userId}`)}>
                <div className={isLegend(uploader?.rank) ? "legend-ring" : undefined} style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: getRankRingBorder(uploader?.rank), background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {uploader?.avatarUrl
                    ? <img src={uploader.avatarUrl} alt={uploader.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  }
                </div>
              </button>

              {/* Like */}
              <ClipActions key={activeUpload.id} upload={activeUpload} />

              {/* Comment */}
              <button className="action-btn" onClick={() => setCommentUploadId(activeUpload.id)}>
                <div className="action-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <span className="action-label">{activeUpload.commentCount || 0}</span>
              </button>

              {/* SEND IT */}
              <button className="action-btn" onClick={handleShare}>
                <div className="action-icon" style={copied ? { borderColor: "rgba(26,158,66,0.5)", background: "rgba(26,158,66,0.2)" } : {}}>
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

              {/* Report (non-owner only) */}
              {user && activeUpload && activeUpload.userId !== user.id && (
                <button className="action-btn" onClick={() => setReportClipId(activeUpload.id)}>
                  <div className="action-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                  </div>
                  <span style={{ height: 13, display: "block" }} />
                </button>
              )}

            </div>

            {/* End-of-content toast */}
            {endOfContent && (
              <div style={{ position: "absolute", bottom: 220, left: "50%", transform: "translateX(-50%)", zIndex: 30, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99, padding: "8px 16px", whiteSpace: "nowrap" }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.65)" }}>
                  {endOfContent === "next" ? "No more holes with clips" : "That's the first hole with clips"}
                </span>
              </div>
            )}

            {formatClipDate(activeUpload.datePlayedAt, activeUpload.createdAt) && (
              <div style={{ position: "absolute", left: 16, bottom: 108, zIndex: 10, pointerEvents: "none" }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.45)", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                  {formatClipDate(activeUpload.datePlayedAt, activeUpload.createdAt)}
                </span>
              </div>
            )}

            {/* Series cards */}
            {series.length > 0 && (
              <div className="bottom-info">
                {series.map(s => (
                  <div key={s.seriesId} className="series-card" onClick={() => setActiveSeries(s)}>
                    <div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#c8a96e", marginBottom: 2 }}>🏌️ Play a Hole With Me</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>@{s.username} · {s.shots.length} shots</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(180,145,60,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                ))}
              </div>
            )}
            </div>{/* end inner wrapper */}
          </div>
        ) : (
          /* Only series, no single clips — show series cards on dark bg */
          <div style={{ minHeight: "100dvh", background: "#07100a", padding: "80px 20px 40px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff" }}>{course?.name}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{pageTitle}{!multiHoleKey ? ` · Par ${par}` : ""}</div>
              </div>
            </div>
            {series.map(s => (
              <div key={s.seriesId} className="series-card" onClick={() => setActiveSeries(s)}>
                <div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#c8a96e", marginBottom: 3 }}>🏌️ Play a Hole With Me</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>@{s.username} · {s.shots.length} shots</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(180,145,60,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            ))}
          </div>
        )}
      </main>

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

      {/* Comment sheet */}
      {commentUploadId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }} onClick={() => { setCommentUploadId(null); setCommentText(""); }}>
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
                  <div className={isLegend(c.rank) ? "legend-ring" : undefined} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(26,158,66,0.2)", border: `1px solid ${getRankColor(c.rank)}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
            <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={user ? "Add a comment..." : "Log in to comment"}
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
      )}

      {activeUpload && (
        <IntelPanel
          open={intelOpen}
          onClose={() => setIntelOpen(false)}
          holeNumber={holeNum}
          holePar={!multiHoleKey ? par : undefined}
          holeYardage={hole?.yardage}
          clubUsed={activeUpload.clubUsed}
          windCondition={activeUpload.windCondition}
          strategyNote={activeUpload.strategyNote}
          landingZoneNote={activeUpload.landingZoneNote}
          whatCameraDoesntShow={activeUpload.whatCameraDoesntShow}
          datePlayedAt={activeUpload.datePlayedAt}
          uploaderUsername={uploaders[activeUpload.userId]?.username ?? "golfer"}
          uploaderAvatarUrl={uploaders[activeUpload.userId]?.avatarUrl}
          uploaderId={activeUpload.userId}
          currentUserId={user?.id}
          uploaderHandicap={uploaders[activeUpload.userId]?.handicapIndex ?? null}
        />
      )}

      <BottomNav />
    </>
  );
}

