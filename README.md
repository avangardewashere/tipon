# Tipon

**Gather it all. Sort it out.** A project manager that turns a brain dump into projects and tasks.

*Tipon* is Tagalog for *to gather*. Write down everything on your mind in one go, press **Sort it**,
check what it found, and get on with your day.

**v0** — six blocks, 497 tests, and no account to create.

## What it does

| Page | What it's for |
|---|---|
| **Today** | What's overdue, what's due today, the next task in each project, and what's waiting in the Inbox |
| **Dump** | A blank page to empty your head onto. Press *Sort it* and check the review sheet before anything is added |
| **Projects** | Index cards. Open one for its notes and its checklist. Archive the ones you're done with |
| **Inbox** | Tasks that don't belong to a project yet |
| **Backup** | Export everything as a JSON file, and import one back |

On a phone the three main pages sit in a bar under your thumb. On a desktop they're a slim left rail,
and <kbd>T</kbd> <kbd>D</kbd> <kbd>P</kbd> <kbd>I</kbd> <kbd>B</kbd> jump straight to them — except
while you're typing, when the keys are just keys.

## How the sorting works

A dump is read one line at a time:

```
call the bank tomorrow        → Inbox task, due tomorrow
Website relaunch:             → a project (yours is reused if you already have one)
- pick a hosting plan fri     → task in Website relaunch, due this Friday
- write the about page        → task in Website relaunch, no date
```

A line ending in `:` or starting with `#` starts a project; everything else is a task. Date words at
the end of a line — `today`, `tomorrow`, weekday names, `Sep 20` — become due dates. Numeric dates
like `9/10` are left alone, because that's 9 October to half the world and 10 September to the other.

Nothing is added until you say so. The review sheet lets you untick anything, fix a title, or change
a date first.

## Your data

Everything lives **in the browser you use it in**. No account, no server, nothing to sign up for. It
survives refreshes and restarts; it does not follow you to another device, and clearing your browsing
data clears it. **Backup → Export** writes a plain JSON file you can read, keep, and import anywhere.

Anything Tipon can't read — a corrupted file, a backup from a newer version — is copied aside under a
`tipon.kept.…` name and listed on the Backup page. Nothing is ever thrown away quietly.

## Using Claude (optional)

Without a key, Tipon sorts every dump with the rules above, on your device, for nothing.

With one, Claude reads the dump instead, which handles the half-sentences and rambling that rules
can't. To turn it on:

1. Create an API key at [console.anthropic.com](https://console.anthropic.com), and **set a monthly
   spend limit**.
2. Copy [`.env.example`](.env.example) to `.env.local` and fill in `ANTHROPIC_API_KEY` and a
   `TIPON_ACCESS_CODE` you make up.
3. Set the same two variables in your host's environment (Vercel: Settings → Environment Variables),
   and redeploy.
4. Open **Dump → Sorting** and paste the access code.

The key stays on the server and never reaches the browser. Anyone who has the access code can spend
your credits, so keep it to yourself. If Claude can't be reached — wrong code, no network, a reply
that doesn't make sense — the rules sort the dump instead and the page says why.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run the Jest suite once |
| `npm run test:watch` | Re-run tests whenever a file changes |
| `npm run typecheck` | Generate Next.js route types, then type-check with `tsc` |
| `npm run lint` | Run ESLint |
| `npm run build` | Production build |

Next.js 16, React 19, Tailwind 4, TypeScript, Jest + Testing Library, Zod. Deploys to Vercel as-is;
the only environment variables are the two above, and the app works without them.

## How it's built

- **One reducer owns every change.** `src/lib/workspace/reducer.ts` is the whole API of the app, and
  it never invents an id or reads the clock — both are passed in, so the same actions always give the
  same result.
- **Derived data is computed, not stored.** "Overdue" is `due < today`, asked each time the page is
  drawn, so the day can roll over while the app is open.
- **Day keys are `YYYY-MM-DD`, never `toISOString()`.** At UTC+8 that shortcut reports yesterday for
  eight hours a day. Two test files run in Asia/Manila to keep it honest.
- **Propose → review → commit.** The dump parser and Claude both return the same `Proposal`; the
  review sheet doesn't know or care which one wrote it.
- **Swappable parts sit behind interfaces:** storage (a `Map` in tests, `localStorage` in the app)
  and the two things that sort a dump.

## Limits of v0, on purpose

| Limit | The plan |
|---|---|
| One browser at a time; no accounts or sync | Export/Import bridges devices. Accounts in v1 |
| Clearing browser data clears Tipon | Keep a backup |
| Anyone with the access code can spend your AI credits | Keep it private, keep a spend limit. Accounts in v1 |
| No dark mode | After v0 — the colours are already CSS variables |
| No Google Calendar, email brief, or chat | Later, one at a time |

## Documentation

- [docs/PLAN.md](docs/PLAN.md) — the six-block plan and every decision
- [docs/blocks/](docs/blocks/) — notes on each block: what was built, what was learned, the bugs that
  were planted to prove the tests work, and what was deliberately left out
- [docs/RELEASE.md](docs/RELEASE.md) — the checklist for cutting a release
