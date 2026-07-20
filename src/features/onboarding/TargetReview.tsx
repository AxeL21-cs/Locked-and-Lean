import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { AsyncStatePanel } from "../../components/AsyncStatePanel";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { type AppTheme, useAppTheme } from "../../design-system/theme";
import {
  mobileApi,
  type Goal,
  type GoalSetup,
  type NutritionTarget,
} from "../../services/supabase";
import { useSession } from "../auth/SessionProvider";
import { writeCachedOnboardingCompletion } from "../auth/onboardingCompletionCache";

const TODAY_ROUTE = "/(tabs)" as Href;

const goalLabels: Record<Goal, string> = {
  lose: "Weight loss",
  maintain: "Weight maintenance",
  gain: "Weight gain",
};

const activityLabels = {
  sedentary: "Sedentary",
  lightly_active: "Lightly active",
  moderately_active: "Moderately active",
  very_active: "Very active",
  extra_active: "Extra active",
} as const;

function formatDecimal(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

function formatDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function paceLabel(goal: Goal, appliedWeeklyChangeKg: number) {
  if (goal === "maintain") return "No planned weekly change";
  const direction = goal === "lose" ? "loss" : "gain";
  return `${formatDecimal(Math.abs(appliedWeeklyChangeKg))} kg/week ${direction}`;
}

function signedCalories(value: number) {
  const rounded = Math.round(value);
  if (rounded === 0) return "No adjustment";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toLocaleString()} kcal/day`;
}

export function TargetReview() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const ownerId = session?.user.id;
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigationStarted = useRef(false);
  const query = useQuery({
    enabled: Boolean(ownerId),
    queryKey: ["proposed-target", ownerId],
    queryFn: () => mobileApi.getProposedNutritionTarget(),
  });
  const goalSetup = useQuery({
    enabled: Boolean(ownerId),
    queryFn: () => mobileApi.getGoalSetup(),
    queryKey: ["goal-setup", ownerId],
  });

  const openToday = useCallback(() => {
    router.dismissAll();
    router.replace(TODAY_ROUTE);
  }, [router]);

  const confirm = useMutation({
    mutationFn: () => mobileApi.confirmNutritionTarget(query.data!.id),
    onSuccess: (confirmedTarget) => {
      if (ownerId) {
        queryClient.setQueryData<GoalSetup>(
          ["goal-setup", ownerId],
          (current) => confirmedGoalSetup(current, confirmedTarget),
        );
        queryClient.setQueryData(
          ["onboarding-completion-cache", ownerId],
          true,
        );
        void writeCachedOnboardingCompletion(ownerId, true).catch(
          () => undefined,
        );
      }

      for (const queryKey of [
        ["today"],
        ["calendar-history"],
        ["day-history"],
        ["progress"],
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
      if (ownerId) {
        void queryClient.invalidateQueries({
          queryKey: ["goal-setup", ownerId],
        });
        void queryClient.invalidateQueries({
          queryKey: ["proposed-target", ownerId],
          refetchType: "none",
        });
      }
    },
  });

  useEffect(() => {
    const confirmedProposal = confirm.isSuccess;
    const recoveringConsumedProposal =
      !query.isPending && !query.data && goalSetup.data?.hasConfirmedTarget;
    if (
      !goalSetup.data?.hasConfirmedTarget ||
      (!confirmedProposal && !recoveringConsumedProposal) ||
      navigationStarted.current
    )
      return;

    navigationStarted.current = true;
    // The auth and tab indexes both use the "/" URL. Wait until the shared
    // confirmed state opens the protected tab route, then target that group
    // explicitly and clear setup history for correct Android Back behavior.
    openToday();
  }, [
    confirm.isSuccess,
    goalSetup.data?.hasConfirmedTarget,
    openToday,
    query.data,
    query.isPending,
  ]);

  if (query.isLoading)
    return (
      <Screen plain>
        <AsyncStatePanel
          kind="loading"
          title="Building your proposal"
          message="The server is checking your details, goal direction, and safe target bounds."
        />
      </Screen>
    );

  if (query.error)
    return (
      <Screen plain>
        <AsyncStatePanel
          actionLabel="Retry"
          kind="error"
          message={query.error.message}
          onAction={() => query.refetch()}
          title="Targets could not load"
        />
      </Screen>
    );

  if (!query.data && ownerId && goalSetup.isPending)
    return (
      <Screen plain>
        <AsyncStatePanel
          kind="loading"
          message="Confirming whether this proposal is already active."
          title="Checking target status"
        />
      </Screen>
    );

  if (!query.data && goalSetup.error)
    return (
      <Screen plain>
        <AsyncStatePanel
          actionLabel="Retry"
          kind="error"
          message="We could not verify whether this target is already active."
          onAction={() => goalSetup.refetch()}
          title="Target status could not load"
        />
      </Screen>
    );

  if (!query.data && goalSetup.data?.hasConfirmedTarget)
    return (
      <Screen plain>
        <AsyncStatePanel
          kind="loading"
          message="Your target is active. Opening Today now."
          title="Target confirmed"
        />
      </Screen>
    );

  if (!query.data)
    return (
      <Screen plain>
        <AsyncStatePanel
          actionLabel="Enter details"
          kind="empty"
          message="Complete the goal planner before reviewing a target."
          onAction={() => router.replace("/onboarding" as Href)}
          title="No proposal yet"
        />
      </Screen>
    );

  const target = query.data;
  const goalDate = formatDate(target.estimatedGoalDate);
  const requestedPace =
    target.goal === "maintain"
      ? null
      : Math.abs(target.requestedWeeklyChangeKg);
  const paceWasAdjusted =
    requestedPace != null &&
    Math.abs(requestedPace - Math.abs(target.appliedWeeklyChangeKg)) >= 0.01;

  return (
    <Screen plain>
      <ScreenHeader
        eyebrow="TARGET PROPOSAL · NOT ACTIVE"
        title="Review the exact plan"
        annotation="Nothing changes until you confirm this revision."
      />

      <View
        accessible
        accessibilityLabel={`${Math.round(
          target.calorieTarget,
        )} calories and ${Math.round(
          target.proteinTargetG,
        )} grams of protein per day.`}
        style={styles.primaryTargets}
      >
        <View style={styles.primaryMetric}>
          <Text style={styles.primaryValue}>
            {Math.round(target.calorieTarget).toLocaleString()}
          </Text>
          <Text style={styles.primaryLabel}>KCAL / DAY</Text>
        </View>
        <View style={styles.primaryDivider} />
        <View style={styles.primaryMetric}>
          <Text style={styles.proteinValue}>
            {Math.round(target.proteinTargetG)} g
          </Text>
          <Text style={styles.primaryLabel}>PROTEIN / DAY</Text>
        </View>
      </View>

      <View style={styles.secondaryMacros}>
        <View style={styles.secondaryMacro}>
          <Text style={styles.secondaryValue}>
            {Math.round(target.carbohydrateTargetG)} g
          </Text>
          <Text style={styles.secondaryLabel}>Carbohydrates</Text>
        </View>
        <View style={styles.secondaryMacro}>
          <Text style={styles.secondaryValue}>
            {Math.round(target.fatTargetG)} g
          </Text>
          <Text style={styles.secondaryLabel}>Fat</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your path</Text>
        <Text style={styles.sectionAnnotation}>{goalLabels[target.goal]}</Text>
        <View
          accessible
          accessibilityLabel={`Weight from ${formatDecimal(
            target.currentWeightKg,
            1,
          )} to ${formatDecimal(target.targetWeightKg, 1)} kilograms.`}
          style={styles.pathRow}
        >
          <View>
            <Text style={styles.pathValue}>
              {formatDecimal(target.currentWeightKg, 1)} kg
            </Text>
            <Text style={styles.pathLabel}>CURRENT</Text>
          </View>
          <Text accessibilityElementsHidden style={styles.pathArrow}>
            →
          </Text>
          <View style={styles.pathEnd}>
            <Text style={styles.pathValue}>
              {formatDecimal(target.targetWeightKg, 1)} kg
            </Text>
            <Text style={styles.pathLabel}>TARGET</Text>
          </View>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>BMI screening estimate</Text>
          <Text style={styles.dataValue}>
            {target.currentBmi.toFixed(1)} → {target.targetBmi.toFixed(1)}
          </Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Applied pace</Text>
          <Text style={styles.dataValue}>
            {paceLabel(target.goal, target.appliedWeeklyChangeKg)}
          </Text>
        </View>
        {goalDate ? (
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Estimated goal date</Text>
            <Text style={styles.dataValue}>{goalDate}</Text>
          </View>
        ) : null}
        {paceWasAdjusted ? (
          <Text style={styles.adjustmentNote}>
            You requested {formatDecimal(requestedPace)} kg/week. The applied
            pace is slower because the server enforced the calorie floor.
          </Text>
        ) : null}
        <Text style={styles.screeningNote}>
          BMI is a general screening estimate. It does not measure body
          composition and is not a diagnosis.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily energy estimate</Text>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Maintenance estimate</Text>
          <Text style={styles.dataValue}>
            {Math.round(target.maintenanceCalories).toLocaleString()} kcal
          </Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Goal adjustment</Text>
          <Text style={styles.dataValue}>
            {signedCalories(target.calorieAdjustment)}
          </Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Activity setting</Text>
          <Text style={styles.dataValue}>
            {activityLabels[target.activityLevel]}
          </Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Effective from</Text>
          <Text style={styles.dataValue}>
            {formatDate(target.effectiveFrom) ?? target.effectiveFrom}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Calculation record</Text>
        <Text style={styles.formula}>
          {target.formulaName} · version {target.formulaVersion}
        </Text>
        <Text style={styles.floor}>
          Calorie floor: {Math.round(target.calorieFloor).toLocaleString()} kcal
          / day
        </Text>
        {target.assumptions.map((item) => (
          <Text key={item} style={styles.assumption}>
            • {item}
          </Text>
        ))}
      </View>

      <View accessibilityRole="summary" style={styles.warning}>
        <Text style={styles.warningTitle}>Informational estimate</Text>
        <Text style={styles.warningBody}>
          {target.disclaimer ||
            "This adult estimate is not medical advice. Consult a qualified professional for individualized care."}
        </Text>
      </View>

      {confirm.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {confirm.error.message}
        </Text>
      ) : null}
      <ActionButton
        accessibilityHint={`Activates proposal ${target.id} exactly as shown`}
        busy={confirm.isPending}
        label="Confirm and use this target"
        onPress={() => confirm.mutate()}
      />
      <ActionButton
        accessibilityHint="Returns to the planner without activating this proposal"
        label="Revise my details"
        onPress={() => router.replace("/onboarding" as Href)}
        tone="secondary"
      />
    </Screen>
  );
}

function confirmedGoalSetup(
  current: GoalSetup | undefined,
  target: NutritionTarget,
): GoalSetup {
  return {
    displayName: current?.displayName ?? null,
    ageYears: target.ageYears,
    formulaSex: target.formulaSex,
    heightCm: target.heightCm,
    currentWeightKg: target.currentWeightKg,
    targetWeightKg: target.targetWeightKg,
    activityLevel: target.activityLevel,
    requestedWeeklyChangeKg: target.requestedWeeklyChangeKg,
    hasConfirmedTarget: true,
  };
}

const createStyles = ({ colors, radius, spacing, type, typeScale }: AppTheme) =>
  StyleSheet.create({
    primaryTargets: {
      alignItems: "stretch",
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.xl,
      flexDirection: "row",
      marginTop: spacing.xl,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
    },
    primaryMetric: {
      flex: 1,
      justifyContent: "center",
      minWidth: 0,
    },
    primaryDivider: {
      backgroundColor: colors.borderStrong,
      marginHorizontal: spacing.md,
      width: 1,
    },
    primaryValue: {
      color: colors.text,
      fontFamily: type.numeric,
      fontSize: 42,
      letterSpacing: -1.5,
      lineHeight: 46,
    },
    proteinValue: {
      color: colors.text,
      fontFamily: type.numeric,
      fontSize: 32,
      letterSpacing: -1,
      lineHeight: 40,
    },
    primaryLabel: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: 11,
      letterSpacing: 1.1,
      marginTop: spacing.xs,
    },
    secondaryMacros: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      paddingVertical: spacing.lg,
    },
    secondaryMacro: { flex: 1 },
    secondaryValue: {
      color: colors.text,
      fontFamily: type.numeric,
      fontSize: typeScale.title,
    },
    secondaryLabel: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      marginTop: spacing.xs,
    },
    section: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingVertical: spacing.xl,
    },
    sectionTitle: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: typeScale.title,
    },
    sectionAnnotation: {
      color: colors.brandStrong,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.bodySmall,
      marginTop: spacing.xs,
    },
    pathRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.lg,
    },
    pathEnd: { alignItems: "flex-end" },
    pathValue: {
      color: colors.text,
      fontFamily: type.numeric,
      fontSize: 26,
      lineHeight: 32,
    },
    pathLabel: {
      color: colors.textFaint,
      fontFamily: type.label,
      fontSize: 11,
      letterSpacing: 0.8,
      marginTop: spacing.xs,
    },
    pathArrow: {
      color: colors.brandStrong,
      fontFamily: type.bodyStrong,
      fontSize: 26,
    },
    dataRow: {
      alignItems: "flex-start",
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
      marginTop: spacing.md,
      paddingTop: spacing.md,
    },
    dataLabel: {
      color: colors.textMuted,
      flex: 1,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 20,
    },
    dataValue: {
      color: colors.text,
      flex: 1,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.bodySmall,
      lineHeight: 20,
      textAlign: "right",
    },
    adjustmentNote: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      lineHeight: 18,
      marginTop: spacing.md,
    },
    screeningNote: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      lineHeight: 18,
      marginTop: spacing.md,
    },
    formula: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      marginTop: spacing.sm,
    },
    floor: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      marginTop: spacing.sm,
    },
    assumption: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      lineHeight: 18,
      marginTop: spacing.sm,
    },
    warning: {
      backgroundColor: colors.infoContainer,
      borderColor: colors.info,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.lg,
    },
    warningTitle: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.bodySmall,
    },
    warningBody: {
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
  });
