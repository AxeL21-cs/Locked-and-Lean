import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { colors, radius, spacing, type } from "../../design-system/tokens";
import type { FoodPreview } from "../../services/supabase";

const macro = (value: number | null, unit = "g") =>
  value == null ? "Unknown" : `${Math.round(value * 10) / 10} ${unit}`;

export function ManualPreviewCard({
  preview,
  onConfirm,
  onEdit,
  confirming,
  error,
}: {
  preview: FoodPreview;
  onConfirm: () => void;
  onEdit: () => void;
  confirming?: boolean;
  error?: string;
}) {
  const complete =
    preview.totalProteinG != null &&
    preview.totalCarbohydratesG != null &&
    preview.totalFatG != null;
  return (
    <View>
      <View
        accessible
        accessibilityLabel={`Preview revision ${preview.revision}, not yet logged`}
        style={styles.stamp}
      >
        <Text style={styles.stampTop}>PREVIEW · NOT LOGGED</Text>
        <Text style={styles.stampRevision}>REVISION {preview.revision}</Text>
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        Check every detail
      </Text>
      <Text style={styles.copy}>
        This is the complete current preview. Editing any value creates a new
        preview that must be reviewed again.
      </Text>
      {preview.items.map((item) => (
        <View key={item.id} style={styles.item}>
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
            <Text key={warning} style={styles.warning}>
              ! {warning}
            </Text>
          ))}
        </View>
      ))}
      <View style={styles.total}>
        <Text style={styles.totalLabel}>SERVER PREVIEW TOTAL</Text>
        <Text style={styles.calories}>
          {Math.round(preview.totalCalories)}
          <Text style={styles.unit}> kcal</Text>
        </Text>
        <View style={styles.macroRow}>
          <Text style={styles.macro}>P {macro(preview.totalProteinG)}</Text>
          <Text style={styles.macro}>
            C {macro(preview.totalCarbohydratesG)}
          </Text>
          <Text style={styles.macro}>F {macro(preview.totalFatG)}</Text>
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
        busy={confirming}
        label={`Confirm revision ${preview.revision} and log it`}
        onPress={onConfirm}
        accessibilityHint="Permanently logs this exact displayed revision through the server confirmation transaction"
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

const styles = StyleSheet.create({
  stamp: {
    alignSelf: "flex-start",
    borderColor: colors.tomato,
    borderRadius: radius.sm,
    borderWidth: 2,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    transform: [{ rotate: "-1deg" }],
  },
  stampTop: {
    color: colors.tomato,
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  stampRevision: {
    color: colors.ink,
    fontFamily: type.label,
    fontSize: 13,
    marginTop: 2,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 35,
    letterSpacing: -1,
    marginTop: spacing.xl,
  },
  copy: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  item: {
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    paddingVertical: spacing.lg,
  },
  itemTop: { flexDirection: "row", gap: spacing.md },
  itemCopy: { flex: 1 },
  itemName: { color: colors.ink, fontFamily: type.display, fontSize: 22 },
  itemMeta: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 12,
    marginTop: 3,
  },
  itemKcal: { color: colors.ink, fontFamily: type.label, fontSize: 14 },
  provenance: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 11,
    marginTop: spacing.sm,
  },
  warning: {
    color: "#9F2D17",
    fontFamily: type.bodyStrong,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  total: {
    backgroundColor: colors.ink,
    borderRadius: radius.xl,
    marginTop: spacing.xl,
    padding: spacing.xl,
  },
  totalLabel: {
    color: colors.calamansi,
    fontFamily: type.label,
    fontSize: 9,
    letterSpacing: 1.6,
  },
  calories: {
    color: colors.rice,
    fontFamily: type.display,
    fontSize: 48,
    marginTop: spacing.sm,
  },
  unit: { color: colors.riceDark, fontFamily: type.label, fontSize: 13 },
  macroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  macro: { color: colors.riceDark, fontFamily: type.label, fontSize: 11 },
  incomplete: {
    backgroundColor: colors.tomatoWash,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  incompleteTitle: { color: colors.ink, fontFamily: type.bodyStrong },
  incompleteBody: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  meta: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.md,
  },
  error: {
    color: "#9F2D17",
    fontFamily: type.bodyStrong,
    fontSize: 13,
    marginTop: spacing.md,
  },
});
