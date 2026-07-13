import type { CalendarDayView } from "../calendar/types";

export type ProgressRangeDays = 14 | 30 | 60;

export type ProgressSummaryView = {
  startDate: string;
  endDate: string;
  rangeDays: number;
  loggedDays: number;
  totalEntries: number;
  averageDailyCalories: number | null;
  completeMacroDays: number;
  averageDailyProteinG: number | null;
  averageDailyCarbohydratesG: number | null;
  averageDailyFatG: number | null;
  firstWeightDate: string | null;
  firstWeightKg: number | null;
  latestWeightDate: string | null;
  latestWeightKg: number | null;
  weightChangeKg: number | null;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbohydrateTargetG: number | null;
  fatTargetG: number | null;
  serverCalculatedAt: string;
};

export type WeightTrendView = {
  id: string;
  measuredAt: string;
  localDate: string;
  weightKg: number;
  previousWeightKg: number | null;
  changeFromPreviousKg: number | null;
  daysSincePrevious: number | null;
};

export type ProgressDashboardData = {
  summary: ProgressSummaryView;
  nutritionDays: CalendarDayView[];
  weightPoints: WeightTrendView[];
  weightTruncated: boolean;
};
