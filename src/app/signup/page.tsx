"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_STORAGE = "https://awlbxzpevwidowxxvuef.supabase.co/storage/v1/object/public/tour-it-photos";
const DEFAULT_AVATARS = [
  "01-coffee", "02-burger-happy", "03-golf-glove", "04-sunscreen", "05-rangefinder",
  "06-hotdog", "07-snack-bag", "08-golf-club", "09-burger-chill", "10-water-bottle",
  "11-burger-orange", "12-water-bottle-yellow", "13-bloody-mary", "14-grape-soda", "15-beer-can",
].map(n => `${SUPABASE_STORAGE}/default-avatars/${n}.png`);

const randomAvatar = () => DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];

export default function SignUpPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);

  const handleSignUp = async () => {
    setError("");
    setLoading(true);

    if (!email || !password || !username) {
      setError("All fields are required.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    if (username.length < 3) {
      setError("Username must be at least 3 characters.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // Step 1 — Create auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: username },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Step 2 — Insert User record into DB
    const userId = authData.user?.id;
    if (userId) {
      const now = new Date().toISOString();
      const { error: dbError } = await supabase.from("User").insert({
        id: userId,
        email: email,
        username: username,
        displayName: username,
        avatarUrl: randomAvatar(),
        createdAt: now,
        updatedAt: now,
      });

      if (dbError) {
        // Don't block signup if DB insert fails — log it but continue
        console.error("User DB insert error:", dbError.message);
      }
    }

    // If session is immediately available (email confirmation disabled), go straight to onboarding
    if (authData.session) {
      window.location.href = "/onboarding";
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .bg-texture {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: radial-gradient(rgba(255,255,255,0.012) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .bg-glow {
          position: fixed; top: -200px; left: 50%; transform: translateX(-50%);
          width: 700px; height: 500px; pointer-events: none; z-index: 0;
          background: radial-gradient(ellipse, rgba(56,140,76,0.12) 0%, transparent 68%);
        }
        .card {
          position: relative; z-index: 1;
          width: 100%; max-width: 420px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; padding: 36px 32px;
        }
        .logo {
          font-family: 'Playfair Display', serif;
          font-size: 24px; font-weight: 900; color: #fff;
          margin-bottom: 6px; display: flex; align-items: center; gap: 10px;
        }
        .logo-dot { width: 8px; height: 8px; border-radius: 50%; background: #4da862; }
        .tagline {
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 300;
          color: rgba(255,255,255,0.3); margin-bottom: 28px;
        }
        .title {
          font-family: 'Playfair Display', serif;
          font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 4px;
        }
        .subtitle {
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 300;
          color: rgba(255,255,255,0.35); margin-bottom: 24px;
        }
        .field { margin-bottom: 14px; }
        .field-label {
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(255,255,255,0.35); margin-bottom: 7px; display: block;
        }
        .field-input {
          width: 100%; background: rgba(255,255,255,0.04);
          border: 1.5px solid rgba(255,255,255,0.09); border-radius: 12px;
          padding: 13px 16px; font-family: 'Outfit', sans-serif;
          font-size: 14px; color: #fff; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .field-input::placeholder { color: rgba(255,255,255,0.2); }
        .field-input:focus {
          border-color: rgba(77,168,98,0.5);
          box-shadow: 0 0 0 3px rgba(77,168,98,0.08);
        }
        .error-box {
          background: rgba(200,80,80,0.1); border: 1px solid rgba(200,80,80,0.25);
          border-radius: 10px; padding: 10px 14px; margin-bottom: 16px;
          font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(240,120,120,0.9);
        }
        .success-box {
          background: rgba(77,168,98,0.1); border: 1px solid rgba(77,168,98,0.25);
          border-radius: 10px; padding: 16px; text-align: center;
        }
        .success-title {
          font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700;
          color: #fff; margin-bottom: 6px;
        }
        .success-sub {
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 300;
          color: rgba(255,255,255,0.4); line-height: 1.6;
        }
        .btn-submit {
          width: 100%; background: #2d7a42; border: none; cursor: pointer;
          font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600;
          color: #fff; padding: 14px; border-radius: 12px; margin-top: 6px;
          transition: background 0.15s, transform 0.1s;
        }
        .btn-submit:hover { background: #256936; }
        .btn-submit:active { transform: scale(0.99); }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .divider {
          height: 1px; margin: 22px 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
        }
        .login-link {
          text-align: center; font-family: 'Outfit', sans-serif;
          font-size: 13px; color: rgba(255,255,255,0.3);
        }
        .login-link a {
          color: #4da862; text-decoration: none; font-weight: 500;
        }
        .login-link a:hover { text-decoration: underline; }
      `}</style>

      <div className="bg-texture" />
      <div className="bg-glow" />

      <div className="card">
        <div className="logo">
          <div className="logo-dot" />
          Tour It
        </div>
        <p className="tagline">Scout every hole before you play it.</p>

        <h1 className="title">Create your account</h1>
        <p className="subtitle">Free forever. No credit card needed.</p>

        {error && <div className="error-box">{error}</div>}

        {success ? (
          <div className="success-box">
            <div style={{ fontSize: 32, marginBottom: 12 }}>⛳</div>
            <div className="success-title">Check your email</div>
            <p className="success-sub">
              We sent a confirmation link to <strong style={{ color: "rgba(255,255,255,0.7)" }}>{email}</strong>.<br />
              Click it to confirm your account, then come back here and log in.
            </p>
            <a href="/login" style={{ display: "block", marginTop: 20, background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", textDecoration: "none", textAlign: "center" }}>
              Go to Login →
            </a>
          </div>
        ) : (
          <>
            <div className="field">
              <label className="field-label">Username</label>
              <input
                className="field-input"
                type="text"
                placeholder="e.g. jgoldstein"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
              />
            </div>

            <div className="field">
              <label className="field-label">Email</label>
              <input
                className="field-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label">Password</label>
              <input
                className="field-input"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSignUp()}
              />
            </div>

            <button className="btn-submit" onClick={handleSignUp} disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>

            <div className="divider" />

            <div className="login-link">
              Already have an account? <a href="/login">Log in</a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
