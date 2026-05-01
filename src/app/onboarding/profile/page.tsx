"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_STORAGE = "https://awlbxzpevwidowxxvuef.supabase.co/storage/v1/object/public/tour-it-photos";

const DEFAULT_AVATARS = [
  "01-coffee", "02-burger-messy", "03-golf-glove", "04-sunscreen", "05-rangefinder",
  "06-hotdog", "07-protein-bar", "08-driver", "09-cheeseburger",
  "11-hamburger", "12-water-jug", "13-bloody-mary", "14-cocktail", "15-beer-can",
].map(name => `${SUPABASE_STORAGE}/default-avatars/${name}.png`);

const HANDICAP_BUCKETS = [
  { label: "Scratch", sublabel: "0", value: 0 },
  { label: "Low", sublabel: "1–9", value: 5 },
  { label: "Mid", sublabel: "10–18", value: 14 },
  { label: "High", sublabel: "19–28", value: 23 },
  { label: "Bogey+", sublabel: "29+", value: 36 },
];

type Course = { id: string; name: string; city: string; state: string };

export default function OnboardingProfilePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [selectedDefault, setSelectedDefault] = useState<string | null>(null);

  const [handicapBucket, setHandicapBucket] = useState<number | null>(null);
  const [handicapCustom, setHandicapCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const [courseSearch, setCourseSearch] = useState("");
  const [courseResults, setCourseResults] = useState<Course[]>([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const [homeCourse, setHomeCourse] = useState<Course | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUserId(data.user.id);
      const { data: profile } = await supabase
        .from("User")
        .select("username, displayName, bio, avatarUrl")
        .eq("id", data.user.id)
        .single();
      if (profile) {
        setUsername(profile.username || "");
        setDisplayName(profile.displayName || profile.username || "");
        setBio(profile.bio || "");
        if (profile.avatarUrl) setAvatarPreview(profile.avatarUrl);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!courseSearch.trim()) { setCourseResults([]); return; }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    setCourseLoading(true);
    searchDebounce.current = setTimeout(async () => {
      const safeCourseSearch = courseSearch.replace(/[(),]/g, "");
      const { data } = await createClient()
        .from("Course")
        .select("id, name, city, state")
        .or(`name.ilike.%${safeCourseSearch}%,city.ilike.%${safeCourseSearch}%`)
        .order("uploadCount", { ascending: false })
        .limit(10);
      setCourseResults(data || []);
      setCourseLoading(false);
    }, 280);
  }, [courseSearch]);

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
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
    if (bio.trim()) updates.bio = bio.trim();
    if (avatarUrl) updates.avatarUrl = avatarUrl;

    await supabase.from("User").update(updates).eq("id", userId);
    setSaving(false);
    setStep(2);
  };

  const saveStep2 = async () => {
    setSaving(true);
    const supabase = createClient();
    let hval: number | null = null;
    if (useCustom && handicapCustom !== "") { const parsed = parseFloat(handicapCustom); if (!isNaN(parsed)) hval = parsed; }
    else if (handicapBucket !== null) hval = handicapBucket;
    if (hval !== null) await supabase.from("User").update({ handicapIndex: hval }).eq("id", userId);
    setSaving(false);
    setStep(3);
  };

  const finish = async (skip = false) => {
    setSaving(true);
    const supabase = createClient();
    if (!skip && homeCourse) {
      await supabase.from("User").update({ homeCourseId: homeCourse.id }).eq("id", userId);
    }
    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete_profile" }),
    }).catch(() => {});
    setSaving(false);
    router.push("/onboarding/notifications");
  };

  const progress = ((step - 1) / 3) * 100;

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "0 20px 40px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
        .ob-input { width: 100%; background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 13px 16px; font-family: 'Outfit', sans-serif; font-size: 14px; color: #fff; outline: none; transition: border-color 0.2s; }
        .ob-input:focus { border-color: rgba(77,168,98,0.5); }
        .ob-input::placeholder { color: rgba(255,255,255,0.2); }
        .ob-label { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.65); display: block; margin-bottom: 6px; }
        .btn-primary { width: 100%; background: #2d7a42; border: none; border-radius: 14px; padding: 15px; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700; color: #fff; cursor: pointer; box-shadow: 0 2px 16px rgba(45,122,66,0.35); transition: background 0.15s; }
        .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
        .btn-ghost { width: 100%; background: transparent; border: none; padding: 13px; font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(255,255,255,0.55); cursor: pointer; }
        .course-row { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; }
        .course-row:last-child { border-bottom: none; }
        .course-row:active { opacity: 0.7; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 480, paddingTop: 52, paddingBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4da862" }} />
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff" }}>Tour It</span>
          </div>
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)", padding: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Back
            </button>
          )}
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "#4da862", borderRadius: 99, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 32 }}>Step {step} of 3</div>
      </div>

      <div style={{ width: "100%", maxWidth: 480 }}>

        {step === 1 && (
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 6 }}>Let&apos;s set up<br />your profile</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 32, lineHeight: 1.6 }}>{username ? `Welcome, @${username}. ` : ""}Tell the golf community who you are.</div>
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div style={{ position: "relative", width: 88, height: 88, borderRadius: "50%", background: avatarPreview ? "transparent" : "rgba(77,168,98,0.08)", border: avatarPreview ? "none" : "2px dashed rgba(77,168,98,0.3)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {avatarPreview ? <img src={avatarPreview} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                </div>
              </div>
              <button onClick={() => avatarInputRef.current?.click()} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "11px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.45)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 16 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                {avatarFile ? "Photo selected ✓" : "Upload your own photo instead"}
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={e => { handleAvatarPick(e); setSelectedDefault(null); }} style={{ display: "none" }} />
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", textAlign: "center", marginBottom: 12 }}>Or pick a character</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 0 }}>
                {DEFAULT_AVATARS.map((url) => (
                  <div key={url} onClick={() => { setSelectedDefault(url); setAvatarPreview(url); setAvatarFile(null); }} style={{ aspectRatio: "1", borderRadius: "50%", overflow: "hidden", cursor: "pointer", border: selectedDefault === url ? "2.5px solid #4da862" : "2.5px solid transparent", boxShadow: selectedDefault === url ? "0 0 0 1px rgba(77,168,98,0.4)" : "none", transition: "border-color 0.15s" }}>
                    <img src={url} alt="avatar option" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
              <div>
                <label className="ob-label">Display Name *</label>
                <input className="ob-input" placeholder="Your name or nickname" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 5 }}>This is what other golfers see — can be your real name or a nickname.</div>
              </div>
            </div>
            {error && <div style={{ background: "rgba(200,60,60,0.1)", border: "1px solid rgba(200,60,60,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(240,120,120,0.9)" }}>{error}</div>}
            <button className="btn-primary" onClick={saveStep1} disabled={saving || !displayName.trim()}>{saving ? (uploadingAvatar ? "Uploading photo..." : "Saving...") : "Next →"}</button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 6 }}>What&apos;s your<br />game like?</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 32, lineHeight: 1.6 }}>Helps us match you with relevant content. You can change this anytime.</div>
            <label className="ob-label" style={{ marginBottom: 12 }}>Skill Level</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 20 }}>
              {HANDICAP_BUCKETS.map(b => (
                <button key={b.value} onClick={() => { setHandicapBucket(b.value); setUseCustom(false); }} style={{ padding: "12px 4px", borderRadius: 12, border: `1.5px solid ${!useCustom && handicapBucket === b.value ? "rgba(77,168,98,0.6)" : "rgba(255,255,255,0.1)"}`, background: !useCustom && handicapBucket === b.value ? "rgba(77,168,98,0.15)" : "rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minHeight: 44 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: !useCustom && handicapBucket === b.value ? "#4da862" : "#fff" }}>{b.label}</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "#4da862" }}>{b.sublabel}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setUseCustom(c => !c)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: useCustom ? "#4da862" : "rgba(255,255,255,0.6)", marginBottom: 12, padding: 0, display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{useCustom ? <polyline points="20 6 9 17 4 12"/> : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}</svg>
              {useCustom ? "Using exact index" : "Enter exact handicap index"}
            </button>
            {useCustom && <div style={{ marginBottom: 20 }}><input className="ob-input" type="number" step="0.1" min="0" max="54" placeholder="e.g. 12.4" value={handicapCustom} onChange={e => setHandicapCustom(e.target.value)} style={{ width: 140 }} /></div>}
            <div style={{ marginTop: 8 }}>
              <button className="btn-primary" onClick={saveStep2} disabled={saving} style={{ marginBottom: 10 }}>{saving ? "Saving..." : "Next →"}</button>
              <button className="btn-ghost" onClick={() => setStep(3)}>Skip for now</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 6 }}>Where do you<br />call home?</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 32, lineHeight: 1.6 }}>Your home course shows on your profile. You can always skip this.</div>
            {homeCourse ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(77,168,98,0.1)", border: "1.5px solid rgba(77,168,98,0.4)", borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(77,168,98,0.2)", border: "1px solid rgba(77,168,98,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><line x1="12" y1="2" x2="12" y2="20" stroke="#4da862" strokeWidth="2" strokeLinecap="round"/><path d="M12 2 L19 6 L12 10 Z" fill="#4da862"/><ellipse cx="12" cy="21" rx="3.5" ry="1" stroke="#4da862" strokeWidth="1.5" fill="none"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{homeCourse.name}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{[homeCourse.city, homeCourse.state].filter(Boolean).join(", ")}</div>
                </div>
                <button onClick={() => { setHomeCourse(null); setCourseSearch(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(77,168,98,0.35)", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input value={courseSearch} onChange={e => setCourseSearch(e.target.value)} placeholder="Search by course name or city..." style={{ background: "none", border: "none", outline: "none", flex: 1, fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff" }} />
                  {courseLoading && <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.4)", borderTopColor: "#4da862", animation: "spin 0.6s linear infinite" }} />}
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                {courseResults.length > 0 && (
                  <div style={{ background: "rgba(13,35,24,0.98)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: 12, overflow: "hidden" }}>
                    {courseResults.map(c => (
                      <div key={c.id} className="course-row" style={{ padding: "12px 14px" }} onClick={() => { setHomeCourse(c); setCourseSearch(""); setCourseResults([]); }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(77,168,98,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="12" y1="2" x2="12" y2="18" stroke="#4da862" strokeWidth="2" strokeLinecap="round"/><path d="M12 2 L17 5 L12 8 Z" fill="#4da862"/></svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{[c.city, c.state].filter(Boolean).join(", ")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button className="btn-primary" onClick={() => finish(!homeCourse)} disabled={saving} style={{ marginBottom: 10 }}>{saving ? "Almost done..." : "Finish Setup ✓"}</button>
            <button className="btn-ghost" onClick={() => finish(true)}>Skip for now</button>
          </div>
        )}

      </div>
    </main>
  );
}
