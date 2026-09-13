/**
 * @jest-environment node
 */
import { isDayKey } from "./dayKey";

describe("isDayKey", () => {
  it.each([
    "2026-09-14",
    "2026-01-01",
    "2026-12-31",
    "2026-04-30",
    "2028-02-29", // leap year
    "2000-02-29", // divisible by 400, so a leap year
  ])("accepts the real day %j", (value) => {
    expect(isDayKey(value)).toBe(true);
  });

  it.each([
    ["2026-02-29", "2026 isn't a leap year"],
    ["1900-02-29", "divisible by 100 but not 400, so not a leap year"],
    ["2026-04-31", "April has 30 days"],
    ["2026-13-01", "there's no month 13"],
    ["2026-00-10", "there's no month 0"],
    ["2026-09-00", "there's no day 0"],
    ["2026-9-14", "month needs two digits"],
    ["26-09-14", "year needs four digits"],
    ["2026/09/14", "wrong separator"],
    ["2026-09-14T00:00", "has a time"],
    [" 2026-09-14", "has a space"],
    ["", "is empty"],
  ])("rejects %j (%s)", (value) => {
    expect(isDayKey(value)).toBe(false);
  });

  it.each([null, undefined, 20260914, new Date(2026, 8, 14)])("rejects the non-string %p", (value) => {
    expect(isDayKey(value)).toBe(false);
  });
});
