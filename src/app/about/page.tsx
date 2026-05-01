"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { RANK_COLORS, RANK_TIERS } from "@/config/points-system";
import BottomNav from "@/components/BottomNav";

const RANK_META: Record<string, { label: string; desc: string }> = {
  CADDIE:     { label: "Caddie",     desc: "Reading the book. Learning the course. Every great one started here." },
  LOCAL:      { label: "Local",      desc: "You know your home track inside out. People are starting to notice." },
  MARSHAL:    { label: "Marshal",    desc: "A fixture on the course. Your scouting covers real ground." },
  COURSE_PRO: { label: "Course Pro", desc: "You've gone deep on multiple tracks. The community counts on your intel." },
  TOUR_PRO:   { label: "Tour Pro",   desc: "Elite contributor. Your clips have reached players across the country." },
  LEGEND:     { label: "Legend",     desc: "The rarest rank on Tour It. You didn't just build a profile — you helped build the platform." },
};

function SectionDivider() {
  return (
    <div style={{ margin: "52px 0", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(77,168,98,0.18))" }} />
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(77,168,98,0.35)" }} />
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(77,168,98,0.18), transparent)" }} />
    </div>
  );
}

export default function AboutPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
      setAuthChecked(true);
      // TODO: fire to your analytics provider (e.g. Segment, PostHog, Amplitude)
      // analytics.track("about_page_viewed", { user_id: user?.id ?? null, is_logged_in: !!user });
      console.info("about_page_viewed", { user_id: user?.id ?? null, is_logged_in: !!user });
    });
  }, []);

  const isLoggedIn = !!userId;

  return (
    <main style={{
      minHeight: "100svh",
      background: "#07100a",
      color: "#fff",
      fontFamily: "'Outfit', sans-serif",
      paddingLeft: isDesktop ? 72 : 0,
      paddingBottom: 80,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Outfit:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* Sticky back header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(7,16,10,0.95)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 20px", display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={() => router.back()} style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.55)" }}>About Tour It</span>
      </div>

      {/* Hero — compact */}
      <div style={{
        position: "relative", width: "100%",
        background: "linear-gradient(175deg, #020c04 0%, #07180d 40%, #0d2e18 100%)",
        borderBottom: "1px solid rgba(77,168,98,0.12)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: isDesktop ? "36px 24px 32px" : "28px 24px 24px",
        gap: 10,
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 100%, rgba(45,122,66,0.14) 0%, transparent 65%)", pointerEvents: "none" }} />
        <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: isDesktop ? 48 : 38, width: "auto", position: "relative" }} />
        <p style={{
          fontFamily: "'Playfair Display', serif", fontStyle: "italic",
          fontSize: isDesktop ? 16 : 14, color: "#4da862",
          margin: 0, lineHeight: 1.4, letterSpacing: "0.01em", textAlign: "center", position: "relative",
        }}>
          Built for those who golf. By those who golf.
        </p>
      </div>

      {/* Reading column */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: isDesktop ? "44px 32px 0" : "32px 24px 0" }}>

        {/* Why I built Tour It — founder voice, leads the page */}
        <div style={{
          background: "rgba(26,158,66,0.04)",
          border: "1px solid rgba(77,168,98,0.1)",
          borderRadius: 16,
          padding: isDesktop ? "36px 36px" : "28px 24px",
          marginBottom: 0,
        }}>
          <h2 style={{
            fontFamily: "'Playfair Display', serif", fontStyle: "italic",
            fontSize: isDesktop ? 22 : 20, fontWeight: 700,
            color: "rgba(255,255,255,0.55)", margin: "0 0 28px", letterSpacing: "0.01em",
          }}>
            Why I built Tour It
          </h2>
          <p style={{ fontSize: isDesktop ? 16 : 15, lineHeight: 1.78, color: "rgba(255,255,255,0.72)", marginBottom: 20 }}>
            I&apos;ll never forget my first real golf trip. Kiawah Island. Three days, four courses, more golf in front of me than I knew what to do with. It was overwhelming in the best way possible.
          </p>
          <p style={{ fontSize: isDesktop ? 16 : 15, lineHeight: 1.78, color: "rgba(255,255,255,0.72)", marginBottom: 20 }}>
            In the weeks leading up to it, the only thing that scratched the itch was research. I wanted to know what my tee shots would look like. What kind of greens I&apos;d be putting on. The terrain, the wind, the holes that were going to test me. I watched every flyover I could find. I scrolled Instagram looking for clips. I pieced it together however I could.
          </p>
          <p style={{ fontSize: isDesktop ? 16 : 15, lineHeight: 1.78, color: "rgba(255,255,255,0.72)", marginBottom: 28 }}>
            But there was always a gap. Flyovers don&apos;t tell you where the trouble is. Instagram clips are scattered — you stumble onto something good, but half the time you don&apos;t even know what hole you&apos;re looking at, let alone the line or the wind. I kept thinking —
          </p>
          <blockquote style={{
            margin: "0 0 28px",
            padding: isDesktop ? "0 0 0 24px" : "0 0 0 18px",
            borderLeft: "3px solid rgba(77,168,98,0.5)",
          }}>
            <p style={{
              fontFamily: "'Playfair Display', serif", fontStyle: "italic",
              fontSize: isDesktop ? 19 : 17, lineHeight: 1.65,
              color: "rgba(255,255,255,0.88)", margin: 0,
            }}>
              &ldquo;Somewhere out there is a golfer who just played this hole. They know exactly what I want to know. Why can&apos;t I just see what they saw?&rdquo;
            </p>
          </blockquote>
          <p style={{ fontSize: isDesktop ? 16 : 15, lineHeight: 1.78, color: "rgba(255,255,255,0.72)", marginBottom: 20 }}>
            Tour It is the answer to that question. It&apos;s the tool I wanted before every trip, every new course, every round on a track I&apos;d never played.
          </p>
          <p style={{ fontSize: isDesktop ? 16 : 15, lineHeight: 1.78, color: "rgba(255,255,255,0.72)", marginBottom: 28 }}>
            If you&apos;ve ever felt that same itch — the night-before research, the group chat debates, the wanting to <em>see</em> a course before you play it — this is for you.
          </p>
          <p style={{
            fontFamily: "'Playfair Display', serif", fontSize: isDesktop ? 17 : 16,
            fontWeight: 700, color: "#4da862", margin: 0,
          }}>
            Welcome to the Tour It community.
          </p>
        </div>

        <SectionDivider />

        {/* Manifesto */}
        <p style={{ fontSize: isDesktop ? 17 : 16, lineHeight: 1.78, color: "rgba(255,255,255,0.82)", marginBottom: 22 }}>
          Golf is better when you know what&apos;s coming. The local member who&apos;s played the course a thousand times. The buddy who tells you to take one less club into 14. The regular who knows exactly where the green falls off. That kind of knowledge has always lived in the conversation between players — passed around the cart, shared over a beer after the round, dropped casually on the range.
        </p>
        <p style={{ fontSize: isDesktop ? 18 : 17, lineHeight: 1.7, color: "#fff", fontWeight: 600, marginBottom: 22 }}>
          Tour It is where that conversation lives now.
        </p>
        <p style={{ fontSize: isDesktop ? 17 : 16, lineHeight: 1.78, color: "rgba(255,255,255,0.82)", marginBottom: 22 }}>
          Search any course. Open any hole. See what real golfers saw — clips of the tee shot, the approach, the green, with notes on wind, lines, and what to know before you play. The kind of intel you&apos;d get from a buddy who played there last week, except the buddy is the entire community, and the course is anywhere.
        </p>
        <p style={{ fontSize: isDesktop ? 17 : 16, lineHeight: 1.78, color: "rgba(255,255,255,0.82)", marginBottom: 0 }}>
          We&apos;re what happens when you ask your buddy &ldquo;what club did you hit there?&rdquo; — except now you can ask anyone, about any hole, on any course. Scroll through tracks you&apos;ve never played. Fall down a rabbit hole on a course three states away. Screenshot something and text it to the group chat at 11pm. Build a trip with your crew, map out the courses, settle the debate. The best golf trips don&apos;t happen by accident. They happen because someone did their homework.
        </p>

        <SectionDivider />

        {/* The Community */}
        <div>
          <h2 style={{
            fontFamily: "'Playfair Display', serif", fontSize: isDesktop ? 26 : 22,
            fontWeight: 700, color: "#fff", margin: "0 0 24px",
          }}>
            The Community
          </h2>
          <p style={{ fontSize: isDesktop ? 17 : 16, lineHeight: 1.78, color: "rgba(255,255,255,0.82)", marginBottom: 22 }}>
            Tour It isn&apos;t a database we built. It&apos;s a database you&apos;re building.
          </p>
          <p style={{ fontSize: isDesktop ? 17 : 16, lineHeight: 1.78, color: "rgba(255,255,255,0.82)", marginBottom: 22 }}>
            Every clip is a piece of intel. Every hole scouted is a favor to a golfer you&apos;ll never meet. When you post that approach into 14 with the pin tucked back-left and wind off the water, you&apos;re not just sharing a video — you&apos;re helping someone show up a little more prepared.
          </p>
          <p style={{ fontSize: isDesktop ? 17 : 16, lineHeight: 1.78, color: "rgba(255,255,255,0.82)", marginBottom: 0 }}>
            The more you contribute, the better it gets for everyone. The more you contribute, the more the community recognizes it.
          </p>
        </div>

        <SectionDivider />

        {/* Earn your rank */}
        <div>
          <h2 style={{
            fontFamily: "'Playfair Display', serif", fontSize: isDesktop ? 26 : 22,
            fontWeight: 700, color: "#fff", margin: "0 0 8px",
          }}>
            Earn your rank
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", marginBottom: 36, fontStyle: "italic" }}>
            Six ranks. All of them worth chasing.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {RANK_TIERS.map((tier, i) => {
              const color = RANK_COLORS[tier.rank];
              const meta = RANK_META[tier.rank];
              const isLast = i === RANK_TIERS.length - 1;
              return (
                <div key={tier.rank} style={{
                  display: "flex", alignItems: "flex-start", gap: 20,
                  padding: "24px 0",
                  borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)",
                }}>
                  {/* Color bar + connector line */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}60`, flexShrink: 0 }} />
                    {!isLast && <div style={{ width: 1, flex: 1, minHeight: 24, background: `linear-gradient(180deg, ${color}40, transparent)`, marginTop: 6 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: "'Outfit', sans-serif", fontSize: isDesktop ? 17 : 16,
                      fontWeight: 700, color, marginBottom: 6, letterSpacing: "0.01em",
                    }}>
                      {meta.label}
                    </div>
                    <div style={{ fontSize: isDesktop ? 15 : 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                      {meta.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: isDesktop ? 16 : 15, lineHeight: 1.78, color: "rgba(255,255,255,0.65)", marginTop: 36, marginBottom: 0 }}>
            Points come from doing things that make Tour It better: uploading clips, scouting a hole, being the first to map a course nobody&apos;s touched. There are bonuses for milestones, for showing up consistently, for going somewhere nobody else has been yet.
          </p>
          <p style={{ fontSize: isDesktop ? 16 : 15, lineHeight: 1.78, color: "rgba(255,255,255,0.65)", marginTop: 16, marginBottom: 0 }}>
            Go explore. The system rewards the work.
          </p>
        </div>

        <SectionDivider />

        {/* CTA block */}
        {authChecked && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, paddingBottom: 8 }}>
            {isLoggedIn ? (
              <div style={{ display: "flex", gap: 12, width: "100%", flexWrap: "wrap" }}>
                <button
                  onClick={() => router.push("/upload")}
                  style={{
                    flex: 1, minWidth: 160, padding: "14px 20px",
                    background: "#2d7a42", border: "none", borderRadius: 12,
                    fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Upload your first clip
                </button>
                <button
                  onClick={() => router.push("/add-course")}
                  style={{
                    flex: 1, minWidth: 160, padding: "14px 20px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12,
                    fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)",
                    cursor: "pointer",
                  }}
                >
                  Add a course we&apos;re missing
                </button>
              </div>
            ) : (
              <button
                onClick={() => router.push("/signup")}
                style={{
                  width: "100%", maxWidth: 320, padding: "15px 24px",
                  background: "#2d7a42", border: "none", borderRadius: 12,
                  fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff",
                  cursor: "pointer",
                }}
              >
                Join the community
              </button>
            )}
          </div>
        )}

        {/* Signature */}
        <p style={{
          textAlign: "center", fontFamily: "'Outfit', sans-serif",
          fontSize: 12, color: "rgba(255,255,255,0.18)",
          marginTop: 48, marginBottom: 0, letterSpacing: "0.04em",
        }}>
          Tour It · Built by the golf community
        </p>

      </div>

      <BottomNav />
    </main>
  );
}
