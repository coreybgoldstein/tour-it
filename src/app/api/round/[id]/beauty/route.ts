import { NextRequest } from "next/server";
import { GlobalFonts, createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1080×1920 share card for an upcoming round. Uses @napi-rs/canvas (skia-based)
// so we get a real canvas API with registerable TTF fonts. Sharp+SVG didn't
// work — librsvg can't resolve @font-face from data URLs, text rendered as
// tofu boxes.

const W = 1080;
const H = 1920;

// ---------- Module-scope font registration ----------

const FONTS_DIR = join(process.cwd(), "public", "fonts");
const LOGO_PATH = join(process.cwd(), "public", "tour-it-logo-full.png");
GlobalFonts.registerFromPath(join(FONTS_DIR, "PlayfairDisplay.ttf"), "Playfair");
GlobalFonts.registerFromPath(join(FONTS_DIR, "Outfit.ttf"), "Outfit");

// ---------- Helpers ----------

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function fmtTime12(t: string | null | undefined): string | null {
  if (!t) return null;
  const [hh, mm] = t.split(":").map(Number);
  if (Number.isNaN(hh)) return null;
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm ?? 0).padStart(2, "0")} ${period}`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

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

// Letter-spaced text — canvas doesn't natively support letter-spacing on fillText
function fillTextSpaced(ctx: SKRSContext2D, text: string, x: number, y: number, spacing: number, align: "left" | "center" | "right" = "left") {
  const widths = [...text].map(ch => ctx.measureText(ch).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let cursor = align === "center" ? x - totalWidth / 2 : align === "right" ? x - totalWidth : x;
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], cursor, y);
    cursor += widths[i] + spacing;
  }
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ---------- Route handler ----------

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const [tripRes, tcRes, gameRes] = await Promise.all([
    sb.from("GolfTrip").select("id, name, startDate, imageUrl").eq("id", id).maybeSingle(),
    sb.from("GolfTripCourse").select("courseId, playDate, teeTime").eq("tripId", id),
    sb.from("TripGame").select("format, players").eq("tripId", id).order("createdAt", { ascending: false }).limit(1),
  ]);

  const trip = tripRes.data;
  const tcRows = tcRes.data;
  if (!trip || !tcRows || tcRows.length === 0) {
    return new Response("Round not found", { status: 404 });
  }

  const tc = tcRows[0];
  const { data: course } = await sb
    .from("Course")
    .select("id, name, city, state, coverImageUrl")
    .eq("id", tc.courseId)
    .maybeSingle();

  const game = gameRes.data?.[0];
  const formatLabel = game
    ? (({ nassau: "Nassau", skins: "Skins", match: "Match Play", stroke: "Stroke Play" } as Record<string, string>)[game.format] ?? game.format)
    : null;

  type Player = { displayName: string; avatarUrl?: string | null; netStrokes?: number; courseHandicap?: number; strokeHoles?: number[] };
  const rawPlayers: Player[] = game && Array.isArray(game.players) ? (game.players as unknown as Player[]) : [];
  const playersTrimmed = rawPlayers.slice(0, 4).map(p => ({
    displayName: p.displayName ?? "Player",
    avatarUrl: p.avatarUrl ?? null,
    netStrokes: p.netStrokes ?? p.courseHandicap ?? 0,
    strokeHoles: Array.isArray(p.strokeHoles) ? p.strokeHoles : [],
  }));
  // Fetch and decode all avatars in parallel — failures fall through to initial-letter fallback
  const avatarImages = await Promise.all(
    playersTrimmed.map(async p => {
      if (!p.avatarUrl) return null;
      try {
        const buf = await fetchImageBuffer(p.avatarUrl);
        if (!buf) return null;
        return await loadImage(buf);
      } catch { return null; }
    })
  );
  const players = playersTrimmed.map((p, i) => ({ ...p, avatarImg: avatarImages[i] }));

  const courseName = course?.name ?? "Course";
  const courseLocation = [course?.city, course?.state].filter(Boolean).join(", ");
  const dateLine = fmtDate(tc.playDate || trip.startDate);
  const teeTime = fmtTime12(tc.teeTime);
  const coverUrl = trip.imageUrl || course?.coverImageUrl || null;

  // -------------------- DRAW --------------------
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Background gradient (Tour It brand green → near-black)
  {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#1c4425");
    grad.addColorStop(0.55, "#0a1d10");
    grad.addColorStop(1, "#07100a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // --- Tour It logo (top, 130px tall, centered) ---
  try {
    const logoImg = await loadImage(LOGO_PATH);
    const targetH = 130;
    const targetW = (logoImg.width / logoImg.height) * targetH;
    ctx.drawImage(logoImg, (W - targetW) / 2, 80, targetW, targetH);
  } catch {
    // Logo not found — leave blank, eyebrow still anchors the top
  }

  // --- Eyebrow "UPCOMING ROUND" below the logo ---
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "700 26px Outfit";
  ctx.textBaseline = "alphabetic";
  fillTextSpaced(ctx, "UPCOMING ROUND", W / 2, 250, 6, "center");

  // --- Cover photo card at (60, 280) 960×620, rounded 36px ---
  const cardX = 60;
  const cardY = 280;
  const cardW = 960;
  const cardH = 620;
  const cardR = 36;

  ctx.save();
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.clip();

  // Cover photo (cover-fit into card)
  let coverDrawn = false;
  if (coverUrl) {
    const buf = await fetchImageBuffer(coverUrl);
    if (buf) {
      try {
        const img = await loadImage(buf);
        const scale = Math.max(cardW / img.width, cardH / img.height);
        const dW = img.width * scale;
        const dH = img.height * scale;
        const dx = cardX + (cardW - dW) / 2;
        const dy = cardY + (cardH - dH) / 2;
        ctx.drawImage(img, dx, dy, dW, dH);
        coverDrawn = true;
      } catch {
        // bad image — fall through to fallback fill
      }
    }
  }
  if (!coverDrawn) {
    const g = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    g.addColorStop(0, "#2d7a42");
    g.addColorStop(1, "#1c4425");
    ctx.fillStyle = g;
    ctx.fillRect(cardX, cardY, cardW, cardH);
  }

  // Bottom-fade scrim for legibility of overlaid text
  const scrim = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
  scrim.addColorStop(0, "rgba(0,0,0,0)");
  scrim.addColorStop(0.55, "rgba(0,0,0,0)");
  scrim.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = scrim;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  // Course name — auto-shrink the font until the full name fits on one line
  const courseMaxWidth = cardW - 80;
  let courseNameSize = 68;
  ctx.font = `900 ${courseNameSize}px Playfair`;
  while (ctx.measureText(courseName).width > courseMaxWidth && courseNameSize > 34) {
    courseNameSize -= 2;
    ctx.font = `900 ${courseNameSize}px Playfair`;
  }
  ctx.fillStyle = "#fff";
  ctx.fillText(courseName, cardX + 40, cardY + cardH - 100);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "500 28px Outfit";
  ctx.fillText(courseLocation, cardX + 40, cardY + cardH - 50);

  ctx.restore();

  // Hairline border on the card
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // --- Date ---
  ctx.fillStyle = "#fff";
  ctx.font = "900 56px Playfair";
  ctx.textAlign = "center";
  ctx.fillText(dateLine, W / 2, 985);
  ctx.textAlign = "left";

  // --- Tee time ---
  if (teeTime) {
    ctx.fillStyle = "#4da862";
    ctx.font = "700 34px Outfit";
    ctx.textAlign = "center";
    ctx.fillText(`Tee off at ${teeTime}`, W / 2, 1045);
    ctx.textAlign = "left";
  }

  // --- Game block divider + label ---
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 1130);
  ctx.lineTo(W - 60, 1130);
  ctx.stroke();

  // --- Game format label — bright white + flanked by green accent dots ---
  if (formatLabel) {
    const label = formatLabel.toUpperCase();
    ctx.font = "900 34px Outfit";
    ctx.fillStyle = "#fff";
    fillTextSpaced(ctx, label, W / 2, 1210, 8, "center");

    // measure to place the accent dots on either side
    const widths = [...label].map(ch => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + 8 * (label.length - 1);
    const dotR = 5;
    ctx.fillStyle = "#4da862";
    ctx.beginPath();
    ctx.arc(W / 2 - total / 2 - 28, 1198, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W / 2 + total / 2 + 28, 1198, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Player cards (up to 4) — avatars, bold names, brighter strokes/badges ---
  const cardStartY = 1260;
  const playerCardH = 120;
  const playerCardGap = 12;
  players.forEach((p, i) => {
    const y = cardStartY + i * (playerCardH + playerCardGap);

    // card bg
    roundedRect(ctx, 60, y, W - 120, playerCardH, 20);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // avatar (circular, 64px)
    const avatarSize = 64;
    const avatarX = 90;
    const avatarY = y + (playerCardH - avatarSize) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (p.avatarImg) {
      ctx.drawImage(p.avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    } else {
      // initial-letter fallback on a brand-green disc
      ctx.fillStyle = "#2d7a42";
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
      ctx.fillStyle = "#fff";
      ctx.font = "900 32px Outfit";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((p.displayName || "?").slice(0, 1).toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();
    // hairline ring on the avatar
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const textX = avatarX + avatarSize + 20;

    // name
    ctx.fillStyle = "#fff";
    ctx.font = "900 36px Outfit";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(truncate(p.displayName, 18), textX, y + 50);

    // strokes count — bigger, brighter
    ctx.fillStyle = "#4da862";
    ctx.font = "700 24px Outfit";
    ctx.fillText(`${p.netStrokes} stroke${p.netStrokes === 1 ? "" : "s"}`, textX, y + 88);

    // stroke-hole badges (up to 6) — saturated green + white digits + bolder
    const badges = p.strokeHoles.slice(0, 6);
    badges.forEach((hole, j) => {
      const bw = 46;
      const bh = 36;
      const bx = (W - 60) - (badges.length - j) * (bw + 6);
      const by = y + (playerCardH - bh) / 2;
      roundedRect(ctx, bx, by, bw, bh, 8);
      ctx.fillStyle = "#4da862";
      ctx.fill();
      ctx.fillStyle = "#07100a";
      ctx.font = "900 20px Outfit";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(hole), bx + bw / 2, by + bh / 2 + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    });
  });

  // --- Footer ---
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 1820);
  ctx.lineTo(W - 60, 1820);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "700 22px Outfit";
  fillTextSpaced(ctx, "SCOUT BEFORE YOU PLAY · TOURITGOLF.COM", W / 2, 1870, 4, "center");

  const png = await canvas.encode("png");

  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
