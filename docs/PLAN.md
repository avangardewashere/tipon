# Tipon: v0 plan

> **Tipon** (Tagalog) means *to gather*. Tagline: **Gather it all. Sort it out.**
> A project manager in the spirit of [buildOS](https://build-os.com): dump everything on your mind,
> and it becomes projects and tasks you can act on. Built with Next.js, with its own look and feel.

## Goal

Take a third app from an empty folder to a live v0, one block at a time. This one is new in two ways:
it keeps real data you'll care about, and in Block 5 it runs code **on a server**.

## What we borrow from buildOS, and what we leave out

buildOS is built with SvelteKit and Supabase. It's chat-first: you talk to it, and panels update.

| buildOS idea | In Tipon v0? |
|---|---|
| A brain dump becomes projects and tasks | ✅ Blocks 4–5: a rule-based parser first, then Claude |
| Projects keep their context | ✅ Block 2: every project has a notes area |
| Daily brief | 🟡 Block 6: a **Today** page worked out on your device. No AI, no email |
| Accounts, sync across devices | ❌ v1 |
| Google Calendar sync | ❌ later |
| Chat with your projects, AI agents | ❌ later |
| Goals, milestones, risks, documents | ❌ later. v0 is projects and tasks only |
| Voice dumps, SMS, billing, teams | ❌ not planned |

## Look and feel: "notebook on a desk"

Where buildOS is a chat-first dashboard, Tipon is **write-first**: calm, paper-like, few boxes.

- **Dump page:** a blank ruled page with no chat bubbles. You write, press **Sort it**, and a review sheet slides up.
- **Projects:** index cards. Open one to see its notes on top and a checklist below.
- **Colour:** warm paper background, ink-dark text, and one highlighter colour for things due today. Thin lines instead of boxes and heavy shadows.
- **Type:** a serif for headings, a clean sans-serif for everything else.
- **Phone first:** a bottom bar with **Today · Dump · Projects** that your thumb can reach on Android. On desktop, the same three sit in a slim left rail.
- **Colours are CSS variables from day one**, so adding dark mode later is a small change.

If this doesn't feel right, two other directions:

| Direction | Feels like |
|---|---|
| Command desk | Dark, dense, keyboard-first, with a `Ctrl+K` command palette (like Linear or Raycast) |
| Soft and friendly | Rounded, pastel, playful wording (closest to Habibit) |

## How we work (same as Sipat)

- **Six small blocks.** Each one does one thing and ends with a working, deployed app.
- **Jest checks everything.** No manual QA. A block is done when `npm test` passes locally and in CI.
- **Stop after each block.** Notes go in `docs/blocks/block-N.md`: what we built, ideas to take away,
  how we know the tests work (planted bugs), what was checked in a real browser, known limits, and
  what is deliberately not in the block.

## Stack

| Piece | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | Same as Habibit and Sipat. Block 5 adds your first server code |
| Styling | Tailwind CSS 4 | Same as before |
| Language | TypeScript | Mistakes show up before the code runs |
| Tests | Jest 30 + React Testing Library | Same as Sipat |
| Validation | Zod (Block 3) | Checks data we didn't just create: saved files, imports, AI replies |
| AI | Anthropic TypeScript SDK (Block 5) | Structured outputs return JSON that matches a Zod schema |
| CI | GitHub Actions | Every push runs lint, typecheck, tests and build |
| Hosting | Vercel (free tier) | Same as before |

## The data in v0

```
Project  id · name · notes · status (active | archived) · createdAt · updatedAt
Task     id · projectId (empty = Inbox) · title · due (YYYY-MM-DD, optional) · doneAt (empty = open) · createdAt · updatedAt
Dump     id · text · createdAt · ids of the projects and tasks it created
```

Three kinds of record. In v1, each one becomes a database table.

## Blocks

**Progress:** Block 1 ✅ ([notes](blocks/block-1.md)) · Block 2 ✅ ([notes](blocks/block-2.md)) · Block 3 ✅ ([notes](blocks/block-3.md)) · Block 4 ✅ ([notes](blocks/block-4.md)) · Block 5 ✅ ([notes](blocks/block-5.md)) · Block 6 ✅ ([notes](blocks/block-6.md))

| # | Block | What we build | What you learn | How Jest checks it |
|---|---|---|---|---|
| 1 | **Skeleton + workspace engine** | Next.js app, Jest, CI, live on Vercel on day one. Then the logic, with no screens yet: add, rename and archive projects; add, edit, complete, move and delete tasks | Model the data before the screens. The reducer's action list becomes the v1 API. IDs and the clock are passed in, so the logic stays pure and tests give the same result every run | Every action; archived projects keep their tasks; an unknown id changes nothing; state is never mutated |
| 2 | **Projects and tasks screens** | App shell in the chosen look; Projects list; a project page (`/projects/[id]`) with notes and tasks; Inbox. Data lives in memory for now, so a refresh wipes it | App Router layouts and dynamic routes; where `"use client"` belongs; one provider owns the state and components only draw | Testing Library adds a project, adds and completes a task, and finds things by role and label; empty states |
| 3 | **Saved on this device** | Storage behind an interface (localStorage in the app, in-memory in tests); a versioned save file; Export and Import as a JSON backup | Hydration: the server has no localStorage, so the first render must match the server's. Validate anything you load. Version your data so v1 can migrate it | Save and load round trip; a corrupted file, an old version or a bad import keeps a copy and tells you. Nothing is wiped silently |
| 4 | **Brain dump + review** | Dump page with a notepad (a half-written dump survives a refresh); a **quick parser** (rules, no AI) turns it into a proposal; a review sheet to edit or untick items before anything is added; a history of past dumps | Parsing text; table-driven tests with `test.each`; **propose → review → commit**, the pattern that makes AI safe in Block 5 | Dozens of messy dumps; date words near midnight at UTC+8; existing project names are reused; only the items you kept get added |
| 5 | **AI brain dump (Claude)** | `POST /api/extract` runs on the server, sends the dump to Claude and gets back the **same proposal shape**, so the review sheet doesn't change. Protected by an access code and a size limit. Falls back to the quick parser if anything fails | Server code vs browser code; keeping an API key secret; treating AI output as untrusted; swapping one implementation for another behind an interface | The Claude SDK is mocked, so tests never spend money: a good reply, a malformed reply, a wrong access code, a dump that's too long, a missing key (falls back) |
| 6 | **Today + v0 release** | Today page: overdue, due today, next task in each active project, Inbox count. Keyboard shortcuts on desktop, a first-run welcome, a phone-width pass, README, v0 tag | Derived data: compute views from state instead of storing them. What "shipped" means beyond "it runs" | Grouping across midnight, month ends and UTC+8; finished tasks never show; shortcuts don't fire while you're typing |

### The quick parser's rules (Block 4)

```
call the bank tomorrow        → Inbox task, due tomorrow
Website relaunch:             → a project (reused if one with that name exists)
- pick a hosting plan fri     → task in Website relaunch, due this Friday
- write the about page        → task in Website relaunch, no date
```

- A line ending in `:` or starting with `#` starts a project. Every other line is a task.
- Date words: `today`, `tomorrow`, weekday names, and month-day dates like `Sep 20`. Numeric dates
  like `9/10` are left alone because they mean different days in different countries.
- Plain rambling ("ugh, the website thing is stuck on hosting") is beyond what rules can handle. That's on
  purpose: in Block 5 you'll see exactly what the AI adds.

### Before Block 5, you'll need

- A Claude Console account with credits, and an API key.
- A monthly spend limit set in the Console.
- To paste the key in yourself: into `.env.local` on your PC and into Vercel's environment variables.
  The key never goes in the code, the repo or the browser.
- Default model: **Claude Opus 5** (`claude-opus-5`). Expect a few US cents per dump. Block 5 will
  measure the real cost. Switching to a cheaper model is your call.

## Decisions

| Decision | Default | Decide before | Status |
|---|---|---|---|
| Name | **Tipon**. Also considered: **Buo** (*whole*; *buuin* = to put together) | Block 1 (repo and URL) | ✅ default kept when Block 1 started |
| Look and feel | Notebook on a desk | Block 2 | ✅ built in Block 2 |
| Where data lives in v0 | This device only, with Export and Import. Accounts and sync come in v1 | Block 3 | ✅ built in Block 3 |
| AI in v0 | Yes, in Block 5. If not, AI moves to v1 and Block 5 becomes Search + a "This week" view | Block 5 | ✅ built in Block 5 |
| AI model | Claude Opus 5 | Block 5 | ✅ `claude-opus-5`, effort `low` |
| Removing projects | Archive only, with unarchive to undo it. Tasks can be deleted | Block 1 | ✅ built in Block 1 |

## Known limits of v0 (on purpose)

| Limit | Why | Plan |
|---|---|---|
| Your phone and PC don't share data | Data is saved per browser | Export and Import bridge the gap; accounts and sync in v1 |
| Clearing browser data erases everything | Same reason | Export a backup; a real database in v1 |
| Anyone with the access code can spend your AI credits | No accounts yet | Keep the code private, set a spend limit; accounts in v1 |

## Deliberately NOT in v0

| Not yet | Comes in |
|---|---|
| Accounts, sync across devices, a real database | v1 |
| Dark mode | After v0 |
| Google Calendar, daily brief email, chat with projects, goals and milestones | Later, one at a time |
| Voice dumps, teams, billing | Not planned |

## Rules carried over from Habibit and Sipat

- **Day keys use local calendar parts**, never `toISOString()`, which gives the wrong day at UTC+8.
- **Every write goes through one reducer.** Its action list becomes the v1 API.
- **A component either draws something or runs an effect**, not both.
- **Swappable parts sit behind interfaces:** storage (Block 3) and extractors (Blocks 4–5).
- **Test devices:** Android and desktop Chrome must pass. iOS should work but never blocks a release.
- **Next.js 16 differs from older guides.** Read `node_modules/next/dist/docs/` before writing code.
