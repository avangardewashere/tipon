# Block 9 — Honest offline, and the v0.5 release

**Status:** ✅ done · 556 tests passing (9 new) · v0.5 is finished apart from the tag

The last block of v0.5. Blocks 7 and 8 made Tipon installable and made it open with no signal; this
one makes it *say* what's going on, and re-runs the release checklist against everything.

## What it does

| | |
|---|---|
| `src/components/shell/OfflineBanner.tsx` | One line above the page when there's no network |
| `DumpScreen` | Warns **before** you press Sort it that Claude is out of reach — but only if you have a code |
| `sortDump` | Knows the difference between "you're offline" and "the server didn't answer" |
| `next.config.ts` | `experimental.useOffline` |
| `docs/RELEASE.md` | The browser pass now runs against a production build, and includes offline |
| `README.md` | How to install it, and what being offline does and doesn't cost |

## The decision the plan left open

**Next's `useOffline`, not a hand-rolled listener.** The plan's default, and reading this version's
docs confirmed it's the right call: it listens for the browser's `offline` event *and* polls with
`HEAD` requests on a backoff, so it doesn't believe `navigator.onLine` — which cheerfully reports
`true` on a captive portal or a dead upstream. That's the exact case where a hand-rolled listener
would tell someone they're online while nothing works.

The cost is one experimental flag. Worth it.

One interaction worth knowing: our service worker makes navigations *succeed* from cache offline, so
Next's "failed navigation" detection path never fires here. The browser `offline` event still does,
which is what the banner actually runs on. Verified in Chromium with the network switched off.

## What I learned

### 1. The same failure means two different things

Offline, `fetch("/api/extract")` throws. Unreachable server, `fetch` throws. Same exception, and the
old code said the same thing both times: *"Claude couldn't be reached."*

But those are different facts about the world. One is about the room you're in; the other is about a
server. Tell someone the wrong one and they go off debugging something that isn't broken. So the
screen now hands `sortDump` what it already knows, and the review sheet says **"You're offline, so
Tipon sorted this with its own rules."**

The nice part: the code path didn't change at all. The rules were always the floor. Only the
sentence changed.

### 2. Say it before the button, not after

Sorting offline already worked — press the button, wait, get a proposal with an apology attached.
Fine, but it makes you wait to learn something the app knew all along. The hint now sits under the
button *before* you press it.

And it only appears if you have an access code. Without one, the rules are what "Sort it" has always
meant, and announcing a missing feature nobody was using is noise dressed up as honesty. That's a
test of its own.

### 3. Another bug that was mine, in the script

The browser pass reported that a dump sorted offline "didn't commit". It had committed — the data
was in `localStorage`, and Projects showed the new project. The Inbox check ran straight after a
`goto`, before the app had loaded the notebook, and read an empty screen.

Third time this project has hit it: **an automation script that doesn't wait for the app to load its
own data will report a bug that isn't there.** Waiting on the app's own confirmation, and then on the
thing you expect, is the fix every time.

Worth stating plainly, because the failure mode is expensive: a browser check that's *wrong in the
alarming direction* costs an hour of hunting. The two real bugs the browser found in v0 were found
because the script was right; this was the third false alarm.

## How we know the tests work

9 bugs planted, each restored and verified by md5. **8 caught at first.**

| Planted | |
|---|---|
| The offline fallback blames the server | caught |
| An online failure blames the network | caught |
| The offline message removed entirely | caught |
| The banner shows even with a network | caught |
| The banner never shows | caught |
| The banner says only "No signal", implying the app is broken | caught |
| The dump hint nags when there's no access code | caught |
| The dump hint never appears | caught |
| **The screen stops passing what it knows to `sortDump`** | **missed** |

The miss is the interesting one. Every piece worked in isolation — `sortDump` knew the difference,
the screen knew it was offline — and nothing checked that the screen actually *handed one to the
other*. Cut that wire and the sheet quietly apologises for the wrong thing.

Closed with a test that drives the whole path: offline, a `fetch` that throws, and an assertion on
the sentence the review sheet shows. Re-planted; now caught.

**Unit tests can each pass while the thing they describe is disconnected.** Somewhere there has to be
a test that walks the wire.

## Checked outside Jest

Real Chromium against `npm run build` + `npm start`, at 390 px, network toggled mid-session:

| Check | Result |
|---|---|
| Online: no banner | ✅ |
| Offline: the banner appears | ✅ |
| Offline: Dump warns before you press Sort it | ✅ |
| Offline: sorting still works | ✅ |
| The sheet's explanation | ✅ "You're offline, so Tipon sorted this with its own rules." |
| Offline: committing the proposal, then finding it in the Inbox | ✅ |
| Sideways overflow at 390 px | ✅ none |
| Back online: the banner goes on its own | ✅ |
| Page errors | ✅ none |

## What's left for v0.5

1. `git tag -a v0.5` and push it. **Not done from here** — this environment's egress relay answers
   `git-receive-pack` with a bare 403 for `refs/tags/*` while branch pushes succeed. Same as v0.
2. **Install it on a real phone and open it from the home screen.** Still the one claim v0.5 makes
   that nothing here can verify: Chromium reports a valid manifest and the app runs offline in a
   normal tab, which is necessary and not sufficient.
3. The cost of a real Claude dump is *still* unmeasured. Nobody has run one with a real key.

## Deliberately not in v0.5

Push notifications — most of Next's PWA guide, and all of it needs a server. Background sync, for the
same reason. Dark mode and search are still queued behind them.
