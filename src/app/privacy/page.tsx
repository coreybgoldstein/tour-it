"use client";

import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100svh", background: "#07100a", color: "#fff", fontFamily: "'Outfit', sans-serif" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(7,16,10,0.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Privacy Policy</span>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Logo + intro */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", fontFamily: "'Playfair Display', serif", marginBottom: 8 }}>Tour It</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
            Last updated: April 2026
          </div>
          <div style={{ marginTop: 16, fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
            Tour It is a golf course scouting platform operated by Tour It. We built this for golfers, not advertisers. Here's exactly what we collect, why, and what we don't do with it.
          </div>
        </div>

        <Section title="What we collect">
          <Item label="Account info" value="Your email address and the username and profile details you choose to provide (display name, handicap, home course)." />
          <Item label="Uploaded content" value="Videos and photos you upload to the platform, including any metadata embedded in those files." />
          <Item label="GPS coordinates" value="When you upload a clip, we may extract GPS coordinates from the video or photo metadata to suggest the correct course and hole. These coordinates are stored with your clip to improve hole suggestions over time." />
          <Item label="Usage data" value="Basic interaction data (likes, comments, saves) to power the feed and course rankings." />
        </Section>

        <Section title="How we use it">
          <Item label="To run the platform" value="Your content and account info power the course scouting experience — the feed, course pages, hole grids, and scout notes." />
          <Item label="To improve hole suggestions" value="GPS data from uploads is used to refine which hole a clip belongs to, making the upload experience smarter over time." />
          <Item label="To send notifications" value="If you opt in, we may send push notifications for likes, comments, and follows." />
        </Section>

        <Section title="What we don't do">
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <span style={{ color: "#4da862", flexShrink: 0 }}>✓</span>
              <span>We do not sell your data to third parties.</span>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <span style={{ color: "#4da862", flexShrink: 0 }}>✓</span>
              <span>We do not use your data for ad targeting.</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ color: "#4da862", flexShrink: 0 }}>✓</span>
              <span>We do not share your personal information with other users without your consent.</span>
            </div>
          </div>
        </Section>

        <Section title="Infrastructure">
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
            Tour It is hosted on <span style={{ color: "rgba(255,255,255,0.85)" }}>Vercel</span> and uses <span style={{ color: "rgba(255,255,255,0.85)" }}>Supabase</span> for database storage and media storage. Both are industry-standard, SOC 2 compliant platforms. Your uploaded videos and photos are stored in Supabase Storage.
          </div>
        </Section>

        <Section title="Your rights">
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
            You can delete your clips and account at any time from your profile. If you want a copy of your data or have any other requests, contact us directly.
          </div>
        </Section>

        <Section title="Contact">
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
            Questions about privacy? Email us at{" "}
            <a href="mailto:corey@touritgolf.com" style={{ color: "#4da862", textDecoration: "none" }}>corey@touritgolf.com</a>
            . We'll respond within a few business days.
          </div>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.07)", fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
          © {new Date().getFullYear()} Tour It · touritgolf.com
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4da862", marginBottom: 14 }}>
        {title}
      </div>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{value}</div>
    </div>
  );
}
