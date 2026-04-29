"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type TopCourse = { id: string; name: string; city: string; state: string; uploadCount: number; viewCount: number; saveCount: number };
type TopUploader = { id: string; username: string; displayName: string; uploadCount: number; avatarUrl: string | null };
type RecentUser = { id: string; username: string; displayName: string; avatarUrl: string | null; createdAt: string };

type Data = {
  totalUsers: number; usersToday: number; usersThisWeek: number; usersThisMonth: number; activeUsers: number;
  totalUploads: number; approvedUploads: number; pendingUploads: number; rejectedUploads: number;
  uploadsToday: number; uploadsThisWeek: number; uploadsThisMonth: number;
  totalVideos: number; totalPhotos: number;
  totalLikes: number; totalComments: number; totalSaves: number; totalViews: number; totalFollows: number;
  totalTrips: number; totalRounds: number;
  totalCourses: number; coursesWithUploads: number; coursesWithDesc: number; coursesWithCover: number;
  coursesWithLogo: number; coursesFullySeeded: number;
  pendingReports: number;
  totalSearches: number; totalSearchClicks: number;
  topCourses: TopCourse[]; topUploaders: TopUploader[]; recentUsers: RecentUser[];
};

const fmt = (n: number) => n.toLocaleString();
const pct = (n: number, total: number) => total > 0 ? Math.round((n / total) * 100) : 0;

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{typeof value === "number" ? fmt(value) : value}</div>
      {sub && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, marginTop: 24 }}>{children}</div>;
}

function ProgressRow({ label, value, total, color = "#4da862" }: { label: string; value: number; total: number; color?: string }) {
  const p = pct(value, total);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Outfit', sans-serif", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "rgba(255,255,255,0.7)" }}>{label}</span>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>{fmt(value)} <span style={{ color }}>{p}%</span></span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${p}%`, background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("User").select("isAdmin").eq("id", user.id).single();
    if (!profile?.isAdmin) { setUnauthorized(true); return; }

    const now = new Date();
    const t = new Date(now); t.setHours(0, 0, 0, 0);
    const w = new Date(now); w.setDate(now.getDate() - 7);
    const m = new Date(now); m.setDate(now.getDate() - 30);

    const results = await Promise.all([
      supabase.from("User").select("*", { count: "exact", head: true }),
      supabase.from("User").select("*", { count: "exact", head: true }).gte("createdAt", t.toISOString()),
      supabase.from("User").select("*", { count: "exact", head: true }).gte("createdAt", w.toISOString()),
      supabase.from("User").select("*", { count: "exact", head: true }).gte("createdAt", m.toISOString()),
      supabase.from("User").select("*", { count: "exact", head: true }).gt("uploadCount", 0),
      supabase.from("Upload").select("*", { count: "exact", head: true }),
      supabase.from("Upload").select("*", { count: "exact", head: true }).eq("moderationStatus", "APPROVED"),
      supabase.from("Upload").select("*", { count: "exact", head: true }).eq("moderationStatus", "PENDING"),
      supabase.from("Upload").select("*", { count: "exact", head: true }).eq("moderationStatus", "REJECTED"),
      supabase.from("Upload").select("*", { count: "exact", head: true }).gte("createdAt", t.toISOString()),
      supabase.from("Upload").select("*", { count: "exact", head: true }).gte("createdAt", w.toISOString()),
      supabase.from("Upload").select("*", { count: "exact", head: true }).gte("createdAt", m.toISOString()),
      supabase.from("Upload").select("*", { count: "exact", head: true }).eq("mediaType", "VIDEO"),
      supabase.from("Upload").select("*", { count: "exact", head: true }).eq("mediaType", "PHOTO"),
      supabase.from("Like").select("*", { count: "exact", head: true }),
      supabase.from("Comment").select("*", { count: "exact", head: true }),
      supabase.from("Save").select("*", { count: "exact", head: true }),
      supabase.from("View").select("*", { count: "exact", head: true }),
      supabase.from("Follow").select("*", { count: "exact", head: true }),
      supabase.from("GolfTrip").select("*", { count: "exact", head: true }),
      supabase.from("Round").select("*", { count: "exact", head: true }),
      supabase.from("Course").select("*", { count: "exact", head: true }),
      supabase.from("Course").select("*", { count: "exact", head: true }).gt("uploadCount", 0),
      supabase.from("Course").select("*", { count: "exact", head: true }).not("description", "is", null),
      supabase.from("Course").select("*", { count: "exact", head: true }).not("coverImageUrl", "is", null),
      supabase.from("Course").select("*", { count: "exact", head: true }).not("logoUrl", "is", null),
      supabase.from("Course").select("*", { count: "exact", head: true }).not("description", "is", null).not("coverImageUrl", "is", null).not("logoUrl", "is", null),
      supabase.from("ModerationReport").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
      supabase.from("SearchLog").select("*", { count: "exact", head: true }),
      supabase.from("SearchClick").select("*", { count: "exact", head: true }),
      supabase.from("Course").select("id, name, city, state, uploadCount, viewCount, saveCount").gt("uploadCount", 0).order("uploadCount", { ascending: false }).limit(10),
      supabase.from("User").select("id, username, displayName, uploadCount, avatarUrl").gt("uploadCount", 0).order("uploadCount", { ascending: false }).limit(10),
      supabase.from("User").select("id, username, displayName, avatarUrl, createdAt").order("createdAt", { ascending: false }).limit(5),
    ]);

    const c = (i: number) => (results[i] as any).count || 0;
    const d = (i: number) => (results[i] as any).data || [];

    setData({
      totalUsers: c(0), usersToday: c(1), usersThisWeek: c(2), usersThisMonth: c(3), activeUsers: c(4),
      totalUploads: c(5), approvedUploads: c(6), pendingUploads: c(7), rejectedUploads: c(8),
      uploadsToday: c(9), uploadsThisWeek: c(10), uploadsThisMonth: c(11),
      totalVideos: c(12), totalPhotos: c(13),
      totalLikes: c(14), totalComments: c(15), totalSaves: c(16), totalViews: c(17), totalFollows: c(18),
      totalTrips: c(19), totalRounds: c(20),
      totalCourses: c(21), coursesWithUploads: c(22), coursesWithDesc: c(23), coursesWithCover: c(24),
      coursesWithLogo: c(25), coursesFullySeeded: c(26),
      pendingReports: c(27),
      totalSearches: c(28), totalSearchClicks: c(29),
      topCourses: d(30), topUploaders: d(31), recentUsers: d(32),
    });
    setLastUpdated(new Date());
  }, [router]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

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

  if (!data) return null;

  const approvalRate = pct(data.approvedUploads, data.approvedUploads + data.rejectedUploads);
  const ctr = data.totalSearches > 0 ? Math.round((data.totalSearchClicks / data.totalSearches) * 100) : 0;
  const activationRate = pct(data.activeUsers, data.totalUsers);

  return (
    <div style={{ minHeight: "100dvh", background: "#07100a", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 16px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>Dashboard</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Tour It — operator view"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/admin")} style={{ padding: "7px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
            Admin
          </button>
          <button onClick={refresh} disabled={refreshing} style={{ padding: "7px 14px", background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.25)", borderRadius: 99, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862", cursor: "pointer", opacity: refreshing ? 0.5 : 1 }}>
            {refreshing ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>

        {/* ── Hero numbers ── */}
        <SectionTitle>At a Glance</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatCard label="Total users" value={data.totalUsers} sub={`${fmt(data.activeUsers)} uploaded (${activationRate}%)`} />
          <StatCard label="Approved clips" value={data.approvedUploads} sub={`${fmt(data.pendingUploads)} pending review`} />
          <StatCard label="Total views" value={data.totalViews} sub={`${fmt(data.totalLikes)} likes · ${fmt(data.totalComments)} comments`} />
          <StatCard label="Courses in DB" value={data.totalCourses} sub={`${fmt(data.coursesWithUploads)} have clips`} />
        </div>

        {/* ── Users ── */}
        <SectionTitle>Users</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
          {[
            { label: "Today", value: data.usersToday },
            { label: "Last 7 days", value: data.usersThisWeek },
            { label: "Last 30 days", value: data.usersThisMonth },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px" }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>{fmt(s.value)}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Activation rate (signed up + uploaded)</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: activationRate > 20 ? "#4da862" : "rgba(255,200,80,0.9)" }}>{activationRate}%</div>
        </div>

        {/* ── Uploads ── */}
        <SectionTitle>Content</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
          {[
            { label: "Today", value: data.uploadsToday },
            { label: "Last 7 days", value: data.uploadsThisWeek },
            { label: "Last 30 days", value: data.uploadsThisMonth },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px" }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>{fmt(s.value)}</div>
            </div>
          ))}
        </div>

        {/* Upload status breakdown */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px" }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            {[
              { label: "Total", value: data.totalUploads, color: "rgba(255,255,255,0.7)" },
              { label: "Approved", value: data.approvedUploads, color: "#4da862" },
              { label: "Pending", value: data.pendingUploads, color: "rgba(255,200,80,0.9)" },
              { label: "Rejected", value: data.rejectedUploads, color: "rgba(255,100,100,0.8)" },
            ].map(s => (
              <div key={s.label} style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: s.color }}>{fmt(s.value)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Approval rate: <span style={{ color: approvalRate > 80 ? "#4da862" : "rgba(255,200,80,0.9)" }}>{approvalRate}%</span></div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>·</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{fmt(data.totalVideos)} videos · {fmt(data.totalPhotos)} photos</div>
          </div>
        </div>

        {/* ── Engagement ── */}
        <SectionTitle>Engagement</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "Likes", value: data.totalLikes },
            { label: "Comments", value: data.totalComments },
            { label: "Saves", value: data.totalSaves },
            { label: "Views", value: data.totalViews },
            { label: "Follows", value: data.totalFollows },
            { label: "Trips", value: data.totalTrips },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px" }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, color: "#fff" }}>{fmt(s.value)}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Rounds logged</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff" }}>{fmt(data.totalRounds)}</div>
        </div>

        {/* ── AI Search ── */}
        <SectionTitle>AI Search</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px" }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Searches</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, color: "#fff" }}>{fmt(data.totalSearches)}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px" }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Clicks</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, color: "#fff" }}>{fmt(data.totalSearchClicks)}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px" }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Click-through</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, color: "#fff" }}>{ctr}%</div>
          </div>
        </div>

        {/* ── Course seeding ── */}
        <SectionTitle>Course Data Quality</SectionTitle>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "16px" }}>
          <ProgressRow label="Have clips" value={data.coursesWithUploads} total={data.totalCourses} color="#4da862" />
          <ProgressRow label="Description" value={data.coursesWithDesc} total={data.totalCourses} color="#4da862" />
          <ProgressRow label="Cover image" value={data.coursesWithCover} total={data.totalCourses} color="#3a9e7c" />
          <ProgressRow label="Logo" value={data.coursesWithLogo} total={data.totalCourses} color="#2d7a9e" />
          <ProgressRow label="Fully seeded (all 3)" value={data.coursesFullySeeded} total={data.totalCourses} color="#9e4da8" />
        </div>

        {/* ── Moderation health ── */}
        <SectionTitle>Moderation</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
          {[
            { label: "Pending clips", value: data.pendingUploads, alert: data.pendingUploads > 0 },
            { label: "Pending reports", value: data.pendingReports, alert: data.pendingReports > 0 },
            { label: "Approval rate", value: `${approvalRate}%`, alert: approvalRate < 70 },
          ].map(s => (
            <div key={s.label} style={{ background: s.alert ? "rgba(255,80,80,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${s.alert ? "rgba(255,80,80,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "12px" }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: s.alert ? "rgba(255,150,150,0.7)" : "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, color: s.alert ? "rgba(255,120,120,0.9)" : "#fff" }}>{typeof s.value === "number" ? fmt(s.value) : s.value}</div>
            </div>
          ))}
        </div>
        {(data.pendingUploads > 0 || data.pendingReports > 0) && (
          <button onClick={() => router.push("/admin")} style={{ width: "100%", padding: "11px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 10, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,120,120,0.9)", cursor: "pointer" }}>
            Review queue →
          </button>
        )}

        {/* ── Top courses ── */}
        <SectionTitle>Top Courses by Clips</SectionTitle>
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden" }}>
          {data.topCourses.length === 0 && (
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "24px" }}>No courses with clips yet</div>
          )}
          {data.topCourses.map((course, i) => (
            <div key={course.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: i < data.topCourses.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.2)", width: 20, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course.name}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{course.city}, {course.state}</div>
              </div>
              <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#4da862" }}>{fmt(course.uploadCount)}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>clips</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{fmt(course.viewCount)}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>views</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Top uploaders ── */}
        <SectionTitle>Top Uploaders</SectionTitle>
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden" }}>
          {data.topUploaders.length === 0 && (
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "24px" }}>No uploaders yet</div>
          )}
          {data.topUploaders.map((u, i) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: i < data.topUploaders.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.2)", width: 20, flexShrink: 0 }}>{i + 1}</div>
              {u.avatarUrl
                ? <img src={u.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>@{u.username}</div>
                {u.displayName && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{u.displayName}</div>}
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#4da862", flexShrink: 0 }}>{fmt(u.uploadCount)}</div>
            </div>
          ))}
        </div>

        {/* ── Recent signups ── */}
        <SectionTitle>Recent Signups</SectionTitle>
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden" }}>
          {data.recentUsers.map((u, i) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: i < data.recentUsers.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              {u.avatarUrl
                ? <img src={u.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>@{u.username}</div>
                {u.displayName && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{u.displayName}</div>}
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
