"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { sendPushToUser } from "@/lib/sendPush";
import { HlsVideo } from "@/components/HlsVideo";
import { getVideoSrc } from "@/lib/getVideoSrc";

type Trip = {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  createdBy: string;
  imageUrl: string | null;
};

type TripCourse = {
  id: string;
  courseId: string;
  playDate: string | null;
  teeTime: string | null;
  accommodation: string | null;
  sortOrder: number;
  course: { id: string; name: string; city: string; state: string; uploadCount: number; logoUrl: string | null };
};

type Member = {
  id: string;
  userId: string;
  role: string;
  user: { username: string; displayName: string; avatarUrl: string | null };
};

type Clip = {
  id: string;
  mediaType: string;
  mediaUrl: string;
  cloudflareVideoId?: string | null;
  courseId: string;
  tripPublic: boolean;
  strategyNote: string | null;
  shotType: string | null;
};

type CourseResult = { id: string; name: string; city: string; state: string; holeCount: number; logoUrl?: string | null };

// ── Inline date-range calendar ──────────────────────────────────────────────
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function DateRangePicker({ startDate, endDate, onChange }: {
  startDate: string; endDate: string;
  onChange: (start: string, end: string) => void;
}) {
  const [viewYear, setViewYear] = useState(() => {
    const d = startDate ? new Date(startDate + "T00:00:00") : new Date();
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = startDate ? new Date(startDate + "T00:00:00") : new Date();
    return d.getMonth();
  });
  const [picking, setPicking] = useState<"start" | "end">("start");

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDOW = new Date(viewYear, viewMonth, 1).getDay();

  const toIso = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const handleDay = (day: number) => {
    const iso = toIso(viewYear, viewMonth, day);
    if (picking === "start") {
      onChange(iso, "");
      setPicking("end");
    } else {
      if (iso < startDate) { onChange(iso, startDate); }
      else { onChange(startDate, iso); }
      setPicking("start");
    }
  };

  const isStart = (d: number) => startDate === toIso(viewYear, viewMonth, d);
  const isEnd   = (d: number) => endDate   === toIso(viewYear, viewMonth, d);
  const inRange = (d: number) => {
    if (!startDate || !endDate) return false;
    const iso = toIso(viewYear, viewMonth, d);
    return iso > startDate && iso < endDate;
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const formatPicked = (iso: string) => {
    if (!iso) return "—";
    const dt = new Date(iso + "T00:00:00");
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div>
      {/* Range display */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div
          onClick={() => setPicking("start")}
          style={{ flex: 1, background: picking === "start" ? "rgba(77,168,98,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${picking === "start" ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}
        >
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>Start</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: startDate ? "#fff" : "rgba(255,255,255,0.3)" }}>{formatPicked(startDate)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.2)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </div>
        <div
          onClick={() => setPicking("end")}
          style={{ flex: 1, background: picking === "end" ? "rgba(77,168,98,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${picking === "end" ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}
        >
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>End</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: endDate ? "#fff" : "rgba(255,255,255,0.3)" }}>{formatPicked(endDate)}</div>
        </div>
      </div>

      {/* Calendar */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "12px 10px" }}>
        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={prevMonth} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onClick={nextMonth} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
        {/* Day-of-week headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
          {["S","M","T","W","T","F","S"].map((d, i) => (
            <div key={i} style={{ textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.25)", padding: "3px 0" }}>{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {Array.from({ length: firstDOW }).map((_, i) => <div key={`p${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const s = isStart(day), e = isEnd(day), r = inRange(day);
            return (
              <button
                key={day}
                onClick={() => handleDay(day)}
                style={{
                  height: 34, borderRadius: (s || e) ? "50%" : r ? 4 : "50%",
                  background: (s || e) ? "#2d7a42" : r ? "rgba(77,168,98,0.18)" : "transparent",
                  border: "none", cursor: "pointer",
                  fontFamily: "'Outfit', sans-serif", fontSize: 12,
                  fontWeight: (s || e) ? 700 : 400,
                  color: (s || e) ? "#fff" : r ? "#4da862" : "rgba(255,255,255,0.7)",
                }}
              >{day}</button>
            );
          })}
        </div>
        <div style={{ marginTop: 8, textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          {picking === "start" ? "Tap a date to set trip start" : "Now tap an end date"}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function TripPage() {
  const { id } = useParams();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tripCourses, setTripCourses] = useState<TripCourse[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);

  // Invite sheet
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<{ id: string; username: string; displayName: string; avatarUrl: string | null }[]>([]);
  const [inviting, setInviting] = useState<string | null>(null);
  const inviteDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clip feed
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedIndex, setFeedIndex] = useState(0);
  const [activeClip, setActiveClip] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [muted, setMuted] = useState(true);

  // Edit trip sheet
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete trip
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingTrip, setDeletingTrip] = useState(false);

  async function handleDeleteTrip() {
    if (!trip || deletingTrip) return;
    setDeletingTrip(true);
    const supabase = createClient();
    await supabase.from("GolfTrip").delete().eq("id", trip.id);
    router.push("/lists");
  }
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Edit course sheet
  const [editCourseOpen, setEditCourseOpen] = useState(false);
  const [editCourseItem, setEditCourseItem] = useState<TripCourse | null>(null);
  const [editCPlayDate, setEditCPlayDate] = useState("");
  const [editCTeeTime, setEditCTeeTime] = useState("");
  const [editCAccom, setEditCAccom] = useState("");
  const [savingCourse, setSavingCourse] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState(false);

  // Swipe-to-delete
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const swipeTouchStartX = useRef<number>(0);
  const swipeTouchStartY = useRef<number>(0);
  const swipeCurrentX = useRef<number>(0);
  const swipeCardRef = useRef<Record<string, HTMLDivElement | null>>({});

  // Add course sheet
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [addCourseStep, setAddCourseStep] = useState<"search" | "details">("search");
  const [courseSearch, setCourseSearch] = useState("");
  const [courseResults, setCourseResults] = useState<CourseResult[]>([]);
  const [courseSearchLoading, setCourseSearchLoading] = useState(false);
  const [selectedAddCourse, setSelectedAddCourse] = useState<CourseResult | null>(null);
  const [addPlayDate, setAddPlayDate] = useState("");
  const [addTeeTime, setAddTeeTime] = useState("");
  const [addAccom, setAddAccom] = useState("");
  const [addingCourse, setAddingCourse] = useState(false);
  const courseSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      const { data: tripData } = await supabase.from("GolfTrip").select("*").eq("id", id).single();
      if (!tripData) { setLoading(false); return; }
      setTrip(tripData);
      setIsOwner(authUser?.id === tripData.createdBy);

      const { data: tcData } = await supabase.from("GolfTripCourse").select("id, courseId, playDate, teeTime, accommodation, sortOrder").eq("tripId", id);
      if (tcData && tcData.length > 0) {
        const courseIds = tcData.map((tc: any) => tc.courseId);
        const { data: coursesData } = await supabase.from("Course").select("id, name, city, state, uploadCount, logoUrl").in("id", courseIds);
        const mapped = tcData.map((tc: any) => ({
          ...tc,
          course: coursesData?.find((c: any) => c.id === tc.courseId) || { id: tc.courseId, name: "Unknown", city: "", state: "", uploadCount: 0, logoUrl: null },
        }));
        // Sort chronologically by playDate; undated entries go to the end
        mapped.sort((a: any, b: any) => {
          if (!a.playDate && !b.playDate) return a.sortOrder - b.sortOrder;
          if (!a.playDate) return 1;
          if (!b.playDate) return -1;
          return a.playDate.localeCompare(b.playDate);
        });
        setTripCourses(mapped);
      }

      const { data: memberData } = await supabase.from("GolfTripMember").select("id, userId, role").eq("tripId", id);
      if (memberData && memberData.length > 0) {
        const userIds = memberData.map((m: any) => m.userId);
        const { data: usersData } = await supabase.from("User").select("id, username, displayName, avatarUrl").in("id", userIds);
        setMembers(memberData.map((m: any) => ({
          ...m,
          user: usersData?.find((u: any) => u.id === m.userId) || { username: "golfer", displayName: "Golfer", avatarUrl: null },
        })));
      }

      const { data: clipsData } = await supabase.from("Upload").select("id, mediaType, mediaUrl, cloudflareVideoId, courseId, tripPublic, strategyNote, shotType").eq("tripId", id).order("createdAt", { ascending: false });
      if (clipsData) setClips(clipsData);

      setLoading(false);
    }
    load();
  }, [id]);

  // Invite search
  useEffect(() => {
    if (!inviteQuery.trim()) { setInviteResults([]); return; }
    if (inviteDebounce.current) clearTimeout(inviteDebounce.current);
    inviteDebounce.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase.from("User").select("id, username, displayName, avatarUrl").ilike("username", `%${inviteQuery}%`).limit(8);
      const memberIds = new Set(members.map(m => m.userId));
      setInviteResults((data || []).filter((u: any) => !memberIds.has(u.id)));
    }, 280);
  }, [inviteQuery, members]);

  // Course search for add-course sheet
  useEffect(() => {
    if (!courseSearch.trim()) { setCourseResults([]); return; }
    if (courseSearchDebounce.current) clearTimeout(courseSearchDebounce.current);
    setCourseSearchLoading(true);
    courseSearchDebounce.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase.from("Course").select("id, name, city, state, holeCount, logoUrl").or(`name.ilike.%${courseSearch}%,city.ilike.%${courseSearch}%`).order("uploadCount", { ascending: false }).limit(15);
      setCourseResults(data || []);
      setCourseSearchLoading(false);
    }, 280);
  }, [courseSearch, tripCourses]);

  const inviteUser = async (inviteeId: string) => {
    if (!user || inviting) return;
    setInviting(inviteeId);
    const supabase = createClient();
    const { error } = await supabase.from("GolfTripMember").insert({ id: crypto.randomUUID(), tripId: id as string, userId: inviteeId, role: "member" });
    if (!error) {
      const invited = inviteResults.find(u => u.id === inviteeId);
      if (invited) {
        setMembers(prev => [...prev, { id: crypto.randomUUID(), userId: inviteeId, role: "member", user: { username: invited.username, displayName: invited.displayName, avatarUrl: invited.avatarUrl } }]);
        setInviteResults(prev => prev.filter(u => u.id !== inviteeId));
      }

      // Write notification to invitee
      const { data: inviterProfile } = await supabase.from("User").select("displayName, username").eq("id", user.id).single();
      const inviterName = inviterProfile?.displayName || inviterProfile?.username || "Someone";
      const tripName = trip?.name || "a golf trip";
      const now = new Date().toISOString();
      await supabase.from("Notification").insert({
        id: crypto.randomUUID(),
        userId: inviteeId,
        type: "trip_invite",
        title: "You've been invited!",
        body: `${inviterName} added you to "${tripName}"`,
        linkUrl: `/trips/${id}`,
        read: false,
        createdAt: now,
        updatedAt: now,
      });
      sendPushToUser(inviteeId, "You've been invited!", `${inviterName} added you to "${tripName}"`, `/trips/${id}`);
    }
    setInviting(null);
  };

  const handleFeedScroll = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const el = feedRef.current;
      if (!el) return;
      setActiveClip(Math.round(el.scrollTop / window.innerHeight));
    }, 50);
  }, []);

  useEffect(() => {
    if (feedOpen && feedRef.current) {
      feedRef.current.scrollTop = feedIndex * window.innerHeight;
      setActiveClip(feedIndex);
    }
  }, [feedOpen, feedIndex]);

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([clipId, el]) => {
      if (!el) return;
      const idx = clips.findIndex(c => c.id === clipId);
      if (idx === activeClip) el.play().catch(() => {});
      else { el.pause(); el.currentTime = 0; }
    });
  }, [activeClip, clips]);

  const saveEdit = async () => {
    if (!editName.trim() || saving) return;
    setSaving(true);
    await createClient().from("GolfTrip").update({ name: editName.trim(), description: editDesc.trim() || null, startDate: editStart || null, endDate: editEnd || null }).eq("id", id as string);
    setTrip(prev => prev ? { ...prev, name: editName.trim(), description: editDesc.trim() || null, startDate: editStart || null, endDate: editEnd || null } : prev);
    setSaving(false);
    setEditOpen(false);
  };

  const handleTripImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingImage(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `trip-covers/${id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("tour-it-photos").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(path);
      await supabase.from("GolfTrip").update({ imageUrl: publicUrl }).eq("id", id as string);
      setTrip(prev => prev ? { ...prev, imageUrl: publicUrl } : prev);
    }
    setUploadingImage(false);
  };

  const openEditCourse = (tc: TripCourse) => {
    setEditCourseItem(tc);
    setEditCPlayDate(tc.playDate || "");
    setEditCTeeTime(tc.teeTime || "");
    setEditCAccom(tc.accommodation || "");
    setEditCourseOpen(true);
  };

  const saveCourseEdit = async () => {
    if (!editCourseItem || savingCourse) return;
    setSavingCourse(true);
    await createClient().from("GolfTripCourse").update({ playDate: editCPlayDate || null, teeTime: editCTeeTime || null, accommodation: editCAccom.trim() || null }).eq("id", editCourseItem.id);
    setTripCourses(prev => {
      const updated = prev.map(tc => tc.id === editCourseItem.id ? { ...tc, playDate: editCPlayDate || null, teeTime: editCTeeTime || null, accommodation: editCAccom.trim() || null } : tc);
      return [...updated].sort((a, b) => {
        if (!a.playDate && !b.playDate) return a.sortOrder - b.sortOrder;
        if (!a.playDate) return 1;
        if (!b.playDate) return -1;
        return a.playDate.localeCompare(b.playDate);
      });
    });
    setSavingCourse(false);
    setEditCourseOpen(false);
  };

  const deleteCourse = async () => {
    if (!editCourseItem || deletingCourse) return;
    setDeletingCourse(true);
    await createClient().from("GolfTripCourse").delete().eq("id", editCourseItem.id);
    setTripCourses(prev => prev.filter(tc => tc.id !== editCourseItem.id));
    setDeletingCourse(false);
    setEditCourseOpen(false);
  };

  const addCourseToTrip = async () => {
    if (!selectedAddCourse || addingCourse) return;
    setAddingCourse(true);
    const supabase = createClient();
    const newId = crypto.randomUUID();
    const { error } = await supabase.from("GolfTripCourse").insert({ id: newId, tripId: id as string, courseId: selectedAddCourse.id, playDate: addPlayDate || null, teeTime: addTeeTime || null, accommodation: addAccom.trim() || null, sortOrder: tripCourses.length });
    if (!error) {
      setTripCourses(prev => [...prev, {
        id: newId, courseId: selectedAddCourse.id, playDate: addPlayDate || null, teeTime: addTeeTime || null, accommodation: addAccom.trim() || null, sortOrder: tripCourses.length,
        course: { id: selectedAddCourse.id, name: selectedAddCourse.name, city: selectedAddCourse.city, state: selectedAddCourse.state, uploadCount: 0, logoUrl: null },
      }]);
      setAddCourseStep("search");
      setSelectedAddCourse(null);
      setCourseSearch("");
      setAddPlayDate(""); setAddTeeTime(""); setAddAccom("");
    }
    setAddingCourse(false);
  };

  const formatDate = (d: string | null) => {
    if (!d) return "";
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTeeTime = (t: string | null) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  const abbr = (name: string) => name.split(" ").filter(w => w.length > 2).map(w => w[0]).join("").slice(0, 3).toUpperCase() || "?";

  const tripAbbr = trip ? trip.name.split(" ").filter(w => w.length > 1).map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?";

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Loading...</div>
      </main>
    );
  }

  if (!trip) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff" }}>Trip not found</div>
        <button onClick={() => router.push("/lists")} style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "12px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Back to Lists</button>
      </main>
    );
  }

  const primaryCourseId = tripCourses[0]?.courseId;

  return (
    <>
      <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff", paddingBottom: 100 }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #07100a; }
          .clip-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
          .clip-thumb { position: relative; aspect-ratio: 9/16; border-radius: 8px; overflow: hidden; background: #0d2318; cursor: pointer; }
          .clip-thumb video, .clip-thumb img { width: 100%; height: 100%; object-fit: cover; }
          .feed-modal { position: fixed; inset: 0; z-index: 100; background: #000; overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; }
          .feed-modal::-webkit-scrollbar { display: none; }
          .feed-snap { scroll-snap-align: start; scroll-snap-stop: always; height: 100dvh; position: relative; background: #000; flex-shrink: 0; }
          .section-label { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.28); margin-bottom: 10px; }
          .course-card { display: flex; align-items: center; gap: 12px; padding: 13px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
          .course-card:last-child { border-bottom: none; }
          .invite-result { display: flex; align-items: center; gap: 10px; padding: 11px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .invite-result:last-child { border-bottom: none; }
          .course-result-row { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; }
          .course-result-row:last-child { border-bottom: none; }
          .course-result-row:active { opacity: 0.7; }
        `}</style>

        {/* Header */}
        <div style={{ padding: "52px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <button onClick={() => router.push("/lists")} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginTop: 2 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>

            {/* Trip avatar (display only — edit via pencil → Edit Trip) */}
            <div style={{ width: 80, height: 80, borderRadius: 20, flexShrink: 0, overflow: "hidden", background: "linear-gradient(135deg, rgba(77,168,98,0.3), rgba(45,122,66,0.2))", border: "1.5px solid rgba(77,168,98,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {uploadingImage ? (
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>...</div>
              ) : trip.imageUrl ? (
                <img src={trip.imageUrl} alt={trip.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 700, color: "#4da862" }}>{tripAbbr}</span>
              )}
            </div>
            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleTripImagePick} style={{ display: "none" }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>Golf Trip</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: trip.name.length > 22 ? 16 : trip.name.length > 14 ? 18 : 22, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>{trip.name}</div>
            </div>
            {isOwner && (
              <button
                onClick={() => { setEditName(trip.name); setEditDesc(trip.description || ""); setEditStart(trip.startDate || ""); setEditEnd(trip.endDate || ""); setEditOpen(true); }}
                style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginTop: 2 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
          </div>

          {(trip.startDate || trip.endDate) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, marginLeft: 46 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                {trip.startDate && formatDate(trip.startDate)}{trip.startDate && trip.endDate ? " → " : ""}{trip.endDate && formatDate(trip.endDate)}
              </span>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 46 }}>
            <div style={{ display: "flex" }}>
              {members.slice(0, 6).map((m, i) => (
                <div key={m.id} style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", border: "2px solid #07100a", background: "rgba(77,168,98,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: i > 0 ? -8 : 0, flexShrink: 0, zIndex: members.length - i }}>
                  {m.user.avatarUrl
                    ? <img src={m.user.avatarUrl} alt={m.user.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  }
                </div>
              ))}
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{members.length} {members.length === 1 ? "golfer" : "golfers"}</span>
            <button onClick={() => setInviteOpen(true)} style={{ marginLeft: "auto", background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 99, padding: "5px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#4da862", cursor: "pointer" }}>
              + Invite
            </button>
          </div>

          {trip.description && (
            <div style={{ marginTop: 12, marginLeft: 46, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{trip.description}</div>
          )}
        </div>

        {/* Courses */}
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Courses · {tripCourses.length}</div>
            <button
              onClick={() => { setAddCourseStep("search"); setCourseSearch(""); setCourseResults([]); setSelectedAddCourse(null); setAddPlayDate(""); setAddTeeTime(""); setAddAccom(""); setAddCourseOpen(true); }}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 99, padding: "5px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#4da862", cursor: "pointer" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Course
            </button>
          </div>

          {tripCourses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0 4px", color: "rgba(255,255,255,0.2)", fontFamily: "'Outfit', sans-serif", fontSize: 13, lineHeight: 1.7 }}>
              No courses yet.<br />Tap <span style={{ color: "#4da862" }}>+ Add Course</span> to build your itinerary.
            </div>
          ) : (
            <div>
              {tripCourses.map(tc => (
                <div key={tc.id} style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {/* Delete zone revealed on swipe */}
                  <div
                    onClick={async () => { await createClient().from("GolfTripCourse").delete().eq("id", tc.id); setTripCourses(prev => prev.filter(c => c.id !== tc.id)); setSwipedId(null); }}
                    style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 80, background: "#c0392b", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  >
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#fff" }}>Delete</span>
                  </div>

                  {/* Swipeable row */}
                  <div
                    ref={el => { swipeCardRef.current[tc.id] = el; }}
                    className="course-card"
                    style={{ borderBottom: "none", background: "#07100a", position: "relative", transform: swipedId === tc.id ? "translateX(-80px)" : "translateX(0)", transition: "transform 0.2s ease" }}
                    onTouchStart={e => {
                      swipeTouchStartX.current = e.touches[0].clientX;
                      swipeTouchStartY.current = e.touches[0].clientY;
                      swipeCurrentX.current = swipedId === tc.id ? -80 : 0;
                    }}
                    onTouchMove={e => {
                      const dx = e.touches[0].clientX - swipeTouchStartX.current;
                      const dy = e.touches[0].clientY - swipeTouchStartY.current;
                      if (Math.abs(dy) > Math.abs(dx)) return; // vertical scroll
                      const base = swipedId === tc.id ? -80 : 0;
                      const next = Math.max(-80, Math.min(0, base + dx));
                      const el = swipeCardRef.current[tc.id];
                      if (el) { el.style.transition = "none"; el.style.transform = `translateX(${next}px)`; }
                      swipeCurrentX.current = next;
                    }}
                    onTouchEnd={() => {
                      const el = swipeCardRef.current[tc.id];
                      if (el) el.style.transition = "transform 0.2s ease";
                      if (swipeCurrentX.current < -40) {
                        setSwipedId(tc.id);
                        if (el) el.style.transform = "translateX(-80px)";
                      } else {
                        setSwipedId(null);
                        if (el) el.style.transform = "translateX(0)";
                      }
                    }}
                    onClick={() => { if (swipedId === tc.id) { setSwipedId(null); } }}
                  >
                    <div onClick={e => { if (swipedId === tc.id) { e.stopPropagation(); setSwipedId(null); return; } router.push(`/courses/${tc.course.id}`); }} style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", cursor: "pointer" }}>
                      {tc.course.logoUrl
                        ? <img src={tc.course.logoUrl} alt={tc.course.name} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
                        : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#4da862" }}>{abbr(tc.course.name)}</span>
                      }
                    </div>
                    <div onClick={e => { if (swipedId === tc.id) { e.stopPropagation(); setSwipedId(null); return; } router.push(`/courses/${tc.course.id}`); }} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tc.course.name}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginTop: 3 }}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{[tc.course.city, tc.course.state].filter(Boolean).join(", ")}</span>
                        {tc.playDate && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(77,168,98,0.8)" }}>📅 {formatDate(tc.playDate)}</span>}
                        {tc.teeTime && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>⏰ {formatTeeTime(tc.teeTime)}</span>}
                        {tc.accommodation && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>🏨 {tc.accommodation}</span>}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); openEditCourse(tc); }} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trip Clips */}
        <div style={{ padding: "24px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Trip Clips · {clips.length}</div>
            <button
              onClick={() => router.push(`/upload${primaryCourseId ? `?courseId=${primaryCourseId}&tripId=${id}` : `?tripId=${id}`}`)}
              style={{ background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 99, padding: "5px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#4da862", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7-7 7 7"/></svg>
              Add Clip
            </button>
          </div>
          {clips.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: "rgba(255,255,255,0.2)", fontFamily: "'Outfit', sans-serif", fontSize: 13, lineHeight: 1.6 }}>
              No clips yet.<br />Be the first to capture this trip!
            </div>
          ) : (
            <div className="clip-grid">
              {clips.map((clip, i) => (
                <div key={clip.id} className="clip-thumb" onClick={() => { setFeedIndex(i); setFeedOpen(true); }}>
                  {clip.mediaType === "VIDEO"
                    ? <HlsVideo src={getVideoSrc(clip.mediaUrl, clip.cloudflareVideoId)} muted playsInline preload="none" />
                    : <img src={clip.mediaUrl} alt="clip" />
                  }
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }} />
                  {clip.mediaType === "VIDEO" && (
                    <div style={{ position: "absolute", top: "38%", left: "50%", transform: "translate(-50%,-50%)", width: 26, height: 26, borderRadius: "50%", background: "rgba(77,168,98,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                  )}
                  {!clip.tripPublic && (
                    <div style={{ position: "absolute", top: 5, left: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Clip feed modal */}
      {feedOpen && (
        <div className="feed-modal" ref={feedRef} onScroll={handleFeedScroll}>
          <button onClick={() => { setFeedOpen(false); Object.values(videoRefs.current).forEach(v => { if (v) { v.pause(); v.currentTime = 0; } }); }} style={{ position: "fixed", top: 52, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 110 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          <button onClick={() => setMuted(m => !m)} style={{ position: "fixed", top: 52, right: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 110 }}>
            {muted
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            }
          </button>
          {clips.map((clip, i) => (
            <div key={clip.id} className="feed-snap">
              {clip.mediaType === "VIDEO"
                ? <HlsVideo ref={el => { videoRefs.current[clip.id] = el as HTMLVideoElement | null; }} src={getVideoSrc(clip.mediaUrl, clip.cloudflareVideoId)} loop muted={muted} playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <img src={clip.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              }
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85) 100%)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 16px 80px" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{trip.name}</div>
                {clip.strategyNote && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{clip.strategyNote}</div>}
                {!clip.tripPublic && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, background: "rgba(0,0,0,0.4)", borderRadius: 99, padding: "3px 10px" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Trip only</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite sheet */}
      {inviteOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => { setInviteOpen(false); setInviteQuery(""); setInviteResults([]); }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(13,35,24,0.98)", backdropFilter: "blur(20px)", borderRadius: "20px 20px 0 0", padding: "16px 20px 40px", maxHeight: "75vh", display: "flex", flexDirection: "column" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 18px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 14 }}>Invite a Golfer</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(77,168,98,0.35)", borderRadius: 12, padding: "11px 14px", marginBottom: 14 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input autoFocus value={inviteQuery} onChange={e => setInviteQuery(e.target.value)} placeholder="Search by username..." style={{ background: "none", border: "none", outline: "none", flex: 1, fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff" }} />
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {inviteResults.length === 0 && inviteQuery.length >= 2 && (
                <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.25)", fontFamily: "'Outfit', sans-serif", fontSize: 13 }}>No users found</div>
              )}
              {inviteResults.map(u => (
                <div key={u.id} className="invite-result">
                  <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(77,168,98,0.3)", background: "rgba(77,168,98,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {u.avatarUrl ? <img src={u.avatarUrl} alt={u.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>{u.displayName}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>@{u.username}</div>
                  </div>
                  <button onClick={() => inviteUser(u.id)} disabled={inviting === u.id} style={{ background: "#2d7a42", border: "none", borderRadius: 99, padding: "7px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: inviting === u.id ? 0.5 : 1 }}>
                    {inviting === u.id ? "..." : "Invite"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit trip sheet */}
      {editOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => setEditOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(13,35,24,0.98)", backdropFilter: "blur(20px)", borderRadius: "20px 20px 0 0", padding: "16px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 18px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 18 }}>Edit Trip</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Trip photo */}
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Trip Photo <span style={{ fontWeight: 400 }}>(optional)</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, overflow: "hidden", background: "linear-gradient(135deg, rgba(77,168,98,0.3), rgba(45,122,66,0.2))", border: "1.5px solid rgba(77,168,98,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {trip.imageUrl
                      ? <img src={trip.imageUrl} alt={trip.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, color: "#4da862" }}>{tripAbbr}</span>
                    }
                  </div>
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)", cursor: "pointer", textAlign: "left" }}
                  >
                    {uploadingImage ? "Uploading..." : trip.imageUrl ? "Change photo" : "Upload photo"}
                  </button>
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>Trip Name</div>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Trip name" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }} />
              </div>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>Description <span style={{ fontWeight: 400 }}>(optional)</span></div>
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="What's this trip about?" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }} />
              </div>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>Trip Dates</div>
                <DateRangePicker startDate={editStart} endDate={editEnd} onChange={(s, e) => { setEditStart(s); setEditEnd(e); }} />
              </div>
            </div>
            <button onClick={saveEdit} disabled={!editName.trim() || saving} style={{ width: "100%", marginTop: 20, background: "#2d7a42", border: "none", borderRadius: 12, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: (!editName.trim() || saving) ? 0.5 : 1 }}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {confirmDelete ? (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Cancel</button>
                <button onClick={handleDeleteTrip} disabled={deletingTrip} style={{ flex: 1, background: "rgba(200,60,60,0.12)", border: "1px solid rgba(200,60,60,0.3)", borderRadius: 12, padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(220,100,100,0.9)", cursor: "pointer" }}>
                  {deletingTrip ? "Deleting…" : "Confirm Delete"}
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{ width: "100%", marginTop: 10, background: "none", border: "1px solid rgba(200,60,60,0.2)", borderRadius: 12, padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(200,80,80,0.6)", cursor: "pointer" }}>
                Delete Trip
              </button>
            )}
          </div>
        </div>
      )}

      {/* Edit course sheet */}
      {editCourseOpen && editCourseItem && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => setEditCourseOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(13,35,24,0.98)", backdropFilter: "blur(20px)", borderRadius: "20px 20px 0 0", padding: "16px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 18px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Edit Course</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862", marginBottom: 20 }}>{editCourseItem.course.name}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>Play Date <span style={{ fontWeight: 400 }}>(optional)</span></div>
                <input type="date" value={editCPlayDate} onChange={e => setEditCPlayDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: editCPlayDate ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
              </div>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>Tee Time <span style={{ fontWeight: 400 }}>(optional)</span></div>
                <input type="time" value={editCTeeTime} onChange={e => setEditCTeeTime(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: editCTeeTime ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
              </div>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>Where you're staying <span style={{ fontWeight: 400 }}>(optional)</span></div>
                <input value={editCAccom} onChange={e => setEditCAccom(e.target.value)} placeholder="e.g. Marriott Myrtle Beach" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }} />
              </div>
            </div>
            <button onClick={saveCourseEdit} disabled={savingCourse} style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer", marginBottom: 10 }}>
              {savingCourse ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={deleteCourse} disabled={deletingCourse} style={{ width: "100%", background: "rgba(200,60,60,0.1)", border: "1px solid rgba(200,60,60,0.3)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(220,100,100,0.9)", cursor: "pointer" }}>
              {deletingCourse ? "Removing..." : "Remove from Trip"}
            </button>
          </div>
        </div>
      )}

      {/* Add course sheet */}
      {addCourseOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => setAddCourseOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(13,35,24,0.98)", backdropFilter: "blur(20px)", borderRadius: "20px 20px 0 0", padding: "16px 20px 40px", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 18px" }} />

            {addCourseStep === "search" && (
              <>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 14 }}>Add a Course</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(77,168,98,0.35)", borderRadius: 12, padding: "11px 14px", marginBottom: 14 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input autoFocus value={courseSearch} onChange={e => setCourseSearch(e.target.value)} placeholder="Search by course name or city..." style={{ background: "none", border: "none", outline: "none", flex: 1, fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff" }} />
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {courseSearchLoading && <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.25)", fontFamily: "'Outfit', sans-serif", fontSize: 13 }}>Searching...</div>}
                  {!courseSearchLoading && courseSearch.length >= 2 && courseResults.length === 0 && (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.25)", fontFamily: "'Outfit', sans-serif", fontSize: 13 }}>No courses found</div>
                  )}
                  {courseResults.map(c => (
                    <div key={c.id} className="course-result-row" onClick={() => { setSelectedAddCourse(c); setAddCourseStep("details"); }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        {c.logoUrl
                          ? <img src={c.logoUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
                          : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#4da862" }}>{abbr(c.name)}</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{[c.city, c.state].filter(Boolean).join(", ")} · {c.holeCount} holes</div>
                      </div>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                  ))}
                </div>
              </>
            )}

            {addCourseStep === "details" && selectedAddCourse && (
              <>
                <button onClick={() => setAddCourseStep("search")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.45)", fontSize: 12, fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", gap: 4, marginBottom: 14, padding: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Back
                </button>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Course Details</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862", marginBottom: 20 }}>{selectedAddCourse.name}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>Play Date <span style={{ fontWeight: 400 }}>(optional)</span></div>
                    <input type="date" value={addPlayDate} onChange={e => setAddPlayDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: addPlayDate ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>Tee Time <span style={{ fontWeight: 400 }}>(optional)</span></div>
                    <input type="time" value={addTeeTime} onChange={e => setAddTeeTime(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: addTeeTime ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>Where you're staying <span style={{ fontWeight: 400 }}>(optional)</span></div>
                    <input value={addAccom} onChange={e => setAddAccom(e.target.value)} placeholder="e.g. Marriott Myrtle Beach" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }} />
                  </div>
                </div>
                <button onClick={addCourseToTrip} disabled={addingCourse} style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 12, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: addingCourse ? "default" : "pointer", boxShadow: "0 2px 12px rgba(45,122,66,0.3)" }}>
                  {addingCourse ? "Adding..." : "Add to Trip ✓"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
}
