import {
  buildCopyAsPreviewIntent,
  createImmutableHistorySnapshot,
  recalculateDailyNutrition,
} from "..";
import type { HistoryEntrySnapshot } from "..";

function entry(
  id: string,
  nutrition: HistoryEntrySnapshot["nutrition"],
): HistoryEntrySnapshot {
  return {
    id,
    localDate: "2026-07-13",
    deletedAt: null,
    nutrition,
    provenance: {
      provider: "fixture-provider-v1",
      providerVersion: "2026-07",
      providerRetrievedAt: "2026-07-12T00:00:00.000Z",
      attribution: "Synthetic immutable-history fixture",
    },
  };
}

describe("historical snapshot immutability", () => {
  it("deep-copies and freezes confirmed provenance and nutrition", () => {
    const source = entry("entry-1", {
      calories: 500,
      proteinG: 30,
      carbohydratesG: 60,
      fatG: 12,
    });
    const snapshot = createImmutableHistorySnapshot(source);

    source.nutrition.calories = 999;
    source.provenance.provider = "fixture-provider-v2";

    expect(snapshot.nutrition.calories).toBe(500);
    expect(snapshot.provenance.provider).toBe("fixture-provider-v1");
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.nutrition)).toBe(true);
    expect(Object.isFrozen(snapshot.provenance)).toBe(true);
  });

  it("recalculates from active snapshots and propagates unknown macros", () => {
    const complete = entry("complete", {
      calories: 500,
      proteinG: 30,
      carbohydratesG: 60,
      fatG: 12,
    });
    const incomplete = entry("incomplete", {
      calories: 200,
      proteinG: null,
      carbohydratesG: null,
      fatG: null,
    });

    expect(
      recalculateDailyNutrition("2026-07-13", [complete, incomplete]),
    ).toEqual({
      localDate: "2026-07-13",
      entryCount: 2,
      calories: 700,
      proteinG: null,
      carbohydratesG: null,
      fatG: null,
      macroDataComplete: false,
    });

    incomplete.deletedAt = "2026-07-14T00:00:00.000Z";
    expect(
      recalculateDailyNutrition("2026-07-13", [complete, incomplete]),
    ).toMatchObject({
      entryCount: 1,
      calories: 500,
      proteinG: 30,
      carbohydratesG: 60,
      fatG: 12,
      macroDataComplete: true,
    });
  });
});

describe("copy as a new preview", () => {
  it("creates preview-only intent for the requested Manila date", () => {
    const intent = buildCopyAsPreviewIntent({
      entryId: "entry-1",
      targetLocalDate: "2026-07-14",
      mealType: "lunch",
      consumedAt: "2026-07-13T16:30:00.000Z",
    });
    expect(intent).toEqual({
      rpc: "copy_food_entry_to_preview",
      args: {
        p_entry_id: "entry-1",
        p_meal_type: "lunch",
        p_consumed_at: "2026-07-13T16:30:00.000Z",
      },
      targetLocalDate: "2026-07-14",
      permanentWrite: false,
      confirmationRequired: true,
    });
    expect(JSON.stringify(intent)).not.toMatch(
      /user_id|total_calories|p_total/i,
    );
  });

  it("rejects a UTC timestamp that belongs to a different Manila date", () => {
    expect(() =>
      buildCopyAsPreviewIntent({
        entryId: "entry-1",
        targetLocalDate: "2026-07-14",
        mealType: "lunch",
        consumedAt: "2026-07-13T15:59:59.999Z",
      }),
    ).toThrow("Copy timestamp must fall on the requested Asia/Manila date.");
  });
});
