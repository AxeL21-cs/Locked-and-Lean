import {
  describeCalendarStatus,
  type CalendarDayContract,
  type CalendarStatus,
} from "../../domain/history";
import type { CalendarHistoryDay } from "../../services/supabase";
import type { CalendarDayView } from "./types";

export function statusForDay(snapshot: CalendarHistoryDay): CalendarStatus {
  if (!snapshot.hasEntries) return "no_records";
  if (!snapshot.macroDataComplete || snapshot.calorieTarget == null)
    return "incomplete";
  if (snapshot.calories > snapshot.calorieTarget) return "above_target";
  if (snapshot.calories < snapshot.calorieTarget) return "below_target";
  return "within_target";
}

export function calendarDayView(
  contract: CalendarDayContract,
  snapshot: CalendarHistoryDay,
): CalendarDayView {
  if (contract.localDate !== snapshot.localDate)
    throw new Error("Calendar contract and server snapshot date do not match.");
  return {
    ...contract,
    snapshot,
    status: describeCalendarStatus(statusForDay(snapshot)),
  };
}
