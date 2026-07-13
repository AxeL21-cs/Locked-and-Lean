export const PHILIPPINE_SERVING_TERMS = [
  "gram",
  "milliliter",
  "cup",
  "rice cup",
  "tablespoon",
  "teaspoon",
  "piece",
  "order",
  "stick",
  "sachet",
  "pack",
  "bottle",
  "can",
  "baso",
  "mangkok",
  "sandok",
  "piraso",
  "balot",
  "supot",
] as const;

export type PhilippineServingTerm = (typeof PHILIPPINE_SERVING_TERMS)[number];

export interface ServingObservation {
  quantity: number;
  term: PhilippineServingTerm;
  measurableAmount?: {
    quantity: number;
    unit: "g" | "ml";
    sourceDescription: string;
  };
}

export interface ServingAssumption {
  observation: ServingObservation;
  hasUniversalWeight: false;
  clarificationRequired: boolean;
  clarificationQuestion: string | null;
}

const DIRECT_MEASURES = new Set<PhilippineServingTerm>(["gram", "milliliter"]);

export function modelServingAssumption(
  observation: ServingObservation,
): ServingAssumption {
  const hasMeasuredAmount = observation.measurableAmount !== undefined;
  const clarificationRequired =
    !DIRECT_MEASURES.has(observation.term) && !hasMeasuredAmount;

  return {
    observation,
    hasUniversalWeight: false,
    clarificationRequired,
    clarificationQuestion: clarificationRequired
      ? `What quantity does ${observation.quantity} ${observation.term} mean for this food?`
      : null,
  };
}
