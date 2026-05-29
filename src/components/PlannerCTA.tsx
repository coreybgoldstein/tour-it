"use client";

// PlannerCTA — the green "Plan your next round or trip" callout.
//
// This is Tour It's headline differentiator: tap once, hand off a few
// dates + a crew, get back a full multi-stop tour with the game
// already lined up. Per user request we want it visible everywhere
// people are likely to be in a "what's next?" mindset:
//   - Home (HomeTour: when the user has no active trip)
//   - /tour just under the search bar (the discovery surface)
//   - /tee-up Rounds footer (after browsing scheduled rounds)
//   - /tee-up Trips footer (after browsing scheduled trips)
//
// Two size variants. The "hero" is the home-screen full callout with
// headline + subtext + icon. The "compact" is the bar version used
// under the /tour search and at the bottom of /tee-up tabs — same
// gradient pill, single line of copy, smaller footprint so it
// doesn't dominate a content-heavy surface.

import { useRouter } from "next/navigation";

type Variant = "hero" | "compact";

export default function PlannerCTA({
  variant = "hero",
  href = "/tour?tab=trips",
  onClick,
}: {
  variant?: Variant;
  href?: string;
  onClick?: () => void;
}) {
  const router = useRouter();
  const handle = () => {
    if (onClick) onClick();
    else router.push(href);
  };

  if (variant === "compact") {
    return (
      <button
        onClick={handle}
        style={{
          width: "100%",
          padding: "12px 14px",
          background: "linear-gradient(135deg, rgba(45,122,66,0.95) 0%, rgba(77,168,98,0.82) 100%)",
          border: "1px solid rgba(77,168,98,0.55)",
          borderRadius: 14,
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "#fff",
          fontFamily: "'Outfit', sans-serif",
          boxShadow: "0 4px 12px rgba(45,122,66,0.18)",
        }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(7,16,10,0.45)", border: "1px solid rgba(244,236,214,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <SparkleIcon size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 15, lineHeight: 1.15 }}>
            Plan your next round or trip
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, lineHeight: 1.3, marginTop: 1 }}>
            Tell us your crew and dates. We&apos;ll line up the game.
          </div>
        </div>
        <ChevronRight />
      </button>
    );
  }

  return (
    <button
      onClick={handle}
      style={{
        width: "100%",
        padding: "18px 16px",
        background: "linear-gradient(135deg, rgba(45,122,66,0.95) 0%, rgba(77,168,98,0.82) 100%)",
        border: "1px solid rgba(77,168,98,0.55)",
        borderRadius: 16,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 14,
        color: "#fff",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(7,16,10,0.45)", border: "1px solid rgba(244,236,214,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <SparkleIcon size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 19, lineHeight: 1.15, marginBottom: 3 }}>
          Plan your next round or trip
        </div>
        <div style={{ fontSize: 12, opacity: 0.88, lineHeight: 1.4 }}>
          Tell us your crew and dates. We&apos;ll build the tour and line up the game.
        </div>
      </div>
      <ChevronRight />
    </button>
  );
}

function SparkleIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.85 }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
