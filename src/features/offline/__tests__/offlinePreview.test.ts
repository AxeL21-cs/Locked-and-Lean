import type { ManualFoodInput } from "../../../services/supabase";
import {
  buildLocalManualPreview,
  serverPreviewMatchesLocal,
} from "../offlineStore";

const rice: ManualFoodInput = {
  foodName: "Steamed rice",
  calories: 205,
  carbohydratesG: 45,
  fatG: 0.4,
  proteinG: 4.3,
  quantity: 1,
  servingUnit: "cup",
  mealType: "lunch",
  consumedDate: "2026-07-16",
  consumedTime: "12:15",
  saveForReuse: false,
};

describe("offline manual confirmation contract", () => {
  it("builds a visibly local snapshot from exact user-entered values", () => {
    const preview = buildLocalManualPreview(rice, "stable-key");
    expect(preview.id).toBe("local-stable-key");
    expect(preview.totalCalories).toBe(205);
    expect(preview.items[0]).toMatchObject({
      foodName: "Steamed rice",
      servingDescription: "1 cup",
      source: "On-device user input · not server-verified",
    });
  });

  it("allows auto-confirm only when the authoritative nutrition fields match", () => {
    const local = buildLocalManualPreview(rice, "stable-key");
    const matching = {
      ...local,
      id: "server-preview",
      revision: 4,
      items: local.items.map((item) => ({
        ...item,
        id: "server-item",
        source: "Manual server preview",
      })),
    };
    expect(serverPreviewMatchesLocal(local, matching)).toBe(true);
    expect(
      serverPreviewMatchesLocal(local, { ...matching, totalCalories: 206 }),
    ).toBe(false);
    expect(
      serverPreviewMatchesLocal(local, {
        ...matching,
        items: matching.items.map((item) => ({
          ...item,
          servingDescription: "1.25 cup",
        })),
      }),
    ).toBe(false);
    expect(
      serverPreviewMatchesLocal(local, {
        ...matching,
        consumedAt: "2026-07-16T12:16:00+08:00",
      }),
    ).toBe(false);
  });
});
