export type LocalDate = string;

export type CalendarStatus =
  | "within_target"
  | "below_target"
  | "above_target"
  | "incomplete"
  | "no_records";

export interface CalendarStatusPresentation {
  status: CalendarStatus;
  label: string;
  symbol: string;
  accessibilityLabel: string;
  colorToken:
    | "statusWithin"
    | "statusBelow"
    | "statusAbove"
    | "statusIncomplete"
    | "statusEmpty";
}

export interface CalendarDayContract {
  localDate: LocalDate;
  dayNumber: number;
  weekdayLabel: string;
  accessibilityLabel: string;
  inDisplayedMonth: boolean;
  isToday: boolean;
}

export interface LocalDateRange {
  start: LocalDate;
  end: LocalDate;
}

export interface HistoryEntryNutrition {
  calories: number;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
}

export interface HistoryEntrySnapshot {
  id: string;
  localDate: LocalDate;
  deletedAt: string | null;
  nutrition: HistoryEntryNutrition;
  provenance: {
    provider: string;
    providerVersion: string | null;
    providerRetrievedAt: string | null;
    attribution: string | null;
  };
}

export interface DailyNutritionSnapshot {
  localDate: LocalDate;
  entryCount: number;
  calories: number;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  macroDataComplete: boolean;
}

export interface DailyMacroInput {
  localDate: LocalDate;
  entryCount: number;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
}

export interface DailyMacroSeriesPoint {
  localDate: LocalDate;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  completeness: "complete" | "partial" | "missing";
  missingMacros: readonly ("protein" | "carbohydrates" | "fat")[];
  markerShape: "circle" | "triangle" | "gap";
  visibleLabel: string;
  accessibilityLabel: string;
}

export interface WeeklyNutritionSummary {
  range: LocalDateRange;
  recordedDays: number;
  calories: number | null;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  macroDataComplete: boolean;
  missingRecordDays: readonly LocalDate[];
  accessibilityLabel: string;
}

export interface WeightObservation {
  id: string;
  measuredAt: string;
  localDate: LocalDate;
  weightKg: number;
}

export interface SparseWeightPoint {
  localDate: LocalDate;
  weightKg: number | null;
  rollingAverageKg: number | null;
  observationId: string | null;
  gapDaysSincePrevious: number | null;
  marker: "recorded" | "missing";
  markerShape: "circle" | "gap";
  visibleLabel: string;
  accessibilityLabel: string;
}

export interface CopyAsPreviewIntent {
  rpc: "copy_food_entry_to_preview";
  args: {
    p_entry_id: string;
    p_meal_type: "breakfast" | "lunch" | "dinner" | "snack";
    p_consumed_at: string;
  };
  targetLocalDate: LocalDate;
  permanentWrite: false;
  confirmationRequired: true;
}
