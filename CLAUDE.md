# Tour It — Claude Context

## What this is
Golf course discovery + UGC platform. Golfers upload short hole clips with scout metadata (club, wind, strategy, notes). Others browse, like, comment, save. Tagline: "Scout Before You Play."

## Standing rules
- **Commit and push after every change** — no exceptions, no waiting to be asked
- Keep responses short — no narration, no summary of what was just done
- Read only the section of a file needed, not the whole file
- Mobile-first always

## Tech stack
- Next.js App Router (TypeScript), React 19
- Supabase: auth + PostgreSQL (Prisma ORM) + Storage
- Prisma 5.22 — use `prisma db push`, not migrations
- FFmpeg.wasm for client-side video compression
- Hosted on Vercel

## Storage buckets
- `tour-it-videos` — clip videos
- `tour-it-photos` — thumbnails, profile photos, avatars
- Default avatars: `tour-it-photos/default-avatars/` (14 PNGs, assigned randomly on signup)

## Current avatar filenames
`01-coffee`, `02-burger-messy`, `03-golf-glove`, `04-sunscreen`, `05-rangefinder`, `06-hotdog`, `07-protein-bar`, `08-driver`, `09-cheeseburger`, `11-hamburger`, `12-water-jug`, `13-bloody-mary`, `14-cocktail`, `15-beer-can`

## Key DB tables
User, Upload, Course, Hole, Comment, Like, Follow, Save, Trip, Notification, UploadTag

## Design system
- **Background:** `#07100a`
- **Primary green:** `#4da862` | dark: `#2d7a42` | darker: `#256936`
- **Text:** `#fff` | muted: `rgba(255,255,255,0.35–0.4)`
- **Cards:** `rgba(255,255,255,0.03–0.04)` bg, `rgba(255,255,255,0.08)` border
- **Fonts:** Playfair Display (headings) + Outfit (body/labels)

## Feed (TikTok/Reels style)
- `scroll-snap-type: y mandatory`, each card `height: 100svh`
- Top bar: course badge (40×40, border-radius 10px) + title + controls, z-index 20, top gradient only
- Right sidebar (bottom: 100px): uploader avatar → like → comment → share → notes
- Feed z-index: 100 (BottomNav also 100, wins by DOM order)

## Key shared components / hooks
- `BottomNav` — fixed, z-index 100, always on main pages
- `ClipViewer` — edit/delete sheet for own clips
- `useLike` (`@/hooks/useLike`) — like state + DB sync
- `useSave` — course save state

## Supabase project
URL: `https://awlbxzpevwidowxxvuef.supabase.co`
