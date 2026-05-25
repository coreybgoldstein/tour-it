# Tour It — Onboarding Rewrite Plan

For your review tomorrow morning before I touch code.

## Direction you confirmed

1. **First 60 seconds:** the user watches their first hole clip. TikTok-pattern.
2. **Length:** 60 seconds, 2 screens of friction before they're in the app.
3. **Gamification:** hidden until they earn their first thing. Zero level/badge/points UI on day-zero accounts.
4. **Build:** plan first, ship tomorrow.

## What's currently in the way

Today's onboarding is `/onboarding/profile/page.tsx` (~870 lines, 4 step screens) + welcome modals on home:

- Step 1: Display name + username + photo
- Step 2: Handicap (with "I don't have a GHIN" toggle)
- Step 3: Home course (search + "add a course" path that **inserts directly into the Course table from the client** — flagged as critical in the audit)
- Step 4: Notifications

Plus a `welcome=1` modal on the home feed.

Friction items:
- Username chosen up front (~5% drop-off step; can be auto-suggested from name)
- Handicap step (irrelevant until they try to join a game)
- Home course step (irrelevant until they save a course; current step lets the client write to the Course table)
- Notifications step (Capacitor pattern requires a user gesture; current effect-driven `registerPush` call silently auto-denies)
- Level/rank/ledger UI immediately visible on profile

## Vision: two screens. Two interactions. They're in.

```
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│                  │         │                  │         │                  │
│   TOUR IT logo   │         │  [photo]         │         │   ◀ ▶            │
│                  │         │  First name      │         │  Auto-playing    │
│  Scout before    │         │  [______________]│         │  hole clip       │
│  you play.       │         │                  │         │  (real content,  │
│                  │         │                  │         │   not a video    │
│  ┌────────────┐  │  ───▶   │  Get started     │  ───▶   │   demo)          │
│  │  Apple    │  │         │                  │         │                  │
│  │  Google   │  │         │                  │         │  Right rail of   │
│  │  Email    │  │         │                  │         │  buttons. Live   │
│  └────────────┘  │         │                  │         │  app.            │
│                  │         │                  │         │                  │
└──────────────────┘         └──────────────────┘         └──────────────────┘
   Screen 1                     Screen 2                    Home feed
   ~10s                         ~15s                        (the moment)
```

### Screen 1 — Sign in (~10s)

- App lockup + one-line tagline ("Scout before you play.")
- Three buttons: **Continue with Apple**, **Continue with Google**, **Continue with Email**
- On iOS Capacitor: hide Google (existing behavior), keep Apple + Email
- Tiny "Already have an account? Log in" link at the bottom
- No marketing copy, no carousel, no value-prop tour

**Critical:** preserve `?next=` through Apple/Google/Email login round-trips (currently broken — audit item #11). After sign-in, route to Screen 2 if first-time, else `?next` or `/`.

### Screen 2 — Identity (~15s)

Just three controls:
- Avatar picker (default = one of the 14 system avatars assigned randomly; tap to change)
- First name input (auto-focus)
- Big green **Get Started** button

Skip:
- Username (auto-derive from first name on insert; user can change later from profile)
- Last name (move to profile edit; not needed for feed surface)
- Handicap (deferred — see "smart prompts" below)
- Home course (deferred — see "smart prompts")
- Notifications (deferred — see "smart prompts")

**On submit:** insert User row, mark `onboarded=true`, route into the home feed.

### The moment — Drop into a live feed

The first thing they see is real content. Auto-playing hole clip, swipe up for the next. This is *the* moment — the value of the app communicated in one frame.

**Two safeguards we need to add:**
- A small `?firstSession=1` flag that suppresses any push/permission prompts on first paint
- A featured-clip server preference: the home feed query first looks for `featured=true` clips so the first session starts on banger content, not whatever's freshest from some empty course

## Smart prompts — deferred onboarding

The four steps we removed don't disappear; they show up when the user *needs* the value the data unlocks:

| Step | When it fires | UI |
|---|---|---|
| **Handicap** | First time they tap into a game (Tee Up → Play a Game) | Inline field at the top of the player roster: "Add your GHIN so your strokes are right." Dismissable; persists. |
| **Home course** | First time they save a course OR tap the home-course empty state on profile | Inline pill on profile: "Pin your home course." Tap → search sheet. |
| **Notifications** | First time someone interacts with their content (like, comment, follow, hero-tag) | Bottom sheet: "Get a heads-up when this happens." [Turn on] / [Not now]. User gesture — registerPush fires from the tap, not from a useEffect. |
| **Username edit** | First time they tap their @ in a comment thread, OR via Profile → Edit | Existing username editor (works fine, just hide from initial onboarding) |

## Gamification rollout

**Day-zero account:**
- Profile shows: avatar, name, follow count, upload count, joined date.
- Hidden: level, rank, points, ledger, badge wall, "X to next level" pill.

**First earn moment (e.g. first upload, or first like received):**
- One-time celebratory bottom sheet:
  - 🏆 Big number "+20"
  - "You earned your first points."
  - One-paragraph explanation of the system
  - [See progression] button → opens the ledger sheet
- After this moment, the level/rank/ledger UI lights up on their profile

**Why:**
- Builds curiosity instead of confusion ("what's all this stuff?")
- Aligns with Duolingo's streak gating — points don't matter until you've done a thing
- Removes day-zero noise that competes with the "swipe through clips" moment

## What we leave alone for tomorrow

- The home feed itself (the moment that pays off everything else)
- All existing user accounts — gated by `onboarded=true` so we only show the new flow to new signups
- Username + handicap + home course + notifications data model (no schema change needed; we're just deferring the prompts)

## Implementation order (when you green-light)

1. New `/onboarding/welcome` route (Screen 1) — replaces `/onboarding/profile`
2. New `/onboarding/identity` route (Screen 2)
3. Wire `next` / `redirect` query param through login + signup + Apple OAuth callback (also fixes audit #11)
4. Move username + handicap + home-course steps into `/profile/edit` and inline smart prompts
5. Gate level/rank/ledger UI on `profile.userProgression.totalPoints > 0`
6. First-earn celebratory sheet on the `/api/points/award` response when `wasFirstAward === true`
7. Remove client-side Course insert from current `/onboarding/profile` — replace with the existing CourseRequest flow (also fixes audit #13)
8. Delete the legacy multi-step `/onboarding/profile` page

Estimated build time: 4–6 hours including the smart prompts.

## Open questions for you tomorrow

1. **First-session featured-content seed:** do you want me to pick 5–10 "showcase" clips to flag `featured=true` so the first auto-play is *always* a banger? Or trust whatever ranks highest already?
2. **Apple Sign In on iOS — production setup:** I'll wire the button + flow. You'll need to confirm the Apple Developer account is set up for Sign in with Apple (Capabilities tab). Yes/no?
3. **Username collisions:** when we auto-derive from first name (e.g. "Corey" → `@corey`), and `@corey` is taken, suffix with `_2`, `_3`, etc.? Or `_<4-char-hash>`?
4. **Do we delete or hide the legacy `/onboarding/profile`?** Soft delete (route returns 410) is safer in case any in-flight signup link still points there.
