# /seo-sitemap — Generate & Maintain Sitemap for Tour It

You are an SEO engineer. Generate a dynamic sitemap for Tour It (touritgolf.com) using Next.js App Router's built-in sitemap support.

## Tour It Sitemap Strategy

### Static Routes (always indexed)
- `/` — Home feed
- `/search` — Course search

### Dynamic Routes (indexed, high priority)
- `/courses/[id]` — One per golf course in DB (HIGH priority)
- `/courses/[id]/holes/[number]` — One per hole with uploaded content (MEDIUM priority)

### Excluded Routes (noindex / private)
- `/profile`, `/upload`, `/trips`, `/lists`, `/notifications`
- `/onboarding`, `/login`, `/signup`, `/forgot-password`, `/reset-password`
- `/admin`, `/api/*`, `/settings`

## Implementation: Next.js App Router Sitemap

Create `src/app/sitemap.ts`:

```typescript
import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma'; // adjust import path

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://touritgolf.com';

  // Fetch all public courses
  const courses = await prisma.course.findMany({
    select: { id: true, updatedAt: true },
  });

  // Fetch all holes that have at least one upload
  const holesWithUploads = await prisma.hole.findMany({
    where: { uploads: { some: {} } },
    select: { courseId: true, number: true, updatedAt: true },
  });

  const courseUrls: MetadataRoute.Sitemap = courses.map((course) => ({
    url: `${baseUrl}/courses/${course.id}`,
    lastModified: course.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  const holeUrls: MetadataRoute.Sitemap = holesWithUploads.map((hole) => ({
    url: `${baseUrl}/courses/${hole.courseId}/holes/${hole.number}`,
    lastModified: hole.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...courseUrls,
    ...holeUrls,
  ];
}
```

## Also Create: robots.txt

Create `src/app/robots.ts`:

```typescript
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/courses/', '/search'],
        disallow: [
          '/profile',
          '/upload',
          '/trips',
          '/lists',
          '/notifications',
          '/onboarding',
          '/login',
          '/signup',
          '/forgot-password',
          '/reset-password',
          '/admin',
          '/api/',
          '/settings',
        ],
      },
    ],
    sitemap: 'https://touritgolf.com/sitemap.xml',
  };
}
```

## Your Job
1. Check if `src/app/sitemap.ts` and `src/app/robots.ts` already exist
2. Read `prisma/schema.prisma` to confirm field names (id, updatedAt, number, courseId, etc.)
3. Create or update both files with correct Prisma field names
4. Verify the Prisma client import path matches the project (`@/lib/prisma` or similar)
5. Report: "Sitemap will cover X courses + Y holes at launch"
