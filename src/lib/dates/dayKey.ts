/**
 * A calendar day written as `YYYY-MM-DD`, for example `2026-09-14`.
 *
 * It has no time and no time zone on purpose: "due Friday" means Friday wherever you are.
 * Never build one with `toISOString()`, which uses UTC and gives the wrong day at UTC+8.
 */
export type DayKey = string;

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for a real calendar day in `YYYY-MM-DD` form. `2026-02-30` is not one. */
export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== "string") return false;

  const match = DAY_KEY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

// Plain arithmetic instead of `new Date(...)`, so no time zone can ever affect the answer.
function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
