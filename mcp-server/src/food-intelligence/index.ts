import {
  chatGptCandidateListSchema,
  foodPreviewSchema,
  userConfirmedCorrectionSchema,
} from "../schemas/food";

/** Strict, deterministic validation only. Interpretation remains ChatGPT's job. */
export function parseStructuredFoodCandidates(input: unknown) {
  return chatGptCandidateListSchema.parse(input);
}

export function parseFoodPreview(input: unknown) {
  return foodPreviewSchema.parse(input);
}

export function parseFoodCorrection(input: unknown) {
  return userConfirmedCorrectionSchema.parse(input);
}
