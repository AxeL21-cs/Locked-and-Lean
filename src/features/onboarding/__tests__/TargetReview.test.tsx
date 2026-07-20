import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { resolveAppTheme, useAppTheme } from "../../../design-system/theme";
import { writeCachedOnboardingCompletion } from "../../auth/onboardingCompletionCache";
import {
  mobileApi,
  type GoalSetup,
  type NutritionTarget,
} from "../../../services/supabase";
import { TargetReview } from "../TargetReview";

const mockReplace = jest.fn();
const mockDismissAll = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    dismissAll: mockDismissAll,
    push: jest.fn(),
    replace: mockReplace,
  }),
}));

jest.mock("../../auth/SessionProvider", () => ({
  useSession: () => ({
    loading: false,
    session: { user: { id: "owner-a" } },
  }),
}));

jest.mock("../../auth/onboardingCompletionCache", () => ({
  writeCachedOnboardingCompletion: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../design-system/theme", () => {
  const actual = jest.requireActual("../../../design-system/theme");
  return { ...actual, useAppTheme: jest.fn() };
});

const mockedUseAppTheme = useAppTheme as jest.MockedFunction<
  typeof useAppTheme
>;
const mockedWriteCachedOnboardingCompletion =
  writeCachedOnboardingCompletion as jest.MockedFunction<
    typeof writeCachedOnboardingCompletion
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
    mockDismissAll.mockClear();
    mockedUseAppTheme.mockReturnValue({
      ...resolveAppTheme("light"),
      preference: "light",
      setPreference: jest.fn(),
      toggleDarkMode: jest.fn(),
    });
  });

  it("confirms the exact displayed proposal and invalidates every target consumer", async () => {
    const client = createQueryClient();
    const ownerASetup: GoalSetup = {
      displayName: "Lance",
      ageYears: 29,
      formulaSex: "male",
      heightCm: 178,
      currentWeightKg: 82,
      targetWeightKg: 74,
      activityLevel: "moderately_active",
      requestedWeeklyChangeKg: 0.5,
      hasConfirmedTarget: false,
    };
    client.setQueryData(["goal-setup", "owner-a"], ownerASetup);
    client.setQueryData(["goal-setup", "owner-b"], {
      displayName: "Other owner",
      ageYears: 30,
      formulaSex: "female",
      heightCm: 160,
      currentWeightKg: 60,
      targetWeightKg: 60,
      activityLevel: "lightly_active",
      requestedWeeklyChangeKg: null,
      hasConfirmedTarget: false,
    });
    client.setQueryData(["onboarding-completion-cache", "owner-a"], false);
    client.setQueryData(["onboarding-completion-cache", "owner-b"], false);
    const pendingInvalidation = new Promise<void>(() => undefined);
    const invalidateQueries = jest
      .spyOn(client, "invalidateQueries")
      .mockReturnValue(pendingInvalidation);
    jest.spyOn(mobileApi, "getGoalSetup").mockResolvedValue(ownerASetup);
    mockedWriteCachedOnboardingCompletion.mockRejectedValueOnce(
      new Error("Local cache unavailable"),
    );
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
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(tabs)"));
    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(
      client.getQueryData<{ hasConfirmedTarget: boolean }>([
        "goal-setup",
        "owner-a",
      ])?.hasConfirmedTarget,
    ).toBe(true);
    expect(
      client.getQueryData(["onboarding-completion-cache", "owner-a"]),
    ).toBe(true);
    expect(
      client.getQueryData<{ hasConfirmedTarget: boolean }>([
        "goal-setup",
        "owner-b",
      ])?.hasConfirmedTarget,
    ).toBe(false);
    expect(
      client.getQueryData(["onboarding-completion-cache", "owner-b"]),
    ).toBe(false);
    expect(writeCachedOnboardingCompletion).toHaveBeenCalledWith(
      "owner-a",
      true,
    );
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(6));
    for (const queryKey of [
      ["today"],
      ["calendar-history"],
      ["day-history"],
      ["progress"],
      ["goal-setup", "owner-a"],
    ]) {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
    }
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["proposed-target", "owner-a"],
      refetchType: "none",
    });

    await view.unmount();
    client.clear();
  });

  it("recovers an already-confirmed target instead of showing a dead-end empty state", async () => {
    const client = createQueryClient();
    jest.spyOn(mobileApi, "getProposedNutritionTarget").mockResolvedValue(null);
    jest.spyOn(mobileApi, "getGoalSetup").mockResolvedValue({
      displayName: "Lance",
      ageYears: 29,
      formulaSex: "male",
      heightCm: 178,
      currentWeightKg: 82,
      targetWeightKg: 74,
      activityLevel: "moderately_active",
      requestedWeeklyChangeKg: 0.5,
      hasConfirmedTarget: true,
    });

    const view = await render(<TargetReview />, { wrapper: wrapper(client) });

    expect(await view.findByText("Target confirmed")).toBeTruthy();
    await waitFor(() => expect(mockDismissAll).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(view.queryByText("No proposal yet")).toBeNull();

    await view.unmount();
    client.clear();
  });

  it("keeps recovery non-actionable until confirmed target status finishes loading", async () => {
    const client = createQueryClient();
    let resolveGoalSetup!: (value: GoalSetup) => void;
    const pendingGoalSetup = new Promise<GoalSetup>((resolve) => {
      resolveGoalSetup = resolve;
    });
    jest.spyOn(mobileApi, "getProposedNutritionTarget").mockResolvedValue(null);
    jest.spyOn(mobileApi, "getGoalSetup").mockReturnValue(pendingGoalSetup);

    const view = await render(<TargetReview />, { wrapper: wrapper(client) });

    expect(await view.findByText("Checking target status")).toBeTruthy();
    expect(view.queryByText("No proposal yet")).toBeNull();
    expect(view.queryByRole("button", { name: "Enter details" })).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async () => {
      resolveGoalSetup({
        displayName: "Lance",
        ageYears: 29,
        formulaSex: "male",
        heightCm: 178,
        currentWeightKg: 82,
        targetWeightKg: 74,
        activityLevel: "moderately_active",
        requestedWeeklyChangeKg: 0.5,
        hasConfirmedTarget: true,
      });
      await pendingGoalSetup;
    });

    await waitFor(() => expect(mockDismissAll).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(view.queryByText("No proposal yet")).toBeNull();

    await view.unmount();
    client.clear();
  });

  it("offers a safe status retry instead of sending a confirmed user back through setup", async () => {
    const client = createQueryClient();
    jest.spyOn(mobileApi, "getProposedNutritionTarget").mockResolvedValue(null);
    jest
      .spyOn(mobileApi, "getGoalSetup")
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValue({
        displayName: "Lance",
        ageYears: 29,
        formulaSex: "male",
        heightCm: 178,
        currentWeightKg: 82,
        targetWeightKg: 74,
        activityLevel: "moderately_active",
        requestedWeeklyChangeKg: 0.5,
        hasConfirmedTarget: true,
      });

    const view = await render(<TargetReview />, { wrapper: wrapper(client) });

    expect(await view.findByText("Target status could not load")).toBeTruthy();
    expect(view.queryByText("No proposal yet")).toBeNull();
    expect(view.queryByRole("button", { name: "Enter details" })).toBeNull();

    await fireEvent.press(view.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(mockDismissAll).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(view.queryByText("No proposal yet")).toBeNull();

    await view.unmount();
    client.clear();
  });
});
