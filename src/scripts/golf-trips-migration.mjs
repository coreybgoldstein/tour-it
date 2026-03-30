/**
 * Golf Trips Migration — Tour It
 *
 * Creates GolfTrip, GolfTripCourse, GolfTripMember tables and
 * adds tripId + tripPublic columns to Upload.
 *
 * Usage: node src/scripts/golf-trips-migration.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🏌️  Tour It — Golf Trips Migration");
  console.log("=====================================\n");

  // GolfTrip
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "GolfTrip" (
      "id"          TEXT PRIMARY KEY,
      "name"        TEXT NOT NULL,
      "description" TEXT,
      "startDate"   TEXT,
      "endDate"     TEXT,
      "createdBy"   TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      "createdAt"   TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✓ GolfTrip table ready");

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "GolfTrip_createdBy_idx" ON "GolfTrip"("createdBy");
  `);

  // GolfTripCourse
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "GolfTripCourse" (
      "id"            TEXT PRIMARY KEY,
      "tripId"        TEXT NOT NULL REFERENCES "GolfTrip"(id) ON DELETE CASCADE,
      "courseId"      TEXT NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
      "playDate"      TEXT,
      "teeTime"       TEXT,
      "accommodation" TEXT,
      "sortOrder"     INTEGER DEFAULT 0,
      "createdAt"     TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✓ GolfTripCourse table ready");

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "GolfTripCourse_tripId_idx" ON "GolfTripCourse"("tripId");
  `);

  // GolfTripMember
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "GolfTripMember" (
      "id"        TEXT PRIMARY KEY,
      "tripId"    TEXT NOT NULL REFERENCES "GolfTrip"(id) ON DELETE CASCADE,
      "userId"    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      "role"      TEXT DEFAULT 'member',
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE("tripId", "userId")
    );
  `);
  console.log("✓ GolfTripMember table ready");

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "GolfTripMember_tripId_idx" ON "GolfTripMember"("tripId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "GolfTripMember_userId_idx" ON "GolfTripMember"("userId");
  `);

  // Add tripId and tripPublic to Upload
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Upload"
      ADD COLUMN IF NOT EXISTS "tripId" TEXT REFERENCES "GolfTrip"(id) ON DELETE SET NULL;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Upload"
      ADD COLUMN IF NOT EXISTS "tripPublic" BOOLEAN NOT NULL DEFAULT TRUE;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Upload_tripId_idx" ON "Upload"("tripId");
  `);
  console.log("✓ Upload.tripId and Upload.tripPublic columns ready");

  console.log("\n✅ Golf Trips migration complete.\n");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
