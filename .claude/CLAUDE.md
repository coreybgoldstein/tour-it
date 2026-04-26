# Tour It — Claude Code Instructions

## What This App Is
Tour It is a mobile-first golf scouting platform where golfers share and discover hole-by-hole video intel for golf courses. Tagline: "Scout Before You Play."

- **Stack:** Next.js + TypeScript + Tailwind, Supabase (PostgreSQL), Prisma ORM, Vercel
- **Local path:** `C:\Users\corey\tour-it`
- **Live URL:** https://www.touritgolf.com
- **Supabase project:** awlbxzpevwidowxxvuef

---

## Course Seeding — Critical Rules

When asked to seed, fill, or enrich course data:

1. **NEVER insert new courses.** Only UPDATE existing records. The DB already has 11,000+ courses from an external data source. Your job is to enrich them with descriptions, logos, and cover photos — not add new ones.

2. **Always query the DB first.** Before doing any web research, fetch the existing course records for the requested city/state/zip. Work only from that list.

3. **Match by name.** Find the course in the DB by name. If no match exists, skip it and tell the user — do not insert.

4. **Only update fields that are null.** Don't overwrite fields that already have data.

5. **Use the bulk seeder script** at `src/scripts/seed-courses-bulk.mjs` for any bulk seeding work. Read it before writing your own script.

### What to populate per course:
- `description` — 2-3 sentences, Tour It voice (see style below)
- `coverImageUrl` — direct image URL, wide landscape/aerial shot of the course
- `logoUrl` — club crest/emblem preferred over wordmark, must NOT be transparent
- `yearEstablished` — year course opened
- `access` — "Public", "Semi-Private", or "Private"
- `zipCode` — verify from official site or PGA.com, not aggregators

### Description style:
- Open with what makes the course distinct (design pedigree, setting, signature holes)
- Include one specific fact (designer, year, slope, notable hole)
- End with the feel/experience
- Voice: confident, specific, slightly editorial — enthusiastic golfer, not PR firm
- Avoid: "world-class", "stunning views", "something for everyone"

### Image rules:
- **Always upload images to Supabase Storage — never store external URLs in the DB.**
  1. Find the image URL from any source
  2. `fetch()` the image (with a browser User-Agent header to avoid blocks)
  3. Upload to `tour-it-photos` bucket at path `course-images/{courseId}-cover.{ext}` or `course-images/{courseId}-logo.{ext}` (upsert: true)
  4. Store the Supabase public URL in the DB
  - If fetch fails (403, 404, timeout) — try another source. Only leave null if no image can be found anywhere.
- Search wide — private clubs rarely publish images on their own site but photos exist elsewhere:
  - Golf media: Golf Digest, GolfWeek, Golf Magazine, Links Magazine, No Laying Up
  - Booking platforms: GolfNow, TeeOff, Golf Advisor, GolfPass
  - Real estate sites: Zillow, Realtor.com, community/HOA sites (residential clubs always have aerials)
  - Club review/ranking sites: Platinum Clubs, Distinguished Clubs, Zagat Golf
  - Local news, magazine features, resort/hotel partner sites
- Logo: club crest/emblem preferred over wordmark. Must NOT be transparent (dark green background).
- Cover: wide landscape or aerial shot of the course, not a clubhouse or portrait.
- NO `.aspx` URLs, NO `getImage.gif?ID=` URLs — unstable CMS URLs that will 404
- Known hotlink blockers (fetch will fail — find image elsewhere): Clubessential CMS, ClubHouseOnline, bocaresort.com

### Skip these:
- Courses currently closed for renovation
- Courses with no DB match

---

## General Development Rules

- Always check existing code before writing new code — don't duplicate logic
- Never hardcode Supabase URLs or keys in scripts — use `process.env`
- All new scripts go in `src/scripts/`
- Commit scripts only after they run successfully
- Use `upsert` with `onConflict: 'slug'` for course DB operations — never blind inserts
- The Course table slug must be unique — always slugify from name + city

---

## Key DB Tables
- `Course` — id, name, slug, city, state, zipCode, description, coverImageUrl, logoUrl, yearEstablished, access, isPublic, holeCount
- `Hole` — id, courseId, holeNumber, par, uploadCount
- `Upload` — id, userId, courseId, holeId, mediaUrl, mediaType, rankScore, moderationStatus
- `User`, `Follow`, `Like`, `Save`, `Comment`, `View`, `ModerationReport`, `GolfTrip`

## Internal API
Check existing course data without touching Supabase directly:
```
GET https://www.touritgolf.com/api/internal/courses?zipCode=XXXXX&secret=INTERNAL_API_SECRET
```
A course is considered well-seeded (skip it) if description, coverImageUrl, logoUrl, yearEstablished, and access are all non-null.
