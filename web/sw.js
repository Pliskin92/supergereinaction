// Service worker: makes the art load once per device, not once per visit.
//
// The game ships ~12MB of sprite sheets. Cache headers alone (see
// nginx.conf) already stop them being re-downloaded, but the browser HTTP
// cache is evictable and per-origin-pressure: it can and does throw the art
// away, and then the player waits through a 30-second cold load again.
//
// A service worker cache is explicit storage. Once a sheet is in it, it is
// served from disk with no network request at all -- not even a
// revalidation -- until this worker's version changes.
//
// Strategy, deliberately different per kind of file:
//
//   * ART (/assets/) -- cache first, forever. A sprite sheet's pixels never
//     change in place; a changed sheet ships as a different deploy, and
//     bumping CACHE_VERSION below drops the old cache wholesale.
//
//   * EVERYTHING ELSE -- network first, falling back to cache. The pages
//     and scripts must pick up a deploy immediately, and falling back to
//     cache means the game still opens offline once it has been played.
//
// Bump this to invalidate every cached file. It is the one thing that must
// change when the art does.
const CACHE_VERSION = 'super-gere-v1';

// Art is matched by path rather than extension: the JSON atlases beside the
// sheets are just as immutable and just as numerous.
function isImmutableAsset(url) {
  return url.pathname.includes('/assets/');
}

self.addEventListener('install', (event) => {
  // Take over as soon as this worker is installed rather than waiting for
  // every tab using the old one to close -- a game does not benefit from
  // the careful hand-off that matters to a document-shaped app.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Drop caches from previous versions, or a redeploy would leave the old
    // art on disk forever alongside the new.
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only GETs are cacheable, and only this origin's.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isImmutableAsset(url)) {
    // Cache first. A hit here costs no network at all, which is the whole
    // point: 200-odd art files that never touch the wire after the first
    // visit.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      // Only store a real success. Caching a 404 or an opaque error would
      // make a transient failure permanent.
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })());
    return;
  }

  // Pages and scripts: network first, so a deploy is picked up at once,
  // with the cache as a fallback when offline.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    try {
      const response = await fetch(request);
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    } catch (err) {
      const hit = await cache.match(request);
      if (hit) return hit;
      throw err;
    }
  })());
});
