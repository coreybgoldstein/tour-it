#!/usr/bin/env node
// Split top100-ids.txt into chunks of 25 ids each.
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const ids = readFileSync(path.join(REPO_ROOT, "top100-ids.txt"), "utf8")
  .split(/\s+/)
  .filter(Boolean);

const CHUNK = 25;
const chunks = [];
for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));

chunks.forEach((c, i) => {
  const f = path.join(REPO_ROOT, `top100-ids-chunk-${i + 1}.txt`);
  writeFileSync(f, c.join("\n") + "\n");
  console.error(`Wrote ${c.length} ids to ${path.basename(f)}`);
});
