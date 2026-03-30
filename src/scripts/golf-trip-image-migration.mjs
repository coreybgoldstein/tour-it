import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  console.log("🏌️  Tour It — Golf Trip Image Migration");
  await prisma.$executeRawUnsafe(`ALTER TABLE "GolfTrip" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;`);
  console.log("✓ GolfTrip.imageUrl column ready");
  console.log("\n✅ Migration complete.\n");
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
