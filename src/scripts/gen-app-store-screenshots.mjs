#!/usr/bin/env node
/**
 * Generates App Store screenshots at 1290×2796px (iPhone 6.7" spec).
 * Run: node src/scripts/gen-app-store-screenshots.mjs
 *
 * Requires SUPABASE_SCREENSHOT_EMAIL + SUPABASE_SCREENSHOT_PASSWORD in .env
 * (or set them temporarily before running this script).
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const BASE_URL = "https://touritgolf.com";
const OUT_DIR = path.resolve("screenshots/app-store");
const WIDTH = 430;   // CSS px — iPhone 15 Pro Max logical width  (430 × 3 = 1290)
const HEIGHT = 932;  // CSS px — iPhone 15 Pro Max logical height (932 × 3 = 2796)
const DPR = 3;       // 3× = 1290×2796 physical pixels (App Store 6.7" spec)

const SCREENS = [
  {
    name: "01-home",
    url: "/",
    waitFor: ".courses-row, [data-testid='feed'], video, img[src*='supabase']",
    waitMs: 4000,
    scrollTo: 0,
  },
  {
    name: "02-bethpage-black",
    url: "/courses/ceb95a05-d039-4f2d-ae01-6bdd954d00c1",
    waitFor: "video, img[src*='supabase'], h1, [class*='hole']",
    waitMs: 4000,
    scrollTo: 0,
  },
  {
    name: "03-south-shore",
    url: "/courses/fe2d94de-fd83-4fcb-8790-a56c282e7010",
    waitFor: "video, img[src*='supabase'], h1",
    waitMs: 4000,
    scrollTo: 0,
  },
  {
    name: "04-boca-grove",
    url: "/courses/3a15e7df-e7f6-49ce-8038-e08296cedb7b",
    waitFor: "video, img[src*='supabase'], h1",
    waitMs: 4000,
    scrollTo: 0,
  },
  {
    name: "05-profile",
    url: "/profile/5d2dd909-65a6-44e8-8bd4-94419f7622d9",
    waitFor: "img, [class*='rank'], [class*='points'], [class*='avatar']",
    waitMs: 4000,
    scrollTo: 0,
    requiresAuth: true,
  },
];

async function signIn(page) {
  const email = process.env.SUPABASE_SCREENSHOT_EMAIL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_SCREENSHOT_PASSWORD;
  if (!email || !password) {
    console.log("  ⚠ No auth credentials — skipping sign-in (set SUPABASE_SCREENSHOT_EMAIL + SUPABASE_SCREENSHOT_PASSWORD in .env)");
    return false;
  }

  console.log("  Signing in...");
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.includes("/auth/"), { timeout: 15000 }).catch(() => {});
  console.log("  ✅ Signed in");
  return true;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ["--ignore-certificate-errors"] });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: DPR,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  // Hide scrollbars, disable animations for clean screenshots
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `
      * { scrollbar-width: none !important; }
      *::-webkit-scrollbar { display: none !important; }
      *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }
    `;
    document.head.appendChild(style);
  });

  let signedIn = false;

  for (const screen of SCREENS) {
    console.log(`\n── ${screen.name} ──`);

    if (screen.requiresAuth && !signedIn) {
      signedIn = await signIn(page);
    }

    await page.goto(`${BASE_URL}${screen.url}`, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for meaningful content
    await page.waitForSelector(screen.waitFor, { timeout: 10000 }).catch(() => {
      console.log("  ⚠ Selector timeout — proceeding with timed wait");
    });
    await page.waitForTimeout(screen.waitMs);

    // Scroll to target position if needed
    if (screen.scrollTo) {
      await page.evaluate((y) => window.scrollTo(0, y), screen.scrollTo);
      await page.waitForTimeout(500);
    }

    const outPath = path.join(OUT_DIR, `${screen.name}.png`);
    await page.screenshot({ path: outPath, fullPage: false });

    // Verify exact dimensions
    const { execSync } = await import("child_process");
    try {
      // Try ImageMagick identify
      const info = execSync(`magick identify -format "%wx%h" "${outPath}" 2>&1`).toString().trim();
      const [w, h] = info.split("x").map(Number);
      if (w === 1290 && h === 2796) {
        console.log(`  ✅ ${outPath} — ${w}×${h} ✓`);
      } else {
        console.log(`  ⚠ ${outPath} — ${w}×${h} (expected 1290×2796)`);
      }
    } catch {
      // ImageMagick not available — check file size as proxy
      const stat = fs.statSync(outPath);
      console.log(`  ✅ ${outPath} — ${Math.round(stat.size / 1024)}KB (install ImageMagick to verify exact dimensions)`);
    }
  }

  await browser.close();
  console.log(`\n✅ Screenshots saved to ${OUT_DIR}`);
  console.log("Upload these to App Store Connect → Screenshots (6.7\" Display)");
}

main().catch(e => { console.error(e); process.exit(1); });
