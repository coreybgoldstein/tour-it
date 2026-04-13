# /seo-audit — Full SEO Audit for Tour It

You are an expert SEO engineer auditing the Tour It golf scouting platform (touritgolf.com). It is a Next.js 16 App Router app with Supabase + Prisma, deployed on Vercel.

## Your Job
Perform a comprehensive SEO audit across the entire `src/app/` directory. Check every `page.tsx` and `layout.tsx` file.

## Audit Checklist Per Page

### Metadata
- [ ] Has `export const metadata` or `generateMetadata()`
- [ ] `title` — unique, keyword-rich, under 60 chars
- [ ] `description` — compelling, 120–160 chars, includes keywords
- [ ] `openGraph.title`, `openGraph.description`, `openGraph.image`
- [ ] `twitter.card`, `twitter.title`, `twitter.description`, `twitter.images`
- [ ] `canonical` URL set
- [ ] `robots` directive (index/noindex as appropriate)

### Dynamic Pages (courses/[id], courses/[id]/holes/[number])
- [ ] Uses `generateMetadata()` with real course/hole data from DB
- [ ] Title includes course name + location
- [ ] Description includes hole number, yardage, shot type, tips
- [ ] OG image is a real thumbnail from the upload

### Images
- [ ] All `<img>` tags use `next/image`
- [ ] All images have descriptive `alt` text (not empty, not "image")
- [ ] Golf-specific alt text (e.g., "Hole 3 at Pebble Beach, par 4, dogleg left")

### Structured Data
- [ ] Root layout has Site/Organization JSON-LD
- [ ] Course pages have GolfCourse schema
- [ ] Hole/video pages have VideoObject schema

### Technical
- [ ] `robots.txt` exists at `public/robots.txt`
- [ ] `sitemap.xml` exists or `sitemap.ts` route exists
- [ ] No `noindex` on public pages
- [ ] No duplicate `<title>` tags
- [ ] `lang="en"` on `<html>` (check layout.tsx)

### Performance (Core Web Vitals)
- [ ] Images use `priority` prop for above-fold images
- [ ] No render-blocking resources
- [ ] Video thumbnails are optimized

## Output Format

For each page, output:

```
📄 [page path]
✅ Pass: [list of passing items]
❌ Fail: [list of failing items with specific fix]
⚠️  Warn: [list of improvements]
```

Then output a **Priority Fix List** ranked by SEO impact:
1. 🔴 Critical (blocking indexing or rich results)
2. 🟡 High (significant ranking impact)
3. 🟢 Low (nice to have)

## Tour It Context
- Domain: touritgolf.com
- Target keywords: golf course preview, scout golf course, golf hole videos, [course name] hole by hole
- Primary pages: home feed, /courses/[id], /courses/[id]/holes/[number], /search
- Auth-gated pages (should be noindex): /profile, /upload, /trips, /lists, /notifications, /onboarding, /settings
- Public pages (must be indexed): /, /courses/[id], /courses/[id]/holes/[number], /search

Run the audit now. Read every relevant file. Be specific about what is missing and exactly what code to add.
