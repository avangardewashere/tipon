# Block 3: Saved on this device

**Status:** ✅ done · 227 tests passing (71 new) · your work survives a refresh · Export and Import as a JSON backup

## What we built

| File | What it is |
|---|---|
| [`src/lib/storage/keyValueStore.ts`](../../src/lib/storage/keyValueStore.ts) | The whole storage interface: strings in, strings out. `browserStore()` for the app, `memoryStore()` for tests |
| [`src/lib/storage/saveFile.ts`](../../src/lib/storage/saveFile.ts) | The Zod schema for a save file, `parseSaveFile`, and the sentence to show for each way it can be wrong |
| [`src/lib/storage/workspaceStorage.ts`](../../src/lib/storage/workspaceStorage.ts) | Load, save, import, and the copies we keep |
| [`src/lib/storage/download.ts`](../../src/lib/storage/download.ts), [`readTextFile.ts`](../../src/lib/storage/readTextFile.ts) | The two places that touch the browser's file plumbing, kept apart so screens stay testable |
| [`src/lib/workspace/store.tsx`](../../src/lib/workspace/store.tsx) | The provider now loads on mount, saves on every change, and carries a `notice` when something needed saying |
| [`src/components/shell/WorkspaceGate.tsx`](../../src/components/shell/WorkspaceGate.tsx) | Holds the screens back until the saved copy has been read, and shows the notice |
| [`src/components/backup/BackupScreen.tsx`](../../src/components/backup/BackupScreen.tsx), [`src/app/backup/page.tsx`](../../src/app/backup/page.tsx) | `/backup`: export, import with a confirmation step, and the list of kept copies |

New tests: `saveFile.test.ts` (22), `workspaceStorage.test.ts` (13), `keyValueStore.test.ts` (7) and
`keyValueStore.server.test.ts` (1), `store.test.tsx` (+13, now 17), `BackupScreen.test.tsx` (10),
`WorkspaceGate.test.tsx` (4), `AppShell.test.tsx` (+1).

## Six ideas to take away

### 1. Storage is an interface, not a global
Nothing outside `keyValueStore.ts` mentions `localStorage`. The app hands the provider a store
backed by the browser; every test hands it one backed by a `Map`. That's why Block 2's screen tests
didn't change at all when saving arrived — `renderWithWorkspace` just seeds the `Map` with a real
save file, so every one of those tests now runs through the load path for free.

### 2. Validate anything you didn't just make
A workspace that came from the reducer is correct by construction. A file that has been sitting in a
browser for a month, or that someone edited by hand, is not. `parseSaveFile` checks every field with
Zod — plus two rules no single field can express: ids must be unique, and a task can't belong to a
project that isn't in the file. Block 5's reply from Claude gets exactly the same treatment.

### 3. Nothing is wiped silently
When the saved data can't be read, it is **copied** to `tipon.kept.<time>` before anything else
happens, and the message on screen names the key. An import copies what's there first, too. If even
the copy fails to write, Tipon leaves the original exactly where it is and **switches saving off for
the session** rather than write over data it couldn't keep.

### 4. Hydration: the first render has to match
The server has no `localStorage`, so it cannot know your projects. Both sides therefore render
"Opening your notebook…" first, and only an effect — which never runs on the server — fills in the
real data. A test renders the provider twice with `renderToStaticMarkup`, once over an empty store and
once over a full one, and asserts the two strings are **identical**. That's the hydration rule made
into an assertion instead of a paragraph in a README.

### 5. Effects dispatch; they don't set four states
Loading has to settle four things at once: the workspace, the status, the notice, and whether saving
is allowed. Four `useState`s would be four renders and four chances to disagree. Instead the provider
has one reducer and the effect dispatches one `store/loaded` action, so "what happens when loading
finds X" is a pure function a test can call directly. ESLint's `react-hooks/set-state-in-effect` rule
pushed us here, and the result is simpler than what it rejected.

### 6. Effects run twice in development, and that's a real bug finder
The first browser check showed no warning after a corrupted file, though Jest was green: React
re-ran the load effect, the second pass found the mess already tidied away, decided all was well and
dropped the message. The load now happens **once per store**, and a test wrapped in `<StrictMode>`
proves it. Jest alone wouldn't have found this; ten minutes in a real browser did.

## Decisions made in this block

| Decision | Why |
|---|---|
| One key, `tipon.workspace`, with the version **inside** the file | A v2 reader must be able to open a v1 file to migrate it. Version-in-the-key makes old data invisible instead |
| A file from a **newer** version is refused, not guessed at | We can't know what v2 added. Older files will be migrated in `parseSaveFile`, the one place that knows old shapes |
| Save on every change, with no debounce | A workspace is small, and `localStorage` writes are fast. If Block 6 shows it matters, that's one `setTimeout` in the provider |
| Import asks first, and says what's in the file | "3 projects and 7 tasks" is the difference between a restore and an accident |
| Copies we kept are listed on `/backup`, never deleted automatically | Deleting someone's only surviving copy to save a few kilobytes is not ours to do |
| `Backup & restore` lives in the footer, not the nav | Three tabs under your thumb was the Block 2 decision; a fourth would crowd it |
| `workspace/replace` is not a `WorkspaceAction` | That list is the v1 API. "Replace everything" is a client-only concern, so it lives in the provider's own reducer |
| A backup is always `tipon-backup.json` | Putting today's date in the name needs date code that belongs to Block 4. The browser adds "(1)" for repeats |

## Deviations from the plan

| The plan said | What we did | Why |
|---|---|---|
| Storage behind an interface | Two more slivers behind interfaces: `download.ts` and `readTextFile.ts` | They're the only browser-only bits left, so the Backup screen is fully testable |
| Validate anything you load | Also two cross-field rules Zod can't infer from the shape | A duplicate id or an orphan task breaks screens in ways that are hard to trace back |
| — | `readTextFile` uses `FileReader`, not `file.text()` | jsdom has no `file.text()`, so the import tests can use a real `File` |

## How we know the tests work

Twelve realistic bugs were planted one at a time with exact text replacements. Jest ran after each,
then the file was restored and checked by hash.

| Planted bug | Tests that failed |
|---|---|
| An unreadable save file is thrown away instead of copied aside | 8 |
| A file from a newer version is read anyway instead of refused | 4 |
| Due dates in a saved file are only checked for shape, so `2026-02-30` gets through | 3 |
| An imported file replaces everything without asking first | 3 |
| An import replaces what's there without keeping a copy first | 2 |
| Saving is on before the saved file has been read | 1 |
| The saved copy is read again on React's second pass, losing the message about it | 1 |
| Saving stays on even when the unreadable file couldn't be copied aside | 1 |
| Two kept copies in the same millisecond overwrite each other | 1 |
| A task pointing at a project that isn't in the file is accepted | 1 |
| An export writes the bare workspace, so it can't be imported back | 1 |
| The probe key `browserStore` writes is left behind | 1 |

Every bug was caught. One earlier attempt — deleting the "don't save while loading" check — broke
nothing, because a second flag already covered it; the redundant check was removed and the bug
re-planted as "saving starts switched on", which the same test catches.

## Checked outside Jest

Driven in real Chromium against `npm run dev`:

| Check | Result |
|---|---|
| Add a project, notes and a task, then **refresh** | ✅ all still there; `localStorage` holds one key, `tipon.workspace` |
| Export a backup | ✅ downloads `tipon-backup.json`, and the file parses |
| Import that file into a **second, empty browser profile** | ✅ asks first ("1 project and 1 task"), then the project is there |
| Corrupt the saved file by hand, then reload | ✅ "That file isn't JSON at all. Your old data was kept as `tipon.kept.…`" and the key is really there |
| Phone width (375 px) on `/backup` | ✅ `scrollWidth` 375 |
| Browser console | ✅ no errors or warnings |
| `npm run lint`, `npm run typecheck`, `npm run build` | ✅ |

## Known limits

| Limit | Why |
|---|---|
| Your phone and PC still don't share data | Per-browser storage. Export and Import bridge it; accounts and sync are v1 |
| Two tabs of Tipon will overwrite each other | Nothing listens for the `storage` event yet. Worth a look in Block 6 |
| Kept copies pile up until you clear them by hand | Deleting them automatically could throw away the only copy someone has |
| A backup is plain, readable JSON | That's the point — you can open it. It also means anyone with the file can read your notes |

## Deliberately NOT in this block

| Not yet | Comes in |
|---|---|
| The Dump page, the parser, and a half-written dump surviving a refresh | Block 4 |
| Migrating an old save file | When there is a v2 to migrate to |
| Accounts, sync, a real database | v1 |
| Today's grouping and date words | Blocks 4 and 6 |
