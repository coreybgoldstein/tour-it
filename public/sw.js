/**
 * Tour It service worker.
 *
 * Responsibilities:
 *   1. Push notifications (display + click-through). This is what was here
 *      before — preserved verbatim so existing push subscriptions keep working.
 *   2. Caching for instant navigation:
 *      - /_next/static/*                         → CacheFirst (content-hashed)
 *      - Google Fonts (gstatic / googleapis)     → CacheFirst
 *      - Supabase public storage (logos/avatars) → CacheFirst with TTL
 *      - HTML navigations                        → StaleWhileRevalidate
 *      - /api/*, Supabase REST/RPC, ?_rsc=1      → NetworkOnly (skipped)
 *      - HLS video segments / Range requests     → NetworkOnly (skipped)
 *
 * Kill switch: set KILL_SWITCH to true and deploy. On the next activate the
 * worker drops every cache and unregisters itself, so users go back to plain
 * network behavior on the next page load — no app update required.
 */

// ─── Caching layer ───────────────────────────────────────────────────────────

const VERSION = "v1";
const KILL_SWITCH = false;

const STATIC_CACHE = `tour-it-static-${VERSION}`;
const HTML_CACHE = `tour-it-html-${VERSION}`;
const IMAGE_CACHE = `tour-it-images-${VERSION}`;
const OWNED_CACHES = [STATIC_CACHE, HTML_CACHE, IMAGE_CACHE];

const IMAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const IMAGE_MAX_ENTRIES = 300;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    if (KILL_SWITCH) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      await self.registration.unregister();
      const cls = await self.clients.matchAll();
      for (const c of cls) c.navigate(c.url);
      return;
    }
    // Drop caches from previous VERSIONs so the new code starts clean.
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith("tour-it-") && !OWNED_CACHES.includes(k))
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (KILL_SWITCH) return;
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (req.headers.has("range")) return;
  if (url.searchParams.has("_rsc")) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.hostname.endsWith(".supabase.co")) {
    const isPublicAsset = url.pathname.includes("/storage/v1/object/public/");
    if (!isPublicAsset) return;
    event.respondWith(cacheFirstWithTTL(req, IMAGE_CACHE, IMAGE_TTL_MS));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  const isNavigation = req.mode === "navigate";
  const acceptsHtml = (req.headers.get("accept") || "").includes("text/html");
  if (isNavigation || acceptsHtml) {
    event.respondWith(staleWhileRevalidate(req, HTML_CACHE));
    return;
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type !== "opaque") cache.put(req, res.clone());
  return res;
}

async function cacheFirstWithTTL(req, cacheName, ttlMs) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) {
    const cachedAt = Number(hit.headers.get("x-sw-cached-at") || 0);
    if (cachedAt && Date.now() - cachedAt < ttlMs) return hit;
  }
  try {
    const res = await fetch(req);
    if (res.ok && res.type !== "opaque") {
      const headers = new Headers(res.headers);
      headers.set("x-sw-cached-at", String(Date.now()));
      const stamped = new Response(await res.clone().blob(), { status: res.status, statusText: res.statusText, headers });
      cache.put(req, stamped);
      trimCache(cacheName, IMAGE_MAX_ENTRIES);
    }
    return res;
  } catch (err) {
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetchPromise = fetch(req).then(res => {
    if (res.ok && res.type !== "opaque") cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || fetchPromise;
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const toDelete = keys.slice(0, keys.length - maxEntries);
  await Promise.all(toDelete.map(k => cache.delete(k)));
}

// ─── Push notifications (preserved from previous sw.js) ──────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "Tour It", {
      body: data.body || "",
      icon: "/icon.png",
      badge: "/icon.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
