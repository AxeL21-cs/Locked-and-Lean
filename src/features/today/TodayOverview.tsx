import { Pressable, StyleSheet, Text, View } from "react-native";

import { MacroRail } from "../../components/MacroRail";
import type { AppTheme } from "../../design-system/theme";
import { useAppTheme } from "../../design-system/theme";
import type { TodaySummary } from "../../services/supabase";

type Props = {
  onSetTarget: () => void;
  summary: TodaySummary;
};

export function TodayOverview({ onSetTarget, summary }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const target = summary.calorieTarget;
  const delta = target == null ? null : target - summary.caloriesConsumed;
  const displayValue =
    delta == null ? summary.caloriesConsumed : Math.abs(delta);
  const displayLabel =
    delta == null ? "kcal logged" : delta >= 0 ? "kcal left" : "kcal over";

  return (
    <View style={styles.summary}>
      <View style={styles.energyRow}>
        <View style={styles.energyCopy}>
          <Text style={styles.eyebrow}>
            {target == null ? "ENERGY LOGGED" : "ENERGY BALANCE"}
          </Text>
          <View style={styles.valueRow}>
            <Text style={styles.value}>
              {Math.round(displayValue).toLocaleString()}
            </Text>
            <Text style={styles.valueLabel}>{displayLabel}</Text>
          </View>
        </View>
        {target == null ? null : (
          <View
            accessible
            accessibilityLabel={`${Math.round(summary.caloriesConsumed)} of ${Math.round(target)} calories consumed`}
            style={styles.targetCopy}
          >
            <Text style={styles.targetValue}>
              {Math.round(summary.caloriesConsumed).toLocaleString()}
            </Text>
            <Text style={styles.targetLabel}>
              of {Math.round(target).toLocaleString()}
            </Text>
          </View>
        )}
      </View>

      {target == null ? (
        <Pressable
          accessibilityHint="Opens target setup for review"
          accessibilityLabel="Set a daily calorie target"
          accessibilityRole="button"
          android_ripple={{ color: theme.colors.brandContainer }}
          onPress={onSetTarget}
          style={({ pressed }) => [
            styles.targetAction,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.targetActionText}>Set a daily target</Text>
          <Text accessible={false} style={styles.targetArrow}>
            →
          </Text>
        </Pressable>
      ) : (
        <View style={styles.energyRail}>
          <MacroRail
            label="Daily energy"
            target={target}
            unit="kcal"
            value={summary.caloriesConsumed}
          />
        </View>
      )}

      <View style={styles.macros}>
        <MacroValue
          label="Protein"
          target={summary.proteinTargetG}
          value={summary.proteinConsumedG}
        />
        <MacroValue
          label="Carbs"
          target={summary.carbohydrateTargetG}
          value={summary.carbohydratesConsumedG}
        />
        <MacroValue
          label="Fat"
          target={summary.fatTargetG}
          value={summary.fatConsumedG}
        />
      </View>
    </View>
  );
}

function MacroValue({
  label,
  target,
  value,
}: {
  label: string;
  target: number | null;
  value: number;
}) {
  const styles = createStyles(useAppTheme());
  const roundedValue = Math.round(value);
  const roundedTarget = target == null ? null : Math.round(target);
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${roundedValue} grams; ${roundedTarget == null ? "target not set" : `target ${roundedTarget} grams`}`}
      style={styles.macro}
    >
      <Text style={styles.macroValue}>
        {roundedValue}
        <Text style={styles.macroUnit}>g</Text>
      </Text>
      <Text style={styles.macroLabel}>{label}</Text>
      {roundedTarget == null ? null : (
        <Text style={styles.macroTarget}>target {roundedTarget}g</Text>
      )}
    </View>
  );
}

function createStyles({ colors, spacing, type, typeScale }: AppTheme) {
  return StyleSheet.create({
    summary: {
      borderBottomColor: colors.borderStrong,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderStrong,
      borderTopWidth: StyleSheet.hairlineWidth,
      marginTop: spacing.lg,
      paddingVertical: spacing.lg,
    },
    energyRow: {
      alignItems: "flex-end",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      justifyContent: "space-between",
    },
    energyCopy: { flex: 1, minWidth: 210 },
    eyebrow: {
      color: colors.textMuted,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.7,
    },
    valueRow: {
      alignItems: "baseline",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    value: {
      color: colors.text,
      fontFamily: type.numeric,
      fontSize: 42,
      letterSpacing: -1.6,
      lineHeight: 50,
    },
    valueLabel: {
      color: colors.textMuted,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.bodySmall,
      paddingBottom: 7,
    },
    targetCopy: { alignItems: "flex-end", paddingBottom: 7 },
    targetValue: {
      color: colors.text,
      fontFamily: type.numeric,
      fontSize: typeScale.title,
    },
    targetLabel: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      marginTop: 2,
    },
    targetAction: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      marginTop: spacing.sm,
      minHeight: 48,
      paddingRight: spacing.sm,
    },
    targetActionText: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: typeScale.bodySmall,
    },
    targetArrow: {
      color: colors.brandStrong,
      fontFamily: type.body,
      fontSize: typeScale.title,
    },
    pressed: { opacity: 0.68 },
    energyRail: { marginTop: spacing.md },
    macros: {
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      marginTop: spacing.lg,
      paddingTop: spacing.md,
    },
    macro: { flex: 1, minWidth: 88 },
    macroValue: {
      color: colors.text,
      fontFamily: type.numeric,
      fontSize: typeScale.title,
      lineHeight: 26,
    },
    macroUnit: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
    },
    macroLabel: {
      color: colors.textMuted,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.caption,
      marginTop: 2,
    },
    macroTarget: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: 11,
      marginTop: 2,
    },
  });
}
