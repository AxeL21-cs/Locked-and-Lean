import type { CalendarStatus, CalendarStatusPresentation } from "./types";

export const CALENDAR_STATUS_PRESENTATIONS: Readonly<
  Record<CalendarStatus, CalendarStatusPresentation>
> = {
  within_target: {
    status: "within_target",
    label: "Within target",
    symbol: "✓",
    accessibilityLabel: "Within target; completed record",
    colorToken: "statusWithin",
  },
  below_target: {
    status: "below_target",
    label: "Below target",
    symbol: "↓",
    accessibilityLabel: "Below target; completed record",
    colorToken: "statusBelow",
  },
  above_target: {
    status: "above_target",
    label: "Above target",
    symbol: "↑",
    accessibilityLabel: "Above target; completed record",
    colorToken: "statusAbove",
  },
  incomplete: {
    status: "incomplete",
    label: "Incomplete",
    symbol: "…",
    accessibilityLabel: "Incomplete nutrition record",
    colorToken: "statusIncomplete",
  },
  no_records: {
    status: "no_records",
    label: "No records",
    symbol: "—",
    accessibilityLabel: "No food records",
    colorToken: "statusEmpty",
  },
};

export function describeCalendarStatus(
  status: CalendarStatus,
): CalendarStatusPresentation {
  return CALENDAR_STATUS_PRESENTATIONS[status];
}

export function calendarStatusLegend(): CalendarStatusPresentation[] {
  const statuses: readonly CalendarStatus[] = [
    "within_target",
    "below_target",
    "above_target",
    "incomplete",
    "no_records",
  ];
  return statuses.map((status) => CALENDAR_STATUS_PRESENTATIONS[status]);
}
