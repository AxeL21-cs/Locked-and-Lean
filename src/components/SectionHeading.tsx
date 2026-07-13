import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type, typeScale } from "../design-system/tokens";

type Props = { eyebrow: string; title: string; action?: string };

export function SectionHeading({ eyebrow, title, action }: Props) {
  return (
    <View style={styles.wrap}>
      <View>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
      {action ? <Text style={styles.action}>{action}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xl,
  },
  eyebrow: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: typeScale.caption,
    letterSpacing: 1,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: typeScale.headline,
    marginTop: 3,
  },
  action: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: typeScale.caption,
    marginBottom: 4,
  },
});
