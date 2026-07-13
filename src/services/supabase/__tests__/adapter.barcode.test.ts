import { mobileApi } from "../adapter";

const mockRpc = jest.fn();

jest.mock("../client", () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}));

describe("mobile barcode adapter", () => {
  beforeEach(() => mockRpc.mockReset());

  it("requests the Philippine lookup and preserves server provenance and warnings", async () => {
    mockRpc.mockResolvedValue({
      error: null,
      data: [
        {
          scan_session_id: "scan-1",
          lookup_status: "found",
          canonical_barcode: "04006381333931",
          food_product_id: "product-1",
          serving_id: "serving-1",
          canonical_name: "Peanut snack",
          brand_name: "Sample Brand",
          serving_description: "1 pack (30 g)",
          calories: 170,
          protein_g: 6,
          carbohydrates_g: 12,
          fat_g: 11,
          provider: "licensed_catalog",
          attribution: "Package label observed 2026-06-01",
          market_status: "foreign",
          market_warning: "This is a foreign-market label.",
          source_warning: "Confirm the package version before logging.",
          uncertainty: ["Serving size can vary by market."],
        },
      ],
    });

    await expect(mobileApi.lookupBarcode("4006381333931")).resolves.toEqual({
      status: "found",
      scanSessionId: "scan-1",
      barcode: "04006381333931",
      warnings: [],
      candidates: [
        expect.objectContaining({
          productId: "product-1",
          servingId: "serving-1",
          providerName: "licensed catalog",
          marketStatus: "foreign",
          warnings: [
            "This is a foreign-market label.",
            "Confirm the package version before logging.",
            "Serving size can vary by market.",
          ],
        }),
      ],
    });
    expect(mockRpc).toHaveBeenCalledWith("lookup_barcode_candidates", {
      p_barcode: "4006381333931",
      p_market_country_code: "PH",
    });
  });

  it("maps the server-calculated barcode preview without submitting nutrition totals", async () => {
    mockRpc.mockResolvedValue({
      error: null,
      data: [
        {
          preview_id: "preview-1",
          revision_number: 1,
          status: "ready",
          expires_at: "2026-07-13T12:30:00+08:00",
          meal_type: "lunch",
          consumed_at: "2026-07-13T12:00:00+08:00",
          total_calories: 340,
          total_protein_g: 12,
          total_carbohydrates_g: 24,
          total_fat_g: 22,
          food_name: "Peanut snack",
          brand_name: "Sample Brand",
          serving_count: 2,
          serving_description: "2 packs",
          serving_unit: "pack",
          provider: "licensed_catalog",
          confidence: 0.9,
          market_warning: "Market is not verified.",
          source_warning: null,
          uncertainty: [],
        },
      ],
    });

    const result = await mobileApi.createBarcodePreview({
      scanSessionId: "scan-1",
      foodProductId: "product-1",
      servingId: "serving-1",
      servingCount: 2,
      mealType: "lunch",
      consumedAt: "2026-07-13T12:00:00+08:00",
      originalDescription: "Sample Brand Peanut snack",
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: "preview-1",
        revision: 1,
        totalCalories: 340,
        items: [
          expect.objectContaining({
            foodName: "Peanut snack",
            calories: 340,
            source: "licensed_catalog",
            uncertainty: ["Market is not verified."],
          }),
        ],
      }),
    );
    const [, args] = mockRpc.mock.calls[0];
    expect(args).toEqual(
      expect.objectContaining({
        p_scan_session_id: "scan-1",
        p_food_product_id: "product-1",
        p_serving_id: "serving-1",
        p_serving_count: 2,
        p_time_zone: "Asia/Manila",
      }),
    );
    expect(args).not.toHaveProperty("p_user_id");
    expect(args).not.toHaveProperty("p_calories");
    expect(args).not.toHaveProperty("p_protein_g");
  });
});
