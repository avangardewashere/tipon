# Block 8 — Works with no signal

**Status:** ✅ done · 547 tests passing (30 new) · Tipon opens in airplane mode, from a cold start

The block the v0.5 plan warned about: a stale cached shell is worse than stale UI when the data it
meets is yours. It works, and the update path is verified end to end in a real browser.

## What it does

| | |
|---|---|
| `public/sw.js` | The whole policy: one `strategyFor`, a versioned cache, install/activate/fetch/message |
| `src/lib/offline/useServiceWorker.ts` | Registers it, watches for a newer one, and never lets it take over uninvited |
| `src/components/shell/NewVersionNotice.tsx` | One line in the footer, and the button that applies the update |
| `next.config.ts` | `/sw.js` served as JavaScript, `no-store`, with its own CSP |
| `src/test/serviceWorker.ts` | Loads the **real** `public/sw.js` into a fake browser so it can be tested |

### The rules

| Request | Strategy | Why |
|---|---|---|
| Anything that isn't a GET | never | Replaying a POST from a cache is a bug, not a feature |
| `/api/*` | never | Claude must fail offline, not answer from yesterday |
| Another origin | never | Someone else's server, someone else's caching rules |
| `/_next/static/*` | cache-first | The filename hash *is* the version, so a hit can't be stale |
| Everything else | network-first | Fresh when there's a network, yesterday's copy when there isn't |

## What I learned

### 1. Test the file that ships, not a copy of it

The plan said to extract the decision into a plain module and make the worker a thin wrapper. I went
further: there is no TypeScript twin at all. `public/sw.js` is the only copy, and the tests **load
that file** into a `vm` with stand-ins for `caches`, `fetch` and the listeners, then fire real
`install` / `activate` / `fetch` / `message` events at it.

A twin would be a second thing to keep in step, and the tests would pass while the shipped worker
drifted. This way a planted bug in the artifact fails the suite — all fourteen did.

### 2. The fake was wrong, and the worker was right

The first run failed on "hands a never-visited page the shell". The worker does
`caches.match("/")` — and my fake compared that string against keys like
`https://tipon.test/`, so it never matched.

Browsers resolve a cache lookup against the worker's own scope before comparing. **The worker was
correct and my stand-in was lying.** Fixed by making the fake resolve every key through `new URL`,
the way a browser does.

Worth remembering: when a hand-made double disagrees with the real thing, the double is the first
suspect — and a double that's wrong in your favour is the dangerous kind.

### 3. The update prompt fires less often than you'd think — and that's right

A browser only looks for a new worker when **`sw.js` itself differs byte for byte**. Ship a new
page and leave the worker alone, and nobody sees "there's a newer version".

That sounded like a bug until I traced it: pages are network-first and chunks are hashed, so an
online visit already gets the new HTML, which already points at new chunk hashes. **Ordinary deploys
reach people with no prompt at all.** The prompt exists for the case where the *worker's own rules*
changed — which is exactly when a reload is genuinely required.

So the notice is rare on purpose. Bump `SHELL_VERSION` when the caching rules change, and leave it
alone otherwise.

### 4. Never `skipWaiting()` on your own

The worker installs and then sits there. Only a click sends it `{ type: "skip-waiting" }`. A worker
that took over by itself would swap the shell out from under a half-typed dump — and Tipon's whole
pitch is that you can throw a thought at it without ceremony.

Verified in the browser: with a new worker deployed, **both caches exist, the old worker is still in
control**, and only after the click does `tipon-shell-v2` take over and `v1` get swept up.

### 5. What the old-shell-meets-new-file worry turned out to be

The plan flagged a stale shell meeting a newer save file as this block's real risk. It's already
handled — by Block 3. `parseSaveFile` rejects a file whose `version` is newer than it understands,
and `loadWorkspace` copies it aside instead of guessing. An old shell meeting tomorrow's save file
says so and keeps the data. No new machinery needed; the seam was already in the right place.

## How we know the tests work

14 bugs planted in the worker and the hook, each restored and verified by md5. **14 caught.**

| Planted | |
|---|---|
| Caches the Claude route | caught |
| Caches POSTs | caught |
| Caches other origins | caught |
| Hashed chunks go to the network every time | caught |
| `skipWaiting()` on install | caught |
| Old caches never swept up | caught |
| Deletes every cache, including other apps' | caught |
| Never claims open pages | caught |
| Stores failed responses | caught |
| Hands the shell to images as well as pages | caught |
| Any message makes it take over | caught |
| Announces an update on the very first install | caught |
| Takes over without being asked | caught |
| Registers twice under StrictMode | caught |

## Checked outside Jest

Real Chromium against `npm run build` + `npm start`, with the network switched off mid-session:

| Check | Result |
|---|---|
| A worker takes control on the first visit | ✅ `tipon-shell-v1` |
| `/sw.js` headers | ✅ `application/javascript`, `no-cache, no-store, must-revalidate`, own CSP |
| **Cold start with no network** — full reload, airplane mode | ✅ the notebook opens, the task is there |
| Today, Projects, Inbox, Backup, offline | ✅ all four render |
| A project page never visited before, offline | ✅ gets the shell, not the browser's error |
| A task written offline, then an offline reload | ✅ still there |
| `/api/extract` offline | ✅ fails, as designed |
| Console during offline navigation | ✅ **nothing** — the only error in the whole run was the deliberate Claude call |
| Deploy a changed worker → notice appears → click → new cache, old one gone | ✅ verified end to end |
| The notice at 375 px | ✅ no sideways overflow |

## Still open

- **Nobody has installed it to a real home screen yet.** Chromium says the manifest is valid and the
  app runs offline in a normal tab; an installed Android app is still unverified.
- Block 9: the Dump screen should say *why* Claude is unavailable offline, rather than failing at a
  button press. The rule-based parser works with no signal and should say so.
