import type {
  BarcodeConfirmationDecision,
  BarcodeMealType,
  BarcodePreviewState,
  QualifiedServingSelection,
} from "./types";

export function createBarcodePreviewState(input: {
  serverPreviewId: string;
  revision: number;
  selectedProductId: string;
  mealType: BarcodeMealType;
  serving: QualifiedServingSelection;
}): BarcodePreviewState {
  if (!input.serverPreviewId || input.revision < 1) {
    throw new Error("A server preview and positive revision are required.");
  }
  if (input.serving.clarificationRequired) {
    throw new Error("Serving clarification is required before preview.");
  }

  return {
    sourceKind: "barcode",
    serverPreviewId: input.serverPreviewId,
    revision: input.revision,
    presentedRevision: null,
    status: "draft",
    selectedProductId: input.selectedProductId,
    mealType: input.mealType,
    serving: input.serving,
    permanentWrite: false,
  };
}

export function presentBarcodePreview(
  preview: BarcodePreviewState,
): BarcodePreviewState {
  return {
    ...preview,
    status: "ready",
    presentedRevision: preview.revision,
    permanentWrite: false,
  };
}

export function reviseBarcodePreview(
  preview: BarcodePreviewState,
  changes: Partial<
    Pick<BarcodePreviewState, "selectedProductId" | "mealType" | "serving">
  >,
): BarcodePreviewState {
  const serving = changes.serving ?? preview.serving;
  if (serving.clarificationRequired) {
    throw new Error("Serving clarification is required before preview.");
  }
  return {
    ...preview,
    ...changes,
    serving,
    revision: preview.revision + 1,
    presentedRevision: null,
    status: "draft",
    permanentWrite: false,
  };
}

export function buildBarcodeConfirmationCommand(
  preview: BarcodePreviewState,
  request: {
    revision: number;
    explicitConfirmation: boolean;
    idempotencyKey: string;
  },
): BarcodeConfirmationDecision {
  if (request.explicitConfirmation !== true) {
    return { ok: false, reason: "explicit_confirmation_required" };
  }
  if (
    preview.status !== "ready" ||
    preview.presentedRevision !== preview.revision
  ) {
    return { ok: false, reason: "preview_not_presented" };
  }
  if (request.revision !== preview.revision) {
    return { ok: false, reason: "stale_revision" };
  }
  if (
    request.idempotencyKey.length < 8 ||
    request.idempotencyKey.length > 200
  ) {
    return { ok: false, reason: "invalid_idempotency_key" };
  }

  return {
    ok: true,
    rpc: "confirm_food_log",
    args: {
      p_preview_id: preview.serverPreviewId,
      p_confirmed_revision: preview.revision,
      p_confirmation: true,
      p_idempotency_key: request.idempotencyKey,
    },
  };
}
