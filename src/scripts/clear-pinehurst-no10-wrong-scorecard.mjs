#!/usr/bin/env node
/**
 * One-off cleanup: the seed-scorecards-from-api pass matched the new Pinehurst
 * No. 10 row to GolfCourseAPI's "Pinehurst Cc/No. 8" record (No. 10 isn't in
 * the API yet — opened May 2024). That gave us wrong per-hole yardages.
 * Clear them so the holes show null until a real scorecard is sourced.
 */

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PINEHURST_NO10 = "5ab93b48-963f-4780-96e3-8ec389c52341";

const { error } = await sb
  .from("Hole")
  .update({ par: 4, yardage: null, handicapRank: null, updatedAt: new Date().toISOString() })
  .eq("courseId", PINEHURST_NO10);

if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}
console.log("Cleared per-hole yardage/handicapRank for Pinehurst No. 10 (was wrongly populated from No. 8 in API).");
