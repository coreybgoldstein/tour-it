"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { compressVideo } from "@/lib/compressVideo";
import BatchUpload from "./BatchUpload";
import { sendPushToUser } from "@/lib/sendPush";
import exifr from "exifr";

type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
  holeCount: number;
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

const INTEL_FIELDS = ["tee", "datePlayed", "club", "wind", "notes", "handicap"];

function UploadPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCourseId = searchParams.get("courseId");
  const preselectedHoleNumber = searchParams.get("holeNumber") ? Number(searchParams.get("holeNumber")) : null;
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
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "scanning" | "found" | "no_nearby" | "no_gps" | "device">("idle");
  const [gpsSuggestedHole, setGpsSuggestedHole] = useState<number | null>(null);
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
  const [compressing, setCompressing] = useState(false);
  const [compressStage, setCompressStage] = useState("");
  const [compressPct, setCompressPct] = useState(0);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [intel, setIntel] = useState({
    tee: "",
    datePlayed: "",
    shotType: "",
    club: "",
    wind: "",
    notes: "",
    handicap: "",
  });

  const [uploadStage, setUploadStage] = useState<"idle" | "compressing" | "uploading">("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [batchFiles, setBatchFiles] = useState<File[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const compressionPromiseRef = useRef<Promise<File> | null>(null);
  const compressedFileRef = useRef<File | null>(null);

  type TagUser = { id: string; username: string; displayName: string; avatarUrl: string | null };
  const [tagInput, setTagInput] = useState("");
  const [tagResults, setTagResults] = useState<TagUser[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<TagUser[]>([]);
  const tagDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login?redirect=/upload");
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
        if (preselectedHoleNumber) setSelectedHole(preselectedHoleNumber);
        if (preselectedTripId) {
          const { data: trip } = await supabase.from("GolfTrip").select("name").eq("id", preselectedTripId).single();
          if (trip) setTripName(trip.name);
        }
      }
    });
  }, []);

  // Tag user search
  useEffect(() => {
    if (tagDebounce.current) clearTimeout(tagDebounce.current);
    if (!tagInput.trim()) { setTagResults([]); return; }
    tagDebounce.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase.from("User").select("id, username, displayName, avatarUrl").ilike("username", `%${tagInput.trim()}%`).limit(6);
      const taggedIds = new Set(taggedUsers.map(u => u.id));
      setTagResults((data || []).filter((u: TagUser) => !taggedIds.has(u.id)));
    }, 280);
  }, [tagInput, taggedUsers]);

  const searchCourses = useCallback((q: string) => {
    if (courseDebounceRef.current) clearTimeout(courseDebounceRef.current);
    if (!q.trim()) {
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Multiple files → batch mode
    if (files.length > 1) {
      setBatchFiles(Array.from(files));
      return;
    }

    const file = files[0];
    const isVideo = file.type.startsWith("video/");
    const isPhoto = file.type.startsWith("image/");
    if (!isVideo && !isPhoto) { setError("Please upload a video or photo file."); return; }
    setError("");
    setCompressedSize(null);
    setOriginalSize(null);

    // Show preview immediately with original file
    setMediaType(isVideo ? "VIDEO" : "PHOTO");
    setMediaPreview(URL.createObjectURL(file));

    // Auto-fill date from file metadata
    const dateFromFile = new Date(file.lastModified).toISOString().split("T")[0];
    setIntel(prev => ({ ...prev, datePlayed: prev.datePlayed || dateFromFile }));

    // Always set mediaFile immediately so user can proceed through all steps
    setMediaFile(file);
    compressedFileRef.current = null;

    if (isVideo) {
      setGpsLoading(true);
      setGpsStatus("scanning");

      // Shared: look up nearby courses for a lat/lng and auto-select the closest
      const resolveLocation = async (coords: { lat: number; lng: number }, source: "file" | "device") => {
        setGpsCoords(coords);
        console.log("[GPS] coords:", coords.lat.toFixed(6), coords.lng.toFixed(6));
        console.log("[GPS] bbox:", coords.lat - 0.1, "to", coords.lat + 0.1, " / ", coords.lng - 0.1, "to", coords.lng + 0.1);
        const supabase = createClient();
        const { data, error } = await supabase
          .from("Course")
          .select("id, name, city, state, holeCount, latitude, longitude")
          .gte("latitude", coords.lat - 0.1)
          .lte("latitude", coords.lat + 0.1)
          .gte("longitude", coords.lng - 0.1)
          .lte("longitude", coords.lng + 0.1)
          .order("uploadCount", { ascending: false })
          .limit(5);
        console.log("[GPS] query result:", data, "error:", error);
        const courses = (data || []) as (Course & { latitude: number | null; longitude: number | null })[];
        setGpsSuggestions(courses);

        const R = 6371000;
        const withDist = courses
          .filter(c => c.latitude != null && c.longitude != null)
          .map(c => {
            const dLat = (c.latitude! - coords.lat) * Math.PI / 180;
            const dLng = (c.longitude! - coords.lng) * Math.PI / 180;
            const a = Math.sin(dLat/2)**2 + Math.cos(coords.lat*Math.PI/180)*Math.cos(c.latitude!*Math.PI/180)*Math.sin(dLng/2)**2;
            return { course: c, dist: R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) };
          })
          .sort((a, b) => a.dist - b.dist);

        console.log("[GPS] withDist:", withDist.map(d => `${d.course.name} ${Math.round(d.dist)}m`));
        if (withDist.length > 0 && withDist[0].dist < 2000) {
          setSelectedCourse(withDist[0].course);
          setStep(prev => (prev <= 2 ? 3 : prev));
          setGpsStatus(source === "device" ? "device" : "found");
        } else {
          setGpsStatus("no_nearby");
        }
        setGpsLoading(false);
      };

      // Start device geolocation immediately in parallel — iOS often has stale/wrong GPS in the file
      const deviceCoordsPromise = new Promise<{ lat: number; lng: number } | null>(resolve => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 8000, maximumAge: 60000, enableHighAccuracy: true }
        );
      });

      // Race file GPS against device GPS; use whichever finds a nearby course first
      extractGPSFromVideo(file).then(async fileCoords => {
        if (fileCoords) {
          // File GPS found — check if it points to a real course
          const supabase = createClient();
          const { data } = await supabase
            .from("Course")
            .select("id")
            .gte("latitude", fileCoords.lat - 0.1)
            .lte("latitude", fileCoords.lat + 0.1)
            .gte("longitude", fileCoords.lng - 0.1)
            .lte("longitude", fileCoords.lng + 0.1)
            .limit(1);
          if (data && data.length > 0) {
            // File GPS is near a known course — use it
            await resolveLocation(fileCoords, "file");
            return;
          }
          console.log("[GPS] file coords found no course, trying device GPS");
        }
        // File GPS missing or pointed nowhere useful — fall back to device location
        const deviceCoords = await deviceCoordsPromise;
        if (deviceCoords) {
          await resolveLocation(deviceCoords, "device");
        } else if (fileCoords) {
          // Have file coords but no course nearby and no device — show them anyway
          await resolveLocation(fileCoords, "file");
        } else {
          setGpsLoading(false);
          setGpsStatus("no_gps");
        }
      });

      // Start compression in the background — user fills in details while it runs
      const SKIP_MB = 30;
      if (file.size >= SKIP_MB * 1024 * 1024) {
        setOriginalSize(file.size);
        setCompressing(true);
        setCompressPct(0);
        compressionPromiseRef.current = compressVideo(file, (stage, pct) => {
          setCompressStage(stage);
          setCompressPct(pct);
        }).then(compressed => {
          compressedFileRef.current = compressed;
          setCompressedSize(compressed.size);
          setCompressing(false);
          return compressed;
        }).catch(() => {
          setCompressing(false);
          setError("Video compression failed. Your original file will be uploaded instead.");
          return file;
        });
      } else {
        compressionPromiseRef.current = null;
      }
    }
  };

  // Extract GPS from video using exifr — handles HEVC, H.264, MOV, MP4, Dolby Vision
  async function extractGPSFromVideo(file: File): Promise<{ lat: number; lng: number } | null> {
    try {
      // Try QuickTime-specific parsing first — reads the ©xyz atom iOS writes at recording time
      const qt = await exifr.parse(file, { quicktime: true, tiff: false, exif: false, gps: false, iptc: false, xmp: false });
      console.log("[exifr] quicktime parse:", JSON.stringify(qt));
      if (qt?.latitude != null && qt?.longitude != null) {
        console.log("[exifr] qt location:", qt.latitude, qt.longitude);
        return { lat: qt.latitude, lng: qt.longitude };
      }
    } catch (e) {
      console.log("[exifr] quicktime error:", e);
    }
    try {
      // Fallback: standard EXIF GPS tags
      const gps = await exifr.gps(file);
      console.log("[exifr] exif gps:", JSON.stringify(gps));
      if (gps?.latitude != null && gps?.longitude != null) {
        return { lat: gps.latitude, lng: gps.longitude };
      }
    } catch (e) {
      console.log("[exifr] exif error:", e);
    }
    return null;
  }


  // When hole picker opens and we have GPS, find the closest hole by tee coords
  useEffect(() => {
    if (!gpsCoords || !selectedCourse || (contentFormat !== "SHOT" && contentFormat !== "FULL_HOLE")) {
      setGpsSuggestedHole(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from("Hole")
      .select("holeNumber, teeLat, teeLng")
      .eq("courseId", selectedCourse.id)
      .not("teeLat", "is", null)
      .not("teeLng", "is", null)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const R = 6371000;
        let best: number | null = null;
        let bestDist = Infinity;
        for (const h of data) {
          const dLat = (h.teeLat - gpsCoords.lat) * Math.PI / 180;
          const dLng = (h.teeLng - gpsCoords.lng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(gpsCoords.lat * Math.PI / 180) * Math.cos(h.teeLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          if (dist < bestDist) { bestDist = dist; best = h.holeNumber; }
        }
        if (best !== null && bestDist < 400) {
          setGpsSuggestedHole(best);
          // Auto-select the hole if GPS is very close (within 200m)
          if (bestDist < 200) setSelectedHole(best);
        }
      });
  }, [gpsCoords, selectedCourse, contentFormat]);

  const handleSubmit = async () => {
    const isMultiHole = contentFormat && contentFormat !== "SHOT" && contentFormat !== "FULL_HOLE";
    if (!selectedCourse || (!selectedHole && !isMultiHole) || !mediaFile) return;
    setUploading(true);
    setError("");

    // If compression is still running, wait for it
    let fileToUpload = mediaFile;
    if (compressionPromiseRef.current) {
      setUploadStage("compressing");
      fileToUpload = await compressionPromiseRef.current;
      compressionPromiseRef.current = null;
    } else if (compressedFileRef.current) {
      fileToUpload = compressedFileRef.current;
    }
    setUploadStage("uploading");

    if (mediaType === "VIDEO" && fileToUpload.size > 500 * 1024 * 1024) {
      setError("Video is too large (max 500 MB). Try trimming it to under 2 minutes.");
      setUploading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("You must be logged in to upload."); setUploading(false); return; }

      let mediaUrl = "";
      let cloudflareVideoId: string | null = null;

      if (mediaType === "VIDEO") {
        // Get a one-time Cloudflare direct-upload URL from our server
        const cfRes = await fetch("/api/cloudflare-stream/direct-upload", { method: "POST" });
        if (!cfRes.ok) { setError("Could not start upload — please try again."); setUploading(false); setUploadStage("idle"); return; }
        const { uploadUrl, uid } = await cfRes.json();

        // Upload the video file directly to Cloudflare
        const uploadError = await new Promise<Error | null>((resolve) => {
          const formData = new FormData();
          formData.append("file", fileToUpload);
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100)); };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve(null) : resolve(new Error(`Upload failed: ${xhr.status}`));
          xhr.onerror = () => resolve(new Error("Network error"));
          xhr.open("POST", uploadUrl);
          xhr.send(formData);
        });
        if (uploadError) { setError("Upload failed — check your connection and try again."); setUploading(false); setUploadStage("idle"); return; }
        cloudflareVideoId = uid;
      } else {
        // Photos still go to Supabase Storage
        const ext = fileToUpload.name.split(".").pop();
        const filePath = `${user.id}/${selectedCourse.id}/${selectedHole || contentFormat || "misc"}/${Date.now()}.${ext}`;
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

        const xhrUpload = (upsert: boolean) => new Promise<{ error: Error | null }>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100)); };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) { resolve({ error: null }); return; }
            try { resolve({ error: new Error(JSON.parse(xhr.responseText).message || xhr.statusText) }); } catch { resolve({ error: new Error(xhr.statusText || "Upload failed") }); }
          };
          xhr.onerror = () => resolve({ error: new Error("Load failed") });
          xhr.open("POST", `${supabaseUrl}/storage/v1/object/tour-it-photos/${filePath}`);
          xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
          xhr.setRequestHeader("x-upsert", upsert ? "true" : "false");
          xhr.send(fileToUpload);
        });

        setUploadPct(0);
        let { error: uploadError } = await xhrUpload(false);
        if (uploadError) {
          setUploadPct(0);
          await new Promise(r => setTimeout(r, 1500));
          ({ error: uploadError } = await xhrUpload(true));
        }
        if (uploadError) { setError("Upload failed — check your connection and try again."); setUploading(false); setUploadStage("idle"); return; }
        const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(filePath);
        mediaUrl = publicUrl;
      }

      // Only look up holeId for single-hole content; create the Hole row if it doesn't exist yet
      let holeId: string | null = null;
      if (selectedHole) {
        const { data: holeData } = await supabase.from("Hole").select("id").eq("courseId", selectedCourse.id).eq("holeNumber", selectedHole).maybeSingle();
        if (holeData?.id) {
          holeId = holeData.id;
        } else {
          const newHoleId = crypto.randomUUID();
          const holeNow = new Date().toISOString();
          const { error: holeInsertError } = await supabase.from("Hole").insert({
            id: newHoleId,
            courseId: selectedCourse.id,
            holeNumber: selectedHole,
            par: 0,
            uploadCount: 0,
            createdAt: holeNow,
            updatedAt: holeNow,
          });
          if (holeInsertError) { setError(`Failed to save: ${holeInsertError.message}`); setUploading(false); return; }
          holeId = newHoleId;
        }
      }

      // Determine shotType: for single shots use intel.shotType, for formats use the format itself
      const resolvedShotType = contentFormat === "SHOT" ? (intel.shotType || null)
        : contentFormat === "FULL_HOLE" ? "FULL_HOLE"
        : contentFormat || null;

      const uploadId = crypto.randomUUID();
      const { error: dbError } = await supabase.from("Upload").insert({
        id: uploadId,
        userId: user.id,
        courseId: selectedCourse.id,
        holeId,
        mediaType: mediaType,
        mediaUrl,
        cloudflareVideoId,
        teeBoxId: null,
        shotType: resolvedShotType,
        yardageOverlay: contentFormat === "THREE_HOLE" ? selectedGroup : null,
        clubUsed: intel.club || null,
        windCondition: intel.wind || null,
        strategyNote: intel.notes || null,
        handicapRange: intel.handicap || null,
        datePlayedAt: intel.datePlayed ? new Date(intel.datePlayed).toISOString() : null,
        rankScore: 1 / Math.pow(2, 1.3), // base score for new clip, ~0.41
        clipLat: gpsCoords?.lat ?? null,
        clipLng: gpsCoords?.lng ?? null,
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

      // Auto-link to round
      const roundDate = intel.datePlayed
        ? new Date(intel.datePlayed).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];
      const { data: existingRound } = await supabase.from("Round").select("id").eq("userId", user.id).eq("courseId", selectedCourse.id).eq("date", roundDate).single();
      if (existingRound) {
        await supabase.from("Upload").update({ roundId: existingRound.id }).eq("id", uploadId);
      } else {
        const newRoundId = crypto.randomUUID();
        await supabase.from("Round").insert({ id: newRoundId, userId: user.id, courseId: selectedCourse.id, date: roundDate, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        await supabase.from("Upload").update({ roundId: newRoundId }).eq("id", uploadId);
      }

      // Increment upload counters
      const { data: cRow } = await supabase.from("Course").select("uploadCount").eq("id", selectedCourse.id).single();
      await supabase.from("Course").update({ uploadCount: (cRow?.uploadCount || 0) + 1 }).eq("id", selectedCourse.id);
      if (holeId) {
        const { data: hRow } = await supabase.from("Hole").select("uploadCount").eq("id", holeId).single();
        await supabase.from("Hole").update({ uploadCount: (hRow?.uploadCount || 0) + 1 }).eq("id", holeId);
      }

      // Tag notifications + UploadTag rows
      if (taggedUsers.length > 0) {
        const { data: taggerProfile } = await supabase.from("User").select("displayName, username").eq("id", user.id).single();
        const taggerName = taggerProfile?.displayName || taggerProfile?.username || "Someone";
        const notifNow = new Date().toISOString();
        await Promise.all([
          supabase.from("UploadTag").insert(
            taggedUsers.map(u => ({
              id: crypto.randomUUID(),
              uploadId,
              userId: u.id,
              createdAt: notifNow,
            }))
          ),
          supabase.from("Notification").insert(
            taggedUsers.map(u => ({
              id: crypto.randomUUID(),
              userId: u.id,
              type: "clip_tag",
              title: "You were tagged in a clip",
              body: `${taggerName} tagged you in a clip at ${selectedCourse.name} — Hole ${selectedHole}. Allow it on your profile?`,
              linkUrl: `/courses/${selectedCourse.id}`,
              referenceId: uploadId,
              read: false,
              createdAt: notifNow,
              updatedAt: notifNow,
            }))
          ),
        ]);
        taggedUsers.forEach(u => sendPushToUser(u.id, "You were tagged in a clip", `${taggerName} tagged you at ${selectedCourse.name} — Hole ${selectedHole}`, `/courses/${selectedCourse.id}`));
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    }
    setUploading(false);
    setUploadStage("idle");
  };

  if (!authChecked) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Loading...</div>
      </main>
    );
  }

  if (batchFiles) {
    return <BatchUpload initialFiles={batchFiles} onBack={() => { setBatchFiles(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} />;
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
            Clip uploaded!
          </h1>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 300, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 28 }}>
            Your intel for {selectedCourse?.name}{selectedHole ? ` — Hole ${selectedHole}` : ""} is under review and will go live shortly.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => {
                setStep(1);
                setSelectedHole(null);
                setContentFormat("");
                setSelectedGroup("");
                setMediaFile(null);
                setMediaPreview(null);
                setIntel({ tee: "", datePlayed: "", shotType: "", club: "", wind: "", notes: "", handicap: "" });
                setSubmitted(false);
              }}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "10px 20px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
              Upload another
            </button>
            <button
              onClick={() => selectedHole
                ? router.push(`/courses/${selectedCourse?.id}/holes/${selectedHole}`)
                : router.push(`/courses/${selectedCourse?.id}`)
              }
              style={{ background: "#2d7a42", border: "none", borderRadius: 99, padding: "10px 20px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
              {selectedHole ? "View hole" : "View course"}
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
        .search-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 16px; font-family: 'Outfit', sans-serif; font-size: 16px; color: #fff; outline: none; margin-bottom: 12px; }
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
        .field-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 11px 14px; font-family: 'Outfit', sans-serif; font-size: 16px; color: rgba(255,255,255,0.8); outline: none; }
        .field-input:focus { border-color: rgba(77,168,98,0.4); }
        .field-textarea { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 11px 14px; font-family: 'Outfit', sans-serif; font-size: 16px; color: rgba(255,255,255,0.8); outline: none; resize: none; line-height: 1.5; }
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
          if (step === 4) {
            // Reset step 3 sub-state so user lands on the format picker cleanly
            setContentFormat("");
            setSelectedHole(null);
            setSelectedGroup("");
            setStep(3);
          } else if (step === 3) {
            // If mid-step-3 (format chosen but hole not yet picked), clear format first
            if (contentFormat) {
              setContentFormat("");
              setSelectedHole(null);
              setSelectedGroup("");
            } else {
              setStep(2);
            }
          } else if (step > 1) {
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
        <div className="progress-fill" style={{ width: `${(step / 5) * 100}%` }} />
      </div>

      {/* Compression status banner — visible on all steps while running */}
      {compressing && step > 1 && (
        <div style={{ margin: "0 20px 16px", background: "rgba(77,168,98,0.07)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
              {compressStage || "Compressing video…"}
            </span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862" }}>{compressPct}%</span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${compressPct || 5}%`, background: "#4da862", borderRadius: 99, transition: "width 0.3s ease" }} />
          </div>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 5, marginBottom: 0 }}>
            Compressing in background — your clip will upload automatically when ready
          </p>
        </div>
      )}

      <div className="upload-wrap">

        {/* Step 1 — Upload clip */}
        {step === 1 && (
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
            <input ref={fileInputRef} type="file" accept="video/*,image/*" multiple style={{ display: "none" }} onChange={handleFileSelect} />
            {mediaPreview ? (
              <>
                {mediaType === "VIDEO" ? (
                  <video src={mediaPreview} className="preview-video" controls playsInline />
                ) : (
                  <img src={mediaPreview} className="preview-img" alt="preview" />
                )}
                <button className="btn-secondary" style={{ marginBottom: 12 }} onClick={() => { setMediaFile(null); setMediaPreview(null); setGpsSuggestions([]); setGpsStatus("idle"); setGpsCoords(null); setCompressing(false); setOriginalSize(null); setCompressedSize(null); compressionPromiseRef.current = null; compressedFileRef.current = null; }}>
                  Choose different file
                </button>

                {/* Compression progress */}
                {compressing && (
                  <div style={{ marginBottom: 16, background: "rgba(77,168,98,0.06)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{compressStage || "Preparing…"}</span>
                      {compressPct > 0 && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862" }}>{compressPct}%</span>}
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${compressPct || 10}%`, background: "#4da862", borderRadius: 99, transition: "width 0.3s ease" }} />
                    </div>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 8, marginBottom: 0 }}>
                      Compressing before upload — this saves time on slow connections
                    </p>
                  </div>
                )}

                {/* Compression result */}
                {!compressing && originalSize && compressedSize && (
                  <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                      Compressed {(originalSize / 1048576).toFixed(0)} MB → {(compressedSize / 1048576).toFixed(0)} MB
                      {" "}<span style={{ color: "#4da862" }}>({Math.round((1 - compressedSize / originalSize) * 100)}% smaller)</span>
                    </span>
                  </div>
                )}

                {gpsStatus === "scanning" && (
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(77,168,98,0.6)", textAlign: "center", marginBottom: 12 }}>
                    📍 Reading location from video...
                  </p>
                )}
                <button
                  className="btn-primary"
                  onClick={() => setStep(2)}
                >
                  Next: Select Course →
                </button>
              </>
            ) : (
              <div className="upload-zone" onClick={() => { if (fileInputRef.current) fileInputRef.current.click(); }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 14px", display: "block" }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div className="upload-zone-title">Tap to select video or photo</div>
                  <div className="upload-zone-sub">Single clip or multiple at once</div>
                </div>
            )}
            {error && <div className="error-box">{error}</div>}
          </div>
        )}

        {/* Step 2 — Course */}
        {step === 2 && (
          <div className="anim">
            <p className="step-label">Step 2 of 5</p>
            <h1 className="step-title">Which course?</h1>
            <p className="step-sub">Search by name, city, or state.</p>

            {/* GPS status + suggestions */}
            {mediaType === "VIDEO" && gpsStatus !== "idle" && (
              <div style={{ marginBottom: 16 }}>
                {/* Scanning */}
                {gpsStatus === "scanning" && (
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(77,168,98,0.6)", marginBottom: 8 }}>
                    📍 Reading location from video...
                  </p>
                )}
                {/* Found courses */}
                {((gpsStatus === "found" || gpsStatus === "device") || (gpsSuggestions.length > 0)) && (
                  <>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(77,168,98,0.6)", marginBottom: 8 }}>
                      {gpsStatus === "device" ? "📍 Nearby (your current location)" : "📍 Suggested from your video"}
                    </p>
                    {gpsSuggestions.map(course => {
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
                    {gpsSuggestions.length > 0 && <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "12px 0" }} />}
                  </>
                )}
                {/* GPS found but no course within range */}
                {gpsStatus === "no_nearby" && (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                      📍 Location found but no nearby course in our database. Search by name below.
                    </p>
                    {gpsCoords && (
                      <p style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.2)", margin: "4px 0 0" }}>
                        {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}
                      </p>
                    )}
                  </div>
                )}
                {/* No location at all */}
                {gpsStatus === "no_gps" && (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                      Could not read your location. Allow location access when prompted, or search by name below.
                    </p>
                  </div>
                )}
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
            {!courseLoading && !courseSearch.trim() && gpsSuggestions.length === 0 && !selectedCourse && (
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 28, lineHeight: 1.6 }}>
                Start typing to search<br/>
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
            <p className="step-label">Step 3 of 5</p>
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
              </div>
            )}

            {/* Hole picker for Single Shot or Full Hole */}
            {(contentFormat === "SHOT" || contentFormat === "FULL_HOLE") && (
              <div>
                <p className="nine-label" style={{ marginTop: 0 }}>Front Nine</p>
                <div className="holes-grid">
                  {frontNine.map(n => (
                    <button key={n} className={`hole-btn ${selectedHole === n ? "selected" : ""}`} onClick={() => { setSelectedHole(n); setStep(4); }} style={gpsSuggestedHole === n && selectedHole !== n ? { borderColor: "rgba(77,168,98,0.5)", background: "rgba(77,168,98,0.1)" } : {}}>
                      <div className="hole-btn-num">{n}</div>
                      {gpsSuggestedHole === n && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, color: "#4da862", letterSpacing: "0.05em", marginTop: 3 }}>📍 GPS</div>}
                    </button>
                  ))}
                </div>
                <p className="nine-label">Back Nine</p>
                <div className="holes-grid">
                  {backNine.map(n => (
                    <button key={n} className={`hole-btn ${selectedHole === n ? "selected" : ""}`} onClick={() => { setSelectedHole(n); setStep(4); }} style={gpsSuggestedHole === n && selectedHole !== n ? { borderColor: "rgba(77,168,98,0.5)", background: "rgba(77,168,98,0.1)" } : {}}>
                      <div className="hole-btn-num">{n}</div>
                      {gpsSuggestedHole === n && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, color: "#4da862", letterSpacing: "0.05em", marginTop: 3 }}>📍 GPS</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4 — Intel */}
        {step === 4 && (
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
              <label className="field-label" style={{ color: "#4da862" }}>Notes <span className="optional-tag">OPTIONAL</span></label>
              <textarea className="field-textarea" rows={4} placeholder="Share anything golfers should know — strategy, landing zones, blind spots, elevation changes, tricky pins..." value={intel.notes} onChange={e => setIntel({ ...intel, notes: e.target.value })} />
            </div>
            <div style={{ height: 90 }} />
          </div>
        )}

        {/* Floating submit button — stays on screen while scrolling Intel step */}
        {step === 4 && (
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

        {/* Step 5 — Review */}
        {step === 5 && selectedCourse && (
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
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                    {selectedHole ? `Hole ${selectedHole}` : CONTENT_FORMATS.find(f => f.value === contentFormat)?.label || contentFormat} · {mediaType}
                  </div>
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
            {/* Tag players */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
                Tag Players <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "rgba(255,255,255,0.2)" }}>— optional</span>
              </div>

              {/* Tagged pills */}
              {taggedUsers.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {taggedUsers.map(u => (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 99, padding: "4px 10px 4px 8px" }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862" }}>@{u.username}</span>
                      <button onClick={() => setTaggedUsers(prev => prev.filter(t => t.id !== u.id))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", lineHeight: 1 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.7)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search input */}
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Search by username..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }}
                />
                {tagResults.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#0d1f12", border: "1px solid rgba(77,168,98,0.2)", borderRadius: 10, overflow: "hidden", zIndex: 10 }}>
                    {tagResults.map(u => (
                      <button key={u.id} onClick={() => { setTaggedUsers(prev => [...prev, u]); setTagInput(""); setTagResults([]); }}
                        style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.2)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {u.avatarUrl ? <img src={u.avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={u.username} /> : <span style={{ fontSize: 11, color: "#4da862", fontWeight: 700 }}>{u.username[0].toUpperCase()}</span>}
                        </div>
                        <div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "#fff" }}>{u.displayName}</div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>@{u.username}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {compressing && !uploading && (
              <div style={{ background: "rgba(77,168,98,0.07)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>Video compressing…</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862" }}>{compressPct}%</span>
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${compressPct || 5}%`, background: "#4da862", borderRadius: 99, transition: "width 0.3s ease" }} />
                </div>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 5, marginBottom: 0 }}>
                  Submit now — upload will start automatically when compression finishes
                </p>
              </div>
            )}
            <button
              className="btn-primary"
              disabled={uploading}
              onClick={handleSubmit}
              style={{ position: "relative", overflow: "hidden" }}
            >
              {uploading && (
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${uploadStage === "uploading" ? uploadPct : compressPct}%`,
                  background: "rgba(255,255,255,0.18)",
                  transition: "width 0.4s ease",
                  pointerEvents: "none",
                }} />
              )}
              <span style={{ position: "relative", zIndex: 1 }}>
                {uploadStage === "compressing"
                  ? `Compressing… ${compressPct}%`
                  : uploadStage === "uploading"
                  ? `Uploading… ${uploadPct}%`
                  : "Submit clip"}
              </span>
            </button>
            {!uploading && <button className="btn-secondary" onClick={() => setStep(4)}>Edit intel</button>}
          </div>
        )}

      </div>

      {/* Upload progress bar — fixed above BottomNav */}
      {uploading && (
        <div style={{
          position: "fixed", bottom: 62, left: 0, right: 0, zIndex: 200,
          background: "rgba(7,16,10,0.97)",
          backdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(77,168,98,0.25)",
          padding: "14px 20px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>
              {uploadStage === "compressing" ? "Compressing video…" : "Uploading to servers…"}
            </span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#4da862" }}>
              {uploadStage === "compressing" ? compressPct : uploadPct}%
            </span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${uploadStage === "compressing" ? compressPct : uploadPct}%`,
              background: "linear-gradient(90deg, #2d7a42, #4da862)",
              borderRadius: 99,
              transition: "width 0.4s ease",
            }} />
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 7 }}>
            Don't close this page until the upload finishes
          </div>
        </div>
      )}

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
