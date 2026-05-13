// Phase 1 batch — Northeast Cavalier-tour courses. Each entry hard-codes the
// 18 hero photo URLs (validated from geekedongolf.com tour pages) + an intel
// description per hole. Runs them sequentially.

import { seedCourseImagery } from "./lib/seed-course-imagery.mjs";

// Helper to build Cavalier URL — strips the WordPress CDN resize params so we
// always grab the original full-resolution image.
const gog = (path) => `https://i0.wp.com/geekedongolf.com/wp-content/uploads/${path}`;

// ============================================================================
// 1. National Golf Links of America (Southampton, NY) — id 314cfa79...
//    Cavalier tour: 2016/02. URL pattern uses "-jc" suffix.
// ============================================================================
const NGLA = {
  courseId: "314cfa79-a92b-47e7-8643-0ce4f952f421",
  courseDescription: "C.B. Macdonald's 1911 masterpiece on the Peconic Bay — the template-hole bible. Every hole is a study (Sahara, Alps, Redan, Eden, Punchbowl, Road, Cape) and the windmill watches over all of it. The course that taught American golf architecture how to think.",
  courseYear: 1911,
  holes: [
    { holeNumber: 1, imageUrl: gog("2016/02/ngla1-teezoom-jc.jpg"),  description: "Opening uphill par 4. Pick the right side off the tee to open the green; the closer line down the left brings the cross bunker into play." },
    { holeNumber: 2, imageUrl: gog("2016/02/ngla2-teezoom-jc.jpg"),  description: "Sahara — short par 4 with the iconic Sahara waste area on the diagonal. Lay back to a comfortable yardage; bold drivers can flirt with the bunker face." },
    { holeNumber: 3, imageUrl: gog("2016/02/ngla3-tee-jc.jpg"),       description: "Alps-Sahara — the longest par 4 on the front, blind tee shot over a ridge to a fairway you'll never quite trust. Approach plays uphill into a green guarded short." },
    { holeNumber: 4, imageUrl: gog("2016/02/ngla4-teezoom-jc.jpg"),  description: "Redan — the most copied par 3 in golf, played left-to-right across the green's slope. Aim at the front-right of the green and let the contour feed it back." },
    { holeNumber: 5, imageUrl: gog("2016/02/ngla5-teezoom-jc.jpg"),  description: "Hog's Back — fairway humps and rolls; ideal tee shot finds the top of the spine for a downhill look in. Anything off the crown leaves a sidehill." },
    { holeNumber: 6, imageUrl: gog("2016/02/ngla6-tee-jc.jpg"),       description: "Short — a tiny par 3 you'd miss entirely if not for the punishing bunker complex around the green. Center pin is the only safe call." },
    { holeNumber: 7, imageUrl: gog("2016/02/ngla7-tee-jc.jpg"),       description: "St. Andrews — Road Hole template. Lay-up off the tee leaves a long uphill blind approach; the back bunker is one of the deepest on the property." },
    { holeNumber: 8, imageUrl: gog("2016/02/ngla8-teezoom-jc.jpg"),  description: "Bottle — sand mounds split the fairway into a left and right channel. Right channel is shorter but tighter; left channel is generous but longer in." },
    { holeNumber: 9, imageUrl: gog("2016/02/ngla9-teezoom-jc.jpg"),  description: "Long — par 5 with the punishing 'Hell's Half Acre' style cross hazard you must carry on the second. Lay up smart and wedge in." },
    { holeNumber: 10, imageUrl: gog("2016/02/ngla10-tee-jc.jpg"),     description: "Shinnecock — par 5 with a magnificent green setting. Reachable in two only after a perfect drive over the corner." },
    { holeNumber: 11, imageUrl: gog("2016/02/ngla11-tee-jc.jpg"),     description: "Plateau — climbing par 4 with the Principal's Nose bunker complex you have to thread. Picking the right side reveals the green." },
    { holeNumber: 12, imageUrl: gog("2016/02/ngla12-teezoom-jc.jpg"), description: "Sebonac — dogleg right with bunkers down the left. The green slopes hard from back to front; long is a guaranteed three-putt." },
    { holeNumber: 13, imageUrl: gog("2016/02/ngla13-tee-jc.jpg"),     description: "Eden — Macdonald's Eden template, modeled on St. Andrews' 11th. Strath bunker short-right, hill bunker over the back. Center of the green is plenty good." },
    { holeNumber: 14, imageUrl: gog("2016/02/ngla14-tee-jc.jpg"),     description: "Cape — par 4 with the cape-hole tee shot over the bay. Bite off as much as you dare; the green sits on a peninsula." },
    { holeNumber: 15, imageUrl: gog("2016/02/ngla15-tee-jc.jpg"),     description: "Narrows — split fairway, choose the side that leaves the better angle to the day's pin. Wind off the bay never lets up here." },
    { holeNumber: 16, imageUrl: gog("2016/02/ngla16-tee-jc.jpg"),     description: "Punchbowl — short par 4 to a green sunk into a natural hollow. Everything funnels toward the center; just get it close in the bowl." },
    { holeNumber: 17, imageUrl: gog("2016/02/ngla17-tee-jc.jpg"),     description: "Peconic — par 4 with the bay on your right and the pot-bunker berm down the left. Pick a line and commit." },
    { holeNumber: 18, imageUrl: gog("2016/02/ngla18-tee-jc1.jpg"),    description: "Home — uphill par 4 finishing under the windmill. Aim left of the bunker complex for the cleanest look at one of golf's most photographed greens." },
  ],
};

// ============================================================================
// 2. Fishers Island Club (Town of Southold, NY) — id f41ecf85...
//    Cavalier tour: 2017/02. URL pattern: fishersisland{N}-{angle}.jpg
// ============================================================================
const FISHERS_ISLAND = {
  courseId: "f41ecf85-ee08-4b8b-b99f-42e8027972a9",
  courseDescription: "Seth Raynor's 1926 masterpiece on a private island off the Connecticut coast. The most consistently named top-10 routing in America — every hole frames the Sound, the wind never stops, and the templates (Redan, Punchbowl, Biarritz, Cape, Alps) sit on land that looks like it was waiting for them.",
  courseYear: 1926,
  holes: [
    { holeNumber: 1, imageUrl: gog("2017/02/fishersisland1-teezoom.jpg"), description: "Opening par 4. Easy walk-up with water close to the right. Get the ball in play; the green has more break than it shows." },
    { holeNumber: 2, imageUrl: gog("2017/02/fishersisland2-teezoom.jpg"), description: "Short par 4 with the green falling away. Driver in close brings out-of-bounds left; iron and wedge is the conservative line." },
    { holeNumber: 3, imageUrl: gog("2017/02/fishersisland3-tee.jpg"),      description: "Par 3 over the ravine. Pick a club for the calm, then add one — wind off the Sound is rarely calm." },
    { holeNumber: 4, imageUrl: gog("2017/02/fishersisland4-tee.jpg"),      description: "Alps — Raynor's template, with the blind approach over the ridge to a punchbowl green. Aim at the marker, trust your number." },
    { holeNumber: 5, imageUrl: gog("2017/02/fishersisland5-tee.jpg"),      description: "Short par 4 along the coastline. The fairway slopes hard right-to-left; perfect drives feed into wedge range." },
    { holeNumber: 6, imageUrl: gog("2017/02/fishersisland6-teezoom.jpg"),  description: "Par 4 with the Sound stretched out in front. Position the tee shot down the right; the approach is downhill to a deep green." },
    { holeNumber: 7, imageUrl: gog("2017/02/fishersisland7-tee.jpg"),      description: "Long par 4 with cross bunkers staggered short of the green. Two of your best to give yourself a putt." },
    { holeNumber: 8, imageUrl: gog("2017/02/fishersisland8-teezoom.jpg"),  description: "Cape — Raynor's cape hole, the fairway curling along the Sound. Bite off as much as the wind allows." },
    { holeNumber: 9, imageUrl: gog("2017/02/fishersisland9-tee.jpg"),      description: "Par 5 closing the front. Reachable for big hitters; the green is well-protected by sand short." },
    { holeNumber: 10, imageUrl: gog("2017/02/fishersisland10-teezoom.jpg"), description: "Par 3 with the green resting on a knoll. Anything short is rejected; the safe miss is over the back." },
    { holeNumber: 11, imageUrl: gog("2017/02/fishersisland11-teezoom.jpg"), description: "Par 3 to the famous peninsula green — water on three sides. There is no safe shot. Pick a number and execute." },
    { holeNumber: 12, imageUrl: gog("2017/02/fishersisland12-tee.jpg"),     description: "Punchbowl par 4 — the green sits in a natural hollow that gathers everything in. Center of the bowl is the play." },
    { holeNumber: 13, imageUrl: gog("2017/02/fishersisland13-fairway.jpg"), description: "Long par 4 with the green guarded by a deep bunker right. The fairway feeds toward trouble; aim left center." },
    { holeNumber: 14, imageUrl: gog("2017/02/fishersisland14-tee.jpg"),     description: "Long par 3 — frequently into the wind off the Sound. Take the club, swing easy, accept a two-putt." },
    { holeNumber: 15, imageUrl: gog("2017/02/fishersisland15-tee.jpg"),     description: "Par 4 turning back inland. Position the drive for the right angle in; the green tilts hard from back to front." },
    { holeNumber: 16, imageUrl: gog("2017/02/fishersisland16-teezoom.jpg"), description: "Biarritz par 3 — the green has a deep swale across the middle. Pin behind the swale demands distance; pin in front demands precision." },
    { holeNumber: 17, imageUrl: gog("2017/02/fishersisland17-teezoom.jpg"), description: "Redan-style par 3 — the green slopes left and the contour feeds running shots back. Aim front-right and let it go." },
    { holeNumber: 18, imageUrl: gog("2017/02/fishersisland18-teezoom.jpg"), description: "Home — long par 4 finishing toward the clubhouse with the Sound behind. Position over distance; the green is severely tiered." },
  ],
};

// ============================================================================
// 3. Somerset Hills Country Club (Bernardsville, NJ) — id d7f33ed6...
//    Cavalier tour: 2018/02. Pattern: somersethills{N}-{angle}.jpg
// ============================================================================
const SOMERSET_HILLS = {
  courseId: "d7f33ed6-873a-4f70-9bcf-ddd19c3056b4",
  courseDescription: "A.W. Tillinghast's 1918 design, considered one of his most underrated. The front nine is open and flowing, the back nine drops into rolling wooded terrain with cape-style holes and a Redan that may be the prettiest par 3 in the Northeast.",
  courseYear: 1918,
  holes: [
    { holeNumber: 1, imageUrl: gog("2018/02/SHCC1-TeeZoom.jpg"),  description: "Gentle opener. Fairway is wide; the green has more slope than it looks." },
    { holeNumber: 2, imageUrl: gog("2018/02/SHCC2-TeeZoom.jpg"),  description: "Reachable par 5 with bunkers staggered through the layup zone. Big hitters can chase one in two." },
    { holeNumber: 3, imageUrl: gog("2018/02/SHCC3-TeeZoom.jpg"),  description: "Tillinghast's Reef par 3 — the green raised behind a wave of fairway. Anything short is rejected." },
    { holeNumber: 4, imageUrl: gog("2018/02/SHCC4-Tee.jpg"),      description: "Doglegging par 4 with the bunker complex you have to pick a side around. Right of the bunker leaves a wedge in." },
    { holeNumber: 5, imageUrl: gog("2018/02/SHCC5-TeeZoom.jpg"),  description: "Long par 4. Position the drive past the cross hazard; the green is open in front to allow a running approach." },
    { holeNumber: 6, imageUrl: gog("2018/02/SHCC6-TeeZoom.jpg"),  description: "Short par 4. Risk-reward — the bold line leaves a chip, the safe line leaves a flip wedge." },
    { holeNumber: 7, imageUrl: gog("2018/02/SHCC7-TeeZoom.jpg"),  description: "The famous Redan — tilted left-to-right, with bunkers tight to the high side. The kick-in line is front-right." },
    { holeNumber: 8, imageUrl: gog("2018/02/SHCC8-TeeZoom.jpg"),  description: "Long par 4 with one of the toughest tee shots on the course. Trees pinch the right side." },
    { holeNumber: 9, imageUrl: gog("2018/02/SHCC9-TeeZoom.jpg"),  description: "Closing the front — climbing par 4 up to the clubhouse vista." },
    { holeNumber: 10, imageUrl: gog("2018/02/SHCC10-TeeZoom.jpg"), description: "Plunging par 4 dropping into the lower property. Position over power; the green has multiple tiers." },
    { holeNumber: 11, imageUrl: gog("2018/02/SHCC11-Tee.jpg"),     description: "Par 5 wrapping around a hill. Strategic decision off the tee on which side to play to." },
    { holeNumber: 12, imageUrl: gog("2018/02/SHCC12-TeeZoom.jpg"), description: "Cape-style par 4 over the corner of the lake. Carry as much as the wind allows." },
    { holeNumber: 13, imageUrl: gog("2018/02/SHCC13-TeeZoom.jpg"), description: "Mid-iron par 3 across the valley. The green is large but the wind is unpredictable in the bowl." },
    { holeNumber: 14, imageUrl: gog("2018/02/SHCC14-TeeZoom.jpg"), description: "Long uphill par 4. Most players are hitting a long iron in — center of the green is the only sensible play." },
    { holeNumber: 15, imageUrl: gog("2018/02/SHCC15-TeeZoom.jpg"), description: "Reachable par 5 — make a move here before the closing stretch tightens up." },
    { holeNumber: 16, imageUrl: gog("2018/02/SHCC16-Tee.jpg"),     description: "Short par 4. Driveable for the bold, but the green is small and well-defended." },
    { holeNumber: 17, imageUrl: gog("2018/02/SHCC17-TeeZoom.jpg"), description: "Par 3 with the green falling away. Pick the right club; long is dead." },
    { holeNumber: 18, imageUrl: gog("2018/02/SHCC18-Tee.jpg"),     description: "Closing par 4 climbing back to the clubhouse. Position the drive on the right side for the cleanest angle in." },
  ],
};

// ============================================================================
// 4. Whippoorwill Club (Armonk, NY) — id d8e0e0db...
//    Cavalier tour: 2018/04. Pattern: whippoorwill{N}-{angle}.jpg
// ============================================================================
const WHIPPOORWILL = {
  courseId: "d8e0e0db-d574-46ef-927d-3b08d8b3a129",
  courseDescription: "C.H. Alison's 1928 routing through Westchester rolling terrain, with a 2014 Gil Hanse restoration that brought back the original bunker shapes and angles. Quiet Westchester perfection — never on top-100 lists because nobody talks about it, and the membership likes it that way.",
  courseYear: 1928,
  holes: [
    { holeNumber: 1, imageUrl: gog("2018/04/Whippoorwill1-TeeZoom.jpg"),  description: "Opener climbing over a ridge. Tee shot down the right opens the green; trees pinch the left." },
    { holeNumber: 2, imageUrl: gog("2018/04/Whippoorwill2-TeeZoom.jpg"),  description: "Mid par 4. The Alison-style bunker complex you must pick a side around dominates the landing zone." },
    { holeNumber: 3, imageUrl: gog("2018/04/Whippoorwill3-Tee.jpg"),      description: "Par 3 with deep bunkers wrapping the front. Pin-high or chasing." },
    { holeNumber: 4, imageUrl: gog("2018/04/Whippoorwill4-TeeZoom.jpg"),  description: "Reachable par 5 with strategic bunkering. Big drives open up an eagle look; conservative players have plenty of room to lay up." },
    { holeNumber: 5, imageUrl: gog("2018/04/Whippoorwill5-TeeZoom.jpg"),  description: "Short par 4 with a brilliant template green — slope dictates everything." },
    { holeNumber: 6, imageUrl: gog("2018/04/Whippoorwill6-Tee.jpg"),      description: "Long par 4. Hanse's restoration sharpened the bunker angles here; aim away from the right side." },
    { holeNumber: 7, imageUrl: gog("2018/04/Whippoorwill7-Tee.jpg"),      description: "Par 3 to a green falling away. Long is dead; the safe miss is short-right." },
    { holeNumber: 8, imageUrl: gog("2018/04/Whippoorwill8-TeeZoom.jpg"),  description: "Long par 4 with a dogleg. Trees on the corner punish anything cut tight." },
    { holeNumber: 9, imageUrl: gog("2018/04/Whippoorwill9-TeeZoom.jpg"),  description: "Closing the front. Uphill par 4 to a green with significant tiering." },
    { holeNumber: 10, imageUrl: gog("2018/04/Whippoorwill10-Tee.jpg"),     description: "Par 4 starting the back. Wide fairway but the second shot is a long iron into a tilted green." },
    { holeNumber: 11, imageUrl: gog("2018/04/Whippoorwill11-Tee.jpg"),     description: "Reachable par 5 — the eagle hole. Bombers can chase the green; mortals lay up to a comfortable wedge." },
    { holeNumber: 12, imageUrl: gog("2018/04/Whippoorwill12-Tee.jpg"),     description: "Par 3 with deep bunkers ringing the front. Center pin is always the play." },
    { holeNumber: 13, imageUrl: gog("2018/04/Whippoorwill13-TeeZoom.jpg"), description: "Long par 4 dropping downhill. Position over power; the green sits below you." },
    { holeNumber: 14, imageUrl: gog("2018/04/Whippoorwill14-TeeZoom-1.jpg"), description: "Par 4 climbing back up the property. Position the drive for the cleanest angle." },
    { holeNumber: 15, imageUrl: gog("2018/04/Whippoorwill15-TeeZoom.jpg"), description: "Short par 4 — driveable but tight. Either commit to driver or hit iron and wedge." },
    { holeNumber: 16, imageUrl: gog("2018/04/Whippoorwill16-TeeZoom.jpg"), description: "Mid-iron par 3. The green is small and surrounded by sand — distance control is everything." },
    { holeNumber: 17, imageUrl: gog("2018/04/Whippoorwill17-TeeZoom.jpg"), description: "Long par 5 — the second shot decision hole. Lay up to your favorite yardage." },
    { holeNumber: 18, imageUrl: gog("2018/04/Whippoorwill18-TeeZoom.jpg"), description: "Closing par 4 climbing to the clubhouse. The green has been restored to its original Alison shape — more deception than it shows." },
  ],
};

async function run() {
  for (const cfg of [NGLA, FISHERS_ISLAND, SOMERSET_HILLS, WHIPPOORWILL]) {
    console.log(`\n=== ${cfg.courseId} ===`);
    try {
      await seedCourseImagery(cfg);
    } catch (e) {
      console.error(`  ✗ FAILED: ${e.message ?? e}`);
    }
  }
  console.log("\nPhase 1 NE batch complete.");
}

run().catch(e => { console.error(e); process.exit(1); });
