# Laan: v0 plan

> **Laan** (Tagalog, from *ilaan*) means *to set aside, to reserve*. Tagline: **Set the time aside.**
> A booking system for a one-person service business. This document is v0 in full. The versions
> after it are sketched in [ROADMAP.md](ROADMAP.md).

## Goal

Take a trainer from a paper diary to Laan on their phone, with nothing to sign up for.

They add their services and their hours once. Then, every time a client messages them, they open
the day, tap a free slot, type a name, and paste a confirmation back into the chat. The app refuses
double bookings, shows the gaps, and knows what today looks like.

No clients touch it in v0. No server. Both are v1. What v0 has to get right is **time**: a booking is
an instant, hours are wall-clock, and the function that turns one into the other has to be correct on
the two days a year when the clocks change.

## Who it's for, in one scene

Ren runs a small strength studio, alone. Bookings come in over Messenger, all day, in half-sentences.
Ren keeps them in a paper diary and in their head, and about once a month two people turn up at three.

With Laan v0: a message arrives, Ren opens Tuesday, sees the gap at three, taps it, picks *Strength
session*, starts typing "Ju…", picks Juan from last week, and taps Book. Then **Copy confirmation**,
paste, send. Twelve seconds, and Tuesday at three is taken for anyone else who asks.

That scene is the whole of v0. Every block is a piece of it.

## Look and feel: "the appointment book"

A paper diary with a time ruler down the side, in the same warm-paper family as Tipon.

| Page | Route | What it's for |
|---|---|---|
| **Today** | `/` | What's next, who's coming, the gaps, yesterday's unmarked bookings, this week's count |
| **Day** | `/day/[date]` | The ruler. Bookings as blocks, free time blank, tap a gap to book. A week strip on top |
| **Clients** | `/clients`, `/clients/[id]` | Everyone who has ever booked, with their history, notes and no-show count |
| **Services** | `/services` | What can be booked: name, minutes, buffer, price, colour |
| **Hours** | `/hours` | Windows per weekday, and days off |
| **Backup** | `/backup` | Export and Import as a JSON file |

- **Phone first, thumb first.** The trainer is between sessions with a phone in one hand. A bottom bar
  holds **Today · Day · Clients**. Services, Hours and Backup sit behind a *More* item; they're set up
  once and rarely opened again. On desktop the same six are a slim left rail.
- **The ruler is the interface.** A block's height is its minutes. A 60-minute booking is twice a
  30-minute one. Buffers show as a hatched tail. The current time is a thin highlighter line.
- **Colour:** one of six fixed service colours per service, warm paper behind, ink text. The colours
  are CSS variables from day one, so dark mode is a later change, not a rewrite.
- **Type:** a serif for headings, a clean sans-serif for everything else. Same as Tipon.
- **Keyboard on desktop:** <kbd>T</kbd> <kbd>D</kbd> <kbd>C</kbd> <kbd>S</kbd> <kbd>H</kbd> <kbd>B</kbd>
  jump to pages; <kbd>[</kbd> and <kbd>]</kbd> move a day back or forward on the Day page. Never
  while typing.

## How we work (same as Tipon)

- **Six small blocks.** Each one does one thing and ends with a working, deployed app.
- **Jest checks everything.** A block is done when `npm test` passes locally and in CI.
- **Stop after each block.** Notes go in `docs/blocks/block-N.md`: what was built, ideas to take
  away, the bugs planted to prove the tests work, what was checked in a real browser, known limits,
  and what was deliberately left out.
- **Two time zones in every run.** `Asia/Manila` (UTC+8, never changes) and `America/New_York`
  (changes twice a year). The environments are in `src/test/`.

## Stack

Already in the repo. Next.js 16 (App Router), React 19, Tailwind 4, TypeScript, Jest 30 + Testing
Library, Zod, GitHub Actions, Vercel. Read `node_modules/next/dist/docs/` before writing code.

**One decision is open: the date library.** Default is the platform — `Intl.DateTimeFormat` with
`formatToParts` to go from an instant to wall-clock parts in a zone, and a small function of our own
to go the other way. `Temporal` is used if Node 24 and the browsers we target ship it unflagged; if
not, the wrapper stays small enough to read in one sitting. No `moment`, no `date-fns-tz`, no
`luxon`, unless Block 1 proves the platform can't do it. It's the first hour of Block 1.

## The data in v0

```ts
type Instant  = string;   // ISO 8601 in UTC, "2026-10-20T07:00:00.000Z". Sorts as a string.
type DayKey   = string;   // "YYYY-MM-DD", a calendar day in the provider's time zone
type WallTime = string;   // "HH:MM", 24-hour, in the provider's time zone
type Minutes  = number;   // whole, positive

Settings  timeZone: string (IANA, "Asia/Manila") · slotStep: 15 | 30 | 60 · minNoticeMinutes · maxDaysAhead
Service   id · name · minutes · bufferMinutes · price: number | null (integer centavos) · colour: 1–6 · status: active | archived · createdAt · updatedAt
Hours     Record<Weekday 0–6, Window[]>   where   Window = { start: WallTime, end: WallTime }
DayOff    day: DayKey · reason: string
Client    id · name · phone: string | null (canonical, see Block 4) · email: string | null · notes · status: active | archived · createdAt · updatedAt
Booking   id · serviceId · clientId · startsAt: Instant · endsAt: Instant · status: booked | done | cancelled | no-show · note · override: boolean · createdAt · updatedAt
Workspace settings · services · hours · daysOff · clients · bookings
```

Six kinds of record and one bag that holds them. In v1 each becomes a table.

### Time: instants for bookings, wall-clock for hours

A booking at 3:00 pm on 20 October in Manila is `2026-10-20T07:00:00.000Z`. That's a fixed moment. If
the trainer moves to Sydney and changes `timeZone`, the booking is still that moment, and the diary
shows it at 6:00 pm, which is right: the client in Manila is still coming at three.

Hours are `09:00`–`18:00` on Mondays. That's *not* a fixed moment; it's "nine in the morning wherever
the studio is". Move to Sydney and Monday still opens at nine. So hours are strings, resolved to
instants only when a specific day is being looked at.

The function that does the resolving is the heart of Block 1:

```
wallToInstant(day: DayKey, time: WallTime, zone) → Instant
instantToWall(instant, zone) → { day: DayKey, time: WallTime, weekday }
```

And the two edge cases, which only exist in zones that change their clocks:

| Case | Example, `America/New_York` | What we do |
|---|---|---|
| The time doesn't exist | 8 March 2026, `02:30` (the clocks jump from 01:59 to 03:00) | Resolve to the **next instant that does exist**, 03:00. A window `02:00–04:00` is one hour long that day |
| The time exists twice | 1 November 2026, `01:30` (the clocks go back from 01:59 to 01:00) | Resolve to the **first** occurrence, and **never offer a slot whose wall-clock time is ambiguous**: a confirmation that says "1:30 am" would mean two different moments. A window `01:00–04:00` is four real hours that day, and only `02:00` onward is bookable |

Manila has neither case, ever. That's why it can't be the only zone tested.

### `freeSlots`: the function everything calls

```
freeSlots(workspace, serviceId, day: DayKey, now: Instant) → Instant[]
```

The instants a booking for that service could start on that day. Every screen calls it, and in v1
the public page and the API call the same function. It has to be pure, fast, and right.

1. If `day` is a day off, or the service is archived, return `[]`.
2. Take the windows for `day`'s weekday. For each, resolve `start` and `end` to instants with the
   rules above.
3. Walk from `start` in steps of `slotStep`. Each candidate `t` is a slot if:
   - `[t, t + service.minutes)` sits inside the window (the buffer may spill past closing time; it's
     clean-up, not a session);
   - `[t, t + minutes + buffer)` doesn't intersect `[b.startsAt, b.endsAt + bufferOf(b))` for any
     booking `b` that isn't cancelled. Touching is fine; one minute of overlap isn't;
   - `t ≥ now + minNoticeMinutes`;
   - `day ≤ today(now, zone) + maxDaysAhead`.
4. Return them in order.

`bufferOf(b)` is the buffer of `b`'s service *as it is now*. A service whose buffer grows pushes
neighbouring slots out; that's the intended reading. A service whose `minutes` change does **not**
move existing bookings, because `endsAt` is stored, not computed.

### The rules the engine enforces

| Rule | Detail |
|---|---|
| No overlap | As in `freeSlots`, and checked again on `booking/add` and `booking/move`, because a screen can be stale |
| Inside hours | The booking sits inside one window of that weekday. **Overridable** |
| Not a day off | **Overridable** |
| Not in the past | At least `minNoticeMinutes` after `now`. Applies to adding and moving. Not overridable in v0 (a walk-in "now" is handled by `minNoticeMinutes: 0`) |
| Not too far ahead | No further than `maxDaysAhead`. **Overridable** |
| End follows start | `endsAt = startsAt + service.minutes`, set by the reducer, never by the caller |
| Cancel, never delete | Bookings only change status. A client or service with any booking, cancelled included, can only archive |
| Done and no-show can be undone | Both revert to `booked`, but only while it's still the same calendar day in the provider's zone. A mis-tap between sessions is common; rewriting last month isn't allowed |
| An archived service can't be booked | Existing bookings keep it, and keep its colour |
| Client names are trimmed, notes are kept as typed | Same as Tipon |

The `override` flag is on the action and stored on the booking, so the Day page can mark a booking
that sits outside the hours. Clients booking through the link in v1 will never be able to set it.

### The action list, which becomes the v1 API

```
settings/set        timeZone, slotStep, minNoticeMinutes, maxDaysAhead (each optional; all or nothing)
service/add         ──► service/edit ──► service/archive ⇄ service/unarchive        service/delete (no bookings only)
hours/setWindows    weekday, windows[]  (sorted, non-overlapping, start < end, on the slot grid)
dayOff/add          ⇄ dayOff/remove
client/add          ──► client/edit ──► client/archive ⇄ client/unarchive           client/delete (no bookings only)
booking/add         ──► booking/move ──► booking/cancel
                        booking/done ⇄ booking/reopen · booking/noShow ⇄ booking/reopen
```

Every action carries its own `id` and `now`. The reducer never calls `crypto.randomUUID()` or
`Date.now()`. When an action is refused or changes nothing, the reducer returns **the same object it
was given**, and tests check that with `toBe`. Every type is `readonly`, and one test deep-freezes a
workspace and runs every kind of action against it.

## Blocks

**Progress:** Block 1 ⬜ · Block 2 ⬜ · Block 3 ⬜ · Block 4 ⬜ · Block 5 ⬜ · Block 6 ⬜

| # | Block | What we build | What you learn | How Jest checks it |
|---|---|---|---|---|
| 1 | **Booking engine** | Time functions, `freeSlots`, the types, the rules, the reducer. No screens | Instants vs wall-clock. Slot arithmetic on the days the clocks change. A reducer with no clock in it | See below. The biggest test file in the app |
| 2 | **Day and week** | App shell, Day page with the ruler, week strip, Services page, Hours page. Data in memory | Rendering time as layout. Dynamic routes. One provider owns the state; screens only draw and dispatch | Heights, the ruler's range, empty days, the strip, forms that refuse bad hours |
| 3 | **Saved on this device** | Storage behind an interface, a versioned save file, Export and Import | Hydration, validating what you load, versioning data so v1 can migrate it | Round trips; nothing is wiped silently |
| 4 | **Booking by hand** | Tap a gap → the booking sheet; client matching; Clients pages; cancel, move, done, no-show, undo; the override switch | Forms that can only submit valid states; matching messy phone numbers; undo with a deadline | The sheet never offers a taken slot; "Juan" is "juan "; reverting after midnight is refused |
| 5 | **Share the booking** | Copy confirmation (English and Tagalog, per client, in the client's zone); Add to calendar (`.ics`) | Generating files in the browser; iCalendar; one instant rendered in two zones | Exact text; a valid `.ics` with a stable `UID` |
| 6 | **Today + release** | Today page, shortcuts, welcome, phone pass, README, tag `v0` | Derived data; what "shipped" means for someone running a business on it | Today across midnight in Manila; cancelled never counts; shortcuts don't fire while typing |

### Block 1 — Booking engine

**Files.**

| File | What it is |
|---|---|
| `src/lib/time/wall.ts` | `wallToInstant`, `instantToWall`, `dayKeyOf`, `addDays`, the DST rules above |
| `src/lib/time/wall.test.ts` | Runs in New York. Also `wall.manila.test.ts` at UTC+8 |
| `src/lib/booking/types.ts` | Every type above, `emptyWorkspace`, `WEEKDAYS` |
| `src/lib/booking/rules.ts` | `findOverlap`, `isInsideHours`, `findWindowsProblem`, `findServiceNameProblem`, `canonicalPhone` (used in Block 4, written here) |
| `src/lib/booking/freeSlots.ts` | The function above |
| `src/lib/booking/reducer.ts` | `BookingAction` and `bookingReducer` |
| `src/lib/booking/selectors.ts` | `bookingsOn(day)`, `activeServices`, `clientById`, sorted and memo-friendly |

**Tests that matter most.**

- A `09:00–17:00` Sunday in `America/New_York`: on **7 March 2026** the first slot is `14:00Z`
  (9:00 am EST); on **8 March 2026** it's `13:00Z` (9:00 am EDT). A fixed-offset calculation gets one
  of the two wrong. 15 slots each day at a 30-minute step for a 60-minute service.
- A `01:00–04:00` window across the change. **8 March**: two real hours (1:00–1:59 EST, then
  3:00–3:59 EDT), three slots, and none of them reads `2:30`. **1 November**: four real hours, but
  only `2:00`, `2:30` and `3:00` are offered; nothing between 1:00 and 2:00, because those times
  happen twice.
- Overlap at every edge: a booking `15:00–16:00` with a 10-minute buffer blocks `15:30`, `16:00` and
  `16:05`, and allows `16:10` and `14:00`. Touching is allowed; one minute isn't.
- A 30-minute step never offers `09:15`. A 15-minute step does.
- A cancelled booking frees its slot. A no-show doesn't (they might still turn up late — v0 decision,
  see the table).
- `minNoticeMinutes: 60` at `14:30` hides `15:00` and offers `15:30`.
- Windows: `09:00–12:00, 13:00–18:00` is fine; `09:00–12:00, 11:00–18:00` is refused; `18:00–09:00`
  is refused; `09:10–12:00` is refused on a 30-minute step.
- `booking/add` with a stale slot (taken since the screen was drawn) is refused, same object back.
- Every action against a deep-frozen workspace.

**Planted bugs.** Off-by-one in overlap (`<=` for `<`); `endsAt` computed from the *current* service
minutes on move; forgetting to exclude cancelled bookings; DST handled by adding 24 hours to get
"tomorrow". Each one must turn a test red before it's fixed.

**Deliberately not in Block 1:** screens, storage, ids from anywhere but the action.

### Block 2 — Day and week

**Files.** `src/components/shell/AppShell.tsx` (bottom bar and rail), `src/lib/booking/store.tsx`
(one provider, `useWorkspace`, `useDispatch` with a helper that stamps `id` and `now` onto actions),
`src/components/day/DayScreen.tsx`, `Ruler.tsx`, `BookingBlock.tsx`, `WeekStrip.tsx`,
`src/components/services/ServicesScreen.tsx`, `ServiceForm.tsx`,
`src/components/hours/HoursScreen.tsx`, `WindowsEditor.tsx`, `DaysOff.tsx`. Routes: `/day/[date]`,
`/services`, `/hours`. The home page redirects to today's Day page until Block 6.

**The ruler.** Starts at the first window's start and ends at the last window's end for that weekday,
rounded outward to the hour; a day with no windows shows 08:00–18:00 and says "No hours on Sundays".
One pixel per minute at phone width, so a 60-minute block is 60 px tall and the whole 9-to-6 day is a
comfortable scroll. Bookings are absolutely positioned by `instantToWall(startsAt).time`. Overlaps
can't happen (the engine refuses them), so there's no column layout to build.

**`[date]` is a DayKey.** A bad one (`2026-02-30`, `hello`) shows a small "That's not a day" page
with a link to today, not a crash. Next 16's typed routes and `notFound()`; check the docs.

**Tests.** A 60-minute block is twice the height of a 30-minute one; the ruler's range follows the
windows; an empty day says so; the strip jumps and marks today; the service form refuses a blank name,
a duplicate, 0 minutes, and a price with decimals typed as `150.5` (it's centavos, stored as `15050`);
the windows editor refuses overlaps and shows the reason from `findWindowsProblem`.

**Deliberately not in Block 2:** booking anything. Tapping a gap does nothing yet. Persistence.

### Block 3 — Saved on this device

Tipon's Block 3, second time round. Lift `src/lib/storage/` from Tipon as the starting point and
write down what changed.

- `Storage` interface: `load(): string | null`, `save(text)`, `keep(name, text)`, `listKept()`.
  `localStorage` in the app, a `Map` in tests.
- Save file: `{ version: 1, savedAt: Instant, workspace }`, checked with Zod on every load. The
  schema is strict about shapes and permissive about unknown keys, so a v0.1 file loads in v0.
- Anything unreadable is copied to `laan.kept.<savedAt or now>` and listed on `/backup` with the
  reason. Nothing is thrown away quietly.
- Export writes the same file with a `laan-2026-10-20.json` name. Import runs the same validation,
  then asks: **replace** the current diary (the current one is kept aside first) or **cancel**.
  Merging is not offered; two diaries with the same slot booked twice is not a problem worth having.
- Two tabs: Tipon found the 183-writes bug in a real browser. Bring its fix (remember what's on
  disk, don't write it again) and its tests from day one.
- Hydration: the first render must match the server's, which has no `localStorage`. A `WorkspaceGate`
  shows nothing until the client has loaded, same pattern as Tipon.

**Tests.** Round trip; a corrupted file, an unknown version and a bad import each keep a copy and say
so; import replaces and keeps the old one; two tabs converge without a write storm (count the writes).

### Block 4 — Booking by hand

The scene from the top of this document, built.

**The booking sheet.** Tap a gap on the Day page: a sheet slides up with the tapped time already
chosen. Pick a service; the time list re-filters to `freeSlots` for that service (a longer service
hides slots it no longer fits in). Type a client name or phone; matches appear from the third
character; pick one or keep typing to create a new client. Optional note. **Book.** If the slot was
taken meanwhile (another tab), the sheet says so and re-filters instead of failing silently.

**Client matching.** By canonical phone first, then by name, trimmed and case-folded.

```
canonicalPhone("0917 123 4567")   → "+639171234567"
canonicalPhone("+63 917-123-4567") → "+639171234567"
canonicalPhone("09171234567")      → "+639171234567"
canonicalPhone("+1 212 555 0100")  → "+12125550100"
canonicalPhone("juan")             → null
```

Digits only; a leading `0` followed by ten digits is a Philippine mobile number and becomes `+63…`;
a leading `63` becomes `+63`; anything else with 7–15 digits keeps its digits behind a `+`. The
default country is a v0 constant, not a setting, and it's the Philippines. Stored canonical, shown
as typed the first time (`displayPhone` formats `+63…` back to `0917 123 4567`).

**The client pages.** `/clients` lists active clients by name with their next booking and a no-show
count. `/clients/[id]` shows notes, phone, email, and every booking newest first, with status. Archive
from here.

**Managing a booking.** Tap a block on the Day page: a sheet with the client, service, time, note, and
four actions — **Done**, **No-show**, **Move** (opens the slot list for that service, on any day),
**Cancel** (asks once). Done and No-show show an **Undo** for the rest of that day, as the engine
allows.

**Override.** A switch on the booking sheet, off by default: *Outside my hours*. When on, the slot
list also offers times outside the windows and on days off, on the grid, marked. The booking is drawn
with a dotted outline on the Day page. The switch never appears in the v1 public page.

**Tests.** The sheet never offers a taken slot; changing the service re-filters; the third character
shows matches; a phone typed three ways finds the same client; booking a stale slot shows the message
and doesn't dispatch; Undo after midnight in Manila is not offered and the action is refused; the
override switch adds out-of-hours slots and marks the booking.

**Deliberately not in Block 4:** recurring bookings, a client booking themselves, any notification.

### Block 5 — Share the booking

Bookings in this business are confirmed in a chat, and that stays true after v1. So v0 makes the
confirmation a one-tap paste, and the calendar entry a one-tap download.

**Copy confirmation.** On the booking sheet. Builds a message from a template and puts it on the
clipboard with `navigator.clipboard.writeText`; a fallback shows the text selected for a long press
where the clipboard API isn't available.

```
Hi Juan! Confirmed: Strength session
Tuesday 20 October, 3:00–4:00 pm (Manila time)
See you at the studio.
```

- Two templates, English and Tagalog, chosen **per client** (a field on `Client`, default English).
  The trainer can edit both templates on `/services` (they're per provider, not per service; the
  page is just where setup lives). Placeholders: `{name}`, `{service}`, `{day}`, `{time}`, `{zone}`,
  `{studio}`.
- If the client has a `timeZone` set (optional field, Block 5 adds it), the time is rendered in
  theirs, and the studio's is added in brackets. Two zones, one instant, side by side. This is the
  one place in v0 where the instant-based design pays off visibly.

**Add to calendar.** Downloads `laan-<id>.ics`:

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Laan//v0//EN
METHOD:PUBLISH
BEGIN:VEVENT
UID:booking-<id>@laan
DTSTAMP:<now, UTC>
DTSTART:20261020T070000Z
DTEND:20261020T080000Z
SEQUENCE:<number of moves>
SUMMARY:Strength session — Juan
DESCRIPTION:<the note>
END:VEVENT
END:VCALENDAR
```

`DTSTART` in UTC, so every calendar app shows it at the right local hour. A stable `UID`, so
importing the file again after a move **updates** the event instead of duplicating it; `SEQUENCE`
counts moves for the same reason (one more field on `Booking`, incremented by `booking/move`). Lines
end in CRLF and fold at 75 octets, because that's the spec and Google Calendar is strict about it.

**Tests.** The exact English and Tagalog text for a Manila client; the same booking for a client in
`Australia/Sydney` shows `6:00–7:00 pm (Sydney time, 3:00 pm in Manila)`; the `.ics` line by line;
folding on a long note; `SEQUENCE` goes up on move; the clipboard is a fake and the text is asserted.

**Deliberately not in Block 5:** sending anything. No email, no SMS, no Messenger API. v1 and v1.5.

### Block 6 — Today, and the v0 release

**Today** (`/`), computed by one pure function `buildToday(workspace, now)`:

| Section | What's in it |
|---|---|
| **Now / Next** | The booking in progress, or the next one today, with the client, the time, and how long until it |
| **Today** | Every booking today in order, each with Done and No-show buttons where you stand |
| **Gaps** | Free stretches today long enough for the shortest active service |
| **Did they come?** | Yesterday's bookings still marked `booked`. Two taps clears the list, and the no-show counts stay honest |
| **This week** | Bookings this week (Mon–Sun in the provider's zone), and revenue if prices are set: done bookings only, at the price the service has now |

Then the release pass: keyboard shortcuts, a first-run welcome that leaves once there's a service,
the phone-width pass on every page, the README rewritten for what was actually built,
`docs/RELEASE.md` run top to bottom, tag `v0`.

**Tests.** Today at 11:59 pm and 12:01 am in Manila; a booking at 11:30 pm–12:30 am belongs to the
day it starts; cancelled bookings never count anywhere; "Did they come?" is empty when yesterday was
a day off; revenue ignores no-shows and cancellations; shortcuts don't fire in an input, a textarea,
or with a modifier held.

## Decisions

| Decision | Default | Decide before | Status |
|---|---|---|---|
| Name | **Laan**. Also considered: **Tipan** (*tipanan* = an appointment), **Takda** (*to set a time*) | Now (the repo) | ⬜ |
| Look and feel | The appointment book. Alternatives in the roadmap: *Front desk*, *Card stack* | Block 2 | ⬜ |
| Date library | The platform. A wrapper of our own only if it can't do it | Block 1, first hour | ⬜ |
| How time is stored | Bookings as UTC instants; hours as wall-clock strings; one `timeZone` in Settings | Block 1 | ⬜ |
| Nonexistent and repeated wall-clock times | Next existing instant; first occurrence | Block 1 | ⬜ |
| Slot step | 30 minutes by default; 15 and 60 in Settings. Windows must sit on the grid | Block 1 | ⬜ |
| Buffers | Per service, after the booking only. May spill past closing time | Block 1 | ⬜ |
| A no-show's slot | Stays taken. They might be late; the trainer can cancel it to free the time | Block 1 | ⬜ |
| Removing bookings | Cancel only. Services and clients archive; delete only with no bookings | Block 1 | ⬜ |
| Undo for Done and No-show | Same calendar day only | Block 1 | ⬜ |
| Prices | Optional, integer centavos, one currency (₱) in v0. Revenue on Today from done bookings at today's price | Block 1 | ⬜ |
| Phone numbers | Canonical E.164-style strings; default country Philippines; matching by phone before name | Block 4 | ⬜ |
| Import | Replace, keeping the old diary aside. No merge | Block 3 | ⬜ |
| Confirmation languages | English and Tagalog templates, chosen per client | Block 5 | ⬜ |
| Client time zone | Optional per client, used only for the confirmation text | Block 5 | ⬜ |
| AI in v0 | **No.** Paste-a-chat comes in v1.5 with a review sheet worth building | — | ⬜ |
| Where the code lives | Its own repository, `laan`, sibling of `tipon` | Now | ⬜ |

## Known limits of v0 (on purpose)

| Limit | Why | Plan |
|---|---|---|
| Clients can't book themselves | No server | v1 |
| The phone and the PC are two diaries | Saved per browser | Export/Import; v1 makes the server the truth |
| Clearing browser data erases the diary | Same | Keep a backup; v0.5 asks for durable storage |
| No reminders, no messages sent | Nothing runs when the app is closed; no server to send from | v1 for confirmations, v1.5 for reminders |
| One provider, one location, one currency | By design | v2, v3 |
| The override can't bypass "not in the past" | Backdating a booking that happened is a record-keeping feature, not a booking one | Revisit if a trainer asks |

## Deliberately NOT in v0

| Not yet | Comes in |
|---|---|
| A public booking page, a database, accounts | v1, v2 |
| Emails of any kind | v1 (confirmations), v1.5 (reminders) |
| Payments, deposits, no-show fees | v2.5 |
| Group classes, a second trainer, recurring bookings, Google Calendar | v3 |
| AI | v1.5 |
| Dark mode | After v0; the colours are already variables |
| Search across clients and notes | After v0 |
| Rooms and equipment as bookable resources | Not planned |

## How we'll know v0 worked

1. A trainer's real week — services, hours, twenty bookings — entered on a phone in under fifteen minutes.
2. The app refuses a double booking and an out-of-hours booking, and lets the override through when asked.
3. A confirmation pasted into Messenger reads like a person wrote it, and the `.ics` opens in Google Calendar at the right hour.
4. Export on the phone, import on a PC: the same week.
5. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` green in CI, with the New York tests among them.

## Rules carried over from Habibit, Sipat and Tipon

- **Every write goes through one reducer.** Its action list becomes the v1 API.
- **The reducer never reads the clock or invents an id.** Both are passed in.
- **Derived data is computed, not stored.** "Free" and "next" are asked each time.
- **Day keys use local calendar parts in the provider's zone**, never `toISOString()`.
- **Swappable parts sit behind interfaces:** storage in Block 3, the clipboard in Block 5.
- **A component either draws something or runs an effect**, not both.
- **Test devices:** Android and desktop Chrome must pass. iOS should work but never blocks a release.
- **Next.js 16 differs from older guides.** Read `node_modules/next/dist/docs/` before writing code.

## Two rules new to this app

- **Phone numbers are personal data.** Never in logs, error messages, URLs, or fixtures that look
  real. Fixtures use `0900 000 0001` and the like.
- **The rules are checked twice.** `freeSlots` filters what a screen offers, and the reducer refuses
  what a stale screen sends anyway. In v1 the database becomes the third check.
