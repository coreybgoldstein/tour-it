import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import { randomUUID } from "crypto";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

async function uploadImage(externalUrl, storagePath) {
  try {
    const res = await fetch(externalUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.rivervalecc.com/",
      },
    });
    if (!res.ok) {
      console.log(`  ⚠ Fetch failed (${res.status}): ${externalUrl}`);
      return null;
    }
    const ext = externalUrl.split("?")[0].split(".").pop()?.toLowerCase();
    const contentType =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const buffer = await res.arrayBuffer();
    const { error } = await supabase.storage
      .from("tour-it-photos")
      .upload(storagePath, buffer, { contentType, upsert: true });
    if (error) {
      console.log(`  ⚠ Upload failed: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage
      .from("tour-it-photos")
      .getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err) {
    console.log(`  ⚠ Image error: ${err.message}`);
    return null;
  }
}

async function seedHoles(courseId) {
  const { count } = await supabase
    .from("Hole")
    .select("id", { count: "exact", head: true })
    .eq("courseId", courseId);
  if (count > 0) {
    console.log(`  Holes already exist (${count}), skipping`);
    return;
  }
  const now = new Date().toISOString();
  const holes = Array.from({ length: 18 }, (_, i) => ({
    id: randomUUID(),
    courseId,
    holeNumber: i + 1,
    par: 4,
    uploadCount: 0,
    createdAt: now,
    updatedAt: now,
  }));
  const { error } = await supabase.from("Hole").insert(holes);
  if (error) console.log(`  ⚠ Hole insert failed: ${error.message}`);
  else console.log(`  Created 18 holes`);
}

const COURSE = {
  name: "River Vale Country Club",
  city: "River Vale",
  state: "NJ",
  country: "US",
  zipCode: "07675",
  latitude: 41.0256410235,
  longitude: -74.0086859465,
  websiteUrl: "https://www.rivervalecc.com",
  phone: "(201) 391-2300",
  yearEstablished: 1931,
  courseType: "SEMI_PRIVATE",
  isPublic: true,
  holeCount: 18,
  description:
    "Designed by Orrin E. Smith and opened in 1931 — formerly known as Bergen Hills Country Club — River Vale CC sits on the gently rolling terrain at the edge of Lake Tappan in Bergen County. The par-72 layout stretches 6,504 yards with seventeen straight-line fairways demanding accuracy over power, punctuated by the hard-left dogleg 13th and a demanding 9th with water fronting the green. Routinely voted Best Public Course in Bergen County, it plays like a private club at a daily-fee price.",
  coverExternalUrl:
    "https://www.rivervalecc.com/wp-content/uploads/sites/6728/2018/01/drone-scott-3.jpg",
  logoExternalUrl: "https://logos.bluegolf.com/rivervale/profile.png",
};

async function main() {
  const slug = slugify(COURSE.name);
  console.log(`\n→ ${COURSE.name} (slug: ${slug})`);

  // Check if already exists
  const { data: existing } = await supabase
    .from("Course")
    .select("id, name, description, coverImageUrl, logoUrl, yearEstablished, courseType")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    console.log(`  Record already exists (id: ${existing.id})`);
    console.log(`  Before:`, JSON.stringify(existing, null, 2));

    // Only update null fields
    const update = {};
    if (!existing.description) update.description = COURSE.description;
    if (!existing.yearEstablished) update.yearEstablished = COURSE.yearEstablished;
    if (!existing.courseType) update.courseType = COURSE.courseType;

    if (!existing.coverImageUrl) {
      console.log(`  Uploading cover...`);
      const coverUrl = await uploadImage(
        COURSE.coverExternalUrl,
        `course-images/${slug}-cover.jpg`
      );
      if (coverUrl) update.coverImageUrl = coverUrl;
      console.log(`  Cover: ${coverUrl ?? "null"}`);
    }

    if (!existing.logoUrl) {
      console.log(`  Uploading logo...`);
      const logoUrl = await uploadImage(
        COURSE.logoExternalUrl,
        `course-images/${slug}-logo.png`
      );
      if (logoUrl) update.logoUrl = logoUrl;
      console.log(`  Logo: ${logoUrl ?? "null"}`);
    }

    if (Object.keys(update).length > 0) {
      update.updatedAt = new Date().toISOString();
      const { error } = await supabase.from("Course").update(update).eq("id", existing.id);
      if (error) console.log(`  ✗ Update failed: ${error.message}`);
      else console.log(`  ✅ Updated fields: ${Object.keys(update).join(", ")}`);
    } else {
      console.log(`  All fields already populated — no update needed`);
    }

    return;
  }

  // Not in DB — insert
  console.log(`  Not found in DB — inserting...`);

  console.log(`  Uploading cover...`);
  const coverUrl = await uploadImage(
    COURSE.coverExternalUrl,
    `course-images/${slug}-cover.jpg`
  );
  console.log(`  Cover: ${coverUrl ?? "null"}`);

  console.log(`  Uploading logo...`);
  const logoUrl = await uploadImage(
    COURSE.logoExternalUrl,
    `course-images/${slug}-logo.png`
  );
  console.log(`  Logo: ${logoUrl ?? "null"}`);

  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    name: COURSE.name,
    slug,
    city: COURSE.city,
    state: COURSE.state,
    country: COURSE.country,
    zipCode: COURSE.zipCode,
    latitude: COURSE.latitude,
    longitude: COURSE.longitude,
    websiteUrl: COURSE.websiteUrl,
    phone: COURSE.phone,
    description: COURSE.description,
    coverImageUrl: coverUrl,
    logoUrl: logoUrl,
    yearEstablished: COURSE.yearEstablished,
    courseType: COURSE.courseType,
    isPublic: COURSE.isPublic,
    isVerified: false,
    holeCount: COURSE.holeCount,
    uploadCount: 0,
    saveCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const { data, error } = await supabase
    .from("Course")
    .upsert(record, { onConflict: "slug", ignoreDuplicates: false })
    .select("id")
    .single();

  if (error) {
    console.log(`  ✗ Insert failed: ${error.message}`);
    return;
  }

  console.log(`  ✅ Inserted (id: ${data.id})`);
  await seedHoles(data.id);

  console.log(`\nFinal record:`);
  const { data: final } = await supabase
    .from("Course")
    .select("id, name, slug, city, state, zipCode, latitude, longitude, yearEstablished, courseType, coverImageUrl, logoUrl, description")
    .eq("id", data.id)
    .single();
  console.log(JSON.stringify(final, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
