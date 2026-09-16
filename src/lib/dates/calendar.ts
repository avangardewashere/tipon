import { isDayKey, type DayKey } from "./dayKey";

/**
 * Calendar arithmetic on `DayKey`s, done with plain numbers.
 *
 * No `Date` object is involved once we have a day key, so no time zone can shift an
 * answer: "tomorrow" is always one row down the calendar, everywhere on earth.
 */

/** `0` is Sunday, the order `Date#getDay` uses. */
export const SUNDAY = 0;

/**
 * Today, read from the clock. The **only** place a real `Date` becomes a day key.
 *
 * It uses the local calendar parts, never `toISOString()`: at UTC+8, half past midnight
 * on the 21st is still the 20th in UTC, and "due today" would land on the wrong day.
 */
export function dayKeyFromDate(date: Date): DayKey {
  return toDayKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function todayKey(now: number): DayKey {
  return dayKeyFromDate(new Date(now));
}

export function addDays(key: DayKey, days: number): DayKey {
  const { year, month, day } = partsOf(key);
  return fromDayNumber(toDayNumber(year, month, day) + days);
}

/** `0` for Sunday through `6` for Saturday. */
export function weekdayOf(key: DayKey): number {
  const { year, month, day } = partsOf(key);
  // 1970-01-01 was a Thursday, which is 4.
  return (((toDayNumber(year, month, day) + 4) % 7) + 7) % 7;
}

/**
 * The next day that falls on `weekday`, counting today.
 *
 * Saying "call mum sat" on a Saturday means today, not in a week's time. Someone who
 * means next week says so, and can change the date in the review sheet either way.
 */
export function nextWeekday(from: DayKey, weekday: number): DayKey {
  const ahead = (((weekday - weekdayOf(from)) % 7) + 7) % 7;
  return addDays(from, ahead);
}

/** The day key for a year, month and day, or `null` when that day doesn't exist. */
export function toDayKey(year: number, month: number, day: number): DayKey {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * The next `month`/`day` on or after `from`, rolling into next year when it has passed.
 *
 * "Sep 20" written in December means next September, not one that has been and gone.
 * Returns `null` for a day that doesn't exist, like `Feb 30`.
 */
export function nextMonthDay(from: DayKey, month: number, day: number): DayKey | null {
  const { year } = partsOf(from);

  for (const candidate of [toDayKey(year, month, day), toDayKey(year + 1, month, day)]) {
    if (!isDayKey(candidate)) continue;
    if (candidate >= from) return candidate;
  }

  return null;
}

function partsOf(key: DayKey): { year: number; month: number; day: number } {
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)), day: Number(key.slice(8, 10)) };
}

// Days since 1970-01-01, from Howard Hinnant's civil calendar algorithms. March is
// treated as the first month, which puts the leap day at the end of the year where it
// can't shift anything else.
function toDayNumber(year: number, month: number, day: number): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function fromDayNumber(days: number): DayKey {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365);
  const year = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
  const month = monthIndex + (monthIndex < 10 ? 3 : -9);

  return toDayKey(year + (month <= 2 ? 1 : 0), month, day);
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
