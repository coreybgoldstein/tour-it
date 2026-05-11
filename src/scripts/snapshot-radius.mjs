// Snapshot the data state of the radius cohort for before/after diffs.
// Not committed.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const [, , idsFile, outFile] = process.argv;
const ids = readFileSync(idsFile, "utf8").split(/\s+/).filter(Boolean);

const all = [];
const CHUNK = 200;
for (let i = 0; i < ids.length; i += CHUNK) {
  const slice = ids.slice(i, i + CHUNK);
  const { data, error } = await supabase
    .from("Course")
    .select(
      "id, name, city, state, description, coverImageUrl, logoUrl, yearEstablished, courseType, websiteUrl, latitude, longitude"
    )
    .in("id", slice);
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  all.push(...(data || []));
}

const summary = {
  total: all.length,
  withDescription: all.filter((c) => c.description).length,
  withCover: all.filter((c) => c.coverImageUrl).length,
  withLogo: all.filter((c) => c.logoUrl).length,
  withYear: all.filter((c) => c.yearEstablished).length,
  withType: all.filter((c) => c.courseType).length,
  withWebsite: all.filter((c) => c.websiteUrl).length,
  withLatLng: all.filter((c) => c.latitude && c.longitude).length,
};

console.error(JSON.stringify(summary, null, 2));
writeFileSync(
  outFile,
  JSON.stringify(
    {
      summary,
      rows: all.map((c) => ({
        id: c.id,
        name: c.name,
        city: c.city,
        state: c.state,
        hasDescription: !!c.description,
        hasCover: !!c.coverImageUrl,
        hasLogo: !!c.logoUrl,
        hasYear: !!c.yearEstablished,
        hasType: !!c.courseType,
        hasWebsite: !!c.websiteUrl,
        hasLatLng: !!(c.latitude && c.longitude),
        logoUrl: c.logoUrl || null,
      })),
    },
    null,
    2
  )
);
console.error(`Wrote ${outFile}`);
