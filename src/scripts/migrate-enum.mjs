import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function run() {
  const sqls = [
    `ALTER TYPE "ShotType" ADD VALUE IF NOT EXISTS 'FRONT_NINE'`,
    `ALTER TYPE "ShotType" ADD VALUE IF NOT EXISTS 'BACK_NINE'`,
    `ALTER TYPE "ShotType" ADD VALUE IF NOT EXISTS 'FULL_ROUND'`,
    `ALTER TYPE "ShotType" ADD VALUE IF NOT EXISTS 'THREE_HOLE'`,
  ];
  for (const sql of sqls) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('OK:', sql.slice(38));
    } catch(e) {
      console.log('ERR:', e.message);
    }
  }
  await prisma.$disconnect();
}

run();
