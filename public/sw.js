/*
 * Tipon's service worker: what makes the app open with no signal.
 *
 * Plain JavaScript on purpose. It is not bundled, so it is also the only copy of these
 * rules — the tests load *this file* and run it against a fake browser, rather than
 * testing a TypeScript twin that could drift away from what actually ships.
 *
 * Two things here are load-bearing:
 *
 *  - The cache name carries a version. `activate` deletes every cache that isn't the
 *    current one, so an old shell can't linger after a deploy.
 *  - Nothing calls `skipWaiting()` on its own. A new worker waits until the person
 *    clicks "reload" (the page posts `{ type: "skip-waiting" }`), so the shell never
 *    changes underneath a half-typed dump.
 */

const SHELL_VERSION = "1";
const CACHE = `tipon-shell-v${SHELL_VERSION}`;

/** Where a navigation lands when the network is gone and nothing else matches. */
const FALLBACK = "/";

/**
 * Asked for on install, so the app opens offline even on a page you never visited.
 * The hashed chunks these pages need are cached as they're used; one online visit is
 * still needed before offline works at all.
 */
const SHELL = ["/", "/dump", "/projects", "/inbox", "/backup", "/manifest.webmanifest"];

/**
 * Which rule applies to a request. The whole policy is this one pure function.
 *
 * @param {{ method: string, url: string }} request
 * @param {string} origin
 * @returns {"cache-first" | "network-first" | "never"}
 */
function strategyFor(request, origin) {
  // A POST is never a cache hit, and replaying one from a cache would be a bug.
  if (request.method !== "GET") return "never";

  const url = new URL(request.url);

  // Someone else's server, someone else's caching rules.
  if (url.origin !== origin) return "never";

  // The Claude route. Offline it must fail loudly, not answer from yesterday.
  if (url.pathname.startsWith("/api/")) return "never";

  // Hashed filenames: the hash *is* the version, so a hit can never be stale.
  if (url.pathname.startsWith("/_next/static/")) return "cache-first";

  // Pages and icons: fresh when there's a network, yesterday's copy when there isn't.
  return "network-first";
}

/** Every cache of ours that isn't the current one. @param {string[]} names */
function stale(names) {
  return names.filter((name) => name.startsWith("tipon-shell-") && name !== CACHE);
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request, isNavigation) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await caches.match(request);
    if (hit) return hit;

    // A page we've never opened, with no network: hand back the shell rather than
    // the browser's dinosaur, so the notebook is still there.
    if (isNavigation) {
      const shell = await caches.match(FALLBACK);
      if (shell) return shell;
    }
    throw error;
  }
}

self.addEventListener("install", (event) => {
  // Not skipWaiting: a fresh worker sits and waits until the person says so.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(stale(names).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const strategy = strategyFor(event.request, self.location.origin);
  if (strategy === "never") return;

  const isNavigation = event.request.mode === "navigate";
  event.respondWith(
    strategy === "cache-first" ? cacheFirst(event.request) : networkFirst(event.request, isNavigation),
  );
});

self.addEventListener("message", (event) => {
  // The only way this worker ever takes over early: because someone clicked.
  if (event.data && event.data.type === "skip-waiting") self.skipWaiting();
});

// The tests load this file and reach in for these.
if (typeof module !== "undefined") {
  module.exports = { strategyFor, stale, CACHE, SHELL, FALLBACK };
}
