// Run: node seed-courses-scarsdale.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://awlbxzpevwidowxxvuef.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I'
);

function slugify(name, city) {
  return (name + '-' + city).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function mapAccess(access) {
  if (access === 'Private') return 'PRIVATE';
  if (access === 'Semi-Private') return 'SEMI_PRIVATE';
  return 'PUBLIC';
}

const courses = [
  {
    name: "Quaker Ridge Golf Club",
    city: "Scarsdale",
    state: "NY",
    zipCode: "10583",
    yearEstablished: 1916,
    access: "Private",
    description: "Quaker Ridge is Tillinghast's treasure — a par-70 championship course widely regarded as the best in the New York metropolitan area and one of the finest in the world. Founded in 1916 and opened in 1918, A.W. Tillinghast redesigned seven existing holes and built eleven new ones on rolling Westchester terrain that rewards every form of golf intelligence. Gil Hanse has restored the layout twice, sharpening what Tillinghast built without softening it. Quaker Ridge has hosted two Walker Cups, two Metropolitan Opens, three Metropolitan PGA Championships, and the 2018 Curtis Cup — a record that puts it in rare company among private clubs in the Northeast.",
    coverImageUrl: null,
    logoUrl: null,
  },
  {
    name: "Fenway Golf Club",
    city: "Scarsdale",
    state: "NY",
    zipCode: "10583",
    yearEstablished: 1920,
    access: "Private",
    description: "Fenway Golf Club is one of the great Tillinghast designs in the Northeast — a par-70 layout at 6,680 yards with wickedly sloping greens, cavernous bunkers, and tricky landing areas that demand precision over power. Founded in 1920 on the Scarsdale estate of publishing baron Eugene Reynal and named after James Fenimore Cooper, who settled here a century earlier, Fenway initially hired Devereux Emmet before bringing in Tillinghast — who was simultaneously designing Winged Foot and Quaker Ridge down the road. Sam Snead and Byron Nelson praised the greens. Tommy Armour called it one of America's best. GolfWeek ranks it among the 100 Greatest Classical Courses in the United States.",
    coverImageUrl: null,
    logoUrl: null,
  },
  {
    name: "Sunningdale Country Club",
    city: "Scarsdale",
    state: "NY",
    zipCode: "10583",
    yearEstablished: 1913,
    access: "Private",
    description: "Sunningdale Country Club was organized in 1913 and named after the storied Sunningdale Golf Club in Berkshire, England — a statement of ambition that the course has lived up to for over a century. Seth Raynor laid out the original course on 149 acres in 1918, working alongside Charles Blair Macdonald, the father of American golf architecture. Walter Travis revised the layout two years later to eliminate blind shots, and A.W. Tillinghast returned in 1929 to reconfigure holes to make room for a pool. The result is a par-70 course at 6,820 yards with a course rating of 71.6 — a layered, historically rich layout on the same stretch of Westchester that produced Winged Foot, Quaker Ridge, and Fenway.",
    coverImageUrl: null,
    logoUrl: null,
  },
  {
    name: "Scarsdale Golf Club",
    city: "Hartsdale",
    state: "NY",
    zipCode: "10530",
    yearEstablished: 1898,
    access: "Private",
    description: "Scarsdale Golf Club is Westchester County's second-oldest golf club, founded in 1898 to attract residents to the growing Scarsdale community. Willie Dunn laid out the original nine holes; Carl Fox expanded to 18 by 1900. A.W. Tillinghast was brought in to redesign the course in the early 1920s, adding seven new holes and overhauling others — his plans were completed in 1924. The club sits on expansive grounds in Hartsdale with a 1921 clubhouse, six har-tru tennis courts, an Olympic pool, platform tennis, and six bowling lanes. A full-service private club that has anchored Westchester golf for more than 125 years.",
    coverImageUrl: null,
    logoUrl: null,
  },
  {
    name: "Saxon Woods Golf Course",
    city: "Scarsdale",
    state: "NY",
    zipCode: "10583",
    yearEstablished: 1931,
    access: "Public",
    description: "Saxon Woods is one of six Westchester County-run public courses and routinely draws more rounds than any other course in the county. Designed by Tom Winton and opened in 1931, the course plays through rolling, wooded terrain that gives it a vintage parkland character — narrow fairways lined by mature trees, elevated greens, and a layout that uses topography rather than length to set up the challenge. It plays to a maximum of 6,293 yards at par 72 with three tee configurations. Recent renovations have rebuilt all tees and several greens. Located off Exit 22 of the Hutchinson River Parkway, it is the most accessible quality public track in this part of Westchester.",
    coverImageUrl: "https://golf.westchestergov.com/wp-content/uploads/2016/04/Saxon-Woods-Golf-Course.jpg",
    logoUrl: "https://golf.westchestergov.com/wp-content/uploads/2016/04/wcgolf_logo.png",
  },
];

async function run() {
  let inserted = 0;
  let skipped = 0;

  for (const c of courses) {
    const slug = slugify(c.name, c.city);
    const courseType = mapAccess(c.access);
    const isPublic = c.access !== 'Private';

    const { data: existing } = await supabase
      .from('Course')
      .select('id, name')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      console.log(`SKIP  ${c.name} (slug "${slug}" already exists)`);
      skipped++;
      continue;
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from('Course').insert({
      id: crypto.randomUUID(),
      name: c.name,
      slug,
      city: c.city,
      state: c.state,
      country: 'US',
      zipCode: c.zipCode,
      yearEstablished: c.yearEstablished,
      description: c.description,
      coverImageUrl: c.coverImageUrl,
      logoUrl: c.logoUrl,
      courseType,
      isPublic,
      holeCount: 18,
      isVerified: true,
      uploadCount: 0,
      saveCount: 0,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    if (error) {
      console.error(`ERROR ${c.name}:`, error.message);
    } else {
      console.log(`OK    ${c.name} (${courseType})`);
      inserted++;
    }
  }

  console.log(`\nDone — ${inserted} inserted, ${skipped} skipped.`);
}

run().catch(console.error);
