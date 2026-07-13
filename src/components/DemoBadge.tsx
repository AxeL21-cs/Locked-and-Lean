import { StyleSheet, Text } from "react-native";

import { colors, radius, type } from "../design-system/tokens";

export function DemoBadge({ label }: { label: string }) {
  return (
    <Text accessibilityLabel={`${label}, fixture data`} style={styles.badge}>
      FIXTURE · {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.calamansi,
    borderRadius: radius.pill,
    color: colors.ink,
    fontFamily: type.label,
    fontSize: 11,
    letterSpacing: 0.8,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
