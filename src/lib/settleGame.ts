// Pure settlement engine. Given a game's players (with their stroke
// allocation), the per-player hole-by-hole gross scores, and the format's
// stakes, it proposes winners and a net-dollar breakdown. No DB, no React —
// the UI runs this, shows the proposal, and lets the user confirm/override
// before anything is written.
//
// Net scoring: a player's net on a hole = gross − (strokes they get on that
// hole). strokeHoles lists every hole a player strokes; a hole appearing
// twice means two strokes (net > 18 wraps onto the hardest holes).

import { MULTI_SEGMENT_FORMATS } from "@/lib/gameFormats";

export type SettlePlayer = {
  userId?: string | null;
  displayName: string;
  teamId?: string | null;
  strokeHoles?: number[];
};

export type SegmentResult = {
  key: string;          // "front" | "back" | "overall" | "team" | "match"
  label: string;
  winnerKey: string | null;   // userId (or teamId for team formats); null = tie/carry
  winnerName: string | null;
  detail: string;             // human-readable line
};

export type NetEntry = { userId: string; name: string; amount: number };

export type Settlement = {
  format: string;
  winners: Record<string, string>;   // segment key -> userId/teamId (only decided segments)
  segments: SegmentResult[];
  net: NetEntry[];                    // per-player net $ (matched users only)
  complete: boolean;                  // all required holes had scores
  note?: string;
};

type Scores = Record<string, (number | null)[]>;

const keyOf = (p: SettlePlayer) => p.userId || p.displayName;

function strokesOnHole(p: SettlePlayer, hole: number): number {
  if (!p.strokeHoles) return 0;
  let n = 0;
  for (const h of p.strokeHoles) if (h === hole) n++;
  return n;
}

// Net total over a set of 1-based hole numbers. Returns null if any hole is
// missing a gross score (segment can't be settled yet).
function netTotal(p: SettlePlayer, scores: Scores, holes: number[]): number | null {
  const arr = scores[keyOf(p)];
  if (!arr) return null;
  let total = 0;
  for (const h of holes) {
    const g = arr[h - 1];
    if (typeof g !== "number") return null;
    total += g - strokesOnHole(p, h);
  }
  return total;
}

// Lowest net over a segment wins. Strict tie (two players share the low)
// returns no winner.
function lowestNetWinner(
  players: SettlePlayer[], scores: Scores, holes: number[],
): { winner: SettlePlayer | null; totals: { p: SettlePlayer; net: number }[]; complete: boolean } {
  const totals: { p: SettlePlayer; net: number }[] = [];
  let complete = true;
  for (const p of players) {
    const nt = netTotal(p, scores, holes);
    if (nt === null) { complete = false; continue; }
    totals.push({ p, net: nt });
  }
  if (totals.length === 0) return { winner: null, totals, complete: false };
  const min = Math.min(...totals.map(t => t.net));
  const low = totals.filter(t => t.net === min);
  return { winner: low.length === 1 ? low[0].p : null, totals, complete };
}

// winner takes `stake` from each loser. Mutates the net map.
function payoutWinnerTakesAll(
  net: Map<string, NetEntry>, players: SettlePlayer[], winner: SettlePlayer | null, stake: number,
) {
  if (!winner || stake <= 0) return;
  const losers = players.filter(p => keyOf(p) !== keyOf(winner));
  if (losers.length === 0) return;
  bump(net, winner, stake * losers.length);
  for (const l of losers) bump(net, l, -stake);
}

function bump(net: Map<string, NetEntry>, p: SettlePlayer, delta: number) {
  if (!p.userId) return; // only matched users carry a money balance
  const row = net.get(p.userId) ?? { userId: p.userId, name: p.displayName, amount: 0 };
  row.amount += delta;
  net.set(p.userId, row);
}

const front9 = Array.from({ length: 9 }, (_, i) => i + 1);
const back9 = (holeCount: number) => Array.from({ length: Math.max(0, holeCount - 9) }, (_, i) => i + 10);
const all = (holeCount: number) => Array.from({ length: holeCount }, (_, i) => i + 1);

export function settleGame(args: {
  format: string;
  formatConfig: Record<string, unknown>;
  players: SettlePlayer[];
  scores: Scores;
  holeCount: number;
  par?: (number | null)[] | null;
}): Settlement {
  const { format, formatConfig, players, scores, holeCount } = args;
  const cfg = formatConfig || {};
  const net = new Map<string, NetEntry>();
  const segments: SegmentResult[] = [];
  const winners: Record<string, string> = {};
  let complete = true;
  const nameOf = (k: string | null) => players.find(p => keyOf(p) === k || p.userId === k)?.displayName ?? null;

  const finish = (note?: string): Settlement => ({
    format, winners, segments,
    net: Array.from(net.values()).filter(n => n.amount !== 0).sort((a, b) => b.amount - a.amount),
    complete, note,
  });

  // ── Nassau: front 9 / back 9 / overall 18, each lowest-net, each staked.
  if (format === "nassau") {
    const segDefs = MULTI_SEGMENT_FORMATS.nassau;
    const holesFor: Record<string, number[]> = { front: front9, back: back9(holeCount), overall: all(holeCount) };
    for (const seg of segDefs) {
      const holes = holesFor[seg.key];
      const { winner, complete: segComplete } = lowestNetWinner(players, scores, holes);
      if (!segComplete) complete = false;
      const stake = Number((cfg as Record<string, unknown>)[seg.stakeKey]) || 0;
      if (winner) {
        winners[seg.key] = winner.userId || winner.displayName;
        payoutWinnerTakesAll(net, players, winner, stake);
      }
      segments.push({
        key: seg.key, label: seg.label,
        winnerKey: winner ? (winner.userId || winner.displayName) : null,
        winnerName: winner?.displayName ?? null,
        detail: winner ? `${winner.displayName} wins${stake > 0 ? ` ($${stake})` : ""}` : (segComplete ? "Tied — push" : "Awaiting scores"),
      });
    }
    return finish();
  }

  // ── Stroke play / Match play / Stableford: a single "overall" winner, no
  // preset stake (these are bragging-rights formats in this app).
  if (format === "stroke_play") {
    const { winner, complete: c } = lowestNetWinner(players, scores, all(holeCount));
    complete = c;
    if (winner) winners.overall = winner.userId || winner.displayName;
    segments.push({
      key: "overall", label: "Low net",
      winnerKey: winner ? (winner.userId || winner.displayName) : null,
      winnerName: winner?.displayName ?? null,
      detail: winner ? `${winner.displayName} — lowest net 18` : (c ? "Tied" : "Awaiting scores"),
    });
    return finish();
  }

  if (format === "match_play") {
    // Two players (or first two). Lower net per hole wins the hole.
    const two = players.slice(0, 2);
    if (two.length < 2) return finish("Match play needs two players");
    let a = 0, b = 0, played = 0;
    for (const h of all(holeCount)) {
      const na = netTotal(two[0], scores, [h]);
      const nb = netTotal(two[1], scores, [h]);
      if (na === null || nb === null) { complete = false; continue; }
      played++;
      if (na < nb) a++; else if (nb < na) b++;
    }
    const winner = a > b ? two[0] : b > a ? two[1] : null;
    if (winner) winners.match = winner.userId || winner.displayName;
    segments.push({
      key: "match", label: "Match",
      winnerKey: winner ? (winner.userId || winner.displayName) : null,
      winnerName: winner?.displayName ?? null,
      detail: played === 0 ? "Awaiting scores"
        : winner ? `${winner.displayName} wins ${Math.abs(a - b)} up (${a}–${b})` : `All square (${a}–${b})`,
    });
    return finish();
  }

  if (format === "stableford") {
    const par = args.par;
    if (!par || !par.some(p => p != null)) return finish("Need par to score Stableford");
    const pts = (g: number, hole: number) => {
      const pr = par[hole - 1];
      if (pr == null) return null;
      const netToPar = g - pr;
      if (netToPar >= 2) return 0;
      if (netToPar === 1) return 1;
      if (netToPar === 0) return 2;
      if (netToPar === -1) return 3;
      if (netToPar === -2) return 4;
      return 5;
    };
    const totals: { p: SettlePlayer; pts: number }[] = [];
    for (const p of players) {
      const arr = scores[keyOf(p)];
      if (!arr) { complete = false; continue; }
      let sum = 0, any = false, missing = false;
      for (const h of all(holeCount)) {
        const g = arr[h - 1];
        if (typeof g !== "number") { missing = true; continue; }
        const net = g - strokesOnHole(p, h);
        const pp = pts(net, h);
        if (pp == null) { missing = true; continue; }
        sum += pp; any = true;
      }
      if (missing) complete = false;
      if (any) totals.push({ p, pts: sum });
    }
    const max = totals.length ? Math.max(...totals.map(t => t.pts)) : 0;
    const top = totals.filter(t => t.pts === max);
    const winner = top.length === 1 ? top[0].p : null;
    if (winner) winners.overall = winner.userId || winner.displayName;
    segments.push({
      key: "overall", label: "Most points",
      winnerKey: winner ? (winner.userId || winner.displayName) : null,
      winnerName: winner?.displayName ?? null,
      detail: totals.length === 0 ? "Awaiting scores"
        : winner ? `${winner.displayName} — ${max} pts` : `Tied at ${max} pts`,
    });
    return finish();
  }

  // ── Skins: lowest UNIQUE net per hole wins the skin. Ties carry over when
  // configured. Each skin is worth $skinsAmount from every other player.
  if (format === "skins") {
    const stake = Number((cfg as Record<string, unknown>).skinsAmount) || 0;
    const carryover = !!(cfg as Record<string, unknown>).carryover;
    const skinsWon = new Map<string, number>();
    let carry = 1;
    const eligible = players.filter(p => scores[keyOf(p)]);
    for (const h of all(holeCount)) {
      const nets: { p: SettlePlayer; net: number }[] = [];
      let missing = false;
      for (const p of eligible) {
        const g = scores[keyOf(p)]![h - 1];
        if (typeof g !== "number") { missing = true; break; }
        nets.push({ p, net: g - strokesOnHole(p, h) });
      }
      if (missing || nets.length < 2) { complete = complete && !missing; continue; }
      const min = Math.min(...nets.map(n => n.net));
      const low = nets.filter(n => n.net === min);
      if (low.length === 1) {
        const k = keyOf(low[0].p);
        skinsWon.set(k, (skinsWon.get(k) ?? 0) + carry);
        carry = 1;
      } else {
        carry = carryover ? carry + 1 : 1;
      }
    }
    const totalSkins = Array.from(skinsWon.values()).reduce((s, v) => s + v, 0);
    const n = eligible.length;
    for (const p of eligible) {
      const won = skinsWon.get(keyOf(p)) ?? 0;
      // +stake per skin from each opponent; -stake per skin won by others.
      const amount = stake * (won * (n - 1) - (totalSkins - won));
      if (amount !== 0) bump(net, p, amount);
    }
    const top = [...skinsWon.entries()].sort((a, b) => b[1] - a[1])[0];
    segments.push({
      key: "skins", label: "Skins",
      winnerKey: top ? top[0] : null,
      winnerName: top ? nameOf(top[0]) : null,
      detail: totalSkins === 0 ? (complete ? "All holes pushed" : "Awaiting scores")
        : `${totalSkins} skin${totalSkins === 1 ? "" : "s"} awarded` + (carry > 1 ? ` · ${carry - 1} carrying` : ""),
    });
    return finish();
  }

  // ── Best ball: team format. Per hole each team's best net counts; lower
  // team net wins the hole. Most holes → winning team takes the per-team
  // wager from each losing team, split among teammates.
  if (format === "best_ball") {
    const teamsMap = new Map<string, SettlePlayer[]>();
    for (const p of players) {
      const t = p.teamId || "A";
      if (!teamsMap.has(t)) teamsMap.set(t, []);
      teamsMap.get(t)!.push(p);
    }
    const teamIds = [...teamsMap.keys()];
    if (teamIds.length < 2) return finish("Best ball needs two teams");
    const holesWon = new Map<string, number>();
    for (const h of all(holeCount)) {
      const teamNet: { team: string; net: number }[] = [];
      let missing = false;
      for (const t of teamIds) {
        const members = teamsMap.get(t)!;
        const nets = members.map(p => netTotal(p, scores, [h])).filter((v): v is number => v !== null);
        if (nets.length === 0) { missing = true; break; }
        teamNet.push({ team: t, net: Math.min(...nets) });
      }
      if (missing) { complete = false; continue; }
      const min = Math.min(...teamNet.map(t => t.net));
      const low = teamNet.filter(t => t.net === min);
      if (low.length === 1) holesWon.set(low[0].team, (holesWon.get(low[0].team) ?? 0) + 1);
    }
    const ranked = [...holesWon.entries()].sort((a, b) => b[1] - a[1]);
    const winningTeam = ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : null;
    const wager = Number((cfg as Record<string, unknown>).wager) || 0;
    if (winningTeam) {
      winners.team = winningTeam;
      const winningPlayers = teamsMap.get(winningTeam)!;
      const losingTeams = teamIds.filter(t => t !== winningTeam);
      const perWinner = (wager * losingTeams.length) / winningPlayers.length;
      for (const p of winningPlayers) bump(net, p, perWinner);
      for (const t of losingTeams) {
        const members = teamsMap.get(t)!;
        for (const p of members) bump(net, p, -(wager / members.length));
      }
    }
    segments.push({
      key: "team", label: "Best ball",
      winnerKey: winningTeam,
      winnerName: winningTeam ? `Team ${winningTeam}` : null,
      detail: winningTeam ? `Team ${winningTeam} wins${wager > 0 ? ` ($${wager}/team)` : ""}` : "Tied / awaiting scores",
    });
    return finish();
  }

  return finish("This format settles manually");
}

// Recompute the net-dollar map from a (possibly user-overridden) winners
// map, for the formats whose payout is purely winner-driven (Nassau
// segments, Best Ball team wager). Used by the confirm UI when the user
// overrides a proposed winner. Score-derived formats (skins, etc.) keep
// their score-based net and are not handled here.
export function netFromWinners(args: {
  format: string;
  formatConfig: Record<string, unknown>;
  players: SettlePlayer[];
  winners: Record<string, string>;
}): NetEntry[] {
  const { format, formatConfig, players, winners } = args;
  const cfg = formatConfig || {};
  const net = new Map<string, NetEntry>();

  if (format === "nassau") {
    for (const seg of MULTI_SEGMENT_FORMATS.nassau) {
      const wk = winners[seg.key];
      if (!wk) continue;
      const winner = players.find(p => (p.userId || p.displayName) === wk);
      if (!winner) continue;
      const stake = Number((cfg as Record<string, unknown>)[seg.stakeKey]) || 0;
      payoutWinnerTakesAll(net, players, winner, stake);
    }
  } else if (format === "best_ball") {
    const wt = winners.team;
    const wager = Number((cfg as Record<string, unknown>).wager) || 0;
    if (wt && wager > 0) {
      const teamsMap = new Map<string, SettlePlayer[]>();
      for (const p of players) {
        const t = p.teamId || "A";
        if (!teamsMap.has(t)) teamsMap.set(t, []);
        teamsMap.get(t)!.push(p);
      }
      const winningPlayers = teamsMap.get(wt) ?? [];
      const losingTeams = [...teamsMap.keys()].filter(t => t !== wt);
      if (winningPlayers.length > 0 && losingTeams.length > 0) {
        const perWinner = (wager * losingTeams.length) / winningPlayers.length;
        for (const p of winningPlayers) bump(net, p, perWinner);
        for (const t of losingTeams) {
          const members = teamsMap.get(t)!;
          for (const p of members) bump(net, p, -(wager / members.length));
        }
      }
    }
  }

  return Array.from(net.values()).filter(n => n.amount !== 0).sort((a, b) => b.amount - a.amount);
}
