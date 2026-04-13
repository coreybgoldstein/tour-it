"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tab = "overview" | "clips" | "reports";

type ClipRow = {
  id: string;
  mediaUrl: string;
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

type Stats = {
  totalClips: number;
  totalUsers: number;
  totalCourses: number;
  clipsToday: number;
  pendingReports: number;
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
      ] = await Promise.all([
        supabase.from("Upload").select("*", { count: "exact", head: true }),
        supabase.from("User").select("*", { count: "exact", head: true }),
        supabase.from("Course").select("*", { count: "exact", head: true }),
        supabase.from("Upload").select("*", { count: "exact", head: true }).gte("createdAt", today.toISOString()),
        supabase.from("ModerationReport").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("Upload").select("*", { count: "exact", head: true }).eq("moderationStatus", "REJECTED"),
      ]);
      setStats({
        totalClips: totalClips || 0,
        totalUsers: totalUsers || 0,
        totalCourses: totalCourses || 0,
        clipsToday: clipsToday || 0,
        pendingReports: pendingReports || 0,
        rejectedClips: rejectedClips || 0,
      });

      // Load recent clips
      await loadClips(supabase, "ALL");

      // Load reports
      await loadReports(supabase);

      setLoading(false);
    });
  }, []);

  async function loadClips(supabase: any, filter: "ALL" | "APPROVED" | "REJECTED") {
    let q = supabase.from("Upload")
      .select("id, mediaUrl, mediaType, moderationStatus, createdAt, courseId, userId, shotType, likeCount, commentCount")
      .order("createdAt", { ascending: false })
      .limit(50);
    if (filter !== "ALL") q = q.eq("moderationStatus", filter);
    const { data: uploadsData } = await q;
    if (!uploadsData) return;

    const courseIds = [...new Set(uploadsData.map((u: any) => u.courseId))];
    const userIds = [...new Set(uploadsData.map((u: any) => u.userId))];
    const [{ data: courses }, { data: users }] = await Promise.all([
      supabase.from("Course").select("id, name").in("id", courseIds),
      supabase.from("User").select("id, username").in("id", userIds),
    ]);
    setClips(uploadsData.map((u: any) => ({
      ...u,
      courseName: courses?.find((c: any) => c.id === u.courseId)?.name || "Unknown",
      username: users?.find((usr: any) => usr.id === u.userId)?.username || "unknown",
    })));
  }

  async function loadReports(supabase: any) {
    const { data: reportsData } = await supabase
      .from("ModerationReport")
      .select("id, reason, createdAt, uploadId, status, reportedById")
      .order("createdAt", { ascending: false })
      .limit(50);
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

    setReports(reportsData.map((r: any) => {
      const upload = uploads?.find((u: any) => u.id === r.uploadId);
      return {
        ...r,
        reporterUsername: reporters?.find((u: any) => u.id === r.reportedById)?.username || "unknown",
        clipThumb: upload?.mediaUrl || null,
        clipCourse: courses?.find((c: any) => c.id === upload?.courseId)?.name || null,
        clipUser: clipUsers?.find((u: any) => u.id === upload?.userId)?.username || null,
      };
    }));
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
    <div style={{ minHeight: "100dvh", background: "#07100a", paddingBottom: 40 }}>
      <style>{`
        .admin-stat { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; }
        .admin-tab { padding: 8px 16px; border-radius: 99px; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600; }
        .admin-tab-active { background: #1a9e42; color: #fff; }
        .admin-tab-inactive { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); }
        .clip-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .action-pill { padding: 5px 12px; border-radius: 99px; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>Admin</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Tour It — internal</div>
        </div>
        <button onClick={() => router.push("/admin/courses")} style={{ padding: "7px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
          Courses →
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: "16px 16px 0", overflowX: "auto" }}>
        {(["overview", "clips", "reports"] as Tab[]).map(t => (
          <button key={t} className={`admin-tab ${tab === t ? "admin-tab-active" : "admin-tab-inactive"}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "reports" && (stats?.pendingReports ?? 0) > 0 && (
              <span style={{ marginLeft: 6, background: "rgba(255,80,80,0.9)", color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: 10 }}>{stats!.pendingReports}</span>
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
                    ? <video src={clip.mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
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
          </div>
        )}

      </div>
    </div>
  );
}
