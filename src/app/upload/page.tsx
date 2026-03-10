"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const COURSES = [
  { id: "1",  name: "Pebble Beach Golf Links",    abbr: "PB",  color: "#1a4a6e", accent: "#4a9fd4", holes: 18 },
  { id: "2",  name: "Pinehurst No. 2",            abbr: "P2",  color: "#3d2b1a", accent: "#c8a96e", holes: 18 },
  { id: "3",  name: "Bandon Dunes",               abbr: "BD",  color: "#1a3a2a", accent: "#4da862", holes: 18 },
  { id: "4",  name: "TPC Scottsdale",             abbr: "TPC", color: "#3a1a10", accent: "#d4724a", holes: 18 },
  { id: "5",  name: "TPC Sawgrass",               abbr: "SAW", color: "#0e2a1a", accent: "#4ab870", holes: 18 },
  { id: "6",  name: "Kiawah Island Ocean Course", abbr: "KI",  color: "#0e2e3a", accent: "#4ab8d4", holes: 18 },
  { id: "7",  name: "Bethpage Black",             abbr: "BPB", color: "#1a1a1a", accent: "#888888", holes: 18 },
  { id: "8",  name: "Torrey Pines South",         abbr: "TP",  color: "#1a3020", accent: "#5db86a", holes: 18 },
  { id: "9",  name: "Augusta National",           abbr: "AN",  color: "#0d2e18", accent: "#2db84a", holes: 18 },
  { id: "10", name: "Whistling Straits",          abbr: "WS",  color: "#1a2a3a", accent: "#6a9fd4", holes: 18 },
];

const TEE_COLORS = ["Black", "Blue", "White", "Red", "Gold", "Green"];
const WIND_OPTIONS = ["Calm", "Into", "Downwind", "Left to Right", "Right to Left", "Moderate", "Strong"];
const SHOT_TYPES = ["Tee Shot", "Approach", "Layup", "Chip", "Pitch", "Bunker", "Full Hole", "Green Reading"];
const HANDICAP_RANGES = ["Scratch", "Low (1-9)", "Mid (10-18)", "High (19+)"];
const CLUBS = [
  { group: "Woods", options: ["Driver", "3-wood", "5-wood", "7-wood"] },
  { group: "Hybrids", options: ["2-hybrid", "3-hybrid", "4-hybrid", "5-hybrid"] },
  { group: "Irons", options: ["2-iron", "3-iron", "4-iron", "5-iron", "6-iron", "7-iron", "8-iron", "9-iron"] },
  { group: "Wedges", options: ["Pitching Wedge", "Gap Wedge", "Sand Wedge", "Lob Wedge"] },
  { group: "Other", options: ["Putter", "Chipper"] },
];

const INTEL_FIELDS = ["tee", "datePlayed", "club", "wind", "strategy", "landingZone", "hidden", "handicap"];

export default function UploadPage() {
  const [step, setStep] = useState(1);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = "/login?redirect=/upload";
      } else {
        setAuthChecked(true);
      }
    });
  }, []);

  const [selectedCourse, setSelectedCourse] = useState<typeof COURSES[0] | null>(null);
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

  // Intel score — how complete is this upload
  const intelScore = INTEL_FIELDS.filter(f => intel[f as keyof typeof intel]?.trim()).length;
  const intelPct = Math.round((intelScore / INTEL_FIELDS.length) * 100);
  const intelLabel = intelPct >= 80 ? "Elite Intel" : intelPct >= 50 ? "Good Intel" : intelPct >= 25 ? "Basic Intel" : "Minimal Intel";
  const intelColor = intelPct >= 80 ? "#4da862" : intelPct >= 50 ? "#c8a96e" : intelPct >= 25 ? "#6a9fd4" : "rgba(255,255,255,0.25)";

  const filteredCourses = COURSES.filter(c =>
    c.name.toLowerCase().includes(courseSearch.toLowerCase())
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

      // Save to database
      const { error: dbError } = await supabase.from("Upload").insert({
        userId: user.id,
        courseId: selectedCourse.id,
        holeId: `${selectedCourse.id}-${selectedHole}`,
        mediaType: mediaType,
        mediaUrl: publicUrl,
        teeColor: intel.tee || null,
        shotType: intel.shotType || null,
        clubUsed: intel.club || null,
        windCondition: intel.wind || null,
        strategyNote: intel.strategy || null,
        landingZoneNote: intel.landingZone || null,
        whatCameraDoesntShow: intel.hidden || null,
        handicapRange: intel.handicap || null,
        datePlayed: intel.datePlayed || null,
        rankScore: intelPct,
        moderationStatus: "PENDING",
      });

      if (dbError) console.error("DB error:", dbError);

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
            <button onClick={() => { setStep(1); setSelectedCourse(null); setSelectedHole(null); setMediaFile(null); setMediaPreview(null); setIntel({ tee: "", datePlayed: "", shotType: "", club: "", wind: "", strategy: "", landingZone: "", hidden: "", handicap: "" }); setSubmitted(false); }}
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

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .bg-texture { position: fixed; inset: 0; pointer-events: none; z-index: 0; background-image: radial-gradient(rgba(255,255,255,0.012) 1px, transparent 1px); background-size: 28px 28px; }
        .rel { position: relative; z-index: 1; }

        .nav { position: sticky; top: 0; z-index: 99; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: rgba(7,16,10,0.92); backdrop-filter: blur(18px); border-bottom: 1px solid rgba(255,255,255,0.055); }
        .nav-back { display: flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(255,255,255,0.45); transition: color 0.15s; }
        .nav-back:hover { color: rgba(255,255,255,0.8); }
        .nav-title { font-family: 'Playfair Display', serif; font-size: 17px; font-weight: 900; color: #fff; }

        .progress-bar { height: 2px; background: rgba(255,255,255,0.06); }
        .progress-fill { height: 2px; background: #4da862; transition: width 0.4s ease; }

        .page { max-width: 560px; margin: 0 auto; padding: 28px 20px 60px; }

        .step-label { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin-bottom: 8px; }
        .step-title { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 900; color: #fff; margin-bottom: 6px; }
        .step-sub { font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 300; color: rgba(255,255,255,0.35); margin-bottom: 24px; line-height: 1.6; }

        .search-box { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; }
        .search-input { background: none; border: none; outline: none; width: 100%; font-family: 'Outfit', sans-serif; font-size: 14px; color: #fff; }
        .search-input::placeholder { color: rgba(255,255,255,0.2); }

        .course-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; margin-bottom: 6px; background: rgba(255,255,255,0.025); }
        .course-item:hover { background: rgba(255,255,255,0.05); border-color: rgba(77,168,98,0.2); }
        .course-item.selected { background: rgba(77,168,98,0.08); border-color: rgba(77,168,98,0.4); }
        .course-logo { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-family: 'Playfair Display', serif; font-weight: 900; font-size: 12px; flex-shrink: 0; position: relative; overflow: hidden; }
        .course-logo-shimmer { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%); }
        .course-name-text { font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.85); }
        .check-icon { margin-left: auto; flex-shrink: 0; }

        .hole-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 24px; }
        .hole-btn { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 6px; cursor: pointer; text-align: center; transition: all 0.15s; }
        .hole-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(77,168,98,0.3); }
        .hole-btn.selected { background: rgba(77,168,98,0.12); border-color: rgba(77,168,98,0.5); }
        .hole-num { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 900; color: rgba(255,255,255,0.85); line-height: 1; }
        .hole-par-label { font-family: 'Outfit', sans-serif; font-size: 9px; color: rgba(255,255,255,0.3); margin-top: 2px; }

        .upload-zone { border: 2px dashed rgba(255,255,255,0.1); border-radius: 16px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.2s; margin-bottom: 16px; }
        .upload-zone:hover { border-color: rgba(77,168,98,0.4); background: rgba(77,168,98,0.04); }
        .upload-zone-title { font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.7); margin-bottom: 6px; }
        .upload-zone-sub { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 300; color: rgba(255,255,255,0.3); }

        .preview-wrap { border-radius: 14px; overflow: hidden; margin-bottom: 16px; position: relative; background: #000; }
        .preview-video { width: 100%; max-height: 280px; display: block; }
        .preview-photo { width: 100%; max-height: 280px; object-fit: cover; display: block; }
        .preview-change { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); border-radius: 99px; padding: 5px 12px; font-family: 'Outfit', sans-serif; font-size: 11px; color: #fff; cursor: pointer; backdrop-filter: blur(4px); }

        .intel-score-bar { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px 16px; margin-bottom: 20px; }
        .intel-score-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .intel-score-label { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 500; }
        .intel-score-pct { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 900; }
        .intel-bar-bg { height: 4px; background: rgba(255,255,255,0.06); border-radius: 99px; }
        .intel-bar-fill { height: 4px; border-radius: 99px; transition: width 0.3s ease; }
        .intel-hint { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 300; color: rgba(255,255,255,0.25); margin-top: 8px; }

        .field { margin-bottom: 14px; }
        .field-label { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 7px; display: flex; align-items: center; justify-content: space-between; }
        .optional-tag { font-size: 9px; color: rgba(255,255,255,0.2); letter-spacing: 0.08em; font-weight: 400; }
        .field-input { width: 100%; background: rgba(255,255,255,0.04); border: 1.5px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 11px 14px; font-family: 'Outfit', sans-serif; font-size: 14px; color: #fff; outline: none; transition: border-color 0.2s; }
        .field-input::placeholder { color: rgba(255,255,255,0.18); }
        .field-input:focus { border-color: rgba(77,168,98,0.4); }
        .field-textarea { width: 100%; background: rgba(255,255,255,0.04); border: 1.5px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 11px 14px; font-family: 'Outfit', sans-serif; font-size: 13px; color: #fff; outline: none; resize: none; line-height: 1.6; transition: border-color 0.2s; }
        .field-textarea::placeholder { color: rgba(255,255,255,0.18); }
        .field-textarea:focus { border-color: rgba(77,168,98,0.4); }

        .pill-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .pill-option { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 99px; padding: 6px 14px; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.45); transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
        .pill-option:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); }
        .pill-option.selected { background: rgba(77,168,98,0.1); border-color: rgba(77,168,98,0.4); color: #4da862; }
        .tee-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

        .btn-primary { width: 100%; background: #2d7a42; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600; color: #fff; padding: 15px; border-radius: 12px; transition: background 0.15s; margin-top: 8px; }
        .btn-primary:hover { background: #256936; }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-secondary { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.5); padding: 13px; border-radius: 12px; transition: all 0.15s; margin-top: 8px; }
        .btn-secondary:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }

        .error-box { background: rgba(200,80,80,0.1); border: 1px solid rgba(200,80,80,0.25); border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(240,120,120,0.9); }

        .divider { height: 1px; margin: 20px 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent); }

        @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .anim { animation: rise 0.35s ease both; }
      `}</style>

      <div className="bg-texture" />

      <div className="rel">
        <nav className="nav">
          <button className="nav-back" onClick={() => step > 1 ? setStep(step - 1) : window.location.href = "/"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            {step > 1 ? "Back" : "Cancel"}
          </button>
          <span className="nav-title">Upload Clip</span>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
            {step} of 5
          </span>
        </nav>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(step / 5) * 100}%` }} />
        </div>

        <div className="page">

          {/* Step 1 — Pick course */}
          {step === 1 && (
            <div className="anim">
              <p className="step-label">Step 1 of 5</p>
              <h1 className="step-title">Which course?</h1>
              <p className="step-sub">Search for the course you played.</p>

              <div className="search-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input className="search-input" type="text" placeholder="Search courses..." value={courseSearch} onChange={e => setCourseSearch(e.target.value)} />
              </div>

              {filteredCourses.map(course => (
                <div key={course.id} className={`course-item ${selectedCourse?.id === course.id ? "selected" : ""}`} onClick={() => setSelectedCourse(course)}>
                  <div className="course-logo" style={{ background: `linear-gradient(145deg, ${course.color}, ${course.color}dd)`, border: `1px solid ${course.accent}44` }}>
                    <div className="course-logo-shimmer" />
                    <span style={{ color: course.accent, position: "relative", zIndex: 1, fontSize: 11 }}>{course.abbr}</span>
                  </div>
                  <span className="course-name-text">{course.name}</span>
                  {selectedCourse?.id === course.id && (
                    <div className="check-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  )}
                </div>
              ))}

              <button className="btn-primary" disabled={!selectedCourse} onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          )}

          {/* Step 2 — Pick hole */}
          {step === 2 && selectedCourse && (
            <div className="anim">
              <p className="step-label">Step 2 of 5</p>
              <h1 className="step-title">Which hole?</h1>
              <p className="step-sub">Select the hole your clip is from.</p>

              <div className="hole-grid">
                {Array.from({ length: selectedCourse.holes }, (_, i) => i + 1).map(n => (
                  <button key={n} className={`hole-btn ${selectedHole === n ? "selected" : ""}`} onClick={() => setSelectedHole(n)}>
                    <div className="hole-num" style={{ color: selectedHole === n ? "#4da862" : "rgba(255,255,255,0.85)" }}>{n}</div>
                    <div className="hole-par-label">Hole</div>
                  </button>
                ))}
              </div>

              <button className="btn-primary" disabled={!selectedHole} onClick={() => setStep(3)}>
                Continue
              </button>
            </div>
          )}

          {/* Step 3 — Upload file */}
          {step === 3 && (
            <div className="anim">
              <p className="step-label">Step 3 of 5</p>
              <h1 className="step-title">Add your clip</h1>
              <p className="step-sub">Upload a video or photo from this hole.</p>

              {error && <div className="error-box">{error}</div>}

              {mediaPreview ? (
                <div className="preview-wrap">
                  {mediaType === "VIDEO"
                    ? <video className="preview-video" src={mediaPreview} controls />
                    : <img className="preview-photo" src={mediaPreview} alt="Preview" />
                  }
                  <button className="preview-change" onClick={() => { setMediaFile(null); setMediaPreview(null); setMediaType(null); }}>
                    Change
                  </button>
                </div>
              ) : (
                <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", display: "block" }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <p className="upload-zone-title">Tap to upload video or photo</p>
                  <p className="upload-zone-sub">MP4, MOV, JPG, PNG supported</p>
                </div>
              )}

              <input ref={fileInputRef} type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={handleFileSelect} />

              <button className="btn-primary" disabled={!mediaFile} onClick={() => setStep(4)}>
                Continue
              </button>
            </div>
          )}

          {/* Step 4 — Intel */}
          {step === 4 && (
            <div className="anim">
              <p className="step-label">Step 4 of 5</p>
              <h1 className="step-title">Add your intel</h1>
              <p className="step-sub">All fields optional — but more intel means higher ranking and more discovery.</p>

              {/* Intel score */}
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

              {/* Date played */}
              <div className="field">
                <label className="field-label">Date Played <span className="optional-tag">OPTIONAL</span></label>
                <input className="field-input" type="date" value={intel.datePlayed} onChange={e => setIntel({ ...intel, datePlayed: e.target.value })} style={{ colorScheme: "dark" }} />
              </div>

              {/* Tee color */}
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

              {/* Shot type */}
              <div className="field">
                <label className="field-label">Shot Type <span className="optional-tag">OPTIONAL</span></label>
                <div className="pill-row">
                  {SHOT_TYPES.map(s => (
                    <button key={s} className={`pill-option ${intel.shotType === s ? "selected" : ""}`} onClick={() => setIntel({ ...intel, shotType: intel.shotType === s ? "" : s })}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

{/* Club */}
<div className="field">
  <label className="field-label">Club Used <span className="optional-tag">OPTIONAL</span></label>
  <select
    className="field-input"
    value={intel.club}
    onChange={e => setIntel({ ...intel, club: e.target.value })}
    style={{ colorScheme: "dark", cursor: "pointer", background: "#0d1f12", color: "rgba(255,255,255,0.8)" }}
  >
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

              {/* Wind */}
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

              {/* Handicap */}
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

              {/* Strategy */}
              <div className="field">
                <label className="field-label" style={{ color: "#4da862" }}>Strategy Note <span className="optional-tag">OPTIONAL</span></label>
                <textarea className="field-textarea" rows={3} placeholder="What's the play? Where do you aim, what do you avoid..." value={intel.strategy} onChange={e => setIntel({ ...intel, strategy: e.target.value })} />
              </div>

              {/* Landing zone */}
              <div className="field">
                <label className="field-label" style={{ color: "rgba(100,160,220,0.8)" }}>Landing Zone <span className="optional-tag">OPTIONAL</span></label>
                <textarea className="field-textarea" rows={2} placeholder="Where should the ball land?" value={intel.landingZone} onChange={e => setIntel({ ...intel, landingZone: e.target.value })} />
              </div>

              {/* What camera doesn't show */}
              <div className="field">
                <label className="field-label" style={{ color: "rgba(210,175,80,0.7)" }}>What the Camera Doesn't Show <span className="optional-tag">OPTIONAL</span></label>
                <textarea className="field-textarea" rows={2} placeholder="Slopes, blind spots, elevation changes, tricky pin positions..." value={intel.hidden} onChange={e => setIntel({ ...intel, hidden: e.target.value })} />
              </div>

              <button className="btn-primary" onClick={() => setStep(5)}>
                Review & Submit
              </button>
            </div>
          )}

          {/* Step 5 — Review */}
          {step === 5 && selectedCourse && selectedHole && (
            <div className="anim">
              <p className="step-label">Step 5 of 5</p>
              <h1 className="step-title">Ready to submit?</h1>
              <p className="step-sub">Review your clip before it goes live.</p>

              {error && <div className="error-box">{error}</div>}

              {/* Summary card */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px 18px", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="course-logo" style={{ background: `linear-gradient(145deg, ${selectedCourse.color}, ${selectedCourse.color}dd)`, border: `1px solid ${selectedCourse.accent}44`, width: 44, height: 44, borderRadius: 11 }}>
                    <div className="course-logo-shimmer" />
                    <span style={{ color: selectedCourse.accent, position: "relative", zIndex: 1, fontSize: 11 }}>{selectedCourse.abbr}</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>{selectedCourse.name}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Hole {selectedHole} · {mediaType}</div>
                  </div>
                </div>

                {/* Intel score */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Intel Score</span>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 900, color: intelColor }}>{intelLabel} · {intelPct}%</span>
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
                  <div style={{ height: 3, borderRadius: 99, background: intelColor, width: `${intelPct}%` }} />
                </div>

                {/* Filled intel summary */}
                {(intel.tee || intel.datePlayed || intel.club || intel.wind || intel.shotType || intel.handicap) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
                    {intel.datePlayed && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{intel.datePlayed}</span>}
                    {intel.tee && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{intel.tee} tees</span>}
                    {intel.club && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{intel.club}</span>}
                    {intel.wind && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{intel.wind} wind</span>}
                    {intel.shotType && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{intel.shotType}</span>}
                    {intel.handicap && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{intel.handicap}</span>}
                  </div>
                )}
              </div>

              <button className="btn-primary" disabled={uploading} onClick={handleSubmit}>
                {uploading ? "Uploading..." : "Submit clip"}
              </button>
              <button className="btn-secondary" onClick={() => setStep(4)}>
                Edit intel
              </button>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
