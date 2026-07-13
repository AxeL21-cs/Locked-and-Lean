import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { ActionButton } from "../../components/ActionButton";
import { ChoiceChips } from "../../components/ChoiceChips";
import { Field } from "../../components/Field";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { colors, radius, spacing, type } from "../../design-system/tokens";
import { localDateInManila } from "../../domain/localization/philippines";
import {
  mobileApi,
  type ManualFoodInput,
  type MealType,
} from "../../services/supabase";
import { zodResolver } from "../forms/zodResolver";
import { ManualPreviewCard } from "./ManualPreviewCard";

const today = () => localDateInManila(new Date());
const nowTime = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
const nonnegative = (label: string, optional = false) =>
  z
    .string()
    .trim()
    .refine(
      (v) =>
        (optional && v === "") ||
        (Number.isFinite(Number(v)) && Number(v) >= 0),
      `${label} must be zero or greater.`,
    );
const schema = z.object({
  foodName: z.string().trim().min(1, "Enter a food name.").max(300),
  brand: z.string().trim().max(200),
  barcode: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^\d{8,14}$/.test(v),
      "Barcode must contain 8 to 14 digits.",
    ),
  servingUnit: z.string().trim().min(1, "Enter a serving unit."),
  quantity: z
    .string()
    .trim()
    .refine((v) => Number(v) > 0, "Quantity must be greater than zero."),
  calories: nonnegative("Calories"),
  proteinG: nonnegative("Protein", true),
  carbohydratesG: nonnegative("Carbohydrates", true),
  fatG: nonnegative("Fat", true),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  consumedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  consumedTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM."),
  saveForReuse: z.boolean(),
});
type Values = z.infer<typeof schema>;

const optionalNumber = (value: string) =>
  value === "" ? undefined : Number(value);
const idempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function ManualEntryFlow() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    barcode?: string;
    calories?: string;
    meal?: MealType;
    copy?: string;
  }>();
  const queryClient = useQueryClient();
  const [confirmationKey, setConfirmationKey] = useState(idempotencyKey);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      foodName: params.name ?? "",
      brand: "",
      barcode: params.barcode ?? "",
      servingUnit: "serving",
      quantity: "1",
      calories: params.calories ?? "",
      proteinG: "",
      carbohydratesG: "",
      fatG: "",
      mealType: params.meal ?? "snack",
      consumedDate: today(),
      consumedTime: nowTime(),
      saveForReuse: false,
    },
  });
  const preview = useMutation({
    mutationFn: (input: ManualFoodInput) =>
      mobileApi.createManualFoodPreview(input),
  });
  const confirm = useMutation({
    mutationFn: async () => {
      if (!preview.data || !preview.variables)
        throw new Error("Create a current preview first.");
      const result = await mobileApi.confirmFoodPreview(
        preview.data.id,
        preview.data.revision,
        confirmationKey,
      );
      if (preview.variables.saveForReuse)
        await mobileApi.saveFoodForReuse(preview.variables);
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["today"] });
      router.replace("/" as Href);
    },
  });

  const submit = (values: Values) => {
    setConfirmationKey(idempotencyKey());
    preview.mutate({
      foodName: values.foodName.trim(),
      brand: values.brand || undefined,
      barcode: values.barcode || undefined,
      servingUnit: values.servingUnit.trim(),
      quantity: Number(values.quantity),
      calories: Number(values.calories),
      proteinG: optionalNumber(values.proteinG),
      carbohydratesG: optionalNumber(values.carbohydratesG),
      fatG: optionalNumber(values.fatG),
      mealType: values.mealType,
      consumedDate: values.consumedDate,
      consumedTime: values.consumedTime,
      saveForReuse: values.saveForReuse,
    });
  };

  if (preview.data)
    return (
      <Screen>
        <ManualPreviewCard
          confirming={confirm.isPending}
          error={confirm.error?.message}
          onConfirm={() => confirm.mutate()}
          onEdit={() => {
            confirm.reset();
            preview.reset();
          }}
          preview={preview.data}
        />
      </Screen>
    );
  return (
    <Screen>
      <ScreenHeader
        eyebrow={params.copy ? "COPY AS NEW PREVIEW" : "MANUAL · PREVIEW FIRST"}
        title="Describe the food"
        annotation="Nothing logs yet"
      />
      <Text style={styles.intro}>
        Enter only values you know. Unknown macros stay unknown and will be
        clearly marked in the preview.
      </Text>
      <Controller
        control={control}
        name="foodName"
        render={({ field }) => (
          <Field
            error={errors.foodName?.message}
            label="Food name"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="brand"
        render={({ field }) => (
          <Field
            error={errors.brand?.message}
            label="Brand (optional)"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="barcode"
        render={({ field }) => (
          <Field
            error={errors.barcode?.message}
            keyboardType="number-pad"
            label="Barcode (optional)"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <View style={styles.two}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="quantity"
            render={({ field }) => (
              <Field
                error={errors.quantity?.message}
                keyboardType="decimal-pad"
                label="Quantity"
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
        </View>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="servingUnit"
            render={({ field }) => (
              <Field
                error={errors.servingUnit?.message}
                label="Unit"
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="calories"
        render={({ field }) => (
          <Field
            error={errors.calories?.message}
            keyboardType="decimal-pad"
            label="Calories (kcal)"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <View style={styles.three}>
        {(["proteinG", "carbohydratesG", "fatG"] as const).map((name) => (
          <View key={name} style={styles.flex}>
            <Controller
              control={control}
              name={name}
              render={({ field }) => (
                <Field
                  error={errors[name]?.message}
                  keyboardType="decimal-pad"
                  label={
                    {
                      proteinG: "Protein g",
                      carbohydratesG: "Carbs g",
                      fatG: "Fat g",
                    }[name]
                  }
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  value={field.value}
                />
              )}
            />
          </View>
        ))}
      </View>
      <Controller
        control={control}
        name="mealType"
        render={({ field }) => (
          <ChoiceChips<MealType>
            choices={[
              { label: "Breakfast", value: "breakfast" },
              { label: "Lunch", value: "lunch" },
              { label: "Dinner", value: "dinner" },
              { label: "Snack", value: "snack" },
            ]}
            label="Meal"
            onChange={field.onChange}
            value={field.value}
          />
        )}
      />
      <View style={styles.two}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="consumedDate"
            render={({ field }) => (
              <Field
                error={errors.consumedDate?.message}
                label="Date"
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
        </View>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="consumedTime"
            render={({ field }) => (
              <Field
                error={errors.consumedTime?.message}
                label="Time"
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="saveForReuse"
        render={({ field }) => (
          <Pressable
            accessibilityLabel="Save this food for reuse after confirmation"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: field.value }}
            onPress={() => field.onChange(!field.value)}
            style={styles.check}
          >
            <Text style={styles.checkMark}>{field.value ? "☑" : "☐"}</Text>
            <View style={styles.flex}>
              <Text style={styles.checkTitle}>Save for reuse</Text>
              <Text style={styles.checkCopy}>
                Creates a private saved food only after this preview is
                confirmed.
              </Text>
            </View>
          </Pressable>
        )}
      />
      {preview.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {preview.error.message}
        </Text>
      ) : null}
      <ActionButton
        busy={preview.isPending}
        label="Create complete preview"
        onPress={handleSubmit(submit)}
        accessibilityHint="Sends these values for a server-calculated preview; it does not log food"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xl,
  },
  two: { flexDirection: "row", gap: spacing.md },
  three: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  check: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
    minHeight: 64,
    padding: spacing.md,
  },
  checkMark: { color: colors.ink, fontSize: 24 },
  checkTitle: { color: colors.ink, fontFamily: type.bodyStrong, fontSize: 13 },
  checkCopy: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  error: {
    color: "#9F2D17",
    fontFamily: type.bodyStrong,
    marginTop: spacing.md,
  },
});
