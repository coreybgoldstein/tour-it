#!/usr/bin/env node
/**
 * Generates App Store screenshots for both iPhone 6.7" (1284×2778) and
 * iPad 12.9" Pro (2048×2732) marketing slots.
 *
 *   node src/scripts/gen-app-store-screenshots.mjs
 *
 * Requires SUPABASE_SCREENSHOT_EMAIL + SUPABASE_SCREENSHOT_PASSWORD in
 * .env for screens that need the logged-in immersive feed.
 *
 * Output:
 *   screenshots/app-store/iphone/{01-09}.png   (1284 × 2778)
 *   screenshots/app-store/ipad/{01-02}.png     (2048 × 2732)
 */

import { chromium } from "playwright";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const BASE_URL = "https://www.touritgolf.com";

// ── Device profiles ──────────────────────────────────────────────────────────
const IPHONE = {
  name: "iphone",
  width: 428,   // 428 × 3 = 1284 physical px (iPhone 6.7" required spec)
  height: 926,  // 926 × 3 = 2778
  dpr: 3,
  expectedW: 1284,
  expectedH: 2778,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  isMobile: true,
};

const IPAD = {
  name: "ipad",
  width: 1024,   // 1024 × 2 = 2048 physical px (iPad 12.9" Pro)
  height: 1366,  // 1366 × 2 = 2732
  dpr: 2,
  expectedW: 2048,
  expectedH: 2732,
  userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  // iPad is "tablet, not mobile" for the app's responsive breakpoints — gives
  // the desktop layout where applicable (notifications panel slide-in, etc).
  isMobile: false,
};

// Westchester, NY — sits in the densest logo-pin cluster (NY + NJ + CT area).
const SCREENSHOT_GEO = { latitude: 40.9176, longitude: -73.7782 };

// Known good content IDs (verified via src/scripts/find-trip-and-map.mjs).
const PROFILE_USER_ID  = "5d2dd909-65a6-44e8-8bd4-94419f7622d9"; // Corey
const ARONIMINK_ID     = "bef620c6-48f3-456e-a1c4-7d096303bb34"; // 18 uploads, PGA-week
const SEAWANE_ID       = "82c6b4c6-b517-4a59-920e-5e66b5b3169a"; // 7 uploads, waterfront LI
const SOMERSET_HILLS_ID = "d7f33ed6-873a-4f70-9bcf-ddd19c3056b4"; // 18 uploads, gorgeous
const CADDY_DADDY_TRIP_ID = "92d40aef-1b8c-4e6a-9538-efc02cd325f3";

// Each entry is one screen to capture. `requiresAuth` triggers the sign-in
// flow once (state persists). `target` is "iphone", "ipad", or undefined
// (both). Setup is run after navigation; it can dismiss modals, scroll,
// or wait for content.
const SCREENS = [
  // ── iPhone: 1. Home discovery — value prop first ────────────────────────
  {
    name: "01-home-discovery",
    target: "iphone",
    url: "/",
    requiresAuth: false,
    setup: async (page) => {
      await page.evaluate(() => localStorage.setItem("tour-it-onboarded", "1"));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("text=Scout your next round", { timeout: 8000 }).catch(() => {});
      await page.waitForSelector("img[src*='supabase']", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(6000);
    },
  },

  // ── iPhone: 2. Immersive full-screen clip ────────────────────────────────
  // This needs auth so the logged-in TikTok-style feed renders. The first
  // visible clip should be the freshest one (the feed prioritizes newest 3).
  {
    name: "02-feed-clip",
    target: "iphone",
    url: "/",
    requiresAuth: true,
    setup: async (page) => {
      // Wait for the first video element to actually be present in the snap
      // feed (rather than the discovery section at the top of the page).
      await page.waitForSelector("video", { timeout: 10000 }).catch(() => {});
      // Scroll to the first feed-item — the discovery section is feed-item index 0,
      // the first immersive clip is index 1. Scroll one viewport down.
      await page.evaluate(() => {
        const feed = document.querySelector(".feed");
        if (feed) feed.scrollTo({ top: window.innerHeight, behavior: "instant" });
      });
      // Let the video element load, auto-play, and the overlay text settle.
      await page.waitForTimeout(5000);
    },
  },

  // ── iPhone: 3. Aronimink (PGA-week course) ───────────────────────────────
  {
    name: "03-aronimink-pga",
    target: "iphone",
    url: `/courses/${ARONIMINK_ID}`,
    requiresAuth: false,
    setup: async (page) => {
      await page.waitForSelector("h1, img[src*='supabase']", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(4000);
    },
  },

  // ── iPhone: 4. Map with logo pins ────────────────────────────────────────
  {
    name: "04-map",
    target: "iphone",
    url: "/map",
    requiresAuth: false,
    setup: async (page) => {
      // Wait for Leaflet to initialize + the first batch of markers to load
      // from the geolocation-driven by-bounds fetch.
      await page.waitForSelector(".leaflet-container", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(6500);
    },
  },

  // ── iPhone: 5. Course page — Somerset Hills (most uploads + great cover) ─
  {
    name: "05-somerset-hills",
    target: "iphone",
    url: `/courses/${SOMERSET_HILLS_ID}`,
    requiresAuth: false,
    setup: async (page) => {
      await page.waitForSelector("h1, img[src*='supabase']", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(4000);
    },
  },

  // ── iPhone: 6. Trip itinerary — Caddy Daddy Invitational ────────────────
  {
    name: "06-trip-itinerary",
    target: "iphone",
    url: `/trips/${CADDY_DADDY_TRIP_ID}`,
    requiresAuth: true,
    setup: async (page) => {
      await page.waitForTimeout(5000);
    },
  },

  // ── iPhone: 7. Leaderboards — competition + community ──────────────────
  // Originally tried /tee-up but it server-side redirects unauthenticated
  // visitors to /login before our session cookie attaches in Playwright.
  // Leaderboards is client-side rendered and works logged-out — also a
  // stronger marketing story for a single shot (gamification + rankings).
  {
    name: "07-leaderboards",
    target: "iphone",
    url: "/leaderboards",
    requiresAuth: false,
    setup: async (page) => {
      await page.waitForSelector("text=Leaderboards, text=All Time, text=Monthly", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(5000);
    },
  },

  // ── iPhone: 8. Seawane Club — waterfront LI marquee ─────────────────────
  // Swapped from Bethpage because Bethpage's cover photo has a "WARNING"
  // sign visible in the frame that reads poorly in App Store marketing.
  {
    name: "08-seawane",
    target: "iphone",
    url: `/courses/${SEAWANE_ID}`,
    requiresAuth: false,
    setup: async (page) => {
      await page.waitForSelector("h1, img[src*='supabase']", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(4000);
    },
  },

  // ── iPhone: 9. Profile with progression + badges ────────────────────────
  {
    name: "09-profile",
    target: "iphone",
    url: `/profile/${PROFILE_USER_ID}`,
    requiresAuth: false,
    setup: async (page) => {
      await page.waitForSelector("img, [class*='rank']", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(4500);
    },
  },

  // ── iPad: 1. Home discovery ─────────────────────────────────────────────
  {
    name: "01-home-discovery",
    target: "ipad",
    url: "/",
    requiresAuth: false,
    setup: async (page) => {
      await page.evaluate(() => localStorage.setItem("tour-it-onboarded", "1"));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("text=Scout your next round", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(6000);
    },
  },

  // ── iPad: 2. Course page (Aronimink) ────────────────────────────────────
  {
    name: "02-aronimink-pga",
    target: "ipad",
    url: `/courses/${ARONIMINK_ID}`,
    requiresAuth: false,
    setup: async (page) => {
      await page.waitForSelector("h1, img[src*='supabase']", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(4000);
    },
  },
];

async function signIn(page) {
  const email = process.env.SUPABASE_SCREENSHOT_EMAIL;
  const password = process.env.SUPABASE_SCREENSHOT_PASSWORD;
  if (!email || !password) {
    console.log("  ⚠ No auth credentials in .env — add SUPABASE_SCREENSHOT_EMAIL + SUPABASE_SCREENSHOT_PASSWORD");
    return false;
  }
  console.log("  Signing in…");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button.btn-submit, button:has-text("Log in")').first().click();
  await page.waitForURL(url => !url.includes("/login"), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  console.log("  ✅ Signed in");
  return true;
}

async function runDevice(device, browser) {
  const outDir = path.resolve(`screenshots/app-store/${device.name}`);
  fs.mkdirSync(outDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.dpr,
    userAgent: device.userAgent,
    isMobile: device.isMobile,
    hasTouch: device.isMobile,
    geolocation: SCREENSHOT_GEO,
    permissions: ["geolocation"],
  });

  // Hide scrollbars + kill animations so screenshots are deterministic.
  await context.addInitScript(() => {
    const s = document.createElement("style");
    s.textContent = `
      *{scrollbar-width:none!important}
      *::-webkit-scrollbar{display:none!important}
      *,*::before,*::after{animation-duration:0.001s!important;transition-duration:0.001s!important}
    `;
    document.head?.appendChild(s);
  });

  const page = await context.newPage();
  let signedIn = false;

  const screens = SCREENS.filter(s => !s.target || s.target === device.name);

  for (const screen of screens) {
    console.log(`\n── [${device.name}] ${screen.name} ──`);

    if (screen.requiresAuth && !signedIn) {
      signedIn = await signIn(page);
      if (!signedIn) {
        console.log("  ⚠ Skipping (needs auth)");
        continue;
      }
    } else if (screen.requiresAuth && screen.forceReauth) {
      // Some screens land on /login even with a notionally-valid session
      // (cookie expired during a long context, mismatched origin, etc).
      // Force a fresh sign-in to guarantee the page renders the real content.
      console.log("  Re-signing in (forceReauth)…");
      await signIn(page);
    }

    await page.goto(`${BASE_URL}${screen.url}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    try {
      await screen.setup(page);
    } catch (err) {
      console.warn(`  setup warning: ${err?.message ?? err}`);
    }

    const outPath = path.join(outDir, `${screen.name}.png`);
    await page.screenshot({ path: outPath, fullPage: false });

    const buf = fs.readFileSync(outPath);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    const ok = w === device.expectedW && h === device.expectedH;
    console.log(`  ${ok ? "✅" : "❌"} ${screen.name}.png — ${w}×${h}${ok ? " ✓" : ` (expected ${device.expectedW}×${device.expectedH})`}`);
  }

  await context.close();
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--ignore-certificate-errors", "--autoplay-policy=no-user-gesture-required"],
  });

  for (const device of [IPHONE, IPAD]) {
    console.log(`\n════════════════ ${device.name.toUpperCase()} ════════════════`);
    await runDevice(device, browser);
  }

  await browser.close();
  console.log(`\n✅ Done — screenshots saved under screenshots/app-store/`);
  console.log(`   Upload iPhone set to App Store Connect → iPhone 6.7" Display`);
  console.log(`   Upload iPad set to App Store Connect → iPad Pro 12.9" Display`);
}

main().catch(e => { console.error(e); process.exit(1); });
