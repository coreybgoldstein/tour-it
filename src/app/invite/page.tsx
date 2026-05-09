"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type Invite = {
  inviteeUsername: string | null;
  status: "PENDING" | "SIGNED_UP" | "FIRST_UPLOAD";
  signupAt: string | null;
  pointsEarned: number;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  SIGNED_UP: "Signed Up",
  FIRST_UPLOAD: "Posted a Clip",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "rgba(255,255,255,0.3)",
  SIGNED_UP: "rgba(77,168,98,0.7)",
  FIRST_UPLOAD: "#4da862",
};

function isMobile() {
  if (typeof navigator === "undefined") return true;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

export default function InvitePage() {
  const router = useRouter();
  const [inviteLink, setInviteLink] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [mobile, setMobile] = useState(true);

  useEffect(() => {
    setMobile(isMobile());

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      fetch("/api/invites/me")
        .then(r => r.json())
        .then(d => {
          setInviteLink(d.inviteLink ?? "");
          setTotalPoints(d.totalPointsEarned ?? 0);
          setInvites(d.invites ?? []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  }, [router]);

  const handleInviteSMS = () => {
    const text = `Hey, check out Tour It. It's a golf scouting app — real golfers posting hole-by-hole intel for courses before you play. Sign up with my link and you'll help me climb the leaderboard: ${inviteLink}`;
    window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <main style={{ minHeight: "100svh", background: "#07100a", color: "#fff", paddingBottom: 100 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ padding: "56px 20px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700 }}>Invite Friends</div>
      </div>

      <div style={{ padding: "0 20px" }}>
        {/* Hero copy */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, lineHeight: 1.25, marginBottom: 10 }}>
            Invite Friends.<br />Earn Points.
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.65 }}>
            50 pts when a friend signs up.<br />Another 25 when they post their first clip.
          </div>
        </div>

        {/* Primary action */}
        {mobile ? (
          <button
            onClick={handleInviteSMS}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", background: "#2d7a42", border: "none", borderRadius: 14, padding: "16px", fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff", cursor: "pointer", marginBottom: 14 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.06 6.06l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.9 16.92z"/></svg>
            Invite via Text
          </button>
        ) : null}

        {/* Copy link row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", marginBottom: 32 }}>
          <span style={{ flex: 1, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {inviteLink || "Loading..."}
          </span>
          <button
            onClick={handleCopy}
            style={{ flexShrink: 0, background: copied ? "rgba(77,168,98,0.2)" : "rgba(255,255,255,0.07)", border: `1px solid ${copied ? "rgba(77,168,98,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "6px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: copied ? "#4da862" : "rgba(255,255,255,0.6)", cursor: "pointer", transition: "all 0.15s" }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Points tally */}
        {totalPoints > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(77,168,98,0.06)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: 12, padding: "13px 16px", marginBottom: 28 }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Total earned from invites</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#4da862" }}>{totalPoints.toLocaleString()} pts</span>
          </div>
        )}

        {/* Invites list */}
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>
          Your Invites
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.3)", borderTopColor: "#4da862", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : invites.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>⛳</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
              No invites yet. Tap the button above and pull a friend in — bonus points if they actually post.
            </div>
          </div>
        ) : (
          <div>
            {invites.map((invite, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: i < invites.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: invite.inviteeUsername ? "#fff" : "rgba(255,255,255,0.35)", marginBottom: 3 }}>
                    {invite.inviteeUsername ? `@${invite.inviteeUsername}` : "Pending"}
                  </div>
                  <div style={{ display: "inline-block", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: STATUS_COLOR[invite.status], background: `${STATUS_COLOR[invite.status]}18`, border: `1px solid ${STATUS_COLOR[invite.status]}40`, borderRadius: 99, padding: "2px 8px" }}>
                    {STATUS_LABEL[invite.status]}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {invite.pointsEarned > 0 && (
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#4da862" }}>+{invite.pointsEarned}</div>
                  )}
                  {invite.signupAt && (
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
                      {new Date(invite.signupAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
