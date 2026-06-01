"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { sendPushToUser } from "@/lib/sendPush";
import { HlsVideo } from "@/components/HlsVideo";
import { getVideoSrc } from "@/lib/getVideoSrc";
import { DirectionsButton } from "@/components/DirectionsButton";
import CreateGameSheet from "@/components/CreateGameSheet";
import TripNotes from "@/components/TripNotes";
import AirportField from "@/components/AirportField";
import LodgingField from "@/components/LodgingField";
import ScorecardCell from "@/components/ScorecardCell";
import Toast, { type ToastState } from "@/components/Toast";
import { GAME_FORMATS as SHARED_GAME_FORMATS, gameFormatLabel, HOLE_PICKED_FORMATS as SHARED_HOLE_PICKED, TEAM_WAGER_FORMATS as SHARED_TEAM_WAGER, MULTI_SEGMENT_FORMATS as SHARED_MULTI_SEGMENT } from "@/lib/gameFormats";
import { cdnImage } from "@/lib/cdnImage";

type Trip = {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  createdBy: string;
  imageUrl: string | null;
  // Logistics — surfaced on the trip header; collected at creation
  // and editable later. Used for public-conversion content.
  arrivalAirport?: string | null;
  lodging?: string | null;
  lodgingCity?: string | null;
  lodgingState?: string | null;
  isPublic?: boolean;
  publicizedAt?: string | null;
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
  course: { id: string; name: string; city: string; state: string; uploadCount: number; logoUrl: string | null; coverImageUrl: string | null; holeCount?: number; latitude?: number | null; longitude?: number | null };
  secondaryCourse?: { id: string; name: string; city: string; state: string; uploadCount: number; logoUrl: string | null; coverImageUrl: string | null; holeCount?: number; latitude?: number | null; longitude?: number | null } | null;
};

type Member = {
  id: string;
  userId: string;
  role: string;
  // handicapIndex is hydrated into Member.user so the unified
  // CreateGameSheet can pre-fill each player's HI without a second
  // fetch when the sheet opens.
  user: { username: string; displayName: string; avatarUrl: string | null; handicapIndex?: number | null };
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

type GamePlayer = { userId: string; displayName: string; avatarUrl: string | null; handicapIndex: number; teamId: string };

type TripGameRecord = {
  id: string; courseId: string; courseName: string; format: string;
  formatConfig: Record<string, unknown>; players: any[]; gameSheet: string; shareText: string; createdAt: string;
  holeHandicaps?: number[] | null;
  courseLogoUrl?: string | null;
};

// Game format catalog now lives in @/lib/gameFormats — single source
// of truth shared with CreateGameSheet, /tee-up, /games/[id], and
// the round-recap beauty route. Aliased here so the legacy in-file
// names keep working without a sweep through the rest of this file.
const GAME_FORMATS = SHARED_GAME_FORMATS;
const HOLE_PICKED_FORMATS = SHARED_HOLE_PICKED;

// Formats where the winner is a TEAM (not an individual player) and the
// stake is a per-team wager. formatConfig.wager stores the dollar amount
// each team puts up; winners.team stores the winning teamId ("A", "B"…).
// On settle, the winning team takes the pot from the losing team(s),
// split per teammate.
const TEAM_WAGER_FORMATS = SHARED_TEAM_WAGER;
const MULTI_SEGMENT_FORMATS = SHARED_MULTI_SEGMENT;

// ── Pops-per-hole scorecard ─────────────────────────────────────────────────
// Renders a real scorecard grid: holes across the top, one row per player,
// a green dot in each hole the player gets a stroke on. High handicaps
// (net > 18) can collect a second dot on the hardest holes — strokeHoles
// lists those holes twice, so we count occurrences per hole. Horizontally
// scrollable so all 18 holes fit on a phone.
function GamePopsScorecard({ players, holeHandicaps }: {
  players: any[];
  holeHandicaps?: number[] | null;
}) {
  const anyStrokes = players.some(p => (p.strokeHoles?.length ?? 0) > 0);
  if (!anyStrokes) return null;

  const inferredMax = Math.max(
    18,
    ...players.flatMap(p => (p.strokeHoles ?? []) as number[]),
  );
  const holeCount = holeHandicaps && holeHandicaps.length ? holeHandicaps.length : (inferredMax > 18 ? 18 : inferredMax);
  const holes = Array.from({ length: holeCount }, (_, i) => i + 1);
  const showHcpRow = !!(holeHandicaps && holeHandicaps.length === holeCount);

  const popsFor = (p: any): Map<number, number> => {
    const m = new Map<number, number>();
    for (const h of (p.strokeHoles ?? []) as number[]) m.set(h, (m.get(h) ?? 0) + 1);
    return m;
  };

  const NAME_W = 92;
  const CELL = 28;

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "14px 0 14px 16px" }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, paddingRight: 16 }}>Stroke Allocation</div>
      <div style={{ overflowX: "auto", paddingRight: 16 }}>
        <div style={{ display: "inline-block", minWidth: "100%" }}>
          {/* Hole number row */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: NAME_W, flexShrink: 0, fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Hole</div>
            {holes.map(h => (
              <div key={h} style={{ width: CELL, flexShrink: 0, textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>{h}</div>
            ))}
          </div>
          {/* HCP rank row */}
          {showHcpRow && (
            <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
              <div style={{ width: NAME_W, flexShrink: 0, fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>HCP</div>
              {holes.map((h, i) => (
                <div key={h} style={{ width: CELL, flexShrink: 0, textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 9.5, color: "rgba(255,255,255,0.32)", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>{holeHandicaps![i]}</div>
              ))}
            </div>
          )}
          {/* One row per player */}
          {players.map((p, pi) => {
            const pops = popsFor(p);
            const total = p.strokeHoles?.length ?? 0;
            return (
              <div key={pi} style={{ display: "flex", alignItems: "center", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ width: NAME_W, flexShrink: 0, fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 6 }}>
                  {p.displayName}{total > 0 ? <span style={{ color: "rgba(77,168,98,0.75)", fontWeight: 700 }}> ({total})</span> : null}
                </div>
                {holes.map(h => {
                  const n = pops.get(h) ?? 0;
                  return (
                    <div key={h} style={{ width: CELL, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
                      {n === 0
                        ? <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.09)" }} />
                        : Array.from({ length: Math.min(n, 4) }, (_, di) => (
                            <span key={di} style={{ width: 6, height: 6, borderRadius: "50%", background: "#4da862" }} />
                          ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
  const searchParams = useSearchParams();
  // ?startGame=1 deep-link comes from /tee-up's "Play a Game" wizard
  // after it creates the round.
  // ?createGame=1 is the same intent from the home's "Create a game"
  // CTA on the YourTour card. Either flag auto-opens the game
  // creation modal once the trip data has loaded.
  const startGameRequested =
    searchParams.get("startGame") === "1" || searchParams.get("createGame") === "1";
  // ?welcome=1 fires when the user just created this trip from a
  // trip-idea blueprint via Start Planning. Opens a quick onboarding
  // sheet that asks the rest (dates + invite). Stripped from the
  // URL after consumed so a back-navigation doesn't replay it.
  const [showWelcome, setShowWelcome] = useState(searchParams.get("welcome") === "1");
  const [welcomeStart, setWelcomeStart] = useState("");
  const [welcomeEnd, setWelcomeEnd] = useState("");
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  // Publicize-confirmation sheet — opens when ?publicize=1 (from the
  // day-after notification deep-link) OR when the user taps the
  // publicize CTA in the trip header (set elsewhere).
  const [publicizeOpen, setPublicizeOpen] = useState(searchParams.get("publicize") === "1");
  const [publicizeTagline, setPublicizeTagline] = useState("");
  const [publicizing, setPublicizing] = useState(false);
  const [publicizeError, setPublicizeError] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if ((params.get("welcome") === "1" || params.get("publicize") === "1") && typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  // Tee-time string ("HH:MM"). Edited inline on the round/game edit
  // sheet so the user doesn't have to open a separate sheet for the
  // course row underneath. On save, written to the round's only
  // GolfTripCourse alongside the GolfTrip update.
  const [editTeeTime, setEditTeeTime] = useState("");
  const [editAirport, setEditAirport] = useState("");
  const [editLodging, setEditLodging] = useState("");
  const [editLodgingCity, setEditLodgingCity] = useState<string | null>(null);
  const [editLodgingState, setEditLodgingState] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete trip
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingTrip, setDeletingTrip] = useState(false);

  async function handleDeleteTrip() {
    if (!trip || deletingTrip) return;
    setDeletingTrip(true);
    const supabase = createClient();
    const tripId = trip.id;
    await supabase.from("GolfTrip").delete().eq("id", tripId);
    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "trip_deleted", referenceId: tripId }),
    }).catch(() => {});
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
  // NOTE: do NOT call useKeyboardAwareSheet here — the inline
  // bottom/maxHeight it sets fights with the custom-overlay design
  // (alignItems:stretch + flex:1) and collapses the sheet back to
  // content height. The global KeyboardSync + flex stretch already
  // handle keyboard + height correctly.
  const [viewGameOpen, setViewGameOpen] = useState(false);
  const [viewGame, setViewGame] = useState<TripGameRecord | null>(null);
  // Scorecard verify sheet — opens over the game view so users can confirm
  // par/yardage/handicap-rank without losing the game context.
  const [scorecardSheetOpen, setScorecardSheetOpen] = useState(false);
  // Share-the-round chooser sheet: lets the user pick between attaching the
  // beauty PNG file or sending an iMessage-friendly link with og:image.
  const [sendRoundChooserOpen, setSendRoundChooserOpen] = useState(false);
  const [sendingMode, setSendingMode] = useState<"image" | "link" | null>(null);
  const [sendingGameImage, setSendingGameImage] = useState(false);
  // Inline toast for non-blocking errors/successes — replaces native alert().
  const [toast, setToast] = useState<ToastState>(null);
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
  // Winner-picker bottom sheet — captures the game + key (e.g. "hole-7"
  // for CTP/LD, "overall" for everything else) that we're declaring a
  // winner for. Null = sheet closed.
  const [winnerPicker, setWinnerPicker] = useState<{ gameId: string; key: string; label: string } | null>(null);
  const [tripImageExpanded, setTripImageExpanded] = useState(false);
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

      // Membership gate — anyone with a trip link could previously
      // read members + courses + games + clips even if they weren't
      // invited (audit 2026-05-25). The owner always has access; all
      // other viewers must be in GolfTripMember.
      if (!authUser) {
        router.replace(`/login?next=/trips/${id}`);
        return;
      }
      const isCreator = authUser.id === tripData.createdBy;
      if (!isCreator) {
        const { data: membership } = await supabase
          .from("GolfTripMember")
          .select("id")
          .eq("tripId", id)
          .eq("userId", authUser.id)
          .maybeSingle();
        if (!membership) {
          router.replace("/tee-up");
          return;
        }
      }

      setTrip(tripData);
      setIsOwner(isCreator);

      const { data: tcData } = await supabase.from("GolfTripCourse").select("id, courseId, secondaryCourseId, playDate, teeTime, accommodation, sortOrder").eq("tripId", id);
      if (tcData && tcData.length > 0) {
        const allCourseIds = [
          ...tcData.map((tc: any) => tc.courseId),
          ...tcData.map((tc: any) => tc.secondaryCourseId).filter(Boolean),
        ];
        const { data: coursesData } = await supabase.from("Course").select("id, name, city, state, uploadCount, logoUrl, coverImageUrl, holeCount, latitude, longitude").in("id", allCourseIds);
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
        const { data: usersData } = await supabase.from("User").select("id, username, displayName, avatarUrl, handicapIndex").in("id", userIds);
        setMembers(memberData.map((m: any) => ({
          ...m,
          user: usersData?.find((u: any) => u.id === m.userId) || { username: "golfer", displayName: "Golfer", avatarUrl: null },
        })));
      }

      const { data: clipsData } = await supabase.from("Upload").select("id, mediaType, mediaUrl, cloudflareVideoId, courseId, tripPublic, strategyNote, shotType").eq("tripId", id).order("createdAt", { ascending: false });
      if (clipsData) setClips(clipsData);

      const { data: gamesData } = await supabase.from("TripGame").select("id, courseId, courseName, format, formatConfig, players, gameSheet, shareText, holeHandicaps, createdAt").eq("tripId", id).order("createdAt", { ascending: false });
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
      const q = inviteQuery.replace(/[,()]/g, "");
      const { data } = await supabase.from("User").select("id, username, displayName, avatarUrl").or(`username.ilike.%${q}%,displayName.ilike.%${q}%`).limit(8);
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

  // Course search for add-course sheet.
  //
  // Sharpened from the original single-OR pattern:
  //   - Now includes STATE in the matchable columns (the prior
  //     query only matched name + city, so a search like
  //     "arizona" returned nothing even when the state matched).
  //   - Multi-word queries are AND'd across columns. "hampshire
  //     country club" now matches a row only when ALL three words
  //     appear somewhere in name/city/state, not just the first
  //     word. Chained .or() calls become an AND filter at the
  //     PostgREST layer, which is exactly what we want here.
  //   - PG ilike special chars (%, _) escaped so a typed wildcard
  //     doesn't blow open the query.
  //   - Stale-result protection: capture the input snapshot at
  //     fetch start and discard if the user has typed since.
  useEffect(() => {
    if (!courseSearch.trim()) { setCourseResults([]); return; }
    if (courseSearchDebounce.current) clearTimeout(courseSearchDebounce.current);
    setCourseSearchLoading(true);
    const snapshot = courseSearch;
    courseSearchDebounce.current = setTimeout(async () => {
      const supabase = createClient();
      const escape = (s: string) => s.replace(/[%_,]/g, " ");
      const words = snapshot.trim().split(/\s+/).filter(Boolean).map(escape);
      let q = supabase.from("Course").select("id, name, city, state, holeCount, logoUrl");
      for (const w of words) {
        q = q.or(`name.ilike.%${w}%,city.ilike.%${w}%,state.ilike.%${w}%`);
      }
      const { data } = await q.order("uploadCount", { ascending: false, nullsFirst: false }).limit(15);
      // Don't clobber state if the user has kept typing.
      if (snapshot !== courseSearch && courseSearch.trim() !== "") return;
      setCourseResults(data || []);
      setCourseSearchLoading(false);
    }, 220);
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
        referenceId: id as string,
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
    const supabase = createClient();
    const updates = {
      name: editName.trim(),
      description: editDesc.trim() || null,
      startDate: editStart || null,
      endDate: editEnd || null,
      arrivalAirport: editAirport.trim() || null,
      lodging: editLodging.trim() || null,
      lodgingCity: editLodgingCity,
      lodgingState: editLodgingState,
    };
    await supabase.from("GolfTrip").update(updates).eq("id", id as string);
    setTrip(prev => prev ? { ...prev, ...updates } : prev);

    // For rounds and games (single-stop), also persist the tee time
    // alongside the trip update — user expects everything in one
    // sheet, one save. Trips have per-stop teeTimes managed on the
    // courses list, so this only fires for non-trip flavors with
    // exactly one course.
    if (flavor !== "trip" && tripCourses.length === 1) {
      const tc = tripCourses[0];
      const teeTimeValue = editTeeTime || null;
      const playDateValue = editStart || null;
      await supabase
        .from("GolfTripCourse")
        .update({ teeTime: teeTimeValue, playDate: playDateValue })
        .eq("id", tc.id);
      setTripCourses(prev => prev.map(x => x.id === tc.id ? { ...x, teeTime: teeTimeValue, playDate: playDateValue } : x));
    }

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

  // Auto-open the game wizard when arriving via the Play-a-Game
  // deep-link from /tee-up. We wait until trip + members + courses
  // have all loaded so openGameCreator() can pre-populate the player
  // list from the trip's membership.
  const startGameTriggered = useRef(false);
  useEffect(() => {
    if (!startGameRequested) return;
    if (loading) return;
    if (startGameTriggered.current) return;
    if (!members.length || !tripCourses.length) return;
    startGameTriggered.current = true;
    openGameCreator();
    // Clear the query param so a back/forward navigation doesn't
    // re-trigger the wizard.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("startGame");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startGameRequested, loading, members.length, tripCourses.length]);

  // Thin wrapper around setGameOpen — kept as a function so the two
  // callers (?startGame=1 deep-link effect + Create Game button) can
  // stay async-friendly. The unified <CreateGameSheet> handles all
  // wizard state setup internally via the presetTrip prop, so no
  // pre-populate work belongs here anymore (2026-05-24 refactor).
  const openGameCreator = async () => {
    setGameOpen(true);
  };


  // Declare (or clear) the winner for a specific game + key. The key is
  // "overall" for non-hole-picked formats, or "hole-N" (1..18) for CTP /
  // Longest Drive. Anyone on the trip can declare and overwrite winners.
  const declareWinner = async (gameId: string, key: string, winnerUserId: string | null) => {
    const game = games.find(g => g.id === gameId);
    if (!game) return;
    const supabase = createClient();
    const existingCfg = (game.formatConfig as Record<string, unknown> | null) ?? {};
    const existingWinners = ((existingCfg as { winners?: Record<string, string> }).winners ?? {}) as Record<string, string>;
    const nextWinners: Record<string, string> = { ...existingWinners };
    if (winnerUserId) nextWinners[key] = winnerUserId;
    else delete nextWinners[key];
    const nextCfg = { ...existingCfg, winners: nextWinners };
    const { error } = await supabase.from("TripGame").update({ formatConfig: nextCfg }).eq("id", gameId);
    if (error) return;
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, formatConfig: nextCfg } : g));
    setWinnerPicker(null);
  };

  // Per-player NET winnings across all wagered games on this trip:
  //   - CTP / Longest Drive: per-hole stake. Winner takes stake from
  //     every other player on each hole they won.
  //   - Best Ball: per-team wager. Winning team takes the pot from
  //     each losing team; split evenly among teammates.
  // Players with net amount <= 0 are hidden — only those UP money show.
  const winningsByPlayer = useMemo(() => {
    type Row = { userId: string; name: string; avatarUrl: string | null; amount: number };
    type Player = { userId: string; displayName: string; avatarUrl: string | null; teamId?: string };
    const totals = new Map<string, Row>();
    const bump = (p: Player, delta: number) => {
      const row = totals.get(p.userId) ?? { userId: p.userId, name: p.displayName, avatarUrl: p.avatarUrl, amount: 0 };
      row.amount += delta;
      totals.set(p.userId, row);
    };

    for (const g of games) {
      const cfg = (g.formatConfig as { stake?: number; wager?: number; winners?: Record<string, string> } | null) ?? {};
      const winners = cfg.winners ?? {};
      const players: Player[] = Array.isArray(g.players) ? g.players : [];

      // CTP / Longest Drive — per-hole stake
      if (HOLE_PICKED_FORMATS.has(g.format)) {
        const stake = Number(cfg.stake) || 0;
        if (!stake) continue;
        for (const winnerId of Object.values(winners)) {
          if (!winnerId) continue;
          const otherCount = players.length - 1;
          if (otherCount <= 0) continue;
          const winner = players.find(p => p.userId === winnerId);
          if (winner) bump(winner, stake * otherCount);
          for (const p of players) {
            if (p.userId !== winnerId) bump(p, -stake);
          }
        }
        continue;
      }

      // Multi-segment formats (Nassau today, anything we add later
      // that bundles independent bets). Each segment with a declared
      // winner settles like a single-stake winner-takes-from-losers:
      //   winner receives stake × (numPlayers - 1)
      //   each loser pays stake
      if (MULTI_SEGMENT_FORMATS[g.format]) {
        const segments = MULTI_SEGMENT_FORMATS[g.format];
        for (const seg of segments) {
          const winnerId = winners[seg.key];
          if (!winnerId) continue;
          const stake = Number((cfg as any)[seg.stakeKey]) || 0;
          if (!stake) continue;
          const winner = players.find(p => p.userId === winnerId);
          if (!winner) continue;
          const losers = players.filter(p => p.userId !== winnerId);
          if (losers.length === 0) continue;
          bump(winner, stake * losers.length);
          for (const p of losers) bump(p, -stake);
        }
        continue;
      }

      // Best Ball — team wager
      if (TEAM_WAGER_FORMATS.has(g.format)) {
        const wager = Number(cfg.wager) || 0;
        if (!wager) continue;
        const winningTeamId = winners.team;
        if (!winningTeamId) continue;
        const winningPlayers = players.filter(p => (p.teamId || "A") === winningTeamId);
        const losingPlayers = players.filter(p => (p.teamId || "A") !== winningTeamId);
        if (winningPlayers.length === 0 || losingPlayers.length === 0) continue;
        const losingTeamIds = new Set(losingPlayers.map(p => p.teamId || "A"));
        const perWinner = (wager * losingTeamIds.size) / winningPlayers.length;
        for (const p of winningPlayers) bump(p, perWinner);
        for (const p of losingPlayers) {
          const theirTeam = p.teamId || "A";
          const theirTeamSize = losingPlayers.filter(lp => (lp.teamId || "A") === theirTeam).length;
          bump(p, -(wager / theirTeamSize));
        }
        continue;
      }
    }

    // Show winners AND losers. Only hide true $0 balances (players who
    // played in staked games but didn't win or lose anything). Sort
    // descending so the biggest winner is at the top and the biggest
    // loser is at the bottom.
    return Array.from(totals.values()).filter(r => r.amount !== 0).sort((a, b) => b.amount - a.amount);
  }, [games]);

  const deleteGame = async (gameId: string) => {
    if (deletingGameId) return;
    setDeletingGameId(gameId);
    await createClient().from("TripGame").delete().eq("id", gameId);
    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "game_deleted", referenceId: gameId }),
    }).catch(() => {});
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
      <main style={{ minHeight: "100dvh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Loading...</div>
      </main>
    );
  }

  if (!trip) {
    return (
      <main style={{ minHeight: "100dvh", background: "#07100a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
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

  // Page "flavor" — drives every contextual label on this page so a
  // GolfTrip that was created via Play-a-Game reads as a Game (not a
  // Round), a single-day round reads as a Round, and a multi-day
  // outing reads as a Trip. Same data, three different framings.
  //   - Has at least one game attached → "game"
  //   - Single day, single course, no games → "round"
  //   - Anything else → "trip"
  const flavor: "game" | "round" | "trip" = games.length > 0
    ? "game"
    : isRound ? "round" : "trip";
  const flavorUpper = flavor === "game" ? "Game" : flavor === "round" ? "Round" : "Trip";

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
      setToast({ msg: `Couldn't clone the round: ${tcErr.message}`, kind: "error" });
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
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <main style={{ minHeight: "100dvh", background: "#07100a", color: "#fff", paddingBottom: 100 }}>
        <style>{`
          
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
                  onClick={() => { setEditName(trip.name); setEditDesc(trip.description || ""); setEditStart(trip.startDate || ""); setEditEnd(trip.endDate || ""); setEditTeeTime(tripCourses[0]?.teeTime || ""); setEditAirport(trip.arrivalAirport || ""); setEditLodging(trip.lodging || ""); setEditLodgingCity(trip.lodgingCity || null); setEditLodgingState(trip.lodgingState || null); setEditOpen(true); }}
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
                      <img src={cdnImage(roundCourse.logoUrl)} alt={roundCourse.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                  <img src={cdnImage(trip.imageUrl)} alt={trip.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : isRound && roundCourse?.logoUrl ? (
                  <img src={cdnImage(roundCourse.logoUrl)} alt={roundCourse.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, color: "#4da862" }}>{tripAbbr}</span>
                )}
              </div>
              <input ref={imageInputRef} type="file" accept="image/*" onChange={handleTripImagePick} style={{ display: "none" }} />

              <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{flavor === "game" ? "Upcoming Game" : flavor === "round" ? "Upcoming Round" : "Golf Trip"}</div>
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
                        onClick={() => { setEditName(trip.name); setEditDesc(trip.description || ""); setEditStart(trip.startDate || ""); setEditEnd(trip.endDate || ""); setEditTeeTime(tripCourses[0]?.teeTime || ""); setEditAirport(trip.arrivalAirport || ""); setEditLodging(trip.lodging || ""); setEditLodgingCity(trip.lodgingCity || null); setEditLodgingState(trip.lodgingState || null); setEditOpen(true); }}
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
                {/* Airport + lodging row — surfaces the logistics
                    captured at trip creation so the header isn't
                    just a name + date. Each chip uses a custom
                    green-stroke icon. */}
                {!isRound && (trip.arrivalAirport || trip.lodging) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {trip.arrivalAirport && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 99, background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.28)", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(126,200,140,0.95)" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>
                        {trip.arrivalAirport}
                      </span>
                    )}
                    {trip.lodging && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 99, background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.28)", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(126,200,140,0.95)", maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {/* Hotel glyph — bed + arched headboard + lamp,
                            replaces the generic building-with-lines icon
                            that didn't read as "hotel". */}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 18v-6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v6" />
                          <path d="M3 18h18" />
                          <path d="M3 21h18" />
                          <path d="M8 12h5a2 2 0 0 1 2 2v1" />
                          <circle cx="9" cy="11" r="1.2" />
                        </svg>
                        {trip.lodging}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Members + chat + invite — centered. Avatars bumped
                32 → 36px and overlap loosened, with each member's
                first name listed beneath the stack so the user sees
                WHO is in the round/trip at a glance instead of just
                a "2 golfers" count. */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => setMembersOpen(true)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0, maxWidth: "92vw" }}>
                <div style={{ display: "flex" }}>
                  {members.slice(0, 5).map((m, i) => {
                    const t = trip.ryderCupEnabled ? teamOf(m.userId) : null;
                    const ringColor = t === "RED" ? "#c8102e" : t === "BLUE" ? "#3b82f6" : "#07100a";
                    return (
                      <div key={m.id} style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", border: `2.5px solid ${ringColor}`, background: "rgba(77,168,98,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: i > 0 ? -8 : 0, flexShrink: 0, zIndex: members.length - i, boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
                        {m.user.avatarUrl
                          ? <img src={cdnImage(m.user.avatarUrl)} alt={m.user.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        }
                      </div>
                    );
                  })}
                </div>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.7)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
                  {members.slice(0, 4).map(m => (m.user.displayName || m.user.username || "").split(/\s+/)[0]).filter(Boolean).join(" · ")}
                  {members.length > 4 ? ` · +${members.length - 4}` : ""}
                </span>
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
              Share the {flavorUpper}
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
                                    ? <img src={cdnImage(tc.course.logoUrl)} alt={tc.course.name} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
                                    : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#4da862" }}>{abbr(tc.course.name)}</span>
                                  }
                                </div>
                                {tc.secondaryCourse && (
                                  <div style={{ position: "absolute", bottom: -4, right: -4, width: 22, height: 22, borderRadius: 6, background: "rgba(7,16,10,0.95)", border: "1.5px solid #4da862", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {tc.secondaryCourse.logoUrl
                                      ? <img src={cdnImage(tc.secondaryCourse.logoUrl)} alt={tc.secondaryCourse.name} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
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
                                <div style={{ display: "flex", gap: 6 }}>
                                  <DirectionsButton course={tc.course} />
                                  <button onClick={e => { e.stopPropagation(); openEditCourse(tc); }} style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                  </button>
                                </div>
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
                const isHolePicked = HOLE_PICKED_FORMATS.has(g.format);
                const sub =
                  g.format === "nassau" ? `$${cfg?.frontAmount}/$${cfg?.backAmount}/$${cfg?.totalAmount}`
                  : g.format === "skins" ? `$${cfg?.skinsAmount}/skin`
                  : g.format === "best_ball" && Number(cfg?.wager) > 0 ? `$${cfg.wager}/team`
                  : isHolePicked && cfg?.holes?.length
                    ? `${cfg.holes.length} hole${cfg.holes.length === 1 ? "" : "s"}${Number(cfg?.stake) > 0 ? ` · $${cfg.stake}/hole` : ""}`
                    : fmt?.desc || "";
                const winners = (cfg?.winners ?? {}) as Record<string, string>;
                const playerName = (uid?: string) => uid ? (g.players?.find((p: any) => p.userId === uid)?.displayName ?? "@?") : null;
                return (
                  <div
                    key={g.id}
                    onClick={() => { setViewGame(g); setViewGameOpen(true); }}
                    style={{
                      /* Game card — gamier, hero treatment when the page
                         flavor is "game" (this is a one-day Play-a-Game
                         round). Gradient background + green accent border +
                         drop-shadow gives the card a deliberate "this is
                         the main event" feel. Multi-game trip cards keep
                         the older compact look. */
                      background: isRound
                        ? "linear-gradient(135deg, rgba(77,168,98,0.14) 0%, rgba(45,122,66,0.06) 100%)"
                        : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isRound ? "rgba(77,168,98,0.35)" : "rgba(255,255,255,0.07)"}`,
                      borderRadius: 16,
                      padding: isRound ? "16px 16px 14px" : "13px 14px",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      gap: 0,
                      boxShadow: isRound ? "0 6px 20px rgba(0,0,0,0.25)" : "none",
                    }}
                  >
                    {/* Top row — existing summary */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {/* Round-mode: skip the course icon + name (same course everywhere on this page). */}
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
                            {/* Eyebrow + big Playfair title for the gamey
                                hero feel. Stakes get their own line with
                                a green accent so they stand out. */}
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)", marginBottom: 4 }}>Game · {g.players?.length || 0} {(g.players?.length || 0) === 1 ? "player" : "players"}</div>
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>
                              {fmt?.name || g.format}
                            </div>
                            {sub && (
                              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#4da862", marginTop: 4, letterSpacing: "0.02em" }}>{sub}</div>
                            )}
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
                      {/* Hero card gets a green chevron pill to read more
                          like a "play" CTA than a passive arrow. */}
                      {isRound ? (
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#2d7a42", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(45,122,66,0.4)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      )}
                    </div>

                    {/* Players row — round mode shows the players as a
                        stacked-avatar pill so users see WHO's in the game,
                        not just a count. Avatars bumped 26 → 34px and
                        names bumped 11 → 12.5px so the players actually
                        register at a glance. */}
                    {isRound && Array.isArray(g.players) && g.players.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(77,168,98,0.15)" }}>
                        <div style={{ display: "flex" }}>
                          {g.players.slice(0, 5).map((p: any, i: number) => (
                            <div key={p.userId} style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", border: "2.5px solid #0d2318", background: "rgba(77,168,98,0.22)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: i > 0 ? -10 : 0, zIndex: (g.players?.length || 0) - i, flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
                              {p.avatarUrl
                                ? <img src={cdnImage(p.avatarUrl)} alt={p.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>}
                            </div>
                          ))}
                        </div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.78)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {g.players.slice(0, 3).map((p: any) => p.displayName || "@?").join(" · ")}
                          {g.players.length > 3 && ` · +${g.players.length - 3}`}
                        </div>
                      </div>
                    )}

                    {/* Pops scorecard preview — vital info up front. Renders
                        nothing when the game is scratch (nobody gets strokes).
                        Tap anywhere on the card to open the full sheet. */}
                    {isRound && !isHolePicked && Array.isArray(g.players) && (
                      <div style={{ marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
                        <GamePopsScorecard players={g.players} holeHandicaps={g.holeHandicaps} />
                        <div
                          onClick={() => { setViewGame(g); setViewGameOpen(true); }}
                          style={{ marginTop: 8, textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(77,168,98,0.8)", cursor: "pointer", padding: "4px 0" }}
                        >
                          View full game →
                        </div>
                      </div>
                    )}

                    {/* CTP / Longest Drive — per-hole scorecard cells.
                        Sharp 3px corners + Playfair italic label give
                        the row a printed-card feel instead of the
                        generic gold-pill aesthetic everywhere else. */}
                    {isHolePicked && Array.isArray(cfg?.holes) && cfg.holes.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 6 }}>
                        {cfg.holes.map((h: number) => {
                          const winnerId = winners[`hole-${h}`];
                          const name = playerName(winnerId);
                          const stake = Number(cfg.stake) || 0;
                          return (
                            <ScorecardCell
                              key={h}
                              label={`Hole ${h}`}
                              meta={stake ? `$${stake}` : undefined}
                              value={name}
                              placeholder="— declare"
                              onClick={(e) => { e.stopPropagation(); setWinnerPicker({ gameId: g.id, key: `hole-${h}`, label: `Hole ${h}` }); }}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Other formats — overall winner pill. For team-wager
                        formats (Best Ball) the "winner" is a TEAM identified
                        by teamId; the pill shows "Team A" + member names. */}
                    {!isHolePicked && (() => {
                      const isTeamWager = TEAM_WAGER_FORMATS.has(g.format);
                      const segments = MULTI_SEGMENT_FORMATS[g.format];

                      // Multi-segment (Nassau): one scorecard cell per
                      // segment. Equal-width grid so the three bets
                      // line up like rows on a printed scorecard.
                      if (segments && segments.length > 0) {
                        return (
                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", display: "grid", gridTemplateColumns: `repeat(${segments.length}, 1fr)`, gap: 6 }}>
                            {segments.map((seg) => {
                              const winnerId = winners[seg.key];
                              const name = winnerId ? (playerName(winnerId) || "") : "";
                              const stake = Number((cfg as any)?.[seg.stakeKey]) || 0;
                              return (
                                <ScorecardCell
                                  key={seg.key}
                                  label={seg.label}
                                  meta={stake ? `$${stake}` : undefined}
                                  value={name}
                                  placeholder="— declare"
                                  onClick={(e) => { e.stopPropagation(); setWinnerPicker({ gameId: g.id, key: seg.key, label: `${seg.label}${stake ? ` · $${stake}` : ""}` }); }}
                                />
                              );
                            })}
                          </div>
                        );
                      }

                      // Single-winner formats (stableford, match play,
                      // stroke play, scramble) or team wager (best ball).
                      const winnerKey = isTeamWager ? "team" : "overall";
                      const winnerId = winners[winnerKey];
                      let value = "";
                      if (winnerId) {
                        if (isTeamWager) {
                          const members = (g.players ?? []).filter((p: any) => (p.teamId || "A") === winnerId);
                          value = `Team ${winnerId}${members.length > 0 ? ` (${members.map((m: any) => m.displayName).join(" + ")})` : ""}`;
                        } else {
                          value = playerName(winnerId) || "";
                        }
                      }
                      const cellLabel = isTeamWager ? "Winning Team" : "Winner";
                      return (
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          <ScorecardCell
                            label={cellLabel}
                            value={value}
                            placeholder={isTeamWager ? "— declare team" : "— declare"}
                            onClick={(e) => { e.stopPropagation(); setWinnerPicker({ gameId: g.id, key: winnerKey, label: cellLabel }); }}
                          />
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Settle Up — net balance per player across all wagered games on
            the trip (CTP, Longest Drive, Best Ball). Winners appear first
            in green / gold; players who owe money appear at the bottom in
            red. Players at exactly $0 are hidden. Section is suppressed
            entirely when no one is up or down. */}
        {winningsByPlayer.length > 0 && (() => {
          const totalPot = winningsByPlayer.reduce((s, r) => s + (r.amount > 0 ? r.amount : 0), 0);
          // Index of the first row whose amount is negative — used to
          // drop a subtle divider between winners and losers.
          const firstNegativeIdx = winningsByPlayer.findIndex(r => r.amount < 0);
          return (
            <div style={{ padding: "20px 20px 0" }}>
              <div className="section-label" style={{ marginBottom: 10 }}>
                Settle Up
                <span className="count">${totalPot}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {winningsByPlayer.map((row, i) => {
                  const isPositive = row.amount > 0;
                  const isTopWinner = isPositive && i === 0;
                  const showDivider = firstNegativeIdx > 0 && i === firstNegativeIdx;
                  return (
                    <div key={row.userId} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {showDivider && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 0" }}>
                          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)" }}>Owes</div>
                          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          background: isTopWinner ? "rgba(212,160,23,0.08)" : isPositive ? "rgba(255,255,255,0.03)" : "rgba(220,80,80,0.06)",
                          border: isTopWinner ? "1px solid rgba(212,160,23,0.30)" : isPositive ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(220,80,80,0.22)",
                          borderRadius: 12,
                          padding: "10px 14px",
                        }}
                      >
                        <div style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", background: isPositive ? "rgba(77,168,98,0.18)" : "rgba(220,80,80,0.15)", flexShrink: 0 }}>
                          {row.avatarUrl
                            ? <img src={cdnImage(row.avatarUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" style={{ margin: 8 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          }
                        </div>
                        <div style={{ flex: 1, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.name}
                        </div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 800, color: isTopWinner ? "#d4a017" : isPositive ? "#4da862" : "#e57b7b", letterSpacing: "0.01em" }}>
                          {isPositive ? `+$${row.amount}` : `−$${Math.abs(row.amount)}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Clips section — label flips with page flavor so a game page
            says "Game Clips", a round page says "Round Clips", a trip
            page says "Trip Clips". Matches the framing decision in the
            page header. */}
        <div style={{ padding: "24px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>{flavorUpper} Clips{clips.length > 0 && <span className="count">{clips.length}</span>}</div>
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

        {/* Trip Notes — collaborative knowledge layer. Renders only
            on real Trips, not single-day Rounds (notes don't add
            value for a one-day session). The component handles its
            own fetch + add UI; canEdit is true if the viewer is a
            trip member (creator counts as a member). */}
        {!isRound && trip && (
          <TripNotes
            tripId={trip.id}
            currentUserId={user?.id ?? null}
            canEdit={!!user && (isOwner || members.some((m) => m.userId === user.id))}
          />
        )}

        {/* Make-public CTA — visible only to creators of trips that
            have actually ended and aren't yet public. Mirrors the
            day-after notification's deep-link so creators can also
            initiate publication from inside the trip. */}
        {!isRound && trip && isOwner && !trip.isPublic && trip.endDate && trip.endDate < new Date().toISOString().slice(0, 10) && (
          <div style={{ marginTop: 22, padding: 16, background: "linear-gradient(135deg, rgba(45,122,66,0.18) 0%, rgba(77,168,98,0.08) 100%)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 14 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(77,168,98,0.8)", marginBottom: 4 }}>Now that the trip's done</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 4 }}>Want other golfers to find this?</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.5, marginBottom: 12 }}>
              We&apos;ll create a public itinerary from the broad shape of this trip — courses, airport, lodging — so future golfers can plan around it. Dates, members, and chat stay private.
            </div>
            <button
              onClick={() => setPublicizeOpen(true)}
              style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #2d7a42 0%, #4da862 100%)", color: "#fff", border: "1px solid rgba(77,168,98,0.6)", borderRadius: 12, fontFamily: "'Outfit', sans-serif", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(45,122,66,0.3)" }}
            >
              Publish this trip
            </button>
          </div>
        )}

        {/* "Now public" indicator if it's already been published. */}
        {!isRound && trip?.isPublic && (
          <div style={{ marginTop: 22, padding: 14, background: "rgba(77,168,98,0.06)", border: "1px dashed rgba(77,168,98,0.3)", borderRadius: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>
              This trip is public — other golfers can find it in /search.
            </div>
          </div>
        )}
      </main>

      {/* Post-creation welcome sheet — fires when ?welcome=1 was on
          the URL (set by ActionZone's Start Planning flow on a trip
          idea). Quick "tell us about your trip" prompt: dates +
          invites. Skipping is fine — they can edit later. */}
      {showWelcome && trip && (
        <>
          <div onClick={() => setShowWelcome(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 300 }} />
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 301, background: "#0d2318", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "20px 22px calc(28px + env(safe-area-inset-bottom))", borderTop: "1px solid rgba(77,168,98,0.3)", boxShadow: "0 -8px 32px rgba(0,0,0,0.4)", maxHeight: "85svh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 99, margin: "0 auto 18px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 6, lineHeight: 1.15 }}>
              Your trip is live
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, marginBottom: 20 }}>
              Recommended courses are already attached. A couple quick things to finish setting it up — you can skip and edit later.
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 8 }}>
                When are you going?
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="date"
                  value={welcomeStart}
                  onChange={e => {
                    const v = e.target.value;
                    setWelcomeStart(v);
                    if (v && welcomeEnd && welcomeEnd < v) setWelcomeEnd("");
                  }}
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 12px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "'Outfit', sans-serif", colorScheme: "dark" as never }}
                />
                <input
                  type="date"
                  value={welcomeEnd}
                  min={welcomeStart || undefined}
                  onChange={e => setWelcomeEnd(e.target.value)}
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 12px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "'Outfit', sans-serif", colorScheme: "dark" as never }}
                />
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>Start and end dates. Approximate is fine.</div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 8 }}>
                Who&apos;s coming?
              </label>
              <button
                onClick={() => { setShowWelcome(false); setInviteOpen(true); }}
                style={{ width: "100%", padding: "12px", background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 10, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#4da862", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="4" r="1.6"/><path d="M11 6 L11 13"/><path d="M11 13 L8 19"/><path d="M11 13 L14 17"/><path d="M11 8 L4 5"/><path d="M14 17 L18 21"/></svg>
                Invite your crew
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={async () => {
                  if (!trip) return;
                  setWelcomeSaving(true);
                  const supabase = createClient();
                  const updates: { startDate?: string; endDate?: string } = {};
                  if (welcomeStart) updates.startDate = welcomeStart;
                  if (welcomeEnd) updates.endDate = welcomeEnd;
                  if (Object.keys(updates).length > 0) {
                    await supabase.from("GolfTrip").update(updates).eq("id", trip.id);
                    setTrip(t => t ? { ...t, ...updates } : t);
                  }
                  setWelcomeSaving(false);
                  setShowWelcome(false);
                }}
                disabled={welcomeSaving}
                style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, #2d7a42 0%, #4da862 100%)", color: "#fff", border: "none", borderRadius: 12, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, cursor: welcomeSaving ? "wait" : "pointer", boxShadow: "0 4px 16px rgba(45,122,66,0.35)" }}
              >
                {welcomeSaving ? "Saving…" : "Save & continue"}
              </button>
              <button
                onClick={() => setShowWelcome(false)}
                style={{ width: "100%", padding: "11px", background: "transparent", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
              >
                Skip for now
              </button>
            </div>
          </div>
        </>
      )}

      {/* Publicize confirmation sheet — opens when the user taps the
          "Publish this trip" CTA OR lands from ?publicize=1 (the
          day-after notification deep-link). Lets them tweak the
          tagline before we mint the TripItinerary. */}
      {publicizeOpen && trip && isOwner && !trip.isPublic && (
        <>
          <div onClick={() => !publicizing && setPublicizeOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 200 }} />
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 201, background: "#0d2318", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "16px 22px calc(28px + env(safe-area-inset-bottom))", borderTop: "1px solid rgba(77,168,98,0.3)" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 99, margin: "0 auto 16px" }} />
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)", marginBottom: 3 }}>Publish trip</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>Share {trip.name}?</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, marginTop: 6 }}>
                Other golfers will find this in the Trips search with you credited as the author. Specific dates, members, and chat stay private.
              </div>
            </div>

            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
              Tagline <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional — describe the trip in one line)</span>
            </div>
            <input
              value={publicizeTagline}
              onChange={(e) => setPublicizeTagline(e.target.value)}
              placeholder={trip.description || "e.g. Four buddies, four rounds, lobster rolls between"}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }}
            />

            {publicizeError && (
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "#ff7575", marginTop: 12, padding: "8px 12px", background: "rgba(255,90,90,0.06)", border: "1px solid rgba(255,90,90,0.22)", borderRadius: 8 }}>{publicizeError}</div>
            )}

            <button
              onClick={async () => {
                setPublicizing(true);
                setPublicizeError(null);
                try {
                  const supabase = createClient();
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) throw new Error("Sign in to publish.");
                  const res = await fetch(`/api/trips/${trip.id}/publicize`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ tagline: publicizeTagline.trim() || undefined }),
                  });
                  if (!res.ok) {
                    const j = await res.json().catch(() => ({}));
                    throw new Error(j?.error ?? `Publish failed (${res.status})`);
                  }
                  const { slug } = await res.json();
                  setTrip((t) => (t ? { ...t, isPublic: true } : t));
                  setPublicizeOpen(false);
                  router.push(`/trip-ideas/${slug}`);
                } catch (e: any) {
                  setPublicizeError(e?.message ?? "Couldn't publish the trip.");
                } finally {
                  setPublicizing(false);
                }
              }}
              disabled={publicizing}
              style={{ width: "100%", padding: "13px", marginTop: 16, background: "linear-gradient(135deg, #2d7a42 0%, #4da862 100%)", color: "#fff", border: "none", borderRadius: 12, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, cursor: publicizing ? "wait" : "pointer", boxShadow: "0 4px 16px rgba(45,122,66,0.35)", opacity: publicizing ? 0.7 : 1 }}
            >
              {publicizing ? "Publishing…" : "Publish trip"}
            </button>
            <button
              onClick={() => setPublicizeOpen(false)}
              disabled={publicizing}
              style={{ width: "100%", padding: "11px", marginTop: 8, background: "transparent", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
            >
              Not yet
            </button>
          </div>
        </>
      )}

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
                            ? <img src={cdnImage(m.user.avatarUrl)} alt={m.user.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                                ? <img src={cdnImage(m.user.avatarUrl)} alt={m.user.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                        ? <img src={cdnImage(m.user.avatarUrl)} alt={m.user.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
          <img src={cdnImage(trip.imageUrl)} alt={trip.name} style={{ maxWidth: "92vw", maxHeight: "80vh", borderRadius: 16, objectFit: "contain" }} onClick={e => e.stopPropagation()} />
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
                    {u.avatarUrl ? <img src={cdnImage(u.avatarUrl)} alt={u.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
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
                Invite Golfers to This {flavorUpper}
              </button>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff" }}>Edit {flavorUpper}</div>
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
              {/* Trip / Round / Game photo */}
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>{flavorUpper} Photo <span style={{ fontWeight: 400 }}>(optional)</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, overflow: "hidden", background: "linear-gradient(135deg, rgba(77,168,98,0.3), rgba(45,122,66,0.2))", border: "1.5px solid rgba(77,168,98,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {trip.imageUrl
                      ? <img src={cdnImage(trip.imageUrl)} alt={trip.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>{flavorUpper} Name</div>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder={`${flavorUpper} name`} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }} />
              </div>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>Description <span style={{ fontWeight: 400 }}>(optional)</span></div>
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder={`What's this ${flavor} about?`} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }} />
              </div>
              {flavor === "trip" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>Flying into</div>
                    <AirportField value={editAirport} onChange={setEditAirport} />
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>Lodging</div>
                    <LodgingField
                      value={editLodging}
                      onChange={(choice) => {
                        setEditLodging(choice.display);
                        setEditLodgingCity(choice.city);
                        setEditLodgingState(choice.state);
                      }}
                      stateHint={tripCourses[0]?.course?.state ?? undefined}
                    />
                  </div>
                </div>
              )}
              <div>
                {/* Games and Rounds are single-day by definition (1 course-
                    stop, 1 date). Only Trips need a real start/end range —
                    everywhere else we collapse to a single DateField and
                    auto-mirror the value into editEnd so the schema stays
                    consistent without confusing users with two pickers. */}
                {flavor === "trip" ? (
                  <>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>Trip Dates</div>
                    <DateRangePicker startDate={editStart} endDate={editEnd} onChange={(s, e) => { setEditStart(s); setEditEnd(e); }} />
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>{flavorUpper} Date</div>
                    <input
                      type="date"
                      value={editStart}
                      onChange={e => { setEditStart(e.target.value); setEditEnd(e.target.value); }}
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: editStart ? "#fff" : "rgba(255,255,255,0.42)", outline: "none", colorScheme: "dark" }}
                    />
                  </>
                )}
              </div>
              {/* Tee time — round/game flavor only (trips have per-stop
                  times on the courses list, not a single time). Sits
                  right under the date so both pieces of timing live in
                  one sheet — user feedback: "you should have just added
                  a time editor on this sheet". */}
              {flavor !== "trip" && (
                <div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>Tee Time <span style={{ fontWeight: 400 }}>(optional)</span></div>
                  <input
                    type="time"
                    value={editTeeTime}
                    onChange={e => setEditTeeTime(e.target.value)}
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: editTeeTime ? "#fff" : "rgba(255,255,255,0.42)", outline: "none", colorScheme: "dark" }}
                  />
                </div>
              )}
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
                  Delete {flavorUpper}
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
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", textAlign: "center" }}>Share the Round</div>
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
                  setToast({ msg: "Couldn't generate the share image. Try again in a moment.", kind: "error" });
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
                    setToast({ msg: "Link copied to clipboard", kind: "success" });
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
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 0 16px", gap: 12 }}>
                      <div style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'Outfit', sans-serif", fontSize: 13, textAlign: "center" }}>
                        Couldn&apos;t find &quot;{courseSearch}&quot;
                      </div>
                      <SuggestCourseButton search={courseSearch} />
                    </div>
                  )}
                  {courseResults.map(c => (
                    <div key={c.id} className="course-result-row" onClick={() => { setSelectedAddCourse(c); setAddCourseStep("details"); if (!addPlayDate && trip?.startDate) setAddPlayDate(trip.startDate); }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        {c.logoUrl
                          ? <img src={cdnImage(c.logoUrl)} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
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
                  {!courseSearchLoading && courseSearch.length >= 2 && courseResults.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 4px" }}>
                      <SuggestCourseButton search={courseSearch} variant="subtle" />
                    </div>
                  )}
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
                            ? <img src={cdnImage(pairCourse.logoUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                          ? <img src={cdnImage(c.logoUrl)} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
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

      {/* Winner picker sheet — opened from the per-hole "Declare" pills
          (CTP/LD) or the single "Declare winner" pill (other formats).
          Any trip member can pick or change the winner. Picking the
          already-declared name clears it. */}
      {winnerPicker && (() => {
        const game = games.find(g => g.id === winnerPicker.gameId);
        if (!game) return null;
        const currentWinnerId = ((game.formatConfig as any)?.winners ?? {})[winnerPicker.key] as string | undefined;
        const players: any[] = Array.isArray(game.players) ? game.players : [];
        // For team-wager formats (Best Ball), group players by teamId
        // and render TEAM rows instead of individual players. The "id"
        // we save is the teamId ("A", "B" …) not a userId.
        const isTeamWager = TEAM_WAGER_FORMATS.has(game.format) && winnerPicker.key === "team";
        const teams: Array<{ id: string; members: any[] }> = isTeamWager
          ? (() => {
              const m = new Map<string, any[]>();
              for (const p of players) {
                const tid = p.teamId || "A";
                if (!m.has(tid)) m.set(tid, []);
                m.get(tid)!.push(p);
              }
              return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([id, members]) => ({ id, members }));
            })()
          : [];
        return (
          <div
            onClick={() => setWinnerPicker(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 210,
              background: "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingTop: "calc(env(safe-area-inset-top) + 24px)",
              paddingBottom: "calc(70px + env(safe-area-inset-bottom))",
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 480,
                background: "#0d1f14",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "12px 18px 22px",
                maxHeight: "100%",
                minHeight: 0,
                overflowY: "auto",
              }}
            >
              <div aria-hidden style={{ width: 36, height: 4, background: "rgba(255,255,255,0.14)", borderRadius: 99, margin: "0 auto 14px" }} />
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4da862", marginBottom: 2 }}>{winnerPicker.label}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "#fff", marginBottom: 14 }}>{isTeamWager ? "Which team won?" : "Who won?"}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {isTeamWager ? teams.map((t) => {
                  const isCurrent = t.id === currentWinnerId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => declareWinner(winnerPicker.gameId, winnerPicker.key, isCurrent ? null : t.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: `1px solid ${isCurrent ? "rgba(212,160,23,0.55)" : "rgba(255,255,255,0.08)"}`,
                        background: isCurrent ? "rgba(212,160,23,0.10)" : "rgba(255,255,255,0.03)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(77,168,98,0.2)", border: "1px solid rgba(77,168,98,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 900, color: "#4da862" }}>
                        {t.id}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>Team {t.id}</div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.members.map((m: any) => m.displayName).join(" + ") || "—"}
                        </div>
                      </div>
                      {isCurrent && (
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#d4a017", letterSpacing: "0.06em" }}>🏆 WINNER · TAP TO CLEAR</div>
                      )}
                    </button>
                  );
                }) : players.map((p) => {
                  const isCurrent = p.userId === currentWinnerId;
                  return (
                    <button
                      key={p.userId}
                      onClick={() => declareWinner(winnerPicker.gameId, winnerPicker.key, isCurrent ? null : p.userId)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: `1px solid ${isCurrent ? "rgba(212,160,23,0.55)" : "rgba(255,255,255,0.08)"}`,
                        background: isCurrent ? "rgba(212,160,23,0.10)" : "rgba(255,255,255,0.03)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", background: "rgba(77,168,98,0.2)", flexShrink: 0 }}>
                        {p.avatarUrl
                          ? <img src={cdnImage(p.avatarUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" style={{ margin: 8 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        }
                      </div>
                      <div style={{ flex: 1, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{p.displayName}</div>
                      {isCurrent && (
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#d4a017", letterSpacing: "0.06em" }}>🏆 WINNER · TAP TO CLEAR</div>
                      )}
                    </button>
                  );
                })}
              </div>
              {currentWinnerId && (
                <button
                  onClick={() => declareWinner(winnerPicker.gameId, winnerPicker.key, null)}
                  style={{ width: "100%", marginTop: 14, padding: "10px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.55)", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Clear this winner
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Game creator — unified bottom sheet (2026-05-24 refactor).
          Replaced the legacy 5-step wizard with the shared
          <CreateGameSheet> component so Tee Up and trip-page entries
          run the same flow. presetTrip skips the course/date sections
          and seeds players from this trip's members + handicaps. */}
      {gameOpen && trip && user?.id && (() => {
        const host = members.find(m => m.userId === user.id);
        return (
          <CreateGameSheet
            open={gameOpen}
            onClose={() => setGameOpen(false)}
            presetTrip={{
              id: trip.id,
              date: tripCourses[0]?.playDate ?? trip.startDate ?? null,
              courses: tripCourses.map(tc => ({
                courseId: tc.courseId,
                courseName: tc.course.name,
                courseLogoUrl: tc.course.logoUrl ?? null,
              })),
              members: members.map(m => ({
                userId: m.userId,
                displayName: m.user.displayName,
                avatarUrl: m.user.avatarUrl,
                handicapIndex: m.user.handicapIndex ?? null,
              })),
            }}
            currentUserId={user.id}
            currentUserDisplayName={host?.user.displayName || "You"}
            currentUserAvatarUrl={host?.user.avatarUrl ?? null}
            currentUserHandicapIndex={host?.user.handicapIndex ?? null}
            onCreated={(gameId) => router.push(`/games/${gameId}`)}
          />
        );
      })()}


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
                      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,170,0,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, flex: 1, minWidth: 0 }}>Verify <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{viewGame.courseName}</span>&apos;s scorecard for correct stroke allocation.</span>
                        <button
                          onClick={() => openScorecardSheet(viewGame.courseId)}
                          style={{
                            flexShrink: 0,
                            background: "rgba(77,168,98,0.12)",
                            border: "1px solid rgba(77,168,98,0.4)",
                            borderRadius: 8,
                            padding: "7px 12px",
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: 13,
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
                        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "14px 16px" }}>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Teams</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {teamGroups.map(({ team, members }) => (
                              <div key={team} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#2d7a42", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{team}</div>
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "rgba(255,255,255,0.85)" }}>{members.join(" & ")}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Players */}
                      {viewGame.players?.map((p: any, i: number) => (
                        <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff", flex: 1 }}>{p.displayName}</div>
                            {p.teamId && p.teamId !== "Solo" && (
                              <div style={{ padding: "3px 10px", borderRadius: 7, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.25)", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#4da862" }}>Team {p.teamId}</div>
                            )}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                            {[
                              { label: "HI", value: p.handicapIndex },
                              { label: "Course HCP", value: p.courseHandicap },
                              { label: "Net Shots", value: p.netStrokes > 0 ? `+${p.netStrokes}` : "No Strokes" },
                            ].map(({ label, value }) => {
                              const isNoStrokes = label === "Net Shots" && value === "No Strokes";
                              return (
                                <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "9px 8px", textAlign: "center" }}>
                                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: isNoStrokes ? 13 : 18, fontWeight: 700, color: label === "Net Shots" ? "#4da862" : "#fff", whiteSpace: "nowrap" }}>{value}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {/* Pops-per-hole scorecard — green dot on every hole each
                          player strokes, just like a paper card. */}
                      <GamePopsScorecard players={viewGame.players ?? []} holeHandicaps={viewGame.holeHandicaps} />

                      {/* Rules */}
                      {sheetData.rules && (
                        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "14px 16px" }}>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Format Rules</div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "rgba(255,255,255,0.85)", lineHeight: 1.65 }}>{sheetData.rules}</div>
                        </div>
                      )}

                      {/* Tip */}
                      {sheetData.tip && (
                        <div style={{ background: "rgba(77,168,98,0.06)", border: "1px solid rgba(77,168,98,0.18)", borderRadius: 12, padding: "12px 16px", marginBottom: 4 }}>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#4da862", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Pro Tip</div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "rgba(255,255,255,0.78)", lineHeight: 1.55 }}>{sheetData.tip}</div>
                        </div>
                      )}
                    </div>
                  );
                }

                return <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "rgba(255,255,255,0.85)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{viewGame.gameSheet}</div>;
              })()}
            </div>
            <div style={{ padding: "12px 20px 28px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10, flexShrink: 0 }}>
              <button
                disabled={sendingGameImage}
                onClick={async () => {
                  const title = `${viewGame.courseName} — ${GAME_FORMATS.find(f => f.id === viewGame.format)?.name || viewGame.format}`;
                  setSendingGameImage(true);
                  try {
                    const url = `/api/trips/${id}/game/${viewGame.id}/scorecard-image?ts=${Date.now()}`;
                    const res = await fetch(url, { redirect: "follow" });
                    if (!res.ok) throw new Error(`status ${res.status}`);
                    const blob = await res.blob();
                    if (blob.size < 1000) throw new Error("image came back empty");
                    const file = new File([blob], `tour-it-game-${viewGame.id}.png`, { type: "image/png" });
                    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
                    if (nav.canShare?.({ files: [file] })) {
                      await navigator.share({ files: [file], title, text: viewGame.shareText });
                    } else if (navigator.share) {
                      await navigator.share({ title, text: viewGame.shareText });
                    } else {
                      window.open(url, "_blank");
                    }
                  } catch (e) {
                    console.error("Scorecard image share failed", e);
                    // fall back to text-only share so the group still gets the game
                    if (navigator.share) {
                      try { await navigator.share({ title, text: viewGame.shareText }); } catch {}
                    } else {
                      navigator.clipboard.writeText(viewGame.shareText);
                    }
                  } finally {
                    setSendingGameImage(false);
                  }
                }}
                style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: "#2d7a42", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", cursor: sendingGameImage ? "default" : "pointer", opacity: sendingGameImage ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                {sendingGameImage ? "Preparing…" : "Send to Group"}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(viewGame.shareText); }}
                style={{ padding: "14px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)", cursor: "pointer" }}
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
                        ? <img src={cdnImage(m.user.avatarUrl)} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
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

// SuggestCourseButton — shown inside the add-course sheet when the
// user's search returns no results (or after a result list, in a
// subtler variant). Opens a pre-filled email to the Tour It inbox
// so we can add the missing course manually + reach back out.
function SuggestCourseButton({ search, variant }: { search: string; variant?: "subtle" }) {
  const onClick = () => {
    const subject = encodeURIComponent(`Add a course: ${search}`);
    const body = encodeURIComponent(
      `Hi Tour It —\n\nI couldn't find this course on the app. Can you add it?\n\nCourse name: ${search}\nCity / state: \nWebsite (if known): \n\nThanks.`
    );
    window.location.href = `mailto:corey@touritgolf.com?subject=${subject}&body=${body}`;
  };
  if (variant === "subtle") {
    return (
      <button
        onClick={onClick}
        style={{
          background: "none",
          border: "none",
          fontFamily: "'Outfit', sans-serif",
          fontSize: 12,
          color: "rgba(126,200,140,0.85)",
          textDecoration: "underline",
          textDecorationStyle: "dotted",
          textUnderlineOffset: 3,
          cursor: "pointer",
          padding: "4px 8px",
          letterSpacing: "0.01em",
        }}
      >
        Don&apos;t see it? Request to add a course
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(77,168,98,0.14)",
        border: "1px solid rgba(77,168,98,0.5)",
        borderRadius: 10,
        padding: "10px 16px",
        fontFamily: "'Outfit', sans-serif",
        fontSize: 13,
        fontWeight: 700,
        color: "#4da862",
        cursor: "pointer",
        letterSpacing: "0.01em",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Request to add this course
    </button>
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
                ? <img src={cdnImage(m.user.avatarUrl)} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
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
