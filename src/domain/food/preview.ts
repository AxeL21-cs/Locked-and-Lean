import {
  confirmedFoodSnapshotSchema,
  foodPreviewSchema,
  userConfirmedCorrectionSchema,
} from "./schemas";
import type {
  CalculatedTotals,
  Confidence,
  ConfirmedFoodSnapshot,
  FoodPreview,
  NutrientAmounts,
  PreviewComponent,
  PreviewItem,
  ResolvedFoodValues,
  Uncertainty,
  UserConfirmedCorrection,
} from "./types";

export class FoodDomainError extends Error {}

export class StalePreviewRevisionError extends FoodDomainError {
  constructor(
    readonly expectedRevision: number,
    readonly currentRevision: number,
  ) {
    super(
      `Preview revision ${expectedRevision} is stale; current revision is ${currentRevision}.`,
    );
    this.name = "StalePreviewRevisionError";
  }
}

export class FoodTargetNotFoundError extends FoodDomainError {
  constructor(target: string) {
    super(`Food preview target was not found: ${target}.`);
    this.name = "FoodTargetNotFoundError";
  }
}

export class FoodPreviewStateError extends FoodDomainError {
  constructor(status: FoodPreview["status"]) {
    super(`A preview with status ${status} cannot be revised or confirmed.`);
    this.name = "FoodPreviewStateError";
  }
}

const ZERO_NUTRIENTS: NutrientAmounts = {
  caloriesKcal: 0,
  proteinG: 0,
  carbohydratesG: 0,
  fatG: 0,
};

const CONFIDENCE_RANK: Record<Confidence, number> = {
  high: 0,
  medium: 1,
  low: 2,
  unknown: 3,
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addNutrition(
  left: NutrientAmounts,
  right: NutrientAmounts,
): NutrientAmounts {
  return {
    caloriesKcal: round(left.caloriesKcal + right.caloriesKcal),
    proteinG: round(left.proteinG + right.proteinG),
    carbohydratesG: round(left.carbohydratesG + right.carbohydratesG),
    fatG: round(left.fatG + right.fatG),
  };
}

export function calculateResolvedNutrition(
  values: ResolvedFoodValues,
): NutrientAmounts {
  if (values.unit !== values.nutritionBasis.unit) {
    throw new FoodDomainError(
      `Cannot scale ${values.unit} using a ${values.nutritionBasis.unit} nutrition basis.`,
    );
  }

  const factor = values.quantity / values.nutritionBasis.amount;
  return {
    caloriesKcal: round(values.nutritionBasis.nutrients.caloriesKcal * factor),
    proteinG: round(values.nutritionBasis.nutrients.proteinG * factor),
    carbohydratesG: round(
      values.nutritionBasis.nutrients.carbohydratesG * factor,
    ),
    fatG: round(values.nutritionBasis.nutrients.fatG * factor),
  };
}

function calculateComponentTotals(
  components: PreviewComponent[],
): NutrientAmounts {
  return components
    .filter((component) => component.status === "active")
    .reduce(
      (total, component) =>
        addNutrition(total, calculateResolvedNutrition(component.resolved)),
      ZERO_NUTRIENTS,
    );
}

export function calculateItemTotals(item: PreviewItem): NutrientAmounts {
  if (item.status === "removed") {
    return ZERO_NUTRIENTS;
  }

  // A known combo is deliberately calculated from its editable components. The
  // menu item's aggregate value cannot silently override the decomposition.
  if (item.components.length > 0) {
    return calculateComponentTotals(item.components);
  }

  return calculateResolvedNutrition(item.resolved);
}

export function calculatePreviewTotals(
  previewInput: FoodPreview,
): CalculatedTotals {
  const preview = foodPreviewSchema.parse(previewInput);
  const activeItems = preview.items.filter((item) => item.status === "active");
  const totals = activeItems.reduce(
    (total, item) => addNutrition(total, calculateItemTotals(item)),
    ZERO_NUTRIENTS,
  );

  return {
    ...totals,
    itemCount: activeItems.length,
  };
}

function findItem(preview: FoodPreview, itemId: string): PreviewItem {
  const item = preview.items.find((candidate) => candidate.itemId === itemId);
  if (!item) {
    throw new FoodTargetNotFoundError(`item:${itemId}`);
  }
  return item;
}

function findComponent(
  item: PreviewItem,
  componentId: string,
): PreviewComponent {
  const component = item.components.find(
    (candidate) => candidate.componentId === componentId,
  );
  if (!component) {
    throw new FoodTargetNotFoundError(
      `item:${item.itemId}/component:${componentId}`,
    );
  }
  return component;
}

function assertUniqueTargets(preview: FoodPreview): void {
  const itemIds = new Set<string>();
  const componentIds = new Set<string>();

  for (const item of preview.items) {
    if (itemIds.has(item.itemId)) {
      throw new FoodDomainError(`Duplicate item ID: ${item.itemId}.`);
    }
    itemIds.add(item.itemId);

    for (const component of item.components) {
      if (componentIds.has(component.componentId)) {
        throw new FoodDomainError(
          `Duplicate component ID: ${component.componentId}.`,
        );
      }
      componentIds.add(component.componentId);
    }
  }
}

function requireCurrentDraft(
  preview: FoodPreview,
  expectedRevision: number,
): void {
  if (preview.status !== "draft") {
    throw new FoodPreviewStateError(preview.status);
  }
  if (preview.revision !== expectedRevision) {
    throw new StalePreviewRevisionError(expectedRevision, preview.revision);
  }
}

export function createFoodPreview(input: FoodPreview): FoodPreview {
  const preview = foodPreviewSchema.parse(input);
  assertUniqueTargets(preview);
  return clone(preview);
}

export function reviseFoodPreview(
  previewInput: FoodPreview,
  expectedRevision: number,
  correctionInput: UserConfirmedCorrection,
): FoodPreview {
  const preview = createFoodPreview(previewInput);
  const correction = userConfirmedCorrectionSchema.parse(correctionInput);
  requireCurrentDraft(preview, expectedRevision);

  const next = clone(preview);
  const item = findItem(next, correction.itemId);

  switch (correction.kind) {
    case "resize_item":
      item.resolved.quantity = correction.quantity;
      item.resolved.unit = correction.unit;
      break;
    case "remove_item":
      item.status = "removed";
      break;
    case "resize_component": {
      const component = findComponent(item, correction.componentId);
      component.resolved.quantity = correction.quantity;
      component.resolved.unit = correction.unit;
      break;
    }
    case "remove_component":
      findComponent(item, correction.componentId).status = "removed";
      break;
    case "replace_component": {
      const component = findComponent(item, correction.componentId);
      component.resolved = clone(correction.replacement);
      component.status = "active";
      break;
    }
  }

  next.revision += 1;
  next.correctionHistory.push(correction);
  return createFoodPreview(next);
}

function selectedProviderUncertainties(
  item: Pick<PreviewItem, "providerMatches" | "resolved">,
): Uncertainty[] {
  const selectedKeys = new Set(
    item.resolved.provenance.map(
      (source) => `${source.sourceName}\u0000${source.sourceRecordId ?? ""}`,
    ),
  );

  return item.providerMatches.flatMap((match) => {
    const key = `${match.provenance.sourceName}\u0000${match.provenance.sourceRecordId ?? ""}`;
    return selectedKeys.has(key) ? match.uncertainties : [];
  });
}

function layerUncertainties(
  layer: Pick<PreviewItem, "interpretation" | "providerMatches" | "resolved">,
): Uncertainty[] {
  return [
    ...layer.interpretation.uncertainties,
    ...selectedProviderUncertainties(layer),
    ...layer.resolved.uncertainties,
  ];
}

function uncertaintyKey(uncertainty: Uncertainty): string {
  return [
    uncertainty.category,
    uncertainty.note,
    uncertainty.confidence,
    uncertainty.source,
  ].join("\u0000");
}

export function collectPreviewUncertainties(
  previewInput: FoodPreview,
): Uncertainty[] {
  const preview = createFoodPreview(previewInput);
  const seen = new Set<string>();
  const result: Uncertainty[] = [];

  const add = (uncertainty: Uncertainty) => {
    const key = uncertaintyKey(uncertainty);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(clone(uncertainty));
    }
  };

  for (const item of preview.items.filter(
    (candidate) => candidate.status === "active",
  )) {
    layerUncertainties(item).forEach(add);
    item.components
      .filter((component) => component.status === "active")
      .flatMap(layerUncertainties)
      .forEach(add);
  }

  return result;
}

function layerConfidence(
  layer: Pick<PreviewItem, "interpretation" | "providerMatches" | "resolved">,
): Confidence[] {
  const selectedKeys = new Set(
    layer.resolved.provenance.map(
      (source) => `${source.sourceName}\u0000${source.sourceRecordId ?? ""}`,
    ),
  );
  const providerConfidence = layer.providerMatches.flatMap((match) => {
    const key = `${match.provenance.sourceName}\u0000${match.provenance.sourceRecordId ?? ""}`;
    return selectedKeys.has(key)
      ? [match.matchConfidence, match.nutritionConfidence]
      : [];
  });

  return [
    layer.interpretation.confidence,
    layer.resolved.confidence,
    ...providerConfidence,
  ];
}

export function calculatePreviewConfidence(
  previewInput: FoodPreview,
): Confidence {
  const preview = createFoodPreview(previewInput);
  const confidences: Confidence[] = [];

  for (const item of preview.items.filter(
    (candidate) => candidate.status === "active",
  )) {
    confidences.push(...layerConfidence(item));
    for (const component of item.components.filter(
      (candidate) => candidate.status === "active",
    )) {
      confidences.push(...layerConfidence(component));
    }
  }
  confidences.push(
    ...collectPreviewUncertainties(preview).map((item) => item.confidence),
  );

  return confidences.reduce<Confidence>(
    (worst, current) =>
      CONFIDENCE_RANK[current] > CONFIDENCE_RANK[worst] ? current : worst,
    "high",
  );
}

function freezeDeep<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach((child) => freezeDeep(child));
  }
  return value;
}

export function createConfirmedFoodSnapshot(
  previewInput: FoodPreview,
  expectedRevision: number,
  confirmedAt: string,
): Readonly<ConfirmedFoodSnapshot> {
  const preview = createFoodPreview(previewInput);
  requireCurrentDraft(preview, expectedRevision);

  const items = preview.items.map((item) => ({
    itemId: item.itemId,
    status: item.status,
    interpretation: clone(item.interpretation),
    confirmed: clone(item.resolved),
    components: item.components.map((component) => ({
      componentId: component.componentId,
      role: component.role,
      status: component.status,
      interpretation: clone(component.interpretation),
      confirmed: clone(component.resolved),
    })),
  }));

  const snapshot = confirmedFoodSnapshotSchema.parse({
    snapshotId: `${preview.previewId}:r${preview.revision}`,
    sourcePreviewId: preview.previewId,
    sourceRevision: preview.revision,
    confirmedAt,
    items,
    totals: calculatePreviewTotals(preview),
    confidence: calculatePreviewConfidence(preview),
    uncertainties: collectPreviewUncertainties(preview),
    correctionHistory: clone(preview.correctionHistory),
  });

  return freezeDeep(snapshot);
}
