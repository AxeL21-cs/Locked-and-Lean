export interface PhilippineFoodUncertainty {
  category: "street_food" | "recipe";
  confidence: "low" | "medium";
  unresolvedFactors: readonly string[];
  note: string;
}

const STREET_FOOD_KEYS = new Set([
  "banana cue",
  "fish ball",
  "isaw",
  "kamote cue",
  "kwek kwek",
]);

export function uncertaintyForPhilippineFood(
  foodName: string,
): PhilippineFoodUncertainty | null {
  const key = foodName
    .toLocaleLowerCase("en-PH")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!STREET_FOOD_KEYS.has(key)) return null;
  return {
    category: "street_food",
    confidence: "low",
    unresolvedFactors: [
      "piece size",
      "batter or coating",
      "absorbed frying oil",
      "sauce consumed",
    ],
    note: "Street-food preparation and portion can vary; confirm piece count and sauce, and keep oil uncertainty visible.",
  };
}
