import {
  FoodTargetNotFoundError,
  StalePreviewRevisionError,
  calculatePreviewTotals,
  createConfirmedFoodSnapshot,
  createFoodPreview,
  reviseFoodPreview,
} from "..";
import type {
  ChatGptCandidate,
  FoodPreview,
  NutrientAmounts,
  NutritionProviderMatch,
  PreviewComponent,
  PreviewItem,
  Provenance,
  ResolvedFoodValues,
  ServingUnit,
  Uncertainty,
  UserConfirmedCorrection,
} from "..";

const NOW = "2026-07-12T12:00:00+08:00";

function nutrients(caloriesKcal: number): NutrientAmounts {
  return {
    caloriesKcal,
    proteinG: caloriesKcal / 20,
    carbohydratesG: caloriesKcal / 10,
    fatG: caloriesKcal / 40,
  };
}

function provenance(recordId: string, isEstimate = false): Provenance {
  return {
    sourceName: "Mock nutrition catalog",
    sourceRecordId: recordId,
    sourceVersion: "fixture-v1",
    observedAt: NOW,
    market: "PH",
    servingDescription: "per serving",
    attribution: "TEST FIXTURE - not a live provider",
    isEstimate,
  };
}

function interpretation(
  id: string,
  name: string,
  quantity: number,
  unit: ServingUnit,
  uncertainties: Uncertainty[] = [],
): ChatGptCandidate {
  return {
    candidateId: `candidate-${id}`,
    name,
    brand: null,
    restaurant: null,
    quantity,
    unit,
    preparation: null,
    confidence: "medium",
    evidence: {
      kind: "observed_image_item",
      observationId: `observation-${id}`,
      visualEvidence: `Visible ${name}`,
      regionLabel: null,
    },
    uncertainties,
    possibleMatches: [name],
  };
}

function providerMatch(
  id: string,
  name: string,
  amount: number,
  unit: ServingUnit,
  calories: number,
  uncertainties: Uncertainty[] = [],
): NutritionProviderMatch {
  return {
    matchId: `match-${id}`,
    canonicalFoodId: `food-${id}`,
    displayName: name,
    matchConfidence: "high",
    nutritionConfidence: "high",
    nutritionBasis: {
      amount,
      unit,
      nutrients: nutrients(calories),
    },
    provenance: provenance(id),
    uncertainties,
    marketVariant: "Philippines",
  };
}

function resolved(
  id: string,
  name: string,
  quantity: number,
  unit: ServingUnit,
  caloriesPerBasis: number,
  basisAmount = 1,
  uncertainties: Uncertainty[] = [],
): ResolvedFoodValues {
  return {
    displayName: name,
    canonicalFoodId: `food-${id}`,
    quantity,
    unit,
    preparation: null,
    nutritionBasis: {
      amount: basisAmount,
      unit,
      nutrients: nutrients(caloriesPerBasis),
    },
    provenance: [provenance(id)],
    confidence: "high",
    uncertainties,
  };
}

function component(
  id: string,
  role: PreviewComponent["role"],
  name: string,
  quantity: number,
  unit: ServingUnit,
  calories: number,
  uncertainties: Uncertainty[] = [],
): PreviewComponent {
  return {
    componentId: id,
    role,
    status: "active",
    interpretation: interpretation(id, name, quantity, unit, uncertainties),
    providerMatches: [providerMatch(id, name, 1, unit, calories)],
    resolved: resolved(id, name, quantity, unit, calories, 1),
  };
}

function item(
  id: string,
  name: string,
  calories: number,
  components: PreviewComponent[] = [],
): PreviewItem {
  return {
    itemId: id,
    status: "active",
    interpretation: interpretation(id, name, 1, "serving"),
    providerMatches: [providerMatch(id, name, 1, "serving", calories)],
    // Parent nutrition is intentionally present even for a decomposed combo.
    resolved: resolved(id, name, 1, "serving", calories),
    components,
  };
}

function preview(items: PreviewItem[]): FoodPreview {
  return createFoodPreview({
    previewId: "preview-1",
    revision: 1,
    status: "draft",
    items,
    correctionHistory: [],
  });
}

function correction<T extends UserConfirmedCorrection>(value: T): T {
  return value;
}

describe("food preview relationships and corrections", () => {
  test("rejects an initial preview whose resolved unit cannot use its nutrition basis", () => {
    const invalid = item("rice", "White rice", 205);
    invalid.resolved.unit = "cup";

    expect(() => preview([invalid])).toThrow(
      "Unit cup cannot be scaled from a serving nutrition basis.",
    );
  });

  test("rejects a resize that would create an incompatible resolved unit", () => {
    const original = preview([item("rice", "White rice", 205)]);

    expect(() =>
      reviseFoodPreview(
        original,
        1,
        correction({
          correctionId: "correction-unit-mismatch",
          correctedAt: NOW,
          note: "Invalid unit change",
          kind: "resize_item",
          itemId: "rice",
          quantity: 1,
          unit: "cup",
        }),
      ),
    ).toThrow("Unit cup cannot be scaled from a serving nutrition basis.");
  });

  test("targets only the named component", () => {
    const original = preview([
      item("meal", "Chicken meal", 999, [
        component("chicken", "main_dish", "Fried chicken", 1, "piece", 250),
        component("rice", "rice", "White rice", 1, "serving", 205),
      ]),
    ]);

    const revised = reviseFoodPreview(
      original,
      1,
      correction({
        correctionId: "correction-1",
        correctedAt: NOW,
        note: "Half rice lang",
        kind: "resize_component",
        itemId: "meal",
        componentId: "rice",
        quantity: 0.5,
        unit: "serving",
      }),
    );

    expect(revised.revision).toBe(2);
    expect(revised.items[0]?.components[0]?.resolved.quantity).toBe(1);
    expect(revised.items[0]?.components[1]?.resolved.quantity).toBe(0.5);
    expect(original.items[0]?.components[1]?.resolved.quantity).toBe(1);
  });

  test("removing a component changes the total without deleting its audit state", () => {
    const original = preview([
      item("meal", "Chicken meal", 999, [
        component("chicken", "main_dish", "Fried chicken", 1, "piece", 250),
        component("rice", "rice", "White rice", 1, "serving", 205),
        component("drink", "drink", "Soft drink", 1, "serving", 140),
      ]),
    ]);

    const revised = reviseFoodPreview(
      original,
      1,
      correction({
        correctionId: "correction-2",
        correctedAt: NOW,
        note: "No drink",
        kind: "remove_component",
        itemId: "meal",
        componentId: "drink",
      }),
    );

    expect(calculatePreviewTotals(original).caloriesKcal).toBe(595);
    expect(calculatePreviewTotals(revised).caloriesKcal).toBe(455);
    expect(revised.items[0]?.components[2]?.status).toBe("removed");
  });

  test("changing rice serving count scales its nutrition", () => {
    const original = preview([
      item("rice-order", "Unlimited rice", 999, [
        component("rice", "rice", "White rice", 1, "serving", 205),
      ]),
    ]);

    const revised = reviseFoodPreview(
      original,
      1,
      correction({
        correctionId: "correction-3",
        correctedAt: NOW,
        note: "I had three servings",
        kind: "resize_component",
        itemId: "rice-order",
        componentId: "rice",
        quantity: 3,
        unit: "serving",
      }),
    );

    expect(calculatePreviewTotals(revised).caloriesKcal).toBe(615);
  });

  test("a known restaurant combo is calculated from components, not an opaque parent total", () => {
    const combo = preview([
      item("combo", "One-piece chicken meal", 1234, [
        component("chicken", "main_dish", "Fried chicken", 1, "piece", 250),
        component("rice", "rice", "White rice", 1, "serving", 205),
        component("gravy", "sauce", "Gravy", 1, "serving", 30),
        component("drink", "drink", "Soft drink", 1, "serving", 140),
      ]),
    ]);

    expect(calculatePreviewTotals(combo).caloriesKcal).toBe(625);
    expect(combo.items[0]?.components).toHaveLength(4);
  });

  test("an unknown correction target fails instead of changing a similarly named component", () => {
    const original = preview([
      item("meal", "Meal", 999, [
        component("rice-a", "rice", "White rice", 1, "serving", 205),
      ]),
    ]);

    expect(() =>
      reviseFoodPreview(
        original,
        1,
        correction({
          correctionId: "correction-4",
          correctedAt: NOW,
          note: null,
          kind: "remove_component",
          itemId: "meal",
          componentId: "rice-b",
        }),
      ),
    ).toThrow(FoodTargetNotFoundError);
  });
});

describe("food preview trust layers and history", () => {
  const oilUncertainty: Uncertainty = {
    category: "cooking_oil",
    note: "Oil quantity cannot be determined from the image.",
    confidence: "low",
    source: "chatgpt",
  };

  test("image uncertainty and confidence survive into the confirmed snapshot", () => {
    const adobo = item("adobo", "Chicken adobo", 320);
    adobo.interpretation.uncertainties = [oilUncertainty];
    const snapshot = createConfirmedFoodSnapshot(preview([adobo]), 1, NOW);

    expect(snapshot.uncertainties).toContainEqual(oilUncertainty);
    expect(snapshot.confidence).toBe("low");
  });

  test("provider provenance is copied with exact confirmed nutrition", () => {
    const snapshot = createConfirmedFoodSnapshot(
      preview([item("adobo", "Chicken adobo", 320)]),
      1,
      NOW,
    );

    expect(snapshot.items[0]?.confirmed.provenance[0]).toMatchObject({
      sourceName: "Mock nutrition catalog",
      sourceRecordId: "adobo",
      isEstimate: false,
    });
    expect(
      snapshot.items[0]?.confirmed.nutritionBasis.nutrients.caloriesKcal,
    ).toBe(320);
  });

  test("stale revisions cannot be revised or snapshotted", () => {
    const original = preview([item("egg", "Boiled egg", 78)]);
    const revised = reviseFoodPreview(
      original,
      1,
      correction({
        correctionId: "correction-5",
        correctedAt: NOW,
        note: "Two eggs",
        kind: "resize_item",
        itemId: "egg",
        quantity: 2,
        unit: "serving",
      }),
    );

    expect(() => createConfirmedFoodSnapshot(revised, 1, NOW)).toThrow(
      StalePreviewRevisionError,
    );
    expect(() =>
      reviseFoodPreview(
        revised,
        1,
        correction({
          correctionId: "correction-6",
          correctedAt: NOW,
          note: null,
          kind: "remove_item",
          itemId: "egg",
        }),
      ),
    ).toThrow(StalePreviewRevisionError);
  });

  test("history is immutable and unaffected by later provider data changes", () => {
    const original = preview([item("egg", "Boiled egg", 78)]);
    const snapshot = createConfirmedFoodSnapshot(original, 1, NOW);

    original.items[0]!.providerMatches[0]!.nutritionBasis!.nutrients.caloriesKcal = 999;
    original.items[0]!.resolved.nutritionBasis.nutrients.caloriesKcal = 999;

    expect(snapshot.totals.caloriesKcal).toBe(78);
    expect(
      snapshot.items[0]?.confirmed.nutritionBasis.nutrients.caloriesKcal,
    ).toBe(78);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(
      Object.isFrozen(snapshot.items[0]?.confirmed.nutritionBasis.nutrients),
    ).toBe(true);
  });

  test("interpretation, provider match, and confirmed value remain separate", () => {
    const food = item("dish", "Provider dish", 200);
    food.interpretation.name = "ChatGPT probable dish";
    food.providerMatches[0]!.displayName = "Provider catalog dish";
    food.resolved.displayName = "User-reviewed dish";

    const current = preview([food]);
    const snapshot = createConfirmedFoodSnapshot(current, 1, NOW);

    expect(current.items[0]?.interpretation.name).toBe("ChatGPT probable dish");
    expect(current.items[0]?.providerMatches[0]?.displayName).toBe(
      "Provider catalog dish",
    );
    expect(snapshot.items[0]?.confirmed.displayName).toBe("User-reviewed dish");
  });
});
