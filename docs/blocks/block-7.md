# Block 7 — Installable

**Status:** ✅ done · 517 tests passing (18 new) · Tipon can be installed to a home screen, and
asks the browser to keep its notebook

The first block of v0.5 (`docs/PLAN-v0.5.md`). Nothing here shows up as a feature you can point
at — the app looks the same. What changed is that a phone will now treat it as an app.

## What it does

| | |
|---|---|
| `src/app/manifest.ts` | Next generates `/manifest.webmanifest` from it — no hand-written JSON, no `<link>` to add |
| `public/icon-192.png`, `icon-512.png` | The two sizes Android asks for |
| `public/icon-maskable-512.png` | Art inside the middle 80%, so Android's mask doesn't crop the notebook's corners |
| `src/app/apple-icon.png` | iOS ignores the manifest's icons entirely; this file convention makes Next emit the `apple-touch-icon` link |
| `src/lib/storage/durability.ts` | `askForDurableStorage()` — one function, injected storage, five honest outcomes |
| `src/components/shell/KeepMyNotebook.tsx` | Asks once per browser. Draws nothing; only runs an effect |

## What I learned

### 1. The icons are the part with no test to write

A manifest is data, so it tests like data. The icons are pictures, and "does this look like a
notebook at 48 pixels" isn't a Jest assertion. Two things helped:

- The art is **generated, not drawn**: an SVG rendered to PNG at each size by the Chromium that's
  already here for the browser pass. The maskable variant is the same drawing with an `inset`
  parameter, so the two can never drift apart by hand.
- A test asserts **every `src` in the manifest is a file that exists**, and the browser pass asserts
  each one's `naturalWidth` matches the size it claims. A 512 icon that's secretly 192 is the sort
  of thing you'd otherwise discover from a blurry home screen.

### 2. A colour nobody can see from inside the app

`background_color` paints the splash screen the operating system shows while the app boots. The app
never renders it, so no screen test can catch it being wrong — it would just launch white against
warm paper, and only on a real phone. So the test **reads `globals.css`** and asserts the manifest
matches `--paper`. Change the palette without touching the manifest and Jest says so.

### 3. Durable storage is a request, not a guarantee

`navigator.storage.persist()` is why this block comes before anything prettier: Safari evicts site
data after about a week of non-use, and a `localStorage`-only notebook you didn't open can simply be
gone. Installed apps are treated far less aggressively.

But it can say no. In headless Chromium it **did** say no — no user engagement, no persistence. The
app records `refused` and carries on, exactly as it should. The code has five outcomes (`already`,
`granted`, `refused`, `unsupported`, `failed`) because all five really happen, and a boolean would
have lied about at least two of them.

### 4. A test that couldn't fail

The planted-bug pass caught 7 of 8 — the miss was mine, in the test:

```ts
await waitFor(() => expect(store.read(DURABLE_ASKED_KEY)).toBeNull());
```

`waitFor` passes the instant its assertion passes, and "still null" passes immediately — before the
effect's promise had run at all. The test asserted nothing. Planting the bug (write the key even
when the browser has no Storage API) is what exposed it: the suite stayed green with a real defect
in place.

Fixed by letting the whole chain settle first, then looking once. Re-planted, and now it fails.

**`waitFor` is for waiting until something becomes true. It cannot show that something stays
false.** That needs a flush and a plain assertion.

## How we know the tests work

8 bugs planted, each restored and verified by md5:

| Planted | Caught by |
|---|---|
| No maskable icon | the maskable test |
| Splash colour drifts from the stylesheet | the `globals.css` comparison |
| `display: "browser"` instead of `standalone` | the installability test |
| An icon `src` pointing at a file that isn't there | the file-exists test |
| Asks to persist again when already persistent | `askForDurableStorage` |
| A throw escaping instead of becoming an outcome | `askForDurableStorage` |
| No StrictMode guard, so it asks twice | the StrictMode test |
| Remembers we asked when the API is unsupported | **missed at first** — see above; caught after the test was fixed |

## Checked outside Jest

Real Chromium against `npm run build` + `npm start`:

| Check | Result |
|---|---|
| `<link rel="manifest">` in the page | ✅ `/manifest.webmanifest`, served as `application/manifest+json` |
| `<link rel="apple-touch-icon">` | ✅ emitted from the `apple-icon.png` convention |
| Each icon loads at the size the manifest claims | ✅ 192×192, 512×512, 512×512 |
| Durable storage asked and answered | ✅ recorded `refused` (headless Chromium grants nothing) |
| Asked only once, across a reload and a second page | ✅ unchanged |
| Browser console | ✅ silent |

## Still to come in v0.5

Block 8 is the service worker — the one that can actually break things, because a stale cached shell
meeting a newer save file is worse than stale UI. Block 9 is honest offline and the release.

The installability check that needs a real device is still open: install it to an Android home
screen and confirm it opens with no address bar. Chromium reports the manifest as valid, which is
necessary but not the same thing.
