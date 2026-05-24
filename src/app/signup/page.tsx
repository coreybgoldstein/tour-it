"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_STORAGE = "https://awlbxzpevwidowxxvuef.supabase.co/storage/v1/object/public/tour-it-photos";
const DEFAULT_AVATARS = [
  "01-coffee", "02-burger-messy", "03-golf-glove", "04-sunscreen", "05-rangefinder",
  "06-hotdog", "07-protein-bar", "08-driver", "09-cheeseburger",
  "11-hamburger", "12-water-jug", "13-bloody-mary", "14-cocktail", "15-beer-can",
].map(n => `${SUPABASE_STORAGE}/default-avatars/${n}.png`);

const randomAvatar = () => DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];

export default function SignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);
  // Suppress Google sign-up inside the iOS/Android WebView until the
  // Capacitor-aware OAuth flow ships — web flow bounces out to Safari
  // and never returns to the app. Native users see email/password only.
  const [isNativeApp, setIsNativeApp] = useState(false);
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) setIsNativeApp(true);
  }, []);

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    });
    if (oauthError) {
      setError("Couldn't start Google sign-up. Please try again.");
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError("");
    setLoading(true);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!email || !password || !username || !trimmedFirst || !trimmedLast) {
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
    // displayName is now derived from first + last so the rest of the app
    // doesn't need to know about the split — every existing surface that
    // reads displayName still works without changes.
    const computedDisplayName = `${trimmedFirst} ${trimmedLast}`;

    // Step 1 — Create auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: computedDisplayName },
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
        firstName: trimmedFirst,
        lastName: trimmedLast,
        displayName: computedDisplayName,
        avatarUrl: randomAvatar(),
        createdAt: now,
        updatedAt: now,
      });

      if (dbError) {
        setError("Account created but profile setup failed. Please contact support.");
        setLoading(false);
        return;
      }

      fetch("/api/points/award", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "signup" }) }).catch(() => {});
      fetch("/api/referral/signup", { method: "POST" }).catch(() => {});
    }

    // With email confirmation disabled, session is returned immediately
    if (authData.session) {
      router.push("/onboarding");
      return;
    }

    // Fallback: email confirmation is on — show check-inbox message
    setSuccess(true);
    setLoading(false);
  };

  return (
    <main style={{ minHeight: "100dvh", background: "#07100a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
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
          color: rgba(255,255,255,0.55); margin-bottom: 28px;
        }
        .title {
          font-family: 'Playfair Display', serif;
          font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 4px;
        }
        .subtitle {
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 300;
          color: rgba(255,255,255,0.6); margin-bottom: 24px;
        }
        .field { margin-bottom: 14px; }
        .field-label {
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(255,255,255,0.65); margin-bottom: 7px; display: block;
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
          color: rgba(255,255,255,0.65); line-height: 1.6;
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
        .btn-google {
          width: 100%; background: #fff; border: 1px solid rgba(255,255,255,0.18);
          cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600;
          color: #1a1a1a; padding: 13px 16px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          transition: background 0.15s, transform 0.1s;
        }
        .btn-google:hover { background: #f3f4f6; }
        .btn-google:active { transform: scale(0.99); }
        .btn-google:disabled { opacity: 0.5; cursor: not-allowed; }
        .or-divider {
          display: flex; align-items: center; gap: 12px; margin: 18px 0;
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: rgba(255,255,255,0.3);
        }
        .or-divider::before, .or-divider::after {
          content: ""; flex: 1; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
        }
        .divider {
          height: 1px; margin: 22px 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
        }
        .login-link {
          text-align: center; font-family: 'Outfit', sans-serif;
          font-size: 13px; color: rgba(255,255,255,0.6);
        }
        .login-link a {
          color: #4da862; text-decoration: none; font-weight: 500;
        }
        .login-link a:hover { text-decoration: underline; }
      `}</style>

      <div className="bg-texture" />
      <div className="bg-glow" />

      <div className="card">
        <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 48, width: "auto", maxWidth: "100%", marginBottom: 4 }} />
        <p className="tagline">Scout every hole before you play it.</p>

        <h1 className="title">Create your account</h1>
        <p className="subtitle">Join the community. Start scouting.</p>

        {error && <div className="error-box">{error}</div>}

        {!success && !isNativeApp && (
          <>
            {/* Google sign-up — fastest path for first-time users on web.
                Hidden on native iOS/Android until the Capacitor-aware
                OAuth flow ships (web flow bounces out to Safari and
                never returns to the app). Collects username/firstName/
                lastName in onboarding after the OAuth callback lands. */}
            <button className="btn-google" onClick={handleGoogle} disabled={loading} type="button">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>
            <div className="or-divider">or sign up with email</div>
          </>
        )}

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
            <div className="field" style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="field-label">First name</label>
                <input
                  className="field-input"
                  type="text"
                  placeholder="Chris"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Last name</label>
                <input
                  className="field-input"
                  type="text"
                  placeholder="Berman"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label">Username</label>
              <input
                className="field-input"
                type="text"
                placeholder="e.g. boomer — not your email"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[\s@]/g, ""))}
              />
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 5 }}>Lowercase, no spaces — not your email</p>
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

            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", lineHeight: 1.6, marginTop: 4 }}>
              By creating an account you agree to our{" "}
              <a href="/terms" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}>Terms of Service</a>
              {" "}and{" "}
              <a href="/privacy" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}>Privacy Policy</a>.
            </div>

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
