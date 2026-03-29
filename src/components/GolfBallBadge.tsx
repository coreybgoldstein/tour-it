export function GolfBallBadge({
  label,
  isGold = false,
  id,
}: {
  label: string | number;
  isGold?: boolean;
  id: string;
}) {
  return (
    <svg width="22" height="22" viewBox="0 0 40 40">
      <defs>
        <radialGradient id={`bg-${id}`} cx="30%" cy="25%" r="70%">
          {isGold ? (
            <>
              <stop offset="0%" stopColor="#fef3c7" />
              <stop offset="50%" stopColor="#fcd34d" />
              <stop offset="85%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#f8f8f8" />
              <stop offset="85%" stopColor="#e8e8e8" />
              <stop offset="100%" stopColor="#d8d8d8" />
            </>
          )}
        </radialGradient>
        <radialGradient id={`dm-${id}`} cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor={isGold ? "rgba(120,53,15,0.05)" : "rgba(0,0,0,0.02)"} />
          <stop offset="100%" stopColor={isGold ? "rgba(120,53,15,0.15)" : "rgba(0,0,0,0.08)"} />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill={`url(#bg-${id})`} />
      <circle cx="20" cy="20" r="17.5" fill="none" stroke={isGold ? "rgba(180,83,9,0.3)" : "rgba(0,0,0,0.08)"} strokeWidth="0.5" />
      {/* Outer ring dimples */}
      <circle cx="20" cy="4"  r="2" fill={`url(#dm-${id})`} />
      <circle cx="30" cy="7"  r="2" fill={`url(#dm-${id})`} />
      <circle cx="36" cy="15" r="2" fill={`url(#dm-${id})`} />
      <circle cx="36" cy="25" r="2" fill={`url(#dm-${id})`} />
      <circle cx="30" cy="33" r="2" fill={`url(#dm-${id})`} />
      <circle cx="20" cy="36" r="2" fill={`url(#dm-${id})`} />
      <circle cx="10" cy="33" r="2" fill={`url(#dm-${id})`} />
      <circle cx="4"  cy="25" r="2" fill={`url(#dm-${id})`} />
      <circle cx="4"  cy="15" r="2" fill={`url(#dm-${id})`} />
      <circle cx="10" cy="7"  r="2" fill={`url(#dm-${id})`} />
      {/* Inner ring dimples */}
      <circle cx="20" cy="9"  r="1.5" fill={`url(#dm-${id})`} />
      <circle cx="28" cy="13" r="1.5" fill={`url(#dm-${id})`} />
      <circle cx="30" cy="22" r="1.5" fill={`url(#dm-${id})`} />
      <circle cx="25" cy="30" r="1.5" fill={`url(#dm-${id})`} />
      <circle cx="15" cy="30" r="1.5" fill={`url(#dm-${id})`} />
      <circle cx="10" cy="22" r="1.5" fill={`url(#dm-${id})`} />
      <circle cx="12" cy="13" r="1.5" fill={`url(#dm-${id})`} />
      {/* Label */}
      <text
        x="20"
        y="25"
        fill={isGold ? "#78350f" : "#1a4d22"}
        fontSize={String(label).length > 1 ? "12" : "13"}
        fontWeight="700"
        textAnchor="middle"
        style={{ fontFamily: "sans-serif" }}
      >
        {label}
      </text>
    </svg>
  );
}
