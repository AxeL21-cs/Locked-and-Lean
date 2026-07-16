import { Link } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BrandMark } from "../src/components/BrandMark";
import { Screen } from "../src/components/Screen";
import { PRODUCT } from "../src/design-system/product";
import { type AppTheme, useAppTheme } from "../src/design-system/theme";

export default function NotFoundScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <Screen>
      <View style={styles.card}>
        <BrandMark decorative size={64} />
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

const createStyles = ({ colors, elevation, radius, spacing, type }: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: spacing.xxl,
      padding: spacing.xl,
      ...elevation.card,
    },
    eyebrow: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: 12,
      letterSpacing: 1.4,
    },
    title: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: 34,
      lineHeight: 39,
      marginTop: spacing.md,
    },
    body: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: 16,
      lineHeight: 24,
      marginTop: spacing.md,
    },
    link: {
      backgroundColor: colors.brand,
      borderRadius: radius.md,
      color: colors.onBrand,
      fontFamily: type.label,
      marginTop: spacing.xl,
      minHeight: 52,
      overflow: "hidden",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      textAlign: "center",
    },
  });
