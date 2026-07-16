import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import type { AppTheme } from "../../src/design-system/theme";
import { useAppTheme } from "../../src/design-system/theme";
import { AddActionList } from "../../src/features/add/AddActionList";
import { QuickLogPanel } from "../../src/features/add/QuickLogPanel";

export default function AddScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [notice, setNotice] = useState(
    "Choose a route. Every food entry will require a fresh preview and explicit confirmation before it can be saved.",
  );

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Fuel log · preview first"
        title="Log a meal"
        annotation="Start fast. Confirm carefully."
      />
      <View style={styles.guardrail}>
        <View style={styles.guardrailRule} />
        <View style={styles.guardrailCopy}>
          <Text style={styles.guardrailTitle}>
            Nothing saves before you say so
          </Text>
          <Text accessibilityLiveRegion="polite" style={styles.guardrailBody}>
            {notice}
          </Text>
        </View>
      </View>

      <QuickLogPanel />

      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Start another way
        </Text>
        <Text style={styles.sectionMeta}>Every route ends in review</Text>
      </View>
      <AddActionList
        onSelect={(action) => {
          if (action.label === "Manual Food Entry")
            return router.push("/manual-entry" as Href);
          if (action.label === "Scan Barcode")
            return router.push("/barcode-scan" as Href);
          if (action.label === "Saved Foods")
            return router.push("/saved-foods" as Href);
          setNotice(`${action.label}: ${action.demoMessage}`);
        }}
      />
      <View style={styles.safety}>
        <Text style={styles.safetyLabel}>MODEL-SAFE BY DESIGN</Text>
        <Text style={styles.safetyBody}>
          Barcode scans create a review-only server preview. ChatGPT
          interpretation stays outside the app; Locked and Lean never calls a
          model API from your phone.
        </Text>
      </View>
    </Screen>
  );
}

const createStyles = ({ colors, radius, spacing, type, typeScale }: AppTheme) =>
  StyleSheet.create({
    guardrail: {
      backgroundColor: colors.brandContainer,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.lg,
      overflow: "hidden",
      padding: spacing.md,
    },
    guardrailRule: {
      alignSelf: "stretch",
      backgroundColor: colors.brand,
      borderRadius: radius.pill,
      width: 5,
    },
    guardrailCopy: { flex: 1 },
    guardrailTitle: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.body,
      lineHeight: 22,
    },
    guardrailBody: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.bodySmall,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    sectionHead: {
      alignItems: "flex-end",
      borderBottomColor: colors.borderStrong,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.xl,
      paddingBottom: spacing.sm,
    },
    sectionTitle: {
      color: colors.text,
      flex: 1,
      fontFamily: type.display,
      fontSize: typeScale.title,
      lineHeight: 28,
    },
    sectionMeta: {
      color: colors.textFaint,
      flexShrink: 1,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      marginLeft: spacing.md,
      textAlign: "right",
    },
    safety: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      marginBottom: spacing.xxl,
      marginTop: spacing.lg,
      padding: spacing.md,
    },
    safetyLabel: {
      color: colors.brandStrong,
      fontFamily: type.label,
      fontSize: typeScale.caption,
      letterSpacing: 0.9,
    },
    safetyBody: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.caption,
      lineHeight: 19,
      marginTop: spacing.xs,
    },
  });
