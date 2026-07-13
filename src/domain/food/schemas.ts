import { z } from "zod";

export const confidenceSchema = z.enum(["high", "medium", "low", "unknown"]);

export const uncertaintyCategorySchema = z.enum([
  "portion_size",
  "food_identity",
  "brand",
  "market_variant",
  "cooking_oil",
  "sauce_quantity",
  "hidden_ingredient",
  "preparation_method",
  "nutrition_source",
]);

export const uncertaintySchema = z
  .object({
    category: uncertaintyCategorySchema,
    note: z.string().trim().min(1).max(500),
    confidence: confidenceSchema,
    source: z.enum(["chatgpt", "provider", "user", "domain"]),
  })
  .strict();

export const nutrientAmountsSchema = z
  .object({
    caloriesKcal: z.number().finite().nonnegative(),
    proteinG: z.number().finite().nonnegative(),
    carbohydratesG: z.number().finite().nonnegative(),
    fatG: z.number().finite().nonnegative(),
  })
  .strict();

export const servingUnitSchema = z.enum([
  "g",
  "ml",
  "piece",
  "serving",
  "cup",
  "tbsp",
  "tsp",
  "pack",
  "bowl",
  "plate",
]);

export const nutritionBasisSchema = z
  .object({
    amount: z.number().finite().positive(),
    unit: servingUnitSchema,
    nutrients: nutrientAmountsSchema,
  })
  .strict();

export const provenanceSchema = z
  .object({
    sourceName: z.string().trim().min(1).max(120),
    sourceRecordId: z.string().trim().min(1).max(200).nullable(),
    sourceVersion: z.string().trim().min(1).max(120).nullable(),
    observedAt: z.string().datetime({ offset: true }).nullable(),
    market: z.string().trim().min(2).max(80).nullable(),
    servingDescription: z.string().trim().min(1).max(200).nullable(),
    attribution: z.string().trim().min(1).max(500).nullable(),
    isEstimate: z.boolean(),
  })
  .strict();

export const aliasSchema = z
  .object({
    value: z.string().trim().min(1).max(160),
    normalized: z.string().trim().min(1).max(160),
    kind: z.enum([
      "local_name",
      "english_name",
      "taglish_phrase",
      "misspelling",
      "brand_shorthand",
      "restaurant_shorthand",
    ]),
    locale: z.string().trim().min(2).max(35).nullable(),
  })
  .strict();

export const servingDefinitionSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    kind: z.literal("serving_definition"),
    name: z.string().trim().min(1).max(160),
    amount: z.number().finite().positive(),
    unit: servingUnitSchema,
    gramWeight: z.number().finite().positive().nullable(),
    market: z.string().trim().min(2).max(80).nullable(),
    qualifiers: z.array(z.string().trim().min(1).max(120)).max(20),
  })
  .strict();

const canonicalCommon = {
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  aliases: z.array(aliasSchema).max(100),
  preparationStyles: z.array(z.string().trim().min(1).max(120)).max(50),
};

export const foodConceptSchema = z
  .object({
    ...canonicalCommon,
    kind: z.literal("food_concept"),
    ingredientConceptIds: z.array(z.string().trim().min(1).max(120)).max(100),
  })
  .strict();

export const packagedProductSchema = z
  .object({
    ...canonicalCommon,
    kind: z.literal("packaged_product"),
    brand: z.string().trim().min(1).max(120),
    barcode: z.string().regex(/^\d{8,14}$/),
    market: z.string().trim().min(2).max(80),
    packageNutrition: nutritionBasisSchema,
    servings: z.array(servingDefinitionSchema).min(1).max(30),
  })
  .strict();

export const restaurantMealComponentSchema = z
  .object({
    ...canonicalCommon,
    kind: z.literal("restaurant_meal_component"),
    restaurant: z.string().trim().min(1).max(120),
    role: z.enum([
      "rice",
      "main_dish",
      "side_dish",
      "sauce",
      "drink",
      "topping",
      "condiment",
    ]),
    defaultServing: servingDefinitionSchema.nullable(),
  })
  .strict();

export const restaurantMenuItemSchema = z
  .object({
    ...canonicalCommon,
    kind: z.literal("restaurant_menu_item"),
    restaurant: z.string().trim().min(1).max(120),
    market: z.string().trim().min(2).max(80).nullable(),
    componentIds: z.array(z.string().trim().min(1).max(120)).max(50),
  })
  .strict();

export const homemadeDishSchema = z
  .object({
    ...canonicalCommon,
    kind: z.literal("homemade_dish"),
    ingredientConceptIds: z.array(z.string().trim().min(1).max(120)).max(100),
    recipeIsUserSpecific: z.boolean(),
  })
  .strict();

export const genericIngredientSchema = z
  .object({
    ...canonicalCommon,
    kind: z.literal("generic_ingredient"),
    ediblePortionDescription: z.string().trim().min(1).max(200).nullable(),
  })
  .strict();

export const canonicalFoodSchema = z.discriminatedUnion("kind", [
  foodConceptSchema,
  packagedProductSchema,
  restaurantMenuItemSchema,
  restaurantMealComponentSchema,
  homemadeDishSchema,
  genericIngredientSchema,
  servingDefinitionSchema,
]);

export const observedImageItemSchema = z
  .object({
    kind: z.literal("observed_image_item"),
    observationId: z.string().trim().min(1).max(120),
    visualEvidence: z.string().trim().min(1).max(500),
    regionLabel: z.string().trim().min(1).max(120).nullable(),
  })
  .strict();

export const userDescribedItemSchema = z
  .object({
    kind: z.literal("user_described_item"),
    description: z.string().trim().min(1).max(500),
    languageHint: z.string().trim().min(2).max(35).nullable(),
  })
  .strict();

export const interpretationEvidenceSchema = z.discriminatedUnion("kind", [
  observedImageItemSchema,
  userDescribedItemSchema,
]);

export const chatGptCandidateSchema = z
  .object({
    candidateId: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(160),
    brand: z.string().trim().min(1).max(120).nullable(),
    restaurant: z.string().trim().min(1).max(120).nullable(),
    quantity: z.number().finite().positive(),
    unit: servingUnitSchema,
    preparation: z.string().trim().min(1).max(120).nullable(),
    confidence: confidenceSchema,
    evidence: interpretationEvidenceSchema,
    uncertainties: z.array(uncertaintySchema).max(30),
    possibleMatches: z.array(z.string().trim().min(1).max(160)).max(20),
  })
  .strict();

export const nutritionProviderMatchSchema = z
  .object({
    matchId: z.string().trim().min(1).max(120),
    canonicalFoodId: z.string().trim().min(1).max(120).nullable(),
    displayName: z.string().trim().min(1).max(160),
    matchConfidence: confidenceSchema,
    nutritionConfidence: confidenceSchema,
    nutritionBasis: nutritionBasisSchema.nullable(),
    provenance: provenanceSchema,
    uncertainties: z.array(uncertaintySchema).max(30),
    marketVariant: z.string().trim().min(1).max(120).nullable(),
  })
  .strict();

export const resolvedFoodValuesSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160),
    canonicalFoodId: z.string().trim().min(1).max(120).nullable(),
    quantity: z.number().finite().positive(),
    unit: servingUnitSchema,
    preparation: z.string().trim().min(1).max(120).nullable(),
    nutritionBasis: nutritionBasisSchema,
    provenance: z.array(provenanceSchema).min(1).max(20),
    confidence: confidenceSchema,
    uncertainties: z.array(uncertaintySchema).max(30),
  })
  .strict()
  .superRefine((values, context) => {
    if (values.unit !== values.nutritionBasis.unit) {
      context.addIssue({
        code: "custom",
        path: ["unit"],
        message: `Unit ${values.unit} cannot be scaled from a ${values.nutritionBasis.unit} nutrition basis.`,
      });
    }
  });

const layeredFoodFields = {
  interpretation: chatGptCandidateSchema,
  providerMatches: z.array(nutritionProviderMatchSchema).max(30),
  resolved: resolvedFoodValuesSchema,
};

export const previewComponentSchema = z
  .object({
    componentId: z.string().trim().min(1).max(120),
    role: z.enum([
      "rice",
      "main_dish",
      "side_dish",
      "sauce",
      "drink",
      "topping",
      "condiment",
    ]),
    status: z.enum(["active", "removed"]),
    ...layeredFoodFields,
  })
  .strict();

export const previewItemSchema = z
  .object({
    itemId: z.string().trim().min(1).max(120),
    status: z.enum(["active", "removed"]),
    ...layeredFoodFields,
    components: z.array(previewComponentSchema).max(50),
  })
  .strict();

const correctionBase = {
  correctionId: z.string().trim().min(1).max(120),
  correctedAt: z.string().datetime({ offset: true }),
  note: z.string().trim().min(1).max(500).nullable(),
};

export const userConfirmedCorrectionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...correctionBase,
      kind: z.literal("resize_item"),
      itemId: z.string().trim().min(1).max(120),
      quantity: z.number().finite().positive(),
      unit: servingUnitSchema,
    })
    .strict(),
  z
    .object({
      ...correctionBase,
      kind: z.literal("remove_item"),
      itemId: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      ...correctionBase,
      kind: z.literal("resize_component"),
      itemId: z.string().trim().min(1).max(120),
      componentId: z.string().trim().min(1).max(120),
      quantity: z.number().finite().positive(),
      unit: servingUnitSchema,
    })
    .strict(),
  z
    .object({
      ...correctionBase,
      kind: z.literal("remove_component"),
      itemId: z.string().trim().min(1).max(120),
      componentId: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      ...correctionBase,
      kind: z.literal("replace_component"),
      itemId: z.string().trim().min(1).max(120),
      componentId: z.string().trim().min(1).max(120),
      replacement: resolvedFoodValuesSchema,
    })
    .strict(),
]);

export const foodPreviewSchema = z
  .object({
    previewId: z.string().trim().min(1).max(120),
    revision: z.number().int().positive(),
    status: z.enum(["draft", "confirmed", "expired"]),
    items: z.array(previewItemSchema).min(1).max(100),
    correctionHistory: z.array(userConfirmedCorrectionSchema).max(200),
  })
  .strict();

export const calculatedTotalsSchema = nutrientAmountsSchema.extend({
  itemCount: z.number().int().nonnegative(),
});

export const confirmedComponentSnapshotSchema = previewComponentSchema
  .omit({ providerMatches: true, resolved: true })
  .extend({ confirmed: resolvedFoodValuesSchema })
  .strict();

export const confirmedItemSnapshotSchema = previewItemSchema
  .omit({ providerMatches: true, resolved: true, components: true })
  .extend({
    confirmed: resolvedFoodValuesSchema,
    components: z.array(confirmedComponentSnapshotSchema).max(50),
  })
  .strict();

export const confirmedFoodSnapshotSchema = z
  .object({
    snapshotId: z.string().trim().min(1).max(160),
    sourcePreviewId: z.string().trim().min(1).max(120),
    sourceRevision: z.number().int().positive(),
    confirmedAt: z.string().datetime({ offset: true }),
    items: z.array(confirmedItemSnapshotSchema).min(1).max(100),
    totals: calculatedTotalsSchema,
    confidence: confidenceSchema,
    uncertainties: z.array(uncertaintySchema).max(500),
    correctionHistory: z.array(userConfirmedCorrectionSchema).max(200),
  })
  .strict();

export const chatGptCandidateListSchema = z
  .array(chatGptCandidateSchema)
  .min(1)
  .max(100);
