/**
 * Single source of truth for golf-game formats. The `id` is what
 * gets stored in TripGame.format in the DB, the `name` is the
 * display label, and `desc` is the one-liner shown in the
 * Create-Game format picker.
 *
 * Add new formats here ONLY — every render surface
 * (CreateGameSheet, /trips/[id], /tee-up, /games/[id], the round-
 * recap beauty route) imports from this module so the display
 * label can never drift from the stored id again.
 *
 * The bug that motivated the centralisation: tee-up's archive
 * card hard-coded `ctp: "Closest to Pin"` while the DB stores
 * `closest_to_pin`. The lookup missed and the user saw the raw
 * underscored key.
 */

export type GameFormat = {
  id: string;
  name: string;
  desc: string;
};

export const GAME_FORMATS: GameFormat[] = [
  { id: "nassau",         name: "Nassau",             desc: "3 bets: front 9, back 9, full 18" },
  { id: "skins",          name: "Skins",              desc: "Win each hole, ties carry over" },
  { id: "match_play",     name: "Match Play",         desc: "Win holes, not total strokes" },
  { id: "stroke_play",    name: "Stroke Play",        desc: "Lowest total strokes wins" },
  { id: "stableford",     name: "Stableford",         desc: "Points per hole: bogey=1, par=2, birdie=3+" },
  { id: "best_ball",      name: "Best Ball",          desc: "Team: best net score per hole counts" },
  { id: "scramble",       name: "Scramble",           desc: "All play from the best shot" },
  { id: "closest_to_pin", name: "Closest to the Pin", desc: "Closest to the flag on chosen holes wins each" },
  { id: "longest_drive",  name: "Longest Drive",      desc: "Longest tee shot in the fairway on chosen holes" },
];

const FORMAT_LABELS: Record<string, string> = Object.fromEntries(
  GAME_FORMATS.map(f => [f.id, f.name])
);

/**
 * Resolve a stored format id to its display label. Falls back to
 * a prettified version of the raw id (snake_case → "Snake case")
 * so a brand-new format that hasn't been added to GAME_FORMATS yet
 * never leaks its raw key to the UI.
 */
export function gameFormatLabel(id: string | null | undefined): string {
  if (!id) return "";
  return FORMAT_LABELS[id] ?? id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// Formats where the user picks a SUBSET of holes the game runs on
// (vs the full 18). closest-to-pin and longest-drive are per-hole
// contests rather than 18-hole formats.
export const HOLE_PICKED_FORMATS = new Set<string>(["closest_to_pin", "longest_drive"]);

// Formats where the wager is per-team rather than per-player.
export const TEAM_WAGER_FORMATS = new Set<string>(["best_ball"]);

// Formats that bundle multiple independent bets into a single "game".
// Each segment is declared + settled separately. Nassau is the canonical
// case (front 9 / back 9 / overall 18) — three bets, one round, three
// potentially different winners.
//
// `stakeKey` points at the formatConfig field that holds that segment's
// dollar value, so settle-up math can roll the segment in automatically.
export type GameSegment = { key: string; label: string; stakeKey: string };
export const MULTI_SEGMENT_FORMATS: Record<string, GameSegment[]> = {
  nassau: [
    { key: "front",   label: "Front 9",    stakeKey: "frontAmount" },
    { key: "back",    label: "Back 9",     stakeKey: "backAmount" },
    { key: "overall", label: "Overall 18", stakeKey: "totalAmount" },
  ],
};
