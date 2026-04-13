# /seo-schema — Generate JSON-LD Structured Data for Tour It

You are a structured data expert. Generate JSON-LD schema markup for Tour It (touritgolf.com) to unlock Google rich results for golf courses and videos.

## Why This Matters for Tour It
- **VideoObject schema** on hole pages → Google Video rich results (huge CTR boost)
- **GolfCourse schema** on course pages → Knowledge Panel eligibility
- **BreadcrumbList** → Sitelinks in search results
- **Organization schema** in root layout → Brand authority

## Schemas to Implement

### 1. Organization (root layout.tsx — one time)
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Tour It",
  "url": "https://touritgolf.com",
  "logo": "https://touritgolf.com/tour-it-logo-new.png",
  "description": "Golf course scouting platform. Preview any course, one hole at a time.",
  "sameAs": []
}
```

### 2. GolfCourse (courses/[id]/page.tsx)
```json
{
  "@context": "https://schema.org",
  "@type": "GolfCourse",
  "name": "[Course Name]",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "[City]",
    "addressRegion": "[State]",
    "addressCountry": "US"
  },
  "url": "https://touritgolf.com/courses/[id]",
  "description": "Hole-by-hole video previews and golfer tips for [Course Name]."
}
```

### 3. VideoObject (courses/[id]/holes/[number]/page.tsx)
```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "Hole [N] at [Course Name] — [Shot Type]",
  "description": "[Golfer's notes/tip text]",
  "thumbnailUrl": "[thumbnail URL]",
  "uploadDate": "[ISO date]",
  "contentUrl": "[video URL]",
  "embedUrl": "https://touritgolf.com/courses/[id]/holes/[number]",
  "author": {
    "@type": "Person",
    "name": "[Uploader name]"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Tour It",
    "logo": {
      "@type": "ImageObject",
      "url": "https://touritgolf.com/tour-it-logo-new.png"
    }
  }
}
```

### 4. BreadcrumbList (course and hole pages)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://touritgolf.com" },
    { "@type": "ListItem", "position": 2, "name": "[Course Name]", "item": "https://touritgolf.com/courses/[id]" },
    { "@type": "ListItem", "position": 3, "name": "Hole [N]", "item": "https://touritgolf.com/courses/[id]/holes/[number]" }
  ]
}
```

## Implementation Pattern (Next.js)
Always inject JSON-LD via a `<script>` tag in the page component:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaObject) }}
/>
```

## Your Job
When invoked, identify which page(s) need schema, generate the complete JSON-LD objects with real dynamic data wired in, and write the implementation into the correct page files. Use actual DB field names from the Prisma schema (Course, Hole, Upload tables).

Read `prisma/schema.prisma` first to get accurate field names before generating.
