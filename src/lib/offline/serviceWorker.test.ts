/** @jest-environment node */
import { loadServiceWorker, request, response } from "@/test/serviceWorker";

const ORIGIN = "https://tipon.test";
const at = (path: string) => `${ORIGIN}${path}`;

describe("which rule applies", () => {
  const { strategyFor } = loadServiceWorker();
  const decide = (req: Parameters<typeof strategyFor>[0]) => strategyFor(req, ORIGIN);

  it("never touches anything that isn't a GET", () => {
    expect(decide(request(at("/"), { method: "POST" }))).toBe("never");
    expect(decide(request(at("/dump"), { method: "PUT" }))).toBe("never");
  });

  it("never caches the Claude route — offline it must fail, not answer from yesterday", () => {
    expect(decide(request(at("/api/extract")))).toBe("never");
    expect(decide(request(at("/api/extract"), { method: "POST" }))).toBe("never");
  });

  it("leaves other origins alone", () => {
    expect(decide(request("https://example.com/thing.js"))).toBe("never");
  });

  it("serves hashed chunks from the cache, because the hash is the version", () => {
    expect(decide(request(at("/_next/static/chunks/main-abc123.js")))).toBe("cache-first");
    expect(decide(request(at("/_next/static/css/app-def456.css")))).toBe("cache-first");
  });

  it("tries the network first for pages and icons", () => {
    for (const path of ["/", "/dump", "/projects/p-1", "/icon-192.png", "/manifest.webmanifest"]) {
      expect(decide(request(at(path)))).toBe("network-first");
    }
  });
});

describe("installing", () => {
  it("puts the shell in a versioned cache", async () => {
    const worker = loadServiceWorker();

    await worker.fire("install", {});

    expect(worker.CACHE).toMatch(/^tipon-shell-v\d+$/);
    expect(worker.entries(worker.CACHE)).toEqual(worker.SHELL.map(at));
  });

  it("does not take over on its own", async () => {
    const worker = loadServiceWorker();

    await worker.fire("install", {});

    // Taking over early would swap the shell under a half-typed dump.
    expect(worker.skipWaitingCalls()).toBe(0);
  });
});

describe("activating", () => {
  it("throws away every older version of the cache", async () => {
    const worker = loadServiceWorker({
      caches: {
        "tipon-shell-v0": { [at("/")]: response("old shell") },
        "tipon-shell-v999-old": { [at("/")]: response("also old") },
      },
    });

    await worker.fire("activate", {});

    expect(worker.cacheNames()).not.toContain("tipon-shell-v0");
    expect(worker.cacheNames()).not.toContain("tipon-shell-v999-old");
  });

  it("keeps the current one, and caches that aren't ours", async () => {
    const worker = loadServiceWorker({
      caches: { "tipon-shell-v0": {}, "someone-elses-cache": { [at("/x")]: response("theirs") } },
    });
    await worker.fire("install", {});

    await worker.fire("activate", {});

    expect(worker.cacheNames()).toContain(worker.CACHE);
    expect(worker.cacheNames()).toContain("someone-elses-cache");
  });

  it("takes charge of pages that are already open", async () => {
    const worker = loadServiceWorker();

    await worker.fire("activate", {});

    expect(worker.claimCalls()).toBe(1);
  });
});

describe("answering requests", () => {
  it("stays out of the way of anything it never caches", async () => {
    const worker = loadServiceWorker({ fetch: async () => response("live") });

    const answered = await worker.fire("fetch", { request: request(at("/api/extract"), { method: "POST" }) });

    // Nothing handed back: the browser does what it would have done anyway.
    expect(answered).toBeUndefined();
  });

  it("serves a hashed chunk from the cache without asking the network", async () => {
    const fetcher = jest.fn();
    const chunk = at("/_next/static/chunks/main-abc123.js");
    const worker = loadServiceWorker({ caches: { "tipon-shell-v1": { [chunk]: response("cached chunk") } }, fetch: fetcher });

    const answered = await worker.fire("fetch", { request: request(chunk) });

    expect(answered).toMatchObject({ body: "cached chunk" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fetches and keeps a chunk it hasn't seen", async () => {
    const chunk = at("/_next/static/chunks/new-xyz789.js");
    const worker = loadServiceWorker({ fetch: async () => response("fresh chunk") });

    const answered = await worker.fire("fetch", { request: request(chunk) });

    expect(answered).toMatchObject({ body: "fresh chunk" });
    expect(worker.entries(worker.CACHE)).toContain(chunk);
  });

  it("prefers the network for a page, and keeps what it got", async () => {
    const worker = loadServiceWorker({
      caches: { "tipon-shell-v1": { [at("/dump")]: response("yesterday") } },
      fetch: async () => response("today"),
    });

    const answered = await worker.fire("fetch", { request: request(at("/dump"), { mode: "navigate" }) });

    expect(answered).toMatchObject({ body: "today" });
    expect(worker.entries(worker.CACHE)).toContain(at("/dump"));
  });

  it("falls back to its copy when the network is gone", async () => {
    const worker = loadServiceWorker({
      caches: { "tipon-shell-v1": { [at("/dump")]: response("yesterday") } },
      fetch: async () => {
        throw new Error("offline");
      },
    });

    const answered = await worker.fire("fetch", { request: request(at("/dump"), { mode: "navigate" }) });

    expect(answered).toMatchObject({ body: "yesterday" });
  });

  it("hands a never-visited page the shell rather than the browser's error", async () => {
    const worker = loadServiceWorker({
      caches: { "tipon-shell-v1": { [at("/")]: response("the shell") } },
      fetch: async () => {
        throw new Error("offline");
      },
    });

    const answered = await worker.fire("fetch", { request: request(at("/projects/p-never-seen"), { mode: "navigate" }) });

    expect(answered).toMatchObject({ body: "the shell" });
  });

  it("doesn't hand the shell to something that isn't a page", async () => {
    const worker = loadServiceWorker({
      caches: { "tipon-shell-v1": { [at("/")]: response("the shell") } },
      fetch: async () => {
        throw new Error("offline");
      },
    });

    // An icon request answered with a page would be a broken image, not a saved day.
    await expect(worker.fire("fetch", { request: request(at("/icon-192.png")) })).rejects.toThrow("offline");
  });

  it("never stores a failed response", async () => {
    const worker = loadServiceWorker({ fetch: async () => response("404 page", false) });

    await worker.fire("fetch", { request: request(at("/gone")) });

    expect(worker.entries(worker.CACHE)).not.toContain(at("/gone"));
  });
});

describe("taking over", () => {
  it("skips waiting only when the page asks it to", async () => {
    const worker = loadServiceWorker();

    await worker.fire("message", { data: { type: "something-else" } });
    expect(worker.skipWaitingCalls()).toBe(0);

    await worker.fire("message", { data: { type: "skip-waiting" } });
    expect(worker.skipWaitingCalls()).toBe(1);
  });

  it("shrugs at a message with no data", async () => {
    const worker = loadServiceWorker();

    await expect(worker.fire("message", { data: null })).resolves.toBeUndefined();
    expect(worker.skipWaitingCalls()).toBe(0);
  });
});
