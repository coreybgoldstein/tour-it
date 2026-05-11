// Utility: split an IDs file into chunks. Not committed.
import { readFileSync, writeFileSync } from "fs";

const [, , src, chunkSizeArg, prefix] = process.argv;
if (!src || !chunkSizeArg || !prefix) {
  console.error("Usage: node src/scripts/split-ids.mjs <src> <chunkSize> <outPrefix>");
  process.exit(1);
}
const chunkSize = parseInt(chunkSizeArg);
const ids = readFileSync(src, "utf8").split(/\s+/).filter(Boolean);
let i = 0;
let n = 1;
while (i < ids.length) {
  const slice = ids.slice(i, i + chunkSize);
  const out = `${prefix}-${String(n).padStart(2, "0")}.txt`;
  writeFileSync(out, slice.join("\n") + "\n");
  console.log(`Wrote ${slice.length} → ${out}`);
  i += chunkSize;
  n++;
}
console.log(`Total chunks: ${n - 1}, total ids: ${ids.length}`);
