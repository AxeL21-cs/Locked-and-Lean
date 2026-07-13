import { fireEvent, render } from "@testing-library/react-native";

import type { CalendarDayView } from "../../calendar/types";
import { ProgressDashboard } from "../ProgressDashboard";
import type { ProgressDashboardData } from "../types";

const nutritionDay: CalendarDayView = {
  localDate: "2026-07-13",
  dayNumber: 13,
  weekdayLabel: "Mon",
  accessibilityLabel: "Monday, July 13, 2026",
  inDisplayedMonth: true,
  isToday: true,
  status: {
    status: "incomplete",
    label: "Incomplete nutrition",
    symbol: "?",
    accessibilityLabel: "Nutrition data is incomplete",
    colorToken: "statusIncomplete",
  },
  snapshot: {
    localDate: "2026-07-13",
    entryCount: 2,
    calories: 1600,
    proteinG: null,
    carbohydratesG: null,
    fatG: null,
    macroDataComplete: false,
    calorieTarget: 1800,
    proteinTargetG: 120,
    carbohydrateTargetG: 200,
    fatTargetG: 60,
    weightKg: 70,
    hasEntries: true,
    serverCalculatedAt: "2026-07-13T12:00:00Z",
  },
};
const data: ProgressDashboardData = {
  summary: {
    startDate: "2026-06-30",
    endDate: "2026-07-13",
    rangeDays: 14,
    loggedDays: 1,
    totalEntries: 2,
    averageDailyCalories: 1600,
    completeMacroDays: 0,
    averageDailyProteinG: null,
    averageDailyCarbohydratesG: null,
    averageDailyFatG: null,
    firstWeightDate: "2026-07-01",
    firstWeightKg: 71,
    latestWeightDate: "2026-07-13",
    latestWeightKg: 70,
    weightChangeKg: -1,
    calorieTarget: 1800,
    proteinTargetG: 120,
    carbohydrateTargetG: 200,
    fatTargetG: 60,
    serverCalculatedAt: "2026-07-13T12:00:00Z",
  },
  nutritionDays: [nutritionDay],
  weightTruncated: false,
  weightPoints: [
    {
      id: "weight-1",
      measuredAt: "2026-07-01T07:00:00+08:00",
      localDate: "2026-07-01",
      weightKg: 71,
      previousWeightKg: null,
      changeFromPreviousKg: null,
      daysSincePrevious: null,
    },
    {
      id: "weight-2",
      measuredAt: "2026-07-13T07:00:00+08:00",
      localDate: "2026-07-13",
      weightKg: 70,
      previousWeightKg: 71,
      changeFromPreviousKg: -1,
      daysSincePrevious: 12,
    },
  ],
};

describe("ProgressDashboard", () => {
  it("renders server summaries and preserves unknown macro values", async () => {
    const view = await render(
      <ProgressDashboard
        data={data}
        onRangeChange={jest.fn()}
        rangeDays={14}
      />,
    );
    expect(view.getByText("1")).toBeTruthy();
    expect(view.getByText(/0 complete-macro days/)).toBeTruthy();
    expect(view.getAllByText(/P Unknown/).length).toBeGreaterThan(0);
    expect(view.getByText("? INCOMPLETE")).toBeTruthy();
  });

  it("exposes calorie status and weight direction in accessible text", async () => {
    const view = await render(
      <ProgressDashboard
        data={data}
        onRangeChange={jest.fn()}
        rangeDays={14}
      />,
    );
    expect(
      view.getByLabelText(
        /Monday, July 13, 2026.*1600 calories.*Nutrition data is incomplete/,
      ),
    ).toBeTruthy();
    expect(
      view.getByLabelText(
        /2026-07-13.*70 kilograms.*Down 1 kilograms.*12 days/,
      ),
    ).toBeTruthy();
    expect(view.getByText("12 DAYS SINCE PRIOR MEASUREMENT")).toBeTruthy();
    expect(view.getAllByText("↓ DOWN 1.0 KG")).toHaveLength(2);
  });

  it("changes ranges through a radio choice", async () => {
    const onRangeChange = jest.fn();
    const view = await render(
      <ProgressDashboard
        data={data}
        onRangeChange={onRangeChange}
        rangeDays={14}
      />,
    );
    fireEvent.press(view.getByRole("radio", { name: "Trend range: 30 days" }));
    expect(onRangeChange).toHaveBeenCalledWith(30);
  });
});
