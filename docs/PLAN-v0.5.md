# Tipon: v0.5 plan

> v0 gathers and sorts. **v0.5 makes it yours to keep** — installed on the home screen, opening
> with no signal, and holding onto your notebook the way a real app does.

## Goal

Turn the v0 website into a **Progressive Web App**: installable, launching from the home screen
without browser chrome, and fully usable with the network off.

Nothing here adds a feature you can point at in the UI. That's the point — v0.5 is about the app
being *there*, on a phone, in a queue, on a plane, whether or not there's a signal.

## Why this is the right next step, and not v1

v0's data lives in one browser's `localStorage`. That makes the phone the real client, and it
exposes one risk the plan hasn't faced yet:

**Safari evicts site data after about seven days of non-use.** For a website, that means a notebook
you didn't open for a week may simply be gone. For an app the user *installed* to the home screen,
eviction is far less aggressive, and `navigator.storage.persist()` can ask for durable storage
outright. So the PWA work isn't decoration — on iOS it's the difference between data that survives
and data that doesn't.

Accounts and sync (v1) solve this properly by putting the data on a server. v0.5 buys real safety
before that, with no backend and no login.

## What "installed" has to mean here

| Claim | What has to be true |
|---|---|
| It installs | A valid manifest, served over HTTPS, with icons Android and iOS both accept |
| It looks like an app | `display: standalone` — no address bar; the notebook fills the screen |
| It opens with no signal | A service worker serves the app shell from cache, including a cold start |
| It still works offline | Every screen but the Claude dump, which needs the network and must say so |
| It keeps your notebook | Durable storage requested; a stale cached shell can never meet a newer save file |
| It updates | A new deploy reaches the user, visibly, without them clearing anything |

The last two are the hard ones. The rest is configuration.

## Blocks

| Block | What it delivers |
|---|---|
| **7. Installable** | `app/manifest.ts`, the icon set, durable storage, install guidance for iOS |
| **8. Works with no signal** | The service worker, the cache strategy, and the update prompt |
| **9. Honest offline + release** | The Claude path offline, the connectivity banner, release pass, tag `v0.5` |

### Block 7 — Installable

Next 16 generates the manifest itself: `src/app/manifest.ts` exporting a typed
`MetadataRoute.Manifest`. No hand-written `public/manifest.json`, no `<link rel="manifest">`.

- `name` "Tipon", `short_name` "Tipon", the tagline as `description`
- `start_url: "/"`, `display: "standalone"`
- `background_color` and `theme_color` taken from the notebook palette — `--paper` `#f7f2e8` for the
  splash, so launching doesn't flash white against warm paper
- Icons: 192 and 512 PNG, **plus a 512 `purpose: "maskable"`** with the safe zone respected, or
  Android will crop the notebook badly into a circle. A 180px `apple-touch-icon` besides, because
  **iOS ignores manifest icons entirely**.
- `navigator.storage.persist()` asked for once, on first run, behind a capability check

There's no `public/` directory in the repo yet — this block creates it.

**Testing.** `manifest()` is a pure function, so it unit-tests like any selector: the required keys,
the icon sizes and purposes, `display`, `start_url`. One test earns its place beyond that — assert
the manifest's colours **equal the CSS custom properties in `globals.css`**, read at test time, so a
palette change can never silently leave the splash screen on last season's paper.

### Block 8 — Works with no signal

The one that can break things, and the one worth slowing down for.

**The decision to make first: Serwist or hand-rolled.** Next's own PWA guide points at
[Serwist](https://github.com/serwist/serwist) for offline caching; its own service-worker example
only covers push notifications. Default for this project: **hand-rolled**, because the shell is
small and static, Serwist adds a build step and a dependency that has to track Next's releases, and
a cache policy we wrote is a cache policy we can test. Revisit if the hand-rolled version starts
growing conditionals.

**Cache strategy.** Next's build output uses hashed chunk filenames, so precaching a fixed asset
list means reading the build manifest at build time. Avoid that entirely with runtime caching:

| Request | Strategy |
|---|---|
| Navigations (`/`, `/dump`, `/projects/…`) | Network first, fall back to the cached shell |
| `/_next/static/*` (immutable, hashed) | Cache first — the hash *is* the version |
| `/api/extract` | Never cached. It's a POST to Claude; offline it must fail, not lie |

**The update story is the actual risk.** A service worker that keeps serving yesterday's shell is
the classic PWA bug, and here it's worse than stale UI: an old shell meeting a newer save file is a
data-shape mismatch on data the user cares about. So:

- The cache name carries a version; `activate` deletes every cache that isn't it
- **No blind `skipWaiting()`.** A waiting worker surfaces a quiet "There's a new version — reload"
  line in the footer, and the user's click is what activates it
- The save-file version (`SAVE_FILE_VERSION`) and the shell version are checked against each other,
  so a shell that's too old to understand the file says so instead of guessing

**Testing.** jsdom cannot run a service worker, so the logic must not live in the worker. Extract
the decision — *given a request, which strategy?* — into a plain module with no `self`, no `caches`,
no globals, and unit-test it. `public/sw.js` becomes a thin shell that wires the browser's APIs to
that function. Same rule as storage and extractors: **the swappable part sits behind an interface.**

Real verification is a Playwright pass with `context.setOffline(true)`, including a **cold start**:
offline, reload, and the notebook still opens. That's the check that actually proves the block, and
the one Jest structurally cannot make.

### Block 9 — Honest offline, then release

One screen in Tipon genuinely needs the network: the Claude dump. Offline it must degrade honestly.

- **The quick parser still works with no signal** — it's pure local code. That's a genuinely good
  property, and the Dump screen should say so rather than leaving a dead button: sorting by rules
  stays available, sorting with Claude explains it's waiting for a connection.
- A connectivity banner. Next 16 ships `useOffline` from `next/offline` behind
  `experimental.useOffline`, and the docs make a fair case for it over `navigator.onLine`, which
  reports `true` on WiFi with no upstream internet. **It's experimental**, so this is a decision to
  take deliberately, with the plain `online`/`offline` event listener as the boring fallback.
- The release pass from `docs/RELEASE.md`, extended with the offline checks, then tag `v0.5`.

## Decisions

| Decision | Default | Decide before |
|---|---|---|
| Service worker: Serwist or hand-rolled | **Hand-rolled**, with the strategy function tested separately | Block 8 |
| Update policy | Prompt to reload; never `skipWaiting()` behind the user's back | Block 8 |
| `experimental.useOffline` | **Use it**, and fall back to `online`/`offline` events if it bites | Block 9 |
| Durable storage | Ask on first run, never nag again, work fine if refused | Block 7 |
| iOS install | Instructions, not a custom button — `beforeinstallprompt` doesn't exist on Safari | Block 7 |

## Deliberately NOT in v0.5

| Not this time | Why |
|---|---|
| **Push notifications** | Most of Next's PWA guide, and all of it needs a server: VAPID keys, a subscription store, something to send them. That's v1's problem, after accounts |
| Background sync | Nothing to sync to yet |
| Static export | `/api/extract` is a real server route; exporting would mean moving Claude elsewhere |
| Dark mode, search, this-week view | Still queued after this. One thing at a time |
| Accounts, sync, a database | Still v1 |

## Known limits after v0.5

| Limit | The plan |
|---|---|
| Installed on the phone and installed on the desktop are still two separate notebooks | Export/Import until v1 |
| Durable storage is a request, not a guarantee — a browser may refuse it | Keep a backup; that advice never stops being true |
| An offline dump can't reach Claude | The rule-based parser covers it, and says so |

## Rules carried over

Everything in `docs/PLAN.md` still holds. Three matter most here:

- **A component either draws something or runs an effect, not both** — service worker registration
  is an effect, and belongs in its own small client component, not in a screen.
- **Swappable parts sit behind interfaces** — the cache strategy is the seam this time.
- **Test devices: Android and desktop Chrome must pass.** iOS should work but never blocks a
  release — though with the eviction story above, iOS is now the reason the release exists, so it
  gets checked properly even if it can't block.

## How we'll know it worked

Not "it feels like an app". These:

1. Chrome DevTools → Application → Manifest reports it installable, with no icon warnings.
2. Installed to an Android home screen, it opens with no address bar.
3. **Airplane mode, cold start**: the notebook opens, Today renders, a task can be added and is
   still there after another offline reload.
4. Deploy a change; the running app offers the new version and takes it on a reload.
5. Offline, the Dump screen sorts by rules and explains why Claude is unavailable.
6. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — all green, as ever.
