import { useMutation, useQuery } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { AsyncStatePanel } from "../../components/AsyncStatePanel";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { type AppTheme, useAppTheme } from "../../design-system/theme";
import { mobileApi } from "../../services/supabase";

export function TargetReview() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const query = useQuery({
    queryKey: ["proposed-target"],
    queryFn: () => mobileApi.getProposedNutritionTarget(),
  });
  const confirm = useMutation({
    mutationFn: () => mobileApi.confirmNutritionTarget(query.data!.id),
    onSuccess: () => router.replace("/" as Href),
  });
  if (query.isLoading)
    return (
      <Screen>
        <AsyncStatePanel
          kind="loading"
          title="Calculating your proposal"
          message="The server is applying the adult formula and safe target bounds."
        />
      </Screen>
    );
  if (query.error)
    return (
      <Screen>
        <AsyncStatePanel
          actionLabel="Retry"
          kind="error"
          message={query.error.message}
          onAction={() => query.refetch()}
          title="Targets could not load"
        />
      </Screen>
    );
  if (!query.data)
    return (
      <Screen>
        <AsyncStatePanel
          actionLabel="Enter details"
          kind="empty"
          message="Complete onboarding before reviewing a target."
          onAction={() => router.replace("/onboarding" as Href)}
          title="No proposal yet"
        />
      </Screen>
    );
  const target = query.data;
  return (
    <Screen>
      <ScreenHeader
        eyebrow="PROPOSAL · NOT ACTIVE"
        title="Review your targets"
        annotation="Confirm to activate"
      />
      <View style={styles.energy}>
        <Text style={styles.kcal}>
          {Math.round(target.calorieTarget).toLocaleString()}
        </Text>
        <Text style={styles.kcalLabel}>KCAL / DAY</Text>
      </View>
      <View style={styles.macros}>
        {[
          ["Protein", target.proteinTargetG],
          ["Carbohydrates", target.carbohydrateTargetG],
          ["Fat", target.fatTargetG],
        ].map(([label, value]) => (
          <View key={String(label)} style={styles.macro}>
            <Text style={styles.macroValue}>{Math.round(Number(value))} g</Text>
            <Text style={styles.macroLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.detail}>
        <Text style={styles.detailTitle}>Calculation record</Text>
        <Text style={styles.detailBody}>
          {target.formulaName} · version {target.formulaVersion}
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
        accessibilityHint={`Activates proposal ${target.id}`}
        busy={confirm.isPending}
        label="Confirm and activate these targets"
        onPress={() => confirm.mutate()}
      />
      <ActionButton
        label="Change my details"
        onPress={() => router.replace("/onboarding" as Href)}
        tone="secondary"
      />
    </Screen>
  );
}
const createStyles = ({ colors, radius, spacing, type }: AppTheme) =>
  StyleSheet.create({
    energy: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.borderStrong,
      borderRadius: radius.xl,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.xl,
    },
    kcal: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: 58,
      letterSpacing: -2,
    },
    kcalLabel: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: 12,
      letterSpacing: 2,
    },
    macros: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    macro: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      minWidth: 104,
      padding: spacing.md,
    },
    macroValue: { color: colors.text, fontFamily: type.display, fontSize: 20 },
    macroLabel: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: 12,
      marginTop: spacing.xs,
    },
    detail: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      marginTop: spacing.xl,
      paddingBottom: spacing.lg,
    },
    detailTitle: { color: colors.text, fontFamily: type.display, fontSize: 22 },
    detailBody: {
      color: colors.textMuted,
      fontFamily: type.body,
      marginTop: spacing.xs,
    },
    assumption: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: 12,
      marginTop: spacing.sm,
    },
    warning: {
      backgroundColor: colors.infoContainer,
      borderColor: colors.info,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: spacing.lg,
      padding: spacing.lg,
    },
    warningTitle: { color: colors.text, fontFamily: type.bodyStrong },
    warningBody: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: 12,
      lineHeight: 18,
      marginTop: spacing.xs,
    },
    error: {
      color: colors.danger,
      fontFamily: type.bodyStrong,
      marginTop: spacing.md,
    },
  });
