import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { ActionButton } from "../../components/ActionButton";
import { BrandMark } from "../../components/BrandMark";
import { ChoiceChips } from "../../components/ChoiceChips";
import { Field } from "../../components/Field";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { PRODUCT } from "../../design-system/product";
import { type AppTheme, useAppTheme } from "../../design-system/theme";
import {
  mobileApi,
  type ActivityLevel,
  type FormulaSex,
  type Goal,
  type ProfileInput,
} from "../../services/supabase";
import { zodResolver } from "../forms/zodResolver";

const numeric = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine(
      (v) => Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max,
      `${label} must be between ${min} and ${max}.`,
    );
const schema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name.").max(80),
  ageYears: numeric("Age", 18, 120),
  heightCm: numeric("Height", 50, 300),
  weightKg: numeric("Weight", 20, 500),
  targetRate: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || (Number(v) >= 0.1 && Number(v) <= 1),
      "Target rate must be between 0.1 and 1 kg per week.",
    ),
  formulaSex: z.enum(["female", "male"]),
  activityLevel: z.enum([
    "sedentary",
    "lightly_active",
    "moderately_active",
    "very_active",
    "extra_active",
  ]),
  goal: z.enum(["lose", "maintain", "gain"]),
});
type Values = z.infer<typeof schema>;

export function OnboardingForm() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: "",
      ageYears: "",
      heightCm: "",
      weightKg: "",
      targetRate: "",
      formulaSex: "female",
      activityLevel: "lightly_active",
      goal: "maintain",
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const rate = values.targetRate ? Number(values.targetRate) : undefined;
      const input: ProfileInput = {
        displayName: values.displayName.trim(),
        ageYears: Number(values.ageYears),
        formulaSex: values.formulaSex,
        heightCm: Number(values.heightCm),
        weightKg: Number(values.weightKg),
        activityLevel: values.activityLevel,
        goal: values.goal,
        preferredUnits: "metric",
        timezone: PRODUCT.timezone,
        targetRateKgPerWeek: values.goal === "maintain" ? undefined : rate,
      };
      await mobileApi.upsertProfile(input);
      return mobileApi.proposeNutritionTarget(input);
    },
    onSuccess: (target) => {
      queryClient.setQueryData(["proposed-target"], target);
      router.push("/target-review" as Href);
    },
  });

  return (
    <Screen>
      <View style={styles.brandLockup}>
        <BrandMark size={68} showWordmark />
      </View>
      <ScreenHeader
        eyebrow="ADULT ONBOARDING"
        title="Set your baseline"
        annotation="Metric · Manila time"
      />
      <View style={styles.note}>
        <Text style={styles.noteTitle}>Why these details?</Text>
        <Text style={styles.noteBody}>
          They support an adult calorie estimate. Biological sex is used only by
          the selected formula. Targets are informational, never a diagnosis.
        </Text>
      </View>
      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <Field
            autoComplete="name"
            error={errors.displayName?.message}
            label="Display name"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="ageYears"
        render={({ field }) => (
          <Field
            error={errors.ageYears?.message}
            keyboardType="number-pad"
            label="Age"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="formulaSex"
        render={({ field }) => (
          <ChoiceChips<FormulaSex>
            choices={[
              { label: "Female", value: "female" },
              { label: "Male", value: "male" },
            ]}
            error={errors.formulaSex?.message}
            label="Biological sex used by formula"
            onChange={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="heightCm"
        render={({ field }) => (
          <Field
            error={errors.heightCm?.message}
            keyboardType="decimal-pad"
            label="Height (cm)"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="weightKg"
        render={({ field }) => (
          <Field
            error={errors.weightKg?.message}
            keyboardType="decimal-pad"
            label="Current weight (kg)"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="activityLevel"
        render={({ field }) => (
          <ChoiceChips<ActivityLevel>
            choices={[
              { label: "Sedentary", value: "sedentary" },
              { label: "Light", value: "lightly_active" },
              { label: "Moderate", value: "moderately_active" },
              { label: "Very active", value: "very_active" },
              { label: "Extra active", value: "extra_active" },
            ]}
            label="Activity level"
            onChange={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="goal"
        render={({ field }) => (
          <ChoiceChips<Goal>
            choices={[
              { label: "Lose", value: "lose" },
              { label: "Maintain", value: "maintain" },
              { label: "Gain", value: "gain" },
            ]}
            label="Goal"
            onChange={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="targetRate"
        render={({ field }) => (
          <Field
            error={errors.targetRate?.message}
            hint="Optional. Ignored for maintenance."
            keyboardType="decimal-pad"
            label="Target rate (kg/week)"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Field editable={false} label="Preferred units" value="Metric" />
      <Field editable={false} label="Timezone" value={PRODUCT.timezone} />
      {mutation.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {mutation.error.message}
        </Text>
      ) : null}
      <ActionButton
        busy={mutation.isPending}
        label="Calculate proposed targets"
        onPress={handleSubmit((v) => mutation.mutate(v))}
      />
    </Screen>
  );
}
const createStyles = ({ colors, radius, spacing, type }: AppTheme) =>
  StyleSheet.create({
    brandLockup: { alignSelf: "flex-start", marginBottom: spacing.sm },
    note: {
      backgroundColor: colors.infoContainer,
      borderColor: colors.info,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.lg,
    },
    noteTitle: { color: colors.text, fontFamily: type.display, fontSize: 19 },
    noteBody: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: 13,
      lineHeight: 20,
      marginTop: spacing.xs,
    },
    error: {
      color: colors.danger,
      fontFamily: type.bodyStrong,
      marginTop: spacing.md,
    },
  });
