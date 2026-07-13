import { fireEvent, render, waitFor } from "@testing-library/react-native";

import type { FoodPreview } from "../../../services/supabase";
import {
  HistoryActionFlow,
  type HistoryActionGateway,
} from "../HistoryActionFlow";
import type { HistoryEntryView } from "../types";

const entry: HistoryEntryView = {
  id: "entry-1",
  sourceKind: "barcode",
  mealType: "lunch",
  consumedAt: "2026-07-12T12:00:00+08:00",
  localDate: "2026-07-12",
  originalDescription: "Peanut snack",
  calories: 170,
  proteinG: 6,
  carbohydratesG: 12,
  fatG: 11,
  macroDataComplete: true,
  items: [
    {
      id: "item-1",
      foodName: "Peanut snack",
      quantity: 1,
      unit: "pack",
      calories: 170,
      proteinG: 6,
      carbohydratesG: 12,
      fatG: 11,
      provider: "catalog",
      estimated: false,
      confidence: 0.9,
      uncertainty: [],
    },
  ],
};
const preview: FoodPreview = {
  id: "preview-1",
  revision: 1,
  mealType: "lunch",
  consumedAt: "2026-07-13T12:00:00+08:00",
  expiresAt: "2026-07-13T12:30:00+08:00",
  totalCalories: 170,
  totalProteinG: 6,
  totalCarbohydratesG: 12,
  totalFatG: 11,
  items: [
    {
      id: "preview-item-1",
      foodName: "Peanut snack",
      servingDescription: "1 pack",
      calories: 170,
      proteinG: 6,
      carbohydratesG: 12,
      fatG: 11,
      estimated: false,
      confidence: 0.9,
      source: "catalog",
      uncertainty: [],
    },
  ],
};

function gateway(): HistoryActionGateway {
  return {
    copyToPreview: jest.fn().mockResolvedValue(preview),
    editToPreview: jest.fn().mockResolvedValue(preview),
    confirm: jest.fn().mockResolvedValue({ entryId: "entry-2", reused: false }),
  };
}

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  fireEvent.press(element);
  await Promise.resolve();
}

describe("HistoryActionFlow", () => {
  it("copies an immutable snapshot into a preview before any write", async () => {
    const api = gateway();
    const done = jest.fn();
    const view = await render(
      <HistoryActionFlow
        action="copy"
        entry={entry}
        gateway={api}
        onCancel={jest.fn()}
        onDone={done}
      />,
    );
    expect(view.getByText("Original stays unchanged")).toBeTruthy();
    expect(api.confirm).not.toHaveBeenCalled();
    await press(view.getByRole("button", { name: "Create copied preview" }));
    expect(await view.findByText("REVISION 1")).toBeTruthy();
    expect(api.copyToPreview).toHaveBeenCalledWith(
      entry,
      "lunch",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/),
    );
    expect(api.confirm).not.toHaveBeenCalled();
    await press(
      view.getByRole("button", { name: "Confirm revision 1 and log it" }),
    );
    await waitFor(() =>
      expect(api.confirm).toHaveBeenCalledWith(
        "preview-1",
        1,
        expect.any(String),
      ),
    );
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("states that edit replacement is deferred until exact confirmation", async () => {
    const api = gateway();
    const view = await render(
      <HistoryActionFlow
        action="edit"
        entry={entry}
        gateway={api}
        onCancel={jest.fn()}
        onDone={jest.fn()}
      />,
    );
    expect(
      view.getByText("Original changes only after confirmation"),
    ).toBeTruthy();
    expect(view.getByText(/source entry remains active/i)).toBeTruthy();
    await press(
      view.getByRole("button", { name: "Create replacement preview" }),
    );
    expect(await view.findByText("REVISION 1")).toBeTruthy();
    expect(api.editToPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        entry,
        mealType: "lunch",
        originalDescription: "Peanut snack",
      }),
    );
    expect(api.confirm).not.toHaveBeenCalled();
  });
});
