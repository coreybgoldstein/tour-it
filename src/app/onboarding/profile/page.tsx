"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_STORAGE = "https://awlbxzpevwidowxxvuef.supabase.co/storage/v1/object/public/tour-it-photos";

const DEFAULT_AVATARS = [
  "01-coffee", "02-burger-messy", "03-golf-glove", "04-sunscreen", "05-rangefinder",
  "06-hotdog", "07-protein-bar", "08-driver", "09-cheeseburger",
  "12-water-jug", "13-bloody-mary", "14-cocktail", "15-beer-can",
].map(name => `${SUPABASE_STORAGE}/default-avatars/${name}.png`);

const POINTS_EXAMPLES = [
  { label: "Sign up",                          pts: 50 },
  { label: "Complete your profile",            pts: 25 },
  { label: "Turn on notifications",            pts: 10 },
  { label: "Upload a clip",                    pts: 20 },
  { label: "First clip ever at a course",      pts: 100 },
  { label: "First clip for a specific hole",   pts: 50 },
  { label: "Upload a full-hole series",        pts: 30 },
  { label: "Add club + wind + strategy note",  pts: 20 },
  { label: "Add a course cover photo",         pts: 25 },
  { label: "Write a course description",       pts: 30 },
  { label: "Complete a course's full profile", pts: 50 },
  { label: "Like received on your clip",       pts: 2 },
  { label: "New follower",                     pts: 5 },
  { label: "4-week upload streak",             pts: 150 },
];


type Course = { id: string; name: string; city: string; state: string };

export default function OnboardingProfilePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [selectedDefault, setSelectedDefault] = useState<string | null>(null);

  const [noGhin, setNoGhin] = useState(false);
  const [handicapCustom, setHandicapCustom] = useState("");

  const [courseSearch, setCourseSearch] = useState("");
  const [courseResults, setCourseResults] = useState<Course[]>([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const [homeCourse, setHomeCourse] = useState<Course | null>(null);
  const [courseSearched, setCourseSearched] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [courseBgUrl, setCourseBgUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const TOTAL_STEPS = 4;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUserId(data.user.id);
      const { data: profile } = await supabase
        .from("User")
        .select("username, displayName, avatarUrl")
        .eq("id", data.user.id)
        .single();
      if (profile) {
        setUsername(profile.username || "");
        setDisplayName(profile.displayName || profile.username || "");
        if (profile.avatarUrl) setAvatarPreview(profile.avatarUrl);
      }
    });
    createClient()
      .from("Course")
      .select("coverImageUrl")
      .not("coverImageUrl", "is", null)
      .order("uploadCount", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { if (data?.coverImageUrl) setCourseBgUrl(data.coverImageUrl); });
  }, [router]);

  useEffect(() => {
    if (!courseSearch.trim()) { setCourseResults([]); setCourseSearched(false); return; }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    setCourseLoading(true);
    setCourseSearched(false);
    searchDebounce.current = setTimeout(async () => {
      const safe = courseSearch.replace(/[(),]/g, "");
      const { data } = await createClient()
        .from("Course")
        .select("id, name, city, state")
        .or(`name.ilike.%${safe}%,city.ilike.%${safe}%`)
        .eq("isPublic", true)
        .order("uploadCount", { ascending: false })
        .limit(10);
      setCourseResults(data || []);
      setCourseLoading(false);
      setCourseSearched(true);
    }, 280);
  }, [courseSearch]);

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setSelectedDefault(null);
  };

  const saveStep1 = async () => {
    if (!displayName.trim()) { setError("Please enter a display name."); return; }
    setError("");
    setSaving(true);
    const supabase = createClient();
    let avatarUrl: string | undefined;

    if (selectedDefault) {
      avatarUrl = selectedDefault;
    } else if (avatarFile) {
      setUploadingAvatar(true);
      const ext = avatarFile.name.split(".").pop();
      const path = `avatars/${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("tour-it-photos").upload(path, avatarFile, { upsert: true });
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(path);
        avatarUrl = publicUrl;
      }
      setUploadingAvatar(false);
    }

    const updates: Record<string, string> = { displayName: displayName.trim() };
    if (avatarUrl) updates.avatarUrl = avatarUrl;
    await supabase.from("User").update(updates).eq("id", userId);
    setSaving(false);
    setStep(2);
  };

  const saveStep2 = async () => {
    setSaving(true);
    const supabase = createClient();
    if (!noGhin && handicapCustom !== "") {
      const parsed = parseFloat(handicapCustom);
      if (!isNaN(parsed)) await supabase.from("User").update({ handicapIndex: parsed }).eq("id", userId);
    }
    setSaving(false);
    setStep(3);
  };

  const finish = async () => {
    setSaving(true);
    const supabase = createClient();
    if (homeCourse) {
      await supabase.from("User").update({ homeCourseId: homeCourse.id }).eq("id", userId);
    }
    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete_profile" }),
    }).catch(() => {});
    setSaving(false);
    const next = homeCourse ? `/courses/${homeCourse.id}` : null;
    router.push(`/onboarding/notifications${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  };

  const handleNext = () => {
    if (saving) return;
    if (step === 1) saveStep1();
    else if (step === 2) saveStep2();
    else if (step === 3) setStep(4);
    else if (step === 4) finish();
  };

  const nextLabel = () => {
    if (saving) return uploadingAvatar ? "Uploading photo..." : "Saving...";
    if (step === 4 && homeCourse) return `🚩 Let's go to ${homeCourse.name} →`;
    if (step === 4) return "Finish Setup ✓";
    return "Next →";
  };

  const nextDisabled = saving || (step === 1 && !displayName.trim());

  const progress = ((step - 1) / TOTAL_STEPS) * 100;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
        .ob-input { width: 100%; background: rgba(255,255,255,0.07); border: 1.5px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 14px 16px; font-family: 'Outfit', sans-serif; font-size: 15px; color: #fff; outline: none; transition: border-color 0.2s, background 0.2s; }
        .ob-input:focus { border-color: rgba(77,168,98,0.6); background: rgba(255,255,255,0.09); }
        .ob-input::placeholder { color: rgba(255,255,255,0.2); }
        .ob-label { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.55); display: block; margin-bottom: 6px; }
        .course-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: background 0.1s; }
        .course-row:last-child { border-bottom: none; }
        .course-row:active { background: rgba(255,255,255,0.06); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Step 4 full-bleed background */}
      {step === 4 && courseBgUrl && (
        <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
          <img src={courseBgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,16,10,0.55) 0%, rgba(7,16,10,0.78) 40%, rgba(7,16,10,0.94) 75%, #07100a 100%)" }} />
        </div>
      )}

      {/* Scrollable content */}
      <main style={{ position: "relative", zIndex: 1, minHeight: "100svh", color: "#fff", padding: "0 20px", paddingBottom: 160 }}>

        {/* Header */}
        <div style={{ maxWidth: 480, margin: "0 auto", paddingTop: 52, paddingBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 34, width: "auto" }} />
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)", padding: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                Back
              </button>
            )}
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden", marginBottom: 7 }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "#4da862", borderRadius: 99, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 28 }}>Step {step} of {TOTAL_STEPS}</div>
        </div>

        <div style={{ maxWidth: 480, margin: "0 auto" }}>

          {/* ── Step 1: Profile ── */}
          {step === 1 && (
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, lineHeight: 1.15, marginBottom: 6 }}>Let&apos;s set up<br />your profile</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24, lineHeight: 1.6 }}>{username ? `Welcome, @${username}. ` : ""}Tell the golf community who you are.</div>

              {/* Display name — first */}
              <div style={{ marginBottom: 24 }}>
                <label className="ob-label">Display Name *</label>
                <input className="ob-input" placeholder="Your name or nickname" value={displayName} onChange={e => { setDisplayName(e.target.value); setError(""); }} autoFocus />
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>This is what other golfers see — can be your real name or a nickname.</div>
              </div>

              {/* Avatar */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>Choose your avatar</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 14 }}>
                  {DEFAULT_AVATARS.map(url => (
                    <div key={url} onClick={() => { setSelectedDefault(url); setAvatarPreview(url); setAvatarFile(null); }} style={{ aspectRatio: "1", borderRadius: "50%", overflow: "hidden", cursor: "pointer", border: selectedDefault === url ? "2.5px solid #4da862" : "2.5px solid rgba(255,255,255,0.08)", boxShadow: selectedDefault === url ? "0 0 0 1px rgba(77,168,98,0.4)" : "none", transition: "border-color 0.15s" }}>
                      <img src={url} alt="avatar option" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ))}
                </div>
                <button onClick={() => avatarInputRef.current?.click()} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "11px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.45)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  {avatarFile ? "Photo selected ✓" : "Or upload your own photo"}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarPick} style={{ display: "none" }} />
                {avatarPreview && selectedDefault && (
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", border: "2.5px solid #4da862" }}>
                      <img src={avatarPreview} alt="selected avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Game ── */}
          {step === 2 && (
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, lineHeight: 1.15, marginBottom: 6 }}>What&apos;s your<br />game like?</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 28, lineHeight: 1.6 }}>Helps us match you with relevant content. You can update this anytime.</div>

              {noGhin ? (
                <div style={{ background: "rgba(77,168,98,0.07)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: 14, padding: "18px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(77,168,98,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="19" r="2"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>No GHIN — playing for fun ✓</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Your clips still count toward your rank.</div>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <label className="ob-label">GHIN Handicap Index</label>
                  <input
                    className="ob-input"
                    type="number"
                    step="0.1"
                    min="0"
                    max="54"
                    placeholder="e.g. 12.4"
                    value={handicapCustom}
                    onChange={e => setHandicapCustom(e.target.value)}
                    autoFocus
                  />
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>Your official USGA handicap index, if you have one.</div>
                </div>
              )}

              <button
                onClick={() => { setNoGhin(v => !v); if (!noGhin) setHandicapCustom(""); }}
                style={{ background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)", cursor: "pointer", padding: "6px 0", textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                {noGhin ? "I do have a GHIN index →" : "I don't have a GHIN — and that's okay"}
              </button>
            </div>
          )}

          {/* ── Step 3: Points ── */}
          {step === 3 && (
            <div>
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(251,191,36,0.1)", border: "1.5px solid rgba(251,191,36,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>

              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, lineHeight: 1.15, marginBottom: 10 }}>Earn points,<br />rank up</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 8 }}>
                Golf course knowledge is built by golfers, for golfers. Tour It rewards you for every clip, scorecard, and data point you contribute — because your intel makes the platform more valuable for every golfer who tees it up next.
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 24 }}>
                We run <span style={{ color: "#fbbf24", fontWeight: 600 }}>monthly competitions</span> where the top contributors earn recognition and rewards. The more you add, the higher you climb — from <span style={{ color: "rgba(190,190,190,0.75)" }}>Caddie</span> all the way to <span style={{ color: "#fbbf24" }}>Legend</span>.
              </div>

              {/* Points breakdown */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
                <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
                  Ways to earn points
                </div>
                {POINTS_EXAMPLES.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: i < POINTS_EXAMPLES.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{item.label}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#4da862", flexShrink: 0, marginLeft: 12 }}>+{item.pts} pts</div>
                  </div>
                ))}
              </div>

              {/* Already earning nudge */}
              <div style={{ background: "rgba(77,168,98,0.07)", border: "1px solid rgba(77,168,98,0.18)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#4da862", marginBottom: 6, letterSpacing: "0.03em" }}>🚀 You&apos;re already earning</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.65 }}>
                  Signing up earned you <span style={{ color: "#fff", fontWeight: 600 }}>+50 pts</span>. Completing your profile gives you <span style={{ color: "#fff", fontWeight: 600 }}>+25 pts</span>. Turn on notifications at the end and pick up another <span style={{ color: "#fff", fontWeight: 600 }}>+10 pts</span>.
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Home Course ── */}
          {step === 4 && (
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 900, lineHeight: 1.15, marginBottom: 8, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>Where do you<br />call home?</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 28, lineHeight: 1.6 }}>Your home course shows on your profile with a flag badge. You can always change this later.</div>

              {homeCourse ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(77,168,98,0.12)", border: "1.5px solid rgba(77,168,98,0.4)", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(77,168,98,0.2)", border: "1px solid rgba(77,168,98,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 22 }}>🚩</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff" }}>{homeCourse.name}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{[homeCourse.city, homeCourse.state].filter(Boolean).join(", ")}</div>
                  </div>
                  <button onClick={() => { setHomeCourse(null); setCourseSearch(""); setCourseSearched(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 4, flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(77,168,98,0.35)", borderRadius: 14, padding: "13px 16px", marginBottom: 8 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input
                      value={courseSearch}
                      onChange={e => setCourseSearch(e.target.value)}
                      placeholder="Search by course name or city..."
                      style={{ background: "none", border: "none", outline: "none", flex: 1, fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff" }}
                      autoFocus
                    />
                    {courseLoading && <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.4)", borderTopColor: "#4da862", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />}
                  </div>

                  {courseResults.length > 0 && (
                    <div style={{ background: "rgba(10,25,16,0.96)", backdropFilter: "blur(12px)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: 12, overflow: "hidden", marginBottom: 8 }}>
                      {courseResults.map(c => (
                        <div key={c.id} className="course-row" onClick={() => { setHomeCourse(c); setCourseSearch(""); setCourseResults([]); }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(77,168,98,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: 16 }}>🚩</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{[c.city, c.state].filter(Boolean).join(", ")}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {courseSearched && courseResults.length === 0 && courseSearch.trim().length > 2 && (
                    <div style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>No courses found for &ldquo;{courseSearch}&rdquo;</div>
                      <a
                        href={`mailto:corey@touritgolf.com?subject=Add course: ${encodeURIComponent(courseSearch)}&body=Hi, I'd like to add ${encodeURIComponent(courseSearch)} to Tour It.`}
                        style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#4da862", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Request this course be added →
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Floating CTA */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        background: "linear-gradient(to top, #07100a 55%, rgba(7,16,10,0) 100%)",
        padding: "48px 20px 0",
        paddingBottom: "max(28px, calc(env(safe-area-inset-bottom) + 20px))",
      }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          {error && (
            <div style={{ background: "rgba(200,60,60,0.1)", border: "1px solid rgba(200,60,60,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(240,120,120,0.9)" }}>
              {error}
            </div>
          )}
          <button
            onClick={handleNext}
            disabled={nextDisabled}
            style={{
              width: "100%",
              background: nextDisabled ? "rgba(45,122,66,0.4)" : "#2d7a42",
              border: "none",
              borderRadius: 14,
              padding: "15px",
              fontFamily: "'Outfit', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              color: nextDisabled ? "rgba(255,255,255,0.4)" : "#fff",
              cursor: nextDisabled ? "not-allowed" : "pointer",
              boxShadow: nextDisabled ? "none" : "0 2px 16px rgba(45,122,66,0.35)",
              transition: "background 0.15s",
            }}
          >
            {nextLabel()}
          </button>
        </div>
      </div>
    </>
  );
}
