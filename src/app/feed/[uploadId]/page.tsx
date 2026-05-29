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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HlsVideo } from "@/components/HlsVideo";
import { getVideoSrc } from "@/lib/getVideoSrc";
import { cdnImage } from "@/lib/cdnImage";

type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  username: string;
  avatarUrl: string | null;
};

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
  // Sound on by default per user request. iOS blocks audio
  // autoplay so the active video may still play silently until
  // the user taps once — at first interaction we flip muted off
  // so subsequent clips audibly autoplay.
  const [muted, setMuted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Comment sheet — matches the bottom-sheet pattern used on
  // HomeClassic / courses / hole / profile. Lifted to FeedPage so
  // the sheet renders above the scroll-snap container regardless of
  // which clip is active, and tapping the comment button in any
  // ClipCard opens against the same DOM node.
  const [commentUploadId, setCommentUploadId] = useState<string | null>(null);
  const [commentItems, setCommentItems] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  // 500ms grace flag set synchronously when the comment button is
  // tapped, so iOS WKWebView's re-fired touch doesn't immediately
  // dismiss the sheet via the backdrop tap handler. Mirrors the
  // HomeClassic pattern.
  const commentJustOpenedRef = useRef(false);
  const openCommentSheet = useCallback((uploadId: string) => {
    commentJustOpenedRef.current = true;
    window.setTimeout(() => { commentJustOpenedRef.current = false; }, 500);
    setCommentUploadId(uploadId);
  }, []);
  // Current user — fetched once, used for posting + the sign-in CTA.
  const [me, setMe] = useState<{ id: string; username: string | null; displayName: string | null; avatarUrl: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user || cancelled) return;
      const { data: prof } = await sb.from("User").select("id, username, displayName, avatarUrl").eq("id", user.id).maybeSingle();
      if (!cancelled && prof) setMe(prof as any);
    })();
    return () => { cancelled = true; };
  }, []);

  // Load comments when the sheet opens.
  useEffect(() => {
    if (!commentUploadId) { setCommentItems([]); return; }
    setLoadingComments(true);
    const sb = createClient();
    sb.from("Comment")
      .select("id, body, createdAt, userId, user:User(username, avatarUrl)")
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
          })));
        }
        setLoadingComments(false);
      });
  }, [commentUploadId]);

  // Submit. Pattern lifted from HomeClassic.submitComment: insert
  // Comment → bump Upload.commentCount + rankScore → Notification +
  // push + points → optimistic local list update.
  async function submitComment() {
    if (!commentText.trim() || !me || !commentUploadId || submittingComment) return;
    setSubmittingComment(true);
    const sb = createClient();
    const id = crypto.randomUUID();
    const { error } = await sb.from("Comment").insert({
      id,
      uploadId: commentUploadId,
      userId: me.id,
      body: commentText.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (!error) {
      const { data: uploadData } = await sb
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
      await sb.from("Upload").update({ commentCount: newCommentCount, ...(newRank !== undefined && { rankScore: newRank }) }).eq("id", commentUploadId);
      if (uploadData?.userId && uploadData.userId !== me.id) {
        const commenterName = me.displayName || me.username || "Someone";
        const notifNow = new Date().toISOString();
        const clipLink = holeNumber
          ? `/courses/${uploadData.courseId}/holes/${holeNumber}?clip=${commentUploadId}`
          : `/courses/${uploadData.courseId}`;
        sb.from("Notification").insert({
          id: crypto.randomUUID(),
          userId: uploadData.userId,
          type: "comment",
          title: "New comment",
          body: `${commenterName} commented on your clip`,
          linkUrl: clipLink,
          referenceId: commentUploadId,
          read: false,
          createdAt: notifNow,
          updatedAt: notifNow,
        }).then(() => {});
        fetch("/api/push/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "comment_received", recipientUserId: uploadData.userId, referenceId: commentUploadId }) }).catch(() => {});
        fetch("/api/points/award", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "comment_received", recipientUserId: uploadData.userId, referenceId: commentUploadId }) }).catch(() => {});
      }
      setCommentItems(prev => [...prev, {
        id,
        body: commentText.trim(),
        createdAt: new Date().toISOString(),
        username: me.username || "golfer",
        avatarUrl: me.avatarUrl || null,
      }]);
      // Bump local clip's commentCount so the right-rail count
      // reflects the new total without a re-fetch.
      setClips(prev => prev.map(c => c.id === commentUploadId ? { ...c, commentCount: c.commentCount + 1 } : c));
      setCommentText("");
    }
    setSubmittingComment(false);
  }

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
            onComment={() => openCommentSheet(c.id)}
            registerVideo={(el) => (videoRefs.current[c.id] = el)}
            isActive={i === activeIndex}
          />
        ))}
      </div>

      {/* Comment sheet — slides up from the bottom. Closes on backdrop
          tap (after the 500ms grace). Layout copied from
          HomeClassic.tsx (line ~2342) so the visual is identical
          across surfaces. */}
      {commentUploadId && (
        <>
          <div
            className="tourit-sheet-backdrop"
            onClick={() => {
              if (commentJustOpenedRef.current) return;
              setCommentUploadId(null);
              setCommentText("");
            }}
          />
          <div onClick={(e) => e.stopPropagation()} className="tourit-sheet tourit-sheet--comments">
            <div className="tourit-sheet-grip" />
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", textAlign: "center", paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Comments</div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {loadingComments ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, padding: "24px 0" }}>Loading...</div>
              ) : commentItems.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13, padding: "32px 0", lineHeight: 1.6 }}>No comments yet.<br />Be the first to say something!</div>
              ) : commentItems.map(c => (
                <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(26,158,66,0.2)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cdnImage(c.avatarUrl)} alt={c.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#4da862" }}>@{c.username} </span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.82)" }}>{c.body}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 16px 36px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {!me && (
                <div style={{ textAlign: "center", padding: "8px 0 10px" }}>
                  <a href="/login" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#4da862", fontWeight: 500 }}>Sign in to leave a comment</a>
                </div>
              )}
              {me && (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }}
                    onKeyDown={(e) => { if (e.key === "Enter" && commentText.trim()) submitComment(); }}
                  />
                  <button onClick={submitComment} disabled={!commentText.trim() || submittingComment} style={{ background: "#2d7a42", border: "none", borderRadius: 10, padding: "10px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: !commentText.trim() ? 0.4 : 1 }}>
                    {submittingComment ? "..." : "Post"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function FeedClip({
  clip, muted, onToggleMute, onBack, onCourse, onUser, onComment, registerVideo, isActive,
}: {
  clip: Clip;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onCourse: () => void;
  onUser: () => void;
  onComment: () => void;
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

      {/* Single top row — back · course pill · mute. Keeps everything
          on one horizontal band right below the iOS safe area so the
          top of the clip frame isn't visually crowded by a stacked
          stack of controls. */}
      <button
        data-overlay-control
        onClick={(e) => { e.stopPropagation(); onBack(); }}
        aria-label="Back"
        style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: 12, width: 36, height: 36, borderRadius: "50%", background: "rgba(7,16,10,0.7)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 6 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>

      {/* Course pill — sits to the right of the back button on the
          same row, height-matched, with the mute toggle on the far
          right. Tight gap to back, generous to mute. */}
      <button
        data-overlay-control
        onClick={(e) => { e.stopPropagation(); onCourse(); }}
        style={{
          position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: 56, right: 56,
          height: 36,
          display: "flex", alignItems: "center", gap: 8,
          padding: "0 12px 0 4px",
          background: "rgba(7,16,10,0.72)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 99,
          cursor: "pointer",
          zIndex: 5,
          minWidth: 0,
        }}
        aria-label={`${clip.courseName ?? "Course"} — open course page`}
      >
        <div style={{ width: 30, height: 30, borderRadius: 7, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, padding: 2, border: "1px solid rgba(255,255,255,0.5)" }}>
          {courseLogo
            ? <img src={courseLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 800, color: "#0c1c13" }}>{(clip.courseName ?? "TI").slice(0, 2).toUpperCase()}</span>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: "left", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 1, minWidth: 0 }}>
              {clip.courseName ?? "Unknown course"}
            </span>
            {holeMeta.length > 0 && (
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 600, color: "#4da862", whiteSpace: "nowrap", flexShrink: 0 }}>
                · {holeMeta.join(" · ")}
              </span>
            )}
          </div>
          {(clip.courseCity || clip.courseState) && (
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
              {[clip.courseCity, clip.courseState].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      </button>

      {/* Mute toggle — top-right, height-matched to back + pill so
          all three line up on the same row. */}
      <button
        data-overlay-control
        onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
        aria-label={muted ? "Unmute" : "Mute"}
        style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 12px)", right: 12, width: 36, height: 36, borderRadius: "50%", background: "rgba(7,16,10,0.7)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 6 }}
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
        {/* Comment — opens the bottom-sheet (lifted state on FeedPage). */}
        <RailButton label={String(clip.commentCount)} onClick={(e) => { e.stopPropagation(); onComment(); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        </RailButton>
        {/* SEND IT — visual copied 1:1 from profile/[userId] line ~185.
            Dark circle with backdrop-blur, white SEND / bright-green IT
            stacked text, divider line between, SENT ✓ flash on share.
            Behaves identically: Web Share → clipboard fallback → flash
            "SENT" for 2s. */}
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
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: shareSent ? "rgba(26,158,66,0.2)" : "rgba(0,0,0,0.6)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: `1px solid ${shareSent ? "rgba(26,158,66,0.5)" : "rgba(255,255,255,0.15)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {shareSent
              ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#4ade80", letterSpacing: "0.05em" }}>SENT</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
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
