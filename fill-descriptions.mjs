// fill-descriptions.mjs
// Fetches factual course descriptions from Wikipedia, then passes them through
// Claude to rewrite in a fresh, personal voice (not AI-generated sounding).
// Skips courses that already have a description.

import Anthropic from '@anthropic-ai/sdk';

const SUPABASE_URL = 'https://awlbxzpevwidowxxvuef.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I';

const client = new Anthropic();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function supabaseFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${path}: ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function searchWikipedia(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.query?.search?.[0]?.title || null;
}

async function getWikipediaExtract(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(title)}&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (page.missing) return null;
  return page.extract || null;
}

async function rewriteWithClaude(courseName, location, wikiText) {
  const prompt = `You're writing a short description of a golf course for a scouting app called Tour It.
The description should sound like it was written by a golfer who's actually played there — honest, specific,
and fun to read. NOT corporate, NOT generic, NOT AI-generated sounding.

Course: ${courseName}
Location: ${location}

Here's factual Wikipedia content about this course:
---
${wikiText.slice(0, 2000)}
---

Write a 2-4 sentence description that:
- Uses specific facts from the Wikipedia content (designer, year opened, notable features, rankings, events hosted)
- Sounds conversational, like a golfer giving a friend a heads up
- Mentions what makes the course distinct (the vibe, a specific challenge, what to expect)
- Does NOT use phrases like "nestled", "boasts", "stunning", "breathtaking", or other AI clichés
- Does NOT start with "Located in..."

Return ONLY the description text, nothing else.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text.trim();
}

async function main() {
  console.log('Fetching courses with uploads that need descriptions...');

  const uploads = await supabaseFetch('/Upload?select=courseId&limit=5000');
  const courseIds = [...new Set(uploads.map(u => u.courseId))];

  const courses = await supabaseFetch(
    `/Course?select=id,name,city,state,description&id=in.(${courseIds.join(',')})`
  );

  const needDesc = courses.filter(c => !c.description);
  console.log(`${needDesc.length} courses need descriptions (${courses.length - needDesc.length} already have one)`);

  let added = 0;
  let failed = 0;

  for (const course of needDesc) {
    const location = [course.city, course.state].filter(Boolean).join(', ');
    console.log(`\nProcessing: ${course.name} (${location})`);

    try {
      // Search Wikipedia
      const searchQuery = `${course.name} golf course ${location}`;
      const wikiTitle = await searchWikipedia(searchQuery);

      if (!wikiTitle) {
        console.log(`  No Wikipedia article found`);
        failed++;
        await sleep(500);
        continue;
      }

      console.log(`  Wikipedia: "${wikiTitle}"`);
      const extract = await getWikipediaExtract(wikiTitle);

      if (!extract || extract.length < 100) {
        console.log(`  Wikipedia article too short or empty`);
        failed++;
        await sleep(500);
        continue;
      }

      // Rewrite with Claude
      const description = await rewriteWithClaude(course.name, location, extract);
      console.log(`  Description: ${description.slice(0, 100)}...`);

      // Save to DB
      await supabaseFetch(`/Course?id=eq.${course.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ description }),
      });

      console.log(`  Saved`);
      added++;

    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      failed++;
    }

    await sleep(1500);
  }

  console.log(`\nDone. Added ${added} descriptions, failed/skipped ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
