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
  ryderCupEnabled?: boolean;
  redTeamName?: string | null;
  blueTeamName?: string | null;
  redTeamScore?: number;
  blueTeamScore?: number;
};

type RyderAssignment = { userId: string; team: "RED" | "BLUE" };

type TripCourse = {
  id: string;
  courseId: string;
  secondaryCourseId?: string | null;
  playDate: string | null;
  teeTime: string | null;
  accommodation: string | null;
  sortOrder: number;
  course: { id: string; name: string; city: string; state: string; uploadCount: number; logoUrl: string | null; coverImageUrl: string | null; holeCount?: number };
  secondaryCourse?: { id: string; name: string; city: string; state: string; uploadCount: number; logoUrl: string | null; coverImageUrl: string | null; holeCount?: number } | null;
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

type TripMessageWithUser = {
  id: string; body: string; createdAt: string; userId: string;
  user: { id: string; displayName: string; avatarUrl: string | null };
};

type TeeBox = { id: string; color: string; customLabel: string | null; slope: number | null; rating: number | null };

type GamePlayer = { userId: string; displayName: string; avatarUrl: string | null; handicapIndex: number; teamId: string };

type TripGameRecord = {
  id: string; courseId: string; courseName: string; format: string;
  formatConfig: Record<string, unknown>; players: any[]; gameSheet: string; shareText: string; createdAt: string;
  courseLogoUrl?: string | null;
};

const GAME_FORMATS = [
  { id: "nassau", name: "Nassau", desc: "3 bets: front 9, back 9, full 18" },
  { id: "skins", name: "Skins", desc: "Win each hole, ties carry over" },
  { id: "match_play", name: "Match Play", desc: "Win holes, not total strokes" },
  { id: "stableford", name: "Stableford", desc: "Points per hole: bogey=1, par=2, birdie=3+" },
  { id: "best_ball", name: "Best Ball", desc: "Team: best net score per hole counts" },
  { id: "scramble", name: "Scramble", desc: "All play from the best shot" },
];

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

  // Ryder Cup state
  const [ryderAssignments, setRyderAssignments] = useState<RyderAssignment[]>([]);
  const [ryderSetupOpen, setRyderSetupOpen] = useState(false);
  const [editingRedScore, setEditingRedScore] = useState(false);
  const [editingBlueScore, setEditingBlueScore] = useState(false);

  const [membersOpen, setMembersOpen] = useState(false);

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
  const [addCourseStep, setAddCourseStep] = useState<"search" | "details" | "pairSearch">("search");
  const [courseSearch, setCourseSearch] = useState("");
  const [courseResults, setCourseResults] = useState<CourseResult[]>([]);
  const [courseSearchLoading, setCourseSearchLoading] = useState(false);
  const [selectedAddCourse, setSelectedAddCourse] = useState<CourseResult | null>(null);
  // 9+9 pairing state
  const [pairCourse, setPairCourse] = useState<CourseResult | null>(null);
  const [pairSearch, setPairSearch] = useState("");
  const [pairResults, setPairResults] = useState<CourseResult[]>([]);
  const [pairSearchLoading, setPairSearchLoading] = useState(false);
  const pairSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addPlayDate, setAddPlayDate] = useState("");
  const [addTeeTime, setAddTeeTime] = useState("");
  const [addAccom, setAddAccom] = useState("");
  const [addingCourse, setAddingCourse] = useState(false);
  const courseSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Message board
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<TripMessageWithUser[]>([]);
  const [msgBody, setMsgBody] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [chatError, setChatError] = useState("");
  const [msgsLoading, setMsgsLoading] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);

  // Games
  const [games, setGames] = useState<TripGameRecord[]>([]);
  const [gameOpen, setGameOpen] = useState(false);
  const [gameStep, setGameStep] = useState(1);
  const [generatingGame, setGeneratingGame] = useState(false);
  const [viewGameOpen, setViewGameOpen] = useState(false);
  const [viewGame, setViewGame] = useState<TripGameRecord | null>(null);
  // Scorecard verify sheet — opens over the game view so users can confirm
  // par/yardage/handicap-rank without losing the game context.
  const [scorecardSheetOpen, setScorecardSheetOpen] = useState(false);
  // Share-the-round chooser sheet: lets the user pick between attaching the
  // beauty PNG file or sending an iMessage-friendly link with og:image.
  const [sendRoundChooserOpen, setSendRoundChooserOpen] = useState(false);
  const [sendingMode, setSendingMode] = useState<"image" | "link" | null>(null);
  const [scorecardHoles, setScorecardHoles] = useState<Array<{ holeNumber: number; par: number | null; yardage: number | null; handicapRank: number | null }>>([]);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  async function openScorecardSheet(courseId: string) {
    setScorecardSheetOpen(true);
    setScorecardLoading(true);
    const { data } = await createClient()
      .from("Hole")
      .select("holeNumber, par, yardage, handicapRank")
      .eq("courseId", courseId)
      .order("holeNumber");
    setScorecardHoles((data as any) ?? []);
    setScorecardLoading(false);
  }
  const [gameCourseId, setGameCourseId] = useState("");
  const [gameCourseName, setGameCourseName] = useState("");
  const [gameTeeBoxes, setGameTeeBoxes] = useState<TeeBox[]>([]);
  const [gameTeeId, setGameTeeId] = useState("");
  const [gameTeeSlope, setGameTeeSlope] = useState(113);
  const [gameTeeRating, setGameTeeRating] = useState(72.0);
  const [gameCoursePar, setGameCoursePar] = useState(72);
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([]);
  const [gameFormat, setGameFormat] = useState("");
  const [gameNassauFront, setGameNassauFront] = useState("5");
  const [gameNassauBack, setGameNassauBack] = useState("5");
  const [gameNassauTotal, setGameNassauTotal] = useState("5");
  const [gameSkinsAmt, setGameSkinsAmt] = useState("5");
  const [gameSkinsCarryover, setGameSkinsCarryover] = useState(true);
  const [gameHoleHandicaps, setGameHoleHandicaps] = useState<number[]>(Array(18).fill(0));
  const [gameHoleHandicapsKnown, setGameHoleHandicapsKnown] = useState(false);
  const [gameHandicapWarning, setGameHandicapWarning] = useState(false);
  const [tripImageExpanded, setTripImageExpanded] = useState(false);
  const [gameError, setGameError] = useState("");
  const [coursesWithHandicaps, setCoursesWithHandicaps] = useState<Set<string>>(new Set());
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);

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

      const { data: tcData } = await supabase.from("GolfTripCourse").select("id, courseId, secondaryCourseId, playDate, teeTime, accommodation, sortOrder").eq("tripId", id);
      if (tcData && tcData.length > 0) {
        const allCourseIds = [
          ...tcData.map((tc: any) => tc.courseId),
          ...tcData.map((tc: any) => tc.secondaryCourseId).filter(Boolean),
        ];
        const { data: coursesData } = await supabase.from("Course").select("id, name, city, state, uploadCount, logoUrl, coverImageUrl, holeCount").in("id", allCourseIds);
        const mapped = tcData.map((tc: any) => ({
          ...tc,
          course: coursesData?.find((c: any) => c.id === tc.courseId) || { id: tc.courseId, name: "Unknown", city: "", state: "", uploadCount: 0, logoUrl: null, coverImageUrl: null },
          secondaryCourse: tc.secondaryCourseId ? (coursesData?.find((c: any) => c.id === tc.secondaryCourseId) || null) : null,
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

      // Ryder Cup team assignments
      const { data: ryderData } = await supabase.from("GolfTripRyderTeam").select("userId, team").eq("tripId", id);
      if (ryderData) setRyderAssignments(ryderData as RyderAssignment[]);

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

      const { data: gamesData } = await supabase.from("TripGame").select("id, courseId, courseName, format, formatConfig, players, gameSheet, shareText, createdAt").eq("tripId", id).order("createdAt", { ascending: false });
      if (gamesData && gamesData.length > 0) {
        const gcIds = [...new Set(gamesData.map((g: any) => g.courseId))];
        const { data: gcLogos } = await supabase.from("Course").select("id, logoUrl").in("id", gcIds);
        const logoMap: Record<string, string | null> = {};
        gcLogos?.forEach((c: any) => { logoMap[c.id] = c.logoUrl; });
        setGames(gamesData.map((g: any) => ({ ...g, courseLogoUrl: logoMap[g.courseId] || null })) as TripGameRecord[]);
      }

      // Check which trip courses have complete hole handicap data. A course
      // is 'complete' when every Hole row has a handicapRank > 0 AND the row
      // count matches the course's declared holeCount (9 or 18).
      if (tcData && tcData.length > 0) {
        const allCourseIds = [
          ...tcData.map((tc: any) => tc.courseId),
          ...tcData.map((tc: any) => tc.secondaryCourseId).filter(Boolean),
        ];
        const [{ data: coursesMeta }, { data: holesData }] = await Promise.all([
          supabase.from("Course").select("id, holeCount").in("id", allCourseIds),
          supabase.from("Hole").select("courseId, handicapRank").in("courseId", allCourseIds),
        ]);
        const holeCountById: Record<string, number> = {};
        (coursesMeta ?? []).forEach((c: any) => { holeCountById[c.id] = c.holeCount; });
        const haveHandicaps = new Set<string>();
        allCourseIds.forEach((cid: string) => {
          const expected = holeCountById[cid] ?? 18;
          const holes = (holesData || []).filter((h: any) => h.courseId === cid);
          if (holes.length === expected && holes.every((h: any) => h.handicapRank > 0)) haveHandicaps.add(cid);
        });
        setCoursesWithHandicaps(haveHandicaps);
      }

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

  // Poll messages while chat is open
  useEffect(() => {
    if (!chatOpen) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 8000);
    return () => clearInterval(interval);
  }, [chatOpen]);

  // Lock body scroll + size the chat overlay to the visual viewport so iOS
  // doesn't shift the page up when the keyboard appears.
  useEffect(() => {
    if (!chatOpen) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width, overflow: body.style.overflow };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    const vv = window.visualViewport;
    const sync = () => {
      const el = document.getElementById("trip-chat-overlay");
      if (!el || !vv) return;
      el.style.height = `${vv.height}px`;
      el.style.transform = `translateY(${vv.offsetTop}px)`;
    };
    if (vv) {
      sync();
      vv.addEventListener("resize", sync);
      vv.addEventListener("scroll", sync);
    }

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
      if (vv) {
        vv.removeEventListener("resize", sync);
        vv.removeEventListener("scroll", sync);
      }
    };
  }, [chatOpen]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (chatOpen && messages.length > 0) {
      setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [chatOpen, messages.length]);

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
      sendPushToUser("trip_invite", inviteeId, id as string);
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

  // ── Ryder Cup handlers ───────────────────────────────────────────────────
  const updateRyderScore = async (team: "RED" | "BLUE", delta: number) => {
    if (!isOwner || !trip) return;
    const field = team === "RED" ? "redTeamScore" : "blueTeamScore";
    const next = Math.max(0, (trip[field] ?? 0) + delta);
    setTrip(prev => prev ? { ...prev, [field]: next } : prev);
    await createClient().from("GolfTrip").update({ [field]: next }).eq("id", trip.id);
  };

  const setRyderScore = async (team: "RED" | "BLUE", value: number) => {
    if (!isOwner || !trip) return;
    const field = team === "RED" ? "redTeamScore" : "blueTeamScore";
    const next = Math.max(0, isNaN(value) ? 0 : value);
    setTrip(prev => prev ? { ...prev, [field]: next } : prev);
    await createClient().from("GolfTrip").update({ [field]: next }).eq("id", trip.id);
  };

  const updateRyderTeamName = async (team: "RED" | "BLUE", name: string) => {
    if (!isOwner || !trip) return;
    const field = team === "RED" ? "redTeamName" : "blueTeamName";
    const value = name.length > 0 ? name : null;
    setTrip(prev => prev ? { ...prev, [field]: value } : prev);
    await createClient().from("GolfTrip").update({ [field]: value }).eq("id", trip.id);
  };

  const assignRyderMember = async (userId: string, team: "RED" | "BLUE" | null) => {
    if (!isOwner || !trip) return;
    const supabase = createClient();
    if (team === null) {
      setRyderAssignments(prev => prev.filter(a => a.userId !== userId));
      await supabase.from("GolfTripRyderTeam").delete().eq("tripId", trip.id).eq("userId", userId);
      return;
    }
    setRyderAssignments(prev => {
      const existing = prev.find(a => a.userId === userId);
      if (existing) return prev.map(a => a.userId === userId ? { ...a, team } : a);
      return [...prev, { userId, team }];
    });
    await supabase.from("GolfTripRyderTeam").upsert(
      { id: crypto.randomUUID(), tripId: trip.id, userId, team },
      { onConflict: "tripId,userId" }
    );
  };

  const setRyderCupEnabled = async (enabled: boolean) => {
    if (!isOwner || !trip) return;
    setTrip(prev => prev ? { ...prev, ryderCupEnabled: enabled } : prev);
    await createClient().from("GolfTrip").update({ ryderCupEnabled: enabled }).eq("id", trip.id);

    // +15 pts the first time Ryder Cup is enabled on this trip — referenceId
    // dedupe means toggling off and back on doesn't re-award.
    if (enabled) {
      fetch("/api/points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable_ryder_cup", referenceId: trip.id }),
      }).catch(() => {});
    }
  };

  const teamColors = {
    RED:  { primary: "#c8102e", deep: "#9b1d2c", accentBg: "linear-gradient(135deg, #9b1d2c 0%, #c8102e 100%)" },
    BLUE: { primary: "#1e3a8a", deep: "#06143a", accentBg: "linear-gradient(135deg, #06143a 0%, #1e3a8a 100%)" },
  } as const;

  const teamOf = (userId: string): "RED" | "BLUE" | null =>
    ryderAssignments.find(a => a.userId === userId)?.team ?? null;

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
    // Pairing rule: both courses must be 9-hole. Server-side double-check.
    if (pairCourse && (selectedAddCourse.holeCount !== 9 || pairCourse.holeCount !== 9)) {
      console.warn("Pairing requires two 9-hole courses; aborting");
      return;
    }
    setAddingCourse(true);
    const supabase = createClient();
    const newId = crypto.randomUUID();
    const { error } = await supabase.from("GolfTripCourse").insert({
      id: newId,
      tripId: id as string,
      courseId: selectedAddCourse.id,
      secondaryCourseId: pairCourse?.id || null,
      playDate: addPlayDate || null,
      teeTime: addTeeTime || null,
      accommodation: addAccom.trim() || null,
      sortOrder: tripCourses.length,
    });
    if (!error) {
      setTripCourses(prev => [...prev, {
        id: newId,
        courseId: selectedAddCourse.id,
        secondaryCourseId: pairCourse?.id || null,
        playDate: addPlayDate || null,
        teeTime: addTeeTime || null,
        accommodation: addAccom.trim() || null,
        sortOrder: tripCourses.length,
        course: { id: selectedAddCourse.id, name: selectedAddCourse.name, city: selectedAddCourse.city, state: selectedAddCourse.state, uploadCount: 0, logoUrl: null, coverImageUrl: null, holeCount: selectedAddCourse.holeCount },
        secondaryCourse: pairCourse ? { id: pairCourse.id, name: pairCourse.name, city: pairCourse.city, state: pairCourse.state, uploadCount: 0, logoUrl: null, coverImageUrl: null, holeCount: pairCourse.holeCount } : null,
      }]);

      // Check if course has hole handicap data; notify admin if not
      const { data: holeCheck } = await supabase.from("Hole").select("handicapRank").eq("courseId", selectedAddCourse.id);
      const hasHandicaps = holeCheck && holeCheck.length === 18 && holeCheck.every((h: any) => h.handicapRank > 0);
      if (hasHandicaps) {
        setCoursesWithHandicaps(prev => new Set([...prev, selectedAddCourse.id]));
      } else {
        const { data: admins } = await supabase.from("User").select("id").eq("isAdmin", true);
        if (admins && admins.length > 0) {
          const now = new Date().toISOString();
          for (const admin of admins) {
            await supabase.from("Notification").insert({
              id: crypto.randomUUID(), userId: admin.id, type: "admin_alert",
              title: "Course needs scorecard data",
              body: `"${selectedAddCourse.name}" was added to a trip — hole handicap rankings may be missing`,
              linkUrl: `/courses/${selectedAddCourse.id}`,
              read: false, createdAt: now, updatedAt: now,
            });
          }
        }
      }

      setAddCourseStep("search");
      setSelectedAddCourse(null);
      setPairCourse(null);
      setPairSearch("");
      setPairResults([]);
      setCourseSearch("");
      setAddPlayDate(""); setAddTeeTime(""); setAddAccom("");
    }
    setAddingCourse(false);
  };

  // Pair-search debounce — same shape as the main course search but
  // forced-filter to holeCount=9 since you can only pair with another 9.
  const handlePairSearchChange = (val: string) => {
    setPairSearch(val);
    if (pairSearchDebounce.current) clearTimeout(pairSearchDebounce.current);
    if (val.trim().length < 2) { setPairResults([]); return; }
    pairSearchDebounce.current = setTimeout(async () => {
      setPairSearchLoading(true);
      const sb = createClient();
      const { data } = await sb
        .from("Course")
        .select("id, name, city, state, holeCount, logoUrl")
        .eq("holeCount", 9)
        .ilike("name", `%${val.trim()}%`)
        .order("uploadCount", { ascending: false })
        .limit(20);
      setPairResults((data ?? []).filter((c: any) => c.id !== selectedAddCourse?.id) as CourseResult[]);
      setPairSearchLoading(false);
    }, 250);
  };

  const fetchMessages = async () => {
    if (!id) return;
    setMsgsLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setMsgsLoading(false); return; }
    try {
      const res = await fetch(`/api/trips/${id}/messages`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const json = await res.json();
      if (json.messages) setMessages(json.messages);
    } catch { }
    setMsgsLoading(false);
  };

  const sendMessage = async () => {
    if (!msgBody.trim() || sendingMsg) return;
    setSendingMsg(true);
    setChatError("");
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setChatError("Not signed in."); setSendingMsg(false); return; }
    try {
      const res = await fetch(`/api/trips/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ body: msgBody.trim() }),
      });
      const json = await res.json();
      if (json.message) {
        setMessages(prev => [...prev, json.message]);
        setMsgBody("");
        setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      } else {
        setChatError(json.error || "Failed to send. Try again.");
      }
    } catch {
      setChatError("Network error. Try again.");
    }
    setSendingMsg(false);
  };

  const openGameCreator = async () => {
    setGameStep(1);
    setGameCourseId("");
    setGameCourseName("");
    setGameTeeBoxes([]);
    setGameTeeId("");
    setGameTeeSlope(113);
    setGameTeeRating(72.0);
    setGameCoursePar(72);
    setGameFormat("");
    setGameNassauFront("5"); setGameNassauBack("5"); setGameNassauTotal("5");
    setGameSkinsAmt("5"); setGameSkinsCarryover(true);
    setGameHoleHandicaps(Array(18).fill(0));
    setGameHoleHandicapsKnown(false);
    setGameError("");
    // Pre-populate players from members with their handicap indexes
    const supabase = createClient();
    const memberUserIds = members.map(m => m.userId);
    const { data: usersWithHI } = await supabase.from("User").select("id, displayName, avatarUrl, handicapIndex").in("id", memberUserIds);
    const initialPlayers: GamePlayer[] = (usersWithHI || []).map((u: any) => ({
      userId: u.id,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      handicapIndex: u.handicapIndex ?? 0,
      teamId: "A",
    }));
    setGamePlayers(initialPlayers);
    setGameOpen(true);
  };

  const handleSelectGameCourse = async (courseId: string, courseName: string, secondaryCourseId?: string | null, secondaryName?: string | null) => {
    setGameCourseId(courseId);
    // Combined name for paired stops
    setGameCourseName(secondaryCourseId && secondaryName ? `${courseName} + ${secondaryName}` : courseName);
    setGameTeeBoxes([]);
    setGameTeeId("");
    const supabase = createClient();
    // Fetch tee boxes for this course (primary only — pairing tees aren't a concept)
    const { data: teeBoxes } = await supabase.from("TeeBox").select("id, color, customLabel, slope, rating").eq("courseId", courseId).order("slope", { ascending: false });
    if (teeBoxes && teeBoxes.length > 0) {
      setGameTeeBoxes(teeBoxes as TeeBox[]);
      const firstTee = teeBoxes[0] as TeeBox;
      setGameTeeId(firstTee.id);
      setGameTeeSlope(firstTee.slope ?? 113);
      setGameTeeRating(firstTee.rating ?? 72.0);
    }

    if (secondaryCourseId) {
      // ── Paired 9+9 round ─────────────────────────────────────────────
      const [primaryRes, secondaryRes] = await Promise.all([
        supabase.from("Hole").select("holeNumber, par, handicapRank").eq("courseId", courseId).order("holeNumber"),
        supabase.from("Hole").select("holeNumber, par, handicapRank").eq("courseId", secondaryCourseId).order("holeNumber"),
      ]);
      const primaryHoles = (primaryRes.data ?? []).slice(0, 9);
      const secondaryHoles = (secondaryRes.data ?? []).slice(0, 9);

      if (primaryHoles.length === 9 && secondaryHoles.length === 9) {
        const stitchedPar = [...primaryHoles, ...secondaryHoles].reduce((s, h) => s + (h.par || 4), 0);
        setGameCoursePar(stitchedPar);

        // Stitch handicap ranks: front 9 = odd (1,3,5,7,9,11,13,15,17), back 9 = even.
        // Front rank R becomes (R*2 - 1), back rank R becomes (R*2).
        const stitchedRanks: number[] = [];
        for (const h of primaryHoles) {
          const r = h.handicapRank;
          stitchedRanks.push(r && r >= 1 && r <= 9 ? r * 2 - 1 : 0);
        }
        for (const h of secondaryHoles) {
          const r = h.handicapRank;
          stitchedRanks.push(r && r >= 1 && r <= 9 ? r * 2 : 0);
        }

        const isComplete = stitchedRanks.every((r) => r >= 1 && r <= 18);
        const sortedSet = [...stitchedRanks].sort((a, b) => a - b);
        const isValid1to18 = isComplete && sortedSet.every((v, i) => v === i + 1);

        setGameHoleHandicaps(stitchedRanks);
        setGameHoleHandicapsKnown(isValid1to18);
        setGameHandicapWarning(stitchedRanks.some((r) => r > 0) && !isValid1to18);
      } else {
        setGameCoursePar(72);
        setGameHoleHandicaps(Array(18).fill(0));
        setGameHoleHandicapsKnown(false);
      }
      return;
    }

    // ── Single 18-hole course (existing behavior) ─────────────────────
    const { data: holes } = await supabase.from("Hole").select("holeNumber, par, handicapRank").eq("courseId", courseId).order("holeNumber");
    if (holes && holes.length === 18) {
      const par = holes.reduce((sum: number, h: any) => sum + (h.par || 4), 0);
      setGameCoursePar(par);
      const ranks = holes.map((h: any) => h.handicapRank || 0);
      const hasAnyData = ranks.some((r: number) => r > 0);
      const sortedRanks = [...ranks].sort((a: number, b: number) => a - b);
      const isCompleteSet = ranks.length === 18 && sortedRanks.every((v: number, i: number) => v === i + 1);
      const isSequentialSentinel = isCompleteSet && ranks.every((v: number, i: number) => v === i + 1);
      const isValid = isCompleteSet && !isSequentialSentinel;

      setGameHoleHandicaps(isSequentialSentinel ? Array(18).fill(0) : ranks);
      setGameHoleHandicapsKnown(isValid);
      setGameHandicapWarning((hasAnyData && !isCompleteSet) || isSequentialSentinel);
    } else {
      setGameCoursePar(72);
      setGameHoleHandicaps(Array(18).fill(0));
      setGameHoleHandicapsKnown(false);
    }

    // If the scorecard is missing yardage, kick off an on-demand API fetch
    // in the background. When it returns, re-load the holes so step 5 (and
    // anyone else looking at the scorecard) gets fresh data without the
    // user having to do anything.
    const { data: existingHoles } = await supabase.from("Hole").select("yardage, handicapRank").eq("courseId", courseId);
    const yardageGap = (existingHoles ?? []).some(h => h.yardage == null);
    if (yardageGap) {
      fetch(`/api/courses/${courseId}/refresh-scorecard`, { method: "POST" })
        .then(r => r.json())
        .then(result => {
          if (!result?.matched) return;
          // Re-pull the now-filled hole data
          supabase.from("Hole").select("holeNumber, par, handicapRank").eq("courseId", courseId).order("holeNumber")
            .then(({ data: refreshed }) => {
              if (!refreshed || refreshed.length !== 18) return;
              const par = refreshed.reduce((s, h) => s + (h.par || 4), 0);
              setGameCoursePar(par);
              const ranks = refreshed.map(h => h.handicapRank || 0);
              const sorted = [...ranks].sort((a, b) => a - b);
              const valid = ranks.length === 18 && sorted.every((v, i) => v === i + 1) && !ranks.every((v, i) => v === i + 1);
              setGameHoleHandicaps(ranks);
              setGameHoleHandicapsKnown(valid);
              setGameHandicapWarning(false);
            });
        })
        .catch(() => {});
    }
  };

  const generateGame = async () => {
    if (generatingGame) return;
    if (gameHoleHandicaps.some(r => r <= 0)) {
      setGameError("Please enter a handicap rank (1–18) for all 18 holes.");
      return;
    }
    setGameError("");
    setGeneratingGame(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setGeneratingGame(false); return; }

    const formatConfig: Record<string, unknown> =
      gameFormat === "nassau" ? { frontAmount: gameNassauFront, backAmount: gameNassauBack, totalAmount: gameNassauTotal }
      : gameFormat === "skins" ? { skinsAmount: gameSkinsAmt, carryover: gameSkinsCarryover }
      : {};

    try {
      const res = await fetch(`/api/trips/${id}/game`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ courseId: gameCourseId, courseName: gameCourseName, coursePar: gameCoursePar, teeSlope: gameTeeSlope, teeRating: gameTeeRating, format: gameFormat, formatConfig, players: gamePlayers, holeHandicaps: gameHoleHandicaps }),
      });
      const json = await res.json();
      if (json.game) {
        // Hydrate courseLogoUrl from tripCourses since the API response
        // doesn't include it. The list view picks it up on next page load
        // via the logo lookup; this is just for the immediate view sheet.
        const logoUrl = tripCourses.find(tc => tc.courseId === gameCourseId)?.course.logoUrl ?? null;
        const hydrated = { ...json.game, courseLogoUrl: logoUrl };
        setGames(prev => [hydrated, ...prev]);
        setGameOpen(false);
        setViewGame(hydrated);
        setViewGameOpen(true);

        // +15 pts for generating a game — once per gameId
        fetch("/api/points/award", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create_game", referenceId: json.game.id }),
        }).catch(() => {});
      } else {
        setGameError(json.error || "Generation failed. Try again.");
      }
    } catch { setGameError("Network error. Try again."); }
    setGeneratingGame(false);
  };

  const deleteGame = async (gameId: string) => {
    if (deletingGameId) return;
    setDeletingGameId(gameId);
    await createClient().from("TripGame").delete().eq("id", gameId);
    setGames(prev => prev.filter(g => g.id !== gameId));
    setViewGameOpen(false);
    setViewGame(null);
    setDeletingGameId(null);
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

  // Round-mode = a 1-day, 1-course, 1-stop trip created via Quick Round.
  // The page UI adapts: eyebrow says "Upcoming Round", Ryder Cup banner hides
  // (rounds are too short for it), the Itinerary section header drops, Add
  // Course button hides (already have the one course), header icon swaps to
  // the course logo, and a Clone button appears so the user can spin off
  // another round with the same course/players.
  //
  // IMPORTANT: strip both dates to YYYY-MM-DD before comparing. Postgres/
  // PostgREST sometimes echoes a date column as "2026-05-20" and sometimes as
  // "2026-05-20T00:00:00" depending on how the row was touched; raw string
  // equality misclassifies single-day rounds as multi-day trips.
  const stripDate = (s: string | null | undefined) => s ? s.slice(0, 10) : "";
  const _start = stripDate(trip.startDate);
  const _end = stripDate(trip.endDate);
  const isRound = tripCourses.length === 1
    && !tripCourses[0]?.secondaryCourseId
    && !!_start && !!_end
    && _start === _end;
  const roundCourse = isRound ? tripCourses[0]?.course : null;

  async function cloneAsNewRound() {
    if (!isRound || !roundCourse || !user?.id) return;
    const supabase = createClient();
    const newTripId = crypto.randomUUID();
    const now = new Date().toISOString();
    const today = new Date().toISOString().slice(0, 10);
    const niceDate = new Date(today + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    await supabase.from("GolfTrip").insert({
      id: newTripId,
      name: `${roundCourse.name} — ${niceDate}`,
      createdBy: user.id,
      startDate: today,
      endDate: today,
      createdAt: now,
      updatedAt: now,
    });
    await supabase.from("GolfTripMember").insert({
      id: crypto.randomUUID(),
      tripId: newTripId,
      userId: user.id,
      role: "owner",
      createdAt: now,
    });
    // GolfTripCourse has no updatedAt column — don't send one or the insert silently fails
    const { error: tcErr } = await supabase.from("GolfTripCourse").insert({
      id: crypto.randomUUID(),
      tripId: newTripId,
      courseId: roundCourse.id,
      playDate: today,
      teeTime: tripCourses[0]?.teeTime ?? null,
      sortOrder: 0,
      createdAt: now,
    });
    if (tcErr) {
      console.error("Clone Round: failed to attach course", tcErr);
      alert(`Couldn't clone the round: ${tcErr.message}`);
      return;
    }
    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_trip", referenceId: newTripId }),
    }).catch(() => {});
    router.push(`/trips/${newTripId}`);
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
          .section-label { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 800; letter-spacing: 0.01em; color: #fff; margin-bottom: 10px; }
          .section-label .count { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; color: #4da862; letter-spacing: 0.04em; margin-left: 8px; vertical-align: 2px; }
          .course-card { display: flex; align-items: center; gap: 12px; padding: 13px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
          .course-card:last-child { border-bottom: none; }
          .invite-result { display: flex; align-items: center; gap: 10px; padding: 11px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .invite-result:last-child { border-bottom: none; }
          .course-result-row { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; }
          .course-result-row:last-child { border-bottom: none; }
          .course-result-row:active { opacity: 0.7; }
          .msg-bubble-me { background: #2d7a42; border-radius: 16px 16px 4px 16px; padding: 9px 13px; max-width: 78%; align-self: flex-end; }
          .msg-bubble-other { background: rgba(255,255,255,0.07); border-radius: 16px 16px 16px 4px; padding: 9px 13px; max-width: 78%; }
          .game-format-card { border-radius: 12px; border: 1.5px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); padding: 14px; cursor: pointer; transition: border-color 0.15s; }
          .game-format-card.selected { border-color: #4da862; background: rgba(77,168,98,0.1); }
          .game-format-card:active { opacity: 0.8; }
        `}</style>

        {/* Round-mode hero — cover photo at the top of the page with course
            name + date + tee time overlaid. This replaces the separate header
            card + the When card so course/date/time appears exactly once. */}
        {isRound && (() => {
          const cover = trip.imageUrl || roundCourse?.coverImageUrl;
          const tc = tripCourses[0];
          const dateLabel = tc?.playDate ? formatDate(tc.playDate) : (trip.startDate ? formatDate(trip.startDate) : null);
          const teeTimeRaw = tc?.teeTime;
          const formatTime12 = (t: string) => {
            const [hh, mm] = t.split(":").map(Number);
            if (Number.isNaN(hh)) return t;
            const period = hh >= 12 ? "PM" : "AM";
            const h12 = hh % 12 || 12;
            return `${h12}:${String(mm ?? 0).padStart(2, "0")} ${period}`;
          };
          return (
            <div style={{ position: "relative", width: "100%", aspectRatio: cover ? "16/9" : undefined, minHeight: cover ? undefined : 220, overflow: "hidden", background: cover ? "#0d1f12" : "linear-gradient(135deg, #1c4425 0%, #07100a 100%)" }}>
              {cover && (
                <img
                  src={cover}
                  alt={roundCourse?.name ?? trip.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              )}
              {/* Vertical dark scrim — readable text without burying the photo */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,16,10,0.30) 0%, rgba(7,16,10,0.35) 45%, rgba(7,16,10,0.92) 100%)", pointerEvents: "none" }} />

              {/* Edit pill — top-right */}
              {isOwner && (
                <button
                  onClick={() => { setEditName(trip.name); setEditDesc(trip.description || ""); setEditStart(trip.startDate || ""); setEditEnd(trip.endDate || ""); setEditOpen(true); }}
                  aria-label="Edit round"
                  style={{ position: "absolute", top: 14, right: 14, display: "flex", alignItems: "center", gap: 4, background: "rgba(7,16,10,0.55)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 99, padding: "6px 11px", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.95)", cursor: "pointer", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
              )}

              {/* Bottom overlay: course identity + when */}
              <div style={{ position: "absolute", left: 18, right: 18, bottom: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Upcoming Round</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
                  {(roundCourse?.logoUrl) && (
                    <div style={{ width: 52, height: 52, borderRadius: 12, background: "#fff", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
                      <img src={roundCourse.logoUrl} alt={roundCourse.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: roundCourse && roundCourse.name.length > 28 ? 22 : 26, fontWeight: 900, color: "#fff", lineHeight: 1.1, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
                      {roundCourse?.name ?? trip.name}
                    </div>
                    {roundCourse && (roundCourse.city || roundCourse.state) && (
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2, textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
                        {[roundCourse.city, roundCourse.state].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
                {(dateLabel || teeTimeRaw) && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                    {dateLabel && (
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.7)", lineHeight: 1 }}>{dateLabel}</div>
                    )}
                    {teeTimeRaw && (
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, color: "#4da862", fontWeight: 800, textShadow: "0 2px 10px rgba(0,0,0,0.7)", letterSpacing: "0.01em" }}>· {formatTime12(teeTimeRaw)}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Header
            In round-mode the entire avatar/name/date block is hidden — that
            content lives on the cover photo overlay above. Only the
            Members/Chat/Invite row renders so golfers stay one tap away. */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ padding: isRound ? "12px 20px" : "12px 20px 14px" }}>
            {!isRound && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
              <div
                onClick={() => trip.imageUrl && setTripImageExpanded(true)}
                style={{ width: 66, height: 66, borderRadius: 16, flexShrink: 0, overflow: "hidden", background: trip.imageUrl || (isRound && roundCourse?.logoUrl) ? "#fff" : "linear-gradient(135deg, rgba(77,168,98,0.3), rgba(45,122,66,0.2))", border: "1.5px solid rgba(77,168,98,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: trip.imageUrl ? "pointer" : "default" }}
              >
                {uploadingImage ? (
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>...</div>
                ) : trip.imageUrl ? (
                  <img src={trip.imageUrl} alt={trip.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : isRound && roundCourse?.logoUrl ? (
                  <img src={roundCourse.logoUrl} alt={roundCourse.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, color: "#4da862" }}>{tripAbbr}</span>
                )}
              </div>
              <input ref={imageInputRef} type="file" accept="image/*" onChange={handleTripImagePick} style={{ display: "none" }} />

              <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{isRound ? "Upcoming Round" : "Golf Trip"}</div>
                  {isOwner && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      {isRound && (
                        <button
                          onClick={cloneAsNewRound}
                          aria-label="Clone this round"
                          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: "2px 4px", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)", cursor: "pointer" }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="12" height="12" rx="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                          Clone
                        </button>
                      )}
                      <button
                        onClick={() => { setEditName(trip.name); setEditDesc(trip.description || ""); setEditStart(trip.startDate || ""); setEditEnd(trip.endDate || ""); setEditOpen(true); }}
                        aria-label="Edit trip"
                        style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: "2px 4px", margin: "-2px -4px -2px 0", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)", cursor: "pointer", flexShrink: 0 }}
                      >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    // Bigger overall but auto-shrink so long names still fit one line
                    fontSize: trip.name.length > 28 ? 20 : trip.name.length > 22 ? 22 : trip.name.length > 16 ? 26 : 30,
                    fontWeight: 900,
                    color: "#fff",
                    lineHeight: 1.15,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={trip.name}
                >
                  {trip.name}
                </div>
                {(trip.startDate || trip.endDate) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                      {isRound
                        ? (trip.startDate && formatDate(trip.startDate))
                        : <>{trip.startDate && formatDate(trip.startDate)}{trip.startDate && trip.endDate ? " → " : ""}{trip.endDate && formatDate(trip.endDate)}</>
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Members + chat + invite — centered */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => setMembersOpen(true)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <div style={{ display: "flex" }}>
                  {members.slice(0, 4).map((m, i) => {
                    const t = trip.ryderCupEnabled ? teamOf(m.userId) : null;
                    const ringColor = t === "RED" ? "#c8102e" : t === "BLUE" ? "#3b82f6" : "#07100a";
                    return (
                      <div key={m.id} style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: `2px solid ${ringColor}`, background: "rgba(77,168,98,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: i > 0 ? -6 : 0, flexShrink: 0, zIndex: members.length - i }}>
                        {m.user.avatarUrl
                          ? <img src={m.user.avatarUrl} alt={m.user.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        }
                      </div>
                    );
                  })}
                </div>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.15)" }}>{members.length} {members.length === 1 ? "golfer" : "golfers"}</span>
              </button>
              {/* Chat hidden in round-mode — too short of a session to need it; a quick text outside the app covers it */}
              {!isRound && (
                <button onClick={() => setChatOpen(true)} style={{ background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.4)", borderRadius: 99, padding: "5px 11px", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#4da862", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Chat{messages.length > 0 ? ` · ${messages.length}` : ""}
                </button>
              )}
            </div>

          </div>
        </div>

        {/* ── Ryder Cup — hidden in round-mode (a single-day round is too short for it) */}
        {!isRound && (trip.ryderCupEnabled ? (
          <RyderCupHero
            trip={trip}
            members={members}
            ryderAssignments={ryderAssignments}
            isOwner={isOwner}
            teamColors={teamColors}
            editingRedScore={editingRedScore}
            editingBlueScore={editingBlueScore}
            setEditingRedScore={setEditingRedScore}
            setEditingBlueScore={setEditingBlueScore}
            updateRyderScore={updateRyderScore}
            setRyderScore={setRyderScore}
            updateRyderTeamName={updateRyderTeamName}
            onEditTeams={() => setRyderSetupOpen(true)}
            onDisable={() => setRyderCupEnabled(false)}
          />
        ) : (
          isOwner && (
            <div style={{ padding: "20px 16px 0" }}>
              <button
                onClick={() => setRyderSetupOpen(true)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(212,160,23,0.35)",
                  background: "linear-gradient(135deg, rgba(155,29,44,0.18) 0%, rgba(30,58,138,0.18) 100%)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: "linear-gradient(135deg, #c8102e 50%, #1e3a8a 50%)",
                  border: "2px solid #d4a017",
                  flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                    <path d="M4 22h16"/>
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>Make this a Ryder Cup</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>Red vs Blue · custom team names · half points</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(212,160,23,0.7)" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          ))
        )}

        {/* Courses */}
        <div style={{ padding: "16px 20px 0" }}>
          {/* Section header + Add Course button are hidden in round-mode —
              the course is already chosen and a round only has one stop, so
              the section reduces to just the course card itself. */}
          {!isRound && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>
              Itinerary
              {tripCourses.length > 0 && (() => {
                const courseCount = tripCourses.length;
                const totalHoles = tripCourses.reduce(
                  (sum, tc) => sum + (tc.course.holeCount ?? 18) + (tc.secondaryCourse?.holeCount ?? 0),
                  0
                );
                return (
                  <span className="count">
                    {courseCount} {courseCount === 1 ? "course" : "courses"} · {totalHoles} holes
                  </span>
                );
              })()}
            </div>
            <button
              onClick={() => { setAddCourseStep("search"); setCourseSearch(""); setCourseResults([]); setSelectedAddCourse(null); setPairCourse(null); setPairSearch(""); setPairResults([]); setAddPlayDate(""); setAddTeeTime(""); setAddAccom(""); setAddCourseOpen(true); }}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 99, padding: "5px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#4da862", cursor: "pointer" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Course
            </button>
          </div>
          )}

          {/* Round-mode share button — opens a chooser sheet (image vs link). */}
          {isRound && (
            <button
              onClick={() => setSendRoundChooserOpen(true)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(135deg, #2d7a42 0%, #4da862 100%)", border: "none", borderRadius: 14, padding: "14px", marginBottom: 10, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#fff", cursor: "pointer", letterSpacing: "0.04em", boxShadow: "0 6px 20px rgba(45,122,66,0.45)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Send the Round
            </button>
          )}

          {/* Round-mode: When block dropped — course/date/time live on the
              cover photo overlay now. We jump straight from header → Send the
              Round → Games → Clips. The "Courses" section is fully empty in
              round-mode (header + button hidden above, this empty here). */}
          {isRound ? null : tripCourses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0 4px", color: "rgba(255,255,255,0.2)", fontFamily: "'Outfit', sans-serif", fontSize: 13, lineHeight: 1.7 }}>
              No courses yet.<br />Tap <span style={{ color: "#4da862" }}>+ Add Course</span> to build your itinerary.
            </div>
          ) : (
            <div>
              {(() => {
                // Group stops by play date so the itinerary reads like an agenda,
                // not a flat list. Stops without a date land in 'Unscheduled' at the end.
                const groups = new Map<string, typeof tripCourses>();
                for (const tc of tripCourses) {
                  const key = tc.playDate ?? "__unscheduled";
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key)!.push(tc);
                }
                // Sort by date asc; unscheduled goes last
                const dayKeys = Array.from(groups.keys()).sort((a, b) => {
                  if (a === "__unscheduled") return 1;
                  if (b === "__unscheduled") return -1;
                  return a.localeCompare(b);
                });
                // Within each day, sort by teeTime asc; missing time goes last
                const sortByTeeTime = (a: typeof tripCourses[number], b: typeof tripCourses[number]) => {
                  if (!a.teeTime && !b.teeTime) return a.sortOrder - b.sortOrder;
                  if (!a.teeTime) return 1;
                  if (!b.teeTime) return -1;
                  return a.teeTime.localeCompare(b.teeTime);
                };

                // Day header label: "MONDAY · MAY 13" — bigger if it's an actual date.
                const dayHeader = (key: string) => {
                  if (key === "__unscheduled") return "UNSCHEDULED";
                  const d = new Date(key + "T00:00:00");
                  const dow = d.toLocaleDateString("en-US", { weekday: "long" });
                  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  return `${dow.toUpperCase()} · ${md.toUpperCase()}`;
                };

                // Build a clean paired-stop title that drops the shared resort prefix.
                // "Bay Harbor Golf Club - The Preserve" + "Bay Harbor Golf Club - The Quarry"
                // → headline "Preserve + Quarry", club "Bay Harbor Golf Club"
                const pairedTitle = (primary: string, secondary: string) => {
                  const pParts = primary.split(/\s+-\s+/);
                  const sParts = secondary.split(/\s+-\s+/);
                  if (pParts.length === 2 && sParts.length === 2 && pParts[0] === sParts[0]) {
                    const strip = (s: string) => s.replace(/^The\s+/i, "").trim();
                    return { headline: `${strip(pParts[1])} + ${strip(sParts[1])}`, club: pParts[0] };
                  }
                  return { headline: `${primary} + ${secondary}`, club: null };
                };

                const formatTime12 = (t: string) => {
                  const [h, m] = t.split(":").map(Number);
                  if (isNaN(h)) return t;
                  const period = h >= 12 ? "PM" : "AM";
                  const h12 = h % 12 === 0 ? 12 : h % 12;
                  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${period}`;
                };

                return dayKeys.map((dayKey) => {
                  const stops = [...groups.get(dayKey)!].sort(sortByTeeTime);
                  return (
                    <div key={dayKey} style={{ marginBottom: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: "#4da862" }}>{dayHeader(dayKey)}</div>
                        <div style={{ flex: 1, height: 1, background: "rgba(77,168,98,0.18)" }} />
                      </div>
                      {stops.map((tc) => {
                        const paired = !!tc.secondaryCourse;
                        const title = paired ? pairedTitle(tc.course.name, tc.secondaryCourse!.name) : { headline: tc.course.name, club: null };
                        const primaryComplete = coursesWithHandicaps.has(tc.courseId);
                        const secondaryComplete = !tc.secondaryCourseId || coursesWithHandicaps.has(tc.secondaryCourseId);
                        const scorecardComplete = primaryComplete && secondaryComplete;
                        return (
                          <div key={tc.id} style={{ position: "relative", overflow: "hidden", borderRadius: 12, marginBottom: 6 }}>
                            {/* Delete zone revealed on swipe — subtle, icon-only */}
                            <div
                              onClick={async () => { await createClient().from("GolfTripCourse").delete().eq("id", tc.id); setTripCourses(prev => prev.filter(c => c.id !== tc.id)); setSwipedId(null); }}
                              style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 64, background: "rgba(180,60,60,0.18)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", borderRadius: 12 }}
                              aria-label="Delete stop"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(220,120,120,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            </div>

                            {/* Swipeable row */}
                            <div
                              ref={el => { swipeCardRef.current[tc.id] = el; }}
                              style={{
                                display: "flex", alignItems: "stretch", gap: 12,
                                background: "#0b140e", border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: 12, padding: "12px 12px 12px 12px",
                                position: "relative",
                                transform: swipedId === tc.id ? "translateX(-64px)" : "translateX(0)",
                                transition: "transform 0.2s ease",
                              }}
                              onTouchStart={e => {
                                swipeTouchStartX.current = e.touches[0].clientX;
                                swipeTouchStartY.current = e.touches[0].clientY;
                                swipeCurrentX.current = swipedId === tc.id ? -64 : 0;
                              }}
                              onTouchMove={e => {
                                const dx = e.touches[0].clientX - swipeTouchStartX.current;
                                const dy = e.touches[0].clientY - swipeTouchStartY.current;
                                if (Math.abs(dy) > Math.abs(dx)) return;
                                const base = swipedId === tc.id ? -64 : 0;
                                const next = Math.max(-64, Math.min(0, base + dx));
                                const el = swipeCardRef.current[tc.id];
                                if (el) { el.style.transition = "none"; el.style.transform = `translateX(${next}px)`; }
                                swipeCurrentX.current = next;
                              }}
                              onTouchEnd={() => {
                                const el = swipeCardRef.current[tc.id];
                                if (el) el.style.transition = "transform 0.2s ease";
                                if (swipeCurrentX.current < -32) {
                                  setSwipedId(tc.id);
                                  if (el) el.style.transform = "translateX(-64px)";
                                } else {
                                  setSwipedId(null);
                                  if (el) el.style.transform = "translateX(0)";
                                }
                              }}
                              onClick={() => { if (swipedId === tc.id) { setSwipedId(null); } }}
                            >
                              {/* Logo column */}
                              <div onClick={e => { if (swipedId === tc.id) { e.stopPropagation(); setSwipedId(null); return; } router.push(`/courses/${tc.course.id}`); }} style={{ position: "relative", width: 44, height: 44, flexShrink: 0, cursor: "pointer", alignSelf: "center" }}>
                                <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.25)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                                  {tc.course.logoUrl
                                    ? <img src={tc.course.logoUrl} alt={tc.course.name} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
                                    : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#4da862" }}>{abbr(tc.course.name)}</span>
                                  }
                                </div>
                                {tc.secondaryCourse && (
                                  <div style={{ position: "absolute", bottom: -4, right: -4, width: 22, height: 22, borderRadius: 6, background: "rgba(7,16,10,0.95)", border: "1.5px solid #4da862", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {tc.secondaryCourse.logoUrl
                                      ? <img src={tc.secondaryCourse.logoUrl} alt={tc.secondaryCourse.name} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
                                      : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 8, fontWeight: 700, color: "#4da862" }}>{abbr(tc.secondaryCourse.name)}</span>
                                    }
                                  </div>
                                )}
                              </div>

                              {/* Main text column */}
                              <div onClick={e => { if (swipedId === tc.id) { e.stopPropagation(); setSwipedId(null); return; } router.push(`/courses/${tc.course.id}`); }} style={{ flex: 1, minWidth: 0, cursor: "pointer", alignSelf: "center" }}>
                                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.25 }}>
                                  {title.headline}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  <span>{title.club ?? [tc.course.city, tc.course.state].filter(Boolean).join(", ")}</span>
                                  {paired && (
                                    <>
                                      <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
                                      <span style={{ color: "rgba(77,168,98,0.85)", fontWeight: 600 }}>9 + 9</span>
                                    </>
                                  )}
                                </div>
                                {tc.accommodation && (
                                  <div style={{ marginTop: 4, fontFamily: "'Outfit', sans-serif", fontSize: 10.5, color: "rgba(255,255,255,0.32)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    Stay: {tc.accommodation}
                                  </div>
                                )}
                                {!scorecardComplete && (
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5, background: "rgba(230,160,0,0.1)", border: "1px solid rgba(230,160,0,0.25)", borderRadius: 99, padding: "2px 8px" }}>
                                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(230,160,0,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(230,160,0,0.85)" }}>Scorecard needed</span>
                                  </div>
                                )}
                              </div>

                              {/* Tee time pill — pinned right */}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0, alignSelf: "center" }}>
                                {tc.teeTime ? (
                                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "0.02em", lineHeight: 1, whiteSpace: "nowrap" }}>
                                    {formatTime12(tc.teeTime)}
                                  </div>
                                ) : (
                                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>no time</div>
                                )}
                                <button onClick={e => { e.stopPropagation(); openEditCourse(tc); }} style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Games */}
        <div style={{ padding: "24px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Games{games.length > 0 && <span className="count">{games.length}</span>}</div>
            <button
              onClick={openGameCreator}
              style={{ background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 99, padding: "5px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#4da862", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create Game
            </button>
          </div>
          {games.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px 0 4px", color: "rgba(255,255,255,0.2)", fontFamily: "'Outfit', sans-serif", fontSize: 12 }}>No games yet — set up Nassau, Skins, and more</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {games.map(g => {
                const fmt = GAME_FORMATS.find(f => f.id === g.format);
                const cfg = g.formatConfig as any;
                const sub = g.format === "nassau" ? `$${cfg?.frontAmount}/$${cfg?.backAmount}/$${cfg?.totalAmount}` : g.format === "skins" ? `$${cfg?.skinsAmount}/skin` : fmt?.desc || "";
                return (
                  <button key={g.id} onClick={() => { setViewGame(g); setViewGameOpen(true); }} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "13px 14px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Round-mode: skip the course icon + name (same course everywhere on this page). Game format becomes the title. */}
                    {!isRound && (
                      <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        {g.courseLogoUrl
                          ? <img src={g.courseLogoUrl} alt={g.courseName} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
                          : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#4da862" }}>{abbr(g.courseName)}</span>
                        }
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isRound ? (
                        <>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                            {fmt?.name || g.format}
                            {sub && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>· {sub}</span>}
                          </div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{g.players?.length || 0} players · tap for details</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.courseName}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#4da862" }}>{fmt?.name || g.format}</span>
                            {sub && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>· {sub}</span>}
                          </div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{g.players?.length || 0} players</div>
                        </>
                      )}
                    </div>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Trip Clips */}
        <div style={{ padding: "24px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Trip Clips{clips.length > 0 && <span className="count">{clips.length}</span>}</div>
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

      {/* Members sheet */}
      {membersOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => setMembersOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(13,35,24,0.98)", backdropFilter: "blur(20px)", borderRadius: "20px 20px 0 0", padding: "16px 20px 40px", maxHeight: "78vh", display: "flex", flexDirection: "column" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 18px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 14 }}>
              Golfers{members.length > 0 && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862", fontWeight: 600, marginLeft: 8, verticalAlign: 2 }}>{members.length}</span>}
            </div>

            {trip?.ryderCupEnabled ? (
              // ── Side-by-side red vs blue layout ─────────────────────
              (() => {
                const redMembers = members.filter(m => teamOf(m.userId) === "RED");
                const blueMembers = members.filter(m => teamOf(m.userId) === "BLUE");
                const unassigned = members.filter(m => teamOf(m.userId) === null);

                const renderTeamColumn = (label: string, color: string, ringColor: string, list: Member[], align: "left" | "right") => (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color, marginBottom: 10, textAlign: align }}>
                      {label}
                    </div>
                    {list.length === 0 ? (
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic", textAlign: align }}>No players</div>
                    ) : list.map(m => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", flexDirection: align === "right" ? "row-reverse" : "row" }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", border: `2px solid ${ringColor}`, background: "rgba(0,0,0,0.3)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 1px rgba(0,0,0,0.4)` }}>
                          {m.user.avatarUrl
                            ? <img src={m.user.avatarUrl} alt={m.user.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0, textAlign: align }}>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.user.displayName}</div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{m.user.username}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );

                return (
                  <div style={{ overflowY: "auto", flex: 1 }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: unassigned.length > 0 ? 16 : 0 }}>
                      {renderTeamColumn(trip.redTeamName?.trim() || "Team 1", "#fca5a5", "#c8102e", redMembers, "left")}
                      <div style={{ width: 1, alignSelf: "stretch", background: "linear-gradient(to bottom, transparent, #d4a017 30%, #d4a017 70%, transparent)" }} />
                      {renderTeamColumn(trip.blueTeamName?.trim() || "Team 2", "#93c5fd", "#3b82f6", blueMembers, "right")}
                    </div>
                    {unassigned.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Unassigned</div>
                        {unassigned.map(m => (
                          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
                            <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.15)", background: "rgba(77,168,98,0.12)", flexShrink: 0 }}>
                              {m.user.avatarUrl
                                ? <img src={m.user.avatarUrl} alt={m.user.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" style={{ margin: "10px" }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                              }
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{m.user.displayName}</div>
                              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>@{m.user.username}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              // ── Default flat list (no Ryder Cup) ─────────────────────
              <div style={{ overflowY: "auto", flex: 1 }}>
                {members.map(m => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(77,168,98,0.3)", background: "rgba(77,168,98,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {m.user.avatarUrl
                        ? <img src={m.user.avatarUrl} alt={m.user.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{m.user.displayName}</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>@{m.user.username}</div>
                    </div>
                    {m.role === "admin" && (
                      <div style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.25)", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "#4da862" }}>Admin</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trip image expand overlay */}
      {tripImageExpanded && trip?.imageUrl && (
        <div onClick={() => setTripImageExpanded(false)} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button onClick={() => setTripImageExpanded(false)} style={{ position: "absolute", top: 20, right: 20, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <img src={trip.imageUrl} alt={trip.name} style={{ maxWidth: "92vw", maxHeight: "80vh", borderRadius: 16, objectFit: "contain" }} onClick={e => e.stopPropagation()} />
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
            {/* Invite someone not on Tour It yet */}
            <div style={{ paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 4 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Not on Tour It yet?</div>
              <button
                onClick={() => {
                  const msg = `Join me on Tour It for ${trip?.name || "our golf trip"}! Sign up at touritgolf.com`;
                  if (navigator.share) {
                    navigator.share({ title: "Join me on Tour It", text: msg });
                  } else {
                    navigator.clipboard.writeText(msg);
                  }
                }}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.25)", borderRadius: 12, padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#4da862", cursor: "pointer" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Invite Friend to Tour It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit trip sheet */}
      {editOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => setEditOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(13,35,24,0.98)", backdropFilter: "blur(20px)", borderRadius: "20px 20px 0 0", padding: "16px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 14px" }} />

            {/* Invite — pinned to the top of the edit sheet */}
            {isOwner && (
              <button
                onClick={() => { setEditOpen(false); setInviteOpen(true); }}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(77,168,98,0.14)", border: "1px solid rgba(77,168,98,0.4)", borderRadius: 12, padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#4da862", cursor: "pointer", marginBottom: 16, letterSpacing: "0.02em" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                Invite Golfers to This Trip
              </button>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff" }}>Edit Trip</div>
              <button
                onClick={saveEdit}
                disabled={!editName.trim() || saving}
                style={{
                  background: (!editName.trim() || saving) ? "rgba(77,168,98,0.18)" : "#2d7a42",
                  border: `1px solid ${(!editName.trim() || saving) ? "rgba(77,168,98,0.25)" : "#4da862"}`,
                  borderRadius: 99,
                  padding: "8px 18px",
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fff",
                  cursor: (!editName.trim() || saving) ? "not-allowed" : "pointer",
                  opacity: (!editName.trim() || saving) ? 0.6 : 1,
                  letterSpacing: "0.02em",
                  flexShrink: 0,
                  boxShadow: (!editName.trim() || saving) ? "none" : "0 2px 10px rgba(45,122,66,0.4)",
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
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
            <div style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {confirmDelete ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Cancel</button>
                  <button onClick={handleDeleteTrip} disabled={deletingTrip} style={{ flex: 1, background: "rgba(200,60,60,0.12)", border: "1px solid rgba(200,60,60,0.3)", borderRadius: 12, padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(220,100,100,0.9)", cursor: "pointer" }}>
                    {deletingTrip ? "Deleting…" : "Confirm Delete"}
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} style={{ width: "100%", background: "none", border: "1px solid rgba(200,60,60,0.2)", borderRadius: 12, padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(200,80,80,0.6)", cursor: "pointer" }}>
                  Delete Trip
                </button>
              )}
            </div>
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
                <input type="date" value={editCPlayDate} onChange={e => setEditCPlayDate(e.target.value)} min={trip?.startDate ?? undefined} max={trip?.endDate ?? undefined} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: editCPlayDate ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
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

      {/* Send-the-round chooser sheet */}
      {sendRoundChooserOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)" }} onClick={() => !sendingMode && setSendRoundChooserOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(13,35,24,0.98)", backdropFilter: "blur(20px)", borderRadius: "20px 20px 0 0", padding: "16px 20px calc(28px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 6px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", textAlign: "center" }}>Send the Round</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center", marginBottom: 6 }}>Pick how you want to share it.</div>

            {/* Option 1: Send the image */}
            <button
              disabled={!!sendingMode}
              onClick={async () => {
                setSendingMode("image");
                try {
                  const url = `/api/round/${id}/beauty?ts=${Date.now()}`;
                  const res = await fetch(url, { redirect: "follow" });
                  if (!res.ok) throw new Error(`status ${res.status}`);
                  const blob = await res.blob();
                  if (blob.size < 1000) throw new Error("image came back empty");
                  const file = new File([blob], `tour-it-${id}.png`, { type: "image/png" });
                  const niceDate = roundCourse && (tripCourses[0]?.playDate || trip.startDate)
                    ? new Date((tripCourses[0]?.playDate || trip.startDate) + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : "";
                  const teeTimeRaw = tripCourses[0]?.teeTime;
                  const niceTime = teeTimeRaw ? (() => {
                    const [hh, mm] = teeTimeRaw.split(":").map(Number);
                    if (Number.isNaN(hh)) return "";
                    const period = hh >= 12 ? "PM" : "AM";
                    const h12 = hh % 12 || 12;
                    return ` at ${h12}:${String(mm ?? 0).padStart(2, "0")} ${period}`;
                  })() : "";
                  const text = `Round at ${roundCourse?.name ?? trip.name}${niceDate ? ` · ${niceDate}` : ""}${niceTime} — sent from Tour It`;
                  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
                  if (nav.canShare?.({ files: [file] })) {
                    await navigator.share({ files: [file], title: "Upcoming Round", text });
                  } else {
                    window.open(url, "_blank");
                  }
                  setSendRoundChooserOpen(false);
                } catch (e) {
                  console.error("Beauty-shot share failed", e);
                  alert("Couldn't generate the share image. Try again in a moment.");
                } finally {
                  setSendingMode(null);
                }
              }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "rgba(77,168,98,0.10)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 14, cursor: sendingMode ? "default" : "pointer", textAlign: "left", opacity: sendingMode && sendingMode !== "image" ? 0.4 : 1 }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(77,168,98,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff" }}>{sendingMode === "image" ? "Preparing…" : "Send as image"}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Attach the full beauty card directly.</div>
              </div>
            </button>

            {/* Option 2: Send the link with rich preview */}
            <button
              disabled={!!sendingMode}
              onClick={async () => {
                setSendingMode("link");
                try {
                  const linkUrl = `${window.location.origin}/round/${id}`;
                  const niceDate = roundCourse && (tripCourses[0]?.playDate || trip.startDate)
                    ? new Date((tripCourses[0]?.playDate || trip.startDate) + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : "";
                  const teeTimeRaw = tripCourses[0]?.teeTime;
                  const niceTime = teeTimeRaw ? (() => {
                    const [hh, mm] = teeTimeRaw.split(":").map(Number);
                    if (Number.isNaN(hh)) return "";
                    const period = hh >= 12 ? "PM" : "AM";
                    const h12 = hh % 12 || 12;
                    return ` at ${h12}:${String(mm ?? 0).padStart(2, "0")} ${period}`;
                  })() : "";
                  const text = `Round at ${roundCourse?.name ?? trip.name}${niceDate ? ` · ${niceDate}` : ""}${niceTime}`;
                  if (navigator.share) {
                    await navigator.share({ title: "Upcoming Round", text, url: linkUrl });
                  } else {
                    await navigator.clipboard.writeText(linkUrl);
                    alert("Link copied to clipboard");
                  }
                  setSendRoundChooserOpen(false);
                } catch (e) {
                  console.error("Link share failed", e);
                } finally {
                  setSendingMode(null);
                }
              }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, cursor: sendingMode ? "default" : "pointer", textAlign: "left", opacity: sendingMode && sendingMode !== "link" ? 0.4 : 1 }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff" }}>{sendingMode === "link" ? "Sharing…" : "Send as link"}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>iMessage will preview the image — tap to open in Tour It.</div>
              </div>
            </button>

            <button
              disabled={!!sendingMode}
              onClick={() => setSendRoundChooserOpen(false)}
              style={{ marginTop: 6, padding: "10px", background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.55)", cursor: "pointer" }}
            >
              Cancel
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
                    <div key={c.id} className="course-result-row" onClick={() => { setSelectedAddCourse(c); setAddCourseStep("details"); if (!addPlayDate && trip?.startDate) setAddPlayDate(trip.startDate); }}>
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
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862", marginBottom: 20 }}>
                  {selectedAddCourse.name}
                  {pairCourse && <span style={{ color: "rgba(255,255,255,0.5)" }}> + {pairCourse.name}</span>}
                </div>

                {/* 9+9 pairing panel — only visible when the selected course is 9 holes */}
                {selectedAddCourse.holeCount === 9 && (
                  <div style={{
                    marginBottom: 18,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${pairCourse ? "rgba(77,168,98,0.4)" : "rgba(255,255,255,0.1)"}`,
                    background: pairCourse ? "rgba(77,168,98,0.06)" : "rgba(255,255,255,0.025)",
                  }}>
                    {pairCourse ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.3)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                          {pairCourse.logoUrl
                            ? <img src={pairCourse.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, color: "#4da862" }}>{abbr(pairCourse.name)}</span>
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, color: "#4da862", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 2 }}>Paired round · 18 holes</div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#fff", lineHeight: 1.3 }}>
                            <span style={{ fontWeight: 700 }}>Front 9:</span> {selectedAddCourse.name}
                            <br/>
                            <span style={{ fontWeight: 700 }}>Back 9:</span> {pairCourse.name}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => {
                              // Swap front/back
                              const front = pairCourse;
                              const back = selectedAddCourse;
                              setSelectedAddCourse(front);
                              setPairCourse(back);
                            }}
                            title="Swap front / back 9"
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "4px 8px", fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.65)", cursor: "pointer" }}
                          >Swap</button>
                          <button
                            onClick={() => setPairCourse(null)}
                            title="Remove pairing"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 8px", fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.45)", cursor: "pointer" }}
                          >Remove</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddCourseStep("pairSearch"); setPairSearch(""); setPairResults([]); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(77,168,98,0.12)", border: "1px dashed rgba(77,168,98,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#fff" }}>Pair with another 9-hole course</div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Stitch two 9s into an 18-hole round (e.g. Bay Harbor: Links + Quarry)</div>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
                      </button>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>Play Date <span style={{ fontWeight: 400 }}>(optional)</span></div>
                    <input type="date" value={addPlayDate} onChange={e => setAddPlayDate(e.target.value)} min={trip?.startDate ?? undefined} max={trip?.endDate ?? undefined} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: addPlayDate ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
                {trip?.startDate && trip?.endDate && (
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 5 }}>
                    Trip dates: {new Date(trip.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {new Date(trip.endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                )}
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

            {/* Pair-search step — only shown when user clicked 'Pair with another 9-hole' */}
            {addCourseStep === "pairSearch" && selectedAddCourse && (
              <>
                <button onClick={() => setAddCourseStep("details")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.45)", fontSize: 12, fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", gap: 4, marginBottom: 14, padding: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Back
                </button>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Pair the 9</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
                  Front 9: <span style={{ color: "#4da862", fontWeight: 600 }}>{selectedAddCourse.name}</span>. Pick the back 9 from any other 9-hole course.
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(77,168,98,0.35)", borderRadius: 12, padding: "11px 14px", marginBottom: 14 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input autoFocus value={pairSearch} onChange={e => handlePairSearchChange(e.target.value)} placeholder="Search 9-hole courses..." style={{ background: "none", border: "none", outline: "none", flex: 1, fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff" }} />
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {pairSearchLoading && <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.25)", fontFamily: "'Outfit', sans-serif", fontSize: 13 }}>Searching...</div>}
                  {!pairSearchLoading && pairSearch.length >= 2 && pairResults.length === 0 && (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.25)", fontFamily: "'Outfit', sans-serif", fontSize: 13 }}>No 9-hole courses found</div>
                  )}
                  {pairResults.map(c => (
                    <div key={c.id} className="course-result-row" onClick={() => { setPairCourse(c); setAddCourseStep("details"); }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        {c.logoUrl
                          ? <img src={c.logoUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
                          : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#4da862" }}>{abbr(c.name)}</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{[c.city, c.state].filter(Boolean).join(", ")} · 9 holes</div>
                      </div>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Chat sheet */}
      {chatOpen && (
        <div id="trip-chat-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100dvh", zIndex: 200, display: "flex", flexDirection: "column", willChange: "transform" }}>
          <div onClick={() => setChatOpen(false)} style={{ height: "18%", minHeight: 60, background: "rgba(0,0,0,0.5)", flexShrink: 0 }} />
          <div style={{ background: "#0d1f14", borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff" }}>Trip Chat</div>
              <button onClick={() => setChatOpen(false)} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
              {msgsLoading && messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontFamily: "'Outfit', sans-serif", fontSize: 12, padding: "40px 0" }}>Loading messages...</div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontFamily: "'Outfit', sans-serif", fontSize: 12, padding: "40px 0" }}>No messages yet. Say something! 👋</div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.userId === user?.id || msg.user?.id === user?.id;
                  const time = new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                  return (
                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 3 }}>
                      {!isMe && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "#4da862", fontWeight: 600, marginLeft: 2 }}>{msg.user?.displayName}</span>}
                      <div className={isMe ? "msg-bubble-me" : "msg-bubble-other"}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", lineHeight: 1.4 }}>{msg.body}</span>
                      </div>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.25)", marginRight: isMe ? 2 : 0, marginLeft: isMe ? 0 : 2 }}>{time}</span>
                    </div>
                  );
                })
              )}
              <div ref={msgEndRef} />
            </div>
            {chatError && (
              <div style={{ padding: "6px 14px", background: "rgba(220,50,50,0.12)", borderTop: "1px solid rgba(220,50,50,0.2)" }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#f87171" }}>{chatError}</span>
              </div>
            )}
            <div style={{ padding: "10px 14px calc(10px + env(safe-area-inset-bottom))", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, flexShrink: 0 }}>
              <input
                value={msgBody}
                onChange={e => setMsgBody(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Message the group..."
                spellCheck={false}
                autoCorrect="off"
                style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "10px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "#fff", outline: "none" }}
              />
              <button
                onClick={sendMessage}
                disabled={!msgBody.trim() || sendingMsg}
                style={{ width: 40, height: 40, borderRadius: "50%", background: msgBody.trim() ? "#2d7a42" : "rgba(255,255,255,0.07)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: msgBody.trim() ? "pointer" : "default", flexShrink: 0 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game creator sheet */}
      {gameOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column" }}>
          <div onClick={() => { if (!generatingGame) setGameOpen(false); }} style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ background: "#0d1f14", borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            {/* Header */}
            <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              {gameStep > 1 && !generatingGame && (
                <button onClick={() => setGameStep(s => s - 1)} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff" }}>Create Game</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                  {gameStep === 1 && "Step 1 of 5 — Select Course"}
                  {gameStep === 2 && "Step 2 of 5 — Players & Handicaps"}
                  {gameStep === 3 && "Step 3 of 5 — Game Format"}
                  {gameStep === 4 && "Step 4 of 5 — Configure"}
                  {gameStep === 5 && "Step 5 of 5 — Hole Handicap Rankings"}
                </div>
              </div>
              {!generatingGame && (
                <button onClick={() => setGameOpen(false)} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
              {/* Step 1: Course & Tee */}
              {!generatingGame && gameStep === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>Select Course</div>
                    {tripCourses.length === 0 ? (
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Add a course to this trip first</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {tripCourses.map(tc => (
                          <button key={tc.id} onClick={() => handleSelectGameCourse(tc.courseId, tc.course.name, tc.secondaryCourseId, tc.secondaryCourse?.name)}
                            style={{ padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${gameCourseId === tc.courseId ? "#4da862" : "rgba(255,255,255,0.08)"}`, background: gameCourseId === tc.courseId ? "rgba(77,168,98,0.1)" : "rgba(255,255,255,0.03)", cursor: "pointer", textAlign: "left" }}>
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>
                              {tc.course.name}
                              {tc.secondaryCourse && <span style={{ color: "rgba(77,168,98,0.85)" }}> + {tc.secondaryCourse.name}</span>}
                            </div>
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                              {tc.course.city}, {tc.course.state}
                              {tc.secondaryCourse && <span style={{ color: "rgba(77,168,98,0.7)", marginLeft: 6 }}>· paired 9+9</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tee selection removed for now — handleSelectGameCourse
                      auto-picks the highest-slope tee box behind the scenes
                      so the slope/rating still feed the handicap math. */}
                  {gameCourseId && (
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                      Par {gameCoursePar}
                      {gameTeeBoxes.length > 0 && ` · Slope ${gameTeeSlope} · Rating ${gameTeeRating}`}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Players */}
              {!generatingGame && gameStep === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(() => {
                    const minHI = Math.min(...gamePlayers.map(p => p.handicapIndex));
                    return gamePlayers.map((p, i) => {
                      const diff = Math.round(p.handicapIndex * (gameTeeSlope / 113) + (gameTeeRating - gameCoursePar)) - Math.round(minHI * (gameTeeSlope / 113) + (gameTeeRating - gameCoursePar));
                      return (
                        <div key={p.userId} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: diff > 0 ? 6 : 0 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", background: "rgba(77,168,98,0.2)", flexShrink: 0 }}>
                              {p.avatarUrl ? <img src={p.avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" style={{ margin: "9px" }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>{p.displayName}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <button
                                onClick={() => setGamePlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, handicapIndex: Math.max(-10, Math.round((pl.handicapIndex - 0.1) * 10) / 10) } : pl))}
                                style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 300, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                              <input
                                type="number" step="0.1" min="-10" max="54"
                                value={p.handicapIndex === 0 ? "" : p.handicapIndex}
                                placeholder="0"
                                onChange={e => setGamePlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, handicapIndex: e.target.value === "" ? 0 : Math.max(-10, Math.min(54, parseFloat(e.target.value) || 0)) } : pl))}
                                style={{ width: 54, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "5px 4px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none", textAlign: "center" }}
                              />
                              <button
                                onClick={() => setGamePlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, handicapIndex: Math.min(54, Math.round((pl.handicapIndex + 0.1) * 10) / 10) } : pl))}
                                style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#4da862", fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 300, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
                            </div>
                          </div>
                          {diff > 0 && (
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)", paddingLeft: 42 }}>
                              Gives <span style={{ color: "#4da862", fontWeight: 600 }}>+{diff} shot{diff !== 1 ? "s" : ""}</span> vs lowest handicap
                            </div>
                          )}
                          {diff === 0 && gamePlayers.length > 1 && (
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)", paddingLeft: 42 }}>Lowest handicap — receives no shots</div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Step 3: Format */}
              {!generatingGame && gameStep === 3 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {GAME_FORMATS.map(fmt => (
                    <div key={fmt.id} className={`game-format-card${gameFormat === fmt.id ? " selected" : ""}`} onClick={() => setGameFormat(fmt.id)}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: gameFormat === fmt.id ? "#4da862" : "#fff", marginBottom: 4 }}>{fmt.name}</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{fmt.desc}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 4: Configure */}
              {!generatingGame && gameStep === 4 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {gameFormat !== "skins" && (
                    <div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>Team Assignment</div>
                      {gamePlayers.map((p, i) => {
                        const teamLetters = Array.from({ length: gamePlayers.length }, (_, k) => String.fromCharCode(65 + k));
                        return (
                          <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", flex: 1 }}>{p.displayName}</span>
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              {teamLetters.map(team => (
                                <button key={team} onClick={() => setGamePlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, teamId: team } : pl))}
                                  style={{ width: 34, height: 30, borderRadius: 8, border: `1.5px solid ${p.teamId === team ? "#4da862" : "rgba(255,255,255,0.12)"}`, background: p.teamId === team ? "rgba(77,168,98,0.15)" : "transparent", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: p.teamId === team ? "#4da862" : "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                                  {team}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {gameFormat === "nassau" && (
                    <div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>Bet Amounts ($)</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        {[["Front 9", gameNassauFront, setGameNassauFront], ["Back 9", gameNassauBack, setGameNassauBack], ["Full 18", gameNassauTotal, setGameNassauTotal]].map(([label, val, setter]) => (
                          <div key={label as string}>
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>{label as string}</div>
                            <input type="number" min="0" value={val as string} onChange={e => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)}
                              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {gameFormat === "skins" && (
                    <div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>Skins Setup</div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>$ per skin</div>
                        <input type="number" min="0" value={gameSkinsAmt} onChange={e => setGameSkinsAmt(e.target.value)}
                          style={{ width: 100, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }} />
                      </div>
                      <button onClick={() => setGameSkinsCarryover(v => !v)}
                        style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${gameSkinsCarryover ? "#4da862" : "rgba(255,255,255,0.2)"}`, background: gameSkinsCarryover ? "#4da862" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {gameSkinsCarryover && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Carryover on ties</span>
                      </button>
                    </div>
                  )}

                  {(gameFormat === "stableford" || gameFormat === "scramble") && (
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                      {gameFormat === "stableford" && "Bogey=1pt, par=2pts, birdie=3pts, eagle=4pts. Teams combine points per hole if teammates are assigned above."}
                      {gameFormat === "scramble" && "All players hit from the best shot each stroke. Assign teams above for team-vs-team play, or put everyone on separate teams for a group scramble."}
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Hole Handicap Rankings */}
              {!generatingGame && gameStep === 5 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {gameHandicapWarning && (
                    <div style={{ background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.25)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#ffaa00", lineHeight: 1.5 }}>
                        These rankings don't look right — please update them from the actual scorecard. Each hole should have a unique difficulty rank where 1 = hardest, 18 = easiest (and they're rarely in 1, 2, 3… hole order).
                      </div>
                    </div>
                  )}
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                    Enter each hole's difficulty ranking (1 = hardest, 18 = easiest). Found on the scorecard. We'll save these for future games at this course.
                  </div>
                  {/* Quick path: open the course's scorecard editor in another tab.
                      Earns +30 SCORECARD_COMPLETE points and propagates to every
                      future game on this course. */}
                  <a
                    href={`/courses/${gameCourseId}?scorecard=edit`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 14px",
                      background: "rgba(77,168,98,0.1)",
                      border: "1px solid rgba(77,168,98,0.3)",
                      borderRadius: 10,
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#4da862",
                      textDecoration: "none",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span>Open the full scorecard editor →</span>
                      <span style={{ fontWeight: 400, fontSize: 10, color: "rgba(77,168,98,0.7)", letterSpacing: "0.04em" }}>Earn +30 pts when you complete it · saves for every future game here</span>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {gameHoleHandicaps.map((rank, i) => (
                      <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 10px" }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Hole {i + 1}</div>
                        <input
                          type="number" min="1" max="18"
                          value={rank || ""}
                          placeholder="—"
                          onChange={e => {
                            const val = Math.min(18, Math.max(1, Number(e.target.value)));
                            setGameHoleHandicaps(prev => prev.map((r, idx) => idx === i ? val : r));
                          }}
                          style={{ width: "100%", background: "transparent", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: rank > 0 ? "#4da862" : "rgba(255,255,255,0.3)", outline: "none", textAlign: "center" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error — visible on any step */}
              {!generatingGame && gameError && (
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#e05c5c", marginTop: 8 }}>{gameError}</div>
              )}

              {/* Generating spinner — replaces step content */}
              {generatingGame && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 0" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", border: "3px solid rgba(77,168,98,0.15)", borderTop: "3px solid #4da862", animation: "spin 1s linear infinite" }} />
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>Tour It is crunching the numbers...</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Calculating handicaps &amp; building your game sheet</div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}
            </div>

            {/* Footer CTA */}
            {!generatingGame && (
              <div style={{ padding: "12px 20px 28px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                {gameStep < 5 ? (
                  <button
                    onClick={() => {
                      if (gameStep === 1 && !gameCourseId) return;
                      if (gameStep === 3 && !gameFormat) return;
                      if (gameStep === 4) {
                        // Skip step 5 if hole handicaps already known
                        if (gameHoleHandicapsKnown) { generateGame(); return; }
                      }
                      setGameStep(s => s + 1);
                    }}
                    disabled={(gameStep === 1 && !gameCourseId) || (gameStep === 3 && !gameFormat)}
                    style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: (gameStep === 1 && !gameCourseId) || (gameStep === 3 && !gameFormat) ? "rgba(255,255,255,0.06)" : "#2d7a42", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" }}
                  >
                    {gameStep === 4 && gameHoleHandicapsKnown ? "Generate Game Sheet" : "Continue"}
                  </button>
                ) : (
                  <button
                    onClick={generateGame}
                    style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "#2d7a42", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" }}
                  >
                    Generate Game Sheet
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* View game sheet */}
      {viewGameOpen && viewGame && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column" }}>
          <div onClick={() => setViewGameOpen(false)} style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ background: "#0d1f14", borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", maxHeight: "88vh" }}>
            <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                {viewGame.courseLogoUrl
                  ? <img src={viewGame.courseLogoUrl} alt={viewGame.courseName} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
                  : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#4da862" }}>{abbr(viewGame.courseName)}</span>
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 900, color: "#fff" }}>{GAME_FORMATS.find(f => f.id === viewGame.format)?.name || viewGame.format}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{viewGame.courseName} · {viewGame.players?.length || 0} players</div>
              </div>
              <button
                onClick={() => { if (confirm("Delete this game?")) deleteGame(viewGame.id); }}
                disabled={deletingGameId === viewGame.id}
                style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(192,57,43,0.12)", border: "1px solid rgba(192,57,43,0.25)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(192,57,43,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
              <button onClick={() => setViewGameOpen(false)} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px 8px" }}>
              {(() => {
                let sheetData: { rules?: string; tip?: string } = {};
                try { sheetData = JSON.parse(viewGame.gameSheet); } catch {}
                const isStructured = !!sheetData.rules;

                const teamGroups = (() => {
                  if (!viewGame.players) return [] as { team: string; members: string[] }[];
                  const map: Record<string, string[]> = {};
                  for (const p of viewGame.players) {
                    const t = p.teamId || "Solo";
                    if (!map[t]) map[t] = [];
                    map[t].push(p.displayName);
                  }
                  return Object.entries(map).filter(([t]) => t !== "Solo").map(([team, members]) => ({ team, members }));
                })();

                if (isStructured) {
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {/* Scorecard accuracy note + quick edit button */}
                      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,170,0,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, flex: 1, minWidth: 0 }}>Verify <span style={{ color: "rgba(255,255,255,0.65)" }}>{viewGame.courseName}</span>'s scorecard for correct stroke allocation.</span>
                        <button
                          onClick={() => openScorecardSheet(viewGame.courseId)}
                          style={{
                            flexShrink: 0,
                            background: "rgba(77,168,98,0.12)",
                            border: "1px solid rgba(77,168,98,0.4)",
                            borderRadius: 8,
                            padding: "5px 10px",
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#4da862",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Check it →
                        </button>
                      </div>

                      {/* Teams */}
                      {teamGroups.length > 1 && (
                        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px" }}>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Teams</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {teamGroups.map(({ team, members }) => (
                              <div key={team} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 24, height: 24, borderRadius: 7, background: "#2d7a42", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{team}</div>
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{members.join(" & ")}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Players */}
                      {viewGame.players?.map((p: any, i: number) => (
                        <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", flex: 1 }}>{p.displayName}</div>
                            {p.teamId && p.teamId !== "Solo" && (
                              <div style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.25)", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#4da862" }}>Team {p.teamId}</div>
                            )}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: p.strokeHoles?.length > 0 ? 8 : 0 }}>
                            {[
                              { label: "HI", value: p.handicapIndex },
                              { label: "Course HCP", value: p.courseHandicap },
                              { label: "Net Shots", value: p.netStrokes > 0 ? `+${p.netStrokes}` : String(p.netStrokes) },
                            ].map(({ label, value }) => (
                              <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "7px 8px", textAlign: "center" }}>
                                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: label === "Net Shots" ? "#4da862" : "#fff" }}>{value}</div>
                              </div>
                            ))}
                          </div>
                          {p.strokeHoles?.length > 0 && (
                            <div style={{ background: "rgba(77,168,98,0.06)", borderRadius: 8, padding: "6px 10px" }}>
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)", marginRight: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Strokes on holes:</span>
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#4da862" }}>{p.strokeHoles.join(", ")}</span>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Rules */}
                      {sheetData.rules && (
                        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px" }}>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Format Rules</div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.65 }}>{sheetData.rules}</div>
                        </div>
                      )}

                      {/* Tip */}
                      {sheetData.tip && (
                        <div style={{ background: "rgba(77,168,98,0.06)", border: "1px solid rgba(77,168,98,0.18)", borderRadius: 12, padding: "10px 14px", marginBottom: 4 }}>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "#4da862", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Pro Tip</div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{sheetData.tip}</div>
                        </div>
                      )}
                    </div>
                  );
                }

                return <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{viewGame.gameSheet}</div>;
              })()}
            </div>
            <div style={{ padding: "12px 20px 28px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10, flexShrink: 0 }}>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: `${viewGame.courseName} — ${GAME_FORMATS.find(f => f.id === viewGame.format)?.name || viewGame.format}`, text: viewGame.shareText });
                  } else {
                    navigator.clipboard.writeText(viewGame.shareText);
                  }
                }}
                style={{ flex: 1, padding: "13px", borderRadius: 12, border: "none", background: "#2d7a42", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Send to Group
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(viewGame.shareText); }}
                style={{ padding: "13px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scorecard verify sheet — pops over the game view so the user can
          check stroke allocation without losing context. Footer has an
          "Edit on course page" affordance that does navigate away (rare),
          plus a Close button that returns to the game. */}
      {scorecardSheetOpen && viewGame && (
        <div style={{ position: "fixed", inset: 0, zIndex: 250 }} onClick={() => setScorecardSheetOpen(false)}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "14px 0 calc(20px + env(safe-area-inset-bottom))", maxHeight: "85dvh", display: "flex", flexDirection: "column" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 99, margin: "0 auto 14px", flexShrink: 0 }} />

            <div style={{ padding: "0 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)", marginBottom: 2 }}>Verify Scorecard</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "#fff", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{viewGame.courseName}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>Confirm par, yardage, and handicap rank for each hole.</div>
              </div>
              <button onClick={() => setScorecardSheetOpen(false)} aria-label="Close" style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Table — sticky header row, scrollable body */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr", padding: "10px 20px", position: "sticky", top: 0, background: "#0d2318", borderBottom: "1px solid rgba(255,255,255,0.06)", zIndex: 1 }}>
                {(["Hole", "Par", "Yards", "HCP"] as const).map(h => (
                  <div key={h} style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", textAlign: h === "Hole" ? "left" : "center" }}>{h}</div>
                ))}
              </div>

              {scorecardLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.2)", borderTopColor: "#4da862", animation: "spin 0.8s linear infinite" }} />
                </div>
              ) : scorecardHoles.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                  No scorecard data yet for this course.
                </div>
              ) : (
                scorecardHoles.map(h => (
                  <div key={h.holeNumber} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff" }}>{h.holeNumber}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: h.par != null ? "#fff" : "rgba(255,80,80,0.7)", textAlign: "center" }}>{h.par != null ? h.par : "—"}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: h.yardage != null ? "rgba(255,255,255,0.78)" : "rgba(255,80,80,0.7)", textAlign: "center" }}>{h.yardage != null ? h.yardage.toLocaleString() : "—"}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: h.handicapRank != null && h.handicapRank > 0 ? "#4da862" : "rgba(255,80,80,0.7)", fontWeight: 700, textAlign: "center" }}>{h.handicapRank != null && h.handicapRank > 0 ? h.handicapRank : "—"}</div>
                  </div>
                ))
              )}
            </div>

            {/* Footer actions */}
            <div style={{ padding: "12px 20px 4px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => setScorecardSheetOpen(false)}
                style={{ flex: 1, background: "#2d7a42", border: "none", borderRadius: 12, padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", letterSpacing: "0.02em" }}
              >
                Looks correct
              </button>
              <button
                onClick={() => router.push(`/courses/${viewGame.courseId}?scorecard=edit`)}
                style={{ flex: 1, background: "rgba(230,160,0,0.12)", border: "1px solid rgba(230,160,0,0.4)", borderRadius: 12, padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(230,160,0,0.95)", cursor: "pointer", letterSpacing: "0.02em" }}
              >
                Edit on course page →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ryder Cup setup modal */}
      {ryderSetupOpen && trip && isOwner && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          <div onClick={() => setRyderSetupOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "90vh", overflowY: "auto", background: "#0d1f14", borderRadius: "20px 20px 0 0", border: "1px solid rgba(212,160,23,0.3)", borderTop: "3px solid #d4a017", padding: "20px 20px calc(20px + env(safe-area-inset-bottom))" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.18)" }} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff" }}>Ryder Cup Setup</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "#d4a017", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>Team vs Team</div>
              </div>
              <button onClick={() => setRyderSetupOpen(false)} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Team name inputs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#c8102e" }} />
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Team 1</span>
                </div>
                <input
                  value={trip.redTeamName ?? ""}
                  onChange={e => updateRyderTeamName("RED", e.target.value)}
                  placeholder="Team name"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="words"
                  style={{ width: "100%", background: "rgba(200,16,46,0.10)", border: "1px solid rgba(200,16,46,0.45)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", outline: "none" }}
                />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Team 2</span>
                </div>
                <input
                  value={trip.blueTeamName ?? ""}
                  onChange={e => updateRyderTeamName("BLUE", e.target.value)}
                  placeholder="Team name"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="words"
                  style={{ width: "100%", background: "rgba(30,58,138,0.18)", border: "1px solid rgba(59,130,246,0.45)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", outline: "none" }}
                />
              </div>
            </div>

            {/* Member assignment list */}
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>Assign players</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
              {members.map(m => {
                const t = teamOf(m.userId);
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", background: "rgba(255,255,255,0.025)", borderRadius: 10, border: `1px solid ${t === "RED" ? "rgba(200,16,46,0.4)" : t === "BLUE" ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.06)"}` }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", background: "rgba(77,168,98,0.15)", flexShrink: 0 }}>
                      {m.user.avatarUrl
                        ? <img src={m.user.avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" style={{ margin: "8px" }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      }
                    </div>
                    <div style={{ flex: 1, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", fontWeight: 500 }}>{m.user.displayName || m.user.username}</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => assignRyderMember(m.userId, "RED")} aria-label="Assign to team 1" style={{ width: 28, height: 28, borderRadius: 8, background: t === "RED" ? "#c8102e" : "rgba(200,16,46,0.15)", border: `1px solid ${t === "RED" ? "#c8102e" : "rgba(200,16,46,0.4)"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: t === "RED" ? "#fff" : "#c8102e" }} />
                      </button>
                      <button onClick={() => assignRyderMember(m.userId, "BLUE")} aria-label="Assign to team 2" style={{ width: 28, height: 28, borderRadius: 8, background: t === "BLUE" ? "#1e3a8a" : "rgba(30,58,138,0.18)", border: `1px solid ${t === "BLUE" ? "#3b82f6" : "rgba(59,130,246,0.4)"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: t === "BLUE" ? "#fff" : "#3b82f6" }} />
                      </button>
                      <button onClick={() => assignRyderMember(m.userId, null)} aria-label="Unassign" style={{ width: 28, height: 28, borderRadius: 8, background: t === null ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${t === null ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`, fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>–</button>
                    </div>
                  </div>
                );
              })}
              {members.length === 0 && (
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", padding: 12, textAlign: "center" }}>Invite golfers to the trip first, then come back to assign teams.</div>
              )}
            </div>

            {/* Footer actions */}
            <div style={{ display: "flex", gap: 8 }}>
              {!trip.ryderCupEnabled ? (
                <button
                  onClick={async () => { await setRyderCupEnabled(true); setRyderSetupOpen(false); }}
                  disabled={members.length === 0}
                  style={{ flex: 1, padding: "13px", borderRadius: 12, border: "none", background: members.length === 0 ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #c8102e 0%, #1e3a8a 100%)", fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 800, color: "#fff", cursor: members.length === 0 ? "not-allowed" : "pointer", letterSpacing: "0.04em" }}
                >
                  Start Ryder Cup
                </button>
              ) : (
                <>
                  <button
                    onClick={async () => { await setRyderCupEnabled(false); setRyderSetupOpen(false); }}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid rgba(255,80,80,0.35)", background: "rgba(255,80,80,0.08)", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,140,140,0.85)", cursor: "pointer" }}
                  >
                    Disable Ryder Cup
                  </button>
                  <button
                    onClick={() => setRyderSetupOpen(false)}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "#2d7a42", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
}

// ─── Ryder Cup helpers + Hero component ─────────────────────────────────────

function formatRyderScore(s: number | null | undefined): string {
  const v = s ?? 0;
  const whole = Math.floor(v);
  const half = v - whole >= 0.5;
  if (whole === 0) return half ? "½" : "0";
  return `${whole}${half ? "½" : ""}`;
}

function RyderCupHero({
  trip, members, ryderAssignments, isOwner, teamColors,
  editingRedScore, editingBlueScore, setEditingRedScore, setEditingBlueScore,
  updateRyderScore, setRyderScore, updateRyderTeamName, onEditTeams, onDisable,
}: {
  trip: Trip; members: Member[]; ryderAssignments: RyderAssignment[]; isOwner: boolean;
  teamColors: { RED: { primary: string; deep: string; accentBg: string }; BLUE: { primary: string; deep: string; accentBg: string } };
  editingRedScore: boolean; editingBlueScore: boolean;
  setEditingRedScore: (v: boolean) => void; setEditingBlueScore: (v: boolean) => void;
  updateRyderScore: (team: "RED" | "BLUE", delta: number) => void;
  setRyderScore: (team: "RED" | "BLUE", value: number) => void;
  updateRyderTeamName: (team: "RED" | "BLUE", name: string) => void;
  onEditTeams: () => void; onDisable: () => void;
}) {
  const redMembers = ryderAssignments.filter(a => a.team === "RED")
    .map(a => members.find(m => m.userId === a.userId)).filter(Boolean) as Member[];
  const blueMembers = ryderAssignments.filter(a => a.team === "BLUE")
    .map(a => members.find(m => m.userId === a.userId)).filter(Boolean) as Member[];

  const renderTeamSide = (
    team: "RED" | "BLUE",
    name: string | null | undefined,
    placeholder: string,
    score: number,
    teamMembers: Member[],
    isEditingScore: boolean,
    setEditing: (v: boolean) => void,
    align: "left" | "right",
  ) => {
    const c = teamColors[team];
    return (
      <div style={{ flex: 1, padding: "8px 10px 8px", background: c.accentBg, position: "relative", textAlign: align }}>
        {isOwner ? (
          <input
            value={name ?? ""}
            onChange={e => updateRyderTeamName(team, e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="words"
            style={{
              width: "100%", background: "transparent", border: "none", outline: "none",
              fontFamily: "'Playfair Display', serif", fontSize: 12, fontWeight: 800, color: "#fff",
              textAlign: align, padding: 0,
            }}
          />
        ) : (
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 12, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
            {name?.trim() || placeholder}
          </div>
        )}

        {/* Score */}
        <div style={{ marginTop: 5, display: "flex", justifyContent: align === "left" ? "flex-start" : "flex-end" }}>
          {isEditingScore ? (
            <input
              autoFocus
              type="number" step="0.5" min="0"
              defaultValue={score}
              onBlur={e => { setRyderScore(team, parseFloat(e.target.value)); setEditing(false); }}
              onKeyDown={e => { if (e.key === "Enter") { setRyderScore(team, parseFloat((e.target as HTMLInputElement).value)); setEditing(false); } else if (e.key === "Escape") setEditing(false); }}
              style={{ width: 60, fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#fff", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(212,160,23,0.5)", borderRadius: 6, textAlign: "center", outline: "none" }}
            />
          ) : (
            <div
              onClick={() => isOwner && setEditing(true)}
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1,
                cursor: isOwner ? "pointer" : "default",
                textShadow: "0 2px 10px rgba(0,0,0,0.5)",
              }}
            >
              {formatRyderScore(score)}
            </div>
          )}
        </div>

        {/* Member avatars */}
        <div style={{ marginTop: 6, display: "flex", justifyContent: align === "left" ? "flex-start" : "flex-end", flexWrap: "wrap", gap: 3 }}>
          {teamMembers.length === 0 ? (
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>No players</div>
          ) : teamMembers.slice(0, 5).map(m => (
            <div key={m.id} style={{ width: 18, height: 18, borderRadius: "50%", overflow: "hidden", border: "1.5px solid #fff", background: "rgba(0,0,0,0.3)" }}>
              {m.user.avatarUrl
                ? <img src={m.user.avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                : <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" style={{ margin: "5px" }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              }
            </div>
          ))}
          {teamMembers.length > 5 && (
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontSize: 8, fontWeight: 700, color: "#fff" }}>+{teamMembers.length - 5}</div>
          )}
        </div>

        {/* Owner score buttons */}
        {isOwner && (
          <div style={{ marginTop: 7, display: "flex", gap: 5, justifyContent: align === "left" ? "flex-start" : "flex-end" }}>
            <button onClick={() => updateRyderScore(team, 0.5)} style={{ padding: "3px 8px", borderRadius: 7, background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#fff", cursor: "pointer" }}>+ ½</button>
            <button onClick={() => updateRyderScore(team, 1)}   style={{ padding: "3px 8px", borderRadius: 7, background: "#d4a017", border: "1px solid #fbbf24", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 800, color: "#1a1a1a", cursor: "pointer" }}>+ 1</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <div style={{
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(212,160,23,0.4)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
        position: "relative",
      }}>
        {/* Top gold trim */}
        <div style={{ height: 2, background: "linear-gradient(to right, #d4a017, #fbbf24, #d4a017)" }} />

        {/* Title bar */}
        <div style={{ background: "#0a0a0a", padding: "4px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 9, fontWeight: 800, color: "#d4a017", letterSpacing: "0.18em", textTransform: "uppercase" }}>The Ryder Cup</div>
          {isOwner && (
            <button onClick={onEditTeams} style={{ background: "none", border: "none", padding: 0, fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(212,160,23,0.85)", cursor: "pointer", letterSpacing: "0.04em" }}>Edit</button>
          )}
        </div>

        {/* Body — two team panels with trophy badge in the middle */}
        <div style={{ display: "flex", position: "relative" }}>
          {renderTeamSide("RED", trip.redTeamName, "Team 1", trip.redTeamScore ?? 0, redMembers, editingRedScore, setEditingRedScore, "left")}
          {/* Center trophy badge */}
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 36, height: 36, borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, #fde68a 0%, #d4a017 50%, #92580f 100%)",
            border: "2px solid #fbbf24",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 10px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.3)",
            zIndex: 2,
            pointerEvents: "none",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#7c4a05" stroke="#3d2300" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" fill="none" stroke="#3d2300" strokeWidth="1.4"/>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" fill="none" stroke="#3d2300" strokeWidth="1.4"/>
              <path d="M4 22h16" stroke="#3d2300" strokeWidth="1.6"/>
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" stroke="#3d2300" strokeWidth="1.4" fill="none"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" stroke="#3d2300" strokeWidth="1.4" fill="none"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" stroke="#3d2300" strokeWidth="1.2"/>
            </svg>
          </div>
          {renderTeamSide("BLUE", trip.blueTeamName, "Team 2", trip.blueTeamScore ?? 0, blueMembers, editingBlueScore, setEditingBlueScore, "right")}
        </div>

        {/* Bottom gold trim */}
        <div style={{ height: 2, background: "linear-gradient(to right, #d4a017, #fbbf24, #d4a017)" }} />
      </div>
    </div>
  );
}
