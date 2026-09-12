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
const CACHE_VERSION = 'super-gere-v3';

// Keep the runnable shell separate from the large, best-effort art preload.
// Installation must complete only when a cached page can load its scripts
// offline; artwork can continue filling in after activation.
const APP_SHELL = [
  '/index.html',
  '/level/index.html',
  '/arena/index.html',
  '/manifest.webmanifest',
  '/css/mobile.css',
];

// Art is matched by path rather than extension: the JSON atlases beside the
// sheets are just as immutable and just as numerous.
function isImmutableAsset(url) {
  return url.pathname.includes('/assets/');
}

// Pre-caches every sprite sheet the game will ever want, in the background,
// from the worker's own install step.
//
// Registering early is not enough on its own: the worker takes a moment to
// activate, and the page is already requesting art by then, so the first
// requests can slip past its fetch handler uncached. Fetching the list here
// means the cache is filled whether or not the page's own requests were
// intercepted -- and on a second visit there is nothing left to fetch.
//
// Driven by the same generated manifest the loader uses, so it can never
// ask for a sheet that does not exist.
async function precacheArt() {
  let manifest;
  try {
    const response = await fetch('/js/sprite-manifest.js');
    const text = await response.text();
    // The manifest is a JS file, not JSON: pull the object literal out of
    // it rather than importScripts, which cannot be used after install.
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    manifest = JSON.parse(json);
  } catch (err) {
    return; // no manifest; the fetch handler still caches what is asked for
  }

  const cache = await caches.open(CACHE_VERSION);
  // The shell: the pages and the scripts they load. Without these the art
  // is cached but there is nothing to run it, so an offline visit fails on
  // the very first request.
  const pages = ['/index.html', '/level/index.html', '/arena/index.html'];
  const urls = [...pages, '/manifest.webmanifest', '/css/mobile.css'];

  // The scripts each page loads, read out of the pages themselves rather
  // than listed here. A hardcoded list would drift the moment a file is
  // added -- and a missing script means an offline game that loads a blank
  // canvas, which is worse than one that does not load at all.
  for (const page of pages) {
    try {
      const html = await (await fetch(page)).text();
      const matches = html.matchAll(/src="([^"?]+)/g);
      for (const match of matches) {
        // Page-relative (js/foo.js) against the site root, since every page
  const pages = ['/index.html', '/level/index.html', '/arena/index.html'];
  const urls = [...APP_SHELL];
        if (!urls.includes(src)) urls.push(src);
      }
    } catch (err) { /* page unreachable; its scripts stay uncached */ }
  }
  for (const [character, clips] of Object.entries(manifest)) {
    for (const clip of clips) {
      const dir = `/assets/release/${character}_sprites/${encodeURIComponent(clip)}`;
      urls.push(`${dir}/spritesheet.png`);
      urls.push(`${dir}/atlas.json`);
      urls.push(`${dir}/trim.json`);
    }
  }

  // A few at a time: firing 300 requests at once would compete with the
  // ones the game is actually waiting on and make the first load worse
  // rather than better.
  const BATCH = 6;
  for (let i = 0; i < urls.length; i += BATCH) {
    await Promise.all(urls.slice(i, i + BATCH).map(async (url) => {
      try {
        if (await cache.match(url)) return; // already have it
        const response = await fetch(url);
        if (response && response.status === 200) await cache.put(url, response);
      } catch (err) { /* a miss here is not fatal; the page can still fetch it */ }
    }));
  }
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
    // Fill the cache in the background. Deliberately not awaited into the
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
    // the page is playable long before this finishes.
    precacheArt();
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
      // A page is keyed by its full URL, so /level/?level=2 misses a cached
      // /level/. The query string only tells the GAME which level to play;
      // the document behind it is identical, so fall back to the path.
      const bare = await cache.match(url.pathname);
      if (bare) return bare;
      // A directory request ('/level/') resolves to its index.
      if (url.pathname.endsWith('/')) {
        const index = await cache.match(`${url.pathname}index.html`);
        if (index) return index;
      }
      throw err;
    }
  })());
});
