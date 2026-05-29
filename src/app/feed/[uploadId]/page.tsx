"use client";

// /feed/[uploadId] — full vertical clip feed, opened from a Tour-the-
// Feed thumbnail tap on the home. Starts on the requested clip and
// lets the user swipe up/down through the rest of the recent feed.
//
// Intentionally minimal v1: full-screen video, scroll-snap navigation,
// a thin top bar (back button + clip context), mute toggle, tap to
// play/pause. Engagement (likes, comments, share, follow) intentionally
// deferred — HomeClassic already carries the full surface; this page
// is the "got tapped from the feed-tease rail and wants to see clips"
// shortcut.

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HlsVideo } from "@/components/HlsVideo";
import { getVideoSrc } from "@/lib/getVideoSrc";
import { cdnImage } from "@/lib/cdnImage";

type Clip = {
  id: string;
  mediaUrl: string;
  cloudflareVideoId: string | null;
  mediaType: string;
  shotType: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  courseId: string;
  courseName: string | null;
  courseCity: string | null;
  courseState: string | null;
  courseLogoUrl: string | null;
  holeNumber: number | null;
  holePar: number | null;
  holeYardage: number | null;
  uploaderUsername: string | null;
  uploaderAvatarUrl: string | null;
  uploaderId: string;
};

const FEED_LIMIT = 40;

export default function FeedPage() {
  const router = useRouter();
  const params = useParams<{ uploadId: string }>();
  const uploadId = params?.uploadId;

  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Fetch the requested clip + a window of recent approved clips so
  // the user has something to swipe through. The requested clip is
  // pinned to the front of the array — anyone landing on the page
  // sees their tapped clip immediately, then can swipe down for more.
  useEffect(() => {
    if (!uploadId) return;
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const cols = "id, mediaUrl, cloudflareVideoId, mediaType, shotType, courseId, holeId, userId, createdAt, likeCount, commentCount";
      const { data: starting } = await sb
        .from("Upload")
        .select(cols)
        .eq("id", uploadId)
        .maybeSingle();

      const { data: feed } = await sb
        .from("Upload")
        .select(cols)
        .eq("moderationStatus", "APPROVED")
        .order("createdAt", { ascending: false })
        .limit(FEED_LIMIT);

      if (cancelled || !feed) return;

      const rows: any[] = starting && !feed.some((u: any) => u.id === starting.id)
        ? [starting, ...feed]
        : feed;
      // Pull starting clip to the front if it's already in the list.
      if (starting) {
        const idx = rows.findIndex((r) => r.id === starting.id);
        if (idx > 0) { const [el] = rows.splice(idx, 1); rows.unshift(el); }
      }

      const courseIds = Array.from(new Set(rows.map((r) => r.courseId).filter(Boolean)));
      const holeIds = Array.from(new Set(rows.map((r) => r.holeId).filter(Boolean)));
      const userIds = Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)));
      const [{ data: courses }, { data: holes }, { data: users }] = await Promise.all([
        courseIds.length ? sb.from("Course").select("id, name, city, state, logoUrl").in("id", courseIds) : Promise.resolve({ data: [] }),
        holeIds.length ? sb.from("Hole").select("id, holeNumber, par, yardage").in("id", holeIds) : Promise.resolve({ data: [] }),
        userIds.length ? sb.from("User").select("id, username, avatarUrl").in("id", userIds) : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;

      const courseById = new Map((courses ?? []).map((c: any) => [c.id, { name: c.name as string, city: c.city as string | null, state: c.state as string | null, logoUrl: c.logoUrl as string | null }]));
      const holeById = new Map((holes ?? []).map((h: any) => [h.id, { holeNumber: h.holeNumber as number, par: h.par as number | null, yardage: h.yardage as number | null }]));
      const userById = new Map((users ?? []).map((u: any) => [u.id, { username: u.username as string, avatarUrl: u.avatarUrl as string | null }]));

      const built: Clip[] = rows.map((r) => {
        const c = courseById.get(r.courseId);
        const h = r.holeId ? holeById.get(r.holeId) : null;
        return {
          id: r.id,
          mediaUrl: r.mediaUrl,
          cloudflareVideoId: r.cloudflareVideoId,
          mediaType: r.mediaType,
          shotType: r.shotType,
          createdAt: r.createdAt,
          likeCount: r.likeCount ?? 0,
          commentCount: r.commentCount ?? 0,
          courseId: r.courseId,
          courseName: c?.name ?? null,
          courseCity: c?.city ?? null,
          courseState: c?.state ?? null,
          courseLogoUrl: c?.logoUrl ?? null,
          holeNumber: h?.holeNumber ?? null,
          holePar: h?.par ?? null,
          holeYardage: h?.yardage ?? null,
          uploaderId: r.userId,
          uploaderUsername: userById.get(r.userId)?.username ?? null,
          uploaderAvatarUrl: userById.get(r.userId)?.avatarUrl ?? null,
        };
      });

      setClips(built);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [uploadId]);

  // Track which clip is on-screen so we can autoplay it + pause
  // everything else. IntersectionObserver fires when each scroll-
  // snapped item passes the 60%-visible threshold.
  useEffect(() => {
    if (clips.length === 0 || !containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const id = (e.target as HTMLElement).dataset.clipId;
            if (!id) continue;
            const idx = clips.findIndex((c) => c.id === id);
            if (idx >= 0) setActiveIndex(idx);
            const v = videoRefs.current[id];
            if (v) v.play().catch(() => {});
          } else {
            const id = (e.target as HTMLElement).dataset.clipId;
            const v = id ? videoRefs.current[id] : null;
            if (v) { v.pause(); v.currentTime = 0; }
          }
        }
      },
      { threshold: [0, 0.6, 1] }
    );

    const items = containerRef.current.querySelectorAll<HTMLElement>("[data-clip-id]");
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [clips]);

  function close() {
    router.back();
  }

  if (!uploadId) return null;
  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13 }}>
        Loading feed…
      </div>
    );
  }
  if (clips.length === 0) {
    return (
      <div style={{ minHeight: "100dvh", background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, fontFamily: "'Outfit', sans-serif" }}>
        <div>Clip not found.</div>
        <button onClick={close} style={{ padding: "8px 18px", background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.4)", borderRadius: 99, color: "#4da862", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Back</button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        html, body { background: #000; margin: 0; padding: 0; overflow: hidden; }
        .feed-scroller { height: 100svh; overflow-y: scroll; scroll-snap-type: y mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; touch-action: pan-y; overscroll-behavior: contain; }
        .feed-scroller::-webkit-scrollbar { display: none; }
        .feed-clip { height: 100svh; scroll-snap-align: start; scroll-snap-stop: always; position: relative; background: #000; }
      `}</style>
      <div ref={containerRef} className="feed-scroller">
        {clips.map((c, i) => (
          <FeedClip
            key={c.id}
            clip={c}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onBack={close}
            onCourse={() => router.push(`/courses/${c.courseId}`)}
            onUser={() => c.uploaderUsername && router.push(`/profile/${c.uploaderUsername}`)}
            registerVideo={(el) => (videoRefs.current[c.id] = el)}
            isActive={i === activeIndex}
          />
        ))}
      </div>
    </>
  );
}

function FeedClip({
  clip, muted, onToggleMute, onBack, onCourse, onUser, registerVideo, isActive,
}: {
  clip: Clip;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onCourse: () => void;
  onUser: () => void;
  registerVideo: (el: HTMLVideoElement | null) => void;
  isActive: boolean;
}) {
  const isVideo = clip.mediaType === "VIDEO";
  const src = useMemo(() => isVideo ? getVideoSrc(clip.mediaUrl, clip.cloudflareVideoId) : null, [clip.mediaUrl, clip.cloudflareVideoId, isVideo]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(clip.likeCount);
  const [progress, setProgress] = useState(0); // 0..1
  // "Sent" flash state — mirrors the pattern in profile/[userId]
  // and courses/[id] clip cards (SEND → SENT ✓ for 2 seconds).
  const [shareSent, setShareSent] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Track current user's like state on this clip — single Like row
  // check on mount; tap toggles optimistically.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await sb.from("Like").select("id").eq("uploadId", clip.id).eq("userId", user.id).maybeSingle();
      if (!cancelled) setLiked(!!data);
    })();
    return () => { cancelled = true; };
  }, [clip.id]);

  async function toggleLike(e: React.MouseEvent) {
    e.stopPropagation();
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      await sb.from("Like").delete().eq("uploadId", clip.id).eq("userId", user.id);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      await sb.from("Like").insert({ id: crypto.randomUUID(), uploadId: clip.id, userId: user.id, createdAt: new Date().toISOString() });
    }
  }

  function tapToTogglePlay(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-overlay-control]")) return;
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  function captureRef(el: HTMLVideoElement | null) {
    videoRef.current = el;
    registerVideo(el);
  }

  function onTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget;
    if (!v.duration) return;
    setProgress(v.currentTime / v.duration);
  }

  const courseLogo = clip.courseLogoUrl ? cdnImage(clip.courseLogoUrl) : null;
  const uploaderAvatar = clip.uploaderAvatarUrl ? cdnImage(clip.uploaderAvatarUrl) : null;
  const dateLabel = (() => {
    if (!clip.createdAt) return "";
    const d = new Date(clip.createdAt);
    return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
  })();
  const holeMeta = [
    clip.holeNumber != null ? `Hole ${clip.holeNumber}` : null,
    clip.holePar != null ? `Par ${clip.holePar}` : null,
    clip.holeYardage != null ? `${clip.holeYardage} yds` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="feed-clip" data-clip-id={clip.id} onClick={tapToTogglePlay}>
      {isVideo && src ? (
        <HlsVideo
          ref={captureRef}
          src={src}
          autoPlay={isActive}
          loop
          muted={muted}
          playsInline
          onTimeUpdate={onTimeUpdate}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cdnImage(clip.mediaUrl)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}

      {/* Top-left BACK button — sits ABOVE the course pill per user
          request. Course pill slides down to the second row. */}
      <button
        data-overlay-control
        onClick={(e) => { e.stopPropagation(); onBack(); }}
        aria-label="Back"
        style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 10px)", left: 12, width: 36, height: 36, borderRadius: "50%", background: "rgba(7,16,10,0.7)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 6 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>

      {/* Course pill — course logo + name/city, then hole/par/yds.
          Tap routes to the course page. Sits below the back button. */}
      <button
        data-overlay-control
        onClick={(e) => { e.stopPropagation(); onCourse(); }}
        style={{
          position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 56px)", left: 12, right: 60,
          display: "flex", alignItems: "center", gap: 10,
          padding: "6px 12px 6px 6px",
          background: "rgba(7,16,10,0.72)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 99,
          cursor: "pointer",
          zIndex: 5,
          maxWidth: "calc(100% - 72px)",
        }}
        aria-label={`${clip.courseName ?? "Course"} — open course page`}
      >
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, padding: 3, border: "1px solid rgba(255,255,255,0.5)" }}>
          {courseLogo
            ? <img src={courseLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 800, color: "#0c1c13" }}>{(clip.courseName ?? "TI").slice(0, 2).toUpperCase()}</span>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {clip.courseName ?? "Unknown course"}
            </span>
            {holeMeta.length > 0 && (
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 600, color: "#4da862", whiteSpace: "nowrap" }}>
                · {holeMeta.join(" · ")}
              </span>
            )}
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {[clip.courseCity, clip.courseState].filter(Boolean).join(", ")}
          </div>
        </div>
      </button>

      {/* Mute toggle — top-right */}
      <button
        data-overlay-control
        onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
        aria-label={muted ? "Unmute" : "Mute"}
        style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 14px)", right: 12, width: 38, height: 38, borderRadius: "50%", background: "rgba(7,16,10,0.7)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 6 }}
      >
        {muted
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
        }
      </button>

      {/* Right rail — INTEL · LIKE · COMMENT · SEND IT · MORE.
          Visually matches the classic feed's vertical stack. Intel /
          Comment / Send / More are placeholder-routes for now (open the
          course page or no-op); Like is wired through to the DB. */}
      <div data-overlay-control style={{ position: "absolute", right: 12, bottom: "calc(env(safe-area-inset-bottom, 0px) + 100px)", display: "flex", flexDirection: "column", gap: 14, alignItems: "center", zIndex: 5 }}>
        {/* Intel */}
        <RailButton label="INTEL" onClick={(e) => { e.stopPropagation(); onCourse(); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></svg>
        </RailButton>
        {/* Like */}
        <RailButton label={String(likeCount)} onClick={toggleLike} filled={liked}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? "#fff" : "none"} stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </RailButton>
        {/* Comment */}
        <RailButton label={String(clip.commentCount)} onClick={(e) => { e.stopPropagation(); onCourse(); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        </RailButton>
        {/* SEND IT — matches the stacked "SEND / IT" treatment used
            on profile/[userId] and courses/[id] clip rails. URL
            points at the clip's course page so the recipient lands
            on the canonical scouting surface. */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            const url = `${window.location.origin}/courses/${clip.courseId}${clip.holeNumber ? `/holes/${clip.holeNumber}` : ""}`;
            try {
              if (typeof navigator !== "undefined" && (navigator as any).share) {
                await (navigator as any).share({ title: clip.courseName ?? "Tour It clip", url });
              } else {
                await navigator.clipboard.writeText(url);
              }
              setShareSent(true);
              setTimeout(() => setShareSent(false), 2000);
            } catch {}
          }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: shareSent ? "rgba(77,168,98,0.92)" : "rgba(77,168,98,0.85)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
            {shareSent
              ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.05 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#fff", letterSpacing: "0.06em" }}>SENT</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
              : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginTop: 1 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#fff", letterSpacing: "0.12em", marginRight: "-0.12em" }}>SEND</span>
                  <div style={{ width: 18, height: 1, background: "rgba(255,255,255,0.35)", margin: "1px 0" }} />
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#0e2418", letterSpacing: "0.22em", marginRight: "-0.22em" }}>IT</span>
                </div>
            }
          </div>
        </button>
      </div>

      {/* Bottom-left: uploader avatar + username + date */}
      <button
        data-overlay-control
        onClick={(e) => { e.stopPropagation(); onUser(); }}
        style={{ position: "absolute", left: 14, right: 78, bottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)", display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", padding: 0, cursor: "pointer", zIndex: 5 }}
        aria-label={`@${clip.uploaderUsername ?? "uploader"}`}
      >
        <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.45)", background: "rgba(77,168,98,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {uploaderAvatar
            ? <img src={uploaderAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /></svg>
          }
        </div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
          {clip.uploaderUsername ?? "—"}
        </span>
        {dateLabel && (
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.65)", textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
            {dateLabel}
          </span>
        )}
      </button>

      {/* Video progress bar — thin line pinned to the bottom of the
          clip frame, sits above the BottomNav by a few px so it stays
          visible. */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)", height: 3, background: "rgba(255,255,255,0.18)", zIndex: 4 }}>
        <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, progress * 100))}%`, background: "#4da862", transition: "width 0.15s linear" }} />
      </div>
    </div>
  );
}

function RailButton({ children, label, onClick, filled }: { children: React.ReactNode; label?: string; onClick: (e: React.MouseEvent) => void; filled?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
    >
      <div style={{ width: 42, height: 42, borderRadius: "50%", background: filled ? "rgba(77,168,98,0.95)" : "rgba(77,168,98,0.85)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
        {children}
      </div>
      {label && (
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 700, color: "#fff", letterSpacing: "0.04em", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
          {label}
        </span>
      )}
    </button>
  );
}
