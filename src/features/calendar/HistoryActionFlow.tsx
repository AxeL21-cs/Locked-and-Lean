import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { AsyncStatePanel } from "../../components/AsyncStatePanel";
import { ChoiceChips } from "../../components/ChoiceChips";
import { Field } from "../../components/Field";
import { ScreenHeader } from "../../components/ScreenHeader";
import { colors, radius, spacing, type } from "../../design-system/tokens";
import { localDateInManila } from "../../domain/history";
import type { FoodPreview, MealType } from "../../services/supabase";
import { ManualPreviewCard } from "../add/ManualPreviewCard";
import type { HistoryEntryView } from "./types";

const MEALS = [
  { label: "Breakfast", value: "breakfast" },
  { label: "Lunch", value: "lunch" },
  { label: "Dinner", value: "dinner" },
  { label: "Snack", value: "snack" },
] as const;

const localTimeInManila = (instant: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);

const idempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `history-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export type HistoryActionGateway = {
  copyToPreview(
    entry: HistoryEntryView,
    mealType: MealType,
    consumedAt: string,
  ): Promise<FoodPreview>;
  editToPreview(input: {
    entry: HistoryEntryView;
    mealType: MealType;
    consumedAt: string;
    originalDescription: string;
  }): Promise<FoodPreview>;
  confirm(
    previewId: string,
    revision: number,
    confirmationKey: string,
  ): Promise<{ entryId: string; reused: boolean }>;
};

export function HistoryActionFlow({
  action,
  entry,
  gateway,
  onCancel,
  onDone,
}: {
  action: "copy" | "edit";
  entry: HistoryEntryView;
  gateway: HistoryActionGateway;
  onCancel: () => void;
  onDone: () => void;
}) {
  const originalInstant = new Date(entry.consumedAt);
  const defaultInstant = action === "copy" ? new Date() : originalInstant;
  const [mealType, setMealType] = useState(entry.mealType);
  const [consumedDate, setConsumedDate] = useState(
    localDateInManila(defaultInstant),
  );
  const [consumedTime, setConsumedTime] = useState(
    localTimeInManila(defaultInstant),
  );
  const [description, setDescription] = useState(entry.originalDescription);
  const [preview, setPreview] = useState<FoodPreview>();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<unknown>();
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<unknown>();
  const [confirmationKey, setConfirmationKey] = useState(idempotencyKey);

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(consumedDate);
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(consumedTime);
  const consumedAt = `${consumedDate}T${consumedTime}:00+08:00`;
  const create = async () => {
    if (!validDate || !validTime || !description.trim()) return;
    setCreating(true);
    setCreateError(undefined);
    try {
      const result =
        action === "copy"
          ? await gateway.copyToPreview(entry, mealType, consumedAt)
          : await gateway.editToPreview({
              entry,
              mealType,
              consumedAt,
              originalDescription: description.trim(),
            });
      setConfirmationKey(idempotencyKey());
      setPreview(result);
    } catch (error) {
      setCreateError(error);
    } finally {
      setCreating(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    setConfirming(true);
    setConfirmError(undefined);
    try {
      await gateway.confirm(preview.id, preview.revision, confirmationKey);
      onDone();
    } catch (error) {
      setConfirmError(error);
    } finally {
      setConfirming(false);
    }
  };

  if (preview)
    return (
      <ManualPreviewCard
        confirming={confirming}
        error={confirmError instanceof Error ? confirmError.message : undefined}
        onConfirm={() => void confirm()}
        onEdit={() => {
          setPreview(undefined);
          setConfirmError(undefined);
          setConfirmationKey(idempotencyKey());
        }}
        preview={preview}
      />
    );

  return (
    <View>
      <ScreenHeader
        annotation={
          action === "copy"
            ? "Original stays unchanged"
            : "Original changes only after confirmation"
        }
        eyebrow={
          action === "copy"
            ? "COPY · PREVIEW FIRST"
            : "EDIT · REPLACEMENT PREVIEW"
        }
        title={
          action === "copy" ? "Copy confirmed entry" : "Edit entry details"
        }
      />
      <View accessibilityRole="summary" style={styles.safetyCard}>
        <Text style={styles.safetyTitle}>
          {action === "copy"
            ? "This creates a new log"
            : "This stages a replacement"}
        </Text>
        <Text style={styles.safetyCopy}>
          The server copies the immutable nutrition snapshots and recalculates a
          complete preview.{" "}
          {action === "edit"
            ? "The source entry remains active until that exact replacement revision is confirmed."
            : "Nothing is added until the copied preview is explicitly confirmed."}
        </Text>
      </View>
      <ChoiceChips<MealType>
        choices={MEALS}
        label="Meal"
        onChange={setMealType}
        value={mealType}
      />
      <View style={styles.twoColumns}>
        <View style={styles.flex}>
          <Field
            error={validDate ? undefined : "Use YYYY-MM-DD."}
            label="Manila date"
            onChangeText={setConsumedDate}
            value={consumedDate}
          />
        </View>
        <View style={styles.flex}>
          <Field
            error={validTime ? undefined : "Use 24-hour HH:MM."}
            label="Time"
            onChangeText={setConsumedTime}
            value={consumedTime}
          />
        </View>
      </View>
      {action === "edit" ? (
        <Field
          error={description.trim() ? undefined : "Description is required."}
          label="Entry description"
          onChangeText={setDescription}
          value={description}
        />
      ) : null}
      <Text style={styles.snapshotNote}>
        Nutrition values come from {entry.items.length} confirmed item{" "}
        {entry.items.length === 1 ? "snapshot" : "snapshots"}; the client does
        not recalculate totals.
      </Text>
      {createError ? (
        <AsyncStatePanel
          actionLabel="Retry preview"
          kind={
            createError instanceof Error &&
            /offline|network|fetch/i.test(createError.message)
              ? "offline"
              : "error"
          }
          message={
            createError instanceof Error
              ? createError.message
              : "The preview could not be created."
          }
          onAction={() => void create()}
          title="No history entry was changed"
        />
      ) : null}
      <ActionButton
        busy={creating}
        disabled={!validDate || !validTime || !description.trim()}
        label={
          action === "copy"
            ? "Create copied preview"
            : "Create replacement preview"
        }
        onPress={() => void create()}
        accessibilityHint="Creates a server-calculated preview only; it does not write a diary entry"
      />
      <ActionButton
        disabled={creating}
        label="Back to history"
        onPress={onCancel}
        tone="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safetyCard: {
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  safetyTitle: { color: colors.ink, fontFamily: type.display, fontSize: 23 },
  safetyCopy: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  twoColumns: { flexDirection: "row", gap: spacing.md },
  snapshotNote: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.lg,
  },
});
