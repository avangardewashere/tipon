# Block 1: Skeleton + workspace engine

**Status:** ✅ done · 96 tests passing · pushed to GitHub with CI · the page is a placeholder (screens come in Block 2)

## What we built

| File | What it is |
|---|---|
| [`jest.config.ts`](../../jest.config.ts), [`jest.setup.ts`](../../jest.setup.ts) | Jest through `next/jest`, with jest-dom's extra matchers |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | Lint, typecheck, tests and build on every push |
| [`src/lib/dates/dayKey.ts`](../../src/lib/dates/dayKey.ts) | The `DayKey` type (`YYYY-MM-DD`) and `isDayKey`, which only accepts real calendar days |
| [`src/lib/workspace/types.ts`](../../src/lib/workspace/types.ts) | `Project`, `Task`, `Workspace` and `emptyWorkspace` |
| [`src/lib/workspace/rules.ts`](../../src/lib/workspace/rules.ts) | `findProjectNameProblem`: is a name empty or already taken? |
| [`src/lib/workspace/reducer.ts`](../../src/lib/workspace/reducer.ts) | The 10 `WorkspaceAction`s and `workspaceReducer` |
| [`src/app/page.tsx`](../../src/app/page.tsx) | Placeholder home page |

Tests: `dayKey.test.ts` (22), `rules.test.ts` (10), `reducer.test.ts` (63), `page.test.tsx` (1).

The whole API of the app, for now:

```
Project   add ──► edit (name, notes) ──► archive ⇄ unarchive
Task      add ──► edit (title, due)  ──► complete ⇄ reopen
                  move (Inbox ⇄ any active project)      delete
```

## Six ideas to take away

### 1. Model the data before the screens
There's no UI yet, and that's the point. Deciding what a `Task` *is* (and what it isn't) is easier
without buttons in the way. Block 2's screens will only ever *send actions* and *show state*. Every
rule already lives here, tested.

### 2. The reducer never makes things up
Every action brings its own `id` and `now`. The reducer never calls `crypto.randomUUID()` or
`Date.now()`. Same actions in, same workspace out, every time. So a test can use ids like `"p-web"`
and a clock that reads `1000`. Block 2 adds one small helper that stamps real ids and times onto
actions.

### 3. "Ignored" means "the same object"
If an action isn't allowed (a blank name, an unknown id, a due date of `2026-02-30`) or changes
nothing, the reducer returns **the exact object it was given**. Tests check this with `toBe`, not
`toEqual`. React will use the same signal to skip re-rendering. Sipat taught this; here it also
covers edits like renaming "Website" to " Website ".

### 4. Two locks against changing data in place
- **At compile time:** every type is `readonly`, so TypeScript refuses `task.title = "..."`.
- **At run time:** one test deep-freezes every workspace and runs all 10 kinds of action. Changing a
  frozen object throws, so any in-place change would fail the test.

### 5. One fact, one field; say what you mean
- A task has `doneAt` (a time, or `null`) and **no** separate `done` flag. Two fields could
  disagree ("done, but no completion time"). One field can't.
- There's `task/complete` and `task/reopen` instead of `task/toggle`. A toggle sent twice undoes
  itself: a double tap today, or a replayed sync message in v1. "Complete" sent twice is still
  complete, and keeps the *first* completion time.

### 6. Table tests with `it.each`
`isDayKey` has 22 tests, but they're really three lists: real days, fake days with the reason
("April has 30 days"), and non-strings. Adding a case is one line. Jest prints each row as its own
test, so a failure names the exact input.

## Decisions made in this block

| Decision | Why |
|---|---|
| Project names are unique across **all** projects, archived included, ignoring upper/lower case | Bringing a project back can never clash, and Block 4's parser can match "website" to "Website" safely |
| Archived projects don't accept new tasks, but their tasks can still be completed, edited or moved out | Archiving means "put away", not "locked" |
| Edits are all or nothing | If the new name is refused, the notes in the same edit don't save either. A half-applied change is harder to explain |
| Names and titles are trimmed; notes are kept exactly as typed | Spaces and blank lines inside notes can matter |
| Due dates must be real days | A `2026-02-30` would break the Today grouping in Block 6 |
| Projects are listed in the order they were added | Simple for now. Manual reordering isn't planned yet |
| No length limits on names or titles yet | Belongs with the forms in Block 2 if needed |

## Deviations from the plan

| The plan said | What we did | Why |
|---|---|---|
| A task has `done` and `doneAt` | Only `doneAt` | Idea 5: two fields could disagree |
| Tasks had no `updatedAt` | Added `updatedAt` | v1 sync needs to know which copy is newer. Projects already had it |
| Rename a project | `project/edit` with a new name, new notes, or both | Same shape as `task/edit` |
| Archive only | Archive **and** `project/unarchive` | The plan promised archiving could be undone |
| Live on Vercel on day one | Pushed to GitHub. Connecting Vercel is your step | There's no Vercel CLI on this PC; importing the repo takes a minute in the Vercel dashboard |

## How we know the tests work

Eight realistic bugs were planted one at a time with exact text replacements. Jest ran after each,
and each file was restored and checked by hash.

| Planted bug | Tests that failed |
|---|---|
| Completing a finished task overwrites the first completion time | 1 |
| The name check forgets about archived projects | 3 |
| Renaming forgets the project's own id, so it clashes with itself | 1 |
| Due dates only checked for shape, so `2026-02-30` gets through | 4 |
| Leap years use only the "divisible by 4" rule | 1 |
| Archived projects still accept new tasks | 2 |
| An edit that changes nothing still makes a new object | 3 |
| A refused name no longer blocks the notes (not all or nothing) | 1 |

Every bug was caught, and the suite was green again afterwards.

## Checked outside Jest

| Check | Result |
|---|---|
| Dev server: page loads, tab title `Tipon`, no console errors | ✅ |
| Body font is Geist (the template's Arial override was removed) | ✅ |
| Phone width (375 px): no sideways scroll | ✅ `scrollWidth` 375 |
| `npm run build` | ✅ |
| CI on GitHub | See the commit's check mark on GitHub |

## Deliberately NOT in this block

| Not yet | Comes in |
|---|---|
| Any real screens, forms, or the notebook look | Block 2 |
| The helper that stamps real ids and `Date.now()` onto actions | Block 2 |
| Saving anything | Block 3 |
| The `Dump` record | Block 4 |
| Turning a real date into a `DayKey`, "today"/"tomorrow" | Block 4 |
| Grouping tasks for the Today page | Block 6 |
| Deleting projects, reordering, length limits | Not planned yet |
