import { mobileApi } from "../adapter";

const mockRpc = jest.fn();

jest.mock("../client", () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}));

describe("mobile history and progress adapter", () => {
  beforeEach(() => mockRpc.mockReset());

  it("maps server-calculated calendar days without filling unknown macros", async () => {
    mockRpc.mockResolvedValue({
      error: null,
      data: [
        {
          local_date: "2026-07-13",
          entry_count: 2,
          consumed_calories: 1600,
          consumed_protein_g: null,
          consumed_carbohydrates_g: null,
          consumed_fat_g: null,
          macro_data_complete: false,
          calorie_target: 1800,
          protein_target_g: 120,
          carbohydrate_target_g: 200,
          fat_target_g: 60,
          weight_kg: 70,
          has_entries: true,
          server_calculated_at: "2026-07-13T12:00:00Z",
        },
      ],
    });
    await expect(
      mobileApi.getCalendarHistory("2026-07-13", "2026-07-13"),
    ).resolves.toEqual([
      expect.objectContaining({
        localDate: "2026-07-13",
        calories: 1600,
        proteinG: null,
        carbohydratesG: null,
        fatG: null,
        macroDataComplete: false,
      }),
    ]);
    expect(mockRpc).toHaveBeenCalledWith("get_calendar_history", {
      p_start_date: "2026-07-13",
      p_end_date: "2026-07-13",
    });
  });

  it("maps immutable day entry item provenance and uncertainty", async () => {
    mockRpc.mockResolvedValue({
      error: null,
      data: [
        {
          entry_id: "entry-1",
          source_kind: "barcode",
          meal_type: "lunch",
          consumed_at: "2026-07-13T12:00:00+08:00",
          local_date: "2026-07-13",
          original_description: "Peanut snack",
          total_calories: 170,
          total_protein_g: null,
          total_carbohydrates_g: 12,
          total_fat_g: 11,
          macro_data_complete: false,
          day_entry_count: 1,
          is_truncated: false,
          items: [
            {
              id: "item-1",
              food_name: "Peanut snack",
              quantity: 1,
              unit: "pack",
              calories: 170,
              protein_g: null,
              carbohydrates_g: 12,
              fat_g: 11,
              provider: "catalog",
              provider_version: "2026-06",
              attribution: "Package label",
              is_estimated: false,
              confidence: 0.8,
              uncertainty: ["Market version not verified."],
            },
          ],
        },
      ],
    });
    const result = await mobileApi.getDayHistory("2026-07-13");
    expect(result.entries[0]).toEqual(
      expect.objectContaining({
        id: "entry-1",
        proteinG: null,
        items: [
          expect.objectContaining({
            provider: "catalog",
            providerVersion: "2026-06",
            attribution: "Package label",
            uncertainty: ["Market version not verified."],
          }),
        ],
      }),
    );
  });

  it("uses server-computed progress averages and weight changes", async () => {
    mockRpc
      .mockResolvedValueOnce({
        error: null,
        data: [
          {
            start_date: "2026-06-14",
            end_date: "2026-07-13",
            range_days: 30,
            logged_days: 10,
            total_entries: 24,
            average_daily_calories: 1750,
            complete_macro_days: 8,
            average_daily_protein_g: 110,
            average_daily_carbohydrates_g: 190,
            average_daily_fat_g: 55,
            first_weight_date: "2026-06-14",
            first_weight_kg: 72,
            latest_weight_date: "2026-07-13",
            latest_weight_kg: 70,
            weight_change_kg: -2,
            calorie_target: 1800,
            protein_target_g: 120,
            carbohydrate_target_g: 200,
            fat_target_g: 60,
            server_calculated_at: "2026-07-13T12:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        error: null,
        data: [
          {
            weight_log_id: "weight-2",
            measured_at: "2026-07-13T07:00:00+08:00",
            local_date: "2026-07-13",
            weight_kg: 70,
            previous_weight_kg: 72,
            change_from_previous_kg: -2,
            days_since_previous: 29,
            is_truncated: false,
          },
        ],
      });
    const summary = await mobileApi.getProgressSummary(
      "2026-06-14",
      "2026-07-13",
    );
    const weight = await mobileApi.getWeightTrend("2026-06-14", "2026-07-13");
    expect(summary).toEqual(
      expect.objectContaining({
        averageDailyCalories: 1750,
        averageDailyProteinG: 110,
        weightChangeKg: -2,
      }),
    );
    expect(weight).toEqual({
      truncated: false,
      points: [
        expect.objectContaining({
          id: "weight-2",
          changeFromPreviousKg: -2,
          daysSincePrevious: 29,
        }),
      ],
    });
  });

  it("presents the self-contained copy preview and keeps confirmation separate", async () => {
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
          total_calories: 170,
          total_protein_g: 6,
          total_carbohydrates_g: 12,
          total_fat_g: 11,
          items: [
            {
              id: "preview-item-1",
              food_name: "Peanut snack",
              serving_description: "1 pack",
              calories: 170,
              protein_g: 6,
              carbohydrates_g: 12,
              fat_g: 11,
              provider: "catalog",
              uncertainty: [],
            },
          ],
        },
      ],
    });
    const preview = await mobileApi.copyFoodEntryToPreview(
      "entry-1",
      "lunch",
      "2026-07-13T12:00:00+08:00",
    );
    expect(preview).toEqual(
      expect.objectContaining({
        id: "preview-1",
        revision: 1,
        items: [expect.objectContaining({ foodName: "Peanut snack" })],
      }),
    );
    expect(mockRpc).toHaveBeenCalledWith("copy_food_entry_to_preview", {
      p_entry_id: "entry-1",
      p_meal_type: "lunch",
      p_consumed_at: "2026-07-13T12:00:00+08:00",
    });
    const args = mockRpc.mock.calls[0][1];
    expect(args).not.toHaveProperty("p_user_id");
    expect(args).not.toHaveProperty("p_total_calories");
    expect(
      mockRpc.mock.calls.some(([name]) => name === "confirm_food_log"),
    ).toBe(false);
  });
});
