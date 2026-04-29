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
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

// Fetch an image and upload to Supabase Storage, return the public URL or null
async function uploadImage(externalUrl, storagePath) {
  try {
    const res = await fetch(externalUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) {
      console.log(`    ⚠ Fetch failed (${res.status}): ${externalUrl}`);
      return null;
    }
    const ext = externalUrl.split("?")[0].split(".").pop()?.toLowerCase();
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const buffer = await res.arrayBuffer();
    const { error } = await supabase.storage
      .from("tour-it-photos")
      .upload(storagePath, buffer, { contentType, upsert: true });
    if (error) {
      console.log(`    ⚠ Upload failed: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from("tour-it-photos").getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err) {
    console.log(`    ⚠ Image error: ${err.message}`);
    return null;
  }
}

async function seedHoles(courseId) {
  const { count } = await supabase.from("Hole").select("id", { count: "exact", head: true }).eq("courseId", courseId);
  if (count > 0) return;
  const now = new Date().toISOString();
  const holes = Array.from({ length: 18 }, (_, i) => ({
    id: randomUUID(), courseId, holeNumber: i + 1, par: 4, uploadCount: 0, createdAt: now, updatedAt: now,
  }));
  const { error } = await supabase.from("Hole").insert(holes);
  if (error) console.log(`    ⚠ Hole insert failed: ${error.message}`);
  else console.log(`    Created 18 holes`);
}

const COURSES = [
  {
    existingId: "22f3e18e-53f9-475f-a7ec-9275a9f03d85",
    name: "Plantation Preserve Golf Course & Club",
    city: "Plantation",
    state: "FL",
    zipCode: "33317",
    yearEstablished: 2006,
    courseType: "PUBLIC",
    isPublic: true,
    description: "Designed by vonHagge, Smelek & Baril and opened in February 2006, Plantation Preserve is a city-owned par-72 layout stretching 7,148 yards through 55 acres of Everglades-inspired wetlands at 7050 West Broward Boulevard. The course features a signature island green on the 9th, a split fairway on the 14th, and Paspalum turf maintained to private club standards — without the membership fee.",
    coverExternalUrl: "https://ttusa.s3.amazonaws.com/images/gallery/11312/i11312.jpg",
    logoExternalUrl: "https://ttusa.s3.amazonaws.com/images/gallery/_logos/l11312.jpg",
  },
  {
    existingId: null,
    name: "Palm Aire Country Club Oaks Course",
    city: "Sarasota",
    state: "FL",
    zipCode: "34243",
    yearEstablished: 1971,
    courseType: "PRIVATE",
    isPublic: false,
    description: "Tom and George Fazio designed the Oaks Course at Palm Aire Country Club, opened in 1971 as part of Sarasota's first private golf community. Playing 6,910 yards from the tips at par 71, the Oaks rewards precision over power with tree-lined fairways, subtle greens, and the kind of quiet difficulty that made the Fazios' early Florida work so respected.",
    coverExternalUrl: "https://naplesgolfguy.com/wp-content/uploads/2024/05/Palm-Aire-CC-Golf.jpeg",
    logoExternalUrl: "https://logos.bluegolf.com/palmairecc/profile.png",
  },
  {
    existingId: null,
    name: "Palm Aire Country Club Cypress Course",
    city: "Sarasota",
    state: "FL",
    zipCode: "34243",
    yearEstablished: 1972,
    courseType: "PRIVATE",
    isPublic: false,
    description: "The Cypress Course at Palm Aire Country Club is a Tom and George Fazio design from 1972, offering 6,810 yards of par-72 golf across classic Florida terrain with mature tree lines and strategic water hazards. Five sets of tees — resurfaced with TifEagle bermudagrass — give members flexibility without softening the Fazio challenge embedded in the routing.",
    coverExternalUrl: "https://naplesgolfguy.com/wp-content/uploads/2024/05/Palm-Aire-Golf-Course.jpeg",
    logoExternalUrl: "https://logos.bluegolf.com/palmairecccypressc/profile.png",
  },
  {
    existingId: null,
    name: "Palm Aire Country Club Palms Course",
    city: "Sarasota",
    state: "FL",
    zipCode: "34243",
    yearEstablished: 1959,
    courseType: "PRIVATE",
    isPublic: false,
    description: "The Palms is the original course at Palm Aire Country Club, laid out by William Mitchell in 1959 when founders George Palmer and Harold Broiler first developed the property. At 6,944 yards and par 72 it's the longest of the three Palm Aire layouts, with wide fairways and resurfaced TifEagle greens that reward a patient ground-game approach.",
    coverExternalUrl: "https://naplesgolfguy.com/wp-content/uploads/2024/05/Palm-Aire-Golf-Club.jpeg",
    logoExternalUrl: "https://logos.bluegolf.com/palmairecc/profile.png",
  },
];

async function main() {
  console.log("Seeding courses...\n");

  for (const course of COURSES) {
    console.log(`→ ${course.name}`);
    const slug = slugify(course.name);

    // Upload images
    console.log(`  Uploading cover...`);
    const coverUrl = await uploadImage(course.coverExternalUrl, `course-images/${slug}-cover.jpg`);
    console.log(`  Uploading logo...`);
    const logoUrl = await uploadImage(course.logoExternalUrl, `course-images/${slug}-logo.png`);

    const now = new Date().toISOString();

    if (course.existingId) {
      // Update existing record
      const update = {
        description: course.description,
        yearEstablished: course.yearEstablished,
        courseType: course.courseType,
        isPublic: course.isPublic,
        updatedAt: now,
      };
      if (coverUrl) update.coverImageUrl = coverUrl;
      if (logoUrl) update.logoUrl = logoUrl;

      const { error } = await supabase.from("Course").update(update).eq("id", course.existingId);
      if (error) console.log(`  ✗ Update failed: ${error.message}`);
      else console.log(`  ✅ Updated (id: ${course.existingId})`);
    } else {
      // Insert new record (upsert on slug)
      const record = {
        id: randomUUID(),
        name: course.name,
        slug,
        city: course.city,
        state: course.state,
        country: "US",
        zipCode: course.zipCode,
        description: course.description,
        coverImageUrl: coverUrl,
        logoUrl: logoUrl,
        yearEstablished: course.yearEstablished,
        courseType: course.courseType,
        isPublic: course.isPublic,
        isVerified: false,
        holeCount: 18,
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
        console.log(`  ✗ Upsert failed: ${error.message}`);
        continue;
      }

      console.log(`  ✅ Inserted (id: ${data.id})`);
      await seedHoles(data.id);
    }

    console.log(`  Cover: ${coverUrl ?? "null (not uploaded)"}`);
    console.log(`  Logo:  ${logoUrl ?? "null (not uploaded)"}`);
    console.log();
  }

  console.log("Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
