import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import type { AppTheme } from "../../design-system/theme";
import { useAppTheme } from "../../design-system/theme";
import type { FoodPreview } from "../../services/supabase";

const macro = (value: number | null, unit = "g") =>
  value == null ? "Unknown" : `${Math.round(value * 10) / 10} ${unit}`;

export function ManualPreviewCard({
  preview,
  onConfirm,
  onEdit,
  confirming,
  error,
  localOnly,
}: {
  preview: FoodPreview;
  onConfirm: () => void;
  onEdit: () => void;
  confirming?: boolean;
  error?: string;
  localOnly?: boolean;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const complete =
    preview.totalProteinG != null &&
    preview.totalCarbohydratesG != null &&
    preview.totalFatG != null;

  return (
    <View>
      <View
        accessible
        accessibilityLabel={`Preview revision ${preview.revision}, not yet logged`}
        style={styles.statusCard}
      >
        <View style={styles.statusRule} />
        <View style={styles.statusCopy}>
          <Text style={styles.statusTop}>
            {localOnly
              ? "ON-DEVICE PREVIEW · NOT LOGGED"
              : "PREVIEW · NOT LOGGED"}
          </Text>
          <Text style={styles.statusRevision}>
            {localOnly
              ? "SERVER VERIFICATION PENDING"
              : `REVISION ${preview.revision}`}
          </Text>
        </View>
      </View>

      <Text accessibilityRole="header" style={styles.title}>
        Check every detail
      </Text>
      <Text style={styles.copy}>
        {localOnly
          ? "This snapshot contains exactly what you entered. After reconnecting, it logs only if the server preview matches; otherwise it stops for another review."
          : "This is the complete current preview. Editing any value creates a new preview that must be reviewed again."}
      </Text>

      <View style={styles.items}>
        {preview.items.map((item, index) => (
          <View key={item.id} style={styles.item}>
            <Text style={styles.itemIndex}>
              ITEM {String(index + 1).padStart(2, "0")}
            </Text>
            <View style={styles.itemTop}>
              <View style={styles.itemCopy}>
                <Text style={styles.itemName}>{item.foodName}</Text>
                {item.brand ? (
                  <Text style={styles.itemMeta}>
                    {item.brand} · {item.servingDescription}
                  </Text>
                ) : (
                  <Text style={styles.itemMeta}>{item.servingDescription}</Text>
                )}
              </View>
              <Text style={styles.itemKcal}>
                {Math.round(item.calories)} kcal
              </Text>
            </View>
            <Text style={styles.provenance}>
              {item.estimated
                ? "Estimated"
                : /manual|user/i.test(item.source)
                  ? "User-entered"
                  : "Source data"}{" "}
              · {item.source}
              {item.confidence == null
                ? " · confidence not provided"
                : ` · ${Math.round(item.confidence * 100)}% confidence`}
            </Text>
            {item.uncertainty.map((warning) => (
              <View key={warning} style={styles.warningRow}>
                <Text style={styles.warningMark}>!</Text>
                <Text style={styles.warning}>{warning}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.total}>
        <View style={styles.totalHead}>
          <Text style={styles.totalLabel}>
            {localOnly ? "ON-DEVICE SNAPSHOT" : "SERVER PREVIEW TOTAL"}
          </Text>
          <Text style={styles.totalState}>NOT LOGGED</Text>
        </View>
        <Text style={styles.calories}>
          {Math.round(preview.totalCalories)}
          <Text style={styles.unit}> kcal</Text>
        </Text>
        <View style={styles.macroRow}>
          <View style={styles.macroCell}>
            <Text style={styles.macroLabel}>PROTEIN</Text>
            <Text style={styles.macro}>{macro(preview.totalProteinG)}</Text>
          </View>
          <View style={styles.macroCell}>
            <Text style={styles.macroLabel}>CARBS</Text>
            <Text style={styles.macro}>
              {macro(preview.totalCarbohydratesG)}
            </Text>
          </View>
          <View style={styles.macroCell}>
            <Text style={styles.macroLabel}>FAT</Text>
            <Text style={styles.macro}>{macro(preview.totalFatG)}</Text>
          </View>
        </View>
      </View>

      {!complete ? (
        <View accessibilityRole="alert" style={styles.incomplete}>
          <Text style={styles.incompleteTitle}>Incomplete nutrition</Text>
          <Text style={styles.incompleteBody}>
            One or more macros are unknown. Calories can still be reviewed, but
            unknown values are not invented.
          </Text>
        </View>
      ) : null}

      <Text style={styles.meta}>
        Meal: {preview.mealType} · Consumed: {preview.consumedAt}
        {preview.expiresAt ? ` · Preview expires ${preview.expiresAt}` : ""}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <ActionButton
        accessibilityHint={
          localOnly
            ? "Stores this exact snapshot for server verification; it does not log food yet"
            : "Permanently logs this exact displayed revision through the server confirmation transaction"
        }
        busy={confirming}
        label={
          localOnly
            ? "Confirm snapshot and queue safely"
            : `Confirm revision ${preview.revision} and log it`
        }
        onPress={onConfirm}
      />
      <ActionButton
        disabled={confirming}
        label="Edit details before logging"
        onPress={onEdit}
        tone="secondary"
      />
    </View>
  );
}

const createStyles = ({
  colors,
  isDark,
  radius,
  spacing,
  type,
  typeScale,
}: AppTheme) =>
  StyleSheet.create({
    statusCard: {
      alignItems: "center",
      backgroundColor: colors.dangerContainer,
      borderColor: colors.danger,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.xl,
      overflow: "hidden",
      padding: spacing.md,
    },
    statusRule: {
      alignSelf: "stretch",
      backgroundColor: colors.danger,
      borderRadius: radius.pill,
      width: 5,
    },
    statusCopy: { flex: 1 },
    statusTop: {
      color: colors.danger,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 1,
    },
    statusRevision: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.bodySmall,
      lineHeight: 20,
      marginTop: 3,
    },
    title: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: typeScale.display,
      letterSpacing: -1,
      lineHeight: 42,
      marginTop: spacing.xl,
    },
    copy: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 22,
      marginTop: spacing.xs,
    },
    items: { marginTop: spacing.lg },
    item: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: spacing.sm,
      padding: spacing.md,
    },
    itemIndex: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.8,
    },
    itemTop: {
      alignItems: "flex-start",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    itemCopy: { flex: 1, minWidth: 180 },
    itemName: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: typeScale.title,
      lineHeight: 28,
    },
    itemMeta: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.label,
      lineHeight: 19,
      marginTop: 3,
    },
    itemKcal: {
      color: colors.text,
      fontFamily: type.numeric,
      fontSize: typeScale.body,
      lineHeight: 24,
    },
    provenance: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      lineHeight: 18,
      marginTop: spacing.sm,
    },
    warningRow: {
      alignItems: "flex-start",
      backgroundColor: colors.dangerContainer,
      borderRadius: radius.sm,
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
      padding: spacing.sm,
    },
    warningMark: {
      color: colors.danger,
      fontFamily: type.display,
      fontSize: typeScale.bodySmall,
    },
    warning: {
      color: colors.danger,
      flex: 1,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.caption,
      lineHeight: 18,
    },
    total: {
      backgroundColor: isDark ? colors.surfaceRaised : colors.text,
      borderRadius: radius.xl,
      marginTop: spacing.xl,
      padding: spacing.xl,
    },
    totalHead: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    totalLabel: {
      color: colors.brand,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 1.1,
    },
    totalState: {
      color: isDark ? colors.textMuted : colors.surfaceMuted,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.7,
    },
    calories: {
      color: isDark ? colors.text : colors.background,
      fontFamily: type.numeric,
      fontSize: 50,
      letterSpacing: -1.5,
      lineHeight: 58,
      marginTop: spacing.sm,
    },
    unit: {
      color: isDark ? colors.textMuted : colors.surfaceMuted,
      fontFamily: type.label,
      fontSize: typeScale.label,
    },
    macroRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    macroCell: {
      borderTopColor: colors.textFaint,
      borderTopWidth: 1,
      flex: 1,
      minWidth: 76,
      paddingTop: spacing.sm,
    },
    macroLabel: {
      color: colors.brand,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.7,
    },
    macro: {
      color: isDark ? colors.text : colors.background,
      fontFamily: type.numeric,
      fontSize: typeScale.bodySmall,
      lineHeight: 20,
      marginTop: 2,
    },
    incomplete: {
      backgroundColor: colors.dangerContainer,
      borderColor: colors.danger,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: spacing.md,
      padding: spacing.lg,
    },
    incompleteTitle: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.bodySmall,
    },
    incompleteBody: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      lineHeight: 18,
      marginTop: 3,
    },
    meta: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      lineHeight: 18,
      marginTop: spacing.md,
    },
    error: {
      color: colors.danger,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.bodySmall,
      lineHeight: 20,
      marginTop: spacing.md,
    },
  });
