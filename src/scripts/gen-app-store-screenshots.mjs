#!/usr/bin/env node
/**
 * Generates App Store screenshots at 1284×2778px (iPhone 6.7" required spec).
 * Run: node src/scripts/gen-app-store-screenshots.mjs
 *
 * Set SUPABASE_SCREENSHOT_EMAIL + SUPABASE_SCREENSHOT_PASSWORD in .env to sign in
 * for the feed + profile screens.
 */
import { chromium } from "playwright";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const BASE_URL = "https://touritgolf.com";
const OUT_DIR = path.resolve("screenshots/app-store");
const WIDTH = 428;   // 428 × 3 = 1284 physical px
const HEIGHT = 926;  // 926 × 3 = 2778 physical px
const DPR = 3;

const SCREENS = [
  {
    name: "01-feed",
    url: "/",
    requiresAuth: true,
    waitMs: 5000,
    // After login the feed loads full-screen video clips — scroll past onboarding
    setup: async (page) => {
      // Dismiss any onboarding modal if present
      const browseBtn = page.getByText("Browse without an account");
      if (await browseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await browseBtn.click();
        await page.waitForTimeout(2000);
      }
      // Wait for a video to appear in the feed
      await page.waitForSelector("video", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(3000);
    },
  },
  {
    name: "02-home",
    url: "/",
    requiresAuth: false,
    waitMs: 3000,
    // Set onboarded flag so the modal never appears, then reload to get the real home screen
    setup: async (page) => {
      await page.evaluate(() => localStorage.setItem("tour-it-onboarded", "1"));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("text=Scout your next round", { timeout: 8000 }).catch(() => {});
      // Wait for popular course cards + near-me courses to load
      await page.waitForSelector("img[src*='supabase']", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(6000);
    },
  },
  {
    name: "03-bethpage-black",
    url: "/courses/ceb95a05-d039-4f2d-ae01-6bdd954d00c1",
    requiresAuth: false,
    waitMs: 4000,
    setup: async (page) => {
      await page.waitForSelector("h1, img[src*='supabase']", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(3000);
    },
  },
  {
    name: "04-south-shore",
    url: "/courses/fe2d94de-fd83-4fcb-8790-a56c282e7010",
    requiresAuth: false,
    waitMs: 4000,
    setup: async (page) => {
      await page.waitForSelector("h1, img[src*='supabase']", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(3000);
    },
  },
  {
    name: "05-profile",
    url: "/profile/5d2dd909-65a6-44e8-8bd4-94419f7622d9",
    requiresAuth: false,
    waitMs: 4000,
    setup: async (page) => {
      await page.waitForSelector("img, [class*='rank'], [class*='avatar']", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(3000);
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

  console.log("  Signing in...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);

  const emailInput = page.locator('input[type="email"]').first();
  const passInput = page.locator('input[type="password"]').first();
  await emailInput.fill(email);
  await passInput.fill(password);

  const submitBtn = page.locator('button.btn-submit, button:has-text("Log in")').first();
  await submitBtn.click();

  await page.waitForURL(url => !url.includes("/login"), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log("  ✅ Signed in");
  return true;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--ignore-certificate-errors", "--autoplay-policy=no-user-gesture-required"],
  });

  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: DPR,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    isMobile: true,
    hasTouch: true,
    geolocation: { latitude: 40.9176, longitude: -73.7782 }, // Westchester, NY
    permissions: ["geolocation"],
  });

  // Suppress scrollbars + animations globally
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

  for (const screen of SCREENS) {
    console.log(`\n── ${screen.name} ──`);

    if (screen.requiresAuth && !signedIn) {
      signedIn = await signIn(page);
      if (!signedIn) {
        console.log("  ⚠ Skipping (needs auth)");
        continue;
      }
    }

    // Fresh page for non-auth screens after a sign-in happened (avoid logged-in state bleed)
    if (!screen.requiresAuth && signedIn) {
      // Still fine — logged-in state shows richer content
    }

    await page.goto(`${BASE_URL}${screen.url}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await screen.setup(page);

    const outPath = path.join(OUT_DIR, `${screen.name}.png`);
    await page.screenshot({ path: outPath, fullPage: false });

    // Verify via PNG header
    const buf = fs.readFileSync(outPath);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    const ok = w === 1284 && h === 2778;
    console.log(`  ${ok ? "✅" : "❌"} ${screen.name}.png — ${w}×${h}${ok ? " ✓" : " (expected 1284×2778)"}`);
  }

  await browser.close();
  console.log(`\n✅ Done — screenshots in ${OUT_DIR}`);
  console.log("Upload to App Store Connect → iPhone 6.7\" Display screenshots");
}

main().catch(e => { console.error(e); process.exit(1); });
