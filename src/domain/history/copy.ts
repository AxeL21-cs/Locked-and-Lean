import { localDateInManila, parseLocalDate } from "./manilaDate";
import type { CopyAsPreviewIntent, LocalDate } from "./types";

export function buildCopyAsPreviewIntent(input: {
  entryId: string;
  targetLocalDate: LocalDate;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  consumedAt: string;
}): CopyAsPreviewIntent {
  if (!input.entryId) throw new RangeError("Source entry is required.");
  parseLocalDate(input.targetLocalDate);
  if (localDateInManila(input.consumedAt) !== input.targetLocalDate) {
    throw new RangeError(
      "Copy timestamp must fall on the requested Asia/Manila date.",
    );
  }
  return {
    rpc: "copy_food_entry_to_preview",
    args: {
      p_entry_id: input.entryId,
      p_meal_type: input.mealType,
      p_consumed_at: new Date(input.consumedAt).toISOString(),
    },
    targetLocalDate: input.targetLocalDate,
    permanentWrite: false,
    confirmationRequired: true,
  };
}
