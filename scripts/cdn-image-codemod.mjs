#!/usr/bin/env node
// One-shot codemod: wraps every `src={EXPR}` where EXPR references a
// known Supabase image field (coverImageUrl / logoUrl / avatarUrl /
// heroImageUrl / imageUrl) with `cdnImage(EXPR)`, and adds the import
// to each touched file. cdnImage is idempotent — non-Supabase URLs
// pass through unchanged, so over-wrapping a third-party CDN URL is
// safe.

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const FIELDS = ["coverImageUrl", "logoUrl", "avatarUrl", "heroImageUrl", "imageUrl"];
const FIELD_RE = FIELDS.join("|");

// Match a JSX `src={…}` attribute whose body contains one of the
// fields above. Allow nested chars but NOT braces (so we don't grab
// across multiple attributes). Captures the inner expression.
const SRC_RE = new RegExp(`src=\\{([^{}]*(?:${FIELD_RE})[^{}]*)\\}`, "g");

const IMPORT_LINE = `import { cdnImage } from "@/lib/cdnImage";`;

const files = execSync(
  `git ls-files src/app src/components -- "*.tsx" "*.ts"`,
  { cwd: process.cwd(), encoding: "utf8" }
)
  .split("\n")
  .filter(Boolean);

let touched = 0;
let totalReplacements = 0;

for (const file of files) {
  if (file.includes("cdnImage")) continue;

  const original = readFileSync(file, "utf8");
  let replacements = 0;
  let next = original.replace(SRC_RE, (match, inner) => {
    // Skip if already wrapped — idempotency for re-runs.
    if (/^\s*cdnImage\s*\(/.test(inner)) return match;
    replacements++;
    return `src={cdnImage(${inner.trim()})}`;
  });

  if (replacements === 0) continue;

  // Insert the import if missing. Place it after the last existing
  // import line to keep import grouping tidy.
  if (!next.includes("@/lib/cdnImage")) {
    const importLines = [...next.matchAll(/^import .* from .*;$/gm)];
    if (importLines.length > 0) {
      const last = importLines[importLines.length - 1];
      const insertAt = last.index + last[0].length;
      next = next.slice(0, insertAt) + "\n" + IMPORT_LINE + next.slice(insertAt);
    } else {
      next = IMPORT_LINE + "\n" + next;
    }
  }

  writeFileSync(file, next, "utf8");
  touched++;
  totalReplacements += replacements;
  console.log(`  ${file.padEnd(60)} (${replacements} src refs wrapped)`);
}

console.log(`\nDone. Touched ${touched} files, wrapped ${totalReplacements} src refs.`);
