import {
  buildBarcodeConfirmationCommand,
  createBarcodePreviewState,
  presentBarcodePreview,
  qualifyBarcodeServing,
  reviseBarcodePreview,
} from "..";

describe("Filipino serving qualification", () => {
  it.each(["baso", "mangkok", "sandok", "piraso", "balot", "supot"] as const)(
    "does not invent a universal weight for %s",
    (term) => {
      expect(
        qualifyBarcodeServing({ quantity: 1, term, measurableAmount: null }),
      ).toMatchObject({
        clarificationRequired: true,
        measurableAmount: null,
      });
    },
  );

  it("accepts a traceable package-label measure without making it universal", () => {
    expect(
      qualifyBarcodeServing({
        quantity: 1,
        term: "piraso",
        measurableAmount: {
          quantity: 32,
          unit: "g",
          sourceDescription: "current package label",
        },
      }),
    ).toMatchObject({
      clarificationRequired: false,
      measurableAmount: {
        quantity: 32,
        unit: "g",
        sourceDescription: "current package label",
      },
    });
  });
});

describe("barcode current-preview confirmation", () => {
  const serving = qualifyBarcodeServing({
    quantity: 1,
    term: "bottle",
    measurableAmount: {
      quantity: 250,
      unit: "ml",
      sourceDescription: "current package label",
    },
  });

  function draft() {
    return createBarcodePreviewState({
      serverPreviewId: "44444444-4444-4444-8444-444444444444",
      revision: 1,
      selectedProductId: "product-ph-001",
      mealType: "lunch",
      serving,
    });
  }

  it("keeps a new barcode preview non-permanent and non-confirmable until presented", () => {
    const preview = draft();
    expect(preview).toMatchObject({
      sourceKind: "barcode",
      revision: 1,
      presentedRevision: null,
      status: "draft",
      permanentWrite: false,
    });
    expect(
      buildBarcodeConfirmationCommand(preview, {
        revision: 1,
        explicitConfirmation: true,
        idempotencyKey: "barcode-confirm-0001",
      }),
    ).toEqual({ ok: false, reason: "preview_not_presented" });
  });

  it("requires explicit confirmation of the exact presented revision", () => {
    const presented = presentBarcodePreview(draft());

    expect(
      buildBarcodeConfirmationCommand(presented, {
        revision: 1,
        explicitConfirmation: false,
        idempotencyKey: "barcode-confirm-0001",
      }),
    ).toEqual({ ok: false, reason: "explicit_confirmation_required" });

    const decision = buildBarcodeConfirmationCommand(presented, {
      revision: 1,
      explicitConfirmation: true,
      idempotencyKey: "barcode-confirm-0001",
    });
    expect(decision).toEqual({
      ok: true,
      rpc: "confirm_food_log",
      args: {
        p_preview_id: "44444444-4444-4444-8444-444444444444",
        p_confirmed_revision: 1,
        p_confirmation: true,
        p_idempotency_key: "barcode-confirm-0001",
      },
    });
    expect(JSON.stringify(decision)).not.toMatch(
      /user_id|total_calories|total_/i,
    );
  });

  it("invalidates presentation after a serving or meal revision", () => {
    const revised = reviseBarcodePreview(presentBarcodePreview(draft()), {
      mealType: "dinner",
    });
    expect(revised).toMatchObject({
      revision: 2,
      presentedRevision: null,
      status: "draft",
      permanentWrite: false,
    });
    expect(
      buildBarcodeConfirmationCommand(revised, {
        revision: 1,
        explicitConfirmation: true,
        idempotencyKey: "barcode-confirm-0002",
      }),
    ).toEqual({ ok: false, reason: "preview_not_presented" });

    expect(
      buildBarcodeConfirmationCommand(presentBarcodePreview(revised), {
        revision: 1,
        explicitConfirmation: true,
        idempotencyKey: "barcode-confirm-0002",
      }),
    ).toEqual({ ok: false, reason: "stale_revision" });
  });

  it("rejects an unresolved Filipino serving before preview creation", () => {
    const unresolved = qualifyBarcodeServing({
      quantity: 1,
      term: "supot",
      measurableAmount: null,
    });
    expect(() =>
      createBarcodePreviewState({
        serverPreviewId: "preview-unresolved",
        revision: 1,
        selectedProductId: "product-unresolved",
        mealType: "snack",
        serving: unresolved,
      }),
    ).toThrow("Serving clarification is required before preview.");
  });
});
