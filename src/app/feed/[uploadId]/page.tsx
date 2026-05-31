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
import { ClipRail } from "@/components/clip/ClipRail";
import EditClipSheet from "@/components/EditClipSheet";

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
  holeId: string | null;
  holeNumber: number | null;
  holePar: number | null;
  holeYardage: number | null;
  uploaderUsername: string | null;
  uploaderAvatarUrl: string | null;
  uploaderId: string;
};

// Candidate pool pulled from the DB. Larger than the rendered feed so
// the course-spacing pass has room to interleave — and so the user can
// keep swiping deep without a refetch. Fetched concurrently with the
// starting clip so the bigger pull doesn't delay first paint.
const FEED_POOL = 120;
// Minimum number of clips between two clips from the SAME course. 8 per
// product spec — no course may repeat inside an 8-clip window.
const COURSE_GAP = 8;
// Only the clips within this many positions of the active one mount a
// real <video>/<img>; the rest render an empty snap-cell. Lets the pool
// be large (deep swiping) without firing 120 manifest/segment loads at
// once — those are the egress + jank cost. Look-ahead is bigger than
// look-behind so the NEXT clip is already buffered when you swipe to it.
const WINDOW_AHEAD = 2;
const WINDOW_BEHIND = 1;

// Fisher-Yates shuffle (new array). Called on every open so the feed
// order is fresh each session.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Greedy reorder that keeps any single course at least COURSE_GAP apart.
// `leadCourseId` seeds the cooldown for a clip already pinned at the
// front (the tapped clip) so its course doesn't reappear immediately.
// When no course can satisfy the gap (tail of a thin pool), it picks the
// course seen longest ago — so we still never place two of the same
// course back-to-back unless that course is literally all that's left.
function spaceByCourse<T extends { courseId: string }>(items: T[], minGap: number, leadCourseId?: string): T[] {
  const remaining = [...items];
  const result: T[] = [];
  const lastIdx = new Map<string, number>();
  if (leadCourseId) lastIdx.set(leadCourseId, -1);
  while (remaining.length) {
    let pick = remaining.findIndex((it) => {
      const last = lastIdx.has(it.courseId) ? (lastIdx.get(it.courseId) as number) : -Infinity;
      return result.length - last >= minGap;
    });
    if (pick === -1) {
      // Forced: choose the course whose last placement is furthest back.
      let bestDist = -Infinity;
      pick = 0;
      for (let i = 0; i < remaining.length; i++) {
        const last = lastIdx.has(remaining[i].courseId) ? (lastIdx.get(remaining[i].courseId) as number) : -Infinity;
        const dist = result.length - last;
        if (dist > bestDist) { bestDist = dist; pick = i; }
      }
    }
    const [chosen] = remaining.splice(pick, 1);
    lastIdx.set(chosen.courseId, result.length);
    result.push(chosen);
  }
  return result;
}

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
  // Kebab menu — the clip whose 3-dot was tapped. Owner clips open the
  // edit/delete options sheet; others open the report sheet.
  const [menuClip, setMenuClip] = useState<Clip | null>(null);
  const [editClip, setEditClip] = useState<Clip | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportDone, setReportDone] = useState(false);
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

  async function deleteMenuClip() {
    if (!menuClip || !me || deleting) return;
    setDeleting(true);
    const sb = createClient();
    await sb.from("Upload").delete().eq("id", menuClip.id).eq("userId", me.id);
    setClips(prev => prev.filter(c => c.id !== menuClip.id));
    setDeleting(false);
    setMenuClip(null);
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
      // Starting clip + candidate pool fetched concurrently so the
      // larger pool pull doesn't add to time-to-first-clip.
      const [{ data: starting }, { data: feed }] = await Promise.all([
        sb.from("Upload").select(cols).eq("id", uploadId).maybeSingle(),
        sb.from("Upload")
          .select(cols)
          .eq("moderationStatus", "APPROVED")
          .order("createdAt", { ascending: false })
          .limit(FEED_POOL),
      ]);

      if (cancelled || !feed) return;

      // Everything except the tapped clip, shuffled fresh each open then
      // interleaved so no course repeats within COURSE_GAP. The tapped
      // clip is always pinned to the front (the user came to see it).
      // Videos lead; photos sink to the back — each group shuffled and
      // course-spaced on its own, so a photo-heavy course can't crowd out
      // the video reel up top.
      const rest = (feed as any[]).filter((u) => !starting || u.id !== starting.id);
      const leadCourseId = starting ? (starting as any).courseId : undefined;
      const vids = rest.filter((u) => u.mediaType === "VIDEO");
      const pics = rest.filter((u) => u.mediaType !== "VIDEO");
      const spacedVids = spaceByCourse(shuffle(vids), COURSE_GAP, leadCourseId);
      const spacedPics = spaceByCourse(
        shuffle(pics),
        COURSE_GAP,
        spacedVids.length ? (spacedVids[spacedVids.length - 1] as any).courseId : leadCourseId,
      );
      const spaced = [...spacedVids, ...spacedPics];
      const rows: any[] = starting ? [starting, ...spaced] : spaced;

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
          holeId: r.holeId ?? null,
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
        {clips.map((c, i) => {
          // Windowed mount — see WINDOW_AHEAD/BEHIND. Out-of-window clips
          // still render their snap-cell (keeps scroll height + the
          // IntersectionObserver target) but skip the heavy media + hls
          // instance until they scroll near.
          const mounted = i >= activeIndex - WINDOW_BEHIND && i <= activeIndex + WINDOW_AHEAD;
          if (!mounted) {
            return <div key={c.id} className="feed-clip" data-clip-id={c.id} />;
          }
          return (
            <FeedClip
              key={c.id}
              clip={c}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              onBack={close}
              onCourse={() => router.push(`/courses/${c.courseId}`)}
              onUser={() => c.uploaderUsername && router.push(`/profile/${c.uploaderUsername}`)}
              onComment={() => openCommentSheet(c.id)}
              onKebab={(e) => { e.stopPropagation(); setMenuClip(c); }}
              currentUserId={me?.id ?? null}
              registerVideo={(el) => (videoRefs.current[c.id] = el)}
              isActive={i === activeIndex}
            />
          );
        })}
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

      {/* Kebab menu — owner sees edit/delete options; others see the
          report sheet. Single source: menuClip + me decide which. */}
      {menuClip && me && menuClip.uploaderId === me.id && (
        <>
          <div className="tourit-sheet-backdrop" onClick={() => setMenuClip(null)} />
          <div className="tourit-sheet tourit-sheet--auto" onClick={e => e.stopPropagation()}>
            <div className="tourit-sheet-grip" />
            <button
              onClick={() => { setEditClip(menuClip); setMenuClip(null); }}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", padding: "14px 6px", cursor: "pointer", textAlign: "left" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>Edit clip</span>
            </button>
            <button
              onClick={deleteMenuClip}
              disabled={deleting}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", padding: "14px 6px", cursor: "pointer", textAlign: "left", opacity: deleting ? 0.6 : 1 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(220,60,60,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(220,60,60,0.85)" }}>{deleting ? "Deleting…" : "Delete clip"}</span>
            </button>
          </div>
        </>
      )}

      {/* Report sheet — non-owner clips. Same ModerationReport pipeline
          as the hole/course/profile pages. */}
      {menuClip && (!me || menuClip.uploaderId !== me.id) && (
        <>
          <div className="tourit-sheet-backdrop" onClick={() => { setMenuClip(null); setReportReason(null); setReportDone(false); }} />
          <div className="tourit-sheet tourit-sheet--auto" onClick={e => e.stopPropagation()}>
            <div className="tourit-sheet-grip" />
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
                    if (!reportReason || !me || !menuClip) return;
                    setSubmittingReport(true);
                    await createClient().from("ModerationReport").insert({ id: crypto.randomUUID(), reportedById: me.id, uploadId: menuClip.id, reason: reportReason, createdAt: new Date().toISOString() });
                    setSubmittingReport(false);
                    setReportDone(true);
                    setTimeout(() => { setMenuClip(null); setReportReason(null); setReportDone(false); }, 1800);
                  }}
                  style={{ width: "100%", marginTop: 8, background: reportReason ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: reportReason ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)", cursor: reportReason ? "pointer" : "not-allowed" }}>
                  {submittingReport ? "Submitting…" : "Submit report"}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Edit clip sheet — own clips. Patches local state on save. */}
      {editClip && (
        <EditClipSheet
          uploadId={editClip.id}
          courseId={editClip.courseId}
          currentHoleId={editClip.holeId}
          currentHoleNumber={editClip.holeNumber}
          currentUserId={me?.id ?? null}
          onClose={() => setEditClip(null)}
          onSaved={(data) => {
            setClips(prev => prev.map(c => c.id === editClip.id ? { ...c, shotType: data.shotType, holeNumber: data.holeNumber, holeId: data.holeId } : c));
            setEditClip(null);
          }}
        />
      )}
    </>
  );
}

function FeedClip({
  clip, muted, onToggleMute, onBack, onCourse, onUser, onComment, onKebab, currentUserId, registerVideo, isActive,
}: {
  clip: Clip;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onCourse: () => void;
  onUser: () => void;
  onComment: () => void;
  onKebab: (e: React.MouseEvent) => void;
  currentUserId: string | null;
  registerVideo: (el: HTMLVideoElement | null) => void;
  isActive: boolean;
}) {
  const isVideo = clip.mediaType === "VIDEO";
  const src = useMemo(() => isVideo ? getVideoSrc(clip.mediaUrl, clip.cloudflareVideoId) : null, [clip.mediaUrl, clip.cloudflareVideoId, isVideo]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(clip.likeCount);
  const [progress, setProgress] = useState(0); // 0..1
  const isOwner = !!currentUserId && clip.uploaderId === currentUserId;
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
        {/* Left column — course name over location, vertically centered. */}
        <div style={{ flexShrink: 1, minWidth: 0, textAlign: "left", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
            {clip.courseName ?? "Unknown course"}
          </div>
          {(clip.courseCity || clip.courseState) && (
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1, minWidth: 0 }}>
              {[clip.courseCity, clip.courseState].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
        {/* Right side — hole · par · yards laid out horizontally and
            vertically centered, after a separator dot. Holds its width
            (no shrink) so the details never get crowded by the name. */}
        {holeMeta.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0, marginLeft: 2 }}>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>·</span>
            {holeMeta.map((m, i) => (
              <span key={m} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                {i > 0 && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>·</span>}
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 600, color: i === 0 ? "#4da862" : "rgba(255,255,255,0.92)", whiteSpace: "nowrap" }}>{m}</span>
              </span>
            ))}
          </div>
        )}
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

      {/* Right rail — shared ClipRail (uniform across all clip surfaces).
          INTEL opens the course page here; owner clips get the edit/delete
          kebab, others get the report kebab. */}
      <ClipRail
        bottom="calc(env(safe-area-inset-bottom, 0px) + 100px)"
        zIndex={5}
        onIntel={(e) => { e.stopPropagation(); onCourse(); }}
        liked={liked}
        likeCount={likeCount}
        onToggleLike={toggleLike}
        commentCount={clip.commentCount}
        onComment={(e) => { e.stopPropagation(); onComment(); }}
        sharePath={`/courses/${clip.courseId}${clip.holeNumber ? `/holes/${clip.holeNumber}` : ""}`}
        shareTitle={clip.courseName ?? "Tour It clip"}
        kebab={isOwner ? "options" : "report"}
        onKebab={onKebab}
      />

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

