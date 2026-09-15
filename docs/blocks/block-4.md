# Block 4: Brain dump + review

**Status:** ✅ done · 362 tests passing (135 new) · a dump becomes projects and tasks, after you've checked it

## What we built

| File | What it is |
|---|---|
| [`src/lib/dates/calendar.ts`](../../src/lib/dates/calendar.ts) | `dayKeyFromDate`, `addDays`, `weekdayOf`, `nextWeekday`, `nextMonthDay` — calendar arithmetic with no `Date` in it |
| [`src/lib/dump/dateWords.ts`](../../src/lib/dump/dateWords.ts) | `readDueDate`: splits "pick a hosting plan fri" into a title and a due date |
| [`src/lib/dump/proposal.ts`](../../src/lib/dump/proposal.ts) | The `Proposal` shape — **the contract Block 5's AI will fill in** |
| [`src/lib/dump/quickParser.ts`](../../src/lib/dump/quickParser.ts) | `parseDump`: rules only, no AI, no network, no cost |
| [`src/lib/dump/commit.ts`](../../src/lib/dump/commit.ts) | `toActions`: proposal + what you kept → the exact list of actions to dispatch |
| [`src/lib/dump/useDraft.ts`](../../src/lib/dump/useDraft.ts) | The half-written dump, kept in storage as you type |
| [`src/components/dump/DumpScreen.tsx`](../../src/components/dump/DumpScreen.tsx), [`ReviewSheet.tsx`](../../src/components/dump/ReviewSheet.tsx) | The notepad, the review sheet, and the history of earlier dumps |
| [`src/test/manilaEnvironment.cjs`](../../src/test/manilaEnvironment.cjs) | A Jest environment that runs a test file at UTC+8 |
| `types.ts`, `reducer.ts`, `saveFile.ts` | The `Dump` record, the `dump/record` action, and dumps in the save file |

New tests: `calendar.test.ts` (31), `dateWords.test.ts` (32), `quickParser.test.ts` (29),
`DumpScreen.test.tsx` (15), `commit.test.ts` (9), `useDraft.test.tsx` (6), `timeZone.test.ts` (5),
plus `reducer.test.ts` (+4) and `saveFile.test.ts` (+4).

## Six ideas to take away

### 1. Propose → review → commit
The parser doesn't add anything. It returns a **proposal**: projects and tasks that don't exist yet,
each with a tick beside it. You untick, retype, change a date, and only then does anything reach the
reducer. That's what makes Block 5 safe: when Claude writes the proposal instead of a regular
expression, the sheet in front of you doesn't change, and neither does the trust you place in it.

### 2. The seam is a data shape, not a function call
`Proposal` is the whole contract between "something that reads text" and "the screen that checks it".
`toActions` takes a proposal and the keys you kept; the review sheet takes a proposal and calls back
with edits. Neither knows a parser exists. In Block 5 the only new thing is another producer of the
same shape — and a fallback to this one when the network, the key, or the answer is no good.

### 3. Dates are arithmetic, not `Date`
Once text becomes a `DayKey`, no `Date` object is involved again: `addDays` and `weekdayOf` work on
the numbers in `YYYY-MM-DD`. There is exactly **one** place a real clock becomes a day —
`dayKeyFromDate` — and it reads the local calendar parts. One test file runs in Asia/Manila and
checks the trap directly: at half past midnight on the 21st, `toISOString()` says the 20th and we say
the 21st.

### 4. A Jest environment is the honest way to change the clock's zone
`process.env.TZ = "Asia/Manila"` inside a test does nothing: Jest hands the test file a *copy* of
`process.env`, so Node never hears about it and V8 keeps the old zone. A four-line custom environment
sets the zone in the worker before the file loads, and puts it back afterwards. Worth knowing before
you spend an afternoon on it.

### 5. Rules should stop where rules stop
The parser reads a date word **at the end of a line** and nowhere else. "call the bank tomorrow"
works; "tomorrow, call the bank" comes out as a plain task; "ugh so much on today" becomes a task due
today, because no rule can tell that from "call the bank on friday". Numeric dates like `9/10` are
left alone entirely — that's 9 October to half the world. Every one of those limits is a test, so
Block 5 can show exactly what the AI adds instead of hand-waving about it.

### 6. An added field with a default needs no new version
`dumps` is new in this block, and a save file written by Block 3 doesn't have it. Zod's `.default([])`
loads those files as "no dumps", and a test keeps a Block 3 file around to prove it. Renaming or
removing a field is the change that needs a version bump and a migration; adding one isn't.

## Decisions made in this block

| Decision | Why |
|---|---|
| A date word counts only at the **end** of a line | Anywhere else needs to understand the sentence, which is Block 5's job |
| "sat" said on a Saturday means **today** | That's what people mean. The review sheet is right there if it isn't |
| "Sep 20" in December means **next** September | A date in the past is never what someone just typed |
| `feb 30` stays in the title | A date that doesn't exist is better left visible than turned into a wrong one |
| A dump joins a project of yours by name, keeping **your** spelling | "website relaunch:" shouldn't re-case "Website relaunch" |
| Keeping a matched project that was archived **unarchives** it | You're using it again, and an archived project takes no new tasks |
| A task whose project you unticked goes to the **Inbox** | Dropping it because of a decision about something else would be a surprise |
| The dump record lists only what it **created** | Joining "Health" didn't create it. The ids are a receipt, not a link |
| A dump that added nothing isn't recorded | Nothing happened, so there's nothing to look back at |
| The draft lives in storage, not in the workspace | It isn't data yet. It's writing in progress, under its own key |
| What you've typed wins over a draft that loads late | Nobody's keystrokes should be swallowed by storage arriving a moment later |

## Deviations from the plan

| The plan said | What we did | Why |
|---|---|---|
| `Dump` has `id · text · createdAt · ids it created` | Exactly that, as a third list in the workspace | So it's saved, validated and exported with everything else |
| Table-driven tests with `test.each` | `it.each`, same thing, matching Block 1's style | Consistency with `isDayKey`'s tests |
| Review sheet edits items | Also blocks a project name that clashes with one you have | Otherwise the reducer would refuse it and the tasks under it would quietly land in the Inbox |
| — | `runAll` added to the provider | A dump's actions are worked out together: the task needs the id of the project made one action earlier |

## How we know the tests work

Fourteen realistic bugs were planted one at a time with exact text replacements. Jest ran after each,
then the file was restored and checked by hash.

| Planted bug | Tests that failed |
|---|---|
| Every task lands in the Inbox, whatever heading it was under | 8 |
| A hash heading is read as a task instead of starting a project | 5 |
| Unticked tasks are added anyway | 5 |
| A weekday said on that same weekday means next week | 4 |
| A project you already have is proposed again as a new one | 4 |
| Today is read with `toISOString`, so UTC+8 gets yesterday after midnight | 3 |
| A month and day that has passed is put in the past | 3 |
| A date word anywhere in the line is read, not just at the end | 3 |
| Leap years use only the "divisible by 4" rule | 3 |
| An archived project is joined without being brought back | 2 |
| A task whose project was unticked is dropped instead of going to the Inbox | 1 |
| A project the dump merely joined is recorded as one it created | 1 |
| The page keeps its writing after the dump has been added | 1 |
| A name clash no longer blocks adding | 1 |

Every bug was caught, and the suite was green again afterwards.

## Checked outside Jest

Driven in real Chromium against `npm run dev`:

| Check | Result |
|---|---|
| Type a nine-line dump, **refresh** mid-thought | ✅ every word still there |
| Sort it | ✅ "Add 2 projects and 7 tasks"; `fri` → 2026-09-18, `sep 20` → 2026-09-20, `9/10` left in the title |
| Untick one task, then add | ✅ "Added 2 projects and 6 tasks", page cleared |
| Projects afterwards | ✅ Website relaunch and Health, with their tasks under them |
| A second dump with "website RELAUNCH:" | ✅ marked "yours", and no second project was made |
| History after a refresh | ✅ two entries, newest first, with what each one added |
| Phone width (375 px) on the review sheet | ✅ `scrollWidth` 375 |
| Browser console | ✅ no errors or warnings |
| `npm run lint`, `npm run typecheck`, `npm run build` | ✅ |

## Known limits

| Limit | Why |
|---|---|
| Only a date word at the end of a line is read | A rule can't read a sentence. Block 5 |
| "next friday", "in two weeks", "the 20th" aren't understood | Same reason |
| Rambling becomes one task with the rambling as its title | Honest: it's what the rules can do |
| A dump can't move a task into an existing project by name mid-line | The heading is the only way to say where something goes |
| The history can't be deleted from inside the app | Not planned for v0; the JSON backup shows everything |

## Deliberately NOT in this block

| Not yet | Comes in |
|---|---|
| Claude, `POST /api/extract`, the access code and the size limit | Block 5 |
| Today's grouping, overdue, keyboard shortcuts | Block 6 |
| Editing which project a proposed task goes to, from the sheet | Not planned — move it afterwards, or untick and redo |
