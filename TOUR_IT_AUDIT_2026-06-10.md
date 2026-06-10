# Tour It — Full Audit, 2026-06-10

**Run by:** Opus 4.7 (1M context) — five parallel specialist passes over the live codebase.
**Scope:** Cost/scale, security, UX/friction, performance, moat/growth, plus a "Tour It Agent" recommendation and Claude/AI integration links.
**Status going in:** v1.0.3 build 444 live on iOS since 2026-05-13; June 5 audit (#100–#124) all DONE; RLS hardening 41/41 tables complete 2026-06-09.

---

## TL;DR — the 7 things to fix this week

If you only do seven things from this audit, do these. They map to specific files and are ranked by impact-per-hour.

1. **Kill the cookie-relay IDOR on `/api/points/award`** (security · CRITICAL) — 4 routes (`hero-approve`, `comments/sync`, `follow/sync`, `likes/toggle`) authenticate, then re-fetch `/api/points/award` with the user's session cookie. Stolen/replayed cookie → attacker can award arbitrary points to any user via `recipientUserId`. Fix: call the award logic in-process with service-role, drop the internal fetch. **2–3h.**
2. **Add `CRON_SECRET` null-guard to `/api/cron/streak`** (security · HIGH) — current check passes when env var is undefined. Copy the safer pattern from `reset-leaderboard/route.ts:42`. **5 minutes.**
3. **Fix the leaderboard cron N+1 + streak cron N+1** (cost · HIGH) — `reset-leaderboard/route.ts:82-110` loops `.update()` per row; `streak/route.ts:35-48` fires a separate `.select()` per user. Batch into one upsert. **~$70–200/mo saved, 3h.**
4. **Cache `/api/ai-search`** (cost · MED) — every query hits Haiku uncached. Add SHA-256 query-hash cache (mirror the `/api/tour/search` pattern). **~$100–200/mo saved, 1h.**
5. **Virtualize the home feed** (performance · HIGH) — `HomeClassic.tsx:2325` mounts every card and every `<video>` simultaneously. Render only ±2 cards around active index. Single biggest LCP/INP fix in the app. **4–6h.**
6. **Migrate `MayCompetitionModal` + `JuneCompetitionModal` to `.tourit-sheet`** (UX · HIGH) — only modals in the codebase violating the bottom-sheet rule, with rogue z-index 1000/1001 that conflict with the toast layer. **1.5h.**
7. **Defer `ffmpeg.wasm` load until compression actually runs** (performance · MED) — `compressVideo.ts:15-16` fetches a 28 MB WASM from unpkg at upload-page mount, even for <30 MB files. Move the `getFFmpeg()` call inside the compression branch. **30 min.**

Everything else below is real but smaller, or strategic (Caddie agent, moat).

---

## 1 · Cost & Scale

Estimated total recoverable spend if all fixed: **$425–$1,045/mo.** This is mostly Supabase compute + AI inference, not Vercel.

| # | Finding | File | Sev | Est $/mo | Fix |
|---|---------|------|-----|----------|-----|
| 1 | Leaderboard reset N+1 + full ledger pull on monthly | `api/cron/reset-leaderboard/route.ts:82-110` | HIGH | $50–150 | Batch updates 200/chunk, add date filter to ledger pull |
| 2 | Comment-count resync scans entire `Comment` + `Upload` table nightly | `api/cron/resync-comment-counts/route.ts:50-72` | HIGH | $30–80 | `.limit(5000)` + date-window filter, batch updates by uploadId |
| 3 | Streak cron fires one `.select()` per user | `api/cron/streak/route.ts:35-48` | MED | $20–50 | One `Upload` fetch where `createdAt >= sevenDaysAgo`, group in memory |
| 4 | AI search has no cache | `api/ai-search/route.ts:49-81` | MED | $100–200 | SHA-256 of `query.toLowerCase()`, 24h TTL in `TripPlannerCache` |
| 5 | Course description Haiku call has no cross-user dedup | `api/generate-course-description/route.ts:36-47` | MED | $10–25 | Cache on `Course.generatedDescriptionCachedAt`, check before model call |
| 6 | Trip planner fetches full `TripItinerary` table on cache miss, no `select` projection | `api/trip-planner/recommend/route.ts:100-105` | MED | $5–15 | `.limit(100)` + explicit projection (`slug, name, tagline, hero..., vibeTag, costBand, bestSeasonStart, bestSeasonEnd, durationDays, region, stayRec`) |
| 7 | Caddie-book caps note count but not per-note length | `api/caddie-book/route.ts:80-91` | MED | $5–15 | `.slice(0, 200)` per note string before prompt build |
| 8 | `cdnImage()` applied inconsistently — many surfaces still hit Supabase Storage direct | global | LOW | $200–500 | Codemod: grep `src=.*\b(cover|logo|thumbnail)ImageUrl\b` w/o `cdnImage(` and wrap |
| 9 | Cloudflare Stream thumbs may render larger than `?width=240` | `components/home/HomeTour.tsx:413` | LOW | $5–10 | Match thumb width to CSS render width (likely 300) |
| 10 | `maxDuration = 300` on a cron that typically runs < 60s | `api/cron/reset-leaderboard/route.ts:4` | LOW | $2–5 | Drop to 120 after profiling one real monthly run |

---

## 2 · Security

13 findings. Auth-on-routes is mostly solid (RLS-hardening shipped 2026-06-09 helps). The exploitable surface is **how routes talk to each other internally.**

### CRITICAL / HIGH (fix this week)

**S1 · Cookie-relay IDOR on `/api/points/award`** *(four routes)*
- `api/uploads/hero-approve/route.ts:68`
- `api/comments/sync/route.ts:108`
- `api/follow/sync/route.ts:74`
- `api/likes/toggle/route.ts:114, 143`

Each authenticates the caller, then `fetch()`'s `/api/points/award` with the user's cookie, passing `recipientUserId` as a different user. `/api/points/award` validates the *caller* but not that `caller === recipient`. A stolen/replayed cookie → arbitrary-user point awards. Fix: refactor `pointsAward()` into a callable function that runs with service-role inside each route after the auth check. Delete the internal `fetch`.

**S2 · Hero-tag transfer race**
- `api/uploads/hero-approve/route.ts:68`

Same internal-fetch shape; the tag-check and the points award are not atomic across cookie boundaries. Same fix as S1.

**S3 · `CRON_SECRET` null-guard missing**
- `api/cron/streak/route.ts:16`

If env var unset, `Bearer ${undefined}` matches anyone sending `"Bearer undefined"`. Copy the pattern from `reset-leaderboard/route.ts:42`: `!process.env.CRON_SECRET || authHeader !== \`Bearer ${process.env.CRON_SECRET}\``.

**S4 · Trips messages auth ordering**
- `api/trips/[id]/messages/route.ts:29-39`

GET fetches trip + members before checking the Bearer token result. Move the 401 above the DB calls; verify Bearer pattern matches the rest of the codebase (memory: `feedback_api_auth_pattern`).

### MEDIUM

- **S5** · `reputationScore` returned in public `/api/tour/search` — `api/tour/search/route.ts:206`. Strip from response.
- **S6** · `/api/uploads/create` trusts client-declared `mediaType` — `route.ts:115-120`. HEAD-check Content-Type for photos; verify Cloudflare ID resolves before storing for videos.
- **S7** · `/api/push/subscribe` is not rate-limited — `route.ts:4-18`. Add `rateLimit('push-subscribe:${user.id}', 20, 3600_000)`.
- **S8** · `/api/upload/detect-hole` does not verify `courseId` exists — `route.ts:52-54`. Add a fast `SELECT id FROM Course WHERE id = $courseId`.
- **S9** · `/api/trips/[id]/game` looks up user by email instead of id — `route.ts:248`. Use `user.id`.
- **S10** · Service-role used in unauthenticated routes — `tour/search`, `ai-search`, `caddie-book`. Today the tables read are public, but this creates an RLS-bypass landmine for future restrictions. Switch unauth routes to anon key.

### LOW

- **S11** · User email included in feedback email body — `api/feedback/route.ts:35,46`. Reference by `User #id`.
- **S12** · `position` parameter unvalidated in `/api/ai-search/click` — `route.ts:17`. Clamp to 0–99 integer.

---

## 3 · UX & Friction

10 findings; #1–#4 are the only ones worth shipping this week.

### HIGH

**U1 · May/June competition modals violate the bottom-sheet rule**
`components/MayCompetitionModal.tsx:31, 39` + `components/JuneCompetitionModal.tsx:38, 44` use ad-hoc z-index 1000/1001, custom animation, and live outside `.tourit-sheet`. These are the **only** modals in the entire codebase doing this. They conflict with the toast layer (10000) and break `KeyboardSync`. Migrate to `BottomSheet` component.

### MEDIUM

**U2 · Onboarding is 4 screens before first clip** — `signup/page.tsx:71-192` → `onboarding/intro/page.tsx` (3-slide carousel). Collapse slides 2 and 3 into a single "Got it" so eager users get to feed faster. Drop-off candidate.

**U3 · "You commented" parity gaps** — Profile surface (`profile/[userId]/page.tsx:51-76`) accepts `commentedIds`, but verify `courses/[id]/page.tsx` and `courses/[id]/holes/[number]/page.tsx` batch-prefetch `Comment` rows and flip the button green. Per CLAUDE.md: all 4 surfaces must mirror the heart-fill pattern.

**U4 · Signup points + referral failures are silently swallowed** — `signup/page.tsx:173-174`: `.catch(() => {})` on both `/api/points/award` and `/api/referral/signup`. User has no idea if their signup bonus actually applied. Either toast on error or move to a server-side post-signup job triggered by Supabase webhook.

**U5 · Email-confirmation fallback message is dead-end** — `signup/page.tsx:189-191`. (Currently disabled per memory `project_supabase_email_confirmation`, but the code path renders confusing copy if/when re-enabled.) Add "After confirming, you'll land on the feed" sentence.

### LOW

- **U6** · BottomNav at z-index 100 may clip the lowest right-sidebar action buttons on small-safe-area iPhones — `BottomNav.tsx:199`. Push sidebar `bottom` from 100px to 120px.
- **U7** · Empty states are blank. Course w/ 0 clips, search w/ 0 results, new-user feed w/ 0 follows — no copy, no CTA. Three specific empty-state cards (see audit detail) win conversion.
- **U8** · Skeleton vs spinner inconsistency across `loading.tsx` variants — pick one (skeleton) and apply everywhere.
- **U9** · Filter pills / month-picker toggles may be < 44px. Audit `HomeTour.tsx` rails and `TripPlannerSheet`.

---

## 4 · Performance / Core Web Vitals

Mobile WKWebView, vertical scroll-snap feed — same performance tradeoffs as TikTok. The biggest wins are about **not mounting things that aren't visible.**

### HIGH

**P1 · Feed has no virtualization**
`components/home/HomeClassic.tsx:2325` does `feedItems.map(...)` — 20+ `<VideoCard>`s mount simultaneously, 20+ `<video>` decoders allocated. This is the #1 cause of any LCP/INP issue you'll see on real devices. Window the list to ±2 around active index, keep only the active card's video live. Single biggest perf fix in the app.

### MEDIUM

- **P2** · Images render `width: 100%; height: 100%` without aspect-ratio container → CLS budget burns. `HomeClassic.tsx` cover/logo/trip-hero blocks (lines 233, 240, 258, 1254, 1266, 1327). Wrap in `aspect-ratio: 3/2` boxes, add `loading="lazy"` + `decoding="async"` below the fold.
- **P3** · Cloudflare Stream poster thumbs in the peek rail load for all 10 cards. Lazy them to 2–3 visible.
- **P4** · `ffmpeg.wasm` 28 MB fetched at upload-page mount even for files < 30 MB compression threshold. `lib/compressVideo.ts:15-16`. Move `getFFmpeg()` inside the if-needed branch.
- **P5** · `next.config.ts` is missing `images.remotePatterns` for `videodelivery.net`, `*.supabase.co`, `*.cloudflare.net`. All proxied URLs bypass Next/Image optimization today.
- **P6** · Feed videos use `preload="auto"` — `HomeClassic.tsx:2265-2268`. Switch to `preload="metadata"` and let Cloudflare HLS adaptive bitrate handle the rest.
- **P7** · Fonts (Playfair Display, Outfit) — `app/layout.tsx:22-32`. Verify the injected `<link>` carries `font-display: swap`; on slow 3G the serif heading can FOIT.

### LOW

- **P8** · Infinite scroll fetch can block touch — debounce scroll-end to 300ms, batch loader state with fetch in one microtask.
- **P9** · Holes-PAR is re-queried for every course selection in `/upload`. Memoize or batch with the course search response.
- **P10** · Add `touch-action: pan-y` to `.feed-item` to remove WKWebView gesture ambiguity.
- **P11** · Comment sheet remounts entire comment list every open. Memoize `commentItems.map` output.

---

## 5 · Moat & Growth — the "next big thing in golf" question

**Headline:** the **"Scout Before You Play"** thesis is real, the data moat exists, but the wedge feature that makes a golfer open Tour It the night before a round **does not ship yet.** Build it and you win the category.

### What's already working (your moat foundation)
- Clips carry structured metadata: club, wind, strategy, landing-zone, date — this is data nobody else captures at hole granularity.
- `Caddie Book` already synthesizes hole notes with Claude.
- `Course` ↔ `CourseClaim` ↔ `CourseManager` ↔ `CourseStaff` is wired — operators can verify and post.
- Trip planner is seasonality-aware. Points/ranks/streaks exist in schema.
- Hero-tag ownership transfer (shipped 2026-05-17) — actually a uniquely Tour-It community physics moment.

### What's missing — the wedge

**Tier 1 — ship these or "next big thing" doesn't happen**

**G1 · Round Prep Playlist** — when a user creates a `GolfTrip` / Quick Round with course + date, auto-generate a "Pre-round clip deck" tab that orders clips by hole number, prioritizes high-like-count, and filters to conditions matching the forecast for that course/date. This is the answer to "why would I open Tour It the night before a round?" — and the answer 18Birdies / Arccos / Golfshot cannot give. Smallest v1: a new `/rounds/[id]/prep` page rendering `Hole 1 → top 3 clips → Hole 2 → top 3 clips...`. No new schema, just a query + sort. ~1–2 days.

**G2 · Course Intel Report** — three charts on the course profile:
1. *Club selection donut per hole* — "On hole 7, 38% hit 7-iron, 22% hit 8-iron..."
2. *Wind direction polar* — "Most-played wind direction at this course is N/NE."
3. *Average score by hole* — "Hole 12 is the hardest scored hole here."

This makes the data moat visible to users. The queries are 30 lines of SQL each; the UI is three Recharts components. ~1 day. This is the screenshot users will share on X/Reddit.

**Tier 2 — compound the supply side**

**G3 · "PRO TIP" badge for `CourseStaff` uploads** — when a clip's uploader is a verified `CourseStaff` row at that course, render a green PRO TIP chip + role line in the FeedTopBar. Sort these to top of the hole feed. This converts the operator/staff schema from "exists" to "valuable" and gives course pros a reason to post (followers, attribution, legitimacy). Unlocks operator outbound (memory: `feedback_claim_cta_hidden`).

**G4 · "Matched Conditions" post-round** — after `Round` is logged, query for clips at that course with wind/temp within ±20% of what the user played. Surface as a "Played in your conditions" rail in the round-detail page. Awards a Strava-style badge. Compounds the saving/following loop.

**Tier 3 — retention on non-golf days**

**G5 · Hole of the Day** — daily push at 10am local: one curated clip from one hole at one course (highest engagement × recency × geo proximity). Cheap, drives the "open Tour It even when I'm not playing" habit. Mirrors Strava's daily activity card.

**G6 · ShareSheet on every clip** — wire the existing share icon to native `navigator.share()` + a `/join/[referrer]?clipId=...` deep link. Referral table already records the relationship. This is plumbing, not new product. ~3 hours.

### What to cut
- `BadgePicker` — keep deferred. No user asked.
- Leaderboard reset UI — ops work, not moat. Run via cron + admin.
- Rewards page — don't build. Reward = rank visibility + operator partnerships, not a shop.
- Don't build "Tee-sheet booking" until you have a real GolfNow/similar API. The memory entry `project_tee_sheet_blocked` is correct.

---

## 6 · The Tour It Agent — "The Caddie"

You asked: *"Build a Tour It agent — what do we use it for?"* One concept, defended:

**The Caddie** — a reactive Claude chat the user opens **on a hole or course page** to get hole-by-hole play advice grounded in (a) the clip corpus you've built, (b) hole metadata, and (c) live weather. Not a stats bot. Not a trip planner. Not a coach. A **caddie**, for the hole you're about to play.

### Why this beats every alternative concept

| Concept | Why not |
|---------|---------|
| Trip planner agent | Already exists. Adding chat doesn't add value. |
| Round-recap coach | Post-round = low engagement window; Strava owns that pattern. |
| Course librarian | Search bar + AI search already covers this. |
| **The Caddie** | **The clip corpus + per-hole metadata is the only thing nobody else has. The Caddie is the surface that turns it into a product.** |

### v1 (ship in 7 days)

1. Floating green caddie icon on `courses/[id]` and `courses/[id]/holes/[number]`. Bottom-right, z-index 105 (above BottomNav, below toasts).
2. Tap → full-height bottom sheet (`.tourit-sheet` rules). Text input + streaming response area. No persistence, no auth required.
3. System prompt: course + hole context pre-bound. Tells the model it's a caddie, refuses to hallucinate yardage, defers to clip evidence when present.
4. Three tools the model can call:
   - `getHoleMeta(courseId, holeNumber)` → par, yardage, handicap, overview, official media if any
   - `getClipsForHole(courseId, holeNumber, { wind?, club? })` → top 5 by recency × likeCount with metadata (club, wind, strategy, uploader handle, clip URL)
   - `getWeather(courseId)` → wind speed/dir, temp, humidity at course lat/lng
5. **Model: Haiku 4.5 by default** (first response is free-feeling, ~$0.001/turn). Escalate to Sonnet 4.6 only when conversation depth ≥ 3 turns OR user explicitly taps "Think harder."
6. **Use Anthropic prompt caching** on the system prompt + hole metadata block — saves ~85% of the input tokens after the first turn in a session.
7. Stream the response (Vercel AI SDK `streamText` is the right adapter).

### v2 directions (don't ship in week 1, but design v1 not to block them)
- Proactive: night-before push — "You're playing Bethpage tomorrow. Here's a 3-clip pre-round brief for holes 4, 7, 18." Tied to `GolfTrip` rows.
- Voice: WebSpeech in, audio out — usable in the cart.
- Memory: per-user "your home course" prior so the Caddie speaks to YOUR tendencies.
- Hero-tag integration: "Here's how @x played this hole in similar wind" — direct hand-off into the clip viewer.

### Cost ceiling
With Haiku-default + caching: <$0.005 per user-session. With Sonnet escalation: <$0.05. At 1k DAU and 20% caddie-use rate that's ~$3–30/day. Linear with usage; no surprise bills.

---

## 7 · Claude / AI integration — how to use Anthropic better

### Existing AI usage audit

| Route | Model | Caching | Status |
|-------|-------|---------|--------|
| `/api/ai-search` | Haiku 4.5 | **None** — every call billable | Working; cache it (cost finding #4) |
| `/api/trip-planner/recommend` | Sonnet 4.6 | Deterministic hash, 7-day TTL | Good pattern — copy this elsewhere |
| `/api/generate-course-description` | Haiku 4.5 | None (rate-limited only) | Add per-course `generatedDescriptionCachedAt` |
| `/api/caddie-book` | Haiku 4.5 | SHA-1 notes signature persisted to `Course` | Good — best pattern in the codebase |

**Big missing patterns:**
- **No prompt caching** anywhere. Anthropic's 5-min cache cuts input tokens 90% on repeat invocations within a session — the trip planner's static catalog + system prompt are textbook cache-block candidates.
- **No streaming.** Trip planner blocks 1.5s+ on first paint. Stream it.
- **No agentic tool use.** Every AI call is one-shot extraction. The Caddie above is your first real agentic surface.

### Resource links — bookmark these

Anthropic docs and SDK (verify in browser; URL shapes change):
- **Prompt caching** — `docs.anthropic.com/en/docs/build-with-claude/prompt-caching` — the single highest-ROI thing to add. Cache the trip planner system prompt + itinerary catalog as one ephemeral cache block; pays for itself on the second call inside 5 min.
- **Tool use** — `docs.anthropic.com/en/docs/build-with-claude/tool-use` — the Caddie's `getHoleMeta` / `getClipsForHole` / `getWeather` pattern.
- **Streaming** — `docs.anthropic.com/en/api/messages-streaming` — for the Caddie chat UI and any trip planner UX upgrade.
- **Model overview** — `docs.anthropic.com/en/docs/about-claude/models/overview` — Haiku 4.5 vs Sonnet 4.6 vs Opus 4.7 tradeoffs (latency, cost, reasoning).
- **Anthropic SDK (TypeScript)** — `github.com/anthropics/anthropic-sdk-typescript` — the SDK you're already using. Latest README is the source of truth for caching headers and streaming patterns.

Vercel side (your runtime):
- **Vercel AI SDK** — `sdk.vercel.ai/docs/introduction` — React hooks (`useChat`, `useCompletion`) and `streamText` with Anthropic provider. This is the right adapter for the Caddie's streaming chat UI; saves you ~200 lines of WebSocket plumbing.
- **AI SDK / Anthropic provider** — `sdk.vercel.ai/providers/ai-sdk-providers/anthropic` — provider config + tool-call wiring against the AI SDK message shape.
- **Vercel AI Gateway** — `vercel.com/docs/ai-gateway` — single unified key, model fallback (Haiku → Sonnet on retry), cost tracking dashboard. Worth turning on the day you ship the Caddie if you don't already.

### Concrete "use Claude better" plays for Tour It

1. **Add `cache_control: { type: "ephemeral" }`** to the static prefix of every Claude call (system prompt + itinerary catalog + course intel block). One header change ≈ 85% input-token reduction within a session.
2. **Pre-generate course descriptions in a nightly cron** instead of on-demand on the course profile page. The 11k course catalog drains $10–25/mo at current rate; one cron pass at Haiku 4.5 is < $5 lifetime.
3. **Stream the trip planner.** First useful sentence appears in ~400ms instead of 1.5s. Same model, same cost — only the perceived UX changes.
4. **Use AI Gateway in front of the SDK** so you can hot-swap Haiku → Sonnet without redeploys, and so a model outage doesn't break the Caddie.
5. **Pre-compute Caddie context blocks per hole** — cache the most-relevant 5 clips per (courseId, holeNumber) in a Postgres materialized view; refresh nightly. Saves a tool call per Caddie turn.

---

## 8 · Suggested 4-week build sequence

Bias is toward (a) fix the security cookie-relay before anything else, (b) unlock the wedge, (c) prove the agent.

### Week 1 — security + perf + AI-cache
- **Mon–Tue:** S1/S2 cookie-relay refactor (4 routes → service-role in-process). S3 cron secret null-guard. S4 trips messages auth-ordering.
- **Wed:** Cost #1–#4 (leaderboard + streak + AI search cache + trip planner projection).
- **Thu:** P1 feed virtualization, P4 ffmpeg defer, P5 next.config images.
- **Fri:** U1 competition-modal migration to `.tourit-sheet`.

### Week 2 — wedge build, part 1
- **G1 Round Prep Playlist** end-to-end. New `/rounds/[id]/prep` route. Read `GolfTrip` + `GolfTripCourse`, render hole-by-hole clip deck. No new schema.
- **G2 Course Intel Report** — three charts on `courses/[id]`. Material view if queries are heavy.

### Week 3 — Caddie v1
- Caddie sheet UI on course + hole pages.
- Three tool implementations (`getHoleMeta`, `getClipsForHole`, `getWeather`).
- Anthropic prompt caching on system prompt + per-hole context block.
- Vercel AI SDK `streamText` for the chat surface.
- Haiku 4.5 default; Sonnet escalation on tap-to-think-harder.

### Week 4 — supply-side compounding + ship marketing artifact
- **G3 PRO TIP badge** for `CourseStaff` uploads.
- **G6 ShareSheet** on every clip → `/join/[referrer]` deep link.
- **U2/U7** onboarding compression + empty-state copy.
- Public "Course Intel Report" screenshot of one famous course (Pebble? Bethpage Black?) for X/Reddit launch of the Caddie.

---

## 9 · Items NOT addressed here (intentionally)

- **June 5 deferred items** (#7r Upstash, #10/11 native push, #14 operator dashboard, E avatars, J email alias) — those remain queued per the existing roadmap, not part of this audit.
- **App Store / iOS native build pipeline** — out of scope for this code/product audit (memory: `project_testflight_ci` still says manual archive required).
- **Supabase free-tier egress incident remediation** — already shipped via CDN proxy 2026-05-28; cost finding #8 is the only remaining lever.
- **`document.body.style.transform` prohibition** — already in `feedback_ios_body_transform`. No regressions found in this audit.

---

## 10 · One-line verdict

You shipped a real product with a real moat (clips + per-hole metadata + operator schema). The audit confirms the foundation. The thing you have not yet shipped — and the thing that decides whether Tour It is "another golf app" or "the golf app" — is the **Round Prep Playlist + The Caddie**. Everything else above is hygiene. Build the wedge.

— Audit complete, 2026-06-10.
