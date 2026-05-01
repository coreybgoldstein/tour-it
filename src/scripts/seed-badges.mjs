// seed-badges.mjs — inserts the badge catalog into the Badge table.
// Idempotent: upserts on slug so it's safe to re-run.
//
// Usage: node seed-badges.mjs

import "dotenv/config";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 10000 });

const BADGES = [
  // Contribution — clip count
  { slug: "first_clip",        name: "First Scout",      description: "Upload your first clip.",                          category: "CONTRIBUTION", rarity: "COMMON",    pointValue: 0, requirement: { type: "upload_count", threshold: 1 } },
  { slug: "5_clips",           name: "Getting Started",  description: "Upload 5 clips.",                                  category: "CONTRIBUTION", rarity: "COMMON",    pointValue: 0, requirement: { type: "upload_count", threshold: 5 } },
  { slug: "10_clips",          name: "Regular Scout",    description: "Upload 10 clips.",                                 category: "CONTRIBUTION", rarity: "UNCOMMON",  pointValue: 0, requirement: { type: "upload_count", threshold: 10 } },
  { slug: "25_clips",          name: "Dedicated Scout",  description: "Upload 25 clips.",                                 category: "CONTRIBUTION", rarity: "RARE",      pointValue: 0, requirement: { type: "upload_count", threshold: 25 } },
  { slug: "50_clips",          name: "Pro Scout",        description: "Upload 50 clips.",                                 category: "CONTRIBUTION", rarity: "EPIC",      pointValue: 0, requirement: { type: "upload_count", threshold: 50 } },
  { slug: "100_clips",         name: "Legend Scout",     description: "Upload 100 clips.",                                category: "CONTRIBUTION", rarity: "LEGENDARY", pointValue: 0, requirement: { type: "upload_count", threshold: 100 } },
  // Explorer — firsts
  { slug: "course_pioneer",    name: "Course Pioneer",   description: "Be the first to upload a clip on any course.",     category: "EXPLORER",     rarity: "UNCOMMON",  pointValue: 0, requirement: { type: "first_on_course" } },
  { slug: "hole_trailblazer",  name: "Hole Trailblazer", description: "Be the first to upload a clip on any hole.",       category: "EXPLORER",     rarity: "UNCOMMON",  pointValue: 0, requirement: { type: "first_on_hole" } },
  // Explorer — course count
  { slug: "5_courses",         name: "Explorer",         description: "Upload clips at 5 different courses.",             category: "EXPLORER",     rarity: "UNCOMMON",  pointValue: 0, requirement: { type: "course_count", threshold: 5 } },
  { slug: "10_courses",        name: "Road Warrior",     description: "Upload clips at 10 different courses.",            category: "EXPLORER",     rarity: "RARE",      pointValue: 0, requirement: { type: "course_count", threshold: 10 } },
  { slug: "25_courses",        name: "Globetrotter",     description: "Upload clips at 25 different courses.",            category: "EXPLORER",     rarity: "EPIC",      pointValue: 0, requirement: { type: "course_count", threshold: 25 } },
  // Social — likes
  { slug: "popular_clip",      name: "Going Places",     description: "One of your clips hits 10 likes.",                 category: "SOCIAL",       rarity: "COMMON",    pointValue: 0, requirement: { type: "clip_likes", threshold: 10 } },
  { slug: "viral_clip",        name: "Going Viral",      description: "One of your clips hits 100 likes.",                category: "SOCIAL",       rarity: "RARE",      pointValue: 0, requirement: { type: "clip_likes", threshold: 100 } },
  { slug: "legendary_clip",    name: "Legendary",        description: "One of your clips hits 1,000 likes.",              category: "SOCIAL",       rarity: "LEGENDARY", pointValue: 0, requirement: { type: "clip_likes", threshold: 1000 } },
  // Social — followers
  { slug: "10_followers",      name: "Rising Star",      description: "Reach 10 followers.",                              category: "SOCIAL",       rarity: "COMMON",    pointValue: 0, requirement: { type: "follower_count", threshold: 10 } },
  { slug: "100_followers",     name: "Influencer",       description: "Reach 100 followers.",                             category: "SOCIAL",       rarity: "RARE",      pointValue: 0, requirement: { type: "follower_count", threshold: 100 } },
];

async function run() {
  const client = await db.connect();
  let inserted = 0, updated = 0;

  try {
    for (const b of BADGES) {
      const req = JSON.stringify(b.requirement);
      const { rowCount } = await client.query(
        `INSERT INTO "Badge" (id, slug, name, description, category, rarity, "pointValue", requirement, "createdAt")
         VALUES ($1, $2, $3, $4, $5::\"BadgeCategory\", $6::\"BadgeRarity\", $7, $8, NOW())
         ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name,
               description = EXCLUDED.description,
               category = EXCLUDED.category,
               rarity = EXCLUDED.rarity,
               "pointValue" = EXCLUDED."pointValue",
               requirement = EXCLUDED.requirement`,
        [crypto.randomUUID(), b.slug, b.name, b.description, b.category, b.rarity, b.pointValue, req]
      );
      if (rowCount === 1) inserted++;
      else updated++;
    }
    console.log(`Done. ${inserted} inserted, ${updated} updated. Total: ${BADGES.length} badges.`);
  } finally {
    client.release();
    await db.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
