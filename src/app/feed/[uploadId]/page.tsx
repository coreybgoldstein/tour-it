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
  courseId: string;
  courseName: string | null;
  holeNumber: number | null;
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
      const { data: starting } = await sb
        .from("Upload")
        .select("id, mediaUrl, cloudflareVideoId, mediaType, shotType, courseId, holeId, userId")
        .eq("id", uploadId)
        .maybeSingle();

      const { data: feed } = await sb
        .from("Upload")
        .select("id, mediaUrl, cloudflareVideoId, mediaType, shotType, courseId, holeId, userId, createdAt")
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
        courseIds.length ? sb.from("Course").select("id, name").in("id", courseIds) : Promise.resolve({ data: [] }),
        holeIds.length ? sb.from("Hole").select("id, holeNumber").in("id", holeIds) : Promise.resolve({ data: [] }),
        userIds.length ? sb.from("User").select("id, username, avatarUrl").in("id", userIds) : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;

      const courseById = new Map((courses ?? []).map((c: any) => [c.id, c.name as string]));
      const holeById = new Map((holes ?? []).map((h: any) => [h.id, h.holeNumber as number]));
      const userById = new Map((users ?? []).map((u: any) => [u.id, { username: u.username as string, avatarUrl: u.avatarUrl as string | null }]));

      const built: Clip[] = rows.map((r) => ({
        id: r.id,
        mediaUrl: r.mediaUrl,
        cloudflareVideoId: r.cloudflareVideoId,
        mediaType: r.mediaType,
        shotType: r.shotType,
        courseId: r.courseId,
        courseName: courseById.get(r.courseId) ?? null,
        holeNumber: r.holeId ? (holeById.get(r.holeId) ?? null) : null,
        uploaderId: r.userId,
        uploaderUsername: userById.get(r.userId)?.username ?? null,
        uploaderAvatarUrl: userById.get(r.userId)?.avatarUrl ?? null,
      }));

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
            registerVideo={(el) => (videoRefs.current[c.id] = el)}
            isActive={i === activeIndex}
          />
        ))}
      </div>
    </>
  );
}

function FeedClip({
  clip, muted, onToggleMute, onBack, onCourse, registerVideo, isActive,
}: {
  clip: Clip;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onCourse: () => void;
  registerVideo: (el: HTMLVideoElement | null) => void;
  isActive: boolean;
}) {
  const isVideo = clip.mediaType === "VIDEO";
  const src = useMemo(() => isVideo ? getVideoSrc(clip.mediaUrl, clip.cloudflareVideoId) : null, [clip.mediaUrl, clip.cloudflareVideoId, isVideo]);

  function tapToTogglePlay(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-overlay-control]")) return;
    const v = (e.currentTarget.querySelector("video") as HTMLVideoElement | null);
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  return (
    <div className="feed-clip" data-clip-id={clip.id} onClick={tapToTogglePlay}>
      {isVideo && src ? (
        <HlsVideo
          ref={(el) => registerVideo(el)}
          src={src}
          autoPlay={isActive}
          loop
          muted={muted}
          playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cdnImage(clip.mediaUrl)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}

      {/* Top bar */}
      <div data-overlay-control style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: 12, right: 12, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5 }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <button
          onClick={onToggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          {muted
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
          }
        </button>
      </div>

      {/* Bottom caption — course name + hole/shot. Tap → course page. */}
      <div
        data-overlay-control
        onClick={(e) => { e.stopPropagation(); onCourse(); }}
        style={{
          position: "absolute", left: 14, right: 14, bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          padding: "12px 14px",
          background: "linear-gradient(to top, rgba(7,16,10,0.92), rgba(7,16,10,0.55))",
          borderRadius: 14,
          border: "1px solid rgba(77,168,98,0.25)",
          cursor: "pointer",
          zIndex: 5,
        }}
      >
        {clip.holeNumber != null && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#4da862", marginBottom: 3 }}>
            HOLE {clip.holeNumber}{clip.shotType ? ` · ${clip.shotType.toUpperCase()}` : ""}
          </div>
        )}
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 800, color: "#fff", lineHeight: 1.1, marginBottom: 5 }}>
          {clip.courseName ?? "Unknown course"}
        </div>
        {clip.uploaderUsername && (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {clip.uploaderAvatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cdnImage(clip.uploaderAvatarUrl)} alt="" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.3)" }} />
            )}
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
              @{clip.uploaderUsername}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
