"use client";

// FromTheCourseBlock — the OFFICIAL operator layer on a course page.
//
// Rendered ONLY when Course.isClaimed=true. Sits above the UGC clip
// feed but never replaces it. Contains:
//   - Eyebrow "From the course" label
//   - Official description (when set)
//   - Tee sheet button (when set)
//   - Staff cards row (PGA pros, GMs)
//
// Visually distinct from the rest of the page — a single bordered
// card with a subtle sage tint — so the user can immediately tell
// "this is the course speaking" vs the brand/UGC voice everywhere
// else.

import { useEffect, useState } from "react";
import { cdnImage } from "@/lib/cdnImage";

type Staff = {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
};

type Props = {
  courseId: string;
  officialDescription: string | null;
  teeSheetUrl: string | null;
  membershipInquiryUrl: string | null;
};

export default function FromTheCourseBlock({ courseId, officialDescription, teeSheetUrl, membershipInquiryUrl }: Props) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/courses/${courseId}/staff`);
      const data = await res.json().catch(() => null);
      if (cancelled) return;
      setStaff((data?.staff ?? []) as Staff[]);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [courseId]);

  const hasContent = !!officialDescription || !!teeSheetUrl || !!membershipInquiryUrl || staff.length > 0;
  // Render the block even if nothing's populated yet — but only when
  // the staff fetch has settled so we don't flash an empty card before
  // the data arrives.
  if (!loaded) return null;
  if (!hasContent) return null;

  return (
    <section style={{
      margin: "16px 16px 8px",
      padding: 16,
      background: "linear-gradient(160deg, rgba(77,168,98,0.08) 0%, rgba(77,168,98,0.02) 100%)",
      border: "1px solid rgba(126,200,140,0.22)",
      borderRadius: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <CourseGlyph />
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(126,200,140,0.95)" }}>
          From the course
        </span>
      </div>

      {officialDescription && (
        <p style={{ fontFamily: "'Source Serif 4', serif", fontSize: 14.5, lineHeight: 1.55, color: "rgba(255,255,255,0.86)", margin: "0 0 12px", whiteSpace: "pre-wrap" }}>
          {officialDescription}
        </p>
      )}

      {teeSheetUrl && (
        <a
          href={teeSheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 16px",
            background: "linear-gradient(180deg, #5cbd75 0%, #3f9554 100%)",
            border: "1px solid rgba(126,200,140,0.85)",
            borderRadius: 10,
            fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 800,
            color: "#0a1a10", textDecoration: "none",
            letterSpacing: "0.02em",
            marginBottom: staff.length > 0 || membershipInquiryUrl ? 10 : 0,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Book a tee time
        </a>
      )}

      {membershipInquiryUrl && (
        <a
          href={membershipInquiryUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 16px",
            background: "rgba(77,168,98,0.14)",
            border: "1px solid rgba(126,200,140,0.5)",
            borderRadius: 10,
            fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700,
            color: "#7ed28b", textDecoration: "none",
            letterSpacing: "0.02em",
            marginBottom: staff.length > 0 ? 14 : 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /><path d="M19 8v6" /><path d="M22 11h-6" />
          </svg>
          Inquire about membership
        </a>
      )}

      {staff.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {staff.map((s) => <StaffCard key={s.id} staff={s} />)}
        </div>
      )}
    </section>
  );
}

function StaffCard({ staff }: { staff: Staff }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 12, background: "rgba(7,16,10,0.55)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", background: "rgba(77,168,98,0.18)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid rgba(126,200,140,0.35)" }}>
        {staff.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cdnImage(staff.photoUrl)} alt={staff.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 800, color: "rgba(126,200,140,0.9)" }}>
            {(staff.name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join("") || "?").toUpperCase()}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{staff.name}</div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, fontWeight: 600, color: "rgba(126,200,140,0.95)", letterSpacing: "0.04em", marginTop: 2 }}>{staff.role}</div>
        {staff.bio && (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, margin: "6px 0 0" }}>
            {staff.bio}
          </p>
        )}
        {(staff.email || staff.phone) && (
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            {staff.email && <a href={`mailto:${staff.email}`} style={contactBtn}>✉ Email</a>}
            {staff.phone && <a href={`tel:${staff.phone}`} style={contactBtn}>☎ {staff.phone}</a>}
          </div>
        )}
      </div>
    </div>
  );
}

function CourseGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(126,200,140,0.95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" />
    </svg>
  );
}

const contactBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "5px 11px",
  background: "rgba(77,168,98,0.16)",
  border: "1px solid rgba(77,168,98,0.4)",
  borderRadius: 99,
  fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600,
  color: "#4da862", textDecoration: "none", letterSpacing: "0.01em",
};
