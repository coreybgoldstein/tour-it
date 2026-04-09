import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

config();

const prisma = new PrismaClient();

const courses = await prisma.course.findMany({
  select: {
    name: true,
    city: true,
    state: true,
    country: true,
    isPublic: true,
    holeCount: true,
    uploadCount: true,
  },
  orderBy: [{ state: 'asc' }, { name: 'asc' }],
});

const escape = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const header = ['Name', 'City', 'State', 'Country', 'Type', 'Holes', 'Clips'];
const rows = courses.map(c => [
  escape(c.name),
  escape(c.city),
  escape(c.state),
  escape(c.country),
  c.isPublic ? 'Public' : c.isPublic === false ? 'Private' : 'Unknown',
  escape(c.holeCount),
  escape(c.uploadCount),
]);

const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
writeFileSync('tour-it-courses.csv', csv, 'utf8');

console.log(`Exported ${courses.length} courses to tour-it-courses.csv`);
await prisma.$disconnect();
