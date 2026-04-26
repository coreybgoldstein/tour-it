// Enriches existing Coral Springs, FL course records with web-sourced data.
// Fetches images and uploads to Supabase Storage — never stores external URLs.
// Run: node enrich-courses-coral-springs.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://awlbxzpevwidowxxvuef.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I'
);

function extFromContentType(ct = '') {
  if (ct.includes('svg')) return 'svg';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('png')) return 'png';
  return 'jpg';
}

async function uploadImage(courseId, type, url) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TourItBot/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { console.log(`      image SKIP (HTTP ${res.status}): ${url}`); return null; }
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
    const ext = extFromContentType(ct);
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = `course-images/${courseId}-${type}.${ext}`;
    const { error } = await supabase.storage.from('tour-it-photos').upload(path, buffer, { contentType: ct, upsert: true });
    if (error) { console.log(`      image UPLOAD ERROR: ${error.message}`); return null; }
    const { data: { publicUrl } } = supabase.storage.from('tour-it-photos').getPublicUrl(path);
    return publicUrl;
  } catch (e) {
    console.log(`      image SKIP (${e.message}): ${url}`);
    return null;
  }
}

const enrichments = [

  {
    id: 'b17ecaf5-4868-4624-bd99-50e4b03a333d', // The Country Club of Coral Springs
    courseType: 'SEMI_PRIVATE',
    isPublic: true,
    yearEstablished: 1969,
    zipCode: '33065',
    state: 'FL',
    description: "Designed by Edmund B. Ault and opened in 1969, the Country Club of Coral Springs is one of Broward County's most enduring layouts — an 18-hole, par-71 championship course stretching 6,779 yards from the tips with a slope of 124 and rating of 72.1. The course borders an Everglades conservation area on land once used for vegetable farming and cattle grazing, giving it a quiet, natural parkland feel with manicured fairways and some of the truest greens in South Florida. After decades as a private club, it reopened as semi-private following a full renovation that added a brand-new clubhouse with a bar and grill, pickleball courts, and a fitness center. The refreshed greens and conditions make it one of the best-value semi-private experiences in South Florida.",
    coverImageSrc: 'https://ccofcs.com/wp-content/uploads/2021/05/home-banner.jpg',
    logoImageSrc: 'https://ccofcs.com/wp-content/uploads/2021/05/logo.png',
    isVerified: true,
  },

  {
    id: '729912fc-306d-452c-afb2-049cbc0f9a45', // Eagle Trace Golf Club
    courseType: 'SEMI_PRIVATE',
    isPublic: true,
    yearEstablished: 1983,
    zipCode: '33071',
    state: 'FL',
    description: "Designed by Arthur Hills and opened in 1983 as the second club in the PGA Tour's Tournament Players Club network, Eagle Trace is a 7,040-yard, par-72 championship course that hosted the Honda Classic nine times from 1984 through 1996. Hills brought a Scottish links sensibility to South Florida — gently rolling terrain with relatively few trees — but tempered it with water on 16 of 18 holes, making course management the defining challenge. Now operated by ClubLink with both daily-fee and membership access, the course carries a slope of 134 and rating of 74.0, making it one of the most demanding public-access layouts in Broward County. The TPC pedigree and Honda Classic history give it a championship atmosphere that's rare for a semi-private track.",
    coverImageSrc: 'https://golf-pass-brightspot.s3.amazonaws.com/20/68/07fa8c4948b0d1ac37cd0d6a69ff/89302.jpg',
    logoImageSrc: 'https://logos.bluegolf.com/eagletracegcsfk/profile.png',
    isVerified: true,
  },

];

async function run() {
  let updated = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const entry of enrichments) {
    const { id, coverImageSrc, logoImageSrc, ...fields } = entry;

    const { data: existing } = await supabase.from('Course').select('id, name').eq('id', id).maybeSingle();
    if (!existing) {
      console.log(`MISS  id=${id} — not found, skipping`);
      failed++;
      continue;
    }

    console.log(`\n${existing.name}`);

    if (coverImageSrc) {
      process.stdout.write('  cover  ... ');
      const url = await uploadImage(id, 'cover', coverImageSrc);
      if (url) { fields.coverImageUrl = url; console.log('OK'); }
    }

    if (logoImageSrc) {
      process.stdout.write('  logo   ... ');
      const url = await uploadImage(id, 'logo', logoImageSrc);
      if (url) { fields.logoUrl = url; console.log('OK'); }
    }

    const { error } = await supabase.from('Course').update({ ...fields, updatedAt: now }).eq('id', id);
    if (error) {
      console.error(`  DB ERROR: ${error.message}`);
      failed++;
    } else {
      console.log(`  saved`);
      updated++;
    }
  }

  console.log(`\nDone — ${updated} updated, ${failed} failed/missed.`);
}

run().catch(console.error);
