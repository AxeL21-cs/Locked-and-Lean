import { fireEvent, render } from "@testing-library/react-native";

import type { TodaySummary } from "../../../services/supabase";
import { TodayOverview } from "../TodayOverview";

const summary: TodaySummary = {
  localDate: "2026-07-17",
  calorieTarget: 2200,
  proteinTargetG: 140,
  carbohydrateTargetG: 250,
  fatTargetG: 70,
  caloriesConsumed: 1340,
  proteinConsumedG: 90,
  carbohydratesConsumedG: 150,
  fatConsumedG: 42,
  entries: [],
  lastUpdatedAt: "2026-07-17T09:00:00+08:00",
};

describe("TodayOverview", () => {
  it("shows a positive remaining balance", async () => {
    const view = await render(
      <TodayOverview onSetTarget={jest.fn()} summary={summary} />,
    );

    expect(view.getByText("860")).toBeTruthy();
    expect(view.getByText("kcal left")).toBeTruthy();
    expect(
      view.getByLabelText("Protein: 90 grams; target 140 grams"),
    ).toBeTruthy();
  });

  it("shows calories over without a negative balance", async () => {
    const view = await render(
      <TodayOverview
        onSetTarget={jest.fn()}
        summary={{ ...summary, caloriesConsumed: 2400 }}
      />,
    );

    expect(view.getByText("200")).toBeTruthy();
    expect(view.getByText("kcal over")).toBeTruthy();
    expect(view.queryByText("-200")).toBeNull();
  });

  it("shows honest totals and setup action when targets are not set", async () => {
    const onSetTarget = jest.fn();
    const view = await render(
      <TodayOverview
        onSetTarget={onSetTarget}
        summary={{
          ...summary,
          calorieTarget: null,
          proteinTargetG: null,
          carbohydrateTargetG: null,
          fatTargetG: null,
        }}
      />,
    );

    expect(view.getByText("1,340")).toBeTruthy();
    expect(view.getByText("kcal logged")).toBeTruthy();
    expect(
      view.getByLabelText("Protein: 90 grams; target not set"),
    ).toBeTruthy();
    expect(view.queryByText(/target 1g/i)).toBeNull();

    fireEvent.press(
      view.getByRole("button", { name: "Set a daily calorie target" }),
    );
    expect(onSetTarget).toHaveBeenCalledTimes(1);
  });
});
