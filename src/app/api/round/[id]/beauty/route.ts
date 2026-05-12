import { NextRequest } from "next/server";
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1080×1920 share card for an upcoming round. Hand-rolled SVG composed with
// Sharp on the Node runtime — no next/og, no Satori, no edge-bundle-size
// problem. The SVG holds layout + text; the cover photo and the Tour It logo
// are composited in by Sharp as separate layers.

const W = 1080;
const H = 1920;

// ---------- Module-scope asset loading (cold-start cost only) ----------

const FONTS_DIR = join(process.cwd(), "public", "fonts");
const PUBLIC_DIR = join(process.cwd(), "public");

const playfair = readFileSync(join(FONTS_DIR, "PlayfairDisplay.ttf"));
const outfit = readFileSync(join(FONTS_DIR, "Outfit.ttf"));
const logoPng = readFileSync(join(PUBLIC_DIR, "tour-it-logo-full.png"));

const playfairB64 = playfair.toString("base64");
const outfitB64 = outfit.toString("base64");

// ---------- Helpers ----------

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

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

async function fetchImageAsBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ---------- Types ----------

interface PlayerCard {
  displayName: string;
  netStrokes: number;
  strokeHoles: number[];
}

interface BeautyShotData {
  courseName: string;
  courseLocation: string;
  dateLine: string;
  teeTimeLine: string;
  gameFormat: string | null;
  players: PlayerCard[];
}

// ---------- SVG template ----------

function buildSvg(d: BeautyShotData): string {
  const courseNameSize = d.courseName.length > 28 ? 48 : d.courseName.length > 20 ? 56 : 64;

  // Player cards stacked, up to 4, each 120px tall + 12px gap, starting at y=1290.
  const cardStartY = 1290;
  const cardHeight = 120;
  const cardGap = 12;
  const playerCardsSvg = d.players
    .slice(0, 4)
    .map((p, i) => {
      const y = cardStartY + i * (cardHeight + cardGap);
      const badges = p.strokeHoles
        .slice(0, 6)
        .map((hole, j) => {
          const bx = 700 + j * 50;
          const by = y + 70;
          return `
            <rect x="${bx}" y="${by}" width="42" height="32" rx="6" fill="#4da862" opacity="0.9"/>
            <text x="${bx + 21}" y="${by + 22}" font-family="Outfit" font-weight="700" font-size="18" fill="#07100a" text-anchor="middle">${hole}</text>
          `;
        })
        .join("");
      return `
        <g>
          <rect x="60" y="${y}" width="960" height="${cardHeight}" rx="20" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
          <text x="100" y="${y + 50}" font-family="Outfit" font-weight="700" font-size="32" fill="#ffffff">${escapeXml(truncate(p.displayName, 22))}</text>
          <text x="100" y="${y + 88}" font-family="Outfit" font-weight="500" font-size="22" fill="#4da862">${p.netStrokes} stroke${p.netStrokes === 1 ? "" : "s"}</text>
          ${badges}
        </g>
      `;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'Playfair';
        font-weight: 900;
        src: url(data:font/ttf;base64,${playfairB64}) format('truetype');
      }
      @font-face {
        font-family: 'Outfit';
        font-weight: 500;
        src: url(data:font/ttf;base64,${outfitB64}) format('truetype');
      }
      @font-face {
        font-family: 'Outfit';
        font-weight: 700;
        src: url(data:font/ttf;base64,${outfitB64}) format('truetype');
      }
    </style>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1c4425"/>
      <stop offset="50%" stop-color="#0a1d10"/>
      <stop offset="100%" stop-color="#07100a"/>
    </linearGradient>
    <linearGradient id="coverScrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
    </linearGradient>
  </defs>

  <!-- Background gradient -->
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>

  <!-- Eyebrow above logo -->
  <text x="${W / 2}" y="245" font-family="Outfit" font-weight="700" font-size="26" fill="rgba(255,255,255,0.55)" text-anchor="middle" letter-spacing="6">UPCOMING ROUND</text>

  <!-- Cover-card frame: Sharp composites the photo at (60, 280) underneath; this is the scrim + text overlay -->
  <rect x="60" y="280" width="960" height="620" rx="36" fill="url(#coverScrim)"/>
  <rect x="60" y="280" width="960" height="620" rx="36" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
  <text x="100" y="830" font-family="Playfair" font-weight="900" font-size="${courseNameSize}" fill="#ffffff">${escapeXml(truncate(d.courseName, 28))}</text>
  <text x="100" y="875" font-family="Outfit" font-weight="500" font-size="28" fill="rgba(255,255,255,0.85)">${escapeXml(d.courseLocation)}</text>

  <!-- Date -->
  <text x="${W / 2}" y="985" font-family="Playfair" font-weight="900" font-size="56" fill="#ffffff" text-anchor="middle">${escapeXml(d.dateLine)}</text>

  <!-- Tee time -->
  ${d.teeTimeLine ? `<text x="${W / 2}" y="1045" font-family="Outfit" font-weight="700" font-size="34" fill="#4da862" text-anchor="middle">${escapeXml(d.teeTimeLine)}</text>` : ""}

  <!-- Game block divider + label -->
  <line x1="60" y1="1130" x2="${W - 60}" y2="1130" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
  ${d.gameFormat ? `<text x="${W / 2}" y="1200" font-family="Outfit" font-weight="700" font-size="26" fill="rgba(255,255,255,0.55)" text-anchor="middle" letter-spacing="5">${escapeXml(d.gameFormat.toUpperCase())}</text>` : ""}

  ${playerCardsSvg}

  <!-- Footer -->
  <line x1="60" y1="1820" x2="${W - 60}" y2="1820" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
  <text x="${W / 2}" y="1870" font-family="Outfit" font-weight="700" font-size="22" fill="rgba(255,255,255,0.55)" text-anchor="middle" letter-spacing="4">SCOUT BEFORE YOU PLAY · touritgolf.com</text>
</svg>`;
}

// ---------- Route handler ----------

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const debug = new URL(req.url).searchParams.has("debug");
  if (debug) {
    return Response.json({
      playfairBytes: playfair.length,
      outfitBytes: outfit.length,
      logoBytes: logoPng.length,
      cwd: process.cwd(),
      tip: "non-zero byte counts mean the files were traced into the function bundle",
    });
  }
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

  type Player = { displayName: string; netStrokes?: number; courseHandicap?: number; strokeHoles?: number[] };
  const rawPlayers: Player[] = game && Array.isArray(game.players) ? (game.players as unknown as Player[]) : [];
  const players: PlayerCard[] = rawPlayers.slice(0, 4).map(p => ({
    displayName: p.displayName ?? "Player",
    netStrokes: p.netStrokes ?? p.courseHandicap ?? 0,
    strokeHoles: Array.isArray(p.strokeHoles) ? p.strokeHoles : [],
  }));

  const data: BeautyShotData = {
    courseName: course?.name ?? "Course",
    courseLocation: [course?.city, course?.state].filter(Boolean).join(", "),
    dateLine: fmtDate(tc.playDate || trip.startDate),
    teeTimeLine: fmtTime12(tc.teeTime) ? `Tee off at ${fmtTime12(tc.teeTime)}` : "",
    gameFormat: formatLabel,
    players,
  };

  const svg = buildSvg(data);
  const svgBuffer = Buffer.from(svg);

  // ---- Layers ----
  const layers: sharp.OverlayOptions[] = [];

  // Cover photo: 960×620 rounded card at (60, 280). Mask to a rounded rect.
  const coverUrl = trip.imageUrl || course?.coverImageUrl || null;
  if (coverUrl) {
    const coverBuf = await fetchImageAsBuffer(coverUrl);
    if (coverBuf) {
      try {
        const coverResized = await sharp(coverBuf)
          .resize(960, 620, { fit: "cover", position: "center" })
          .composite([
            {
              // Rounded-rect mask — only the rectangle interior is kept
              input: Buffer.from(
                `<svg width="960" height="620"><rect width="960" height="620" rx="36" ry="36" fill="#fff"/></svg>`
              ),
              blend: "dest-in",
            },
          ])
          .png()
          .toBuffer();
        layers.push({ input: coverResized, top: 280, left: 60 });
      } catch {
        // Bad image — fall back to the SVG's scrim alone
      }
    }
  }

  // Logo: 130px tall, top-centered around y=80
  try {
    const logoResized = await sharp(logoPng).resize({ height: 130 }).png().toBuffer();
    const meta = await sharp(logoResized).metadata();
    const logoLeft = Math.round((W - (meta.width ?? 0)) / 2);
    layers.push({ input: logoResized, top: 80, left: logoLeft });
  } catch {
    // No logo — keep going; eyebrow + cover still anchor the top
  }

  // SVG goes on top of everything
  layers.push({ input: svgBuffer, top: 0, left: 0 });

  const png = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 7, g: 16, b: 10, alpha: 1 } },
  })
    .composite(layers)
    .png({ quality: 90, compressionLevel: 8 })
    .toBuffer();

  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
