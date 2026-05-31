"use client";

// /admin/claims — admin-only review queue for course operator claims.
// Lists PENDING claims first, with a domain-match hint between the
// claimant's work email and the course's existing websiteUrl. Admins
// can VERIFY (creates a CourseManager + flips Course.isClaimed=true)
// or REJECT with an optional reason.
//
// Pattern matches the existing /admin/courses, /admin/dashboard
// surfaces: client-side gate via User.isAdmin, no separate route
// guard, single API + page combo.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type Claim = {
  id: string;
  courseId: string;
  userId: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  claimantName: string;
  claimantRole: string;
  claimantEmail: string;
  verificationNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  domainMatchHint: boolean;
  course: { id: string; name: string; city: string; state: string; websiteUrl: string | null; isClaimed: boolean } | null;
  claimant: { id: string; username: string; displayName: string; avatarUrl: string | null } | null;
};

type Tab = "PENDING" | "VERIFIED" | "REJECTED";

export default function AdminClaimsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("PENDING");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (status: Tab) => {
    setLoading(true);
    const res = await fetch(`/api/admin/claims?status=${status}`);
    const data = await res.json();
    if (res.ok) setClaims(data.claims ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("User").select("isAdmin").eq("id", data.user.id).single();
      if (!profile?.isAdmin) { setUnauthorized(true); setLoading(false); return; }
      load(tab);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!unauthorized) load(tab);
  }, [tab, load, unauthorized]);

  async function verify(id: string) {
    if (busy) return;
    setBusy(id);
    const res = await fetch(`/api/admin/claims/${id}/verify`, { method: "POST" });
    if (res.ok) setClaims((prev) => prev.filter((c) => c.id !== id));
    else { const d = await res.json().catch(() => null); alert(d?.error || "Verify failed"); }
    setBusy(null);
  }

  async function reject(id: string) {
    if (busy) return;
    const reason = window.prompt("Reason for rejection (sent to claimant, optional):") ?? "";
    setBusy(id);
    const res = await fetch(`/api/admin/claims/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() || null }),
    });
    if (res.ok) setClaims((prev) => prev.filter((c) => c.id !== id));
    else { const d = await res.json().catch(() => null); alert(d?.error || "Reject failed"); }
    setBusy(null);
  }

  if (unauthorized) return (
    <div style={shellStyle}>
      <div style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Admin only.</div>
    </div>
  );

  return (
    <main style={{ minHeight: "100svh", background: "#07100a", color: "#fff", paddingBottom: 100, paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "16px 18px 40px" }}>
        <div style={{ marginBottom: 18 }}>
          <button onClick={() => router.push("/admin")} style={backBtn}>← Back to admin</button>
          <h1 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 28, fontWeight: 800, margin: "6px 0 4px" }}>Course claims</h1>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0 }}>
            Verify the human → create a CourseManager → flip Course.isClaimed.
          </p>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {(["PENDING", "VERIFIED", "REJECTED"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 14px",
                background: tab === t ? "rgba(77,168,98,0.18)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${tab === t ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 99,
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: tab === t ? "#4da862" : "rgba(255,255,255,0.55)",
                cursor: "pointer",
              }}
            >{t}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.35)", fontSize: 13, padding: "30px 0" }}>Loading…</div>
        ) : claims.length === 0 ? (
          <div style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.35)", fontSize: 13, padding: "30px 0", textAlign: "center" }}>
            No {tab.toLowerCase()} claims.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {claims.map((c) => (
              <ClaimCard
                key={c.id}
                claim={c}
                onVerify={() => verify(c.id)}
                onReject={() => reject(c.id)}
                busy={busy === c.id}
              />
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function ClaimCard({ claim, onVerify, onReject, busy }: { claim: Claim; onVerify: () => void; onReject: () => void; busy: boolean }) {
  const requestedAgo = new Date(claim.requestedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const isPending = claim.status === "PENDING";
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12,
      padding: 14,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 17, fontWeight: 700, color: "#fff", lineHeight: 1.15 }}>
            {claim.course?.name ?? "—"}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
            {claim.course ? `${claim.course.city}, ${claim.course.state}` : "Course missing"}
            {claim.course?.isClaimed && <span style={{ color: "#4da862", marginLeft: 8 }}>· Already claimed</span>}
          </div>
        </div>
        <span style={{
          padding: "3px 9px",
          borderRadius: 99,
          background: claim.domainMatchHint ? "rgba(77,168,98,0.18)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${claim.domainMatchHint ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.1)"}`,
          fontFamily: "'Inter', sans-serif",
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: claim.domainMatchHint ? "#4da862" : "rgba(255,255,255,0.5)",
          whiteSpace: "nowrap",
          alignSelf: "flex-start",
        }}>{claim.domainMatchHint ? "Domain match" : "No match"}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontFamily: "'Inter', sans-serif", fontSize: 12 }}>
        <Field label="Claimant" value={`${claim.claimantName} (${claim.claimantRole})`} />
        <Field label="Work email" value={claim.claimantEmail} mono />
        <Field label="Course website" value={claim.course?.websiteUrl || "—"} mono />
        <Field label="Tour It account" value={claim.claimant ? `@${claim.claimant.username}` : "—"} />
      </div>

      {claim.verificationNote && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 10px", fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.45 }}>
          <span style={{ color: "rgba(255,255,255,0.4)", marginRight: 6, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Note</span>
          {claim.verificationNote}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
          Requested {requestedAgo}
        </span>
        {isPending && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onReject} disabled={busy} style={dangerBtn}>Reject</button>
            <button onClick={onVerify} disabled={busy} style={primaryBtn}>{busy ? "…" : "Verify"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: mono ? "monospace" : "'Inter', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.82)", wordBreak: "break-word" }}>{value || "—"}</div>
    </div>
  );
}

const shellStyle: React.CSSProperties = { minHeight: "100svh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" };

const backBtn: React.CSSProperties = {
  background: "none", border: "none", padding: 0,
  color: "rgba(255,255,255,0.5)", cursor: "pointer",
  fontFamily: "'Inter', sans-serif", fontSize: 12,
};

const primaryBtn: React.CSSProperties = {
  background: "#2d7a42", border: "1px solid #4da862",
  borderRadius: 8, padding: "8px 16px",
  fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700,
  color: "#fff", cursor: "pointer", letterSpacing: "0.02em",
};

const dangerBtn: React.CSSProperties = {
  background: "rgba(200,60,60,0.12)", border: "1px solid rgba(200,60,60,0.35)",
  borderRadius: 8, padding: "8px 16px",
  fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600,
  color: "rgba(220,100,100,0.95)", cursor: "pointer", letterSpacing: "0.02em",
};
