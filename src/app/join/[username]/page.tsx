import { createClient as createServiceClient } from "@supabase/supabase-js";
import JoinLanding from "./JoinLanding";

function serviceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function JoinPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const sb = serviceDb();

  const { data: inviter } = await sb
    .from("User")
    .select("id, username, displayName, avatarUrl")
    .eq("username", username)
    .maybeSingle();

  if (!inviter) {
    return (
      <main style={{ minHeight: "100svh", background: "#07100a", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", fontFamily: "'Outfit', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');`}</style>
        <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 48, marginBottom: 32 }} />
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, marginBottom: 12, textAlign: "center" }}>Scout Before You Play</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 32, lineHeight: 1.6, maxWidth: 300 }}>Real golfers. Real holes. Real intel for every course you play.</div>
        <a href="/signup" style={{ display: "block", background: "#2d7a42", borderRadius: 14, padding: "15px 40px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", textDecoration: "none", textAlign: "center", width: "100%", maxWidth: 320, boxSizing: "border-box" }}>Create Account</a>
        <a href="/" style={{ marginTop: 14, fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Browse first →</a>
      </main>
    );
  }

  return <JoinLanding inviterId={inviter.id} inviterUsername={inviter.username} inviterDisplayName={inviter.displayName} inviterAvatarUrl={inviter.avatarUrl} />;
}
