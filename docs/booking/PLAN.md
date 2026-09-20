# Laan: the plan, version by version

> **Laan** (Tagalog, from *ilaan*) means *to set aside, to reserve*. Tagline: **Set the time aside.**
> A booking system for a one-person service business — a personal trainer, a barber, a massage
> therapist, a tutor, a clinic with one doctor — built the way Tipon was: small blocks, every one of
> them tested and live.

This is the fourth app in the series after Habibit, Sipat and Tipon. It lives here until its own
repository exists; then this file becomes that repo's `docs/PLAN.md` and the later versions get their
own `PLAN-v1.md`, `PLAN-v2.md` and so on, the way Tipon's `PLAN-v0.5.md` did.

## Why a booking system

Two things Tipon never had to face, and this app can't avoid:

1. **Other people use it.** A client books through a link, and the trainer sees it. That means a
   server that's always on, one source of truth, and two people who can want the same slot at the
   same second.
2. **Time is the whole product.** Tipon stored days. Laan stores *instants*: 3:00 pm for a trainer in
   Manila is 11:00 pm the night before for a client in Los Angeles, and a wrong answer here is a
   missed appointment, not a task in the wrong column.

Both are what the versions are built around. v0 gets the time right with no server. v1 adds the
server and the link. Everything after that is a business feature on top of a base that's already
proven.

The running example in this document is **a personal trainer with a small studio**. Nothing in the
design is trainer-specific; the same app books haircuts.

## The versions

| Version | Name | One line | The new hard thing |
|---|---|---|---|
| **v0** | The appointment book | The trainer's diary, on their phone. Services, hours, bookings entered by hand, no server, no account | Time zones and slot arithmetic. The booking engine as a pure reducer |
| **v0.5** | On the home screen | Installable, opens with no signal. The same Progressive Web App work as Tipon v0.5 | Service workers, the update prompt, durable storage — a second time, to make it stick |
| **v1** | The booking link | A database and a public page. Clients pick a slot and book; the trainer gets an email. One provider, protected by a passcode | Postgres, migrations, and **the race**: two clients, one slot, one winner |
| **v1.5** | Reminders and no-shows | Reminder emails the day before; cancel and reschedule from the email; no-show marked in one tap; a waitlist for full days | Scheduled jobs, signed links, and the first AI feature: paste a Messenger thread, get a proposed booking |
| **v2** | Many providers | Accounts. Every provider gets `/book/[handle]`. The v0 backup and the v1 data import cleanly | Authentication done properly, and row-level ownership: nobody ever sees another provider's clients |
| **v2.5** | Money | A deposit at booking, GCash and cards through PayMongo (Stripe abroad). A no-show policy. A ledger | Webhooks, idempotency, and never trusting the browser with an amount |
| **v3** | Classes and teams | Group sessions with a capacity; more than one staff member; recurring bookings; Google Calendar sync | Capacity instead of exclusivity, and syncing with a calendar you don't own |

v0 through v1 is the app. v2 onward is what would make it something other trainers would pay for.
That's deliberately far down the list: a product with paying customers needs the base underneath it
to have been boring for a while.

## Look and feel: "the appointment book"

A paper diary with a time ruler down the side, in the same warm-paper family as Tipon so the two
feel like they came from the same desk.

- **Day page:** a ruler from the first working hour to the last, bookings as blocks on it, free time
  left blank. Gaps are visible, which is the point of a diary.
- **Week strip:** seven small columns across the top of the day page; tap one to jump.
- **Colour:** one colour per service, chosen from a fixed set of six. Today's line is the highlighter.
- **Phone first, thumb first:** the trainer is between sessions, phone in one hand. Every action that
  happens ten times a day (mark done, mark no-show, add a walk-in) is one tap from the day page.
- **Colours are CSS variables from day one.** Dark mode is a later change, not a rewrite.

Two other directions, if this one doesn't feel right:

| Direction | Feels like |
|---|---|
| Front desk | A dense grid, every day visible at once, keyboard-first. For a receptionist with a monitor |
| Card stack | Each booking a card, swipe to mark done. Friendly, less information per screen |

## How we work (same as Tipon)

- **Small blocks.** Each one does one thing and ends with a working, deployed app.
- **Jest checks everything.** No manual QA. A block is done when `npm test` passes locally and in CI.
- **Stop after each block.** Notes in `docs/blocks/block-N.md`: what was built, ideas to take away,
  the planted bugs that proved the tests work, what was checked in a real browser, known limits, and
  what is deliberately not in the block.
- **Every decision has a default and a deadline.** The tables below say what we'll do if nobody
  objects, and the block before which it must be settled.

## Stack

| Piece | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | Same as Tipon. Read `node_modules/next/dist/docs/` before writing code — it differs from older guides |
| Styling | Tailwind CSS 4 | Same as before |
| Language | TypeScript | Same as before |
| Tests | Jest 30 + React Testing Library | Same as before. Two test files run in `America/New_York` this time, not just Asia/Manila — see Block 1 |
| Validation | Zod | Save files, imports, and from v1 on, every request body |
| Dates | The platform: `Intl.DateTimeFormat` and `Temporal` if Node 24 exposes it stable, else a tiny wrapper of our own | Deciding this is Block 1's first job. No `moment`, no `date-fns-tz` unless the platform can't do it |
| Database (v1) | Postgres on Neon's free tier, through Drizzle ORM | A real database, SQL you can read, migrations as files in the repo |
| Email (v1) | Resend, free tier | One API call, and a test mode that doesn't send |
| Payments (v2.5) | PayMongo for GCash, Maya and Philippine cards; Stripe for everywhere else | Decided at v2.5, not before |
| CI | GitHub Actions | Lint, typecheck, tests and build on every push |
| Hosting | Vercel (free tier) | Same as before. Cron for v1.5 reminders |

---

# v0: the appointment book

## Goal

Take a trainer from a paper diary to Laan on their phone, with nothing to sign up for. They add their
services and their hours once. Then, every time a client messages them, they open the day, tap a free
slot, and type a name. The app refuses double bookings, shows the gaps, and knows what today looks
like.

No clients touch it yet. No server. That's v1.

## The data in v0

```
Settings  timeZone (IANA, e.g. Asia/Manila) · slotStep (15 | 30 | 60 minutes) · minNoticeMinutes · maxDaysAhead
Service   id · name · minutes · bufferMinutes · price (integer centavos, optional) · colour (1–6) · status (active | archived)
Hours     weekday (0–6) → windows [{ start "HH:MM", end "HH:MM" }] in the provider's time zone
DayOff    day (YYYY-MM-DD) · reason
Client    id · name · phone (optional) · email (optional) · notes · createdAt · updatedAt
Booking   id · serviceId · clientId · startsAt (ISO instant) · endsAt (ISO instant) · status (booked | done | cancelled | no-show) · note · createdAt · updatedAt
```

Six kinds of record. In v1, each one becomes a table, and `Settings` becomes a row per provider.

**The rule that shapes everything: a booking is an instant, hours are wall-clock.** `startsAt` is a
UTC instant, because 3:00 pm today in Manila is a fixed moment in history. Hours are `"09:00"` to
`"18:00"` on Mondays, because that means "nine in the morning wherever the studio is" and must survive
a trainer moving cities. Turning one into the other, correctly, on a day the clocks change, is Block 1.

## The rules the engine enforces

| Rule | Detail |
|---|---|
| No overlap | A booking's `[startsAt, endsAt + buffer)` may not intersect any other booking's, unless one is cancelled |
| Inside hours | A booking must sit entirely inside one of that weekday's windows, in the provider's time zone |
| Not a day off | A booking may not start on a day off |
| Not in the past | A new booking must start at least `minNoticeMinutes` after `now`. Moving one has the same rule |
| Not too far ahead | No further than `maxDaysAhead` days from today |
| End follows start | `endsAt` is always `startsAt + service.minutes`. It's stored, not computed, because a service can change its length later and existing bookings must not move |
| Cancel, never delete | A booking changes status to `cancelled`. It stays in the client's history. Only a service or client that has no bookings can be deleted; the rest archive |
| Done and no-show are final-ish | Both can be reverted to `booked` — a mis-tap is common between sessions — but only on the same day |

The trainer can **override** "inside hours" and "not a day off" for a booking they enter by hand
(a client who begged for a Sunday). Clients booking through the link in v1 never can. The engine
takes an `override` flag; the UI decides who gets to set it.

## Blocks

| # | Block | What we build | What you learn | How Jest checks it |
|---|---|---|---|---|
| 1 | **Skeleton + booking engine** | Next.js app, Jest, CI, live on Vercel on day one. Then all the logic and no screens: settings, services, hours, days off, clients, and bookings, through one reducer. `freeSlots(day)` — the function the whole app is built on | Instants vs wall-clock time. Slot arithmetic. The reducer never reads the clock or invents an id. Table tests by the dozen | Overlaps at every edge (touching is fine, one minute over isn't); buffers; the same rules in `Asia/Manila` and `America/New_York` **on the DST-change days**; a 30-minute slot step never offers 9:15; the reducer returns the same object when it refuses |
| 2 | **Day and week screens** | App shell in the chosen look. `/day/[date]` with the time ruler and booking blocks; the week strip; a Services page; an Hours page with per-weekday windows and days off. Data in memory, so a refresh wipes it | Rendering time as layout: a block's height is its minutes. Dynamic routes. One provider, many components that only draw | Testing Library: a 60-minute booking is twice the height of a 30-minute one; the ruler starts at the first window; an empty day says so; the week strip jumps |
| 3 | **Saved on this device** | Storage behind an interface (localStorage in the app, a `Map` in tests); a versioned save file checked with Zod; Export and Import as JSON | Same lesson as Tipon Block 3, second time round — which is when it becomes a habit. Lift Tipon's storage module as a starting point and note what changes | Round trip; a corrupted file, an unknown version or a bad import keeps a copy and says so; nothing is wiped silently |
| 4 | **Booking by hand** | Tap a gap on the day page → the new-booking sheet, showing only slots the engine allows for the chosen service. Client picker that reuses an existing client by name or phone. Cancel, move, mark done, mark no-show. The override switch for out-of-hours bookings | Forms that can only submit valid states, because the choices offered were already filtered. Undo for the two most common mis-taps | The sheet never offers a taken slot; picking a longer service hides slots that no longer fit; "Juan" and "juan " are the same client; a no-show reverted after midnight is refused |
| 5 | **Share the booking** | For any booking: **Copy confirmation** puts a ready-to-paste message on the clipboard ("Hi Juan — Tuesday 21 Oct, 3:00–4:00 pm, Strength session, Studio B"), in the client's language of choice per client; and **Add to calendar** downloads an `.ics` file. Both in the client's time zone if it differs from the studio's | Generating files in the browser; the iCalendar format; the same instant rendered in two time zones side by side; templates that a trainer can edit | The exact text, in `Asia/Manila` and for a client in `Australia/Sydney`; the `.ics` has `DTSTART` in UTC and a stable `UID` so re-importing updates instead of duplicating |
| 6 | **Today + v0 release** | The Today page: what's next, who's coming, the gaps, this morning's no-show to mark, the week's count and revenue if prices are set. Keyboard shortcuts on desktop, first-run welcome, the phone-width pass, README, tag `v0` | Derived data, again: nothing on Today is stored. What "shipped" means when the user is a person with a business, not you | Today at 11:59 pm and 12:01 am in Manila; a cancelled booking never counts; revenue ignores no-shows unless the policy says otherwise (a v2.5 question — v0 ignores them); shortcuts don't fire while typing |

### Block 1 in more detail, because it carries the rest

`freeSlots(workspace, serviceId, day, now)` returns the list of instants a booking for that service
could start on that day. It is the one function every screen and, later, the public page and the
API will call. It has to be pure, fast, and right on the days the clocks change.

The test that matters most: **a 09:00–17:00 Sunday in `America/New_York` on 8 March 2026** — the
day that skips 2:00 am — offers the right number of slots, and none of them lands on a time that
doesn't exist. Then the same on 1 November, the day that has two 1:30 ams. Manila never changes
clocks; that's why it can't be the only zone tested.

The action list, which becomes the v1 API:

```
Settings  set (timeZone, slotStep, notice, horizon)
Service   add ──► edit ──► archive ⇄ unarchive           delete (only if no bookings)
Hours     setWindows (weekday) · addDayOff ⇄ removeDayOff
Client    add ──► edit ──► archive ⇄ unarchive           delete (only if no bookings)
Booking   add ──► move ──► cancel · done ⇄ booked · no-show ⇄ booked
```

Every action carries its own `id` and `now`. Same actions in, same workspace out.

### Before Block 1, you'll need

- To choose the date library (default: the platform, see Stack). Spend an hour with
  `Intl.DateTimeFormat(...).formatToParts` and `Temporal` in Node 24 and decide.
- A Vercel project. Nothing else; v0 has no keys and no accounts.

## Decisions

| Decision | Default | Decide before | Status |
|---|---|---|---|
| Name | **Laan**. Also considered: **Tipan** (*tipanan* = an appointment), **Takda** (*to set a time*) | Block 1 (repo and URL) | ⬜ |
| Look and feel | The appointment book | Block 2 | ⬜ |
| Date library | The platform. A wrapper of our own only if it can't do it | Block 1 | ⬜ |
| How time is stored | Bookings as UTC instants; hours as wall-clock strings plus one time zone in Settings | Block 1 | ⬜ |
| Slot step | 30 minutes by default; 15 and 60 available in Settings | Block 1 | ⬜ |
| Buffers | Per service, after the booking only. A before-buffer can come if a real trainer asks | Block 1 | ⬜ |
| Removing bookings | Cancel only. Services and clients archive, and delete only when nothing references them | Block 1 | ⬜ |
| Prices in v0 | Optional, integer centavos, shown on Today as a weekly total. No invoicing | Block 1 | ⬜ |
| AI in v0 | **No.** The first AI feature is v1.5's "paste a chat" proposal, when there's a review sheet worth building | Block 4 | ⬜ |
| Client languages | Confirmation text in English and Tagalog templates, per client | Block 5 | ⬜ |

## Known limits of v0 (on purpose)

| Limit | Why | Plan |
|---|---|---|
| Clients can't book themselves | No server | v1 |
| The phone and the PC are two diaries | Saved per browser | Export/Import; v1 makes the server the truth |
| Clearing browser data erases the diary | Same | Keep a backup; v0.5 asks for durable storage; v1 fixes it |
| No reminders | Nothing runs when the app is closed | v1.5 |
| One provider, one location | By design | v2 for providers, v3 for staff |

## Deliberately NOT in v0

| Not yet | Comes in |
|---|---|
| A public booking page, a database | v1 |
| Emails of any kind | v1 (confirmations), v1.5 (reminders) |
| Accounts | v2 |
| Payments, deposits, no-show fees | v2.5 |
| Group classes, a second trainer, recurring bookings, Google Calendar | v3 |
| AI | v1.5 |
| Dark mode | After v0, the colours are already variables |
| Rooms and equipment as bookable resources | Not planned. If a studio needs it, it's a v3 question |

## How we'll know v0 worked

1. A trainer's real week — services, hours, twenty bookings — entered on a phone in under fifteen minutes.
2. The app refuses a double booking and an out-of-hours booking, and lets the override through when asked.
3. A confirmation pasted into Messenger reads like a person wrote it, and the `.ics` opens in Google Calendar at the right hour.
4. Export on the phone, import on a PC: the same week.
5. The four commands (`lint`, `typecheck`, `test`, `build`) green in CI, and the DST tests among them.

---

# v0.5: on the home screen

**Goal.** Installable, opens with no signal, keeps the diary. The plan is Tipon's `PLAN-v0.5.md`
almost line for line, and doing it a second time is the point: a service worker written once is a
trick, written twice is a skill.

| Block | What it delivers |
|---|---|
| 7. Installable | `app/manifest.ts`, icons including a maskable one, durable storage, iOS install guidance |
| 8. Works with no signal | The service worker with the strategy function tested on its own; the "new version — reload" prompt; never `skipWaiting()` behind the user's back |
| 9. Release | The offline checks added to the release list, tag `v0.5` |

**What's different from Tipon.** Nothing in v0 needs the network, so there's no "honest offline"
screen to build. That makes v0.5 shorter here. Keep it that way.

**Could be skipped** if v1 is more urgent: the diary's real safety comes from the database in v1,
not from durable storage. Default: do it, because it's small and the trainer's phone is the client
from the first day.

---

# v1: the booking link

**Goal.** A client opens `laan.app/book`, picks a service, a day and a slot, types their name and
phone, and taps Book. The trainer gets an email and sees the booking on the day page. Two clients
who want the same slot get one booking and one honest "just taken" message. Still one provider,
who signs in with a passcode.

This is the version where the data leaves the phone. The v0 reducer's action list becomes the API,
and every action that exists as a function today becomes a Server Action or a Route Handler with the
same name and the same tests, plus a database underneath.

## Blocks

| # | Block | What we build | What you learn | How Jest checks it |
|---|---|---|---|---|
| 10 | **Database + the import** | Drizzle schema from the v0 types; migrations in the repo; a repository interface with two implementations, Postgres and in-memory; the v0 backup imports into the database | Migrations as code review; the repository seam so most tests never touch Postgres; a real database on your laptop with one command | The in-memory repository passes the same suite as Postgres (run against a local Postgres in CI); a v0 backup imports and re-exports identical |
| 11 | **The provider signs in** | A passcode in the environment, a signed session cookie, and a request filter in `proxy.ts` (Next 16's name for middleware — check the docs) that keeps `/day`, `/services` and the rest behind it. Rate-limited | Sessions without a user table; signing and verifying; what a cookie must and must not contain | A wrong code is refused and counted; a tampered cookie is a stranger; the public `/book` page needs no cookie |
| 12 | **The public page** | `/book`: services → a month of days with free ones marked → the slots → name and phone → confirm. Slots come from the same `freeSlots` as v0, in the client's own time zone with the studio's shown beside it | Server components for the read path; the client's time zone from the browser; forms that survive a slow connection | The slot list matches `freeSlots`; a service with no free days says so; the whole flow with Testing Library |
| 13 | **The race** | Booking is one transaction, and the database is the referee: a `tstzrange` exclusion constraint on `(provider, [startsAt, endsAt + buffer))` for non-cancelled bookings. The app checks first for a friendly message; the constraint decides for real | Why the check in code is not enough; what an exclusion constraint is; how to test a race deterministically | Two inserts for one slot, run in parallel against local Postgres: exactly one succeeds, every time, a hundred runs |
| 14 | **Emails + release** | Confirmation to the client and the trainer through Resend, with the `.ics` attached; a honeypot and rate limit on `/book`; the release list grows a section for the server; tag `v1` | Sending email from a server without becoming a spammer; what to log and what never to log (phone numbers) | The email body from Block 5's template; Resend is mocked; the honeypot catches a bot; the rate limit holds |

## Decisions to take before v1

| Decision | Default | Decide before |
|---|---|---|
| Database | Neon Postgres, free tier, Drizzle ORM | Block 10 |
| The v0 data | Imported once from a backup, then the server is the truth. No two-way sync, ever | Block 10 |
| Provider auth in v1 | A passcode, like Tipon's access code. Accounts are v2 | Block 11 |
| Client identity | None. Name and phone on every booking, matched to a client record by phone | Block 12 |
| What a client can do after booking | Nothing yet. Cancel and reschedule links are v1.5 | Block 12 |
| Double-booking protection | The database constraint, not just the code | Block 13 |
| Email provider | Resend | Block 14 |

## Deliberately NOT in v1

| Not yet | Comes in |
|---|---|
| Reminders, cancel/reschedule links, waitlist | v1.5 |
| More than one provider, real accounts | v2 |
| Deposits | v2.5 |
| SMS | Not planned until a trainer says email isn't enough. In the Philippines that may come fast — Viber and Messenger are where bookings actually happen — so the v0 copy-and-paste confirmation stays even after v1 |

---

# v1.5: reminders and no-shows

**Goal.** Fewer no-shows. A reminder the day before, a link to cancel or move without messaging the
trainer, and a waitlist that fills a cancelled slot. Plus the first AI feature, because by now there
are enough half-sentence Messenger threads ("pwede bukas 3pm? or thurs") to make "paste it, review
it, book it" worth building.

| # | Block | What we build |
|---|---|---|
| 15 | **Reminders** | A Vercel Cron route runs every hour, finds bookings starting in 20–28 hours that have no reminder sent, sends one, records it. Idempotent: run it twice, one email |
| 16 | **Cancel and move from the email** | Signed, expiring links. Cancel needs a confirmation page, not a `GET` that acts. Moving shows the same slots as `/book`. Both respect a per-service cancellation notice (default 12 hours) |
| 17 | **No-shows and the waitlist** | Mark no-show from Today in one tap. A client's no-show count on their card. A "tell me if a slot opens" button on a full day; a cancellation emails the first person waiting with a link that holds the slot for 30 minutes |
| 18 | **Paste a chat** | The Tipon pattern, propose → review → commit: paste a message thread, Claude proposes a booking (service, day, time, client), the trainer checks the sheet and confirms. The rules-only fallback handles "tomorrow 3pm". Same access-code guard as Tipon; the key never leaves the server |

**Decisions before v1.5:** the reminder window (default 24 hours, one reminder); whether a
cancellation inside the notice period is allowed at all (default: allowed, but flagged on the
client's card, and v2.5 can charge for it); the Claude model and a spend limit.

---

# v2: many providers

**Goal.** Laan stops being one trainer's app. Anyone signs up, sets their hours, and gets
`/book/[handle]`. This is the version where a second trainer, a barber, or a physio could use it,
and the first version that could be sold.

| # | Block | What we build |
|---|---|---|
| 19 | **Accounts** | Magic-link sign-in by email (no passwords to lose), with Auth.js or a small implementation of our own — decide by reading both. A `providers` table; every other table gets a `providerId` |
| 20 | **Ownership everywhere** | Every query is scoped by provider, and one test proves it: provider A's session, provider B's booking id, a `404`. Row-level security in Postgres as a second lock |
| 21 | **Handles and the public page** | `/book/[handle]`; a settings page for the handle, the studio name, the address, a logo. The v1 provider migrates into the first account |
| 22 | **Release** | Terms and a privacy note (you hold other people's clients' phone numbers now); a data-export per provider; delete-my-account that really deletes; tag `v2` |

**Decisions before v2:** the auth library; whether handles can change (default: once); which
country's data rules to read first (the Philippines' Data Privacy Act, since that's where the first
users are).

**About money.** v2 is where a pricing question first makes sense, and the answer is written down
here so it doesn't get decided by accident later: free for one provider with one staff member,
forever. Paid tiers, if ever, come with v2.5 and v3 features. Don't build billing before there's
someone to bill.

---

# v2.5: money

**Goal.** A deposit at booking, so a no-show costs the client and not the trainer. The most
sensitive code in the app, and the reason it comes after everything else has been steady for a while.

| # | Block | What we build |
|---|---|---|
| 23 | **A ledger before a payment** | A `payments` table that records intent, status and provider reference, written before any call to a payment provider. Amounts are integers in the smallest unit. Every state change is a new row, never an update |
| 24 | **PayMongo** | GCash, Maya and cards. Checkout created on the server with the amount from the *service*, never from the form. The webhook verifies its signature, is idempotent by event id, and is the only thing that marks a payment paid |
| 25 | **Policies** | Per service: deposit amount, refund on cancel before the notice period, keep it after. Refunds through the provider's API, recorded in the ledger. A no-show is a kept deposit, and the reason is on the client's card |
| 26 | **Release** | Reconciliation: a page that lists the ledger against the provider's dashboard totals; a sandbox run of every path; tag `v2.5` |

**Decisions before v2.5:** PayMongo or Stripe first (default PayMongo, because GCash); whether
deposits are optional per service (default yes); how refunds are timed.

---

# v3: classes and teams

**Goal.** A slot that holds ten people, a studio with three trainers, a client who comes every
Tuesday, and a trainer who lives in Google Calendar.

| # | Block | What we build | The new idea |
|---|---|---|---|
| 27 | **Classes** | A service with a capacity. Bookings against a *session* rather than a slot. The exclusion constraint from v1 becomes a count check inside the same transaction | Capacity, not exclusivity |
| 28 | **Staff** | Providers have staff; each staff member has their own hours; a service can be done by some of them; `/book/[handle]` asks "with whom?" or "anyone" | Availability as a union |
| 29 | **Recurring bookings** | "Every Tuesday at 3 for eight weeks" as one action that creates eight bookings and refuses cleanly if week five is taken | Batches that succeed or fail together |
| 30 | **Google Calendar** | One-way first: every booking appears in the trainer's Google Calendar. Two-way (a Google event blocks a slot) only if one-way has been quiet for a month | Syncing with a system you don't control |

---

## Rules carried over from Habibit, Sipat and Tipon

- **Every write goes through one reducer**, and from v1, every reducer action is an API call with the
  same name.
- **The reducer never reads the clock or invents an id.** Both are passed in.
- **Derived data is computed, not stored.** "Free" is asked each time, never written down.
- **Swappable parts sit behind interfaces:** storage in v0, the repository in v1, the mail sender,
  the payment provider, the calendar. In tests, every one of them is a fake.
- **Test in a time zone that changes its clocks.** Manila keeps you honest about UTC+8; New York keeps
  you honest about DST. Both, every run.
- **Nothing is deleted quietly.** Bookings cancel; records archive; imports keep copies.
- **A component either draws something or runs an effect**, not both.
- **Test devices:** Android and desktop Chrome must pass. iOS should work but never blocks a release.
- **Next.js 16 differs from older guides.** Read `node_modules/next/dist/docs/` before writing code.

## Two new rules for this app

- **Phone numbers are personal data.** They never go in logs, error messages, URLs or test fixtures
  that look real. Fixtures use `0900 000 0001` and the like.
- **The database is the last line of defence, and it's tested as one.** Every rule the code enforces
  about time and money has a constraint underneath it, and a test that breaks the code's check to
  prove the constraint still holds.
