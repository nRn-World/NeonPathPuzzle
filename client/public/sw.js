/* Neon Path Puzzle service worker: offline shell + runtime asset cache.
 *
 * Strategies:
 *  - navigations: network first, cached index.html as the offline fallback
 *  - /assets/*:   cache first, because the filenames are content hashed
 *  - everything else (manifest, icons, sw itself): stale-while-revalidate, so a
 *    new release replaces a stale file on the next visit instead of never
 *
 * Bump CACHE_NAME whenever the caching rules change.
 */
const CACHE_NAME = "neon-path-v2";
const SHELL_URL = new URL("./index.html", self.registration.scope).href;
const SCOPE_URL = new URL("./", self.registration.scope).href;
const CORE_ASSETS = [SCOPE_URL, SHELL_URL, "./manifest.json", "./favicon.png", "./icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function cacheShell(cache, request, response) {
  if (!response || !response.ok) return;
  await cache.put(request, response.clone());
  // Every navigation can reuse the same offline shell.
  await cache.put(SHELL_URL, response.clone());
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    await cacheShell(cache, request, response);
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(SHELL_URL)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(response => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || refresh;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Content-hashed build output never changes under the same name.
  if (url.pathname.includes("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
