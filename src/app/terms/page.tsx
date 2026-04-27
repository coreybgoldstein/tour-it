"use client";

import { useRouter } from "next/navigation";

export default function TermsPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100svh", background: "#07100a", color: "#fff", fontFamily: "'Outfit', sans-serif" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(7,16,10,0.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Terms of Service</span>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Intro */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", fontFamily: "'Playfair Display', serif", marginBottom: 8 }}>Tour It</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>Last updated: April 2026</div>
          <div style={{ marginTop: 16, fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
            These Terms of Service govern your use of Tour It, a golf course scouting platform operated by Tour It Golf. By creating an account or using the app, you agree to these terms.
          </div>
        </div>

        <Section title="The platform">
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
            Tour It lets golfers upload short video clips of golf holes and share course intel with other players. The platform is free to use and is supported by advertising.
          </div>
        </Section>

        <Section title="Your account">
          <Item label="Eligibility" value="You must be 13 years or older to use Tour It. By creating an account you confirm you meet this requirement." />
          <Item label="Accuracy" value="You agree to provide accurate information when creating your account. Impersonating another person or creating fake accounts is prohibited." />
          <Item label="Security" value="You are responsible for keeping your account credentials secure. Notify us immediately if you suspect unauthorized access." />
        </Section>

        <Section title="Your content">
          <Item label="Ownership" value="You own the clips and content you upload. Tour It does not claim ownership of your content." />
          <Item label="License to us" value="By uploading content, you grant Tour It a non-exclusive, worldwide, royalty-free license to display, distribute, and promote your content within the platform and in marketing materials for Tour It." />
          <Item label="Responsibility" value="You are solely responsible for the content you upload. By posting, you confirm you have the rights to share it." />
          <Item label="Removal" value="You can delete your content at any time from your profile. Tour It may also remove content that violates these terms." />
        </Section>

        <Section title="What's not allowed">
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>
            {[
              "Uploading content that is illegal, harassing, hateful, or sexually explicit",
              "Spam, bot activity, or automated scraping of the platform",
              "Uploading content you do not have the rights to share (e.g. copyrighted footage)",
              "Attempting to access accounts, systems, or data you are not authorized to access",
              "Misrepresenting which hole or course a clip belongs to intentionally",
            ].map((rule, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                <span style={{ color: "rgba(255,100,100,0.7)", flexShrink: 0 }}>✕</span>
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Advertising">
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
            Tour It is a free, ad-supported platform. By using the app, you agree that Tour It may display advertisements to you, including ads personalized based on how you use the platform — such as courses you browse, clips you watch, and your general location.{"\n\n"}
            <span style={{ display: "block", marginTop: 12 }}>
              We may share aggregated or anonymized usage data with advertising partners to measure ad performance and improve ad relevance. This data does not identify you by name. See our{" "}
              <a href="/privacy" style={{ color: "#4da862", textDecoration: "none" }}>Privacy Policy</a> for full details.
            </span>
          </div>
        </Section>

        <Section title="Termination">
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
            You can delete your account at any time from your profile settings. Tour It reserves the right to suspend or terminate accounts that violate these terms, with or without notice. Upon termination, your content may be removed from the platform.
          </div>
        </Section>

        <Section title="Disclaimer & liability">
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
            Tour It is provided "as is" without warranties of any kind. Course information and hole intel shared by users reflects their personal experience and may not be accurate or current. Always use your own judgment on the course.
            <span style={{ display: "block", marginTop: 12 }}>
              To the fullest extent permitted by law, Tour It is not liable for any damages arising from your use of the platform or reliance on user-generated content.
            </span>
          </div>
        </Section>

        <Section title="Changes to these terms">
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
            We may update these terms from time to time. If we make material changes, we'll notify you through the app. Continued use of Tour It after changes are posted constitutes your acceptance of the updated terms.
          </div>
        </Section>

        <Section title="Contact">
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
            Questions about these terms? Email us at{" "}
            <a href="mailto:corey@touritgolf.com" style={{ color: "#4da862", textDecoration: "none" }}>corey@touritgolf.com</a>.
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
