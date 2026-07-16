import { StyleSheet, Text, View } from "react-native";

import type { AppTheme } from "../design-system/theme";
import { useAppTheme } from "../design-system/theme";

type Props = { eyebrow: string; title: string; annotation?: string };

export function ScreenHeader({ eyebrow, title, annotation }: Props) {
  const styles = createStyles(useAppTheme());
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

function createStyles({ colors, spacing, type, typeScale }: AppTheme) {
  return StyleSheet.create({
    wrap: { paddingTop: spacing.lg },
    eyebrow: {
      color: colors.brandStrong,
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
      color: colors.text,
      fontFamily: type.display,
      fontSize: typeScale.display,
      letterSpacing: -1.1,
      lineHeight: 40,
    },
    annotation: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 20,
    },
  });
}
