"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!email.trim()) { setError("Please enter your email address."); return; }
    setLoading(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (resetError) {
      setError(resetError.message || "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
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
        {/* Logo */}
        <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 48, width: "auto", maxWidth: "100%", marginBottom: 20 }} />

        {sent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Check your email</div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 24 }}>
              We sent a password reset link to <strong style={{ color: "rgba(255,255,255,0.7)" }}>{email}</strong>. Click it to choose a new password.
            </p>
            <a href="/login" style={{ display: "block", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.5)", textDecoration: "none", textAlign: "center" }}>
              Back to login
            </a>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 8 }}>Reset your password</h1>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 28, lineHeight: 1.6 }}>
              Enter your email and we'll send you a link to reset your password.
            </p>

            {error && (
              <div style={{ background: "rgba(200,80,80,0.1)", border: "1px solid rgba(200,80,80,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(240,120,120,0.9)" }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 7 }}>Email</label>
              <input
                className="field-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
              />
            </div>

            <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </button>

            <div style={{ height: 1, margin: "22px 0", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }} />

            <div style={{ textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
              Remember it? <a href="/login" style={{ color: "#4da862", textDecoration: "none", fontWeight: 500 }}>Back to login</a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
