// Enriches existing Miami, FL course records with web-sourced data.
// Fetches images and uploads to Supabase Storage — never stores external URLs.
// Run: node enrich-courses-miami.mjs
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
    id: '0d95e33a-9ad7-4211-b83b-1a5edb3e9e55', // TPC Blue Monster (Blue Monster at Trump National Doral)
    courseType: 'PUBLIC',
    isPublic: true,
    yearEstablished: 1962,
    zipCode: '33178',
    description: "The Blue Monster is the flagship course of Trump National Doral, designed by Dick Wilson in 1962 and comprehensively overhauled by Gil Hanse and Jim Wagner in 2014 — a restoration that stripped away decades of questionable modifications and returned the layout to its original aggressive character. Playing 7,590 yards from the tips with a rating of 76.8 and a slope of 143, the course features deep Bermuda rough, brilliantly placed bunkers, and water on nearly every hole. The par-4 18th — 473 yards of risk-reward finishing drama — has been recognized by Golf Magazine as one of the 100 greatest holes in the world. The course hosted the PGA Tour's Doral Open and its WGC successor for 54 consecutive years, from 1962 through 2016, and is now the annual host of LIV Golf's Miami event. Hanse's clean architectural hand and the course's championship heritage make this one of the most compelling resort rounds in Florida.",
    coverImageSrc: 'https://golf-pass-brightspot.s3.amazonaws.com/d2/54/9a78a3136c7c5b79230fe587892c/122726.jpg',
    logoImageSrc: null,
    isVerified: true,
  },

  {
    id: '4d7cd615-3a23-4081-84d2-501c40aae59c', // Trump National Doral (resort-level record)
    courseType: 'PUBLIC',
    isPublic: true,
    yearEstablished: 1962,
    zipCode: '33178',
    description: "Trump National Doral is a 650-acre resort golf complex in western Miami, founded by Alfred and Doris Kaskel in 1962 when they transformed Everglades farmland into one of Florida's first destination golf resorts. The property houses four 18-hole championship courses: the Blue Monster (Dick Wilson, 1962; Gil Hanse renovation 2014), the Golden Palm (Robert von Hagge), the Red Tiger, and the Silver Fox (Bruce Devlin/Robert von Hagge, 1984; Gil Hanse redesign 2014). All four courses are open to the public, making this the largest public resort golf operation in South Florida. The Blue Monster's PGA Tour legacy defines the property's identity, but the Silver Fox — 16 water holes, slope of 143 — is a genuine championship test that rarely gets its due.",
    coverImageSrc: 'https://golf-pass-brightspot.s3.amazonaws.com/82/81/bae902c727124cc73fff72e61592/122710.jpg',
    logoImageSrc: null,
    isVerified: true,
  },

  {
    id: '3d3dd8b4-9782-45a7-9e4e-905ccd68ffee', // Silver Fox Course at Trump National Doral
    courseType: 'PUBLIC',
    isPublic: true,
    yearEstablished: 1984,
    zipCode: '33178',
    description: "The Silver Fox traces its lineage to 1984, when Bruce Devlin and Robert von Hagge built it as the Doral Park Country Club Silver Course. The layout passed through a Jerry Pate renovation (1998) and a Jim McLean redesign (2009) before Gil Hanse and Jim Wagner completed a comprehensive overhaul that reopened in December 2014. The current layout plays 6,557 yards to a par 70 with a slope of 143 and a rating of 72.8 — deceptively difficult numbers for a shorter course that sends water into play on 16 of 18 holes. Marble-white bunkers and Celebration Bermuda fairways that roll and undulate in atypical South Florida fashion make this one of the better resort support courses in the state, far more than just an alternative to the Blue Monster.",
    coverImageSrc: 'https://golf-pass-brightspot.s3.amazonaws.com/03/a9/6447684eff278accc540d08a6c19/122712.jpg',
    logoImageSrc: null,
    isVerified: true,
  },

  {
    id: 'e8be4191-c2df-44c0-9dea-59367497c500', // Deering Bay Yacht & Country Club — city corrected to Coral Gables
    courseType: 'PRIVATE',
    isPublic: false,
    yearEstablished: 1991,
    zipCode: '33158',
    city: 'Coral Gables',
    description: "Deering Bay Yacht & Country Club is the only Arnold Palmer Signature Design course in South Florida with direct bay frontage, laid out along the southern shoreline of Biscayne Bay at the tip of Coral Gables. The property traces its roots to 1956 as Kings Bay Country Club; the current club was established in 1991 and the Arnold Palmer Design team completed a comprehensive renovation in 2007. The course plays 6,740 yards to a par 71, slope 141, rating 72.9 on Bermuda grass, with mangrove-lined fairways and elevated back-nine greens that create a Biscayne Bay feel genuinely unlike any other South Florida private club. A thoroughly members-only operation with tee times rarely available to non-members outside of limited reciprocal hotel arrangements.",
    coverImageSrc: 'https://golf-pass-brightspot.s3.amazonaws.com/36/8f/2d0a52ebab060afafb538f742460/32530.jpg',
    logoImageSrc: null,
    isVerified: true,
  },

  {
    id: '83aaf7ca-d352-41e4-ac71-32fef7573e53', // Miccosukee Golf & Country Club
    courseType: 'PUBLIC',
    isPublic: true,
    yearEstablished: 1972,
    zipCode: '33183',
    description: "Miccosukee Golf & Country Club is a 27-hole public facility in southwest Miami's Kendale Lakes neighborhood, opened in February 1972 to a Mark Mahannah design and acquired by the Miccosukee Tribe of Indians of Florida in 2001. Three nine-hole loops — Marlin, Barracuda, and Dolphin — combine into three different 18-hole configurations, with the Marlin/Dolphin combination playing 6,678 yards (slope 129, rating 72.9). Mahannah's routing uses South Florida's flat terrain skillfully, with water hazards and strategic bunkering that have attracted multiple LPGA and PGA Tour events including the Miccosukee Championship. Lighted practice facilities and wide tee time availability make this one of the most-played layouts in Miami-Dade County.",
    coverImageSrc: 'https://golf-pass-brightspot.s3.amazonaws.com/ad/02/4def2ff2373d9383dc8ea4c8ef06/91125.jpg',
    logoImageSrc: 'https://miccosukeegolf.com/wp-content/uploads/sites/114/2025/05/logo.webp',
    isVerified: true,
  },

  {
    id: 'b24d770f-25f4-4919-814f-cbfbd99f70d9', // Killian Greens
    courseType: 'PUBLIC',
    isPublic: true,
    yearEstablished: 1969,
    zipCode: '33176',
    description: "Killian Greens has an unusually layered history: opened in 1969 as Crooked Creek Golf and Country Club, sold to Miami-Dade Parks in 1972, closed in 1983, sat dormant for nearly a decade, and eventually reopened under several names before settling into its current identity around 1999. The 18-hole, par-72 layout plays 6,449 yards (rating 70.1, slope 124) through a residential corridor in the Kendall area of southwest Miami-Dade. Narrow fairways, occasional water hazards, and well-placed sand traps give the course more bite than its rating suggests, particularly for players who stray off the tee. One of the more affordable and most-played daily-fee options in the Miami area.",
    coverImageSrc: 'https://golf-pass-brightspot.s3.amazonaws.com/d8/5e/8ba10c38cad3579f1d1166e17db8/88448.jpg',
    logoImageSrc: 'https://images.squarespace-cdn.com/content/v1/590bc7a615d5dbc6bf3c8344/1493950783581-IEFEAKAIWIXU803XUC8R/Killian+Greens+Logo_White.png?format=1500w',
    isVerified: true,
  },

  {
    id: '56221ded-5c57-43a2-8a79-eb9436759741', // Briar Bay Golf Course
    courseType: 'PUBLIC',
    isPublic: true,
    yearEstablished: 1975,
    zipCode: '33176',
    description: "Briar Bay is a nine-hole, par-31 executive course designed by Bruce Devlin and Robert von Hagge, the same duo behind several full-length championship courses across South Florida. Built in 1974 by developer Alec Courtelis and opened in January 1975, the 30-acre layout was acquired by Miami-Dade County Parks in 1979 and has operated as a public facility ever since. Playing about 1,949 yards from the back tees, the course packs water hazards, bunkers, and elevated greens into a compact routing that punishes inaccuracy despite its modest length — the Devlin/von Hagge green contours and strategic bunkering are design details rarely seen on an executive track. Briar Bay draws more than 30,000 rounds annually, functioning as a genuine gateway course for newer players while remaining honest enough to humble low handicappers.",
    coverImageSrc: 'https://golf-pass-brightspot.s3.amazonaws.com/12/a5/d67324ef37dc314e38337e301d74/125472.jpg',
    logoImageSrc: 'https://www.briarbaygolf.com/wp-content/uploads/sites/9312/2024/01/golf-miamidade.png',
    isVerified: true,
  },

  {
    id: '6c5804de-8ca0-4ec6-86a2-bba759b0b606', // Palmetto Golf Course
    courseType: 'PUBLIC',
    isPublic: true,
    yearEstablished: 1960,
    zipCode: '33157',
    description: "Palmetto Golf Course is a Dick Wilson design — the same architect behind Doral's Blue Monster — opened in December 1960 as a private club and purchased by Miami-Dade County in 1967, when it became a public municipal facility. Wilson's fingerprints show in the serpentine canal system that winds across all 121 acres, bringing water into play on ten of eighteen holes; his preference for course management over power is evident throughout. The par-70 layout plays 6,648 yards (rating 72.2, slope 128) with relatively little architectural modification since the original routing. The signature third hole — a 435-yard par 4 flanked by water and protective bunkers — is a textbook example of Wilson's strategic design philosophy. As one of Miami-Dade's oldest surviving public courses, Palmetto carries a quiet prestige that distinguishes it from the county's more recently built facilities.",
    coverImageSrc: 'https://golf-pass-brightspot.s3.amazonaws.com/24/f3/60e5dc948ff67a0f4fa50d953f6d/128578.jpg',
    logoImageSrc: 'https://www.golfpalmetto.com/wp-content/uploads/sites/9313/2023/12/miami-dade-golf-logo.png',
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
