import { StyleSheet, Text, View } from "react-native";

import type { AppTheme } from "../design-system/theme";
import { useAppTheme } from "../design-system/theme";

type Props = { eyebrow: string; title: string; action?: string };

export function SectionHeading({ eyebrow, title, action }: Props) {
  const styles = createStyles(useAppTheme());
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

function createStyles({ colors, spacing, type, typeScale }: AppTheme) {
  return StyleSheet.create({
    wrap: {
      alignItems: "flex-end",
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.xl,
    },
    eyebrow: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 1,
    },
    title: {
      color: colors.text,
      fontFamily: type.display,
      fontSize: typeScale.headline,
      marginTop: 3,
    },
    action: {
      color: colors.textFaint,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      marginBottom: 4,
    },
  });
}
