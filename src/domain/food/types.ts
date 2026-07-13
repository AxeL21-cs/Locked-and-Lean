import { z } from "zod";

import {
  aliasSchema,
  calculatedTotalsSchema,
  canonicalFoodSchema,
  chatGptCandidateSchema,
  confidenceSchema,
  confirmedFoodSnapshotSchema,
  foodPreviewSchema,
  nutritionProviderMatchSchema,
  nutrientAmountsSchema,
  previewComponentSchema,
  previewItemSchema,
  provenanceSchema,
  resolvedFoodValuesSchema,
  servingDefinitionSchema,
  servingUnitSchema,
  uncertaintyCategorySchema,
  uncertaintySchema,
  userConfirmedCorrectionSchema,
} from "./schemas";

export type Confidence = z.infer<typeof confidenceSchema>;
export type UncertaintyCategory = z.infer<typeof uncertaintyCategorySchema>;
export type Uncertainty = z.infer<typeof uncertaintySchema>;
export type NutrientAmounts = z.infer<typeof nutrientAmountsSchema>;
export type ServingUnit = z.infer<typeof servingUnitSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type Alias = z.infer<typeof aliasSchema>;
export type ServingDefinition = z.infer<typeof servingDefinitionSchema>;
export type CanonicalFood = z.infer<typeof canonicalFoodSchema>;
export type ChatGptCandidate = z.infer<typeof chatGptCandidateSchema>;
export type NutritionProviderMatch = z.infer<
  typeof nutritionProviderMatchSchema
>;
export type ResolvedFoodValues = z.infer<typeof resolvedFoodValuesSchema>;
export type PreviewComponent = z.infer<typeof previewComponentSchema>;
export type PreviewItem = z.infer<typeof previewItemSchema>;
export type UserConfirmedCorrection = z.infer<
  typeof userConfirmedCorrectionSchema
>;
export type FoodPreview = z.infer<typeof foodPreviewSchema>;
export type CalculatedTotals = z.infer<typeof calculatedTotalsSchema>;
export type ConfirmedFoodSnapshot = z.infer<typeof confirmedFoodSnapshotSchema>;
