import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { resolveAppTheme, useAppTheme } from "../../../design-system/theme";
import {
  mobileApi,
  type GoalSetup,
  type NutritionTarget,
} from "../../../services/supabase";
import { OnboardingForm } from "../OnboardingForm";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
  }),
}));

jest.mock("../../../design-system/theme", () => {
  const actual = jest.requireActual("../../../design-system/theme");
  return { ...actual, useAppTheme: jest.fn() };
});

const mockedUseAppTheme = useAppTheme as jest.MockedFunction<
  typeof useAppTheme
>;

const setup: GoalSetup = {
  displayName: "Lance",
  ageYears: 29,
  formulaSex: "male",
  heightCm: 178,
  currentWeightKg: 82,
  targetWeightKg: 72,
  activityLevel: "moderately_active",
  requestedWeeklyChangeKg: 0.48,
  hasConfirmedTarget: true,
};

const proposal: NutritionTarget = {
  id: "target-proposal-2",
  status: "proposed",
  effectiveFrom: "2026-07-17",
  calorieTarget: 2050,
  proteinTargetG: 128,
  carbohydrateTargetG: 231,
  fatTargetG: 68,
  formulaName: "Mifflin-St Jeor",
  formulaVersion: "locked-and-lean-msj-goal-v2",
  ageYears: 29,
  formulaSex: "male",
  heightCm: 178,
  currentWeightKg: 82,
  targetWeightKg: 74,
  currentBmi: 25.88,
  targetBmi: 23.36,
  activityLevel: "moderately_active",
  activityMultiplier: 1.55,
  goal: "lose",
  maintenanceCalories: 2435,
  calorieAdjustment: -385,
  requestedWeeklyChangeKg: 0.5,
  appliedWeeklyChangeKg: -0.5,
  estimatedGoalDate: "2026-11-06",
  calorieFloor: 1500,
  assumptions: ["Protein is 25% of the calorie proposal."],
  disclaimer: "Informational adult estimate only.",
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
}

function wrapper(client: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("OnboardingForm goal planner", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockPush.mockClear();
    mockedUseAppTheme.mockReturnValue({
      ...resolveAppTheme("light"),
      preference: "light",
      setPreference: jest.fn(),
      toggleDarkMode: jest.fn(),
    });
  });

  it("restores remembered setup and sends the revised target weight through preview creation", async () => {
    const client = createQueryClient();
    const getGoalSetup = jest
      .spyOn(mobileApi, "getGoalSetup")
      .mockResolvedValue(setup);
    const upsertProfile = jest
      .spyOn(mobileApi, "upsertProfile")
      .mockResolvedValue(undefined);
    const proposeNutritionTarget = jest
      .spyOn(mobileApi, "proposeNutritionTarget")
      .mockResolvedValue(proposal);

    const view = await render(<OnboardingForm />, {
      wrapper: wrapper(client),
    });

    await waitFor(() => {
      expect(view.getByLabelText("Display name").props.value).toBe("Lance");
      expect(view.getByLabelText("Current weight (kg)").props.value).toBe("82");
      expect(view.getByLabelText("Target weight (kg)").props.value).toBe("72");
    });
    expect(getGoalSetup).toHaveBeenCalledTimes(1);
    expect(
      view.getByRole("radio", {
        name: "Biological sex used by the formula: Male",
      }).props.accessibilityState.checked,
    ).toBe(true);
    expect(
      view.getByRole("radio", {
        name: "Usual activity level: Moderate",
      }).props.accessibilityState.checked,
    ).toBe(true);
    await fireEvent.changeText(view.getByLabelText("Target weight (kg)"), "74");
    await fireEvent.press(
      view.getByRole("button", { name: "Calculate and review" }),
    );

    const expectedInput = {
      displayName: "Lance",
      ageYears: 29,
      formulaSex: "male",
      heightCm: 178,
      weightKg: 82,
      targetWeightKg: 74,
      activityLevel: "moderately_active",
      preferredUnits: "metric",
      timezone: "Asia/Manila",
      targetRateKgPerWeek: 0.5,
    };
    await waitFor(() =>
      expect(upsertProfile).toHaveBeenCalledWith(expectedInput),
    );
    expect(proposeNutritionTarget).toHaveBeenCalledWith(expectedInput);
    await waitFor(() =>
      expect(client.getQueryData(["proposed-target"])).toEqual(proposal),
    );
    expect(mockPush).toHaveBeenCalledWith("/target-review");

    await view.unmount();
    client.clear();
  });
});
