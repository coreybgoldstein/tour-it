// Fetches external course images, uploads to Supabase Storage, updates DB URLs.
// Run: node migrate-course-images.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://awlbxzpevwidowxxvuef.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I'
);

function extFromContentType(ct, fallback = 'jpg') {
  if (!ct) return fallback;
  if (ct.includes('svg')) return 'svg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  return 'jpg';
}

async function fetchImage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TourItBot/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/') && !ct.includes('svg')) return { error: `Not an image (${ct})` };
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType: ct.split(';')[0].trim(), ext: extFromContentType(ct) };
  } catch (e) {
    return { error: e.message };
  }
}

async function uploadAndGetUrl(courseId, type, buffer, contentType, ext) {
  const path = `course-images/${courseId}-${type}.${ext}`;
  const { error } = await supabase.storage.from('tour-it-photos').upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) return { error: error.message };
  const { data: { publicUrl } } = supabase.storage.from('tour-it-photos').getPublicUrl(path);
  return { publicUrl };
}

async function run() {
  // Fetch all courses with external image URLs
  const { data: courses, error } = await supabase
    .from('Course')
    .select('id, name, coverImageUrl, logoUrl')
    .or('coverImageUrl.not.is.null,logoUrl.not.is.null');

  if (error) { console.error('Query failed:', error.message); return; }

  const targets = courses.filter(c =>
    (c.coverImageUrl && !c.coverImageUrl.includes('supabase.co')) ||
    (c.logoUrl && !c.logoUrl.includes('supabase.co'))
  );

  console.log(`Found ${targets.length} courses with external image URLs\n`);

  let updated = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const course of targets) {
    const updates = {};

    if (course.coverImageUrl && !course.coverImageUrl.includes('supabase.co')) {
      process.stdout.write(`  cover  ${course.name} ... `);
      const img = await fetchImage(course.coverImageUrl);
      if (img.error) {
        console.log(`SKIP (${img.error})`);
        failed++;
      } else {
        const up = await uploadAndGetUrl(course.id, 'cover', img.buffer, img.contentType, img.ext);
        if (up.error) {
          console.log(`UPLOAD ERROR (${up.error})`);
          failed++;
        } else {
          updates.coverImageUrl = up.publicUrl;
          console.log(`OK`);
        }
      }
    }

    if (course.logoUrl && !course.logoUrl.includes('supabase.co')) {
      process.stdout.write(`  logo   ${course.name} ... `);
      const img = await fetchImage(course.logoUrl);
      if (img.error) {
        console.log(`SKIP (${img.error})`);
        failed++;
      } else {
        const up = await uploadAndGetUrl(course.id, 'logo', img.buffer, img.contentType, img.ext);
        if (up.error) {
          console.log(`UPLOAD ERROR (${up.error})`);
          failed++;
        } else {
          updates.logoUrl = up.publicUrl;
          console.log(`OK`);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase.from('Course').update({ ...updates, updatedAt: now }).eq('id', course.id);
      if (upErr) {
        console.error(`  DB update failed for ${course.name}:`, upErr.message);
        failed++;
      } else {
        updated++;
      }
    }
  }

  console.log(`\nDone — ${updated} courses updated, ${failed} images failed/skipped.`);
}

run().catch(console.error);
