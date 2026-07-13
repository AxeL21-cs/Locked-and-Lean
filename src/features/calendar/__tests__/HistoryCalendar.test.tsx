import { fireEvent, render } from "@testing-library/react-native";

import type { CalendarStatusPresentation } from "../../../domain/history/types";
import { HistoryCalendar } from "../HistoryCalendar";
import type { CalendarDayView, DayHistoryView } from "../types";

const status: CalendarStatusPresentation = {
  status: "within_target",
  label: "Within target",
  symbol: "=",
  accessibilityLabel: "Within calorie target",
  colorToken: "statusWithin",
};
const day: CalendarDayView = {
  localDate: "2026-07-13",
  dayNumber: 13,
  weekdayLabel: "Mon",
  accessibilityLabel: "Monday, July 13, 2026",
  inDisplayedMonth: true,
  isToday: true,
  status,
  snapshot: {
    localDate: "2026-07-13",
    entryCount: 1,
    calories: 1700,
    proteinG: null,
    carbohydratesG: 200,
    fatG: 60,
    macroDataComplete: false,
    calorieTarget: 1800,
    proteinTargetG: 120,
    carbohydrateTargetG: 210,
    fatTargetG: 60,
    weightKg: 70,
    hasEntries: true,
    serverCalculatedAt: "2026-07-13T12:00:00Z",
  },
};
const history: DayHistoryView = {
  localDate: "2026-07-13",
  entryCount: 1,
  truncated: false,
  entries: [
    {
      id: "entry-1",
      sourceKind: "barcode",
      mealType: "lunch",
      consumedAt: "2026-07-13T12:00:00+08:00",
      localDate: "2026-07-13",
      originalDescription: "Peanut snack",
      calories: 170,
      proteinG: null,
      carbohydratesG: 12,
      fatG: 11,
      macroDataComplete: false,
      items: [
        {
          id: "item-1",
          foodName: "Peanut snack",
          quantity: 1,
          unit: "pack",
          calories: 170,
          proteinG: null,
          carbohydratesG: 12,
          fatG: 11,
          provider: "catalog",
          estimated: false,
          confidence: 0.8,
          uncertainty: ["Market version not verified."],
        },
      ],
    },
  ],
};

async function renderCalendar(
  overrides: Partial<Parameters<typeof HistoryCalendar>[0]> = {},
) {
  const props: Parameters<typeof HistoryCalendar>[0] = {
    mode: "month",
    periodLabel: "July 2026",
    days: [day],
    selectedDate: day.localDate,
    selectedDayHistory: history,
    onModeChange: jest.fn(),
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    onToday: jest.fn(),
    onSelectDate: jest.fn(),
    onCopy: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    ...overrides,
  };
  return { props, view: await render(<HistoryCalendar {...props} />) };
}

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  fireEvent.press(element);
  await Promise.resolve();
}

describe("HistoryCalendar", () => {
  it("labels day status and unknown macros without relying on color", async () => {
    const { view } = await renderCalendar();
    expect(
      view.getByRole("button", {
        name: /Monday, July 13, 2026.*Within calorie target.*1 confirmed entry.*1700 calories/,
      }),
    ).toBeTruthy();
    expect(view.getByText("= Within target · 1 confirmed entry")).toBeTruthy();
    expect(view.getAllByText(/P Unknown/).length).toBeGreaterThan(0);
    expect(view.getByText("! Market version not verified.")).toBeTruthy();
  });

  it("navigates ranges and selects dates through accessible controls", async () => {
    const { props, view } = await renderCalendar();
    await press(view.getByRole("button", { name: "Previous period" }));
    await press(view.getByRole("button", { name: "Next period" }));
    await press(view.getByRole("button", { name: /Go to today/ }));
    await press(view.getByRole("button", { name: /Monday, July 13, 2026/ }));
    expect(props.onPrevious).toHaveBeenCalledTimes(1);
    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect(props.onToday).toHaveBeenCalledTimes(1);
    expect(props.onSelectDate).toHaveBeenCalledWith("2026-07-13");
  });

  it("routes edit/copy and requires a second explicit action for delete", async () => {
    const { props, view } = await renderCalendar();
    await press(
      view.getByRole("button", { name: /Edit Peanut snack through/ }),
    );
    await press(view.getByRole("button", { name: /Copy Peanut snack as/ }));
    await press(view.getByRole("button", { name: "Delete Peanut snack" }));
    expect(props.onEdit).toHaveBeenCalledWith(history.entries[0]);
    expect(props.onCopy).toHaveBeenCalledWith(history.entries[0]);
    expect(props.onDelete).not.toHaveBeenCalled();
    await press(view.getByRole("button", { name: "Confirm delete" }));
    expect(props.onDelete).toHaveBeenCalledWith(history.entries[0]);
  });
});
