"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("Please enter your email and password.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });

    if (loginError) {
      setError("Invalid email or password. Please try again.");
      setLoading(false);
      return;
    }

    // Check if user needs onboarding (displayName still equals username = never customized)
    const userId = loginData.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from("User")
        .select("username, displayName")
        .eq("id", userId)
        .single();
      if (profile && profile.displayName === profile.username) {
        window.location.href = "/onboarding";
        return;
      }
    }

    window.location.href = "/";
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
        .forgot {
          text-align: right; margin-top: -8px; margin-bottom: 14px;
        }
        .forgot a {
          font-family: 'Outfit', sans-serif; font-size: 12px;
          color: rgba(255,255,255,0.3); text-decoration: none;
          transition: color 0.15s;
        }
        .forgot a:hover { color: #4da862; }
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
        .signup-link {
          text-align: center; font-family: 'Outfit', sans-serif;
          font-size: 13px; color: rgba(255,255,255,0.3);
        }
        .signup-link a {
          color: #4da862; text-decoration: none; font-weight: 500;
        }
        .signup-link a:hover { text-decoration: underline; }
      `}</style>

      <div className="bg-texture" />
      <div className="bg-glow" />

      <div className="card">
        <div className="logo">
          <div className="logo-dot" />
          Tour It
        </div>
        <p className="tagline">Scout every hole before you play it.</p>

        <h1 className="title">Welcome back</h1>
        <p className="subtitle">Log in to your Tour It account.</p>

        {error && <div className="error-box">{error}</div>}

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
            placeholder="Your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />
        </div>

        <div className="forgot">
          <a href="/forgot-password">Forgot password?</a>
        </div>

        <button className="btn-submit" onClick={handleLogin} disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>

        <div className="divider" />

        <div className="signup-link">
          Don&apos;t have an account? <a href="/signup">Sign up free</a>
        </div>
      </div>
    </main>
  );
}
