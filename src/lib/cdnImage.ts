// CDN rewrite helper. Routes Supabase Storage image URLs through our
// Cloudflare Worker (img.touritgolf.com) so the bytes hit Cloudflare's
// edge cache instead of Supabase Storage egress.
//
// Usage: wrap every <img src> that *might* be a Supabase URL.
//   <img src={cdnImage(course.coverImageUrl)} … />
//
// Idempotent: non-Supabase URLs (Cloudflare Stream thumbnails, data
// URIs, already-rewritten img.touritgolf.com URLs) are returned
// unchanged. nullish input passes through.
//
// FEATURE-GATED: this helper only rewrites when
//   NEXT_PUBLIC_CDN_IMG_PROXY=https://img.touritgolf.com
// is set in the Vercel environment. Without it, the helper passes
// URLs through unchanged — so we can ship the codemod and the
// Worker independently, then flip the env var to activate the
// rewrite once the Worker is verified.

// Matches the Supabase Storage public-object URL prefix for the
// tour-it-photos bucket. The pattern is the same for every project,
// so we key off the bucket name rather than the project ref — keeps
// this helper still working if we ever rotate the Supabase project.
const SUPABASE_PUBLIC_RE =
  /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/tour-it-photos\//i;

export function cdnImage<T extends string | null | undefined>(url: T): T {
  if (!url) return url;
  const proxy = process.env.NEXT_PUBLIC_CDN_IMG_PROXY;
  if (!proxy) return url;
  const s = url as string;
  if (!SUPABASE_PUBLIC_RE.test(s)) return url;
  return s.replace(SUPABASE_PUBLIC_RE, `${proxy.replace(/\/$/, "")}/`) as T;
}
