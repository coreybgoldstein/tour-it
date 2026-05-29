"use client";

// Scorecard-style cell for winner declarations and other "stat" tokens.
// Replaces the generic gold pill aesthetic used everywhere with print-
// scorecard typography: sharp 3px corners, italic Playfair small-caps
// label, hairline border, gold ink when declared, sage italic when not.
//
// The pin-flag glyph is a tiny green-stroke SVG (not the 🏆 emoji) so
// the cell still reads as "winner" without leaning on AI-app emoji
// language.
//
// Variants:
//   <ScorecardCell label="FRONT 9" meta="$25" value="Corey Goldstein"
//                  placeholder="Declare" onClick={...} />
//
// Designed to be dropped into rows of equal-width cells. Caller
// controls layout via flex / grid; this component only handles its
// own internal rhythm.

type Props = {
  label: string;
  meta?: string;
  value?: string;
  placeholder?: string;
  onClick?: (e: React.MouseEvent) => void;
  /** Override the declared-state ink color. Defaults to club-house gold. */
  declaredColor?: string;
};

export default function ScorecardCell({
  label,
  meta,
  value,
  placeholder = "Declare",
  onClick,
  declaredColor = "#d4a017",
}: Props) {
  const declared = !!value;
  return (
    <button
      onClick={onClick}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        padding: "7px 11px 9px",
        background: declared
          ? "rgba(212,160,23,0.06)"
          : "rgba(244,236,214,0.02)",
        border: declared
          ? `1px solid ${declaredColor}66`
          : "1px solid rgba(255,255,255,0.09)",
        borderRadius: 3,
        cursor: onClick ? "pointer" : "default",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(244,236,214,0.55)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
            minWidth: 0,
          }}
        >
          {label}
        </span>
        {meta && (
          <span
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(244,236,214,0.4)",
              letterSpacing: "0.02em",
              flexShrink: 0,
            }}
          >
            {meta}
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          marginTop: 2,
          minWidth: 0,
        }}
      >
        {declared && <PinFlag color={declaredColor} />}
        <span
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 13,
            fontWeight: declared ? 700 : 500,
            fontStyle: declared ? "normal" : "italic",
            color: declared ? declaredColor : "rgba(255,255,255,0.42)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
            flex: 1,
            letterSpacing: declared ? "-0.01em" : 0,
          }}
        >
          {value || placeholder}
        </span>
      </div>
    </button>
  );
}

// Custom pin-flag glyph — replaces 🏆 across declared-winner contexts.
// Tiny (10px) so it reads as a typographic accent rather than an icon.
function PinFlag({ color }: { color: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <line x1="6" y1="3" x2="6" y2="21" />
      <path d="M6 4 L17 7 L6 10 Z" fill={color} stroke="none" />
    </svg>
  );
}
