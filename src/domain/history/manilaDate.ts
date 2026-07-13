import { PHILIPPINES_TIMEZONE } from "../localization/philippines";
import type { LocalDate, LocalDateRange } from "./types";

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type DateParts = { year: number; month: number; day: number };

export function parseLocalDate(value: LocalDate): DateParts {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) throw new RangeError("Local date must use YYYY-MM-DD.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const instant = new Date(Date.UTC(year, month - 1, day));
  if (
    instant.getUTCFullYear() !== year ||
    instant.getUTCMonth() !== month - 1 ||
    instant.getUTCDate() !== day
  ) {
    throw new RangeError("Local date is not a real calendar date.");
  }
  return { year, month, day };
}

export function formatLocalDate(parts: DateParts): LocalDate {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function addLocalDateDays(value: LocalDate, days: number): LocalDate {
  if (!Number.isInteger(days))
    throw new RangeError("Day offset must be an integer.");
  const { year, month, day } = parseLocalDate(value);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return formatLocalDate({
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  });
}

export function compareLocalDates(left: LocalDate, right: LocalDate): number {
  parseLocalDate(left);
  parseLocalDate(right);
  return left.localeCompare(right);
}

export function localDateRange(start: LocalDate, end: LocalDate): LocalDate[] {
  if (compareLocalDates(start, end) > 0)
    throw new RangeError("Date range start must not follow its end.");
  const dates: LocalDate[] = [];
  for (let cursor = start; compareLocalDates(cursor, end) <= 0;) {
    dates.push(cursor);
    cursor = addLocalDateDays(cursor, 1);
  }
  return dates;
}

function validInstant(value: Date | string): Date {
  const instant =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(instant.getTime()))
    throw new RangeError("A valid instant is required.");
  return instant;
}

export function localDateInZone(
  value: Date | string,
  timeZone: string,
): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(validInstant(value));
  const part = (type: "year" | "month" | "day") => {
    const result = parts.find((candidate) => candidate.type === type)?.value;
    if (!result)
      throw new RangeError(`Missing ${type} from timezone conversion.`);
    return result;
  };
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function localDateInManila(value: Date | string): LocalDate {
  return localDateInZone(value, PHILIPPINES_TIMEZONE);
}

function offsetAt(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instantMs));
  const read = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((candidate) => candidate.type === type)?.value;
    if (!value)
      throw new RangeError(`Missing ${type} from timezone conversion.`);
    return Number(value);
  };
  const representedAsUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  return representedAsUtc - Math.floor(instantMs / 1000) * 1000;
}

export function zonedDayBoundsUtc(
  localDate: LocalDate,
  timeZone: string,
): { startInclusive: string; endExclusive: string; durationHours: number } {
  const { year, month, day } = parseLocalDate(localDate);
  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  let startMs = localMidnightAsUtc - offsetAt(localMidnightAsUtc, timeZone);
  startMs = localMidnightAsUtc - offsetAt(startMs, timeZone);

  const next = parseLocalDate(addLocalDateDays(localDate, 1));
  const nextMidnightAsUtc = Date.UTC(next.year, next.month - 1, next.day);
  let endMs = nextMidnightAsUtc - offsetAt(nextMidnightAsUtc, timeZone);
  endMs = nextMidnightAsUtc - offsetAt(endMs, timeZone);

  return {
    startInclusive: new Date(startMs).toISOString(),
    endExclusive: new Date(endMs).toISOString(),
    durationHours: (endMs - startMs) / 3_600_000,
  };
}

export function manilaDayBoundsUtc(localDate: LocalDate) {
  return zonedDayBoundsUtc(localDate, PHILIPPINES_TIMEZONE);
}

export function assertDateInRange(value: LocalDate, range: LocalDateRange) {
  if (
    compareLocalDates(value, range.start) < 0 ||
    compareLocalDates(value, range.end) > 0
  ) {
    throw new RangeError("Local date is outside the requested range.");
  }
}
