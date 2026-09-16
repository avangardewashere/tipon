# Block 6: Today + v0 release

**Status:** ✅ done · 497 tests passing (72 new) · the app is finished for v0 · the `v0` tag is the one step left, and it belongs on the default branch

## What we built

| File | What it is |
|---|---|
| [`src/lib/today/today.ts`](../../src/lib/today/today.ts) | `buildToday`: overdue, due today, the next task in each project, the Inbox count, and what was finished today — all computed, none of it stored |
| [`src/components/today/TodayScreen.tsx`](../../src/components/today/TodayScreen.tsx) | The page, with a checkbox on every line so you can tick things off where you stand |
| [`src/components/today/Welcome.tsx`](../../src/components/today/Welcome.tsx) | The first-run welcome, which leaves as soon as there's anything in the app |
| [`src/lib/shortcuts/shortcuts.ts`](../../src/lib/shortcuts/shortcuts.ts), [`useShortcuts.ts`](../../src/lib/shortcuts/useShortcuts.ts) | <kbd>T</kbd> <kbd>D</kbd> <kbd>P</kbd> <kbd>I</kbd> <kbd>B</kbd>, and the rules for when a key is just a key |
| [`src/lib/workspace/store.tsx`](../../src/lib/workspace/store.tsx) | Two open tabs now agree instead of overwriting each other |
| [`src/test/manilaTimeZone.cjs`](../../src/test/manilaTimeZone.cjs) + two environments | Block 4's UTC+8 trick, now available for browser tests too |
| [`README.md`](../../README.md), [`docs/RELEASE.md`](../RELEASE.md) | What Tipon is, and the checklist for cutting a release |

New tests: `shortcuts.test.ts` (19), `today.test.ts` (18), `TodayScreen.test.tsx` (13),
`Welcome.test.tsx` (5), `todayAtUtc8.test.ts` (4) and `todayAtUtc8.test.tsx` (4), plus
`AppShell.test.tsx` (+3) and `store.test.tsx` (+6).

## Six ideas to take away

### 1. Derived data is a question, not a field
There is no `overdue` flag anywhere in Tipon. "Overdue" is `task.due < today`, asked again every time
the page is drawn. Nothing has to run at midnight, nothing can drift, and a task that was due today
becomes overdue on its own while the tab sits open. Block 1 decided this ("one fact, one field") and
Today is where it pays off.

### 2. The whole page is one pure function away
`buildToday` takes a workspace and a day and returns five lists. It's the biggest piece of logic in
the app and it has no React, no clock, and no storage in it — the clock arrives as an argument. That's
why 22 of its tests read like a spreadsheet, and why the UTC+8 ones can put the clock at half past
midnight on the far side of the world.

### 3. A shortcut's hardest job is knowing when to do nothing
`shortcutFor` returns `null` for a key pressed with Ctrl (that's a bookmark), with Shift, inside an
input, a textarea, a select, anything `contenteditable`, or anything another handler has already dealt
with. Typing "dump the bins today" in the notepad must not fire four shortcuts and throw the page
away. Five of the nineteen shortcut tests are about not acting.

### 4. Ship the first run, not just the tenth
An empty app that says nothing is a bad first impression, and a permanent welcome banner is worse. The
welcome shows only while the workspace is completely empty, dismisses itself for good if you ask, and
never returns once there's a project, a task or a dump — three conditions, three tests.

### 5. The browser found the bug the tests couldn't
Two open tabs now tell each other about saves. The first version worked — and wrote **183 times** in
ten seconds: each tab loaded what the other saved, saved it straight back, and woke the other up
again. Jest couldn't see it because no test counted writes. The fix is three lines (remember the
workspace that's on disk; don't write it again) and now three tests count writes. Watching real
behaviour is not optional, even at 100% green.

### 6. "Shipped" is a list you can run
`docs/RELEASE.md` is five commands and five things to look at, all of them checkable. A release
checklist that says "click around a bit" isn't a checklist; it's a hope.

## Decisions made in this block

| Decision | Why |
|---|---|
| Today shows **one** next task per project | It's a nudge, not a second Projects page. The project page is one tap away |
| A task that's overdue or due today isn't repeated under its project | Saying the same thing twice on one screen makes both lines easier to ignore |
| Finished-today work is kept, behind a fold | A day's work shouldn't vanish the moment it's ticked off, but it isn't the point of the page either |
| Single-letter shortcuts, no chords, no palette | Five destinations don't need `Ctrl+K`. The bottom bar is still the answer on a phone |
| The shortcut hint only shows on desktop | A phone has no keys to press |
| The welcome disappears by itself once there's anything in the app | Otherwise it becomes furniture nobody reads |
| Another tab's save wins | Last write wins is the honest rule with no server. Both tabs agreeing beats one of them silently losing everything |
| `Backup` gets a key (<kbd>B</kbd>) but not a tab | The nav stays at three, as Block 2 decided |

## Deviations from the plan

| The plan said | What we did | Why |
|---|---|---|
| Today: overdue, due today, next per project, Inbox count | Also "finished today" | It's the same data, and a list that only ever grows is dispiriting |
| Keyboard shortcuts on desktop | Five, plus the rules for staying silent | The interesting part was always the silence |
| A phone-width pass | Every page measured at 375 px in a real browser | It's a supported device, so it gets a number, not a glance |
| — | Two tabs stay in step | Block 3 listed it as a known limit and this was the block to fix it |
| v0 tag | **Not tagged here** | The tag belongs on the default branch after this work merges. The command is in `docs/RELEASE.md` |

## How we know the tests work

Fourteen realistic bugs were planted one at a time with exact text replacements. Jest ran after each,
then the file was restored and checked by hash.

| Planted bug | Tests that failed |
|---|---|
| Finished tasks are still listed as due | 9 |
| Shortcuts fire while you are typing | 5 |
| The Inbox count includes finished tasks | 4 |
| Shortcuts steal the browser's own key combinations | 4 |
| A task due today is counted as overdue | 3 |
| A task already shown above is repeated under its project | 3 |
| Only text boxes are left alone, not notepads | 3 |
| The welcome stays once there is work in the app | 3 |
| Archived projects are nudged about too | 2 |
| A workspace read from storage is written straight back (the two-tab loop) | 2 |
| The oldest overdue task is shown last | 1 |
| Every change in storage reloads the workspace, drafts included | 1 |
| The welcome keeps coming back after it has been dismissed | 1 |
| What was finished today is worked out in UTC | **0 → 1** |

The last one is worth the space. It passed at first: the UTC+8 tests called `buildToday` directly with
a good `dayOf`, so nothing checked what the *screen* passed in. A second Jest environment — jsdom at
UTC+8 — and four tests later, the same planted bug fails. A test that can't see the wiring isn't
testing the wiring.

## Checked outside Jest

Driven in real Chromium against `npm run dev`:

| Check | Result |
|---|---|
| A brand-new browser | ✅ the welcome, with links to Dump and Backup |
| <kbd>D</kbd> from Today | ✅ lands on `/dump` |
| Typing "dump the bins today" in the notepad | ✅ stays on the page, and every letter arrives |
| Dump → sort → add, then Today | ✅ Overdue, Due today, Next in each project, "2 tasks waiting in the Inbox", all correct |
| Ticking a task off from Today | ✅ moves to "1 finished today" |
| Two tabs, a project added in the second | ✅ the first shows it — and the storage-event count went from **183 to 1** after the loop fix |
| 375 px on `/`, `/dump`, `/projects`, `/inbox`, `/backup`, a project page | ✅ `scrollWidth` 375 everywhere |
| Browser console | ✅ no errors or warnings |
| `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` | ✅ |

## What's left to call it released

1. Merge this branch into the default branch.
2. `git tag -a v0 -m "Tipon v0: dump, projects, tasks, today"` and push the tag (`docs/RELEASE.md`).
3. Import the repo into Vercel, or redeploy if it's already there.
4. Add `ANTHROPIC_API_KEY` and `TIPON_ACCESS_CODE` in Vercel **only** if you want Claude sorting
   dumps — and set a spend limit in the Console first.
5. Open the deployed URL on your Android phone and add one real task. That's the moment v0 exists.

## Known limits of v0

| Limit | The plan |
|---|---|
| One browser at a time; no accounts, no sync | Export/Import bridges devices; accounts in v1 |
| Two tabs agree, but the last save still wins | A proper merge needs a server |
| Clearing browser data clears Tipon | Keep a backup |
| Anyone with the access code can spend your AI credits | Keep it private, keep a spend limit |
| No dark mode | After v0 — the colours are already CSS variables |
| The cost of a real Claude dump is still unmeasured | Nobody has run one with a real key yet |

## Deliberately NOT in v0

| Not yet | Comes in |
|---|---|
| Accounts, sync, a real database | v1 |
| Google Calendar, a daily brief by email, chat with your projects | Later, one at a time |
| Goals, milestones, risks, documents | Later |
| Voice dumps, SMS, teams, billing | Not planned |
