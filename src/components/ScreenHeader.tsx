import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "../design-system/tokens";

type Props = { eyebrow: string; title: string; annotation?: string };

export function ScreenHeader({ eyebrow, title, annotation }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <View style={styles.line}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {annotation ? (
          <Text style={styles.annotation}>{annotation}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.lg },
  eyebrow: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: 10,
    letterSpacing: 1.8,
  },
  line: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 40,
    letterSpacing: -1.5,
  },
  annotation: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 11,
    marginBottom: 7,
  },
});
