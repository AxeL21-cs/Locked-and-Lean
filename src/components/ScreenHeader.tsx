import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type, typeScale } from "../design-system/tokens";

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
    fontSize: typeScale.caption,
    letterSpacing: 1,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  line: {
    gap: spacing.xs,
    marginTop: 6,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: typeScale.display,
    letterSpacing: -1.1,
    lineHeight: 40,
  },
  annotation: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: typeScale.bodySmall,
    lineHeight: 20,
  },
});
