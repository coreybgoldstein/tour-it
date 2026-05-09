#!/usr/bin/env node
/**
 * Generates an App Store screenshot at exactly 2064×2752px (iPad 13-inch spec).
 * viewport 1032×1376 × deviceScaleFactor 2 = 2064×2752 physical pixels.
 *
 * Run: node src/scripts/gen-ipad-screenshot.mjs
 */
import { chromium } from "playwright";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const BASE_URL = "https://touritgolf.com";
const OUT_PATH = path.resolve("screenshots/ipad-13inch.png");
const EXPECTED_W = 2064;
const EXPECTED_H = 2752;
const VIEWPORT_W = 1032;  // 1032 × 2 = 2064
const VIEWPORT_H = 1376;  // 1376 × 2 = 2752
const DPR = 2;

async function main() {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--ignore-certificate-errors", "--autoplay-policy=no-user-gesture-required"],
  });

  const context = await browser.newContext({
    viewport: { width: VIEWPORT_W, height: VIEWPORT_H },
    deviceScaleFactor: DPR,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    isMobile: false,
    hasTouch: true,
    geolocation: { latitude: 40.9176, longitude: -73.7782 },
    permissions: ["geolocation"],
  });

  // Hide scrollbars and freeze animations
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

  console.log("Navigating to home page…");
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Skip onboarding modal — set the localStorage flag then reload
  await page.evaluate(() => localStorage.setItem("tour-it-onboarded", "1"));
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });

  // Wait for course cards and images to appear
  console.log("Waiting for content…");
  await page.waitForSelector("img[src*='supabase']", { timeout: 12000 }).catch(() => {
    console.log("  (no supabase images found — continuing anyway)");
  });
  await page.waitForTimeout(4000);

  // Ensure scrollbars are hidden in the live page too
  await page.addStyleTag({
    content: `
      *{scrollbar-width:none!important}
      *::-webkit-scrollbar{display:none!important}
    `,
  });

  console.log("Taking screenshot…");
  await page.screenshot({ path: OUT_PATH, fullPage: false });

  await browser.close();

  // Verify exact dimensions from PNG header
  const buf = fs.readFileSync(OUT_PATH);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const ok = w === EXPECTED_W && h === EXPECTED_H;

  if (ok) {
    console.log(`✅ ${OUT_PATH}`);
    console.log(`   ${w}×${h}px — matches iPad 13-inch spec`);
  } else {
    console.error(`❌ Dimension mismatch: got ${w}×${h}, expected ${EXPECTED_W}×${EXPECTED_H}`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
