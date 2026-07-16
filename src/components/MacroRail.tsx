import { StyleSheet, Text, View } from "react-native";

import type { AppTheme } from "../design-system/theme";
import { useAppTheme } from "../design-system/theme";

type Props = {
  compact?: boolean;
  label: string;
  target: number;
  unit: string;
  value: number;
};

export function MacroRail({ compact, label, target, unit, value }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const progress = target > 0 ? Math.max(0, Math.min(value / target, 1)) : 0;
  return (
    <View
      style={[styles.wrap, compact && styles.compact]}
      accessible
      accessibilityLabel={`${label}: ${value} of ${target} ${unit}`}
    >
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {value}/{target} {unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

function createStyles({ colors, radius, spacing, type, typeScale }: AppTheme) {
  return StyleSheet.create({
    wrap: { flex: 1 },
    compact: { minWidth: 0 },
    labelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    label: {
      color: colors.textMuted,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.caption,
    },
    value: {
      color: colors.textMuted,
      fontFamily: type.numeric,
      fontSize: typeScale.caption,
    },
    track: {
      backgroundColor: colors.borderStrong,
      borderRadius: radius.pill,
      height: 7,
      overflow: "hidden",
    },
    fill: {
      backgroundColor: colors.brand,
      borderRadius: radius.pill,
      height: "100%",
    },
  });
}
