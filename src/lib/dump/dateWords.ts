import { nextMonthDay, nextWeekday, addDays } from "@/lib/dates/calendar";
import type { DayKey } from "@/lib/dates/dayKey";

/**
 * The date words the quick parser understands, and only at the **end** of a line:
 * "call the bank tomorrow", "pick a hosting plan fri", "renew the domain sep 20".
 *
 * A word in the middle ("tomorrow, call the bank") is left alone on purpose. Rules can
 * only go so far; Block 5 is where the AI takes over for the rest.
 *
 * Numeric dates like `9/10` are never read: that's 9 October to half the world and
 * 10 September to the other half, and guessing wrong is worse than not guessing.
 */
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

/** `on`, `by` and `due` are dropped along with the date: "call the bank by friday". */
const LEAD_IN = String.raw`(?:(?:due\s+)?(?:on|by)\s+|due\s+)?`;
const ORDINAL = String.raw`(?:st|nd|rd|th)?`;

const DATE_PHRASE = new RegExp(
  String.raw`(?:^|\s)${LEAD_IN}(` +
    String.raw`today|tonight|tomorrow|` +
    String.raw`(?:${WEEKDAYS.map((day) => `${day}|${day.slice(0, 3)}`).join("|")})|` +
    String.raw`(?:${MONTHS.flatMap(spellings).join("|")})\.?\s+\d{1,2}${ORDINAL}` +
    String.raw`)\s*$`,
  "i",
);

/** "september", "sept" and "sep" — longest first, so the regex doesn't stop at "sep" in "sept". */
function spellings(month: string): string[] {
  return [...new Set([month, month.slice(0, 4), month.slice(0, 3)])];
}

export type TitleAndDue = Readonly<{ title: string; due: DayKey | null }>;

/**
 * Splits a line into what it's about and when it's due.
 *
 * A date word that can't name a real day — "feb 30" — stays in the title, where it is at
 * least still readable, rather than becoming a wrong date.
 */
export function readDueDate(line: string, today: DayKey): TitleAndDue {
  const match = DATE_PHRASE.exec(line);
  if (match === null) return { title: line.trim(), due: null };

  const due = resolve(match[1].toLowerCase(), today);
  if (due === null) return { title: line.trim(), due: null };

  return { title: line.slice(0, match.index).trim(), due };
}

function resolve(phrase: string, today: DayKey): DayKey | null {
  if (phrase === "today" || phrase === "tonight") return today;
  if (phrase === "tomorrow") return addDays(today, 1);

  const weekday = WEEKDAYS.findIndex((day) => day === phrase || day.slice(0, 3) === phrase);
  if (weekday !== -1) return nextWeekday(today, weekday);

  const monthDay = /^([a-z]+)\.?\s+(\d{1,2})/.exec(phrase);
  if (monthDay === null) return null;

  const month = MONTHS.findIndex((name) => spellings(name).includes(monthDay[1]));
  if (month === -1) return null;

  return nextMonthDay(today, month + 1, Number(monthDay[2]));
}
