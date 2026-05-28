# Tour It Image Proxy — Deploy Guide

Cloudflare Worker that fronts Supabase Storage and serves all
`tour-it-photos` bucket images from the Cloudflare edge cache.

After deploy, set `NEXT_PUBLIC_CDN_IMG_PROXY=https://img.touritgolf.com`
in the Vercel env vars to activate the rewrite app-wide. Until that
env var is set, the codemod is a no-op — safe to merge code in
advance of the Worker going live.

---

## One-time setup (5 minutes)

```bash
# From the repo root
cd cf-workers/img-proxy
npm install
```

## Deploy the Worker

```bash
# From cf-workers/img-proxy
npx wrangler login          # opens the browser; auth once
npx wrangler deploy
```

Wrangler will print the worker URL (something like
`https://tourit-img-proxy.<your-account>.workers.dev`).
Quick smoke test:

```bash
curl -I "https://tourit-img-proxy.<your-account>.workers.dev/itinerary-pinehurst-pilgrimage.jpg"
# Expect: HTTP/2 200, cache-control: public,…, x-tourit-proxy: miss
```

A second call should return `x-tourit-proxy: hit`.

## Wire up the img.touritgolf.com subdomain

1. In the Cloudflare dashboard, open the **touritgolf.com** zone.
2. **DNS** → add a record:
   - Type: `AAAA`
   - Name: `img`
   - IPv6 address: `100::` (placeholder — the proxy doesn't use it)
   - Proxy status: **Proxied (orange cloud)**
3. **Workers Routes** (under the zone's Workers settings) — verify a
   route `img.touritgolf.com/*` was created pointing at
   `tourit-img-proxy` (wrangler.toml already declares this, so a
   subsequent `wrangler deploy` will (re)create it automatically).

Verify:

```bash
curl -I "https://img.touritgolf.com/itinerary-pinehurst-pilgrimage.jpg"
# Expect: HTTP/2 200, x-tourit-proxy: miss   (then hit on repeat)
```

## Flip the switch in Vercel

```bash
# From the repo root
vercel env add NEXT_PUBLIC_CDN_IMG_PROXY production
# Paste: https://img.touritgolf.com
vercel deploy --prod
```

(Or do it via the Vercel dashboard → Project → Settings → Environment
Variables. The next deploy picks it up.)

## What's expected after activation

- Supabase Storage's **Cached Egress** meter stops climbing on every
  page load. Hits land at Cloudflare instead.
- Images are still served from the Supabase bucket on first request
  per edge location, then cached for 7 days.
- If we ever want to change an image, either rename the file or
  purge the URL via the Cloudflare dashboard.

## Reverting

If anything looks wrong after flipping the env var:

```bash
vercel env rm NEXT_PUBLIC_CDN_IMG_PROXY production
vercel deploy --prod
```

That instantly puts every image src back to the direct Supabase URL.
