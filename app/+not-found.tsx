import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../src/components/Screen";
import { PRODUCT } from "../src/design-system/product";
import { colors, radius, spacing, type } from "../src/design-system/tokens";

export default function NotFoundScreen() {
  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>404 · FIELD NOTE MISSING</Text>
        <Text style={styles.title}>This page slipped out of the journal.</Text>
        <Text style={styles.body}>
          Return to {PRODUCT.name} and keep today’s record moving.
        </Text>
        <Link href="/" style={styles.link} accessibilityRole="link">
          Back to Today
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xxl,
    padding: spacing.xl,
  },
  eyebrow: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: 12,
    letterSpacing: 1.4,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 34,
    lineHeight: 39,
    marginTop: spacing.md,
  },
  body: {
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.md,
  },
  link: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    color: colors.rice,
    fontFamily: type.label,
    marginTop: spacing.xl,
    minHeight: 52,
    overflow: "hidden",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    textAlign: "center",
  },
});
