import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { ActionButton } from "../../components/ActionButton";
import { ChoiceChips } from "../../components/ChoiceChips";
import { Field } from "../../components/Field";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { PRODUCT } from "../../design-system/product";
import { type AppTheme, useAppTheme } from "../../design-system/theme";
import {
  calculateBmi,
  deriveWeightGoal,
} from "../../domain/targets/goalPlanner";
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
      (value) =>
        Number.isFinite(Number(value)) &&
        Number(value) >= min &&
        Number(value) <= max,
      `${label} must be between ${min} and ${max}.`,
    );

const schema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name.").max(80),
  ageYears: numeric("Age", 18, 120),
  heightCm: numeric("Height", 50, 300),
  weightKg: numeric("Current weight", 20, 500),
  targetWeightKg: numeric("Target weight", 20, 500),
  targetRate: z
    .string()
    .trim()
    .refine(
      (value) =>
        Number.isFinite(Number(value)) &&
        Number(value) >= 0.1 &&
        Number(value) <= 1,
      "Choose a pace between 0.1 and 1 kg per week.",
    ),
  formulaSex: z.enum(["female", "male"]),
  activityLevel: z.enum([
    "sedentary",
    "lightly_active",
    "moderately_active",
    "very_active",
    "extra_active",
  ]),
});

type Values = z.infer<typeof schema>;
type Pace = "0.1" | "0.25" | "0.5" | "0.75";

const lossPaces = [
  { label: "0.25 kg", value: "0.25" },
  { label: "0.5 kg", value: "0.5" },
  { label: "0.75 kg", value: "0.75" },
] as const;

const gainPaces = [
  { label: "0.1 kg", value: "0.1" },
  { label: "0.25 kg", value: "0.25" },
  { label: "0.5 kg", value: "0.5" },
] as const;

const activityDetails: Record<ActivityLevel, string> = {
  sedentary: "Mostly seated, with little intentional exercise.",
  lightly_active: "Light exercise or active errands about 1–3 days per week.",
  moderately_active: "Moderate exercise about 3–5 days per week.",
  very_active: "Hard exercise or training about 6–7 days per week.",
  extra_active:
    "Very hard training, a highly physical job, or both. Choose this sparingly.",
};

const directionLabels: Record<Goal, string> = {
  lose: "Gradual weight loss",
  maintain: "Weight maintenance",
  gain: "Gradual weight gain",
};

function asFieldValue(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function nearestPace(value: number | null | undefined, goal: Goal): Pace {
  const options = goal === "gain" ? gainPaces : lossPaces;
  const fallback = goal === "gain" ? 0.25 : 0.5;
  const requested = value && value > 0 ? Math.abs(value) : fallback;
  return options.reduce((nearest, option) =>
    Math.abs(Number(option.value) - requested) <
    Math.abs(Number(nearest.value) - requested)
      ? option
      : nearest,
  ).value;
}

export function OnboardingForm() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const hydrated = useRef(false);
  const setupQuery = useQuery({
    queryKey: ["goal-setup"],
    queryFn: () => mobileApi.getGoalSetup(),
  });
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: "",
      ageYears: "",
      heightCm: "",
      weightKg: "",
      targetWeightKg: "",
      targetRate: "0.5",
    },
  });

  useEffect(() => {
    if (hydrated.current || setupQuery.isPending || isDirty) return;
    hydrated.current = true;
    const setup = setupQuery.data;
    if (!setup) return;
    const goal =
      deriveWeightGoal(
        setup.currentWeightKg ?? Number.NaN,
        setup.targetWeightKg ?? setup.currentWeightKg ?? Number.NaN,
      ) ?? "maintain";
    reset({
      displayName: setup.displayName ?? "",
      ageYears: asFieldValue(setup.ageYears),
      formulaSex: setup.formulaSex ?? undefined,
      heightCm: asFieldValue(setup.heightCm),
      weightKg: asFieldValue(setup.currentWeightKg),
      targetWeightKg: asFieldValue(
        setup.targetWeightKg ?? setup.currentWeightKg,
      ),
      targetRate: nearestPace(setup.requestedWeeklyChangeKg, goal),
      activityLevel: setup.activityLevel ?? undefined,
    });
  }, [isDirty, reset, setupQuery.data, setupQuery.isPending]);

  const [heightValue, weightValue, targetWeightValue, activityLevel, pace] =
    useWatch({
      control,
      name: [
        "heightCm",
        "weightKg",
        "targetWeightKg",
        "activityLevel",
        "targetRate",
      ],
    });
  const heightCm = Number(heightValue);
  const weightKg = Number(weightValue);
  const targetWeightKg = Number(targetWeightValue);
  const goal = deriveWeightGoal(weightKg, targetWeightKg);
  const currentBmi = calculateBmi(heightCm, weightKg);
  const targetBmi = calculateBmi(heightCm, targetWeightKg);
  const paceChoices = goal === "gain" ? gainPaces : lossPaces;

  useEffect(() => {
    if (!goal || goal === "maintain") return;
    if (paceChoices.some((choice) => choice.value === pace)) return;
    setValue("targetRate", nearestPace(Number(pace), goal));
  }, [goal, pace, paceChoices, setValue]);

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const direction = deriveWeightGoal(
        Number(values.weightKg),
        Number(values.targetWeightKg),
      );
      if (!direction)
        throw new Error("Enter a valid current and target weight.");
      const input: ProfileInput = {
        displayName: values.displayName.trim(),
        ageYears: Number(values.ageYears),
        formulaSex: values.formulaSex,
        heightCm: Number(values.heightCm),
        weightKg: Number(values.weightKg),
        targetWeightKg: Number(values.targetWeightKg),
        activityLevel: values.activityLevel,
        preferredUnits: "metric",
        timezone: PRODUCT.timezone,
        targetRateKgPerWeek:
          direction === "maintain" ? undefined : Number(values.targetRate),
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
    <Screen plain>
      <ScreenHeader
        eyebrow="GOAL PLANNER"
        title="Build a realistic target"
        annotation="Your proposal stays inactive until you review and confirm it."
      />

      {setupQuery.isPending ? (
        <Text accessibilityLiveRegion="polite" style={styles.restoreStatus}>
          Restoring your latest details…
        </Text>
      ) : setupQuery.error ? (
        <View accessibilityRole="alert" style={styles.restoreError}>
          <Text style={styles.restoreErrorText}>
            Saved details could not be restored. You can still enter them below.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setupQuery.refetch()}
            style={styles.retry}
          >
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.intro}>
        <Text style={styles.introTitle}>How the estimate works</Text>
        <Text style={styles.introBody}>
          Age, formula sex, height, current weight, and activity estimate daily
          energy needs. Your target weight sets the direction and timeline. BMI
          is shown only as a screening estimate—not as the calorie formula or a
          diagnosis.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>1 · ABOUT YOU</Text>
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
              hint="This planner is for adults age 18 and older."
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
              label="Biological sex used by the formula"
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
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>2 · SET YOUR DESTINATION</Text>
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
          name="targetWeightKg"
          render={({ field }) => (
            <Field
              error={errors.targetWeightKg?.message}
              hint="The server uses this to derive loss, maintenance, or gain."
              keyboardType="decimal-pad"
              label="Target weight (kg)"
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              value={field.value}
            />
          )}
        />

        {goal && currentBmi && targetBmi ? (
          <View
            accessible
            accessibilityLabel={`${directionLabels[goal]}. Current BMI ${currentBmi.toFixed(
              1,
            )}; target BMI ${targetBmi.toFixed(1)}. BMI is a screening estimate.`}
            style={styles.goalPreview}
          >
            <Text style={styles.previewLabel}>{directionLabels[goal]}</Text>
            <View style={styles.bmiPath}>
              <View>
                <Text style={styles.bmiValue}>{currentBmi.toFixed(1)}</Text>
                <Text style={styles.bmiLabel}>CURRENT BMI</Text>
              </View>
              <Text accessibilityElementsHidden style={styles.arrow}>
                →
              </Text>
              <View style={styles.bmiEnd}>
                <Text style={styles.bmiValue}>{targetBmi.toFixed(1)}</Text>
                <Text style={styles.bmiLabel}>TARGET BMI</Text>
              </View>
            </View>
            <Text style={styles.screeningNote}>
              Screening estimates only. The server verifies the goal and safe
              bounds before creating a proposal.
            </Text>
          </View>
        ) : (
          <Text style={styles.inlineHint}>
            Enter height and both weights to preview your direction and BMI.
          </Text>
        )}

        {goal && goal !== "maintain" ? (
          <Controller
            control={control}
            name="targetRate"
            render={({ field }) => (
              <ChoiceChips<Pace>
                choices={paceChoices}
                error={errors.targetRate?.message}
                label={`Preferred ${goal === "lose" ? "loss" : "gain"} pace per week`}
                onChange={field.onChange}
                value={field.value as Pace}
              />
            )}
          />
        ) : goal === "maintain" ? (
          <Text style={styles.inlineHint}>
            No weekly pace is needed when current and target weight match.
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>3 · DAILY MOVEMENT</Text>
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
              label="Usual activity level"
              onChange={field.onChange}
              value={field.value}
            />
          )}
        />
        {activityLevel ? (
          <Text accessibilityLiveRegion="polite" style={styles.activityHint}>
            {activityDetails[activityLevel]}
          </Text>
        ) : (
          <Text style={styles.inlineHint}>
            Choose the level that best matches a typical week.
          </Text>
        )}
      </View>

      <View accessibilityRole="summary" style={styles.caution}>
        <Text style={styles.cautionTitle}>Before you continue</Text>
        <Text style={styles.cautionBody}>
          This adult estimate is informational, not medical advice. Ask a
          qualified clinician for individualized guidance if you are pregnant or
          breastfeeding, recovering from an eating disorder, under 18, or
          managing a condition or medicine that affects weight or nutrition.
        </Text>
      </View>

      {mutation.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {mutation.error.message}
        </Text>
      ) : null}
      <ActionButton
        accessibilityHint="Creates a server-verified proposal for you to review. It does not activate the target."
        busy={mutation.isPending}
        label="Calculate and review"
        onPress={handleSubmit((values) => mutation.mutate(values))}
      />
      <Text style={styles.footerNote}>
        Metric units · {PRODUCT.timezone.replace("_", " ")}
      </Text>
    </Screen>
  );
}

const createStyles = ({ colors, radius, spacing, type, typeScale }: AppTheme) =>
  StyleSheet.create({
    restoreStatus: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      marginTop: spacing.md,
    },
    restoreError: {
      alignItems: "center",
      borderBottomColor: colors.danger,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
      paddingVertical: spacing.md,
    },
    restoreErrorText: {
      color: colors.textMuted,
      flex: 1,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 20,
    },
    retry: {
      alignItems: "center",
      borderColor: colors.borderStrong,
      borderRadius: radius.pill,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    retryLabel: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.bodySmall,
    },
    intro: {
      borderLeftColor: colors.brandStrong,
      borderLeftWidth: 3,
      marginTop: spacing.xl,
      paddingLeft: spacing.md,
    },
    introTitle: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.body,
    },
    introBody: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    section: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingBottom: spacing.xl,
      paddingTop: spacing.xl,
    },
    sectionEyebrow: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 1.1,
    },
    goalPreview: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.lg,
      marginTop: spacing.lg,
      padding: spacing.lg,
    },
    previewLabel: {
      color: colors.brandStrong,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.bodySmall,
    },
    bmiPath: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.md,
    },
    bmiEnd: { alignItems: "flex-end" },
    bmiValue: {
      color: colors.text,
      fontFamily: type.numeric,
      fontSize: 30,
      lineHeight: 34,
    },
    bmiLabel: {
      color: colors.textFaint,
      fontFamily: type.label,
      fontSize: 11,
      letterSpacing: 0.8,
      marginTop: spacing.xs,
    },
    arrow: {
      color: colors.brandStrong,
      fontFamily: type.bodyStrong,
      fontSize: 26,
    },
    screeningNote: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      lineHeight: 18,
      marginTop: spacing.md,
    },
    inlineHint: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 20,
      marginTop: spacing.md,
    },
    activityHint: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 20,
      marginTop: spacing.sm,
    },
    caution: {
      backgroundColor: colors.infoContainer,
      borderColor: colors.info,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.lg,
    },
    cautionTitle: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.bodySmall,
    },
    cautionBody: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      lineHeight: 19,
      marginTop: spacing.xs,
    },
    error: {
      color: colors.danger,
      fontFamily: type.bodyStrong,
      marginTop: spacing.md,
    },
    footerNote: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      marginTop: spacing.md,
      textAlign: "center",
    },
  });
