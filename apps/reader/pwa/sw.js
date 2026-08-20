/* Offline support for the Reader.
 *
 * Strategy, chosen for a private local library rather than a busy website:
 * - navigations and book JSON go network-first, so a running dev/preview
 *   server always wins and data is fresh; the cache answers when offline.
 * - hashed build assets, book media, and fonts go cache-first; their bytes are
 *   pinned by filename hash or by the bundle's sha256 discipline, so a cached
 *   copy is as good as the network's.
 * - Range requests bypass the cache entirely: a cached 200 does not satisfy a
 *   206 request correctly.
 *
 * The cache name embeds the build stamp, so every deploy starts a fresh cache
 * and activation sweeps the old ones.
 */

const CACHE = "jade-reader-__BUILD_STAMP__";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("jade-reader-") && name !== CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const networkFirst =
    request.mode === "navigate" || url.pathname.endsWith(".json");
  event.respondWith(networkFirst ? fromNetwork(request) : fromCache(request));
});

async function fromNetwork(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}
