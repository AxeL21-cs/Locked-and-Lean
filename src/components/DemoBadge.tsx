import { StyleSheet, Text } from "react-native";

import { useAppTheme } from "../design-system/theme";

export function DemoBadge({ label }: { label: string }) {
  const { colors, radius, type } = useAppTheme();
  return (
    <Text
      accessibilityLabel={`${label}, fixture data`}
      style={[
        styles.badge,
        {
          backgroundColor: colors.brand,
          borderRadius: radius.pill,
          color: colors.onBrand,
          fontFamily: type.label,
        },
      ]}
    >
      FIXTURE · {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    fontSize: 11,
    letterSpacing: 0.8,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
