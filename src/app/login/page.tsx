"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Only honor relative same-origin paths so a malicious referrer can't
// turn /login?next=https://evil.example into an open redirect after auth.
function safeRedirect(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ActionZone uses ?next= while /upload uses ?redirect= — accept both,
  // prefer next, and fall back to home so older entry points keep working.
  const redirectTarget = safeRedirect(
    searchParams.get("next") ?? searchParams.get("redirect")
  );

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  // Suppress the Google sign-in button when running inside Capacitor's
  // iOS/Android WebView. The web OAuth flow opens Google in Safari,
  // signs the user in there, and never returns to the app — so the
  // button presents a broken path on native. Tracked for proper fix
  // with @capacitor/browser + Universal Links; until then, native
  // users see email/password only.
  const [isNativeApp, setIsNativeApp] = useState(false);
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) setIsNativeApp(true);
  }, []);

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    const supabase = createClient();
    // Send Google users through /auth/callback so the same code path
    // that exchanges the OAuth code also handles first-time User row
    // provisioning + onboarding gating. After auth/callback finishes
    // it forwards to ?next, which here points at the home feed for
    // returning users; brand-new Google users get redirected to
    // /onboarding/profile inside auth/callback when no username is set.
    // Round-trip the redirect target through Supabase OAuth so the user
    // lands on the page they were trying to reach (e.g. /upload) instead
    // of always being dumped on the home feed.
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTarget)}` },
    });
    if (oauthError) {
      setError("Couldn't start Google sign-in. Please try again.");
      setLoading(false);
    }
    // signInWithOAuth navigates away from the page on success — no
    // need to handle the post-success path here.
  };

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
      // Surface the real Supabase error message instead of a generic string
      // so users (and us) can distinguish wrong-password from rate-limit /
      // outage / unconfirmed-email cases. Falls back to the generic copy
      // if Supabase returns no message.
      setError(loginError.message || "Invalid email or password. Please try again.");
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
        router.replace("/onboarding");
        return;
      }
    }

    router.replace(redirectTarget);
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
          color: rgba(255,255,255,0.55); text-decoration: none;
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
        .signup-link {
          text-align: center; font-family: 'Outfit', sans-serif;
          font-size: 13px; color: rgba(255,255,255,0.55);
        }
        .signup-link a {
          color: #4da862; text-decoration: none; font-weight: 500;
        }
        .signup-link a:hover { text-decoration: underline; }
      `}</style>

      <div className="bg-texture" />
      <div className="bg-glow" />

      <div className="card">
        <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 48, width: "auto", maxWidth: "100%", marginBottom: 4 }} />
        <p className="tagline">Scout every hole before you play it.</p>

        <h1 className="title">Welcome back</h1>
        <p className="subtitle">Log in to your Tour It account.</p>

        {error && <div className="error-box">{error}</div>}

        {/* Google sign-in — hidden on native iOS/Android until the
            Capacitor-aware OAuth flow lands (see isNativeApp comment). */}
        {!isNativeApp && (
          <>
            <button className="btn-google" onClick={handleGoogle} disabled={loading} type="button">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>

            <div className="or-divider">or</div>
          </>
        )}

        {/* Real <form> so iOS Password AutoFill recognizes this as a
            credential form and offers the "Use Saved Password" chip
            above the keyboard. The username + current-password
            autoComplete hints are what make iOS associate the saved
            credential with this field pair — without them the
            QuickType keyboard accessory never appears. */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
          autoComplete="on"
        >
          <div className="field">
            <label className="field-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="field-input"
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="login-password">Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="login-password"
                className="field-input"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingRight: 44, width: "100%", boxSizing: "border-box" }}
              />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(p => !p)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 6, cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          <div className="forgot">
            <a href="/forgot-password">Forgot password?</a>
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <div className="divider" />

        <div className="signup-link">
          Don&apos;t have an account? <a href="/signup">Sign up free</a>
        </div>
      </div>
    </main>
  );
}

// useSearchParams() forces the page into the client-side suspense
// boundary in App Router. Wrap the inner component so SSR doesn't bail
// out, and so prerender works for the /login route.
export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100dvh", background: "#07100a" }} />}>
      <LoginPageInner />
    </Suspense>
  );
}
