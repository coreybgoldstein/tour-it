import { NextRequest } from "next/server";
import { GlobalFonts, createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";
import { gameFormatLabel } from "@/lib/gameFormats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-hole pops scorecard PNG for a TripGame share. Renders a real scorecard
// grid (HOLE / PAR / HCP rows + one row per player with green pop-dots per
// hole), front-9 / back-9 stacked for 18-hole courses. Mirrors the beauty
// route's @napi-rs/canvas setup (registered TTF fonts, roundedRect helpers).

const W = 1080;

const FONTS_DIR = join(process.cwd(), "public", "fonts");
GlobalFonts.registerFromPath(join(FONTS_DIR, "PlayfairDisplay.ttf"), "Playfair");
GlobalFonts.registerFromPath(join(FONTS_DIR, "Outfit.ttf"), "Outfit");

const BG = "#07100a";
const GREEN = "#4da862";
const DARK_GREEN = "#2d7a42";
const WHITE = "#ffffff";
const MUTED = "rgba(255,255,255,0.4)";
const FAINT = "rgba(255,255,255,0.08)";

function roundedRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fillTextSpaced(ctx: SKRSContext2D, text: string, x: number, y: number, spacing: number, align: "left" | "center" | "right" = "left") {
  const widths = [...text].map(ch => ctx.measureText(ch).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let cursor = align === "center" ? x - totalWidth / 2 : align === "right" ? x - totalWidth : x;
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], cursor, y);
    cursor += widths[i] + spacing;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

type Player = {
  displayName: string;
  strokeHoles?: number[];
  netStrokes?: number;
  courseHandicap?: number;
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; gameId: string }> }) {
  const { id, gameId } = await params;
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: game } = await sb
    .from("TripGame")
    .select("id, tripId, courseId, courseName, format, players, holeHandicaps, createdAt")
    .eq("id", gameId)
    .maybeSingle();

  if (!game || game.tripId !== id) {
    return new Response("Game not found", { status: 404 });
  }

  const rawPlayers: Player[] = Array.isArray(game.players) ? (game.players as unknown as Player[]) : [];
  const players = rawPlayers.slice(0, 6).map(p => ({
    displayName: p.displayName ?? "Player",
    strokeHoles: Array.isArray(p.strokeHoles) ? p.strokeHoles : [],
    netStrokes: p.netStrokes ?? p.courseHandicap ?? 0,
  }));

  const holeHandicaps: number[] = Array.isArray(game.holeHandicaps) ? (game.holeHandicaps as unknown as number[]) : [];

  // Par per hole number — fall back to 0 (rendered blank) when absent.
  const { data: holeRows } = await sb
    .from("Hole")
    .select("holeNumber, par")
    .eq("courseId", game.courseId)
    .order("holeNumber");
  const parByHole = new Map<number, number>();
  for (const h of (holeRows ?? []) as Array<{ holeNumber: number; par: number | null }>) {
    if (h.par != null) parByHole.set(h.holeNumber, h.par);
  }

  const holeCount = holeHandicaps.length === 9 ? 9 : 18;
  const hasRanks = holeHandicaps.length >= holeCount && holeHandicaps.every(r => r > 0);

  // Sections: front 9 / back 9 (or a single 9 for 9-hole courses).
  const sections: { label: string; holes: number[] }[] =
    holeCount === 9
      ? [{ label: "", holes: [1, 2, 3, 4, 5, 6, 7, 8, 9] }]
      : [
          { label: "FRONT", holes: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
          { label: "BACK", holes: [10, 11, 12, 13, 14, 15, 16, 17, 18] },
        ];

  // ---------- Layout metrics ----------
  const MARGIN = 60;
  const NAME_W = 210;
  const TOT_W = 96;
  const gridW = W - MARGIN * 2;
  const cellW = (gridW - NAME_W - TOT_W) / 9;
  const rowH = 56;
  const headerRows = hasRanks ? 3 : 2; // HOLE, PAR, [HCP]
  const sectionTitleH = holeCount === 9 ? 0 : 38;
  const sectionGap = holeCount === 9 ? 0 : 28;

  const topPad = 230; // header block
  const perSectionH = sectionTitleH + (headerRows + players.length) * rowH;
  const bodyH = sections.length * perSectionH + (sections.length - 1) * sectionGap;
  const footerH = 110;
  const H = topPad + bodyH + footerH;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // ---------- Header ----------
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = GREEN;
  ctx.font = "600 24px Outfit";
  fillTextSpaced(ctx, "SCORECARD · POPS PER HOLE", MARGIN, 78, 3, "left");

  ctx.fillStyle = WHITE;
  ctx.font = "900 52px Playfair";
  ctx.fillText(truncate(game.courseName ?? "Course", 30), MARGIN, 140);

  ctx.fillStyle = MUTED;
  ctx.font = "500 26px Outfit";
  const sub = [gameFormatLabel(game.format), fmtDate(game.createdAt)].filter(Boolean).join("  ·  ");
  ctx.fillText(sub, MARGIN, 182);

  // ---------- Sections ----------
  let y = topPad;
  for (const section of sections) {
    if (section.label) {
      ctx.fillStyle = GREEN;
      ctx.font = "700 20px Outfit";
      fillTextSpaced(ctx, section.label + " NINE", MARGIN, y + 24, 2, "left");
      y += sectionTitleH;
    }

    const sectionX = MARGIN;
    const totalRows = headerRows + players.length;

    // Card background
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    roundedRect(ctx, sectionX, y, gridW, totalRows * rowH, 14);
    ctx.fill();

    // HOLE row
    let ry = y;
    drawLabelCell(ctx, sectionX, ry, NAME_W, rowH, "HOLE", MUTED);
    section.holes.forEach((hn, i) => {
      drawCell(ctx, sectionX + NAME_W + i * cellW, ry, cellW, rowH, String(hn), MUTED, "600 24px Outfit");
    });
    drawCell(ctx, sectionX + NAME_W + 9 * cellW, ry, TOT_W, rowH, section.label === "BACK" ? "IN" : section.label === "FRONT" ? "OUT" : "TOT", MUTED, "700 20px Outfit");
    ry += rowH;

    // PAR row
    let parSum = 0;
    drawLabelCell(ctx, sectionX, ry, NAME_W, rowH, "PAR", MUTED);
    section.holes.forEach((hn, i) => {
      const par = parByHole.get(hn);
      if (par) parSum += par;
      drawCell(ctx, sectionX + NAME_W + i * cellW, ry, cellW, rowH, par ? String(par) : "–", "rgba(255,255,255,0.6)", "500 24px Outfit");
    });
    drawCell(ctx, sectionX + NAME_W + 9 * cellW, ry, TOT_W, rowH, parSum > 0 ? String(parSum) : "–", "rgba(255,255,255,0.6)", "700 24px Outfit");
    ry += rowH;

    // HCP (handicap rank) row
    if (hasRanks) {
      drawLabelCell(ctx, sectionX, ry, NAME_W, rowH, "HCP", MUTED);
      section.holes.forEach((hn, i) => {
        const rank = holeHandicaps[hn - 1];
        drawCell(ctx, sectionX + NAME_W + i * cellW, ry, cellW, rowH, rank ? String(rank) : "–", "rgba(255,255,255,0.35)", "500 20px Outfit");
      });
      drawCell(ctx, sectionX + NAME_W + 9 * cellW, ry, TOT_W, rowH, "", MUTED, "500 20px Outfit");
      ry += rowH;
    }

    // Player rows
    players.forEach((p, pIdx) => {
      // alternate row tint
      if (pIdx % 2 === 1) {
        ctx.fillStyle = "rgba(255,255,255,0.02)";
        ctx.fillRect(sectionX, ry, gridW, rowH);
      }
      ctx.fillStyle = WHITE;
      ctx.font = "600 24px Outfit";
      ctx.textAlign = "left";
      ctx.fillText(truncate(p.displayName, 14), sectionX + 18, ry + rowH / 2 + 8);
      ctx.textAlign = "start";

      let sectionPops = 0;
      section.holes.forEach((hn, i) => {
        const pops = (p.strokeHoles ?? []).filter(h => h === hn).length;
        sectionPops += pops;
        if (pops > 0) {
          drawDots(ctx, sectionX + NAME_W + i * cellW + cellW / 2, ry + rowH / 2, pops);
        } else {
          // faint dash for no pop
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          ctx.font = "500 22px Outfit";
          ctx.textAlign = "center";
          ctx.fillText("·", sectionX + NAME_W + i * cellW + cellW / 2, ry + rowH / 2 + 8);
          ctx.textAlign = "start";
        }
      });
      // section total pops
      ctx.fillStyle = sectionPops > 0 ? GREEN : "rgba(255,255,255,0.3)";
      ctx.font = "700 24px Outfit";
      ctx.textAlign = "center";
      ctx.fillText(String(sectionPops), sectionX + NAME_W + 9 * cellW + TOT_W / 2, ry + rowH / 2 + 8);
      ctx.textAlign = "start";
      ry += rowH;
    });

    // Grid separators (vertical lines between name | holes | total)
    ctx.strokeStyle = FAINT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sectionX + NAME_W, y);
    ctx.lineTo(sectionX + NAME_W, y + totalRows * rowH);
    ctx.moveTo(sectionX + NAME_W + 9 * cellW, y);
    ctx.lineTo(sectionX + NAME_W + 9 * cellW, y + totalRows * rowH);
    ctx.stroke();

    y += totalRows * rowH + sectionGap;
  }

  // ---------- Footer ----------
  ctx.fillStyle = MUTED;
  ctx.font = "500 22px Outfit";
  ctx.textAlign = "left";
  ctx.fillText("A green dot = a stroke (pop) on that hole.", MARGIN, H - 56);
  ctx.fillStyle = GREEN;
  ctx.font = "700 24px Playfair";
  ctx.textAlign = "right";
  ctx.fillText("Tour It", W - MARGIN, H - 56);
  ctx.textAlign = "left";

  const png = canvas.toBuffer("image/png");
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

// ---------- Cell drawing helpers ----------

function drawLabelCell(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, text: string, color: string) {
  ctx.fillStyle = color;
  ctx.font = "700 20px Outfit";
  ctx.textAlign = "left";
  fillTextSpaced(ctx, text, x + 18, y + h / 2 + 7, 2, "left");
  ctx.textAlign = "start";
}

function drawCell(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, text: string, color: string, font: string) {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.fillText(text, x + w / 2, y + h / 2 + 8);
  ctx.textAlign = "start";
}

// Draw 1–N green pop dots centered at (cx, cy). Caps display at 3 dots
// (a hole with 4+ pops is unrealistic) and stacks 2-wide for doubles.
function drawDots(ctx: SKRSContext2D, cx: number, cy: number, count: number) {
  const n = Math.min(count, 3);
  const r = 7;
  const gap = 6;
  const totalW = n * (r * 2) + (n - 1) * gap;
  let startX = cx - totalW / 2 + r;
  ctx.fillStyle = GREEN;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(startX, cy, r, 0, Math.PI * 2);
    ctx.fill();
    startX += r * 2 + gap;
  }
}
