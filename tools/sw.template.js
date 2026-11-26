// ONE MORE ORBIT service worker. Written into dist/sw.js by the build (vite.config.ts fills in the two values).
// The game and its first ten minutes are saved on the first visit; every other song the first time it plays. After
// that it starts and plays with no connection.
const CACHE = '__CACHE__';
const FILES = __FILES__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('omo-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // (a song not saved on the first visit is saved the first time it is fetched: once played, it plays offline)
  const url = new URL(req.url), song = /\/audio\/[a-z0-9]+\.mp3$/.test(url.pathname);
  event.respondWith(
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => {
      if (song && res.ok && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined); }
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('./', { ignoreVary: true }) : Response.error())))
  );
});
