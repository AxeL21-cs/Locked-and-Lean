import { mobileApi } from "../adapter";

const mockRpc = jest.fn();

jest.mock("../client", () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}));

const targetRow = {
  target_id: "target-1",
  status: "proposed",
  effective_from: "2026-07-18",
  calorie_target: 1900,
  protein_target_g: 118.75,
  carbohydrate_target_g: 213.75,
  fat_target_g: 63.33,
  formula_name: "Mifflin-St Jeor",
  formula_version: "locked-and-lean-msj-goal-v2",
  age_years: 28,
  formula_sex: "male",
  height_cm: 170,
  weight_kg: 75,
  target_weight_kg: 68,
  current_bmi: 25.95,
  target_bmi: 23.53,
  activity_level: "lightly_active",
  activity_multiplier: 1.375,
  goal: "lose",
  maintenance_calorie_estimate: 2450,
  goal_adjustment_kcal: -550,
  requested_weekly_weight_change_kg: -0.5,
  applied_weekly_weight_change_kg: -0.5,
  estimated_goal_date: "2026-10-24",
  safe_calorie_floor: 1500,
  macro_assumptions: {
    protein_calorie_fraction: 0.25,
    carbohydrate_calorie_fraction: 0.45,
    fat_calorie_fraction: 0.3,
    kilocalories_per_kg: 7700,
    safe_calorie_floor: 1500,
  },
  informational_disclaimer_version: "adult-estimate-not-medical-advice-v2",
};

describe("mobile goal planner adapter", () => {
  beforeEach(() => mockRpc.mockReset());

  it("maps remembered setup values from the owner-scoped RPC", async () => {
    mockRpc.mockResolvedValue({
      error: null,
      data: [
        {
          display_name: "Lance",
          age_years: 28,
          formula_sex: "male",
          height_cm: 170,
          current_weight_kg: 75,
          target_weight_kg: 68,
          activity_level: "lightly_active",
          requested_weekly_weight_change_kg: 0.5,
          has_confirmed_target: true,
        },
      ],
    });

    await expect(mobileApi.getGoalSetup()).resolves.toEqual({
      displayName: "Lance",
      ageYears: 28,
      formulaSex: "male",
      heightCm: 170,
      currentWeightKg: 75,
      targetWeightKg: 68,
      activityLevel: "lightly_active",
      requestedWeeklyChangeKg: 0.5,
      hasConfirmedTarget: true,
    });
    expect(mockRpc).toHaveBeenCalledWith("get_goal_setup", {});
  });

  it("sends target weight and lets the server derive goal direction", async () => {
    mockRpc.mockResolvedValue({ error: null, data: [targetRow] });

    const result = await mobileApi.proposeNutritionTarget({
      displayName: "Lance",
      ageYears: 28,
      formulaSex: "male",
      heightCm: 170,
      weightKg: 75,
      targetWeightKg: 68,
      activityLevel: "lightly_active",
      preferredUnits: "metric",
      timezone: "Asia/Manila",
      targetRateKgPerWeek: 0.5,
    });

    expect(mockRpc).toHaveBeenCalledWith("propose_nutrition_target", {
      p_weight_kg: 75,
      p_target_weight_kg: 68,
      p_activity_level: "lightly_active",
      p_requested_weekly_weight_change_kg: 0.5,
      p_effective_from: null,
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: "target-1",
        goal: "lose",
        currentWeightKg: 75,
        targetWeightKg: 68,
        currentBmi: 25.95,
        targetBmi: 23.53,
        calorieTarget: 1900,
        proteinTargetG: 118.75,
        maintenanceCalories: 2450,
        calorieAdjustment: -550,
        appliedWeeklyChangeKg: -0.5,
        estimatedGoalDate: "2026-10-24",
      }),
    );
    expect(result.assumptions).toEqual(
      expect.arrayContaining([
        expect.stringContaining("25% protein"),
        expect.stringContaining("7,700 kcal"),
        expect.stringContaining("screening estimate"),
      ]),
    );
    expect(result.disclaimer).not.toContain("adult-estimate-");
  });
});
