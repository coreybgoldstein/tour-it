# Tour It — Beta Pressure-Test Checklist

Everything pushed today (2026-05-25). Run through this on device. PASS if it works as described, FAIL + note if not.

**Live URL:** https://www.touritgolf.com
**To pick up new bundle on iOS:** force-quit Tour It → reopen.
**For brand-new user flow:** sign out OR use a private/incognito tab.

---

## 1. New User Journey (the biggest change today)

### 1a. Brand-new email signup
- [ ] Go to `/signup` (or hit "Create an account" on the home welcome modal)
- [ ] Try a username that's already taken — should show **"That username is already taken"** (not a raw Postgres error)
- [ ] Try a real signup with valid info
- [ ] After signup, lands on `/onboarding/profile`
- [ ] Onboarding shows only ONE screen: avatar picker + first name input + "Get Started" button
- [ ] Tap the avatar — bottom sheet opens with 13 default avatars + "Upload from photos"
- [ ] Type first name + tap Get Started → drops to home feed `/`
- [ ] **No level/rank/points UI visible anywhere on your profile** (because you have 0 points)
- [ ] After ~1.2s on home feed, a green "Stay in the loop" banner appears above the BottomNav
- [ ] Tap "Turn on" → iOS asks for notification permission (this is the critical fix — previously silently denied)
- [ ] Tap × on the banner → it dismisses and never returns (stored in localStorage)

### 1b. Brand-new Google/Apple OAuth signup
- [ ] On iOS app, Google button is hidden (web shows it)
- [ ] On web, tap "Continue with Google" → OAuth flow → comes back through `/auth/callback`
- [ ] First-time OAuth users land on `/onboarding/profile` (same single-screen identity)
- [ ] Avatar prefilled from Google profile picture if present
- [ ] First name prefilled from Google `given_name`
- [ ] Tap Get Started → home feed

### 1c. The `?next=` flow
- [ ] Sign out
- [ ] Go to `/upload` while logged out → redirects to `/login?redirect=/upload`
- [ ] After login, should land on `/upload` (NOT `/`)
- [ ] Same with signup: `/login?next=/courses/abc` → after signup should land on `/courses/abc`

### 1d. Returning user (already onboarded)
- [ ] Log in as existing user
- [ ] Verify you DON'T see the new onboarding screen — straight to home feed
- [ ] Verify the welcome modal doesn't show (you've been onboarded)

---

## 2. Comments, Likes, Notifications (engagement pipeline)

### 2a. Comment from each surface (4 paths must all match)
For each surface below, sign in as User A, comment on User B's clip. Verify User B receives:
- An in-app Notification (bell icon)
- A push notification on their phone
- Notification deep-links to **the specific clip** (not just the course root)
- Points awarded (+3 for comment_received)

Surfaces to test:
- [ ] **Home feed**: open a clip in the vertical feed, tap comment, post
- [ ] **Course profile**: tap into the hole grid → feed modal → comment
- [ ] **Hole page**: navigate directly to `/courses/[id]/holes/[number]` → comment
- [ ] **User profile**: tap a clip on someone's profile → feed modal → comment
- [ ] **ClipViewer** (open from the kebab on your own clip): comment there too

Each should:
- [ ] Insert the Notification row
- [ ] Fire the push
- [ ] Award points
- [ ] Update `Upload.rankScore` (the feed sort should drift correctly over time)

### 2b. Comment button "filled" state
- [ ] After commenting on a clip, the comment button turns green / fills
- [ ] State persists across refreshes (because Comment row exists)
- [ ] Works on all 5 surfaces

### 2c. Likes
- [ ] Heart toggles on/off
- [ ] Count under heart is tappable → opens "Who liked this" half-sheet
- [ ] Sheet shows avatars + names, taps route to profiles
- [ ] Hitting 10 likes triggers a milestone push to the clip owner (was broken — push send needed cookies)

---

## 3. Tee Up / Games (the recent feature)

### 3a. Schedule a Round (Quick Round)
- [ ] Tap Tee Up → New Round
- [ ] Pick a course, pick a date, optionally tee time, add a friend
- [ ] Submit → trip is created
- [ ] **Date saved is correct** (NOT one day earlier — timezone bug fix)
- [ ] Friend you invited gets a Notification + a push (was Notification-only)
- [ ] Both notifications include `referenceId` (deep-link works)

### 3b. Play a Game (unified Create Game flow)
- [ ] Tap Tee Up → Play a Game
- [ ] Single sheet — course, date, players, format, stakes all on one screen
- [ ] Type into course search — keyboard opens cleanly, search results show above keyboard
- [ ] Type a player handicap — can delete it down to empty (not stuck on "0")
- [ ] Pick a format → stakes section appears
- [ ] Tap Create Game → lands on `/games/[gameId]`
- [ ] The game page shows hero card + players + stakes + "Open Scoreboard" CTA

### 3c. Trip / Game privacy
- [ ] Open `/trips/[some-trip-id]` where you're NOT a member → should redirect to `/tee-up`
- [ ] Open `/games/[some-game-id]` where you're NOT a member of the trip → "Game not found"
- [ ] Owner (trip creator) always has access
- [ ] Unauthenticated visitor → bounced to `/login?next=…`

---

## 4. Bottom Sheets / Keyboard (kept breaking last week)

For each of these sheets, tap a text input — keyboard should rise smoothly, sheet content stays visible above keyboard, no "gap" where the page bleeds through:

- [ ] **CreateGameSheet** (Tee Up / Play a Game) — course search input
- [ ] **EditClipSheet** (profile clip → kebab → Edit) — "Who hit this shot?" tag search
- [ ] **Course profile Contribute sheet** — typing in any field
- [ ] **Course profile Trip picker sheet** — search input
- [ ] **Comment sheets** on all 4 clip surfaces
- [ ] **Search page** Add-a-course / filter sheets

Also verify:
- [ ] No sheet is using the "alert()" pattern anymore for errors (look for native iOS alerts)

---

## 5. Profile Page (rebuilt last week)

### Own profile
- [ ] Loads fast (no freeze on button taps — virtualized feed)
- [ ] Tap a clip thumbnail → feed modal opens
- [ ] Right-rail buttons (Intel, Like, Comment, Send It, kebab) all respond
- [ ] Heart count under like opens "Who liked this" sheet
- [ ] Edit own profile → handicap field — try to clear an existing handicap → confirm dialog appears
- [ ] Don't see the level/badge pills if you have 0 points; SEE them after earning

### Other user's profile
- [ ] Same feed UX as your own
- [ ] No edit buttons / kebab on their clips
- [ ] Their progression UI (level/badges) renders if they have points

---

## 6. Course Profile / Hole Page

- [ ] Course profile loads — hero, hole grid, clips
- [ ] Hole tile shows "X clips" indicator only (no aggregate likes/comments — removed yesterday)
- [ ] Tap a hole → feed opens on that hole's clips
- [ ] Inside the hole-grid feed: comment, like, share buttons all work
- [ ] Send It on a single clip → share URL is `/courses/[id]/holes/[n]?clip=[id]` (deep link to that clip, not just the course)

---

## 7. Search Page

- [ ] Search "Add a course" — submit button reads "Submit for review" (NOT "Add Course")
- [ ] On submit, see green "Thanks — we'll review and add it within 24h" pill
- [ ] **No** new Course / Hole rows created from the client
- [ ] CourseRequest row visible in Supabase admin

---

## 8. Feedback Page

- [ ] Logged-out user: blocked (401)
- [ ] Logged-in user: submit feedback with HTML / `<script>` / quotes in the text
- [ ] Verify the email arrives with content escaped (no script execution in email client preview)
- [ ] Rapid resubmits (6+ in a minute) hit the rate limit

---

## 9. Misc smoke tests

- [ ] Notifications bell — tap a "new comment" notif, deep-links to the specific clip (not course root)
- [ ] Points Ledger entries are tappable when they reference a clip
- [ ] Hero-tag notification: "View clip" link visible BEFORE accept/decline
- [ ] Console (Safari Web Inspector) — verify no `[GPS]` spam during upload

---

## 10. Things to **also try** (chaos testing)

- [ ] Background the app mid-upload, foreground, resume
- [ ] Lose network mid-comment-submit, regain
- [ ] Like the same clip 10x rapidly — count should stay correct
- [ ] Comment on someone's clip then delete that clip — notification still resolves cleanly
- [ ] Sign up with email "x@x.com" and same username twice from two browsers — second one fails with friendly error
- [ ] Delete your account: should clean up Likes, Comments, Uploads, Trips, etc. without FK errors

---

## If anything is FAIL — flag the item number + paste any error/console output + I'll patch ASAP.
