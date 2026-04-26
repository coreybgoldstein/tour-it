// Fixes logo issues for Miami courses:
// - Uploads real Trump National Doral logo to Supabase Storage for all 3 Doral records
// - Nulls generic Miami-Dade system logos on Briar Bay and Palmetto
// Run: node fix-miami-logos.mjs
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
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TourItBot/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
  const ext = extFromContentType(ct);
  const buffer = Buffer.from(await res.arrayBuffer());
  const path = `course-images/${courseId}-${type}.${ext}`;
  const { error } = await supabase.storage.from('tour-it-photos').upload(path, buffer, { contentType: ct, upsert: true });
  if (error) throw new Error(error.message);
  const { data: { publicUrl } } = supabase.storage.from('tour-it-photos').getPublicUrl(path);
  return publicUrl;
}

async function run() {
  const now = new Date().toISOString();

  // Trump National Doral logo — same logo for all 3 Doral course records
  const doralLogoSrc = 'https://ttusa.s3.amazonaws.com/images/gallery/_logos/l1401.jpg';
  const doralIds = [
    { id: '0d95e33a-9ad7-4211-b83b-1a5edb3e9e55', name: 'TPC Blue Monster' },
    { id: '4d7cd615-3a23-4081-84d2-501c40aae59c', name: 'Trump National Doral' },
    { id: '3d3dd8b4-9782-45a7-9e4e-905ccd68ffee', name: 'Silver Fox Course' },
  ];

  for (const { id, name } of doralIds) {
    process.stdout.write(`logo   ${name} ... `);
    try {
      const url = await uploadImage(id, 'logo', doralLogoSrc);
      const { error } = await supabase.from('Course').update({ logoUrl: url, updatedAt: now }).eq('id', id);
      if (error) throw new Error(error.message);
      console.log('OK');
    } catch (e) {
      console.log(`FAIL (${e.message})`);
    }
  }

  // Null out generic Miami-Dade system logos — these courses have no club-specific logo
  const clearIds = [
    { id: '56221ded-5c57-43a2-8a79-eb9436759741', name: 'Briar Bay Golf Course' },
    { id: '6c5804de-8ca0-4ec6-86a2-bba759b0b606', name: 'Palmetto Golf Course' },
  ];

  for (const { id, name } of clearIds) {
    process.stdout.write(`clear  ${name} logo ... `);
    const { error } = await supabase.from('Course').update({ logoUrl: null, updatedAt: now }).eq('id', id);
    console.log(error ? `FAIL (${error.message})` : 'OK');
  }

  console.log('\nDone.');
}

run().catch(console.error);
