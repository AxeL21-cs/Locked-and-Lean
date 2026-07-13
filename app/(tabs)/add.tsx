import { useState } from "react";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { AddActionList } from "../../src/features/add/AddActionList";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import {
  colors,
  radius,
  spacing,
  type,
  typeScale,
} from "../../src/design-system/tokens";

export default function AddScreen() {
  const router = useRouter();
  const [notice, setNotice] = useState(
    "Choose a route. Every food entry will require a fresh preview and explicit confirmation before it can be saved.",
  );

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Interpret · verify · log"
        title="Add food"
        annotation="Review a complete preview before anything is saved."
      />
      <Text style={styles.notice} accessibilityLiveRegion="polite">
        {notice}
      </Text>
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
      <Text style={styles.safety}>
        Barcode scans create a review-only server preview. The ChatGPT handoff
        remains planned; this app does not perform native AI interpretation or
        call a model API.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: colors.calamansiWash,
    borderColor: colors.ruleStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: typeScale.bodySmall,
    lineHeight: 21,
    marginTop: spacing.lg,
    padding: 16,
  },
  safety: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: typeScale.caption,
    letterSpacing: 0,
    lineHeight: 18,
    marginBottom: spacing.xxl,
    marginTop: spacing.lg,
  },
});
