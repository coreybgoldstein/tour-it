import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient as createServerSb } from "@/lib/supabase/server";
import { createClient as createAdminSb } from "@supabase/supabase-js";
import ActionZone from "./ActionZone";

type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  courseType: "PUBLIC" | "SEMI_PRIVATE" | "PRIVATE" | null;
  latitude: number | null;
  longitude: number | null;
};

type Stop = {
  id: string;
  day: number;
  order: number;
  note: string | null;
  course: Course;
};

type Itinerary = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  whyThisTrip: string;
  heroImageUrl: string | null;
  vibeTag: string;
  costBand: string;
  bestSeasonStart: number;
  bestSeasonEnd: number;
  durationDays: number;
  stayRec: string;
  latitude: number;
  longitude: number;
  region: string;
  stops: Stop[];
};

const SITE_URL = "https://touritgolf.com";

const BUDGET_RANGES: Record<string, { low: number; high: number; label: string }> = {
  "$$":   { low: 600,  high: 1000, label: "Budget-friendly" },
  "$$$":  { low: 1200, high: 2000, label: "Mid-range" },
  "$$$$": { low: 2500, high: 4500, label: "Bucket list spend" },
};

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function adminClient() {
  return createAdminSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function fetchItinerary(slug: string): Promise<Itinerary | null> {
  // Service-role client: itineraries are public-read content; this also avoids
  // any RLS surprises while still being server-only.
  const sb = adminClient();

  const { data: it, error: itErr } = await sb
    .from("TripItinerary")
    .select("id, slug, name, tagline, whyThisTrip, heroImageUrl, vibeTag, costBand, bestSeasonStart, bestSeasonEnd, durationDays, stayRec, latitude, longitude, region")
    .eq("slug", slug)
    .single();
  if (itErr || !it) return null;

  const { data: stops, error: stopsErr } = await sb
    .from("TripItineraryStop")
    .select("id, day, order, note, courseId")
    .eq("itineraryId", it.id)
    .order("day", { ascending: true })
    .order("order", { ascending: true });
  if (stopsErr) return null;

  const courseIds = (stops ?? []).map((s) => s.courseId);
  const { data: courses } = await sb
    .from("Course")
    .select("id, name, city, state, logoUrl, coverImageUrl, courseType, latitude, longitude")
    .in("id", courseIds);

  const courseById: Record<string, Course> = {};
  (courses ?? []).forEach((c) => (courseById[c.id] = c as Course));

  return {
    ...(it as Omit<Itinerary, "stops">),
    stops: (stops ?? []).map((s: any) => ({
      id: s.id,
      day: s.day,
      order: s.order,
      note: s.note,
      course: courseById[s.courseId],
    })),
  };
}

export async function generateStaticParams() {
  const sb = adminClient();
  const { data } = await sb.from("TripItinerary").select("slug");
  return (data ?? []).map((row) => ({ slug: row.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const it = await fetchItinerary(slug);
  if (!it) return { title: "Trip not found — Tour It" };
  return {
    title: `${it.name} — Tour It`,
    description: it.tagline,
    openGraph: {
      title: it.name,
      description: it.whyThisTrip.slice(0, 160),
      url: `${SITE_URL}/trip-ideas/${it.slug}`,
      type: "article",
    },
    twitter: { card: "summary_large_image", title: it.name, description: it.tagline },
  };
}

function formatSeason(start: number, end: number): string {
  if (start < 1 || start > 12 || end < 1 || end > 12) return "Year-round";
  return `${MONTH_SHORT[start - 1]} – ${MONTH_SHORT[end - 1]}`;
}

function humanCourseType(t: string | null): string {
  if (!t) return "Public";
  if (t === "PUBLIC") return "Public";
  if (t === "SEMI_PRIVATE") return "Semi-Private";
  if (t === "PRIVATE") return "Private";
  return t;
}

function vibeLabel(tag: string): string {
  return tag.replace(/_/g, " ");
}

function budgetSplit(band: string) {
  const r = BUDGET_RANGES[band];
  if (!r) return null;
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  return {
    label: r.label,
    greenFees: { low: r.low * 0.5, high: r.high * 0.5 },
    stay:      { low: r.low * 0.35, high: r.high * 0.35 },
    food:      { low: r.low * 0.15, high: r.high * 0.15 },
    total:     { low: r.low, high: r.high },
    fmt,
  };
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export const dynamicParams = true;

export default async function TripIdeaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const it = await fetchItinerary(slug);
  if (!it) notFound();

  // Auth check — used to wire the Save Trip CTA. Page renders fine without auth.
  const sb = await createServerSb();
  const { data: { user } } = await sb.auth.getUser();

  const seasonLabel = formatSeason(it.bestSeasonStart, it.bestSeasonEnd);
  const budget = budgetSplit(it.costBand);

  const sectionLabel: React.CSSProperties = {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#4da862",
  };
  const card: React.CSSProperties = {
    background: "#0e1a13",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 18,
  };
  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    fontFamily: "'Outfit', sans-serif",
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.85)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  };

  // Header: dramatic hero only when there's an actual image to show.
  // Otherwise render a compact header so the trip name is above the fold.
  const heroContent = (
    <>
      <span style={{
        display: "inline-block",
        padding: "4px 10px",
        border: "1px solid rgba(77,168,98,0.6)",
        borderRadius: 999,
        color: "#4da862",
        fontFamily: "'Outfit', sans-serif",
        fontSize: 10, fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        marginBottom: 14,
      }}>{vibeLabel(it.vibeTag)}</span>

      <h1 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: "clamp(32px, 7.5vw, 48px)",
        fontWeight: 700,
        lineHeight: 1.05,
        margin: 0,
        marginBottom: 10,
        color: "#fff",
      }}>{it.name}</h1>

      <p style={{
        fontFamily: "'Outfit', sans-serif",
        fontSize: 16,
        color: "rgba(255,255,255,0.7)",
        lineHeight: 1.4,
        margin: 0,
        marginBottom: 18,
        maxWidth: 540,
      }}>{it.tagline}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span style={pill}>{it.durationDays} {it.durationDays === 1 ? "Day" : "Days"}</span>
        <span style={pill}>{it.costBand}</span>
        <span style={pill}>{seasonLabel}</span>
      </div>
    </>
  );

  const backButton = (
    <Link
      href="/map"
      aria-label="Back"
      style={{
        position: "absolute",
        top: "max(env(safe-area-inset-top, 0px), 16px)", left: 16,
        width: 40, height: 40, borderRadius: "50%",
        background: "rgba(7,16,10,0.6)",
        border: "1px solid rgba(255,255,255,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        zIndex: 5,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </Link>
  );

  return (
    <div style={{ background: "#07100a", minHeight: "100svh", color: "#fff", paddingBottom: 120 }}>
      {it.heroImageUrl ? (
        // ── DRAMATIC HERO (when an image is set) ─────────────────────────
        <div style={{ position: "relative", height: "65svh", minHeight: 440, maxHeight: 620, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", inset: 0, background: `url('${it.heroImageUrl}') center/cover no-repeat` }} />
          <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(7,16,10,0.95) 100%)" }} />
          {backButton}
          <div style={{ position: "absolute", bottom: 28, left: 0, right: 0, padding: "0 20px", zIndex: 5 }}>
            {heroContent}
          </div>
        </div>
      ) : (
        // ── COMPACT HEADER (no image — name above the fold) ──────────────
        <header style={{
          position: "relative",
          padding: "max(env(safe-area-inset-top, 0px), 12px) 20px 26px",
          background: "radial-gradient(ellipse at 50% 0%, rgba(45,122,66,0.18) 0%, transparent 65%), #07100a",
        }}>
          {backButton}
          <div style={{ height: 56 }} aria-hidden />
          {heroContent}
        </header>
      )}

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: it.heroImageUrl ? "28px 16px 16px" : "10px 16px 16px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Why This Trip */}
        <section style={card}>
          <div style={{ ...sectionLabel, marginBottom: 12 }}>Why this trip</div>
          <p style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 15.5,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.7,
            margin: 0,
            whiteSpace: "pre-line",
          }}>{it.whyThisTrip}</p>
        </section>

        {/* Where to Stay */}
        <section style={card}>
          <div style={{ ...sectionLabel, marginBottom: 10 }}>Where to stay</div>
          <p style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 15,
            color: "#fff",
            lineHeight: 1.5,
            margin: 0,
          }}>{it.stayRec}</p>
          {/* BOOKING_COM_AFFILIATE_LINK — Phase 6 */}
        </section>

        {/* Day by Day */}
        <section>
          <div style={{ ...sectionLabel, marginBottom: 14, paddingLeft: 4 }}>The Itinerary</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {it.stops.map((s, idx) => (
              <div key={s.id}>
                {idx > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px 12px", marginTop: -2 }}>
                    <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, rgba(77,168,98,0.4), rgba(77,168,98,0))" }} />
                  </div>
                )}
                <div style={card}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      overflow: "hidden",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {s.course?.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.course.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                          <circle cx="12" cy="9" r="2.5"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: 10, fontWeight: 700, color: "#4da862",
                        textTransform: "uppercase", letterSpacing: "0.14em",
                        marginBottom: 4,
                      }}>Day {s.day}</div>
                      <div style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: 17, fontWeight: 600, color: "#fff", lineHeight: 1.25,
                      }}>{s.course?.name ?? "Course missing"}</div>
                      {s.course && (
                        <div style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: 12, color: "rgba(255,255,255,0.4)",
                          marginTop: 3,
                        }}>{s.course.city}, {s.course.state}</div>
                      )}
                    </div>
                    {s.course?.courseType && (
                      <span style={{
                        ...pill,
                        fontSize: 10,
                        padding: "3px 8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}>{humanCourseType(s.course.courseType)}</span>
                    )}
                  </div>

                  {s.note && (
                    <p style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontStyle: "italic",
                      fontSize: 14,
                      color: "rgba(255,255,255,0.6)",
                      lineHeight: 1.55,
                      margin: "14px 0 0",
                    }}>{s.note}</p>
                  )}

                  {/* GREEN_FEE_DATA — Phase 6 placeholder */}

                  {s.course && (
                    <Link
                      href={`/courses/${s.course.id}?from=trip-idea&slug=${encodeURIComponent(it.slug)}`}
                      style={{
                        display: "block",
                        marginTop: 14,
                        padding: "11px 14px",
                        textAlign: "center",
                        background: "transparent",
                        color: "#4da862",
                        border: "1px solid rgba(77,168,98,0.6)",
                        borderRadius: 10,
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >Scout This Course →</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Budget */}
        {budget && (
          <section style={card}>
            <div style={{ ...sectionLabel, marginBottom: 14 }}>What to budget</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <BudgetLine label="Green fees (est.)" lo={budget.greenFees.low} hi={budget.greenFees.high} fmt={budget.fmt} />
              <BudgetLine label="Stay (est.)" lo={budget.stay.low} hi={budget.stay.high} fmt={budget.fmt} />
              <BudgetLine label="Food & misc" lo={budget.food.low} hi={budget.food.high} fmt={budget.fmt} />
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 10, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>Total per person</span>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700, color: "#fff" }}>
                  {budget.fmt(budget.total.low)} – {budget.fmt(budget.total.high)}
                </span>
              </div>
            </div>
            <p style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 11, color: "rgba(255,255,255,0.4)",
              marginTop: 12, marginBottom: 0, lineHeight: 1.45,
            }}>Estimates based on peak season pricing. Actual costs vary.</p>
          </section>
        )}

        {/* Footer */}
        <footer style={{ marginTop: 8, paddingTop: 24, borderTop: "1px solid rgba(77,168,98,0.25)", textAlign: "center" }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.04em",
          }}>Tour It</div>
          <div style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 11,
            color: "rgba(255,255,255,0.3)", marginTop: 4,
            fontStyle: "italic",
          }}>Scout Before You Play</div>
          <div style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 10,
            color: "rgba(255,255,255,0.25)", marginTop: 16,
            textTransform: "uppercase", letterSpacing: "0.14em",
          }}>
            Thrown by golfers this month: {/* DART_THROW_COUNT — Phase 3B */} —
          </div>
        </footer>
      </div>

      {/* ── ACTION ZONE (sticky on mobile) ────────────────────────────────── */}
      <ActionZone
        itinerary={{
          id: it.id,
          slug: it.slug,
          name: it.name,
          tagline: it.tagline,
          durationDays: it.durationDays,
          costBand: it.costBand,
          heroImageUrl: it.heroImageUrl,
          stops: it.stops.map((s) => ({ courseId: s.course?.id, sortOrder: (s.day - 1) * 10 + s.order })),
        }}
        budgetRange={budget ? `${budget.fmt(budget.total.low)} – ${budget.fmt(budget.total.high)}` : null}
        siteUrl={SITE_URL}
        isAuthenticated={!!user}
      />
    </div>
  );
}

function BudgetLine({ label, lo, hi, fmt }: { label: string; lo: number; hi: number; fmt: (n: number) => string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0" }}>
      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{label}</span>
      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "#fff" }}>
        {fmt(lo)} – {fmt(hi)}
      </span>
    </div>
  );
}
