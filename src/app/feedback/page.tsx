"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const QUESTIONS = [
  { key: "whatsWorking",      label: "What's working well?",                          placeholder: "Things you enjoy or find useful…" },
  { key: "needsImprovement",  label: "What needs improvement?",                       placeholder: "Anything that feels off or could be better…" },
  { key: "bugs",              label: "Any bugs or issues?",                           placeholder: "Describe what happened and where…" },
  { key: "missingFeature",    label: "What feature would make this more valuable?",   placeholder: "Your top request…" },
];

export default function FeedbackPage() {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email ?? null);
      }
    });
  }, []);

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, ...answers, userId, userEmail }),
    });
    setSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <main style={{ minHeight: "100svh", background: "#07100a", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px", gap: 16, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700 }}>Thanks for the feedback</div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, maxWidth: 280 }}>
          Every response helps make Tour It better. We read all of it.
        </div>
        <button
          onClick={() => router.back()}
          style={{ marginTop: 8, padding: "12px 28px", background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.25)", borderRadius: 10, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#4da862", cursor: "pointer" }}
        >
          Back
        </button>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100svh", background: "#07100a", color: "#fff", fontFamily: "'Outfit', sans-serif", paddingBottom: 40 }}>
      <style>{`textarea::placeholder { color: rgba(255,255,255,0.25); } textarea { resize: none; }`}</style>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(7,16,10,0.95)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "calc(12px + env(safe-area-inset-top)) 20px 12px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.55)" }}>App Feedback</span>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 24px 0" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>Share your thoughts</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 36px", lineHeight: 1.6 }}>
          Honest takes only. This goes straight to the builder.
        </p>

        {/* Star rating */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginBottom: 14 }}>Overall experience</div>
          <div style={{ display: "flex", gap: 10 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 34, lineHeight: 1, transition: "transform 0.1s", transform: (hovered || rating) >= n ? "scale(1.15)" : "scale(1)" }}
              >
                <span style={{ color: (hovered || rating) >= n ? "#fbbf24" : "rgba(255,255,255,0.15)" }}>★</span>
              </button>
            ))}
          </div>
          {rating > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
              {["", "Not great", "Needs work", "Pretty good", "Really good", "Love it"][rating]}
            </div>
          )}
        </div>

        {/* Questions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {QUESTIONS.map(q => (
            <div key={q.key}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginBottom: 8 }}>
                {q.label}
              </label>
              <textarea
                value={answers[q.key] ?? ""}
                onChange={e => setAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                placeholder={q.placeholder}
                rows={3}
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 10, padding: "12px 14px", color: "#fff", fontFamily: "'Outfit', sans-serif",
                  fontSize: 14, lineHeight: 1.6, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!rating || submitting}
          style={{
            marginTop: 36, width: "100%", padding: "15px 0",
            background: rating ? "#2d7a42" : "rgba(255,255,255,0.06)",
            border: "none", borderRadius: 12,
            fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600,
            color: rating ? "#fff" : "rgba(255,255,255,0.25)",
            cursor: rating ? "pointer" : "not-allowed",
            transition: "background 0.2s",
          }}
        >
          {submitting ? "Sending…" : "Send Feedback"}
        </button>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 14 }}>
          Only the rating is required. All other fields are optional.
        </p>
      </div>
    </main>
  );
}
