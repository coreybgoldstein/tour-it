"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
  holeCount: number;
};

const TEE_COLORS = ["Black", "Blue", "White", "Red", "Gold", "Green"];
const WIND_OPTIONS = ["Calm", "Into", "Downwind", "Left to Right", "Right to Left", "Moderate", "Strong"];
const SHOT_TYPES = [
  { label: "Tee Shot", value: "TEE_SHOT" },
  { label: "Approach", value: "APPROACH" },
  { label: "Layup", value: "LAY_UP" },
  { label: "Chip", value: "CHIP" },
  { label: "Pitch", value: "PITCH" },
  { label: "Putt", value: "PUTT" },
  { label: "Bunker", value: "BUNKER" },
  { label: "Full Hole", value: "FULL_HOLE" },
];
const HANDICAP_RANGES = ["Scratch", "Low (1-9)", "Mid (10-18)", "High (19+)"];
const CLUBS = [
  { group: "Woods", options: ["Driver", "3-wood", "5-wood", "7-wood"] },
  { group: "Hybrids", options: ["2-hybrid", "3-hybrid", "4-hybrid", "5-hybrid"] },
  { group: "Irons", options: ["2-iron", "3-iron", "4-iron", "5-iron", "6-iron", "7-iron", "8-iron", "9-iron"] },
  { group: "Wedges", options: ["Pitching Wedge", "Gap Wedge", "Sand Wedge", "Lob Wedge"] },
  { group: "Other", options: ["Putter", "Chipper"] },
];

const INTEL_FIELDS = ["tee", "datePlayed", "club", "wind", "strategy", "landingZone", "hidden", "handicap"];

function UploadPageInner() {
  const searchParams = useSearchParams();
  const preselectedCourseId = searchParams.get("courseId");

  const [step, setStep] = useState(preselectedCourseId ? 2 : 1);
  const [authChecked, setAuthChecked] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedHole, setSelectedHole] = useState<number | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"VIDEO" | "PHOTO" | null>(null);
  const [courseSearch, setCourseSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

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
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = "/login?redirect=/upload";
      } else {
        setAuthChecked(true);
        supabase.from("Course").select("id, name, city, state, holeCount").order("name").then(({ data: courses }) => {
          if (courses) {
            setAvailableCourses(courses);
            if (preselectedCourseId) {
              const match = courses.find((c: Course) => c.id === preselectedCourseId);
              if (match) setSelectedCourse(match);
            }
          }
        });
      }
    });
  }, []);

  const intelScore = INTEL_FIELDS.filter(f => intel[f as keyof typeof intel]?.trim()).length;
  const intelPct = Math.round((intelScore / INTEL_FIELDS.length) * 100);
  const intelLabel = intelPct >= 80 ? "Elite Intel" : intelPct >= 50 ? "Good Intel" : intelPct >= 25 ? "Basic Intel" : "Minimal Intel";
  const intelColor = intelPct >= 80 ? "#4da862" : intelPct >= 50 ? "#c8a96e" : intelPct >= 25 ? "#6a9fd4" : "rgba(255,255,255,0.25)";

  const filteredCourses = availableCourses.filter(c =>
    c.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
    c.city?.toLowerCase().includes(courseSearch.toLowerCase()) ||
    c.state?.toLowerCase().includes(courseSearch.toLowerCase())
  );

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
  };

  const handleSubmit = async () => {
    if (!selectedCourse || !selectedHole || !mediaFile) return;
    setUploading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("You must be logged in to upload."); setUploading(false); return; }

      const ext = mediaFile.name.split(".").pop();
      const bucket = mediaType === "VIDEO" ? "tour-it-videos" : "tour-it-photos";
      const filePath = `${user.id}/${selectedCourse.id}/${selectedHole}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, mediaFile, { cacheControl: "3600", upsert: false });

      if (uploadError) { setError("Upload failed. Please try again."); setUploading(false); return; }

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);

      const { data: holeData } = await supabase
        .from("Hole")
        .select("id")
        .eq("courseId", selectedCourse.id)
        .eq("holeNumber", selectedHole)
        .single();

      if (!holeData?.id) { setError("Hole not found. Please try again."); setUploading(false); return; }

      const { error: dbError } = await supabase.from("Upload").insert({
        id: crypto.randomUUID(),
        userId: user.id,
        courseId: selectedCourse.id,
        holeId: holeData.id,
        mediaType: mediaType,
        mediaUrl: publicUrl,
        teeBoxId: null,
        shotType: intel.shotType || null,
        clubUsed: intel.club || null,
        windCondition: intel.wind || null,
        strategyNote: intel.strategy || null,
        landingZoneNote: intel.landingZone || null,
        whatCameraDoesntShow: intel.hidden || null,
        handicapRange: intel.handicap || null,
        datePlayedAt: intel.datePlayed ? new Date(intel.datePlayed).toISOString() : null,
        rankScore: intelPct,
        moderationStatus: "PENDING",
        likeCount: 0,
        commentCount: 0,
        viewCount: 0,
        saveCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (dbError) { console.error("DB error:", dbError.message); setError("Failed to save upload. Please try again."); setUploading(false); return; }

      setSubmitted(true);
    } catch (err) {
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
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900&family=Outfit:wght@300;400;500;600&display=swap'); *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
        <div style={{ textAlign: "center", maxWidth: "360px" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 10 }}>Clip uploaded!</h1>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 300, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 28 }}>
            Your intel for <strong style={{ color: "rgba(255,255,255,0.7)" }}>{selectedCourse?.name} — Hole {selectedHole}</strong> is under review and will go live shortly.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => { setStep(preselectedCourseId ? 2 : 1); setSelectedHole(null); setMediaFile(null); setMediaPreview(null); setIntel({ tee: "", datePlayed: "", shotType: "", club: "", wind: "", strategy: "", landingZone: "", hidden: "", handicap: "" }); setSubmitted(false); }}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "10px 20px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
              Upload another
            </button>
            <button onClick={() => window.location.href = `/courses/${selectedCourse?.id}/holes/${selectedHole}`}
              style={{ background: "#2d7a42", border: "none", borderRadius: 99, padding: "10px 20px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
              View hole
            </button>
          </div>
        </div>
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
        .tee-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .divider { height: 1px; background: rgba(255,255,255,0.05); margin: 24px 0; }
        .btn-primary { width: 100%; background: #2d7a42; border: none; border-radius: 14px; padding: 15px; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 600; color: #fff; cursor: pointer; margin-bottom: 10px; transition: opacity 0.15s; }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 13px; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.5); cursor: pointer; }
        .error-box { background: rgba(220,60,60,0.1); border: 1px solid rgba(220,60,60,0.2); border-radius: 10px; padding: 12px 14px; font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(220,100,100,0.9); margin-bottom: 16px; }
      `}</style>

      <div className="upload-header">
        <button className="back-btn" onClick={() => {
          // If we came from a course page, go back — don't step back to course select
          if (step === 2 && preselectedCourseId) {
            window.history.back();
          } else if (step > 1) {
            setStep(step - 1);
          } else {
            window.history.back();
          }
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff" }}>
          {step === 1 ? "Select Course" : step === 2 ? "Select Hole" : step === 3 ? "Upload Clip" : step === 4 ? "Add Intel" : "Review"}
        </span>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(step / 5) * 100}%` }} />
      </div>

      <div className="upload-wrap">

        {/* Step 1 — Course */}
        {step === 1 && (
          <div className="anim">
            <p className="step-label">Step 1 of 5</p>
            <h1 className="step-title">Which course?</h1>
            <p className="step-sub">Search by name, city, or state.</p>
            <input className="search-input" placeholder="Search courses..." value={courseSearch} onChange={e => setCourseSearch(e.target.value)} autoFocus />
            {availableCourses.length === 0 && (
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 20 }}>Loading courses...</p>
            )}
            <div className="course-list">
              {filteredCourses.map(course => {
                const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
                return (
                  <button key={course.id} className={`course-item ${selectedCourse?.id === course.id ? "selected" : ""}`} onClick={() => { setSelectedCourse(course); setStep(2); }}>
                    <div className="course-abbr">{abbr}</div>
                    <div>
                      <div className="course-name-text">{course.name}</div>
                      <div className="course-location-text">{course.city}, {course.state}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2 — Hole */}
        {step === 2 && selectedCourse && (
          <div className="anim">
            <p className="step-label">Step 2 of 5</p>
            <h1 className="step-title">Which hole?</h1>
            <p className="step-sub">{selectedCourse.name}</p>
            <p className="nine-label">Front Nine</p>
            <div className="holes-grid">
              {frontNine.map(n => (
                <button key={n} className={`hole-btn ${selectedHole === n ? "selected" : ""}`} onClick={() => { setSelectedHole(n); setStep(3); }}>
                  <div className="hole-btn-num">{n}</div>
                </button>
              ))}
            </div>
            <p className="nine-label">Back Nine</p>
            <div className="holes-grid">
              {backNine.map(n => (
                <button key={n} className={`hole-btn ${selectedHole === n ? "selected" : ""}`} onClick={() => { setSelectedHole(n); setStep(3); }}>
                  <div className="hole-btn-num">{n}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 — Upload */}
        {step === 3 && (
          <div className="anim">
            <p className="step-label">Step 3 of 5</p>
            <h1 className="step-title">Upload your clip</h1>
            <p className="step-sub">{selectedCourse?.name} — Hole {selectedHole}</p>
            <input ref={fileInputRef} type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={handleFileSelect} />
            {mediaPreview ? (
              <>
                {mediaType === "VIDEO" ? (
                  <video src={mediaPreview} className="preview-video" controls playsInline />
                ) : (
                  <img src={mediaPreview} className="preview-img" alt="preview" />
                )}
                <button className="btn-secondary" style={{ marginBottom: 12 }} onClick={() => { setMediaFile(null); setMediaPreview(null); }}>
                  Choose different file
                </button>
                <button className="btn-primary" onClick={() => setStep(4)}>Looks good →</button>
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
                  <button key={w} className={`pill-option ${intel.wind === w ? "selected" : ""}`} onClick={() => setIntel({ ...intel, wind: intel.wind === w ? "" : w })}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="field-label">Your Handicap Range <span className="optional-tag">OPTIONAL</span></label>
              <div className="pill-row">
                {HANDICAP_RANGES.map(h => (
                  <button key={h} className={`pill-option ${intel.handicap === h ? "selected" : ""}`} onClick={() => setIntel({ ...intel, handicap: intel.handicap === h ? "" : h })}>
                    {h}
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
            <button className="btn-primary" onClick={() => setStep(5)}>Review & Submit</button>
          </div>
        )}

        {/* Step 5 — Review */}
        {step === 5 && selectedCourse && selectedHole && (
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
                  {intel.wind && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{intel.wind} wind</span>}
                  {intel.shotType && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{SHOT_TYPES.find(s => s.value === intel.shotType)?.label}</span>}
                  {intel.handicap && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{intel.handicap}</span>}
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
    </main>
  );
}

// useSearchParams requires a Suspense boundary
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
