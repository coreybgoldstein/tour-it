"use client";

/**
 * Onboarding — Identity screen.
 *
 * Rewritten 2026-05-25 per ONBOARDING_REWRITE_PLAN.md. Replaced the
 * legacy 4-step flow (display name → username → handicap → home
 * course → notifications) with a single screen that asks for just
 * first name + avatar. Everything else became a smart prompt that
 * fires when the user actually needs the value:
 *   - handicap → prompted when joining their first game
 *   - home course → prompted when they save their first course
 *   - notifications → prompted when their first piece of engagement
 *     arrives (a like, a comment, a follow, a hero tag)
 *
 * Goal: get the user to the home feed in <60 seconds. That's the
 * moment that pays off the rest of the app.
 *
 * Username is auto-derived from first name with a collision check.
 * Default avatar is one of the 14 system avatars assigned randomly;
 * the user can swap it for a different default or upload their own.
 *
 * Note: this route file stays at /onboarding/profile so the
 * existing /auth/callback redirect doesn't have to change.
 */

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_STORAGE = "https://awlbxzpevwidowxxvuef.supabase.co/storage/v1/object/public/tour-it-photos";

const DEFAULT_AVATARS = [
  "01-coffee", "02-burger-messy", "03-golf-glove", "04-sunscreen", "05-rangefinder",
  "06-hotdog", "07-protein-bar", "08-driver", "09-cheeseburger",
  "12-water-jug", "13-bloody-mary", "14-cocktail", "15-beer-can",
].map(name => `${SUPABASE_STORAGE}/default-avatars/${name}.png`);

// Slugify a first name into a candidate username. Lowercase, strips
// non-alphanumerics, caps length so we have room for a suffix on
// collision (e.g. "Corey" + "_999" still under the 20-char Supabase
// soft limit).
function nameToUsername(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned.slice(0, 16) || "golfer";
}

// 4-char alphanumeric tail used as last-resort collision suffix when
// _2 .. _99 are all taken (rare but cheap to handle).
function shortHash(): string {
  return Math.random().toString(36).slice(2, 6);
}

export default function OnboardingIdentityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Round-trip `next` through onboarding so post-signup deep links
  // (e.g. /login?next=/upload routed through signup) still land on
  // the user's intended page.
  const nextParam = searchParams.get("next") || searchParams.get("redirect") || "/";
  const safeNext = nextParam.startsWith("/") ? nextParam : "/";

  const [userId, setUserId] = useState("");
  const [firstName, setFirstName] = useState("");
  // Avatar state — either a Supabase storage URL (one of the default
  // PNGs or a previously-uploaded custom) or a fresh File to upload.
  const [avatarUrl, setAvatarUrl] = useState<string>(() => DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing profile so users who already have a name/avatar
  // don't lose it if they revisit the route (auth callback can
  // re-route through here on subsequent logins until `onboarded` is
  // set).
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace(`/login?next=${encodeURIComponent("/onboarding/profile")}`);
        return;
      }
      setUserId(data.user.id);
      const { data: profile } = await supabase
        .from("User")
        .select("firstName, displayName, avatarUrl, username")
        .eq("id", data.user.id)
        .single();
      if (profile) {
        // Username NOT NULL is the "already onboarded" signal — matches
        // what /auth/callback uses to decide whether to route here.
        // A real onboarded user landing here by mistake bounces back.
        if (profile.username) {
          router.replace(safeNext);
          return;
        }
        if (profile.firstName) setFirstName(profile.firstName);
        else if (profile.displayName) setFirstName(profile.displayName.split(" ")[0]);
        if (profile.avatarUrl) setAvatarUrl(profile.avatarUrl);
      }
    });
  }, [router, safeNext]);

  // Pick the first available username slug given a desired base.
  // Tries `base`, then `base2`..`base99`, then `base_xxxx`.
  async function pickAvailableUsername(base: string): Promise<string> {
    const supabase = createClient();
    const { data: takenBase } = await supabase.from("User").select("id").eq("username", base).maybeSingle();
    if (!takenBase) return base;
    for (let i = 2; i < 100; i++) {
      const candidate = `${base}${i}`;
      const { data: taken } = await supabase.from("User").select("id").eq("username", candidate).maybeSingle();
      if (!taken) return candidate;
    }
    return `${base}_${shortHash()}`;
  }

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setShowAvatarPicker(false);
  }

  async function handleSubmit() {
    if (!firstName.trim() || saving) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    let finalAvatarUrl = avatarUrl;

    // Upload custom avatar to storage if one was picked.
    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `avatars/${userId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("tour-it-photos").upload(path, avatarFile, { cacheControl: "31536000", upsert: true });
      if (upErr) {
        setError(`Couldn't upload avatar: ${upErr.message}`);
        setSaving(false);
        return;
      }
      finalAvatarUrl = supabase.storage.from("tour-it-photos").getPublicUrl(path).data.publicUrl;
    }

    // Auto-derive a unique username from the first name.
    const base = nameToUsername(firstName.trim());
    const username = await pickAvailableUsername(base);

    const trimmedName = firstName.trim();
    const { error: updErr } = await supabase
      .from("User")
      .update({
        firstName: trimmedName,
        displayName: trimmedName,
        username,
        avatarUrl: finalAvatarUrl,
        // No `onboarded` column on the User schema — the auth callback
        // and this page both treat `username NOT NULL` as the "already
        // onboarded" signal. Stamping username here flips that bit.
        updatedAt: new Date().toISOString(),
      })
      .eq("id", userId);
    if (updErr) {
      setError(updErr.message);
      setSaving(false);
      return;
    }

    // Fire-and-forget points awards. Combined into a single helper
    // would be cleaner — fine for tonight.
    fetch("/api/points/award", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete_profile" }) }).catch(() => {});

    router.replace(safeNext);
  }

  return (
    <main style={pageStyle}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600;700&display=swap');`}</style>

      <div style={{ maxWidth: 420, margin: "0 auto", padding: "24px 20px 80px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, paddingTop: 32 }}>
          <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 40, width: "auto" }} />
        </div>

        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 8, textAlign: "center" }}>
          You&apos;re in.
        </div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.55)", textAlign: "center", marginBottom: 36, lineHeight: 1.5 }}>
          Two taps and you&apos;re scouting.
        </div>

        {/* Avatar */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <button
            onClick={() => setShowAvatarPicker(true)}
            style={{ position: "relative", width: 112, height: 112, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(77,168,98,0.4)", background: "rgba(77,168,98,0.08)", cursor: "pointer", padding: 0 }}
            aria-label="Change avatar"
          >
            <img src={avatarPreview ?? avatarUrl} alt="Your avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderRadius: "50%", background: "#2d7a42", border: "3px solid #07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </div>
          </button>
        </div>

        {/* First name */}
        <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
          First name
        </label>
        <input
          autoFocus
          value={firstName}
          onChange={e => { setFirstName(e.target.value); setError(null); }}
          placeholder="Corey"
          autoCapitalize="words"
          style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "14px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "#fff", outline: "none", marginBottom: 24, boxSizing: "border-box" }}
        />

        {error && (
          <div style={{ background: "rgba(200,60,60,0.12)", border: "1px solid rgba(200,60,60,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,120,120,0.9)" }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!firstName.trim() || saving}
          style={{
            width: "100%",
            background: firstName.trim() && !saving ? "#2d7a42" : "rgba(77,168,98,0.25)",
            border: "none",
            borderRadius: 14,
            padding: "16px",
            fontFamily: "'Outfit', sans-serif",
            fontSize: 15,
            fontWeight: 700,
            color: "#fff",
            cursor: firstName.trim() && !saving ? "pointer" : "not-allowed",
            boxShadow: firstName.trim() && !saving ? "0 4px 16px rgba(45,122,66,0.4)" : "none",
          }}
        >
          {saving ? "Getting you in…" : "Get Started"}
        </button>

        <div style={{ marginTop: 18, fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", lineHeight: 1.5 }}>
          You can change your handicap, home course, and notifications anytime from your profile.
        </div>
      </div>

      {/* Avatar picker sheet — bottom sheet, defaults grid + upload */}
      {showAvatarPicker && (
        <div onClick={() => setShowAvatarPicker(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "#0d2318", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "1px solid rgba(255,255,255,0.08)", borderTop: "1px solid rgba(77,168,98,0.3)", padding: "12px 20px calc(28px + env(safe-area-inset-bottom))" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.14)", borderRadius: 99, margin: "0 auto 12px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 16 }}>Pick your look</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
              {DEFAULT_AVATARS.map(url => (
                <button
                  key={url}
                  onClick={() => { setAvatarUrl(url); setAvatarFile(null); setAvatarPreview(null); setShowAvatarPicker(false); }}
                  style={{ width: "100%", aspectRatio: "1", borderRadius: 12, overflow: "hidden", border: `2px solid ${avatarUrl === url && !avatarPreview ? "#4da862" : "transparent"}`, background: "rgba(77,168,98,0.08)", padding: 0, cursor: "pointer" }}
                >
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", cursor: "pointer" }}
            >
              Upload from photos
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarFile} style={{ display: "none" }} />
          </div>
        </div>
      )}
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100svh",
  background: "linear-gradient(180deg, #07100a 0%, #0d2318 100%)",
  color: "#fff",
  fontFamily: "'Outfit', sans-serif",
};
