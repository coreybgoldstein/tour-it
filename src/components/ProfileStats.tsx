"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// All-time personal scoring stats + (for non-owners) a head-to-head record
// against the viewing user. Reads from Round rows written by the score
// ingestion + settlement flow. Net comparisons use Course Handicap derived
// from each round's own tee slope/rating.

type RoundRow = {
  id: string;
  courseId: string;
  date: string;
  totalScore: number | null;
  scoreToPar: number | null;
  greensInReg: number | null;
  fairwaysHit: number | null;
  fairwaysPossible: number | null;
  putts: number | null;
  courseRating: number | null;
  slope: number | null;
  golfTripId: string | null;
  tripGameId: string | null;
};

const ROUND_FIELDS =
  "id, courseId, date, totalScore, scoreToPar, greensInReg, fairwaysHit, fairwaysPossible, putts, courseRating, slope, golfTripId, tripGameId";

// Course Handicap = HI × (Slope/113) + (Rating − Par). Neutralizes gracefully:
// missing slope → 113, rating term drops unless both rating and par known.
function courseHandicap(hi: number | null, slope: number | null, rating: number | null, par: number | null): number {
  const idx = Number(hi);
  if (!Number.isFinite(idx)) return 0;
  const s = slope && slope > 0 ? slope : 113;
  const ratingTerm = rating != null && par != null ? rating - par : 0;
  return Math.round(idx * (s / 113) + ratingTerm);
}

function roundKey(r: RoundRow): string {
  return r.tripGameId || `${r.courseId}|${r.date}`;
}

export default function ProfileStats({
  userId, currentUserId, isOwner, profileHandicap, displayName,
}: {
  userId: string;
  currentUserId: string | null;
  isOwner: boolean;
  profileHandicap: number | null;
  displayName: string;
}) {
  const supabase = createClient();
  const [profileRounds, setProfileRounds] = useState<RoundRow[]>([]);
  const [myRounds, setMyRounds] = useState<RoundRow[]>([]);
  const [myHandicap, setMyHandicap] = useState<number | null>(null);
  const [settlements, setSettlements] = useState<Record<string, { net?: { userId: string; amount: number }[] } | null>>({});
  const [loaded, setLoaded] = useState(false);

  const wantH2H = !isOwner && !!currentUserId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: theirs } = await supabase.from("Round").select(ROUND_FIELDS).eq("userId", userId).order("date", { ascending: false });
      if (cancelled) return;
      const tRounds = (theirs || []) as RoundRow[];
      setProfileRounds(tRounds);

      if (wantH2H && currentUserId) {
        const [{ data: mine }, { data: me }] = await Promise.all([
          supabase.from("Round").select(ROUND_FIELDS).eq("userId", currentUserId),
          supabase.from("User").select("handicapIndex").eq("id", currentUserId).single(),
        ]);
        if (cancelled) return;
        const mRounds = (mine || []) as RoundRow[];
        setMyRounds(mRounds);
        setMyHandicap((me as { handicapIndex: number | null } | null)?.handicapIndex ?? null);

        // Pull settlements for any shared trip games to compute net $.
        const theirKeys = new Set(tRounds.map(roundKey));
        const sharedGameIds = [...new Set(
          mRounds.filter(r => r.tripGameId && theirKeys.has(r.tripGameId)).map(r => r.tripGameId as string),
        )];
        if (sharedGameIds.length > 0) {
          const { data: games } = await supabase.from("TripGame").select("id, settlement").in("id", sharedGameIds);
          if (!cancelled && games) {
            const map: Record<string, { net?: { userId: string; amount: number }[] } | null> = {};
            for (const g of games as { id: string; settlement: { net?: { userId: string; amount: number }[] } | null }[]) map[g.id] = g.settlement;
            setSettlements(map);
          }
        }
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, currentUserId]);

  const h2h = useMemo(() => {
    if (!wantH2H) return null;
    const theirByKey = new Map<string, RoundRow>();
    for (const r of profileRounds) if (!theirByKey.has(roundKey(r))) theirByKey.set(roundKey(r), r);

    let together = 0;
    let grossW = 0, grossL = 0, grossT = 0;
    let netW = 0, netL = 0, netT = 0;
    let myMoney = 0;
    let moneyGames = 0;

    const seen = new Set<string>();
    for (const mine of myRounds) {
      const key = roundKey(mine);
      if (seen.has(key)) continue;
      const theirs = theirByKey.get(key);
      if (!theirs) continue;
      seen.add(key);
      together++;

      if (mine.totalScore != null && theirs.totalScore != null) {
        if (mine.totalScore < theirs.totalScore) grossW++;
        else if (mine.totalScore > theirs.totalScore) grossL++;
        else grossT++;

        const myPar = mine.scoreToPar != null ? mine.totalScore - mine.scoreToPar : null;
        const theirPar = theirs.scoreToPar != null ? theirs.totalScore - theirs.scoreToPar : null;
        const myNet = mine.totalScore - courseHandicap(myHandicap, mine.slope, mine.courseRating, myPar);
        const theirNet = theirs.totalScore - courseHandicap(profileHandicap, theirs.slope, theirs.courseRating, theirPar);
        if (myNet < theirNet) netW++;
        else if (myNet > theirNet) netL++;
        else netT++;
      }

      if (mine.tripGameId && currentUserId) {
        const s = settlements[mine.tripGameId];
        const mineAmt = s?.net?.find(n => n.userId === currentUserId)?.amount;
        if (typeof mineAmt === "number") { myMoney += mineAmt; moneyGames++; }
      }
    }

    return { together, grossW, grossL, grossT, netW, netL, netT, myMoney, moneyGames };
  }, [wantH2H, profileRounds, myRounds, myHandicap, profileHandicap, settlements, currentUserId]);

  if (!loaded) return null;
  if (!(h2h && h2h.together > 0)) return null;

  const firstName = displayName.split(" ")[0] || displayName;

  return (
    <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
      {h2h && h2h.together > 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 14px 12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)" }}>You vs {firstName}</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{h2h.together} round{h2h.together === 1 ? "" : "s"} together</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: h2h.moneyGames > 0 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10 }}>
            <RecordCell label="Gross" w={h2h.grossW} l={h2h.grossL} t={h2h.grossT} />
            <RecordCell label="Net" w={h2h.netW} l={h2h.netL} t={h2h.netT} />
            {h2h.moneyGames > 0 && (
              <div style={cellBox}>
                <div style={cellLabel}>Net $</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: h2h.myMoney > 0 ? "#4da862" : h2h.myMoney < 0 ? "#e57373" : "#fff" }}>
                  {h2h.myMoney > 0 ? `+$${h2h.myMoney}` : h2h.myMoney < 0 ? `-$${Math.abs(h2h.myMoney)}` : "$0"}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const cellBox: React.CSSProperties = { background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "10px 8px", textAlign: "center" };
const cellLabel: React.CSSProperties = { fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4 };

function RecordCell({ label, w, l, t }: { label: string; w: number; l: number; t: number }) {
  return (
    <div style={cellBox}>
      <div style={cellLabel}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff" }}>
        {w}-{l}{t > 0 ? `-${t}` : ""}
      </div>
    </div>
  );
}

