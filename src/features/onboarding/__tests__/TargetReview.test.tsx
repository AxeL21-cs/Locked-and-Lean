import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { resolveAppTheme, useAppTheme } from "../../../design-system/theme";
import { mobileApi, type NutritionTarget } from "../../../services/supabase";
import { TargetReview } from "../TargetReview";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
  }),
}));

jest.mock("../../../design-system/theme", () => {
  const actual = jest.requireActual("../../../design-system/theme");
  return { ...actual, useAppTheme: jest.fn() };
});

const mockedUseAppTheme = useAppTheme as jest.MockedFunction<
  typeof useAppTheme
>;

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

describe("TargetReview", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockReplace.mockClear();
    mockedUseAppTheme.mockReturnValue({
      ...resolveAppTheme("light"),
      preference: "light",
      setPreference: jest.fn(),
      toggleDarkMode: jest.fn(),
    });
  });

  it("confirms the exact displayed proposal and invalidates every target consumer", async () => {
    const client = createQueryClient();
    const invalidateQueries = jest
      .spyOn(client, "invalidateQueries")
      .mockResolvedValue(undefined);
    jest
      .spyOn(mobileApi, "getProposedNutritionTarget")
      .mockResolvedValue(proposal);
    const confirmNutritionTarget = jest
      .spyOn(mobileApi, "confirmNutritionTarget")
      .mockResolvedValue({ ...proposal, status: "confirmed" });

    const view = await render(<TargetReview />, { wrapper: wrapper(client) });

    expect(await view.findByText("2,050")).toBeTruthy();
    expect(view.getByText("128 g")).toBeTruthy();
    expect(view.getByLabelText("Weight from 82 to 74 kilograms.")).toBeTruthy();
    expect(view.getByText("BMI screening estimate")).toBeTruthy();
    const confirmButton = view.getByRole("button", {
      name: "Confirm and use this target",
    });
    expect(confirmButton.props.accessibilityHint).toBe(
      "Activates proposal target-proposal-2 exactly as shown",
    );

    await fireEvent.press(confirmButton);

    await waitFor(() =>
      expect(confirmNutritionTarget).toHaveBeenCalledWith("target-proposal-2"),
    );
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(6));
    for (const queryKey of [
      ["today"],
      ["calendar-history"],
      ["day-history"],
      ["progress"],
      ["goal-setup"],
      ["proposed-target"],
    ]) {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
    }
    expect(mockReplace).toHaveBeenCalledWith("/");

    await view.unmount();
    client.clear();
  });
});
