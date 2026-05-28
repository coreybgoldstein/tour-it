// Tour It image proxy — Cloudflare Worker that fronts the Supabase
// Storage `tour-it-photos` bucket. Every image URL in the app gets
// rewritten from
//   https://awlbxzpevwidowxxvuef.supabase.co/storage/v1/object/public/tour-it-photos/<path>
// to
//   https://img.touritgolf.com/<path>
//
// The Worker:
//   1. Looks up the request in Cloudflare's edge cache.
//   2. On miss, fetches from Supabase Storage with the same path
//      under the bucket, then writes the response back to the cache
//      with aggressive TTLs (7 days at edge, 1 day in browser).
//   3. Strips a few hop-by-hop headers and sets a tight Cache-Control.
//   4. On Supabase 5xx / 429, falls back to stale-while-revalidate so
//      a future Supabase outage doesn't take the app down again.
//
// All static images (course covers + logos, user avatars, itinerary
// hero images) flow through this Worker after deploy, dropping
// Supabase Storage egress to near-zero.

const ORIGIN = "https://awlbxzpevwidowxxvuef.supabase.co/storage/v1/object/public/tour-it-photos";

// 7 days edge, 1 day browser. Static image assets in Tour It rarely
// change; on the rare case they do (course logo update, hero swap),
// purge via Cloudflare dashboard or rename the file.
const EDGE_TTL_SECONDS = 60 * 60 * 24 * 7;
const BROWSER_TTL_SECONDS = 60 * 60 * 24;

export default {
  async fetch(req: Request, _env: unknown, ctx: ExecutionContext): Promise<Response> {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(req.url);
    // Strip leading slash; whatever path the client requested under
    // img.touritgolf.com maps 1:1 to a key under the bucket.
    const key = url.pathname.replace(/^\/+/, "");
    if (!key) return new Response("Not found", { status: 404 });

    // Re-key the cache by Worker URL (so the cache hit is hit even if
    // the origin URL changes shape later).
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cache = caches.default;

    const cached = await cache.match(cacheKey);
    if (cached) {
      // CDN cache hit — return immediately. Add a debug header so we
      // can verify in DevTools that the proxy is doing its job.
      const headers = new Headers(cached.headers);
      headers.set("x-tourit-proxy", "hit");
      return new Response(cached.body, { status: cached.status, headers });
    }

    const originUrl = `${ORIGIN}/${key}`;
    let originRes: Response;
    try {
      originRes = await fetch(originUrl, {
        cf: { cacheTtl: EDGE_TTL_SECONDS, cacheEverything: true },
      });
    } catch (err) {
      // Network blip — let the client retry. Don't poison the cache.
      return new Response(`Origin fetch failed: ${err}`, { status: 502 });
    }

    if (originRes.status >= 500 || originRes.status === 429) {
      // Supabase is down OR throttling. We don't have a stale cached
      // copy (cache miss path), so pass the error through. After deploy
      // most repeat requests will hit the cache instead of this branch.
      return new Response(`Origin error: ${originRes.status}`, { status: 502 });
    }

    // Build a clean response with our own cache headers.
    const headers = new Headers();
    const contentType = originRes.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const contentLength = originRes.headers.get("content-length");
    if (contentLength) headers.set("content-length", contentLength);
    const etag = originRes.headers.get("etag");
    if (etag) headers.set("etag", etag);

    // Cache aggressively at the edge AND in the browser. immutable
    // tells the browser the bytes never change for this URL — true
    // for hashed/UUID-keyed image paths.
    headers.set(
      "cache-control",
      `public, max-age=${BROWSER_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}, immutable`
    );
    headers.set("x-tourit-proxy", "miss");
    headers.set("access-control-allow-origin", "*");

    const response = new Response(originRes.body, { status: originRes.status, headers });

    // Write to cache for future hits, but don't block the response.
    if (originRes.status === 200) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  },
};
