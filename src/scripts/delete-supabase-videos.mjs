import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "tour-it-videos";

async function listAllFiles(prefix = "") {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    offset: 0,
  });
  if (error) throw new Error(`List error at "${prefix}": ${error.message}`);

  const files = [];
  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      const sub = await listAllFiles(fullPath);
      files.push(...sub);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  console.log("Listing all files in tour-it-videos...");
  const files = await listAllFiles();
  console.log(`Found ${files.length} files`);

  if (files.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  const batchSize = 100;
  let deleted = 0;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) {
      console.error(`Batch error: ${error.message}`);
    } else {
      deleted += batch.length;
      console.log(`Deleted ${deleted}/${files.length}`);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
