"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import SeoTab from "./SeoTab";

type Tab = "overview" | "clips" | "reports" | "requests" | "trips" | "seo";

type CachedBrief = {
  briefHash: string;
  brief: {
    groupSize: number | null;
    budgetPerPerson: number | null;
    originCity: string | null;
    rounds: number | null;
    days: number | null;
    months: number[];
    vibes: string[];
    notes: string | null;
  } | null;
  response: {
    explanation: string;
    recommendations: Array<{ slug: string; name: string; matchScore: number }>;
  };
  hits: number;
  createdAt: string;
  expiresAt: string;
};

type ClipRow = {
  id: string;
  mediaUrl: string;
  cloudflareVideoId?: string | null;
  mediaType: string;
  moderationStatus: string;
  createdAt: string;
  courseId: string;
  userId: string;
  courseName?: string;
  username?: string;
  shotType?: string | null;
  holeNumber?: number | null;
  likeCount: number;
  commentCount: number;
};

type ReportRow = {
  id: string;
  reason: string;
  createdAt: string;
  uploadId: string | null;
  status: string;
  reporterUsername?: string;
  clipThumb?: string | null;
  clipCourse?: string | null;
  clipUser?: string | null;
};

type CourseRequestRow = {
  id: string;
  userId: string;
  name: string;
  city: string;
  state: string;
  courseType: string | null;
  websiteUrl: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  username?: string;
};

type Stats = {
  totalClips: number;
  totalUsers: number;
  totalCourses: number;
  clipsToday: number;
  pendingReports: number;
  pendingRequests: number;
  rejectedClips: number;
};

const REASON_LABELS: Record<string, string> = {
  WRONG_HOLE: "Wrong hole",
  WRONG_COURSE: "Wrong course",
  LOW_QUALITY: "Low quality",
  INAPPROPRIATE: "Inappropriate",
  SPAM: "Spam",
  COPYRIGHT: "Copyright",
  OTHER: "Other",
};

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [clipsFilter, setClipsFilter] = useState<"ALL" | "APPROVED" | "REJECTED">("ALL");
  const [actioning, setActioning] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [requests, setRequests] = useState<CourseRequestRow[]>([]);
  const [clipsHasMore, setClipsHasMore] = useState(false);
  const [reportsHasMore, setReportsHasMore] = useState(false);
  const [clipsLoadingMore, setClipsLoadingMore] = useState(false);
  const [reportsLoadingMore, setReportsLoadingMore] = useState(false);
  const [cachedBriefs, setCachedBriefs] = useState<CachedBrief[]>([]);
  const [tripsLoaded, setTripsLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("User").select("isAdmin").eq("id", data.user.id).single();
      if (!profile?.isAdmin) { setUnauthorized(true); setLoading(false); return; }
      setCurrentUserId(data.user.id);

      // Load stats
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [
        { count: totalClips },
        { count: totalUsers },
        { count: totalCourses },
        { count: clipsToday },
        { count: pendingReports },
        { count: rejectedClips },
        { count: pendingRequests },
      ] = await Promise.all([
        supabase.from("Upload").select("*", { count: "exact", head: true }),
        supabase.from("User").select("*", { count: "exact", head: true }),
        supabase.from("Course").select("*", { count: "exact", head: true }),
        supabase.from("Upload").select("*", { count: "exact", head: true }).gte("createdAt", today.toISOString()),
        supabase.from("ModerationReport").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("Upload").select("*", { count: "exact", head: true }).eq("moderationStatus", "REJECTED"),
        supabase.from("CourseRequest").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
      ]);
      setStats({
        totalClips: totalClips || 0,
        totalUsers: totalUsers || 0,
        totalCourses: totalCourses || 0,
        clipsToday: clipsToday || 0,
        pendingReports: pendingReports || 0,
        pendingRequests: pendingRequests || 0,
        rejectedClips: rejectedClips || 0,
      });

      // Load recent clips
      await loadClips(supabase, "ALL");

      // Load reports
      await loadReports(supabase);

      // Load course requests
      await loadRequests(supabase);

      setLoading(false);
    });
  }, []);

  const PAGE = 50;

  async function loadClips(supabase: any, filter: "ALL" | "APPROVED" | "REJECTED", append = false) {
    const offset = append ? clips.length : 0;
    let q = supabase.from("Upload")
      .select("id, mediaUrl, cloudflareVideoId, mediaType, moderationStatus, createdAt, courseId, userId, shotType, likeCount, commentCount")
      .order("createdAt", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (filter !== "ALL") q = q.eq("moderationStatus", filter);
    const { data: uploadsData } = await q;
    if (!uploadsData) return;

    setClipsHasMore(uploadsData.length === PAGE);

    const courseIds = [...new Set(uploadsData.map((u: any) => u.courseId))];
    const userIds = [...new Set(uploadsData.map((u: any) => u.userId))];
    const [{ data: courses }, { data: users }] = await Promise.all([
      supabase.from("Course").select("id, name").in("id", courseIds),
      supabase.from("User").select("id, username").in("id", userIds),
    ]);
    const mapped = uploadsData.map((u: any) => ({
      ...u,
      courseName: courses?.find((c: any) => c.id === u.courseId)?.name || "Unknown",
      username: users?.find((usr: any) => usr.id === u.userId)?.username || "unknown",
    }));
    if (append) {
      setClips(prev => [...prev, ...mapped]);
    } else {
      setClips(mapped);
    }
  }

  async function loadReports(supabase: any, append = false) {
    const offset = append ? reports.length : 0;
    const { data: reportsData } = await supabase
      .from("ModerationReport")
      .select("id, reason, createdAt, uploadId, status, reportedById")
      .order("createdAt", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (!reportsData) return;

    const reporterIds = [...new Set(reportsData.map((r: any) => r.reportedById))];
    const uploadIds = reportsData.map((r: any) => r.uploadId).filter(Boolean);
    const [{ data: reporters }, { data: uploads }] = await Promise.all([
      supabase.from("User").select("id, username").in("id", reporterIds),
      uploadIds.length > 0 ? supabase.from("Upload").select("id, mediaUrl, courseId, userId").in("id", uploadIds) : Promise.resolve({ data: [] }),
    ]);

    const courseIds = [...new Set((uploads || []).map((u: any) => u.courseId))];
    const clipUserIds = [...new Set((uploads || []).map((u: any) => u.userId))];
    const [{ data: courses }, { data: clipUsers }] = await Promise.all([
      courseIds.length > 0 ? supabase.from("Course").select("id, name").in("id", courseIds) : Promise.resolve({ data: [] }),
      clipUserIds.length > 0 ? supabase.from("User").select("id, username").in("id", clipUserIds) : Promise.resolve({ data: [] }),
    ]);

    setReportsHasMore(reportsData.length === PAGE);

    const mapped = reportsData.map((r: any) => {
      const upload = uploads?.find((u: any) => u.id === r.uploadId);
      return {
        ...r,
        reporterUsername: reporters?.find((u: any) => u.id === r.reportedById)?.username || "unknown",
        clipThumb: upload?.mediaUrl || null,
        clipCourse: courses?.find((c: any) => c.id === upload?.courseId)?.name || null,
        clipUser: clipUsers?.find((u: any) => u.id === upload?.userId)?.username || null,
      };
    });
    if (append) {
      setReports(prev => [...prev, ...mapped]);
    } else {
      setReports(mapped);
    }
  }

  async function setClipStatus(clipId: string, status: "APPROVED" | "REJECTED") {
    setActioning(clipId);
    const supabase = createClient();
    await supabase.from("Upload").update({ moderationStatus: status, moderatedAt: new Date().toISOString(), moderatedBy: currentUserId }).eq("id", clipId);
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, moderationStatus: status } : c));
    setStats(prev => prev ? {
      ...prev,
      rejectedClips: status === "REJECTED" ? prev.rejectedClips + 1 : Math.max(0, prev.rejectedClips - 1),
    } : prev);
    setActioning(null);
  }

  async function resolveReport(reportId: string, action: "dismiss" | "reject_clip") {
    setActioning(reportId);
    const supabase = createClient();
    const report = reports.find(r => r.id === reportId);
    await supabase.from("ModerationReport").update({ status: "APPROVED", reviewedAt: new Date().toISOString(), reviewedBy: currentUserId }).eq("id", reportId);
    if (action === "reject_clip" && report?.uploadId) {
      await supabase.from("Upload").update({ moderationStatus: "REJECTED", moderatedAt: new Date().toISOString(), moderatedBy: currentUserId }).eq("id", report.uploadId);
    }
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: "APPROVED" } : r));
    setStats(prev => prev ? { ...prev, pendingReports: Math.max(0, prev.pendingReports - 1) } : prev);
    setActioning(null);
  }

  // Trip-planner cache — admin-only insight into which AI briefs are
  // popular. Lazy-loaded on first Trips tab activation so the home
  // admin load stays fast. Sorted by hits desc so the top of the list
  // is "what people keep asking for."
  async function loadCachedBriefs(supabase: any) {
    const { data } = await supabase
      .from("TripPlannerCache")
      .select("briefHash, brief, response, hits, createdAt, expiresAt")
      .order("hits", { ascending: false })
      .order("createdAt", { ascending: false })
      .limit(100);
    setCachedBriefs((data ?? []) as CachedBrief[]);
    setTripsLoaded(true);
  }

  useEffect(() => {
    if (tab === "trips" && !tripsLoaded) {
      loadCachedBriefs(createClient());
    }
  }, [tab, tripsLoaded]);

  async function loadRequests(supabase: any) {
    const { data } = await supabase
      .from("CourseRequest")
      .select("id, userId, name, city, state, courseType, websiteUrl, notes, status, createdAt")
      .order("createdAt", { ascending: false })
      .limit(50);
    if (!data) return;
    const userIds = [...new Set(data.map((r: any) => r.userId))];
    const { data: users } = await supabase.from("User").select("id, username").in("id", userIds);
    setRequests(data.map((r: any) => ({
      ...r,
      username: users?.find((u: any) => u.id === r.userId)?.username || "unknown",
    })));
  }

  async function approveRequest(req: CourseRequestRow) {
    setActioning(req.id);
    const supabase = createClient();
    await supabase.from("CourseRequest").update({ status: "APPROVED" }).eq("id", req.id);
    await supabase.from("Notification").insert({
      userId: req.userId,
      type: "course_request",
      title: "Course request approved",
      body: `Your request to add ${req.name} has been approved. It will appear in search soon.`,
      linkUrl: "/search",
      read: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "APPROVED" } : r));
    setStats(prev => prev ? { ...prev, pendingRequests: Math.max(0, prev.pendingRequests - 1) } : prev);
    setActioning(null);
  }

  async function denyRequest(reqId: string) {
    setActioning(reqId);
    const supabase = createClient();
    await supabase.from("CourseRequest").update({ status: "DENIED" }).eq("id", reqId);
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: "DENIED" } : r));
    setStats(prev => prev ? { ...prev, pendingRequests: Math.max(0, prev.pendingRequests - 1) } : prev);
    setActioning(null);
  }

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading…</div>
    </div>
  );

  if (unauthorized) return (
    <div style={{ minHeight: "100dvh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,100,100,0.7)", fontSize: 14 }}>Not authorized</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: "#07100a", paddingBottom: 100, paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <style>{`
        .admin-stat { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; }
        .admin-tab { padding: 8px 16px; border-radius: 99px; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600; }
        .admin-tab-active { background: #1a9e42; color: #fff; }
        .admin-tab-inactive { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); }
        .clip-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .action-pill { padding: 5px 12px; border-radius: 99px; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; }
      `}</style>

      {/* Top row: Home back button + Admin title — the safe-area
          inset is applied to the outer container, this row sits
          below the iOS status bar / Dynamic Island. */}
      <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <button
          onClick={() => router.push("/")}
          aria-label="Home"
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12L12 3l9 9" /><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10" />
          </svg>
        </button>
      </div>

      {/* Header */}
      <div style={{ padding: "8px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>Admin</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Tour It — internal</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/admin/dashboard")} style={{ padding: "7px 14px", background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: 99, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862", cursor: "pointer" }}>
            Dashboard →
          </button>
          <button onClick={() => router.push("/admin/courses")} style={{ padding: "7px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
            Courses →
          </button>
          <button onClick={() => router.push("/admin/claims")} style={{ padding: "7px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
            Claims →
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: "16px 16px 0", overflowX: "auto" }}>
        {(["overview", "clips", "reports", "requests", "trips", "seo"] as Tab[]).map(t => (
          <button key={t} className={`admin-tab ${tab === t ? "admin-tab-active" : "admin-tab-inactive"}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "reports" && (stats?.pendingReports ?? 0) > 0 && (
              <span style={{ marginLeft: 6, background: "rgba(255,80,80,0.9)", color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: 10 }}>{stats!.pendingReports}</span>
            )}
            {t === "requests" && (stats?.pendingRequests ?? 0) > 0 && (
              <span style={{ marginLeft: 6, background: "rgba(255,160,30,0.9)", color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: 10 }}>{stats!.pendingRequests}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px" }}>

        {/* ── Overview ── */}
        {tab === "overview" && stats && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Total clips", value: stats.totalClips },
                { label: "Today's clips", value: stats.clipsToday },
                { label: "Total users", value: stats.totalUsers },
                { label: "Total courses", value: stats.totalCourses },
                { label: "Pending reports", value: stats.pendingReports, alert: stats.pendingReports > 0 },
                { label: "Rejected clips", value: stats.rejectedClips },
              ].map(s => (
                <div key={s.label} className="admin-stat">
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: s.alert ? "rgba(255,120,120,0.9)" : "#fff" }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setTab("clips")} style={{ flex: 1, padding: "12px", background: "rgba(26,158,66,0.12)", border: "1px solid rgba(26,158,66,0.25)", borderRadius: 12, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#1a9e42", cursor: "pointer" }}>Review clips</button>
              <button onClick={() => setTab("reports")} style={{ flex: 1, padding: "12px", background: stats.pendingReports > 0 ? "rgba(255,80,80,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${stats.pendingReports > 0 ? "rgba(255,80,80,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: stats.pendingReports > 0 ? "rgba(255,120,120,0.9)" : "rgba(255,255,255,0.5)", cursor: "pointer" }}>
                {stats.pendingReports > 0 ? `${stats.pendingReports} pending reports` : "Reports"}
              </button>
            </div>
          </div>
        )}

        {/* ── Clips ── */}
        {tab === "clips" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(["ALL", "APPROVED", "REJECTED"] as const).map(f => (
                <button key={f} onClick={async () => { setClipsFilter(f); await loadClips(createClient(), f); }}
                  style={{ padding: "5px 12px", borderRadius: 99, border: "none", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, background: clipsFilter === f ? "#1a9e42" : "rgba(255,255,255,0.06)", color: clipsFilter === f ? "#fff" : "rgba(255,255,255,0.4)" }}>
                  {f}
                </button>
              ))}
            </div>
            {clips.map(clip => (
              <div key={clip.id} className="clip-row">
                <div style={{ width: 52, height: 72, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.06)" }}>
                  {clip.mediaType === "VIDEO"
                    ? <img src={clip.cloudflareVideoId ? `https://videodelivery.net/${clip.cloudflareVideoId}/thumbnails/thumbnail.jpg?time=0s&width=200` : clip.mediaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <img src={clip.mediaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{clip.courseName}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>@{clip.username} · {new Date(clip.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                  <div style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: clip.moderationStatus === "APPROVED" ? "rgba(26,158,66,0.15)" : clip.moderationStatus === "REJECTED" ? "rgba(200,50,50,0.2)" : "rgba(255,200,50,0.15)", color: clip.moderationStatus === "APPROVED" ? "#4da862" : clip.moderationStatus === "REJECTED" ? "rgba(255,100,100,0.9)" : "rgba(255,200,80,0.9)" }}>
                      {clip.moderationStatus}
                    </span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>♥ {clip.likeCount} · 💬 {clip.commentCount}</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  {clip.moderationStatus !== "APPROVED" && (
                    <button disabled={actioning === clip.id} onClick={() => setClipStatus(clip.id, "APPROVED")}
                      className="action-pill" style={{ background: "rgba(26,158,66,0.15)", color: "#4da862", opacity: actioning === clip.id ? 0.5 : 1 }}>
                      Approve
                    </button>
                  )}
                  {clip.moderationStatus !== "REJECTED" && (
                    <button disabled={actioning === clip.id} onClick={() => setClipStatus(clip.id, "REJECTED")}
                      className="action-pill" style={{ background: "rgba(200,50,50,0.15)", color: "rgba(255,100,100,0.9)", opacity: actioning === clip.id ? 0.5 : 1 }}>
                      Reject
                    </button>
                  )}
                </div>
              </div>
            ))}
            {clips.length === 0 && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", paddingTop: 40 }}>No clips</div>}
            {clipsHasMore && (
              <button disabled={clipsLoadingMore} onClick={async () => { setClipsLoadingMore(true); await loadClips(createClient(), clipsFilter, true); setClipsLoadingMore(false); }}
                style={{ width: "100%", marginTop: 16, padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)", cursor: "pointer", opacity: clipsLoadingMore ? 0.5 : 1 }}>
                {clipsLoadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}

        {/* ── Reports ── */}
        {tab === "reports" && (
          <div>
            {reports.map(report => (
              <div key={report.id} style={{ padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {report.clipThumb && (
                    <div style={{ width: 52, height: 72, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.06)" }}>
                      <img src={report.clipThumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2 }}>
                      {REASON_LABELS[report.reason] || report.reason}
                    </div>
                    {report.clipCourse && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{report.clipCourse}{report.clipUser ? ` · @${report.clipUser}` : ""}</div>}
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                      by @{report.reporterUsername} · {new Date(report.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <span style={{ display: "inline-block", marginTop: 6, fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: report.status === "PENDING" ? "rgba(255,200,50,0.15)" : "rgba(255,255,255,0.06)", color: report.status === "PENDING" ? "rgba(255,200,80,0.9)" : "rgba(255,255,255,0.3)" }}>
                      {report.status}
                    </span>
                  </div>
                </div>
                {report.status === "PENDING" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button disabled={actioning === report.id} onClick={() => resolveReport(report.id, "dismiss")}
                      className="action-pill" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", opacity: actioning === report.id ? 0.5 : 1 }}>
                      Dismiss
                    </button>
                    {report.uploadId && (
                      <button disabled={actioning === report.id} onClick={() => resolveReport(report.id, "reject_clip")}
                        className="action-pill" style={{ background: "rgba(200,50,50,0.15)", color: "rgba(255,100,100,0.9)", opacity: actioning === report.id ? 0.5 : 1 }}>
                        Reject clip
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {reports.length === 0 && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", paddingTop: 40 }}>No reports</div>}
            {reportsHasMore && (
              <button disabled={reportsLoadingMore} onClick={async () => { setReportsLoadingMore(true); await loadReports(createClient(), true); setReportsLoadingMore(false); }}
                style={{ width: "100%", marginTop: 16, padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)", cursor: "pointer", opacity: reportsLoadingMore ? 0.5 : 1 }}>
                {reportsLoadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}

        {/* ── Requests ── */}
        {tab === "requests" && (
          <div>
            {requests.map(req => (
              <div key={req.id} style={{ padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{req.name}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{req.city}, {req.state}{req.courseType ? ` · ${req.courseType.replace("_", "-")}` : ""}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                      @{req.username} · {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    {req.notes && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4, fontStyle: "italic" }}>"{req.notes}"</div>}
                    {req.websiteUrl && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(77,168,98,0.7)", marginTop: 4 }}>{req.websiteUrl}</div>}
                  </div>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, flexShrink: 0, background: req.status === "APPROVED" ? "rgba(26,158,66,0.15)" : req.status === "DENIED" ? "rgba(200,50,50,0.15)" : "rgba(255,200,50,0.15)", color: req.status === "APPROVED" ? "#4da862" : req.status === "DENIED" ? "rgba(255,100,100,0.9)" : "rgba(255,200,80,0.9)" }}>
                    {req.status}
                  </span>
                </div>
                {req.status === "PENDING" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button disabled={actioning === req.id} onClick={() => approveRequest(req)}
                      className="action-pill" style={{ background: "rgba(26,158,66,0.15)", color: "#4da862", opacity: actioning === req.id ? 0.5 : 1 }}>
                      Approve
                    </button>
                    <button disabled={actioning === req.id} onClick={() => denyRequest(req.id)}
                      className="action-pill" style={{ background: "rgba(200,50,50,0.15)", color: "rgba(255,100,100,0.9)", opacity: actioning === req.id ? 0.5 : 1 }}>
                      Deny
                    </button>
                  </div>
                )}
              </div>
            ))}
            {requests.length === 0 && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", paddingTop: 40 }}>No course requests</div>}
          </div>
        )}

        {/* ── Trips: planner cache ── */}
        {tab === "trips" && (
          <div>
            {(() => {
              if (!tripsLoaded) {
                return <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", paddingTop: 40 }}>Loading…</div>;
              }
              const totalEntries = cachedBriefs.length;
              const totalHits = cachedBriefs.reduce((s, b) => s + b.hits, 0);
              const callsSaved = totalHits; // each hit is a Claude call we didn't pay for
              const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              return (
                <>
                  {/* Summary stat cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                    <div className="admin-stat">
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Cached briefs</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "#fff" }}>{totalEntries}</div>
                    </div>
                    <div className="admin-stat">
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Claude calls saved</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: callsSaved > 0 ? "#4da862" : "#fff" }}>{callsSaved}</div>
                    </div>
                  </div>

                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 12, lineHeight: 1.5 }}>
                    Trip planner cache — keyed on the canonicalized brief. Sorted by hits (most-asked first). 7-day TTL. Use this to see what people want and what to seed next.
                  </div>

                  {cachedBriefs.length === 0 ? (
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", paddingTop: 40 }}>
                      No cached briefs yet. Once people use the planner, briefs land here.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {cachedBriefs.map(b => {
                        const monthLabel = b.brief?.months?.map(m => MONTH_LABELS[m - 1]).join(", ") ?? "—";
                        const ageHours = Math.floor((Date.now() - new Date(b.createdAt).getTime()) / 3600000);
                        const ageLabel = ageHours < 24 ? `${ageHours}h ago` : `${Math.floor(ageHours / 24)}d ago`;
                        return (
                          <div key={b.briefHash} style={{ padding: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: b.hits > 0 ? "#4da862" : "rgba(255,255,255,0.35)", padding: "2px 8px", borderRadius: 99, background: b.hits > 0 ? "rgba(77,168,98,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${b.hits > 0 ? "rgba(77,168,98,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                                  {b.hits} HIT{b.hits === 1 ? "" : "S"}
                                </span>
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{ageLabel}</span>
                              </div>
                              <code style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{b.briefHash.slice(0, 8)}</code>
                            </div>

                            {/* Brief inputs */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                              {b.brief?.groupSize != null && (
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, padding: "3px 9px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.75)" }}>👥 {b.brief.groupSize}</span>
                              )}
                              {b.brief?.budgetPerPerson != null && (
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, padding: "3px 9px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.75)" }}>💵 ${b.brief.budgetPerPerson}/pp</span>
                              )}
                              {b.brief?.days != null && (
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, padding: "3px 9px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.75)" }}>📅 {b.brief.days}d</span>
                              )}
                              {b.brief?.rounds != null && (
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, padding: "3px 9px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.75)" }}>⛳ {b.brief.rounds}r</span>
                              )}
                              {b.brief?.originCity && (
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, padding: "3px 9px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.75)" }}>✈️ {b.brief.originCity}</span>
                              )}
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, padding: "3px 9px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)" }}>🗓 {monthLabel}</span>
                            </div>

                            {b.brief?.vibes && b.brief.vibes.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                                {b.brief.vibes.map(v => (
                                  <span key={v} style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "rgba(77,168,98,0.08)", color: "rgba(77,168,98,0.85)", border: "1px solid rgba(77,168,98,0.2)" }}>{v}</span>
                                ))}
                              </div>
                            )}

                            {b.brief?.notes && (
                              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.55)", fontStyle: "italic", marginBottom: 10, padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8, borderLeft: "2px solid rgba(77,168,98,0.4)" }}>
                                "{b.brief.notes}"
                              </div>
                            )}

                            {/* Top recommendations */}
                            <div style={{ paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 5 }}>Top matches</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                {(b.response.recommendations ?? []).slice(0, 3).map((r, i) => (
                                  <div key={r.slug} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Outfit', sans-serif", fontSize: 12 }}>
                                    <span style={{ color: "rgba(255,255,255,0.3)", width: 14 }}>{i + 1}.</span>
                                    <a href={`/trip-ideas/${r.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: "#fff", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</a>
                                    <span style={{ color: "#4da862", fontSize: 10, fontWeight: 600 }}>{r.matchScore}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {tab === "seo" && (
          <div style={{ padding: "16px 0 60px" }}>
            <SeoTab />
          </div>
        )}

      </div>
      <BottomNav />
    </div>
  );
}
