/** @jest-environment node */
import { addDays, dayKeyFromDate, nextMonthDay, nextWeekday, todayKey, toDayKey, weekdayOf } from "./calendar";
import { isDayKey } from "./dayKey";

describe("addDays", () => {
  it.each([
    ["one day", "2026-09-14", 1, "2026-09-15"],
    ["over the end of a month", "2026-09-30", 1, "2026-10-01"],
    ["over the end of a year", "2026-12-31", 1, "2027-01-01"],
    ["backwards over the start of a year", "2027-01-01", -1, "2026-12-31"],
    ["into a leap day", "2028-02-28", 1, "2028-02-29"],
    ["past a leap day", "2028-02-28", 2, "2028-03-01"],
    ["past a February in a normal year", "2027-02-28", 1, "2027-03-01"],
    ["past a February in a century that isn't a leap year", "2100-02-28", 1, "2100-03-01"],
    ["past a February in a 400-year leap year", "2000-02-28", 1, "2000-02-29"],
    ["a whole week", "2026-09-14", 7, "2026-09-21"],
    ["nowhere at all", "2026-09-14", 0, "2026-09-14"],
    ["a year of days", "2026-09-14", 365, "2027-09-14"],
  ])("moves %s", (_name, from, days, expected) => {
    expect(addDays(from, days)).toBe(expected);
  });

  it("always gives back a real day key", () => {
    let key = "2024-01-01";
    for (let i = 0; i < 800; i += 1) {
      key = addDays(key, 1);
      expect(isDayKey(key)).toBe(true);
    }
    expect(key).toBe("2026-03-11");
  });
});

describe("weekdayOf", () => {
  it.each([
    ["2026-09-13", 0, "Sunday"],
    ["2026-09-14", 1, "Monday"],
    ["2026-09-18", 5, "Friday"],
    ["2026-09-19", 6, "Saturday"],
    ["2000-01-01", 6, "Saturday"],
    ["1970-01-01", 4, "Thursday"],
  ])("says %s is a %s", (key, index) => {
    expect(weekdayOf(key)).toBe(index);
  });

  it("agrees with the browser's own idea of the weekday", () => {
    // Midday, so no time zone on earth can push the date to the day before or after.
    let key = "2026-01-01";
    for (let i = 0; i < 400; i += 1) {
      expect(weekdayOf(key)).toBe(new Date(`${key}T12:00:00`).getDay());
      key = addDays(key, 1);
    }
  });
});

describe("nextWeekday", () => {
  it("counts today, so 'sat' said on a Saturday means today", () => {
    expect(nextWeekday("2026-09-19", 6)).toBe("2026-09-19");
  });

  it("finds the coming one otherwise", () => {
    // Monday the 14th …
    expect(nextWeekday("2026-09-14", 5)).toBe("2026-09-18");
    expect(nextWeekday("2026-09-14", 0)).toBe("2026-09-20");
  });

  it("rolls into the next month", () => {
    expect(nextWeekday("2026-09-29", 5)).toBe("2026-10-02");
  });
});

describe("nextMonthDay", () => {
  it("takes the one still to come this year", () => {
    expect(nextMonthDay("2026-09-14", 9, 20)).toBe("2026-09-20");
  });

  it("counts today", () => {
    expect(nextMonthDay("2026-09-20", 9, 20)).toBe("2026-09-20");
  });

  it("rolls into next year once the day has passed", () => {
    expect(nextMonthDay("2026-12-14", 9, 20)).toBe("2027-09-20");
  });

  it("finds the next 29 February rather than inventing one", () => {
    expect(nextMonthDay("2027-03-01", 2, 29)).toBe("2028-02-29");
  });

  it("gives back nothing for a day that never exists", () => {
    expect(nextMonthDay("2026-09-14", 2, 30)).toBeNull();
    expect(nextMonthDay("2026-09-14", 4, 31)).toBeNull();
  });
});

describe("toDayKey", () => {
  it("pads, so the year 99 doesn't become a three-character key", () => {
    expect(toDayKey(2026, 9, 1)).toBe("2026-09-01");
    expect(toDayKey(99, 1, 1)).toBe("0099-01-01");
  });
});

describe("dayKeyFromDate", () => {
  it("reads the local calendar parts", () => {
    expect(dayKeyFromDate(new Date(2026, 8, 14, 23, 59))).toBe("2026-09-14");
    expect(dayKeyFromDate(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });

  it("todayKey takes the same reading from a timestamp", () => {
    expect(todayKey(new Date(2026, 8, 14, 9, 0).getTime())).toBe("2026-09-14");
  });
});
