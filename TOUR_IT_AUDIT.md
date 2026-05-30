# Tour It — Product Handoff Audit

A snapshot of the current state of the Tour It repo for handoff.
Generated 2026-05-30.

---

## 1. Prisma schema — every model with key fields

> **No course-ownership / claim / staff / PGA-pro concept exists in the
> codebase.** All "claim" references are about *clip* claims (hero-tag
> ownership transfer of an `Upload`). See §2.

### Identity / social

- **User** — `id, email, username, displayName, avatarUrl, bannerUrl,
  handicapIndex, ghinNumber, homeCourseId, isAdmin, uploadCount,
  reputationScore` (+ many relations)
- **Follow** — `followerId, followingId, status (ACTIVE/BLOCKED)`
- **Referral** — `inviterId, inviteeId, status
  (PENDING→SIGNED_UP→FIRST_UPLOAD), signupAt, firstUploadAt`
- **Notification** — `userId, type, title, body, linkUrl, referenceId,
  read`

### Course graph (read-mostly)

- **Course** — `id, name, slug, city, state, latitude, longitude,
  websiteUrl, description, holeCount, courseType
  (PUBLIC/PRIVATE/SEMI_PRIVATE), zipCode, yearEstablished, isVerified,
  coverImageUrl, logoUrl, scorecardImageUrl, searchVector, uploadCount`
- **Hole** — `courseId, holeNumber, par, handicapRank, yardage, teeLat,
  teeLng, imageUrl`
- **TeeBox** — `courseId, holeId, color
  (BLACK/BLUE/WHITE/GOLD/RED/GREEN/CUSTOM), yardage, rating, slope`
- **CourseRequest** — user-submitted "please add this course" rows:
  `userId, name, city, state, courseType, websiteUrl, notes, status`
  *(recent — pairs with the Suggest-a-Course button)*

### UGC / clips

- **Upload** — `userId, uploadedByUserId, courseId, holeId, teeBoxId,
  mediaType, mediaUrl, cloudflareVideoId, shotType, clubUsed,
  distancePlayed, windCondition, lieType, handicapRange, strategyNote,
  landingZoneNote, whatCameraDoesntShow, datePlayedAt, seriesId,
  seriesOrder, yardageOverlay, tripId, tripPublic, clipLat, clipLng,
  like/comment/view/saveCount, rankScore, moderationStatus, roundId` —
  `uploadedByUserId` carries the original uploader after a hero-tag
  ownership transfer
- **UploadPhoto, Comment, Like, Save, View, ModerationReport** —
  engagement + reports
- **UploadTag** — `uploadId, userId, approved (nullable = pending),
  isHero` — `isHero=true` triggers `Upload.userId` transfer on approval
- **Round** — `userId, courseId, date, totalScore, fairwaysHit, putts`

### Trips / games

- **GolfTrip** — `name, startDate, endDate, imageUrl, createdBy,
  arrivalAirport, lodging, lodgingCity, lodgingState, isPublic,
  publicizedAt, publicizeNotifiedAt, ryderCupEnabled, redTeamName/Score,
  blueTeamName/Score` *(lodgingCity/State, public-conversion fields, and
  Ryder columns are all recent)*
- **GolfTripCourse** — `tripId, courseId, secondaryCourseId (paired
  9+9), playDate, teeTime, accommodation, sortOrder`
- **GolfTripMember** — `tripId, userId, role`
- **GolfTripNote** — `tripId, userId, category
  (clubhouse/food/weather/tip/logistics/course), subject, body`
  *(recent — the "knowledge layer" for trips)*
- **GolfTripRyderTeam** — `tripId, userId, team (RED/BLUE)`
- **TripMessage** — `tripId, userId, body`
- **TripGame** — `tripId, courseId, courseName, format, formatConfig
  (JSON: nassau front/back/total, skins, best_ball wager), players
  (JSON), holeHandicaps (JSON), gameSheet, shareText, createdBy`
  *(formatConfig now drives the "$25/$25/$50" stake chip on home)*

### Trip ideas (curated catalog)

- **TripItinerary** — `slug, name, tagline, whyThisTrip, heroImageUrl,
  vibeTag, costBand, bestSeasonStart, bestSeasonEnd, durationDays,
  stayRec, lat, lng, region, dartThrowCount, sourceGolfTripId,
  submittedByUserId` *(last two enable UGC promotion of private trips to
  public)*
- **TripItineraryStop** — `itineraryId, courseId, day, order, note`
- **TripPlannerCache** — `briefHash (PK), brief, response, hits,
  expiresAt` *(recent — SHA-256-keyed Claude response cache, 7-day TTL)*

### Progression / rewards

- **UserProgression** — `userId, totalPoints, level, rank
  (CADDIE→LOCAL→MARSHAL→COURSE_PRO→TOUR_PRO→LEGEND), weeklyPoints,
  monthlyPoints, streakWeeks, heroBadgeIds, weekReset, monthReset`
- **UserPointsLedger** — `userId, action, points, referenceId, metadata`
- **Badge** + **UserBadge** — `slug, name, category
  (CONTRIBUTION/SOCIAL/EXPLORER/ACHIEVEMENT), rarity (COMMON→LEGENDARY),
  pointValue, requirement (JSON)`
- **CourseContribution** — per-user-per-course `uploadCount` +
  first/last upload
- **CourseFieldContribution** — `courseId+fieldName` unique (who first
  contributed each field of a course)
- **LeaderboardSnapshot** — periodic ranking snapshots
- **RewardsWaitlist** — opt-in list

### Search / analytics

- **SearchLog**, **SearchClick** — query + click-through

---

## 2. Course-ownership / claim / staff / PGA-pro concept

**None.** Specifically:

- No course-claim model.
- No `Course.ownerId`, `Course.staffIds`, or business-claim workflow.
- No PGA membership / verified-professional flag on `User`.
- `User.isAdmin` (boolean) is the **only role-like field** in the entire
  schema.

All "claim" references in the codebase are about **clip ownership
transfer**: someone tags a friend in their video with
`UploadTag.isHero=true`, the friend gets a notification, and on approval
`Upload.userId` becomes the hero while `uploadedByUserId` records the
original uploader. This is a peer-to-peer flow between two regular
users; there is no concept of a course operator account claiming a
property.

**Green-field opportunity.** Anyone building a course-operator,
course-staff, or PGA-pro feature would be starting from scratch — no
legacy schema to migrate, no conflicting concepts to untangle.

---

## 3. Routes / pages (44 total)

### Public / marketing

- `/about`, `/privacy`, `/terms`, `/feedback` — static info
- `/play` — "Play Tour It" landing page (monthly comp)
- `/invite`, `/join/[username]` — referral landing pages
- `/trip-ideas/[slug]` — curated dart-throw trip idea page

### Auth + onboarding

- `/login`, `/signup`, `/forgot-password`, `/reset-password`,
  `/auth/confirm`
- `/onboarding`, `/onboarding/intro`, `/onboarding/profile`,
  `/onboarding/notifications`, `/onboarding/reset`

### Core surfaces

- `/` — Home (dispatcher: `HomeTour` by default, `HomeClassic` via env
  override)
- `/tour` — Unified LLM-powered search (courses + holes + trips +
  golfers); Smart tab + filters
- `/search` — Legacy search (mostly superseded by `/tour`)
- `/map` — Courses-on-a-map view
- `/feed/[uploadId]` — Full-screen vertical clip feed (TikTok-style
  scroll-snap)
- `/upload` — Upload flow (single + batch routes)

### Courses

- `/courses/[id]` — Course profile (description, holes grid, clips)
- `/courses/[id]/holes` — All-holes overview
- `/courses/[id]/holes/[number]` — Hole detail (clips by tee box)
- `/add-course` — User-submitted course request form

### Rounds / trips / games

- `/tee-up` — Hub with Games / Rounds / Trips tabs
- `/trips` — Trips list (also reachable via Tee Up)
- `/trips/[id]` — Trip/round detail (cover header, courses list, games,
  chat, members, notes, Ryder mode)
- `/round/[id]` — Standalone round detail
- `/games/[id]` — Game scorecard / settlement detail

### Profile

- `/profile` — Redirect to own profile
- `/profile/[userId]` — Profile page (avatar, badges, stats, clip grid,
  edit sheet)
- `/profile/[userId]/badges` — Badge gallery
- `/profile/[userId]/rounds/[roundId]` — Round detail on profile

### Other

- `/notifications` — Notification panel
- `/lists` — Saved lists (courses + clips)
- `/leaderboards` — Period leaderboards

### Admin

- `/admin`, `/admin/dashboard`, `/admin/courses`, `/admin/courses/[id]`
  — Admin-only moderation + course editor

---

## 4. Home page — above the fold (HomeTour)

In render order from the top:

1. **TourItTopBar** (from `layout.tsx`) — hamburger menu (left), Tour It
   logo + wordmark (center), leaderboard chip (right). Sticky.
2. **MayCompetitionBanner** — green "May Competition — $100 GOLFNOW
   CREDIT on the line" pill banner.
3. **"Tour It All" search button** — green-rim glow box, Source Serif 4
   bold-italic placeholder + Inter caption
   `courses · holes · trips · golfers`. Tap → `/tour`. **This is the
   headline element.**
4. **Courses Near Me rail** — `COURSES NEAR ME` section label +
   `10MI / 25MI / 50MI` pills + map shortcut. Horizontal scroll of
   nearby course cards. Falls back to "Enable location" pill when
   permission unknown.

Below the fold: **Your Tour** rail (round/trip cards + Plan-Another
tile), then **Tour the Feed** thumbnails rail, then `BottomNav` (Home /
Tour / Upload / Tee Up / Profile). Recent tightening commits brought
the top of the Tour-the-Feed thumbnails to peek above the bottom nav on
a 6.1" phone.

---

## 5. Last ~25 commits — main focus

**Theme: tighten and beautify the YourTour module on home; new
profile-avatar UX; polish.**

Concretely, the last few weeks have been:

- **YourTour card iteration on home** (~12 of the last 25 commits):
  rebuilt the round/trip cards from scratch with uniform layout,
  identity-badge + chip + type icon header, course-flag rail,
  full-width game CTA, game-ready chip with stakes ($25/$25/$50),
  uniform card widths, hero-sized course badges.
- **Profile avatar upload** (last 7 commits): new `AvatarCropSheet`
  with pinch + drag → fixed-picture / movable-circle model, shared
  page-level file input, timestamped storage path to defeat the
  browser cache that was silently dropping saves.
- **Trip/round detail page**: tee-time editable from the Edit Game
  sheet, attach-game-to-existing-trip from the `CreateGameSheet`,
  bigger avatars + listed names on member + game-player rows.
- **Typography system**: settled on Source Serif 4 (editorial) + Inter
  (UI), loaded via `next/font` in `layout.tsx`.
- **Performance audit**: removed 31 render-blocking
  `@import url(fonts.googleapis.com)` calls scattered across pages —
  text now paints on first frame instead of waiting for a CSS
  round-trip.
- **Home SWR cache**: localStorage stale-while-revalidate for tours /
  nearMe / feed teasers so repeat visits paint instantly.
- **Course search sharpening + Suggest-a-Course button** on the
  trip-page add-course sheet.
- **Sub-themes**: bottom nav slimmer (all pages), `/tour` search bar
  matched 1:1 with home, sparkles icon replacing the awkward "Start
  Planning" glyph on `/trip-ideas/[slug]`.

Net direction: the home YourTour module is the most-iterated surface
in the app right now, with the profile avatar UX as the secondary
thread.
