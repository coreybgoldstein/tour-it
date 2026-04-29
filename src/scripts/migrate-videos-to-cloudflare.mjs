import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const { Client } = require("pg");

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_STREAM_API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_STREAM_API_TOKEN || !DATABASE_URL) {
  console.error("Missing required env vars");
  process.exit(1);
}

const db = new Client({ connectionString: DATABASE_URL });

async function getCloudflareUploadUrl() {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ maxDurationSeconds: 3600, requireSignedURLs: false }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudflare API error ${res.status}: ${text}`);
  }
  const { result } = await res.json();
  return { uploadUrl: result.uploadURL, uid: result.uid };
}

async function uploadToCloudflare(uploadUrl, videoBuffer, filename) {
  const blob = new Blob([videoBuffer]);
  const form = new FormData();
  form.append("file", blob, filename);

  const res = await fetch(uploadUrl, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload error ${res.status}: ${text}`);
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await db.connect();
  console.log("Connected to DB");

  const { rows } = await db.query(
    `SELECT id, "mediaUrl" FROM "Upload"
     WHERE "mediaType" = 'VIDEO'
       AND ("cloudflareVideoId" IS NULL OR "cloudflareVideoId" = '')
       AND "mediaUrl" != ''
     ORDER BY "createdAt" ASC`
  );

  console.log(`Found ${rows.length} videos to migrate`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const { id, mediaUrl } = rows[i];
    const filename = mediaUrl.split("/").pop() || `video-${id}.mp4`;

    console.log(`\n[${i + 1}/${rows.length}] ${id}`);
    console.log(`  URL: ${mediaUrl}`);

    try {
      // Download from Supabase
      const dlRes = await fetch(mediaUrl);
      if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`);
      const buffer = await dlRes.arrayBuffer();
      console.log(`  Downloaded: ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`);

      // Get Cloudflare upload URL
      const { uploadUrl, uid } = await getCloudflareUploadUrl();
      console.log(`  Cloudflare UID: ${uid}`);

      // Upload to Cloudflare
      await uploadToCloudflare(uploadUrl, buffer, filename);
      console.log(`  Uploaded to Cloudflare`);

      // Update DB
      await db.query(
        `UPDATE "Upload" SET "cloudflareVideoId" = $1 WHERE id = $2`,
        [uid, id]
      );
      console.log(`  DB updated`);
      success++;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      failed++;
    }

    // Small delay to avoid hammering APIs
    if (i < rows.length - 1) await sleep(500);
  }

  await db.end();
  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
