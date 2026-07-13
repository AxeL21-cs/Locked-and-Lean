import type {
  DailyNutritionSnapshot,
  HistoryEntrySnapshot,
  LocalDate,
} from "./types";

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

function immutableCopy<T>(value: T): DeepReadonly<T> {
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((item) => immutableCopy(item)),
    ) as DeepReadonly<T>;
  }
  if (value && typeof value === "object") {
    const clone = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, immutableCopy(item)]),
    );
    return Object.freeze(clone) as DeepReadonly<T>;
  }
  return value as DeepReadonly<T>;
}

export function createImmutableHistorySnapshot<T>(value: T): DeepReadonly<T> {
  return immutableCopy(value);
}

function sumMacro(
  entries: readonly HistoryEntrySnapshot[],
  key: "proteinG" | "carbohydratesG" | "fatG",
): number | null {
  if (entries.some((entry) => entry.nutrition[key] === null)) return null;
  return entries.reduce(
    (total, entry) => total + (entry.nutrition[key] ?? 0),
    0,
  );
}

export function recalculateDailyNutrition(
  localDate: LocalDate,
  entries: readonly HistoryEntrySnapshot[],
): DailyNutritionSnapshot {
  const active = entries.filter(
    (entry) => entry.localDate === localDate && entry.deletedAt === null,
  );
  const proteinG = sumMacro(active, "proteinG");
  const carbohydratesG = sumMacro(active, "carbohydratesG");
  const fatG = sumMacro(active, "fatG");
  return {
    localDate,
    entryCount: active.length,
    calories: active.reduce(
      (total, entry) => total + entry.nutrition.calories,
      0,
    ),
    proteinG,
    carbohydratesG,
    fatG,
    macroDataComplete:
      proteinG !== null && carbohydratesG !== null && fatG !== null,
  };
}
