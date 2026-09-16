# Block 2: Projects and tasks screens

**Status:** ✅ done · 156 tests passing (60 new) · the app has screens · data lives in memory, so a refresh empties it

## What we built

| File | What it is |
|---|---|
| [`src/lib/workspace/commands.ts`](../../src/lib/workspace/commands.ts) | `WorkspaceCommand` and `stamp`: the helper that puts a real id and a real clock onto what a screen asks for |
| [`src/lib/workspace/store.tsx`](../../src/lib/workspace/store.tsx) | `WorkspaceProvider` (one `useReducer` for the whole app) and `useWorkspace` |
| [`src/lib/workspace/selectors.ts`](../../src/lib/workspace/selectors.ts) | Derived lists: active and archived projects, a project's tasks, open-task counts |
| [`src/components/shell/AppShell.tsx`](../../src/components/shell/AppShell.tsx) | Today · Dump · Projects: a bottom bar on a phone, a left rail on desktop |
| [`src/components/projects/ProjectsScreen.tsx`](../../src/components/projects/ProjectsScreen.tsx) | Index cards, the new-project form, the Inbox link, the archive |
| [`src/components/projects/ProjectScreen.tsx`](../../src/components/projects/ProjectScreen.tsx) | One project: rename, archive, ruled notes, its task list |
| [`src/components/projects/InboxScreen.tsx`](../../src/components/projects/InboxScreen.tsx) | Tasks with no project |
| [`src/components/tasks/AddTaskForm.tsx`](../../src/components/tasks/AddTaskForm.tsx), [`TaskList.tsx`](../../src/components/tasks/TaskList.tsx) | Add, tick off, edit, move and delete a task |
| [`src/app/`](../../src/app) | Routes: `/` (Today, a signpost), `/dump` (a signpost), `/projects`, `/projects/[id]`, `/inbox` |
| [`src/app/globals.css`](../../src/app/globals.css) | The "notebook on a desk" colours, all as CSS variables |
| [`src/test/workspace.tsx`](../../src/test/workspace.tsx) | `renderWithWorkspace`, plus small builders for a project, a task and a workspace |

New tests: `commands.test.ts` (11), `selectors.test.ts` (6), `store.test.tsx` (4), `AppShell.test.tsx` (7),
`ProjectsScreen.test.tsx` (8), `ProjectScreen.test.tsx` (11), `InboxScreen.test.tsx` (5), `TaskList.test.tsx` (8).

## Six ideas to take away

### 1. The screens send commands; the reducer still never invents anything
Block 1's reducer refuses to call `Date.now()` or make up an id. So a screen sends a **command**
(`{ type: "project/add", name }`) and `stamp` turns it into the action (`{ …, id: "id-1", now: 1000 }`).
One place makes ids, one place reads the clock, and both are swapped out in tests. That's why every
screen test can say "the new project is at `/projects/id-1`" and mean it.

### 2. One provider owns the state; components only draw
`WorkspaceProvider` holds the single `useReducer`. No component keeps its own copy of a project or a
task, so there's no second version of the truth to go stale. A task's checkbox doesn't remember
whether it's ticked: it asks `task.doneAt`.

### 3. Derived data is computed, not stored
"How many open tasks does this project have?" is a `filter` over the tasks (`openTaskCount`), not a
number kept on the project that something has to remember to update. Same for the sort order of a
task list. This is the habit Block 6's Today page is built on.

### 4. `"use client"` sits as low as it can
`layout.tsx` and every `page.tsx` stay Server Components. The provider and the screens are client
components, because they need state and event handlers. `/projects/[id]/page.tsx` does one thing:
`await props.params` and hand the id to `<ProjectScreen>`. That keeps the page thin **and** testable —
Jest renders `ProjectScreen` directly, with no router and no `async` component in the way.

### 5. Tests find things the way a person does
Every query is by role and visible label: `getByRole("checkbox", { name: "Pick a host" })`,
`getByLabelText("Project name")`. No test reaches for a CSS class or a test id. When a button's
visible text had to shrink to `Edit`, the accessible name stayed `Edit “Pick a host”` through an
`sr-only` span — the tests didn't change, and screen-reader users still hear which task it is.

### 6. A refusal has to be explained
The reducer silently ignores a duplicate project name — right for the engine, wrong for a person
looking at a form. So the form asks `findProjectNameProblem` (the same rule the reducer uses) *before*
sending, and puts the answer in a `role="alert"`. The rule still lives in one place; only the wording
lives in the screen.

## Decisions made in this block

| Decision | Why |
|---|---|
| The look is **notebook on a desk** (the plan's default) | Warm paper `#f7f2e8`, ink `#1f1b16`, one highlighter `#ffd45e`, thin rules instead of boxes |
| Headings use a **system serif**, not a downloaded one | `ui-serif, Georgia, …` costs no download and exists on Android and desktop. A web serif can be swapped in later by changing one variable |
| Every colour is a CSS variable in `:root` | Dark mode, after v0, becomes a block of overrides instead of a hunt through components |
| Today and Dump are real routes with a signpost on them | A nav with dead links is worse than a nav that says "Block 4" |
| The Inbox lives at `/inbox`, linked from the top of Projects | It isn't a project, so it isn't a card |
| Notes save on every keystroke | There's no Save button to forget. The reducer returns the same object when nothing changed, so nothing re-renders needlessly |
| A task's move destination is a `<select>` of active projects plus Inbox | Plain, works with a thumb, and matches the reducer: archived projects take no tasks |
| The project page is reachable for an **archived** project | You can still read its notes, tick its tasks off and move them out — only *new* tasks are refused |
| Unknown id → a plain "Project not found" page, not `notFound()` | In Block 2 the data is in memory, so a refresh legitimately loses it. The message says so |

## Deviations from the plan

| The plan said | What we did | Why |
|---|---|---|
| Screens for projects and tasks | Also task **edit** (title and due date together) and project **rename** | The reducer had both from Block 1 and neither had a way in |
| "One provider owns the state" | The provider also takes `createId` and `now` as props | Tests get `id-1`, `id-2` and a clock that stands still |
| Highlighter colour for things due today | The highlighter marks the current tab and buttons instead | Working out what "today" is belongs to Block 4's date code; the colour is already in place for Block 6 |

## How we know the tests work

Ten realistic bugs were planted one at a time with exact text replacements. Jest ran after each, then
the file was restored and checked by hash.

| Planted bug | Tests that failed |
|---|---|
| Today's tab is marked on every page (every path starts with a slash) | 4 |
| A new project never gets its id stamped on | 4 |
| A name that is already taken is no longer explained | 3 |
| Open-task counts include finished tasks | 2 |
| Finished tasks are mixed in with open ones instead of sorted below | 1 |
| One id per screen instead of one per command, so two records share it | 1 |
| The new-project field keeps what you typed after the project is added | 1 |
| An empty due date is sent as `""` instead of nothing | 1 |
| The checkbox always completes, so a finished task can't be reopened | 1 |
| An archived project still takes new tasks | 1 |

Every bug was caught, and the suite was green again afterwards.

## Checked outside Jest

Driven in real Chromium against `npm run dev`:

| Check | Result |
|---|---|
| Add two projects, refuse "website RELAUNCH" as a duplicate | ✅ the warning appears, nothing is added |
| Project page: notes, a task with a due date, a second task ticked off | ✅ |
| The card back on Projects shows "1 open task" and the first line of the notes | ✅ |
| Move an Inbox task into a project | ✅ the Inbox says it's empty again |
| `/projects/nope` | ✅ "Project not found" |
| Phone width (375 px) | ✅ `scrollWidth` 375, no sideways scroll, nav at the bottom under the thumb |
| Browser console | ✅ no errors or warnings |
| `npm run lint`, `npm run typecheck`, `npm run build` | ✅ |

## Known limits

| Limit | Why |
|---|---|
| A refresh empties everything | Nothing is saved yet. Block 3 |
| Deleting a task asks nothing first | An undo, or a confirmation, would be a Block 6 polish item |
| No length limits on names or titles | Still not needed; the reducer trims |
| Projects are listed in the order they were added | Manual reordering isn't planned |

## Deliberately NOT in this block

| Not yet | Comes in |
|---|---|
| Saving, Export and Import | Block 3 |
| The Dump page and the parser | Block 4 |
| Working out what "today" is, and the highlighter for tasks due today | Blocks 4 and 6 |
| Keyboard shortcuts, a first-run welcome | Block 6 |
| Dark mode (the variables are ready) | After v0 |
