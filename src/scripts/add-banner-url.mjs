// Run once: adds bannerUrl column to User table
// Usage: node src/scripts/add-banner-url.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT;`
  );
  console.log("✓ bannerUrl column added (or already exists)");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
