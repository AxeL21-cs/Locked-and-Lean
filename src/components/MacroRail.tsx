import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "../design-system/tokens";

type Props = {
  compact?: boolean;
  label: string;
  target: number;
  unit: string;
  value: number;
};

export function MacroRail({ compact, label, target, unit, value }: Props) {
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

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  compact: { minWidth: 0 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  label: { color: colors.riceDark, fontFamily: type.bodyStrong, fontSize: 11 },
  value: { color: colors.riceDark, fontFamily: type.label, fontSize: 9 },
  track: {
    backgroundColor: colors.inkRule,
    borderRadius: radius.pill,
    height: 5,
    overflow: "hidden",
  },
  fill: {
    backgroundColor: colors.calamansi,
    borderRadius: radius.pill,
    height: "100%",
  },
});
