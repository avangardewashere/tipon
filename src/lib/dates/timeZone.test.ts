/**
 * This whole file runs in Manila, UTC+8 — the time zone that catches every "wrong day"
 * bug. Habibit and Sipat were both bitten here. The environment sets the zone before the
 * file is even loaded; see the comment in `src/test/manilaEnvironment.cjs` for why a
 * `process.env.TZ = "…"` line inside a test would do nothing.
 *
 * @jest-environment ./src/test/manilaEnvironment.cjs
 */
import { addDays, dayKeyFromDate, todayKey } from "./calendar";

/** Half past midnight on the 21st in Manila is still the 20th in UTC. */
const JUST_AFTER_MIDNIGHT = new Date("2026-09-20T16:30:00Z");

describe("day keys at UTC+8", () => {
  it("is really running at UTC+8", () => {
    expect(new Date("2026-09-20T16:30:00Z").getHours()).toBe(0);
  });

  it("uses the day you can see on your own wall, not the one in UTC", () => {
    expect(dayKeyFromDate(JUST_AFTER_MIDNIGHT)).toBe("2026-09-21");

    // What we would have got from the shortcut everyone reaches for first:
    expect(JUST_AFTER_MIDNIGHT.toISOString().slice(0, 10)).toBe("2026-09-20");
  });

  it("still says the right day a minute before midnight", () => {
    expect(dayKeyFromDate(new Date("2026-09-20T15:59:00Z"))).toBe("2026-09-20");
  });

  it("means the next morning by 'tomorrow', whatever the hour", () => {
    const lateAtNight = todayKey(new Date("2026-09-20T15:59:00Z").getTime());
    const justAfterMidnight = todayKey(JUST_AFTER_MIDNIGHT.getTime());

    expect(addDays(lateAtNight, 1)).toBe("2026-09-21");
    expect(addDays(justAfterMidnight, 1)).toBe("2026-09-22");
  });

  it("does not drift across a whole year of midnights", () => {
    let key = "2026-01-01";
    for (let i = 0; i < 365; i += 1) {
      const atHalfPastMidnight = new Date(`${key}T00:30:00+08:00`);
      expect(dayKeyFromDate(atHalfPastMidnight)).toBe(key);
      key = addDays(key, 1);
    }
  });
});
