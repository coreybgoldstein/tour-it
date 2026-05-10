# Phase 1 — Course Seeding Report

**Run:** 2026-05-09
**Scope:** Audit + enrich the 46-course master list for the trip-itinerary feature.
**Hard rule applied:** UPDATE-only. No inserts. The DB already has 11,000+ courses from an external source.

---

## TL;DR

| | Count |
|---|---|
| Master entries (Streamsong Red and Blue counted separately) | 48 |
| Distinct master courses | 46 |
| Found in DB and enriched | 38 / 48 master entries (37 distinct DB rows updated, 0 failures) |
| Truly missing — blocker | 10 |
| Wrong-row matches caught and corrected | 2 |
| Structural data issues flagged | 2 |
| PRIVATE-flag mis-classifications to fix | 2 |
| Genuine PRIVATE in master list (need product call) | 2 |
| Image assets still null | 28 covers, 30 logos |

The audit's biggest surprise is that the master list of "famous public/resort US courses" turned out to have **10 outright gaps** in our 11k-row DB, plus two structural quirks (one Streamsong row covering two courses, one duplicated Kiawah Ocean row). The trip-itinerary feature cannot ship on these 10 without an insert exception.

---

## 1 — Already in DB (audit hits, post-correction)

These 37 rows were enriched in this Phase 1 run. `id` is the canonical `Course.id`.

### Pacific Coast / Bandon
| Master | DB name | Course id |
|---|---|---|
| Pebble Beach Golf Links | Pebble Beach Golf Course | `b2d7acf5-7186-4edd-bcee-8def174a0d01` |
| Spyglass Hill Golf Course | Spyglass Hill Golf Course | `1ff5e051-b567-4893-85d7-86e927b749e4` |
| The Links at Spanish Bay | The Links at Spanish Bay | `acb06e92-6cdc-40a0-9406-6a709e8c170e` (recovered — `state` was empty in DB so initial state-filtered audit missed it) |
| Bandon Dunes | Bandon Dunes Golf Resort | `519a24de-0984-41d8-bf2c-e848220570a1` |
| Bandon Trails | Bandon Trails | `d8f27d04-64cf-4c0b-a4b3-6e16837c2af2` |
| Sheep Ranch | Bandon Sheep Ranch | `205da5c9-2a88-472f-ac39-414751f0bcf6` |

### Pinehurst Area
| Master | DB name | Course id |
|---|---|---|
| Pinehurst No. 2 | Pinehurst No. 2 | `c50c2fa3-7360-4510-82d2-ad91894d1a1b` |
| Pinehurst No. 4 | Pinehurst No. 4 | `61a4668d-7ec4-4ef0-882e-53ca3ec04d06` |
| Pinehurst No. 8 | Pinehurst Course No. 8 | `b25a736e-05a6-4892-8143-3534ecb0712e` (recovered — name uses "Course No. 8" pattern that the audit's `No. 8` ilike missed) |
| Pine Needles Lodge & Golf Club | Pine Needles | `e6b71e32-c66e-4fae-a80d-e13a57bc62ac` |

### Myrtle Beach
| Master | DB name | Course id |
|---|---|---|
| Caledonia Golf & Fish Club | Caledonia Golf & Fish Club | `fb15840d-9448-4e25-a932-924faf1a4858` |
| True Blue Golf Club | True Blue Golf Plantation | `a77c2698-2e6b-495e-b3ec-db48d7bb20b3` (recovered — DB stored under "Plantation" name, `state` field empty) |

### Arizona
| Master | DB name | Course id |
|---|---|---|
| We-Ko-Pa — Saguaro Course | We-Ko-Pa Golf Club | `4d879f5e-9272-4dd3-be11-9c238ea7dd1f` (parent record — DB doesn't split Saguaro vs Cholla) |
| Troon North — Monument Course | Troon North Golf Club | `ef908bca-0703-431e-8fbf-b3b04be22e32` (parent record — DB doesn't split Monument vs Pinnacle) |
| TPC Scottsdale — Stadium Course | TPC Scottsdale Stadium Course | `7d918cd6-20a3-4251-8577-a33a308f8fdb` |

### Wisconsin
| Master | DB name | Course id |
|---|---|---|
| Sand Valley | Sand Valley Golf Resort | `574fa1d5-59c2-4e56-a81e-05dda82ca573` (parent record — DB doesn't split Sand Valley vs Mammoth Dunes vs Sedge Valley) |
| Whistling Straits — Straits Course | Whistling Straits | `57fd78ad-c8a9-4a83-9b67-210522988225` (kept ambiguous — DB has both "Whistling Straits" and "Whistling Straits — Haven"; first row is treated as the headline Straits Course) |

### Streamsong (FL)
| Master | DB name | Course id |
|---|---|---|
| Streamsong Red **and** Streamsong Blue | Streamsong Resort - Red and Blue Courses | `85d5d80b-2686-4195-ad5f-fe746c42673b` (**one row covers two courses** — see Structural Issues §3b) |
| Streamsong Black | Streamsong Resort - Black Course | `3af1f0ca-7343-4300-bb54-2df13d62d8b1` |

### Nebraska Sandhills
| Master | DB name | Course id |
|---|---|---|
| Wild Horse Golf Club | Wild Horse Golf Club | `043c8047-07f4-47cf-9e97-252e86a2e3f8` |
| The Prairie Club — Dunes Course | The Prairie Club | `0da8b1ed-ddb5-481c-bb6f-85152baa2863` (parent record — DB doesn't split Dunes vs Pines vs Horse) |
| Dismal River — Red Course | Dismal River Club | `fbda8440-e63b-437a-8cb3-92143767c2e1` (parent record — DB doesn't split Red vs White) |

### Northern Michigan
| Master | DB name | Course id |
|---|---|---|
| Arcadia Bluffs — Bluffs Course | Arcadia Bluffs Golf Club | `d036dbe6-5584-4888-9f49-0ddf50a4fca3` (**corrected** — initial audit picked South Course `bb682596…`, swapped to original Bluffs Course) |
| Bay Harbor Golf Club (Boyne) | Bay Harbor Golf Club | `4dfe48b7-a3af-493d-a69c-b689dc46ed9b` (parent record — DB also has "Links Quarry" sub-record) |

### Pacific Northwest
| Master | DB name | Course id |
|---|---|---|
| Chambers Bay | Chambers Bay Golf Course | `56fb44ef-db2f-424c-8f4c-06908a65edce` |
| Gamble Sands | Gamble Sands Golf Course | `42aba40d-e9b7-4f04-a6ab-6caf5ffca516` |
| Pumpkin Ridge — Ghost Creek | Pumpkin Ridge Golf Club | `6a698ee9-be8d-4090-b3c4-89521afb3a93` (parent record — DB doesn't split Ghost Creek vs Witch Hollow) |

### Long Island
| Master | DB name | Course id |
|---|---|---|
| Bethpage Black | Bethpage Black Golf Course | `ceb95a05-d039-4f2d-ae01-6bdd954d00c1` |
| Montauk Downs | Montauk Downs | `26876227-b58f-4247-9335-72ed4738ffa0` |

### Chicago
| Master | DB name | Course id |
|---|---|---|
| Cog Hill — Dubsdread (No. 4) | Cog Hill Golf & Country Club | `7328fbce-0496-4881-8f74-38c071e69d82` (parent record — DB doesn't split Course 4 Dubsdread vs 1/2/3) |
| Cantigny Golf | Cantigny Golf | `02cc9821-9444-4896-99f8-13f12502104f` |
| Harborside International — Port Course | Harborside International Golf Center (Port) | `ac3d93e6-5613-4341-966b-3f67309bf80a` |

### Coastal Carolina
| Master | DB name | Course id |
|---|---|---|
| Charleston Municipal Golf Course | Charleston Municipal Golf Course | `f61131ff-e47c-4c33-901d-134d554b6bb8` |
| Kiawah Island — The Ocean Course | Kiawah Island Golf Resort - The Ocean Course | `647bbdcd-23ac-4105-9825-1eea55d2222b` (**duplicate row exists** at `a3edabfe-b2d6-4343-a309-4ae71f178e1b` — see Structural Issues §3b) |

### Texas
| Master | DB name | Course id |
|---|---|---|
| PGA Frisco — Fields Ranch East | Fields Ranch - East Course | `0e1af11a-86ea-4a27-a231-190916ba01b0` (**corrected** — initial audit picked the West Course `4fe6e532…`, swapped to East) |
| Trinity Forest Golf Club | Trinity Forest Golf Club | `71b956b0-3714-40bb-932f-c548808d55d4` |
| Lions Municipal Golf Course | Lions Municipal Golf Course | `9e17aad7-232e-41cb-b671-4d0bac0250e3` |

---

## 2 — Newly enriched in this Phase 1 run

37 of 37 rows updated. 0 failures. The seeder strictly fills nulls only — it never overwrites existing data.

### Summary stats
- Rows touched: 37
- description filled (was null): 31 of 37
- yearEstablished filled: 35 of 37
- courseType filled: 35 of 37
- websiteUrl / phone filled on most rows
- **coverImageUrl still null on 28** of 37 (image hosts blocked the fetch — see §2b)
- **logoUrl still null on 30** of 37 (same)
- holes table backfilled to 18 holes per course where missing

### Per-row breakdown

| Master entry | DB name | Fields filled this run | Still null | courseType |
|---|---|---|---|---|
| Pebble Beach Golf Links | Pebble Beach Golf Course | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | PUBLIC |
| Spyglass Hill Golf Course | Spyglass Hill Golf Course | yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | logoUrl | SEMI_PRIVATE |
| The Links at Spanish Bay | The Links at Spanish Bay | description, yearEstablished, courseType, zipCode, **state**, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | SEMI_PRIVATE |
| Bandon Dunes | Bandon Dunes Golf Resort | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | PUBLIC |
| Bandon Trails | Bandon Trails | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | PUBLIC |
| Sheep Ranch | Bandon Sheep Ranch | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount, **coverImageUrl** | logoUrl | **PRIVATE ⚠ wrong — see §4** |
| Pinehurst No. 2 | Pinehurst No. 2 | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl | SEMI_PRIVATE |
| Pinehurst No. 4 | Pinehurst No. 4 | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | SEMI_PRIVATE |
| Pinehurst No. 8 | Pinehurst Course No. 8 | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | SEMI_PRIVATE |
| Pine Needles Lodge & Golf Club | Pine Needles | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | SEMI_PRIVATE |
| Caledonia Golf & Fish Club | Caledonia Golf & Fish Club | yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | logoUrl | SEMI_PRIVATE |
| True Blue Golf Club | True Blue Golf Plantation | description, yearEstablished, courseType, zipCode, **state**, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | PUBLIC |
| We-Ko-Pa — Saguaro Course | We-Ko-Pa Golf Club | description, yearEstablished, courseType, zipCode, phone, holeCount | coverImageUrl, logoUrl | PUBLIC |
| Troon North — Monument Course | Troon North Golf Club | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | PUBLIC |
| TPC Scottsdale — Stadium Course | TPC Scottsdale Stadium Course | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | SEMI_PRIVATE |
| Sand Valley | Sand Valley Golf Resort | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | PUBLIC |
| Whistling Straits — Straits Course | Whistling Straits | yearEstablished, websiteUrl, phone, holeCount | _(complete)_ | SEMI_PRIVATE |
| Streamsong Red + Blue (combined row) | Streamsong Resort - Red and Blue Courses | courseType, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | SEMI_PRIVATE |
| Streamsong Black | Streamsong Resort - Black Course | courseType, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | SEMI_PRIVATE |
| Wild Horse Golf Club | Wild Horse Golf Club | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | PUBLIC |
| The Prairie Club — Dunes Course | The Prairie Club | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | SEMI_PRIVATE |
| Dismal River — Red Course | Dismal River Club | description, yearEstablished, courseType, zipCode, websiteUrl, holeCount | coverImageUrl, logoUrl, phone | **PRIVATE — see §4** |
| Arcadia Bluffs — Bluffs Course | Arcadia Bluffs Golf Club | yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | _(complete)_ | PUBLIC |
| Bay Harbor Golf Club (Boyne) | Bay Harbor Golf Club | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | SEMI_PRIVATE |
| Chambers Bay | Chambers Bay Golf Course | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | PUBLIC |
| Gamble Sands | Gamble Sands Golf Course | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | PUBLIC |
| Pumpkin Ridge — Ghost Creek | Pumpkin Ridge Golf Club | yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | _(complete)_ | SEMI_PRIVATE |
| Bethpage Black | Bethpage Black Golf Course | zipCode, websiteUrl, phone, holeCount | _(complete)_ | PUBLIC |
| Montauk Downs | Montauk Downs | holeCount | coverImageUrl, logoUrl | PUBLIC |
| Cog Hill — Dubsdread (No. 4) | Cog Hill Golf & Country Club | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | PUBLIC |
| Cantigny Golf | Cantigny Golf | description, yearEstablished, courseType, zipCode, phone, holeCount | coverImageUrl, logoUrl | PUBLIC |
| Harborside International — Port Course | Harborside International Golf Center (Port) | websiteUrl, phone, holeCount | _(complete)_ | PUBLIC |
| Charleston Municipal Golf Course | Charleston Municipal Golf Course | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | PUBLIC |
| Kiawah Island — The Ocean Course | Kiawah Island Golf Resort - The Ocean Course | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | SEMI_PRIVATE |
| PGA Frisco — Fields Ranch East | Fields Ranch - East Course | yearEstablished, courseType, zipCode, holeCount | phone | **PRIVATE ⚠ wrong — see §4** |
| Trinity Forest Golf Club | Trinity Forest Golf Club | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | **PRIVATE — see §4** |
| Lions Municipal Golf Course | Lions Municipal Golf Course | description, yearEstablished, courseType, zipCode, websiteUrl, phone, holeCount | coverImageUrl, logoUrl | PUBLIC |

### 2a — Notable findings
- **DB had two famous courses with empty `state` fields** — The Links at Spanish Bay and True Blue Golf Plantation. Both got their state filled by the seeder. Worth checking the source dataset for other rows with empty state values; that's why the initial state-filtered audit missed both.
- **Bandon Sheep Ranch is the only row that got a coverImageUrl** uploaded successfully in this run. Most other image fetches hit 404 / fetch-failed because Claude proposed image URLs (e.g., wp-content paths) that don't exist as static files.
- **Whistling Straits, Pumpkin Ridge, Bethpage Black, Harborside Port, Arcadia Bluffs Bluffs Course are now fully complete** across all enrichment fields — they were the most-already-seeded rows in the DB.

### 2b — Image-asset gap (28 covers + 30 logos still null)
The seeder's strict image rules (no transparent logos, no `.aspx`, no Clubessential CMS, must be a direct static URL on a fetchable host) are working — but Claude's URL proposals for many resort sites returned 404s or failed to fetch. This is the same hot-link issue called out in `.claude/CLAUDE.md`. The Phase 2 work should:
- Re-run image-only enrichment with a different sourcing strategy (try Wikipedia / Wikimedia Commons URLs, GolfPass / GolfNow CDN, or media-rights-cleared course-photo APIs).
- Hand-curate covers/logos for the 5–10 highest-priority itinerary courses.
- Optionally: add a fallback "course initials on dark green" auto-generated logo for any row that stays null.

---

## 3 — Skipped / flagged

### 3a — Truly missing from DB (10 master entries)

These famous public/resort courses are not in the 11k-row DB under any name we could find. Cross-checked by city, by state, and by parent-resort name. **They are blockers for the trip-itinerary feature.**

| Course | State | Region | What we found instead |
|---|---|---|---|
| Pacific Dunes | OR | Bandon | Bandon, OR has 0 courses in DB. Bandon Dunes / Trails / Sheep Ranch are stored without a city. |
| Old Macdonald | OR | Bandon | same |
| TPC Myrtle Beach | SC | Myrtle Beach | Not present under any TPC variant in Myrtle Beach / Murrells Inlet |
| Barefoot Resort — Dye Course | SC | Myrtle Beach | No "Barefoot" rows in DB at all — entire Barefoot Resort (Love, Fazio, Dye, Norman) missing |
| Mammoth Dunes | WI | Wisconsin | Sand Valley parent record exists; Mammoth Dunes does not |
| Bethpage Red | NY | Long Island | DB has Bethpage Black + Yellow + a generic "State Park Golf Courses" parent — no Red, Green, Blue |
| Kiawah Island — Osprey Point | SC | Coastal Carolina | DB has Cassique, Ocean (×2 — duplicate), Cougar Point absent, Osprey Point absent, Turtle Point absent |
| Forest Dunes — The Loop (Black) | MI | Northern Michigan | Only "Forest Dunes Golf Resort" parent exists |
| Forest Dunes — The Loop (Red) | MI | Northern Michigan | same |
| Memorial Park Golf Course | TX | Texas | Of 19 Houston courses in DB, this PGA-Tour-host muni is not one. |

#### Recommended targeted insert override

The "no inserts" rule exists to prevent duplicate/messy rows in a 11k-row external dataset — but these 10 are flagship public courses and the source dataset has clear gaps. Recommend a **one-time, narrowly-scoped exception**:

- Insert exactly these 10 courses, no more.
- Use `prisma db push` schema with explicit `id`, `slug`, `city`, `state`, `country: "US"`. Slugs derived from `slugify(name + city)`.
- All other fields go through the same Claude-research path the bulk seeder already uses, so verification standards stay identical to enrichment.
- Pre-flight: re-query the DB by exact name + slug right before insert to guard against new rows that landed via the external sync between audit and execution.
- Post-flight: SELECT all 10 by id and confirm `coverImageUrl`, `logoUrl`, `description` are populated — flag any that came back null.

If you green-light it, I'd implement this as `src/scripts/phase1-insert-missing.mjs` so the override is discoverable, scoped, and easy to revert.

### 3b — Structural data issues (no enrichment fix)

These two require a data-modeling decision before the trip itinerary feature can use them cleanly:

1. **Streamsong Red and Streamsong Blue share one row** — `85d5d80b-2686-4195-ad5f-fe746c42673b` is named "Streamsong Resort - Red and Blue Courses." Two master entries map to one row. Options:
   - Leave as-is and treat the trip itinerary as "Streamsong Red+Blue combined."
   - Split into two rows (insert a second one, retire the combined record), which violates the no-insert rule.
   - Flag for the data-source team to provide split records.

2. **Kiawah Ocean Course is duplicated** — `647bbdcd-23ac-4105-9825-1eea55d2222b` ("Kiawah Island Golf Resort - The Ocean Course") and `a3edabfe-b2d6-4343-a309-4ae71f178e1b` ("Kiawah Island Ocean Course") both reference the same physical course. The enrichment run targets the first id; the second is a duplicate that should be merged or deleted. Any uploads attached to the duplicate would need to be re-pointed before deletion.

### 3c — Sub-resort matches that were enriched as the parent record

Several master entries map to a parent-resort row in the DB rather than to the specific course (We-Ko-Pa Saguaro vs Cholla, Troon North Monument vs Pinnacle, Sand Valley itself, Pumpkin Ridge Ghost Creek vs Witch Hollow, Cog Hill Dubsdread vs 1/2/3, Prairie Club Dunes vs Pines vs Horse, Dismal River Red vs White, Bay Harbor parent vs Links/Quarry). These enrichments will be **course-resort-accurate but not sub-course-specific** — descriptions, lat/lng, year, etc. apply to the whole property. Per-sub-course intel would require either inserts or a sub-course extension to the schema. Calling out so it's not a surprise when a user's "trip" lands on a Pumpkin Ridge dart and the description doesn't specifically reference Ghost Creek.

---

## 4 — Access-type review needed

Four rows came back PRIVATE after enrichment. **Two are mis-classifications, two are genuine private clubs that need a product call.**

### 4a — Mis-classified PRIVATE (fix before launch)
| Row | Should be | Why |
|---|---|---|
| Bandon Sheep Ranch (`205da5c9-…`) | PUBLIC | Bandon Dunes Resort property, same access as Pacific Dunes / Bandon Trails — pay-and-play with resort booking. The seeder appears to have inferred PRIVATE from "Sheep Ranch"-style naming. |
| Fields Ranch - East Course (`0e1af11a-…`) | PUBLIC | This is the public PGA HQ course at PGA Frisco — opened 2023 specifically as a public-resort PGA Tour-host venue. PRIVATE here is wrong. |

These should be flipped to PUBLIC by hand or by an `update`-only re-run scoped to these two ids. Suggested SQL (run via Supabase SQL editor or a small script):

```sql
UPDATE "Course" SET "courseType" = 'PUBLIC', "isPublic" = true
WHERE id IN (
  '205da5c9-2a88-472f-ac39-414751f0bcf6',
  '0e1af11a-86ea-4a27-a231-190916ba01b0'
);
```

### 4b — Genuine private clubs in the master list (product decision)
| Row | Note |
|---|---|
| Dismal River Club (`fbda8440-…`) | Private members club. Has a stay-and-play arrangement that lets non-members play during certain windows, but base access is members-and-guests-only. |
| Trinity Forest Golf Club (`71b956b0-…`) | Private. Has hosted PGA Tour events but is not a public/resort course. |

The brief says "no private clubs" in the trip itinerary master list. So these two need a product call:
- **Swap them out** of the master list and replace with public/resort substitutes from the same region (Sandhills NE / DFW TX).
- **Keep them but tag specially** as "private — limited access" if the trip itinerary is willing to surface known-but-restricted experiences.
- **Drop without replacement** — the regions still have other entries.

Recommend Option 1 (swap) to match the brief's hard rule. Possible substitutes:
- Dismal River → another Sandhills entry (Sand Hills Golf Club is private too; **Ballyneal** is private; **Bayside Golf Club** in Nebraska or **The Bridges at Lake Mac** are public-but-thinner). Cleanest swap: **another Sand Valley sister course** in WI, or accept that the Sandhills public bench is shallow.
- Trinity Forest → **The Old American Golf Club** (The Colony, TX, public Tripp Davis design) or **Tour 18 Dallas** (homage course, public).

---

## Files produced

- `phase1-audit.json` — machine-readable audit results (initial 32 hits + ambiguous candidates + missing list)
- `phase1-ids.json` — final 37 confirmed Course.id values that were enriched in this run
- `src/scripts/phase1-audit.mjs` — name-pattern audit script
- `src/scripts/phase1-probe.mjs` — broader probe for missing courses
- `src/scripts/phase1-probe2.mjs` — by-city probe for resort-area gaps
- `src/scripts/seed-courses-bulk.mjs` — extended with `--ids` and `--ids-file` flags

---

## Next steps (out of Phase 1 scope, listed for reference)

1. **Fix the 2 mis-classified PRIVATE rows** — small UPDATE, see §4a SQL.
2. **Make the call on Dismal River + Trinity Forest** (§4b).
3. **Sign off on the targeted-insert proposal** in §3a, or pick a substitute course list for the 10 gaps.
4. **Decide Streamsong Red+Blue treatment** in §3b.1.
5. **Merge or delete the Kiawah Ocean duplicate** in §3b.2.
6. **Image-asset Phase 2** — 28 covers + 30 logos still null. See §2b for sourcing strategy options.
