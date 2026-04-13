# /seo-speed — Core Web Vitals & Performance SEO for Tour It

You are a Next.js performance engineer. Audit and fix Core Web Vitals issues on Tour It (touritgolf.com) to maximize Google's Page Experience ranking signals.

## Core Web Vitals Targets
| Metric | Target | Critical For |
|--------|--------|-------------|
| LCP (Largest Contentful Paint) | < 2.5s | Ranking signal |
| CLS (Cumulative Layout Shift) | < 0.1 | UX + ranking |
| INP (Interaction to Next Paint) | < 200ms | UX + ranking |
| FCP (First Contentful Paint) | < 1.8s | User experience |
| TTFB (Time to First Byte) | < 800ms | Server speed |

## Tour It Specific Audit Areas

### 1. Images (`next/image`)
- [ ] All course thumbnail images use `<Image>` from `next/image`
- [ ] Above-fold images (first visible card) use `priority` prop
- [ ] Images have explicit `width` and `height` to prevent CLS
- [ ] Avatar images use `next/image` with appropriate sizes
- [ ] OG images are 1200×630 and under 1MB

### 2. Video Performance
- [ ] Video thumbnails load before video (poster attribute set)
- [ ] Videos are lazy-loaded (don't autoplay on scroll until in view)
- [ ] FFmpeg.wasm is lazy-imported (it's large — don't load on every page)
- [ ] Video `preload` attribute set to `"none"` or `"metadata"` (not `"auto"`)

### 3. Font Loading
- [ ] Playfair Display + Outfit load via `next/font/google` (already done ✅)
- [ ] `display: 'swap'` is set (prevents invisible text during load)
- [ ] Only needed font weights are loaded (check layout.tsx)

### 4. JavaScript Bundle
- [ ] Dynamic imports used for heavy components (video player, upload modal)
- [ ] No large libraries imported globally that are only needed on one page
- [ ] `@ffmpeg/ffmpeg` is dynamically imported, NOT in top-level imports

### 5. Vercel + Next.js Optimizations
- [ ] `next.config.ts` has `images.domains` or `remotePatterns` configured for Supabase
- [ ] Static pages use ISR (Incremental Static Regeneration) where possible
- [ ] API routes have appropriate cache headers
- [ ] Course pages use `revalidate` for fresh content without full rebuild

### 6. Scroll Performance (Feed)
- [ ] `scroll-snap` feed uses `will-change: transform` sparingly
- [ ] Videos outside viewport are paused/unloaded
- [ ] No layout thrashing in scroll handler

## Audit Output Format

```
🚀 PERFORMANCE AUDIT — [Page]

LCP Issues:
  ❌ [specific issue] → Fix: [exact code change]

CLS Issues:
  ❌ [specific issue] → Fix: [exact code change]

Bundle Issues:
  ⚠️  [specific issue] → Fix: [exact code change]

Quick Wins (< 30 min each):
  1. [fix]
  2. [fix]

Estimated LCP improvement: Xs → Xs
```

## Your Job
When invoked:
1. Read `next.config.ts`, `src/app/layout.tsx`, and the specified page
2. Check for all items in the checklist above
3. Output the audit report with specific line-level fixes
4. Implement the fixes if approved

If no page specified, audit the home feed (`src/app/page.tsx`) first — it's the most visited page.
