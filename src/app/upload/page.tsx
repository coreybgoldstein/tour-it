"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
  holeCount: number;
};

type SeriesShot = {
  id: string; // local only
  file: File | null;
  preview: string | null;
  mediaType: "VIDEO" | "PHOTO" | null;
  shotType: string;
  yardage: string;
  club: string;
  strategy: string;
  uploading: boolean;
  uploaded: boolean;
  error: string;
};

const TEE_COLORS = ["Black", "Blue", "White", "Red", "Gold", "Green"];
const WIND_OPTIONS = [
  { label: "Calm", value: "CALM" },
  { label: "Into", value: "INTO" },
  { label: "Downwind", value: "DOWNWIND" },
  { label: "Left to Right", value: "LEFT_TO_RIGHT" },
  { label: "Right to Left", value: "RIGHT_TO_LEFT" },
  { label: "Moderate", value: "MODERATE" },
  { label: "Strong", value: "STRONG" },
];
// Content formats — determines hole picker + what shot type means
const CONTENT_FORMATS = [
  { label: "Single Shot", value: "SHOT", desc: "One specific shot on a hole", needsHole: true, needsShotType: true },
  { label: "Full Hole", value: "FULL_HOLE", desc: "Start-to-finish on one hole", needsHole: true, needsShotType: false },
  { label: "3 Holes", value: "THREE_HOLE", desc: "Three consecutive holes", needsHole: false, needsShotType: false },
  { label: "Front 9", value: "FRONT_NINE", desc: "Holes 1–9", needsHole: false, needsShotType: false },
  { label: "Back 9", value: "BACK_NINE", desc: "Holes 10–18", needsHole: false, needsShotType: false },
  { label: "Full 18", value: "FULL_ROUND", desc: "The entire round", needsHole: false, needsShotType: false },
];

const THREE_HOLE_GROUPS = ["1–3", "4–6", "7–9", "10–12", "13–15", "16–18"];

const SHOT_TYPES = [
  { label: "Tee Shot", value: "TEE_SHOT" },
  { label: "Approach", value: "APPROACH" },
  { label: "Layup", value: "LAY_UP" },
  { label: "Chip", value: "CHIP" },
  { label: "Pitch", value: "PITCH" },
  { label: "Putt", value: "PUTT" },
  { label: "Bunker", value: "BUNKER" },
];
const HANDICAP_RANGES = [
  { label: "Scratch", value: "SCRATCH" },
  { label: "Low (1-9)", value: "LOW" },
  { label: "Mid (10-18)", value: "MID" },
  { label: "High (19+)", value: "HIGH" },
];
const CLUBS = [
  { group: "Woods", options: ["Driver", "3-wood", "5-wood", "7-wood"] },
  { group: "Hybrids", options: ["2-hybrid", "3-hybrid", "4-hybrid", "5-hybrid"] },
  { group: "Irons", options: ["2-iron", "3-iron", "4-iron", "5-iron", "6-iron", "7-iron", "8-iron", "9-iron"] },
  { group: "Wedges", options: ["Pitching Wedge", "Gap Wedge", "Sand Wedge", "Lob Wedge"] },
  { group: "Other", options: ["Putter", "Chipper"] },
];

const SERIES_SHOT_TYPES = [
  { label: "Tee Shot", value: "TEE_SHOT" },
  { label: "Approach", value: "APPROACH" },
  { label: "Layup", value: "LAY_UP" },
  { label: "Chip", value: "CHIP" },
  { label: "Pitch", value: "PITCH" },
  { label: "Putt", value: "PUTT" },
  { label: "Bunker", value: "BUNKER" },
  { label: "Recovery", value: "RECOVERY" },
];

const INTEL_FIELDS = ["tee", "datePlayed", "club", "wind", "strategy", "landingZone", "hidden", "handicap"];

function newShot(order: number): SeriesShot {
  return {
    id: `shot-${order}-${Date.now()}`,
    file: null,
    preview: null,
    mediaType: null,
    shotType: order === 1 ? "TEE_SHOT" : "",
    yardage: "",
    club: "",
    strategy: "",
    uploading: false,
    uploaded: false,
    error: "",
  };
}

function UploadPageInner() {
  const searchParams = useSearchParams();
  const preselectedCourseId = searchParams.get("courseId");
  const preselectedTripId = searchParams.get("tripId");
  const [tripName, setTripName] = useState<string | null>(null);
  const [tripPublic, setTripPublic] = useState(true);

  const [step, setStep] = useState(1);
  const [authChecked, setAuthChecked] = useState(false);
  const [courseResults, setCourseResults] = useState<Course[]>([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const courseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gpsSuggestions, setGpsSuggestions] = useState<Course[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedHole, setSelectedHole] = useState<number | null>(null);
  const [contentFormat, setContentFormat] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"VIDEO" | "PHOTO" | null>(null);
  const [courseSearch, setCourseSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isSeriesMode, setIsSeriesMode] = useState(false);
  const [seriesShots, setSeriesShots] = useState<SeriesShot[]>([newShot(1)]);
  const [activeShot, setActiveShot] = useState(0);
  const seriesFileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [intel, setIntel] = useState({
    tee: "",
    datePlayed: "",
    shotType: "",
    club: "",
    wind: "",
    strategy: "",
    landingZone: "",
    hidden: "",
    handicap: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.href = "/login?redirect=/upload";
      } else {
        setAuthChecked(true);
        // If coming from a course page, fetch just that one course
        if (preselectedCourseId) {
          const { data: course } = await supabase
            .from("Course")
            .select("id, name, city, state, holeCount")
            .eq("id", preselectedCourseId)
            .single();
          if (course) setSelectedCourse(course);
        }
        if (preselectedTripId) {
          const { data: trip } = await supabase.from("GolfTrip").select("name").eq("id", preselectedTripId).single();
          if (trip) setTripName(trip.name);
        }
      }
    });
  }, []);

  const searchCourses = useCallback((q: string) => {
    if (courseDebounceRef.current) clearTimeout(courseDebounceRef.current);
    if (!q.trim() || q.trim().length < 2) {
      setCourseResults([]);
      setCourseLoading(false);
      return;
    }
    setCourseLoading(true);
    courseDebounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("Course")
        .select("id, name, city, state, holeCount")
        .or(`name.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%`)
        .order("uploadCount", { ascending: false })
        .limit(20);
      setCourseResults(data || []);
      setCourseLoading(false);
    }, 280);
  }, []);

  useEffect(() => {
    searchCourses(courseSearch);
  }, [courseSearch, searchCourses]);

  const intelScore = INTEL_FIELDS.filter(f => intel[f as keyof typeof intel]?.trim()).length;
  const intelPct = Math.round((intelScore / INTEL_FIELDS.length) * 100);
  const intelLabel = intelPct >= 80 ? "Elite Intel" : intelPct >= 50 ? "Good Intel" : intelPct >= 25 ? "Basic Intel" : "Minimal Intel";
  const intelColor = intelPct >= 80 ? "#4da862" : intelPct >= 50 ? "#c8a96e" : intelPct >= 25 ? "#6a9fd4" : "rgba(255,255,255,0.25)";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isPhoto = file.type.startsWith("image/");
    if (!isVideo && !isPhoto) { setError("Please upload a video or photo file."); return; }
    setMediaFile(file);
    setMediaType(isVideo ? "VIDEO" : "PHOTO");
    setMediaPreview(URL.createObjectURL(file));
    setError("");

    // Auto-fill date from file metadata (works for phone videos/photos)
    const dateFromFile = new Date(file.lastModified).toISOString().split("T")[0];
    setIntel(prev => ({ ...prev, datePlayed: prev.datePlayed || dateFromFile }));

    // Try GPS extraction for video files (iPhone MP4/MOV stores ©xyz atom)
    if (isVideo) {
      setGpsLoading(true);
      extractGPSFromVideo(file).then(async coords => {
        if (!coords) { setGpsLoading(false); return; }
        const supabase = createClient();
        const { data } = await supabase
          .from("Course")
          .select("id, name, city, state, holeCount")
          .gte("latitude", coords.lat - 0.05)
          .lte("latitude", coords.lat + 0.05)
          .gte("longitude", coords.lng - 0.05)
          .lte("longitude", coords.lng + 0.05)
          .order("uploadCount", { ascending: false })
          .limit(5);
        setGpsSuggestions(data || []);
        setGpsLoading(false);
      });
    }
  };

  // Scan video binary for iPhone ©xyz GPS atom (no library needed)
  async function extractGPSFromVideo(file: File): Promise<{ lat: number; lng: number } | null> {
    try {
      const buffer = await file.slice(0, 524288).arrayBuffer(); // first 512KB
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length - 20; i++) {
        // Look for ©xyz (0xA9 0x78 0x79 0x7A)
        if (bytes[i] === 0xA9 && bytes[i+1] === 0x78 && bytes[i+2] === 0x79 && bytes[i+3] === 0x7A) {
          const strLen = (bytes[i + 4] << 8) | bytes[i + 5];
          if (strLen > 0 && strLen < 60) {
            const gpsStr = new TextDecoder().decode(bytes.slice(i + 8, i + 8 + strLen));
            const match = gpsStr.match(/([+-]\d+\.\d+)([+-]\d+\.\d+)/);
            if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
          }
        }
      }
    } catch {}
    return null;
  }

  const handleSeriesFileSelect = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isPhoto = file.type.startsWith("image/");
    if (!isVideo && !isPhoto) return;
    const updated = [...seriesShots];
    updated[index] = {
      ...updated[index],
      file,
      mediaType: isVideo ? "VIDEO" : "PHOTO",
      preview: URL.createObjectURL(file),
      error: "",
    };
    setSeriesShots(updated);
  };

  const updateShot = (index: number, field: keyof SeriesShot, value: string) => {
    const updated = [...seriesShots];
    updated[index] = { ...updated[index], [field]: value };
    setSeriesShots(updated);
  };

  const addShot = () => {
    setSeriesShots(prev => [...prev, newShot(prev.length + 1)]);
    setActiveShot(seriesShots.length);
  };

  const removeShot = (index: number) => {
    if (seriesShots.length <= 1) return;
    const updated = seriesShots.filter((_, i) => i !== index);
    setSeriesShots(updated);
    setActiveShot(Math.min(activeShot, updated.length - 1));
  };

  const handleSeriesSubmit = async () => {
    const hasFiles = seriesShots.every(s => s.file !== null);
    if (!hasFiles) { setError("Please add a video or photo for every shot."); return; }
    if (!selectedCourse || !selectedHole) return;

    setUploading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("You must be logged in."); setUploading(false); return; }

      const { data: holeData } = await supabase.from("Hole").select("id").eq("courseId", selectedCourse.id).eq("holeNumber", selectedHole).single();
      if (!holeData?.id) { setError("Hole not found."); setUploading(false); return; }

      const seriesId = crypto.randomUUID();

      // Mark all as uploading
      setSeriesShots(prev => prev.map(s => ({ ...s, uploading: !!s.file })));

      // Upload all files in parallel
      const uploadResults = await Promise.all(
        seriesShots.map(async (shot, i) => {
          if (!shot.file) return null;
          const ext = shot.file.name.split(".").pop();
          const bucket = shot.mediaType === "VIDEO" ? "tour-it-videos" : "tour-it-photos";
          const filePath = `${user.id}/${selectedCourse.id}/${selectedHole}/series-${seriesId}-${i}.${ext}`;
          const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, shot.file, { cacheControl: "3600", upsert: false });
          if (uploadError) throw new Error(`Shot ${i + 1} failed to upload.`);
          const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
          return { i, shot, publicUrl };
        })
      );

      // Insert DB records in parallel
      await Promise.all(
        uploadResults.map(async result => {
          if (!result) return;
          const { i, shot, publicUrl } = result;
          const { error: dbError } = await supabase.from("Upload").insert({
            id: crypto.randomUUID(),
            userId: user.id,
            courseId: selectedCourse.id,
            holeId: holeData.id,
            mediaType: shot.mediaType,
            mediaUrl: publicUrl,
            teeBoxId: null,
            shotType: shot.shotType || null,
            clubUsed: shot.club || null,
            strategyNote: shot.strategy || null,
            yardageOverlay: shot.yardage || null,
            seriesId,
            seriesOrder: i + 1,
            tripId: preselectedTripId || null,
            tripPublic: preselectedTripId ? tripPublic : true,
            rankScore: 50,
            moderationStatus: "PENDING",
            likeCount: 0,
            commentCount: 0,
            viewCount: 0,
            saveCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          if (dbError) throw new Error(`Shot ${i + 1} failed to save: ${dbError.message}`);
        })
      );

      setSeriesShots(prev => prev.map(s => ({ ...s, uploading: false, uploaded: true })));

      // Increment upload counters (by number of shots uploaded)
      const shotCount = seriesShots.length;
      const { data: cRow } = await supabase.from("Course").select("uploadCount").eq("id", selectedCourse.id).single();
      await supabase.from("Course").update({ uploadCount: (cRow?.uploadCount || 0) + shotCount }).eq("id", selectedCourse.id);
      const { data: hRow } = await supabase.from("Hole").select("uploadCount").eq("id", holeData.id).single();
      await supabase.from("Hole").update({ uploadCount: (hRow?.uploadCount || 0) + shotCount }).eq("id", holeData.id);

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    const isMultiHole = contentFormat && contentFormat !== "SHOT" && contentFormat !== "FULL_HOLE";
    if (!selectedCourse || (!selectedHole && !isMultiHole) || !mediaFile) return;
    setUploading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("You must be logged in to upload."); setUploading(false); return; }

      const ext = mediaFile.name.split(".").pop();
      const bucket = mediaType === "VIDEO" ? "tour-it-videos" : "tour-it-photos";
      const folderKey = selectedHole || contentFormat || "misc";
      const filePath = `${user.id}/${selectedCourse.id}/${folderKey}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, mediaFile, { cacheControl: "3600", upsert: false });
      if (uploadError) { setError("Upload failed. Please try again."); setUploading(false); return; }

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);

      // Only look up holeId for single-hole content
      let holeId: string | null = null;
      if (selectedHole) {
        const { data: holeData } = await supabase.from("Hole").select("id").eq("courseId", selectedCourse.id).eq("holeNumber", selectedHole).single();
        holeId = holeData?.id || null;
      }

      // Determine shotType: for single shots use intel.shotType, for formats use the format itself
      const resolvedShotType = contentFormat === "SHOT" ? (intel.shotType || null)
        : contentFormat === "FULL_HOLE" ? "FULL_HOLE"
        : contentFormat || null;

      const { error: dbError } = await supabase.from("Upload").insert({
        id: crypto.randomUUID(),
        userId: user.id,
        courseId: selectedCourse.id,
        holeId,
        mediaType: mediaType,
        mediaUrl: publicUrl,
        teeBoxId: null,
        shotType: resolvedShotType,
        yardageOverlay: contentFormat === "THREE_HOLE" ? selectedGroup : null,
        clubUsed: intel.club || null,
        windCondition: intel.wind || null,
        strategyNote: intel.strategy || null,
        landingZoneNote: intel.landingZone || null,
        whatCameraDoesntShow: intel.hidden || null,
        handicapRange: intel.handicap || null,
        datePlayedAt: intel.datePlayed ? new Date(intel.datePlayed).toISOString() : null,
        rankScore: intelPct,
        tripId: preselectedTripId || null,
        tripPublic: preselectedTripId ? tripPublic : true,
        moderationStatus: "PENDING",
        likeCount: 0,
        commentCount: 0,
        viewCount: 0,
        saveCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (dbError) { setError(`Failed to save: ${dbError.message}`); setUploading(false); return; }

      // Increment upload counters
      const { data: cRow } = await supabase.from("Course").select("uploadCount").eq("id", selectedCourse.id).single();
      await supabase.from("Course").update({ uploadCount: (cRow?.uploadCount || 0) + 1 }).eq("id", selectedCourse.id);
      if (holeId) {
        const { data: hRow } = await supabase.from("Hole").select("uploadCount").eq("id", holeId).single();
        await supabase.from("Hole").update({ uploadCount: (hRow?.uploadCount || 0) + 1 }).eq("id", holeId);
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setUploading(false);
  };

  if (!authChecked) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Loading...</div>
      </main>
    );
  }

  if (submitted) {
    return (
            <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", position: "relative" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900&family=Outfit:wght@300;400;500;600&display=swap'); *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
        <div style={{ textAlign: "center", maxWidth: "360px" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 10 }}>
            {isSeriesMode ? "Series uploaded!" : "Clip uploaded!"}
          </h1>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 300, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 28 }}>
            {isSeriesMode
              ? `Your Play a Hole With Me series for ${selectedCourse?.name} — Hole ${selectedHole} is under review.`
              : `Your intel for ${selectedCourse?.name} — Hole ${selectedHole} is under review and will go live shortly.`
            }
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => {
                setStep(1);
                setSelectedHole(null);
                setMediaFile(null);
                setMediaPreview(null);
                setIntel({ tee: "", datePlayed: "", shotType: "", club: "", wind: "", strategy: "", landingZone: "", hidden: "", handicap: "" });
                setIsSeriesMode(false);
                setSeriesShots([newShot(1)]);
                setSubmitted(false);
              }}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "10px 20px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
              Upload another
            </button>
            <button
              onClick={() => window.location.href = `/courses/${selectedCourse?.id}/holes/${selectedHole}`}
              style={{ background: "#2d7a42", border: "none", borderRadius: 99, padding: "10px 20px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
              View hole
            </button>
          </div>
                </div>
        <BottomNav />
      </main>
    );
  }

  const holeCount = selectedCourse?.holeCount || 18;
  const frontNine = Array.from({ length: Math.min(9, holeCount) }, (_, i) => i + 1);
  const backNine = Array.from({ length: Math.max(0, holeCount - 9) }, (_, i) => i + 10);

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", paddingBottom: 40 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .upload-wrap { max-width: 480px; margin: 0 auto; padding: 0 20px 40px; }
        .upload-header { display: flex; align-items: center; gap: 12px; padding: 52px 20px 12px; position: sticky; top: 0; background: #07100a; z-index: 10; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px; }
        .back-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .progress-bar { height: 2px; background: rgba(255,255,255,0.06); margin: 0 20px 28px; border-radius: 99px; }
        .progress-fill { height: 2px; background: #4da862; border-radius: 99px; transition: width 0.3s ease; }
        .anim { animation: fadeUp 0.25s ease; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .step-label { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.25); letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 8px; }
        .step-title { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 900; color: #fff; line-height: 1.2; margin-bottom: 6px; }
        .step-sub { font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 300; color: rgba(255,255,255,0.35); line-height: 1.5; margin-bottom: 24px; }
        .search-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 16px; font-family: 'Outfit', sans-serif; font-size: 14px; color: #fff; outline: none; margin-bottom: 12px; }
        .search-input::placeholder { color: rgba(255,255,255,0.25); }
        .search-input:focus { border-color: rgba(77,168,98,0.4); }
        .course-list { display: flex; flex-direction: column; gap: 8px; }
        .course-item { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 12px 14px; cursor: pointer; transition: all 0.15s; }
        .course-item:hover { background: rgba(77,168,98,0.08); border-color: rgba(77,168,98,0.2); }
        .course-item.selected { background: rgba(77,168,98,0.12); border-color: rgba(77,168,98,0.4); }
        .course-abbr { width: 40px; height: 40px; border-radius: 10px; background: rgba(77,168,98,0.15); border: 1px solid rgba(77,168,98,0.25); display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; color: #4da862; flex-shrink: 0; }
        .course-name-text { font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.85); }
        .course-location-text { font-family: 'Outfit', sans-serif; font-size: 12px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .holes-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
        .hole-btn { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px 8px; cursor: pointer; transition: all 0.15s; text-align: center; }
        .hole-btn:hover { background: rgba(77,168,98,0.08); border-color: rgba(77,168,98,0.2); }
        .hole-btn.selected { background: rgba(77,168,98,0.15); border-color: rgba(77,168,98,0.5); }
        .hole-btn-num { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 900; color: #fff; line-height: 1; }
        .nine-label { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.25); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px; }
        .upload-zone { border: 1.5px dashed rgba(255,255,255,0.12); border-radius: 16px; padding: 36px 20px; text-align: center; cursor: pointer; transition: all 0.2s; margin-bottom: 16px; }
        .upload-zone:hover { border-color: rgba(77,168,98,0.4); background: rgba(77,168,98,0.04); }
        .upload-zone-title { font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.6); margin-bottom: 6px; }
        .upload-zone-sub { font-family: 'Outfit', sans-serif; font-size: 12px; color: rgba(255,255,255,0.25); }
        .preview-video { width: 100%; border-radius: 12px; max-height: 260px; object-fit: cover; margin-bottom: 12px; }
        .preview-img { width: 100%; border-radius: 12px; max-height: 260px; object-fit: cover; margin-bottom: 12px; }
        .intel-score-bar { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 14px 16px; margin-bottom: 20px; }
        .intel-score-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .intel-score-label { font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600; }
        .intel-score-pct { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 900; }
        .intel-bar-bg { height: 4px; background: rgba(255,255,255,0.06); border-radius: 99px; overflow: hidden; margin-bottom: 6px; }
        .intel-bar-fill { height: 4px; border-radius: 99px; transition: width 0.3s ease, background 0.3s ease; }
        .intel-hint { font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(255,255,255,0.2); }
        .field { margin-bottom: 20px; }
        .field-label { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); letter-spacing: 0.5px; text-transform: uppercase; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .optional-tag { font-size: 9px; font-weight: 500; color: rgba(255,255,255,0.2); letter-spacing: 0.5px; background: rgba(255,255,255,0.05); border-radius: 99px; padding: 2px 7px; }
        .field-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 11px 14px; font-family: 'Outfit', sans-serif; font-size: 14px; color: rgba(255,255,255,0.8); outline: none; }
        .field-input:focus { border-color: rgba(77,168,98,0.4); }
        .field-textarea { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 11px 14px; font-family: 'Outfit', sans-serif; font-size: 14px; color: rgba(255,255,255,0.8); outline: none; resize: none; line-height: 1.5; }
        .field-textarea:focus { border-color: rgba(77,168,98,0.4); }
        .pill-row { display: flex; flex-wrap: wrap; gap: 7px; }
        .pill-option { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 99px; padding: 7px 14px; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
        .pill-option:hover { border-color: rgba(77,168,98,0.3); color: rgba(255,255,255,0.7); }
        .pill-option.selected { background: rgba(77,168,98,0.15); border-color: rgba(77,168,98,0.5); color: #4da862; }
        .pill-option.series-selected { background: rgba(180,145,60,0.15); border-color: rgba(180,145,60,0.5); color: #c8a96e; }
        .tee-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .divider { height: 1px; background: rgba(255,255,255,0.05); margin: 24px 0; }
        .btn-primary { width: 100%; background: #2d7a42; border: none; border-radius: 14px; padding: 15px; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 600; color: #fff; cursor: pointer; margin-bottom: 10px; transition: opacity 0.15s; }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 13px; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.5); cursor: pointer; }
        .error-box { background: rgba(220,60,60,0.1); border: 1px solid rgba(220,60,60,0.2); border-radius: 10px; padding: 12px 14px; font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(220,100,100,0.9); margin-bottom: 16px; }
        .shot-tab { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin-bottom: 20px; padding-bottom: 2px; }
        .shot-tab::-webkit-scrollbar { display: none; }
        .shot-tab-btn { flex-shrink: 0; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 99px; padding: 6px 14px; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.45); cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .shot-tab-btn.active { background: rgba(180,145,60,0.15); border-color: rgba(180,145,60,0.5); color: #c8a96e; }
        .shot-tab-btn.done { background: rgba(77,168,98,0.12); border-color: rgba(77,168,98,0.35); color: #4da862; }
        .shot-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 16px; margin-bottom: 12px; }
        .series-banner { background: linear-gradient(135deg, rgba(180,145,60,0.15), rgba(180,145,60,0.05)); border: 1px solid rgba(180,145,60,0.3); border-radius: 14px; padding: 14px 16px; margin-bottom: 20px; }
      `}</style>

      <div className="upload-header">
        <button className="back-btn" onClick={() => {
          if (step > 1) {
            setStep(step - 1);
          } else {
            window.history.back();
          }
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff" }}>
          {step === 1 ? "Upload Clip" : step === 2 ? "Select Course" : step === 3 ? "Content Type" : step === 4 ? "Add Intel" : "Review"}
        </span>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(step / (isSeriesMode ? 4 : 5)) * 100}%` }} />
      </div>

      <div className="upload-wrap">

        {/* Step 1 — Upload clip (single) or series start */}
        {step === 1 && !isSeriesMode && (
          <div className="anim">
            <p className="step-label">Step 1 of 5</p>
            <h1 className="step-title">Upload your clip</h1>
            <p className="step-sub">Video or photo — we&apos;ll help fill in the rest.</p>
            {tripName && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
                <span style={{ fontSize: 16 }}>✈️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 1 }}>Part of trip</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#4da862" }}>{tripName}</div>
                </div>
                <button
                  onClick={() => setTripPublic(p => !p)}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: tripPublic ? "rgba(77,168,98,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${tripPublic ? "rgba(77,168,98,0.35)" : "rgba(255,255,255,0.12)"}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", flexShrink: 0 }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={tripPublic ? "#4da862" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {tripPublic ? <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></> : <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>}
                  </svg>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: tripPublic ? "#4da862" : "rgba(255,255,255,0.4)" }}>{tripPublic ? "Public" : "Trip only"}</span>
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={handleFileSelect} />
            {mediaPreview ? (
              <>
                {mediaType === "VIDEO" ? (
                  <video src={mediaPreview} className="preview-video" controls playsInline />
                ) : (
                  <img src={mediaPreview} className="preview-img" alt="preview" />
                )}
                <button className="btn-secondary" style={{ marginBottom: 12 }} onClick={() => { setMediaFile(null); setMediaPreview(null); setGpsSuggestions([]); }}>
                  Choose different file
                </button>
                {gpsLoading && (
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(77,168,98,0.6)", textAlign: "center", marginBottom: 12 }}>
                    📍 Reading location from video...
                  </p>
                )}
                <button className="btn-primary" onClick={() => setStep(2)}>Next: Select Course →</button>
              </>
            ) : (
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", display: "block" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div className="upload-zone-title">Tap to upload video or photo</div>
                <div className="upload-zone-sub">MP4, MOV, JPG, PNG supported</div>
              </div>
            )}
            {error && <div className="error-box">{error}</div>}
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <button style={{ background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(180,145,60,0.8)", cursor: "pointer", textDecoration: "underline" }} onClick={() => setIsSeriesMode(true)}>
                Uploading a full hole? Switch to Play a Hole With Me →
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Series mode start */}
        {step === 1 && isSeriesMode && (
          <div className="anim">
            <p className="step-label">Step 1 of 4</p>
            <h1 className="step-title">Play a Hole With Me</h1>
            <p className="step-sub">Upload each shot in order — viewers follow your round.</p>
            <div className="series-banner">
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#c8a96e", marginBottom: 4 }}>📹 Shot by Shot Series</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                You&apos;ll add videos for each shot after selecting your course and hole.
              </div>
            </div>
            <button className="btn-primary" onClick={() => setStep(2)}>Select Course →</button>
            <button className="btn-secondary" onClick={() => setIsSeriesMode(false)}>← Back to Single Clip</button>
          </div>
        )}

        {/* Step 2 — Course */}
        {step === 2 && (
          <div className="anim">
            <p className="step-label">Step 2 of {isSeriesMode ? 4 : 5}</p>
            <h1 className="step-title">Which course?</h1>
            <p className="step-sub">Search by name, city, or state.</p>

            {/* GPS suggestions */}
            {(gpsSuggestions.length > 0 || gpsLoading) && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(77,168,98,0.6)", marginBottom: 8 }}>
                  📍 Suggested from your video
                </p>
                {gpsLoading && <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Reading location...</p>}
                {gpsSuggestions.map(course => {
                  const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
                  return (
                    <button key={course.id} className={`course-item ${selectedCourse?.id === course.id ? "selected" : ""}`} onClick={() => { setSelectedCourse(course); setStep(3); }}>
                      <div className="course-abbr has-clips">{abbr}</div>
                      <div>
                        <div className="course-name-text">{course.name}</div>
                        <div className="course-location-text">{[course.city, course.state].filter(s => s?.trim()).join(", ")}</div>
                      </div>
                    </button>
                  );
                })}
                {gpsSuggestions.length > 0 && <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "12px 0" }} />}
              </div>
            )}

            {/* Pre-selected course from course page */}
            {selectedCourse && !gpsSuggestions.find(c => c.id === selectedCourse.id) && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Pre-selected</p>
                {(() => {
                  const abbr = selectedCourse.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
                  return (
                    <button className="course-item selected" onClick={() => setStep(3)}>
                      <div className="course-abbr">{abbr}</div>
                      <div>
                        <div className="course-name-text">{selectedCourse.name}</div>
                        <div className="course-location-text">{[selectedCourse.city, selectedCourse.state].filter(s => s?.trim()).join(", ")}</div>
                      </div>
                    </button>
                  );
                })()}
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "12px 0" }} />
              </div>
            )}

            <input className="search-input" placeholder="Search courses..." value={courseSearch} onChange={e => setCourseSearch(e.target.value)} />
            {courseLoading && (
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 20 }}>Searching...</p>
            )}
            {!courseLoading && courseSearch.trim().length < 2 && gpsSuggestions.length === 0 && !selectedCourse && (
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 28, lineHeight: 1.6 }}>
                Type at least 2 characters<br/>
                <span style={{ fontSize: 12 }}>Search by name, city, or state</span>
              </p>
            )}
            {!courseLoading && courseSearch.trim().length >= 2 && courseResults.length === 0 && (
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 28 }}>
                No courses found — try a different spelling
              </p>
            )}
            <div className="course-list">
              {courseResults.map(course => {
                const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
                return (
                  <button key={course.id} className={`course-item ${selectedCourse?.id === course.id ? "selected" : ""}`} onClick={() => { setSelectedCourse(course); setStep(3); }}>
                    <div className="course-abbr">{abbr}</div>
                    <div>
                      <div className="course-name-text">{course.name}</div>
                      <div className="course-location-text">{[course.city, course.state].filter(s => s?.trim()).join(", ")}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3 — Format + Hole */}
        {step === 3 && selectedCourse && (
          <div className="anim">
            <p className="step-label">Step 3 of {isSeriesMode ? 4 : 5}</p>
            <h1 className="step-title">What are you posting?</h1>
            <p className="step-sub">{selectedCourse.name}</p>

            {/* Format grid */}
            {!contentFormat && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                {CONTENT_FORMATS.map(fmt => (
                  <button
                    key={fmt.value}
                    onClick={() => {
                      setContentFormat(fmt.value);
                      if (!fmt.needsHole) {
                        setSelectedHole(null);
                        setIntel(prev => ({ ...prev, shotType: fmt.value === "FULL_HOLE" ? "FULL_HOLE" : fmt.value }));
                        setStep(4);
                      }
                    }}
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: "16px 12px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                  >
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{fmt.label}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{fmt.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {/* 3-hole group picker */}
            {contentFormat === "THREE_HOLE" && !selectedGroup && (
              <div>
                <p className="nine-label" style={{ marginTop: 0 }}>Select a group</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {THREE_HOLE_GROUPS.map(g => (
                    <button key={g} className="hole-btn" onClick={() => { setSelectedGroup(g); setSelectedHole(null); setStep(4); }}>
                      <div className="hole-btn-num" style={{ fontSize: 15 }}>{g}</div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setContentFormat("")} style={{ marginTop: 14, background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>← Back</button>
              </div>
            )}

            {/* Hole picker for Single Shot or Full Hole */}
            {(contentFormat === "SHOT" || contentFormat === "FULL_HOLE") && (
              <div>
                <p className="nine-label" style={{ marginTop: 0 }}>Front Nine</p>
                <div className="holes-grid">
                  {frontNine.map(n => (
                    <button key={n} className={`hole-btn ${selectedHole === n ? "selected" : ""}`} onClick={() => { setSelectedHole(n); setStep(4); }}>
                      <div className="hole-btn-num">{n}</div>
                    </button>
                  ))}
                </div>
                <p className="nine-label">Back Nine</p>
                <div className="holes-grid">
                  {backNine.map(n => (
                    <button key={n} className={`hole-btn ${selectedHole === n ? "selected" : ""}`} onClick={() => { setSelectedHole(n); setStep(4); }}>
                      <div className="hole-btn-num">{n}</div>
                    </button>
                  ))}
                </div>
                <button onClick={() => { setContentFormat(""); setSelectedHole(null); }} style={{ marginTop: 4, background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>← Back</button>
              </div>
            )}
          </div>
        )}

        {/* Step 4 — Play a Hole With Me series */}
        {step === 4 && isSeriesMode && (
          <div className="anim">
            <p className="step-label">Step 4 of 4</p>
            <h1 className="step-title">Play a Hole With Me</h1>
            <p className="step-sub">{selectedCourse?.name} — Hole {selectedHole}</p>

            <div className="series-banner">
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#c8a96e", marginBottom: 4 }}>📹 Shot by Shot Series</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                Upload each shot in order. Viewers swipe left/right to follow your round. Add yardage and shot type for each clip.
              </div>
            </div>

            {/* Shot tabs */}
            <div className="shot-tab">
              {seriesShots.map((shot, i) => (
                <button
                  key={shot.id}
                  className={`shot-tab-btn ${activeShot === i ? "active" : ""} ${shot.uploaded ? "done" : ""}`}
                  onClick={() => setActiveShot(i)}
                >
                  {shot.uploaded ? "✓ " : ""}Shot {i + 1}
                </button>
              ))}
              <button
                className="shot-tab-btn"
                onClick={addShot}
                style={{ background: "rgba(255,255,255,0.03)", borderStyle: "dashed" }}
              >
                + Add Shot
              </button>
            </div>

            {/* Active shot editor */}
            {seriesShots.map((shot, i) => i === activeShot && (
              <div key={shot.id} className="anim">
                <input
                  ref={el => { seriesFileRefs.current[i] = el; }}
                  type="file"
                  accept="video/*"
                  style={{ display: "none" }}
                  onChange={e => handleSeriesFileSelect(e, i)}
                />

                {/* Video upload for this shot */}
                {shot.preview ? (
                  <div style={{ marginBottom: 12 }}>
                    <video src={shot.preview} style={{ width: "100%", borderRadius: 12, maxHeight: 200, objectFit: "cover" }} controls playsInline />
                    <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => {
                      const updated = [...seriesShots];
                      updated[i] = { ...updated[i], file: null, preview: null, mediaType: null };
                      setSeriesShots(updated);
                    }}>Choose different video</button>
                  </div>
                ) : (
                  <div className="upload-zone" onClick={() => seriesFileRefs.current[i]?.click()} style={{ marginBottom: 16, padding: "24px 20px" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 10px", display: "block" }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <div className="upload-zone-title" style={{ fontSize: 14 }}>Tap to upload Shot {i + 1}</div>
                    <div className="upload-zone-sub">Video recommended</div>
                  </div>
                )}

                {/* Shot type */}
                <div className="field">
                  <label className="field-label">Shot Type <span className="optional-tag">OPTIONAL</span></label>
                  <div className="pill-row">
                    {SERIES_SHOT_TYPES.map(s => (
                      <button key={s.value} className={`pill-option ${shot.shotType === s.value ? "selected" : ""}`} onClick={() => updateShot(i, "shotType", shot.shotType === s.value ? "" : s.value)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Yardage overlay */}
                <div className="field">
                  <label className="field-label">Yardage Overlay <span className="optional-tag">OPTIONAL</span></label>
                  <input
                    className="field-input"
                    placeholder="e.g. 187 yards, 42 ft putt..."
                    value={shot.yardage}
                    onChange={e => updateShot(i, "yardage", e.target.value)}
                  />
                  {shot.yardage && (
                    <div style={{ marginTop: 8, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 12px", display: "inline-block" }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff" }}>{shot.yardage}</span>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", marginLeft: 6 }}>preview overlay</span>
                    </div>
                  )}
                </div>

                {/* Club */}
                <div className="field">
                  <label className="field-label">Club Used <span className="optional-tag">OPTIONAL</span></label>
                  <select className="field-input" value={shot.club} onChange={e => updateShot(i, "club", e.target.value)} style={{ colorScheme: "dark", cursor: "pointer", background: "#0d1f12", color: "rgba(255,255,255,0.8)" }}>
                    <option value="">Select a club...</option>
                    {CLUBS.map(group => (
                      <optgroup key={group.group} label={group.group}>
                        {group.options.map(club => (
                          <option key={club} value={club}>{club}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Strategy note */}
                <div className="field">
                  <label className="field-label" style={{ color: "#4da862" }}>Strategy Note <span className="optional-tag">OPTIONAL</span></label>
                  <textarea className="field-textarea" rows={2} placeholder="What's the play on this shot?" value={shot.strategy} onChange={e => updateShot(i, "strategy", e.target.value)} />
                </div>

                {/* Remove shot */}
                {seriesShots.length > 1 && (
                  <button onClick={() => removeShot(i)} style={{ background: "none", border: "1px solid rgba(220,60,60,0.2)", borderRadius: 10, padding: "8px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(220,100,100,0.7)", cursor: "pointer", marginBottom: 16 }}>
                    Remove this shot
                  </button>
                )}

                {/* Navigation between shots */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {i > 0 && (
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setActiveShot(i - 1)}>← Previous shot</button>
                  )}
                  {i < seriesShots.length - 1 && (
                    <button className="btn-primary" style={{ flex: 1, marginBottom: 0 }} onClick={() => setActiveShot(i + 1)}>Next shot →</button>
                  )}
                </div>
              </div>
            ))}

            {error && <div className="error-box">{error}</div>}

            {/* Submit series */}
            <button className="btn-primary" disabled={uploading} onClick={handleSeriesSubmit} style={{ background: "linear-gradient(135deg, #2d7a42, #1d5a30)" }}>
              {uploading ? `Uploading... (${seriesShots.filter(s => s.uploaded).length}/${seriesShots.length} shots)` : `Submit Series (${seriesShots.length} shots)`}
            </button>
          </div>
        )}

        {/* Step 4 — Intel (single clip only) */}
        {step === 4 && !isSeriesMode && (
          <div className="anim">
            <p className="step-label">Step 4 of 5</p>
            <h1 className="step-title">Add your intel</h1>
            <p className="step-sub">All fields optional — but more intel means higher ranking.</p>
            <div className="intel-score-bar">
              <div className="intel-score-top">
                <span className="intel-score-label" style={{ color: intelColor }}>{intelLabel}</span>
                <span className="intel-score-pct" style={{ color: intelColor }}>{intelPct}%</span>
              </div>
              <div className="intel-bar-bg">
                <div className="intel-bar-fill" style={{ width: `${intelPct}%`, background: intelColor }} />
              </div>
              <p className="intel-hint">Fill in more fields to boost your clip's discoverability</p>
            </div>
            <div className="field">
              <label className="field-label">Date Played <span className="optional-tag">OPTIONAL</span></label>
              <input className="field-input" type="date" value={intel.datePlayed} onChange={e => setIntel({ ...intel, datePlayed: e.target.value })} style={{ colorScheme: "dark" }} />
            </div>
            <div className="field">
              <label className="field-label">Tee <span className="optional-tag">OPTIONAL</span></label>
              <div className="pill-row">
                {TEE_COLORS.map(tee => {
                  const teeColorMap: Record<string, string> = { Black: "#222", Blue: "#2a6db5", White: "#e8e8e8", Red: "#c0392b", Gold: "#c8a96e", Green: "#4da862" };
                  return (
                    <button key={tee} className={`pill-option ${intel.tee === tee ? "selected" : ""}`} onClick={() => setIntel({ ...intel, tee: intel.tee === tee ? "" : tee })}>
                      <span className="tee-dot" style={{ background: teeColorMap[tee], border: tee === "White" ? "1px solid rgba(255,255,255,0.3)" : "none" }} />
                      {tee}
                    </button>
                  );
                })}
              </div>
            </div>
            {contentFormat === "SHOT" && (
            <div className="field">
              <label className="field-label">Shot Type <span className="optional-tag">OPTIONAL</span></label>
              <div className="pill-row">
                {SHOT_TYPES.map(s => (
                  <button key={s.value} className={`pill-option ${intel.shotType === s.value ? "selected" : ""}`} onClick={() => setIntel({ ...intel, shotType: intel.shotType === s.value ? "" : s.value })}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            )}
            <div className="field">
              <label className="field-label">Club Used <span className="optional-tag">OPTIONAL</span></label>
              <select className="field-input" value={intel.club} onChange={e => setIntel({ ...intel, club: e.target.value })} style={{ colorScheme: "dark", cursor: "pointer", background: "#0d1f12", color: "rgba(255,255,255,0.8)" }}>
                <option value="">Select a club...</option>
                {CLUBS.map(group => (
                  <optgroup key={group.group} label={group.group}>
                    {group.options.map(club => (
                      <option key={club} value={club}>{club}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Wind <span className="optional-tag">OPTIONAL</span></label>
              <div className="pill-row">
                {WIND_OPTIONS.map(w => (
                  <button key={w.value} className={`pill-option ${intel.wind === w.value ? "selected" : ""}`} onClick={() => setIntel({ ...intel, wind: intel.wind === w.value ? "" : w.value })}>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="field-label">Your Handicap Range <span className="optional-tag">OPTIONAL</span></label>
              <div className="pill-row">
                {HANDICAP_RANGES.map(h => (
                  <button key={h.value} className={`pill-option ${intel.handicap === h.value ? "selected" : ""}`} onClick={() => setIntel({ ...intel, handicap: intel.handicap === h.value ? "" : h.value })}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="divider" />
            <div className="field">
              <label className="field-label" style={{ color: "#4da862" }}>Strategy Note <span className="optional-tag">OPTIONAL</span></label>
              <textarea className="field-textarea" rows={3} placeholder="What's the play? Where do you aim, what do you avoid..." value={intel.strategy} onChange={e => setIntel({ ...intel, strategy: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" style={{ color: "rgba(100,160,220,0.8)" }}>Landing Zone <span className="optional-tag">OPTIONAL</span></label>
              <textarea className="field-textarea" rows={2} placeholder="Where should the ball land?" value={intel.landingZone} onChange={e => setIntel({ ...intel, landingZone: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" style={{ color: "rgba(210,175,80,0.7)" }}>What the Camera Doesn't Show <span className="optional-tag">OPTIONAL</span></label>
              <textarea className="field-textarea" rows={2} placeholder="Slopes, blind spots, elevation changes, tricky pin positions..." value={intel.hidden} onChange={e => setIntel({ ...intel, hidden: e.target.value })} />
            </div>
            <div style={{ height: 90 }} />
          </div>
        )}

        {/* Floating submit button — stays on screen while scrolling Intel step */}
        {step === 4 && !isSeriesMode && (
          <div style={{ position: "fixed", bottom: 80, left: 0, right: 0, padding: "0 20px", zIndex: 50 }}>
            <button
              className="btn-primary"
              onClick={() => setStep(5)}
              style={{ margin: 0, background: "linear-gradient(135deg, #2d7a42, #1d5a30)", boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(77,168,98,0.2)" }}
            >
              Review &amp; Submit →
            </button>
          </div>
        )}

        {/* Step 5 — Review (single clip only) */}
        {step === 5 && !isSeriesMode && selectedCourse && selectedHole && (
          <div className="anim">
            <p className="step-label">Step 5 of 5</p>
            <h1 className="step-title">Ready to submit?</h1>
            <p className="step-sub">Review your clip before it goes live.</p>
            {error && <div className="error-box">{error}</div>}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px 18px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#4da862" }}>
                  {selectedCourse.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>{selectedCourse.name}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Hole {selectedHole} · {mediaType}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Intel Score</span>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 900, color: intelColor }}>{intelLabel} · {intelPct}%</span>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
                <div style={{ height: 3, borderRadius: 99, background: intelColor, width: `${intelPct}%` }} />
              </div>
              {(intel.tee || intel.datePlayed || intel.club || intel.wind || intel.shotType || intel.handicap) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
                  {intel.datePlayed && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{intel.datePlayed}</span>}
                  {intel.tee && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{intel.tee} tees</span>}
                  {intel.club && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{intel.club}</span>}
                  {intel.wind && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{WIND_OPTIONS.find(w => w.value === intel.wind)?.label} wind</span>}
                  {intel.shotType && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{SHOT_TYPES.find(s => s.value === intel.shotType)?.label}</span>}
                  {intel.handicap && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{HANDICAP_RANGES.find(h => h.value === intel.handicap)?.label}</span>}
                </div>
              )}
            </div>
            <button className="btn-primary" disabled={uploading} onClick={handleSubmit}>
              {uploading ? "Uploading..." : "Submit clip"}
            </button>
            <button className="btn-secondary" onClick={() => setStep(4)}>Edit intel</button>
          </div>
        )}

      </div>
      <BottomNav />
    </main>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Loading...</div>
      </main>
    }>
      <UploadPageInner />
    </Suspense>
  );
}
