"use client";

// ClaimCourseSheet — bottom sheet shown when a user taps the small
// "Claim this course" CTA in the course header. Captures name, role,
// work email, optional note → POST /api/courses/[id]/claim. On 409
// we render the "Request submitted" confirmation state so a
// re-tapped sheet doesn't double-create.

import { useEffect, useState } from "react";

const ROLES = [
  "Head PGA Professional",
  "Director of Golf",
  "General Manager",
  "Owner",
  "Marketing Director",
  "Membership Director",
  "Other operator",
];

type Props = {
  courseId: string;
  courseName: string;
  open: boolean;
  onClose: () => void;
};

type Step = "form" | "submitting" | "submitted" | "already";

export default function ClaimCourseSheet({ courseId, courseName, open, onClose }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("form"); setName(""); setRole(ROLES[0]); setEmail(""); setNote(""); setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function submit() {
    setError(null);
    if (!name.trim() || !email.trim()) { setError("Name and work email required"); return; }
    setStep("submitting");
    const res = await fetch(`/api/courses/${courseId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claimantName: name.trim(),
        claimantRole: role,
        claimantEmail: email.trim(),
        verificationNote: note.trim() || null,
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) { setStep("submitted"); return; }
    if (res.status === 409) {
      setStep(data?.status === "VERIFIED" ? "already" : "submitted");
      return;
    }
    setError(data?.error || "Couldn't submit. Try again.");
    setStep("form");
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 250, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "40px 12px 0" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          // Sheet anchors to the bottom of the viewport and scrolls
          // internally when content exceeds the available height
          // (the previous version capped at content height but had
          // no overflow handler — so the Submit button could fall
          // below the screen edge on shorter phones once the
          // keyboard opened).
          maxHeight: "calc(100dvh - 40px)",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          background: "#0d2318",
          borderRadius: "16px 16px 0 0",
          padding: "18px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
          border: "1px solid rgba(77,168,98,0.25)",
          borderBottom: "none",
          boxShadow: "0 -10px 40px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 14px" }} />

        {step === "submitted" || step === "already" ? (
          <Confirm step={step} courseName={courseName} onClose={onClose} />
        ) : (
          <>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(126,200,140,0.95)", marginBottom: 4 }}>
              Course operator
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1.18, marginBottom: 6 }}>
              Claim {courseName}
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.45, marginBottom: 14 }}>
              Verify you work here and we&apos;ll give you a manager dashboard to edit official info, add staff cards, and link a tee sheet. We&apos;ll review and email you back.
            </div>

            <Field label="Your name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" style={inputStyle} />
            </Field>
            <Field label="Your role">
              <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Work email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@course.com" style={inputStyle} />
            </Field>
            <Field label="Anything else (optional)">
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="LinkedIn URL, course phone to verify, etc." style={{ ...inputStyle, resize: "vertical" as const, lineHeight: 1.4 }} />
            </Field>

            {error && (
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(220,100,100,0.95)", marginTop: 6 }}>{error}</div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button onClick={onClose} disabled={step === "submitting"} style={ghostBtn}>Cancel</button>
              <button onClick={submit} disabled={step === "submitting"} style={primaryBtn}>{step === "submitting" ? "Submitting…" : "Submit request"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Confirm({ step, courseName, onClose }: { step: "submitted" | "already"; courseName: string; onClose: () => void }) {
  const title = step === "submitted" ? "We'll verify and get back to you" : "You already manage this course";
  const body = step === "submitted"
    ? `Your request to claim ${courseName} is in the queue. We typically respond within 24 hours.`
    : "Your manager dashboard is already live.";
  return (
    <div style={{ textAlign: "center", padding: "8px 4px 4px" }}>
      <div style={{ width: 56, height: 56, margin: "0 auto 12px", borderRadius: "50%", background: "rgba(77,168,98,0.16)", border: "1px solid rgba(77,168,98,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      </div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 18 }}>{body}</div>
      <button onClick={onClose} style={primaryBtn}>Done</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 9,
  padding: "10px 12px",
  fontFamily: "'Outfit', sans-serif", fontSize: 13.5,
  color: "#fff", outline: "none",
};
const ghostBtn: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.85)", cursor: "pointer" };
const primaryBtn: React.CSSProperties = { background: "#2d7a42", border: "1px solid #4da862", borderRadius: 8, padding: "9px 18px", fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 700, color: "#fff", cursor: "pointer", letterSpacing: "0.02em" };
