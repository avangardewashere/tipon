import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";

/**
 * Loads `public/sw.js` — the real one, the one that ships — into a fake browser.
 *
 * A service worker can't run in jsdom, and a TypeScript copy of its rules would be a
 * second thing to keep in step. So the tests run the actual file against stand-ins for
 * `caches`, `fetch` and the event listeners, and can then fire events at it.
 */

export type FakeResponse = Readonly<{ ok: boolean; body: string; clone: () => FakeResponse }>;

export function response(body: string, ok = true): FakeResponse {
  const made: FakeResponse = { ok, body, clone: () => made };
  return made;
}

export type FakeRequest = Readonly<{ method: string; url: string; mode?: string }>;

export function request(url: string, extra: Partial<FakeRequest> = {}): FakeRequest {
  return { method: "GET", url, ...extra };
}

/**
 * A `caches` that is a Map of Maps, and says what happened to it.
 *
 * Keys are absolute URLs, because that is what a browser does: a lookup for `"/"` is
 * resolved against the worker's own location before anything is compared.
 */
function fakeCacheStorage(origin: string, seed: Record<string, Record<string, FakeResponse>> = {}) {
  const key = (req: FakeRequest | string) => new URL(typeof req === "string" ? req : req.url, origin).href;

  const caches = new Map<string, Map<string, FakeResponse>>(
    Object.entries(seed).map(([name, entries]) => [
      name,
      new Map(Object.entries(entries).map(([url, res]) => [key(url), res])),
    ]),
  );

  function open(name: string) {
    if (!caches.has(name)) caches.set(name, new Map());
    const cache = caches.get(name)!;
    return Promise.resolve({
      put: (req: FakeRequest, res: FakeResponse) => {
        cache.set(key(req), res);
        return Promise.resolve();
      },
      addAll: (urls: readonly string[]) => {
        for (const url of urls) cache.set(key(url), response(`precached ${url}`));
        return Promise.resolve();
      },
      match: (req: FakeRequest | string) => Promise.resolve(cache.get(key(req))),
    });
  }

  return {
    api: {
      open,
      keys: () => Promise.resolve([...caches.keys()]),
      delete: (name: string) => Promise.resolve(caches.delete(name)),
      match: (req: FakeRequest | string) => {
        const url = key(req);
        for (const cache of caches.values()) if (cache.has(url)) return Promise.resolve(cache.get(url));
        return Promise.resolve(undefined);
      },
    },
    caches,
  };
}

export type LoadedWorker = Readonly<{
  strategyFor: (req: FakeRequest, origin: string) => "cache-first" | "network-first" | "never";
  stale: (names: readonly string[]) => string[];
  CACHE: string;
  SHELL: readonly string[];
  /** Fires an event at the worker and waits for whatever it promised to finish. */
  fire: (type: string, event: Record<string, unknown>) => Promise<unknown>;
  /** What's in each cache right now. */
  cacheNames: () => string[];
  entries: (cacheName: string) => string[];
  skipWaitingCalls: () => number;
  claimCalls: () => number;
}>;

export type LoadOptions = Readonly<{
  origin?: string;
  /** Seed the caches, e.g. an old version's leftovers. */
  caches?: Record<string, Record<string, FakeResponse>>;
  /** What the network does. Throw from here to be offline. */
  fetch?: (req: FakeRequest) => Promise<FakeResponse>;
}>;

export function loadServiceWorker(options: LoadOptions = {}): LoadedWorker {
  const origin = options.origin ?? "https://tipon.test";
  const store = fakeCacheStorage(origin, options.caches);
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  let skipWaiting = 0;
  let claim = 0;

  const self = {
    addEventListener: (type: string, handler: (event: Record<string, unknown>) => void) => {
      listeners.set(type, handler);
    },
    location: { origin },
    skipWaiting: () => {
      skipWaiting += 1;
    },
    clients: {
      claim: () => {
        claim += 1;
        return Promise.resolve();
      },
    },
  };

  // Named around Next's lint rule against assigning to `module`; the sandbox key below
  // is what `public/sw.js` actually sees.
  const commonjs = { exports: {} as Record<string, unknown> };
  const sandbox = {
    self,
    caches: store.api,
    fetch: options.fetch ?? (() => Promise.reject(new Error("offline"))),
    URL,
    Promise,
    module: commonjs,
    console,
  };

  const source = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
  runInContext(source, createContext(sandbox), { filename: "public/sw.js" });

  const exported = commonjs.exports;

  return {
    strategyFor: exported.strategyFor as LoadedWorker["strategyFor"],
    stale: exported.stale as LoadedWorker["stale"],
    CACHE: exported.CACHE as string,
    SHELL: exported.SHELL as readonly string[],
    async fire(type, event) {
      const handler = listeners.get(type);
      if (!handler) throw new Error(`the worker never listened for "${type}"`);

      // `waitUntil` and `respondWith` are how a worker hands back a promise.
      let held: unknown;
      handler({
        ...event,
        waitUntil: (promise: unknown) => {
          held = promise;
        },
        respondWith: (promise: unknown) => {
          held = promise;
        },
      });
      return held === undefined ? undefined : await held;
    },
    cacheNames: () => [...store.caches.keys()],
    entries: (cacheName) => [...(store.caches.get(cacheName)?.keys() ?? [])],
    skipWaitingCalls: () => skipWaiting,
    claimCalls: () => claim,
  };
}
