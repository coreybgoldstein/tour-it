# Tour It — Beta Launch Audit (2026-05-25)

Background-agent deep audit across `src/app/**`, `src/components/**`, `src/lib/**`, `src/hooks/**`, `src/app/api/**`. Severity ordered.

## CRITICAL — fix before beta

1. **`Upload.holeNumber` column does not exist.** Every notification deep-link to a specific clip falls back to course root. `Hole.holeNumber` exists; `Upload.holeId` joins to it.
   - `src/app/page.tsx:1430`
   - `src/app/courses/[id]/page.tsx:626`
   - `src/app/courses/[id]/holes/[number]/page.tsx:445`
   - `src/app/profile/[userId]/page.tsx:808`
   - `src/app/api/push/send/route.ts:80,93,106,134`
   - `src/app/api/likes/toggle/route.ts:90,119`
   - **Fix:** drop holeNumber from `.select`, join Hole by `holeId` to get the number.

2. **Hole-page comment insert is missing `updatedAt`.** Prisma's `@updatedAt` is metadata; Postgres won't auto-fill. NOT NULL violation → comment never persists, but UI shows it optimistically. `src/app/courses/[id]/holes/[number]/page.tsx:434-436`. **Fix:** pass `createdAt` + `updatedAt` like the other handlers.

3. **`/api/push/send` queries wrong table for `trip_invite`.** Uses `Trip`, real table is `GolfTrip`. Every trip-invite push 404s. `src/app/api/push/send/route.ts:148`. **Fix:** `Trip` → `GolfTrip`.

4. **`/api/user/delete` filters ModerationReport by wrong column.** Uses `reporterId`, real is `reportedById`. `src/app/api/user/delete/route.ts:28`.

5. **`/api/user/delete` doesn't clean up many FKs.** Missing deletes for GolfTripMember, GolfTrip, TripGame, Round, View, Save, CourseRequest, etc. Will fail on FK violation. `src/app/api/user/delete/route.ts:5-50`.

6. **`useKeyboardAwareSheet` still used alongside `.tourit-sheet` in 4 places** (CLAUDE.md forbids). Sheets collapse when keyboard opens.
   - `src/app/courses/[id]/page.tsx:525,527`
   - `src/app/courses/[id]/holes/[number]/page.tsx:362`
   - `src/app/search/page.tsx:55,64`
   - **Fix:** remove the hook calls.

7. **`course-trip-picker` id is on the BACKDROP, not the sheet panel.** `src/app/courses/[id]/page.tsx:2615`. **Fix:** move id to the inner `.tourit-sheet`.

8. **Trip page exposes any trip to any authed user.** No `GolfTripMember` membership check. Privacy leak for private buddy trips. `src/app/trips/[id]/page.tsx:371-419`. **Fix:** redirect non-members.

9. **`/games/[id]` has zero auth or membership check.** Anyone with the id reads stakes/players. `src/app/games/[id]/page.tsx:73-101`. **Fix:** check GolfTripMember for `data.tripId`.

10. **`/api/feedback` is public, unauth, no rate limit, no HTML escaping.** User input flows into email HTML — XSS into the inbox / spam vector. `src/app/api/feedback/route.ts`. **Fix:** require auth, `rateLimit()`, escape user fields.

11. **Login & signup ignore `next` / `redirect` query param.** Upload page sends to `/login?redirect=/upload`; ActionZone sends `/login?next=…`; login always lands on `/`. `src/app/login/page.tsx:75-80`, `src/app/signup/page.tsx:122-124`.

12. **Signup doesn't validate username availability.** DB unique constraint throws raw message. `src/app/signup/page.tsx:67-117`.

13. **Onboarding inserts new Course directly from the client.** Bypasses the "never insert, only update" seeding rule. Also creates 18 Hole rows with par 0 from a tap — spam vector. `src/app/onboarding/profile/page.tsx:208-239`. **Fix:** funnel through CourseRequest like `/add-course`.

14. **Series clips mount EVERY shot's video element concurrently.** 4-shot series = 4 `<video>`s; multiple visible series + peek-rail hit iOS WKWebView's ~16-element cap, remaining videos render black. `src/app/page.tsx:515-522`. **Fix:** mount only active shot's video; others as poster.

15. **`ClipViewer.submitComment` missing Notification + push + points pipeline.** Owner doesn't get notified when commented from ClipViewer. `src/components/ClipViewer.tsx:132-154`.

## HIGH — visible to users

16. **`crypto.randomUUID()` missing for Comment id on hole page** — combined with #2, insert silently fails. `src/app/courses/[id]/holes/[number]/page.tsx:434-436`.
17. **Comment handlers don't set `Notification.referenceId`.** Bell can't deep-link comment notifs. All 4 comment paths.
18. **Course/profile/hole comment handlers don't update `Upload.rankScore`.** Only home page does. Feed sort drifts as comments come in.
19. **Tee-box selection in upload is dead-ended.** User picks tee color → never sent to API. `teeBoxId` hard-coded null. `src/app/upload/page.tsx:25,1533-1542`.
20. **`HANDICAP_RANGES` defined and never used.** `src/app/upload/page.tsx:56-61`. Dead code + uploader handicap context never captured per-clip.
21. **`/api/likes/toggle` calls `/api/push/send` without forwarding cookies.** Push send 401s → `like_milestone` push never fires. `src/app/api/likes/toggle/route.ts:133-137`.
22. **Tee Up "Quick Round" never fires push for trip invites.** Notification row inserted but no `sendPushToUser`. `src/app/tee-up/page.tsx:348-374`.
23. **`registerPush` called from useEffect with no user gesture.** iOS Capacitor needs the permission prompt from a tap. Silently denied for first-time users. `src/app/page.tsx:970`.
24. **Welcome modal copy isn't a bottom sheet** (CLAUDE.md rule). `src/app/page.tsx:2041-2069`.
25. **Onboarding modal on `/` also isn't a `.tourit-sheet`.** `src/app/page.tsx:2072-2114`.
26. **Native `alert()` used for upload + share errors.** Breaks design system on iOS WebView. `src/app/tee-up/page.tsx:343`; `src/app/trips/[id]/page.tsx:1083,2299,2338`.
27. **Feedback page shows no error on submit failure.** `src/app/feedback/page.tsx:34-44`.
28. **Home page "load more" loses the `uploadedByUsername` attribution chip.** Hero-tagged clips past first 15 show as owned by new owner only. `src/app/page.tsx:1267,1295-1314`.
29. **Trip-invite Notifications don't set `referenceId`.** `src/app/tee-up/page.tsx:361-374`; `src/app/trips/[id]/page.tsx:558-569`.
30. **Login error messages always "Invalid email or password"** — even on Supabase outages, rate-limit, etc. `src/app/login/page.tsx:60-63`.
31. **`useSave` uses `.single()` instead of `.maybeSingle()`** — throws PGRST116 on every first course visit. `src/hooks/useSave.ts:42-47`.
32. **Upload page logs `[GPS]` spam to console on every video pick.** Prod noise + perf. `src/app/upload/page.tsx:300-482`.
33. **Trips page redirect doesn't preserve `?next`.** `src/app/trips/page.tsx:26`.
34. **iOS WKWebView users can't sign in with Google at all.** Buttons hidden in login/signup with no in-app fallback or explanation for users who started on web. `src/app/login/page.tsx:19-23`, `src/app/signup/page.tsx:29-33`.
35. **`/api/uploads/create` defaults missing `holeId` to hole 1.** For FULL_ROUND uploads where hole 1 has no par, auto-creates Hole row with `par: 0` — corrupts scorecard math. `src/app/api/uploads/create/route.ts:99-107`.
36. Home feed loops `?welcome=1` cleanup only on mount → modal re-fires across tabs.
37. **`AppDownloadBanner` overlays content without padding** — covers hamburger button on first visit. `src/components/AppDownloadBanner.tsx:68-82`.
38. Onboarding profile uses multiple `autoFocus` props — feels jumpy on iOS. `src/app/onboarding/profile/page.tsx:331,341,400,487`.
39. Home feed discovery section render path not fully suppressed when logged out.
40. Home feed comment sheet relies on a 500ms ref grace flag for iOS tap re-fire — fragile.
41. **Quick Round date format `new Date(quickDate + "T00:00:00")` has timezone bug** — day shifts back by one in negative UTC offsets. `src/app/tee-up/page.tsx:307`.

## MEDIUM — polish

42. All `<img>` tags in feed grids load eagerly — no `loading="lazy"` anywhere.
43. `useKeyboardAwareSheet` imported but unused in `trips/[id]/page.tsx:10`. Dead import.
44. Home comment fetch type cast `(c.user?.UserProgression as any[])?.[0]?.rank` — fragile join schema.
45. `extractCourseIdFromLink` covers most patterns but worth a unit test.
46. `/api/push/send` requires sender auth even for system milestones — needs an internal/service-role push helper.
47. `NotificationBell.tsx` polls Notification every 30s but is unmounted; confirm it stays unmounted.
48. `BottomNav.tsx` Search button creates/destroys a hidden input — works but verify VoiceOver semantics.
49. **Same comment handler logic exists 4 times** — extract `lib/postComment.ts` helper. Reference impls: home, course, hole, profile.
50. `isMayActive()` hard-coded to month 4 / year 2026 — reminder for June 1. `src/lib/competitions.ts:1-4`.
51. Profile page redirect doesn't wrap `useSearchParams` in Suspense. `src/app/profile/page.tsx:9`.
52. Trips index loses tab state and ordering across sessions.
53. Geolocation: Capacitor WKWebView returns "prompt" even after grant — document fallback.
54. `computeRankScore` re-fetch every comment is N+1 — move into a single RPC.
55. `SeriesCard` always renders all shots in the DOM with opacity transition — see #14.
56. `prefetchedCoursesRef` resets to a fresh Set on every mount.
57. `loadFeed` does 5 sequential Supabase queries — could be 1 RPC.
58. **`/admin/page.tsx` doesn't verify `isAdmin` server-side** — RLS only. Worth a server check. `src/app/admin/page.tsx:94`.
59. Nominatim queries missing User-Agent header per their TOS. `src/app/onboarding/profile/page.tsx:216`, `src/app/map/page.tsx:199`.
60. `/lib/rateLimit.ts` in-memory Map is per-Vercel-instance — zero protection against floods. Use Upstash/KV.
61. Course page comment error path leaves spinner stuck. `src/app/courses/[id]/page.tsx:608-678`.
62. Profile page has its own inline edit-clip sheet instead of using shared `<EditClipSheet>`. Two implementations to maintain.
63. Tee-Up uses a custom-overlay pattern (`#quick-round-overlay`, `#new-trip-overlay`) instead of `.tourit-sheet`. Inconsistent.
64. `/round/[id]` server page fetches the same data twice per request — use `cache()`.
65. `/api/cron/auto-seed-courses` runs daily but `/api/courses/[id]/auto-seed` fires client-side after every upload — duplicate work, no dedupe. `src/app/upload/page.tsx:753`.
66. `useLike` console.error on toggle failure — prod noise. `src/hooks/useLike.ts:155`.

## LOW — nice-to-haves

67. **No app-wide `not-found.tsx`** — unknown routes show Next default page. Add `src/app/not-found.tsx`.
68. `/about/layout.tsx:11` has og:image TODO.
69. `/about` signup CTA events not tracked through analytics.
70. `useLike` cache is module-global, grows unbounded — cap at 500 entries.
71. `leaderboards/page.tsx` polls every 10s in addition to broadcast subscription — double-fetches.
72. `extractCourseIdFromLink` worth unit testing for `/courses/[id]/holes/N?clip=…`.
73. Hole page reportDone setTimeout doesn't clear on unmount — leak in dev.
74. HlsVideo: verify HLS fallback on iOS Capacitor.
75. `AppDownloadBanner` z-index 1500 above tourit-sheet — verify no overlap with mid-sheet usage.
76. Welcome "Find my home course" button routes to `/search` — maybe upload makes more sense for completed onboarding users.
77. `/api/admin/resync-points` scans all UserPointsLedger rows in 1000-row pages — slow once >50k users.
78. **Large files needing post-launch refactor:** `/courses/[id]/page.tsx` 2,769 lines; `/page.tsx` 2,257; `/profile/[userId]/page.tsx` 2,038; `/trips/[id]/page.tsx` 3,301; `/tee-up/page.tsx` 1,405; `/upload/page.tsx` 1,751.
79. Login button "Logging in..." text doesn't reset for Google flow back-out edge case.

---

## The four that hurt users on Day 1

- **#1** Upload.holeNumber phantom column → every clip deep-link broken
- **#2** Hole-page comments silently fail at DB level
- **#6** Four sheets visually collapse when keyboard opens
- **#8/#9** Trip and game pages leak private data to any authed user

## Coverage gaps in this audit

Trips game-scoring logic (3,301-line file), every individual `/admin/*` sub-route, points-system config, `compressVideo.ts`, `optimizeCover.ts`, `getVideoSrc.ts`. These warrant focused passes post-launch.
