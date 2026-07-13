import { fireEvent, render } from "@testing-library/react-native";

import type { FoodPreview } from "../../../services/supabase";
import { ManualPreviewCard } from "../ManualPreviewCard";

const preview: FoodPreview = {
  id: "preview-1",
  revision: 3,
  mealType: "lunch",
  consumedAt: "2026-07-13T12:00:00+08:00",
  expiresAt: "2026-07-13T12:30:00+08:00",
  totalCalories: 420,
  totalProteinG: null,
  totalCarbohydratesG: null,
  totalFatG: null,
  items: [
    {
      id: "item-1",
      foodName: "Chicken adobo",
      servingDescription: "1 mangkok",
      calories: 420,
      proteinG: null,
      carbohydratesG: null,
      fatG: null,
      estimated: false,
      confidence: 1,
      source: "Manual entry",
      uncertainty: [],
    },
  ],
};

describe("ManualPreviewCard", () => {
  it("names the exact revision and does not hide unknown macros", async () => {
    const confirm = jest.fn();
    const view = await render(
      <ManualPreviewCard
        onConfirm={confirm}
        onEdit={jest.fn()}
        preview={preview}
      />,
    );
    expect(view.getByText("REVISION 3")).toBeTruthy();
    expect(view.getByText("Incomplete nutrition")).toBeTruthy();
    expect(view.getAllByText(/Unknown/)).toHaveLength(3);
    fireEvent.press(
      view.getByRole("button", { name: "Confirm revision 3 and log it" }),
    );
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("offers editing before a permanent write", async () => {
    const edit = jest.fn();
    const view = await render(
      <ManualPreviewCard
        onConfirm={jest.fn()}
        onEdit={edit}
        preview={preview}
      />,
    );
    fireEvent.press(
      view.getByRole("button", { name: "Edit details before logging" }),
    );
    expect(edit).toHaveBeenCalledTimes(1);
  });
});
