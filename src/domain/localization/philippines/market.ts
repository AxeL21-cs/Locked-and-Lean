export type PhilippineNutritionSourceKind =
  | "user_confirmed_saved_food"
  | "exact_ph_barcode_package_label"
  | "manufacturer_ph_nutrition"
  | "official_ph_restaurant_nutrition"
  | "legally_usable_ph_composition"
  | "private_user_confirmed_product"
  | "open_food_facts_ph_market"
  | "usda_generic"
  | "comparable_estimate"
  | "manual_correction";

export const PHILIPPINE_SOURCE_PRIORITY: readonly PhilippineNutritionSourceKind[] =
  [
    "user_confirmed_saved_food",
    "exact_ph_barcode_package_label",
    "manufacturer_ph_nutrition",
    "official_ph_restaurant_nutrition",
    "legally_usable_ph_composition",
    "private_user_confirmed_product",
    "open_food_facts_ph_market",
    "usda_generic",
    "comparable_estimate",
    "manual_correction",
  ];

export interface PhilippineSourceCandidate {
  id: string;
  kind: PhilippineNutritionSourceKind;
  market: "PH" | "foreign" | "unknown";
}

export function rankPhilippineSources<T extends PhilippineSourceCandidate>(
  candidates: readonly T[],
): T[] {
  const marketPriority = { PH: 0, unknown: 1, foreign: 2 } as const;
  return candidates
    .map((candidate, inputIndex) => ({ candidate, inputIndex }))
    .sort((left, right) => {
      const priorityDifference =
        PHILIPPINE_SOURCE_PRIORITY.indexOf(left.candidate.kind) -
        PHILIPPINE_SOURCE_PRIORITY.indexOf(right.candidate.kind);
      const marketDifference =
        marketPriority[left.candidate.market] -
        marketPriority[right.candidate.market];
      return (
        priorityDifference ||
        marketDifference ||
        left.inputIndex - right.inputIndex
      );
    })
    .map(({ candidate }) => candidate);
}

export const FOREIGN_MARKET_WARNING =
  "Philippine formulation or serving size may differ.";
export const CONFLICTING_MARKET_WARNING =
  "Market evidence conflicts. Verify the exact package version before confirming.";

export interface PhilippineMarketEvidence {
  packageLabelCountry?: string;
  countryOfSale?: string;
  manufacturerMarket?: string;
  providerMarket?: string;
  userConfirmedMarket?: string;
  barcodePrefix?: string;
}

export interface MarketAssessment {
  market: "PH" | "foreign" | "unknown";
  warning: string | null;
  evidenceUsed: string[];
  barcodePrefixIgnored: boolean;
}

const normalizeMarket = (value: string): string =>
  value.toLocaleLowerCase("en-PH").replace(/[^a-z]/g, "");

const PH_MARKETS = new Set(["ph", "philippines", "philippine"]);

export function assessPhilippineMarket(
  evidence: PhilippineMarketEvidence,
): MarketAssessment {
  const reliableValues = [
    ["package_label", evidence.packageLabelCountry],
    ["country_of_sale", evidence.countryOfSale],
    ["manufacturer_market", evidence.manufacturerMarket],
    ["provider_market", evidence.providerMarket],
    ["user_confirmation", evidence.userConfirmedMarket],
  ] as const;
  const present: { name: string; value: string }[] = [];
  for (const [name, value] of reliableValues) {
    if (value !== undefined && value.trim().length > 0)
      present.push({ name, value });
  }
  const hasPhilippineEvidence = present.some(({ value }) =>
    PH_MARKETS.has(normalizeMarket(value)),
  );
  const hasForeignEvidence = present.some(
    ({ value }) => !PH_MARKETS.has(normalizeMarket(value)),
  );
  const hasConflict = hasPhilippineEvidence && hasForeignEvidence;
  const market = hasConflict
    ? "unknown"
    : hasPhilippineEvidence
      ? "PH"
      : hasForeignEvidence
        ? "foreign"
        : "unknown";

  return {
    market,
    warning: hasConflict
      ? CONFLICTING_MARKET_WARNING
      : market === "foreign"
        ? FOREIGN_MARKET_WARNING
        : null,
    evidenceUsed: present.map(({ name }) => name),
    barcodePrefixIgnored: evidence.barcodePrefix !== undefined,
  };
}
