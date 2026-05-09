#!/usr/bin/env node
/**
 * Generates an App Store screenshot at exactly 2064×2752px (iPad 13-inch spec).
 *
 * Strategy: render in mobile/phone mode so the UI looks great (not stretched
 * into tablet layout). viewport 516×688 × deviceScaleFactor 4 = 2064×2752 px.
 *
 * If SUPABASE_SCREENSHOT_EMAIL + SUPABASE_SCREENSHOT_PASSWORD are in .env,
 * signs in and captures the full-screen video feed (most impressive).
 * Otherwise captures the home page in mobile layout.
 *
 * Run: node src/scripts/gen-ipad-screenshot.mjs
 */
import { chromium } from "playwright";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const BASE_URL   = "https://touritgolf.com";
const OUT_PATH   = path.resolve("screenshots/ipad-13inch.png");
const VIEWPORT_W = 516;   // 516 × 4 = 2064
const VIEWPORT_H = 688;   // 688 × 4 = 2752
const DPR        = 4;
const EXPECTED_W = 2064;
const EXPECTED_H = 2752;

async function signIn(page) {
  const email    = process.env.SUPABASE_SCREENSHOT_EMAIL;
  const password = process.env.SUPABASE_SCREENSHOT_PASSWORD;
  if (!email || !password) return false;

  console.log("  Signing in…");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);

  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button:has-text("Log in"), button[type="submit"]').first().click();
  await page.waitForURL(url => !url.includes("/login"), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log("  ✅ Signed in");
  return true;
}

async function main() {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--ignore-certificate-errors",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });

  const context = await browser.newContext({
    viewport:          { width: VIEWPORT_W, height: VIEWPORT_H },
    deviceScaleFactor: DPR,
    userAgent:         "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    isMobile:          true,
    hasTouch:          true,
    geolocation:       { latitude: 40.9176, longitude: -73.7782 },
    permissions:       ["geolocation"],
  });

  // Hide scrollbars + freeze animations on every page
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
  const authed = await signIn(page);

  console.log("Navigating to home page…");
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Skip onboarding modal
  await page.evaluate(() => localStorage.setItem("tour-it-onboarded", "1"));

  if (authed) {
    // ── Signed-in path: capture the full-screen video feed ──────────────────
    console.log("Waiting for feed clips…");
    // Dismiss onboarding if it shows
    const browseBtn = page.getByText("Browse without an account");
    if (await browseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await browseBtn.click();
    }
    await page.waitForSelector("video", { timeout: 10000 }).catch(() => {
      console.log("  (no video found — capturing whatever is loaded)");
    });
    await page.waitForTimeout(4000);
  } else {
    // ── Unauthenticated path: mobile home page ───────────────────────────────
    console.log("No auth credentials — capturing home page in mobile layout…");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("img[src*='supabase']", { timeout: 12000 }).catch(() => {
      console.log("  (images not yet loaded — continuing)");
    });
    await page.waitForTimeout(5000);
  }

  // Final scrollbar purge in the live document
  await page.addStyleTag({
    content: `
      *{scrollbar-width:none!important}
      *::-webkit-scrollbar{display:none!important}
    `,
  });

  console.log("Taking screenshot…");
  await page.screenshot({ path: OUT_PATH, fullPage: false });
  await browser.close();

  // Verify PNG header dimensions
  const buf = fs.readFileSync(OUT_PATH);
  const w   = buf.readUInt32BE(16);
  const h   = buf.readUInt32BE(20);
  const ok  = w === EXPECTED_W && h === EXPECTED_H;

  if (ok) {
    console.log(`\n✅ ${OUT_PATH}`);
    console.log(`   ${w}×${h}px — iPad 13-inch spec confirmed`);
  } else {
    console.error(`\n❌ Dimension mismatch: got ${w}×${h}, expected ${EXPECTED_W}×${EXPECTED_H}`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
