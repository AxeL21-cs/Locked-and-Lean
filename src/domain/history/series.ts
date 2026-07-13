import {
  addLocalDateDays,
  compareLocalDates,
  localDateRange,
  localDateInManila,
  parseLocalDate,
} from "./manilaDate";
import type {
  DailyMacroInput,
  DailyMacroSeriesPoint,
  LocalDateRange,
  SparseWeightPoint,
  DailyNutritionSnapshot,
  WeeklyNutritionSummary,
  WeightObservation,
} from "./types";

export function summarizeNutritionWeek(
  range: LocalDateRange,
  days: readonly DailyNutritionSnapshot[],
): WeeklyNutritionSummary {
  const dates = localDateRange(range.start, range.end);
  if (dates.length !== 7)
    throw new RangeError(
      "Weekly nutrition range must contain exactly seven days.",
    );
  const byDate = new Map(days.map((day) => [day.localDate, day]));
  const recorded = dates
    .map((date) => byDate.get(date))
    .filter((day): day is DailyNutritionSnapshot => Boolean(day?.entryCount));
  const missingRecordDays = dates.filter(
    (date) => !byDate.get(date)?.entryCount,
  );
  const macroDataComplete =
    recorded.length > 0 && recorded.every((day) => day.macroDataComplete);
  const sum = (key: "proteinG" | "carbohydratesG" | "fatG"): number | null =>
    macroDataComplete
      ? recorded.reduce((total, day) => total + (day[key] ?? 0), 0)
      : null;
  const calories =
    recorded.length > 0
      ? recorded.reduce((total, day) => total + day.calories, 0)
      : null;

  return {
    range,
    recordedDays: recorded.length,
    calories,
    proteinG: sum("proteinG"),
    carbohydratesG: sum("carbohydratesG"),
    fatG: sum("fatG"),
    macroDataComplete,
    missingRecordDays,
    accessibilityLabel:
      recorded.length === 0
        ? `${range.start} to ${range.end}: no nutrition records`
        : `${range.start} to ${range.end}: ${recorded.length} recorded days; ${missingRecordDays.length} missing days; ${calories} calories; ${macroDataComplete ? "macros complete" : "macros incomplete"}`,
  };
}

export function buildDailyMacroSeries(
  range: LocalDateRange,
  days: readonly DailyMacroInput[],
): DailyMacroSeriesPoint[] {
  const byDate = new Map(days.map((day) => [day.localDate, day]));
  return localDateRange(range.start, range.end).map((localDate) => {
    const day = byDate.get(localDate);
    if (!day || day.entryCount === 0) {
      return {
        localDate,
        proteinG: null,
        carbohydratesG: null,
        fatG: null,
        completeness: "missing" as const,
        missingMacros: ["protein", "carbohydrates", "fat"] as const,
        markerShape: "gap" as const,
        visibleLabel: "No records",
        accessibilityLabel: `${localDate}: no nutrition records`,
      };
    }

    const missingMacros = [
      ...(day.proteinG === null ? (["protein"] as const) : []),
      ...(day.carbohydratesG === null ? (["carbohydrates"] as const) : []),
      ...(day.fatG === null ? (["fat"] as const) : []),
    ];
    const completeness = missingMacros.length === 0 ? "complete" : "partial";
    return {
      localDate,
      proteinG: day.proteinG,
      carbohydratesG: day.carbohydratesG,
      fatG: day.fatG,
      completeness,
      missingMacros,
      markerShape: completeness === "complete" ? "circle" : "triangle",
      visibleLabel: completeness === "complete" ? "Complete" : "Incomplete",
      accessibilityLabel:
        completeness === "complete"
          ? `${localDate}: protein ${day.proteinG} grams, carbohydrates ${day.carbohydratesG} grams, fat ${day.fatG} grams`
          : `${localDate}: incomplete macros; missing ${missingMacros.join(", ")}`,
    };
  });
}

function dateDistance(left: string, right: string): number {
  const leftParts = parseLocalDate(left);
  const rightParts = parseLocalDate(right);
  return Math.round(
    (Date.UTC(rightParts.year, rightParts.month - 1, rightParts.day) -
      Date.UTC(leftParts.year, leftParts.month - 1, leftParts.day)) /
      86_400_000,
  );
}

export function buildSparseWeightSeries(input: {
  range: LocalDateRange;
  observations: readonly WeightObservation[];
  rollingWindow?: number;
}): SparseWeightPoint[] {
  const rollingWindow = input.rollingWindow ?? 3;
  if (!Number.isInteger(rollingWindow) || rollingWindow < 1)
    throw new RangeError("Rolling window must be a positive integer.");

  const latestByDate = new Map<string, WeightObservation>();
  for (const observation of [...input.observations].sort((left, right) =>
    left.measuredAt.localeCompare(right.measuredAt),
  )) {
    if (localDateInManila(observation.measuredAt) !== observation.localDate) {
      throw new RangeError(
        "Weight observation local date does not match its Asia/Manila instant.",
      );
    }
    if (
      compareLocalDates(observation.localDate, input.range.start) >= 0 &&
      compareLocalDates(observation.localDate, input.range.end) <= 0
    ) {
      latestByDate.set(observation.localDate, observation);
    }
  }

  const recorded: WeightObservation[] = [];
  let previousRecordedDate: string | null = null;
  return localDateRange(input.range.start, input.range.end).map((localDate) => {
    const observation = latestByDate.get(localDate);
    if (!observation) {
      return {
        localDate,
        weightKg: null,
        rollingAverageKg: null,
        observationId: null,
        gapDaysSincePrevious: null,
        marker: "missing" as const,
        markerShape: "gap" as const,
        visibleLabel: "No weight",
        accessibilityLabel: `${localDate}: no weight recorded`,
      };
    }

    const gapDaysSincePrevious = previousRecordedDate
      ? dateDistance(previousRecordedDate, localDate)
      : null;
    previousRecordedDate = localDate;
    recorded.push(observation);
    const window = recorded.slice(-rollingWindow);
    const rollingAverageKg =
      Math.round(
        (window.reduce((total, item) => total + item.weightKg, 0) /
          window.length) *
          100,
      ) / 100;
    return {
      localDate,
      weightKg: observation.weightKg,
      rollingAverageKg,
      observationId: observation.id,
      gapDaysSincePrevious,
      marker: "recorded" as const,
      markerShape: "circle" as const,
      visibleLabel: `${observation.weightKg} kg`,
      accessibilityLabel: `${localDate}: ${observation.weightKg} kilograms; rolling average ${rollingAverageKg} kilograms`,
    };
  });
}

export function nextDateAfterSeries(range: LocalDateRange) {
  return addLocalDateDays(range.end, 1);
}
