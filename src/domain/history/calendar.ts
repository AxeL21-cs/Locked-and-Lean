import {
  addLocalDateDays,
  compareLocalDates,
  formatLocalDate,
  localDateRange,
  parseLocalDate,
} from "./manilaDate";
import type { CalendarDayContract, LocalDate, LocalDateRange } from "./types";

function utcDate(value: LocalDate): Date {
  const { year, month, day } = parseLocalDate(value);
  return new Date(Date.UTC(year, month - 1, day));
}

function dayContract(
  localDate: LocalDate,
  displayedMonth: number,
  today: LocalDate,
): CalendarDayContract {
  const date = utcDate(localDate);
  return {
    localDate,
    dayNumber: date.getUTCDate(),
    weekdayLabel: new Intl.DateTimeFormat("en-PH", {
      timeZone: "UTC",
      weekday: "short",
    }).format(date),
    accessibilityLabel: new Intl.DateTimeFormat("en-PH", {
      timeZone: "UTC",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date),
    inDisplayedMonth: date.getUTCMonth() + 1 === displayedMonth,
    isToday: localDate === today,
  };
}

export function monthBounds(year: number, month: number): LocalDateRange {
  if (!Number.isInteger(year) || year < 1 || year > 9999)
    throw new RangeError("Year is invalid.");
  if (!Number.isInteger(month) || month < 1 || month > 12)
    throw new RangeError("Month is invalid.");
  const start = formatLocalDate({ year, month, day: 1 });
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const end = addLocalDateDays(
    formatLocalDate({
      year: nextMonth.getUTCFullYear(),
      month: nextMonth.getUTCMonth() + 1,
      day: 1,
    }),
    -1,
  );
  return { start, end };
}

export function weekBounds(
  localDate: LocalDate,
  weekStartsOn: 0 | 1 = 1,
): LocalDateRange {
  const date = utcDate(localDate);
  const leadingDays = (date.getUTCDay() - weekStartsOn + 7) % 7;
  const start = addLocalDateDays(localDate, -leadingDays);
  return { start, end: addLocalDateDays(start, 6) };
}

export function buildMonthGrid(input: {
  year: number;
  month: number;
  today: LocalDate;
  weekStartsOn?: 0 | 1;
}): CalendarDayContract[] {
  parseLocalDate(input.today);
  const bounds = monthBounds(input.year, input.month);
  const gridStart = weekBounds(bounds.start, input.weekStartsOn ?? 1).start;
  return Array.from({ length: 42 }, (_, index) =>
    dayContract(addLocalDateDays(gridStart, index), input.month, input.today),
  );
}

export function buildWeek(input: {
  localDate: LocalDate;
  today: LocalDate;
  weekStartsOn?: 0 | 1;
}): CalendarDayContract[] {
  parseLocalDate(input.today);
  const bounds = weekBounds(input.localDate, input.weekStartsOn ?? 1);
  const displayedMonth = parseLocalDate(input.localDate).month;
  return localDateRange(bounds.start, bounds.end).map((date) =>
    dayContract(date, displayedMonth, input.today),
  );
}

export function monthLabel(year: number, month: number): string {
  const start = monthBounds(year, month).start;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
  }).format(utcDate(start));
}

export function containsDate(range: LocalDateRange, value: LocalDate): boolean {
  return (
    compareLocalDates(value, range.start) >= 0 &&
    compareLocalDates(value, range.end) <= 0
  );
}
