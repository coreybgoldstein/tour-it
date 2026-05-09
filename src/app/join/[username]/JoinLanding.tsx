"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  inviterId: string;
  inviterUsername: string;
  inviterDisplayName: string;
  inviterAvatarUrl: string | null;
};

export default function JoinLanding({ inviterId, inviterUsername, inviterDisplayName, inviterAvatarUrl }: Props) {
  const router = useRouter();
  const cookieSet = useRef(false);

  useEffect(() => {
    if (cookieSet.current) return;
    cookieSet.current = true;
    fetch("/api/referral/set-cookie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviterId }),
    }).catch(() => {});
  }, [inviterId]);

  return (
    <main style={{ minHeight: "100svh", background: "#07100a", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
        .join-card { width: 100%; max-width: 360px; display: flex; flex-direction: column; align-items: center; }
        .btn-primary { display: block; width: 100%; background: #2d7a42; border: none; border-radius: 14px; padding: 16px; font-family: 'Outfit', sans-serif; font-size: 16px; font-weight: 700; color: #fff; text-align: center; text-decoration: none; cursor: pointer; transition: background 0.15s; }
        .btn-primary:hover { background: #256936; }
        .btn-secondary { display: block; margin-top: 14px; font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(255,255,255,0.4); text-decoration: none; text-align: center; }
        .btn-secondary:hover { color: rgba(255,255,255,0.65); }
      `}</style>

      <div className="join-card">
        {/* Logo */}
        <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 42, marginBottom: 36 }} />

        {/* Inviter avatar */}
        <div style={{ width: 84, height: 84, borderRadius: "50%", overflow: "hidden", border: "2.5px solid rgba(77,168,98,0.6)", background: "rgba(77,168,98,0.1)", marginBottom: 20, flexShrink: 0 }}>
          {inviterAvatarUrl
            ? <img src={inviterAvatarUrl} alt={inviterDisplayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
          }
        </div>

        {/* Invite text */}
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", textAlign: "center", marginBottom: 6 }}>
          @{inviterUsername} invited you
        </div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 28 }}>
          to join Tour It
        </div>

        {/* Divider line */}
        <div style={{ width: "100%", height: 1, background: "linear-gradient(90deg, transparent, rgba(77,168,98,0.25), transparent)", marginBottom: 28 }} />

        {/* Value prop */}
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#fff", textAlign: "center", marginBottom: 10 }}>
          Scout Before You Play
        </div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.65, marginBottom: 36, maxWidth: 280 }}>
          Real golfers share hole-by-hole intel for every course — club selection, wind conditions, strategy notes — before you tee off.
        </div>

        {/* CTAs */}
        <div style={{ width: "100%" }}>
          <a href="/signup" className="btn-primary">Sign Up — It's Free</a>
          <a href="/" className="btn-secondary">Browse first →</a>
        </div>
      </div>
    </main>
  );
}
