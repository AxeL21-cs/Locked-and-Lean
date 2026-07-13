import type {
  CalendarDayContract,
  CalendarStatusPresentation,
} from "../../domain/history/types";
import type { MealType } from "../../services/supabase";

export type HistoryViewMode = "month" | "week" | "day";

export type CalendarNutritionSnapshot = {
  localDate: string;
  entryCount: number;
  calories: number;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  macroDataComplete: boolean;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbohydrateTargetG: number | null;
  fatTargetG: number | null;
  weightKg: number | null;
  hasEntries: boolean;
  serverCalculatedAt: string;
};

export type CalendarDayView = CalendarDayContract & {
  snapshot: CalendarNutritionSnapshot;
  status: CalendarStatusPresentation;
};

export type HistoryItemSnapshot = {
  id: string;
  foodProductId?: string | null;
  foodName: string;
  brand?: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  provider: string;
  providerIdentifier?: string | null;
  providerVersion?: string | null;
  providerRetrievedAt?: string | null;
  attribution?: string;
  marketCountryCode?: string | null;
  estimated: boolean;
  confidence: number | null;
  uncertainty: string[];
};

export type HistoryEntryView = {
  id: string;
  sourceKind: string;
  mealType: MealType;
  consumedAt: string;
  localDate: string;
  originalDescription: string;
  calories: number;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
  macroDataComplete: boolean;
  items: HistoryItemSnapshot[];
};

export type DayHistoryView = {
  localDate: string;
  entries: HistoryEntryView[];
  entryCount: number;
  truncated: boolean;
};
