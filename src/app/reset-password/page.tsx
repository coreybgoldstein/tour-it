"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Failed code exchange from callback route
    if (new URLSearchParams(window.location.search).get("invalid")) { setLinkInvalid(true); return; }

    // PKCE flow — Supabase sends ?code= in the URL query string
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setLinkInvalid(true);
        else setReady(true);
        // Clean the code from the URL bar
        window.history.replaceState({}, "", "/reset-password");
      });
      return;
    }

    // Hash-based flow — Supabase appends #access_token=...&type=recovery
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    const timeout = setTimeout(() => {
      if (!ready) setLinkInvalid(true);
    }, 6000);
    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  const handleReset = async () => {
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("Something went wrong. Please request a new reset link.");
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
    setTimeout(() => router.push("/"), 2500);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .bg-texture { position: fixed; inset: 0; pointer-events: none; z-index: 0; background-image: radial-gradient(rgba(255,255,255,0.012) 1px, transparent 1px); background-size: 28px 28px; }
        .bg-glow { position: fixed; top: -200px; left: 50%; transform: translateX(-50%); width: 700px; height: 500px; pointer-events: none; z-index: 0; background: radial-gradient(ellipse, rgba(56,140,76,0.12) 0%, transparent 68%); }
        .card { position: relative; z-index: 1; width: 100%; max-width: 420px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 36px 32px; }
        .field-input { width: 100%; background: rgba(255,255,255,0.04); border: 1.5px solid rgba(255,255,255,0.09); border-radius: 12px; padding: 13px 16px; font-family: 'Outfit', sans-serif; font-size: 14px; color: #fff; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        .field-input::placeholder { color: rgba(255,255,255,0.2); }
        .field-input:focus { border-color: rgba(77,168,98,0.5); box-shadow: 0 0 0 3px rgba(77,168,98,0.08); }
        .btn-submit { width: 100%; background: #2d7a42; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600; color: #fff; padding: 14px; border-radius: 12px; margin-top: 6px; transition: background 0.15s; }
        .btn-submit:hover { background: #256936; }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="bg-texture" />
      <div className="bg-glow" />

      <div className="card">
        <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 48, width: "auto", maxWidth: "100%", marginBottom: 20 }} />

        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Password updated</div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>Taking you home...</p>
          </div>
        ) : linkInvalid ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(200,80,80,0.1)", border: "1px solid rgba(200,80,80,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(240,120,120,0.9)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Link expired</div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 20 }}>This reset link is invalid or has expired.<br/>Request a new one and try again.</p>
            <a href="/forgot-password" style={{ display: "block", background: "#2d7a42", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", textDecoration: "none", textAlign: "center" }}>Request new link</a>
          </div>
        ) : !ready ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.3)", borderTopColor: "#4da862", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Verifying your link...</p>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 8 }}>Choose a new password</h1>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 28, lineHeight: 1.6 }}>
              Must be at least 8 characters.
            </p>

            {error && (
              <div style={{ background: "rgba(200,80,80,0.1)", border: "1px solid rgba(200,80,80,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(240,120,120,0.9)" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 7 }}>New password</label>
                <input className="field-input" type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div>
                <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 7 }}>Confirm password</label>
                <input className="field-input" type="password" placeholder="Same as above" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && handleReset()} />
              </div>
            </div>

            <button className="btn-submit" onClick={handleReset} disabled={loading}>
              {loading ? "Updating..." : "Update password"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
