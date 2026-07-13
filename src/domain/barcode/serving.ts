import { modelServingAssumption } from "../localization/philippines";
import type { QualifiedServingSelection } from "./types";

export function qualifyBarcodeServing(
  input: Omit<
    QualifiedServingSelection,
    "clarificationRequired" | "clarificationQuestion"
  >,
): QualifiedServingSelection {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Serving quantity must be greater than zero.");
  }

  const assumption = modelServingAssumption({
    quantity: input.quantity,
    term: input.term,
    ...(input.measurableAmount
      ? { measurableAmount: input.measurableAmount }
      : {}),
  });

  return {
    ...input,
    clarificationRequired: assumption.clarificationRequired,
    clarificationQuestion: assumption.clarificationQuestion,
  };
}
