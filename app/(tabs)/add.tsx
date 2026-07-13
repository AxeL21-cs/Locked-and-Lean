import { useState } from "react";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { AddActionList } from "../../src/features/add/AddActionList";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, radius, spacing, type } from "../../src/design-system/tokens";

export default function AddScreen() {
  const router = useRouter();
  const [notice, setNotice] = useState(
    "Choose a route. Every food entry will require a fresh preview and explicit confirmation before it can be saved.",
  );

  return (
    <Screen>
      <ScreenHeader
        eyebrow="INTERPRET → VERIFY → LOG"
        title="Add to today"
        annotation="Nothing saves on selection"
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
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.inkMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  safety: {
    color: colors.inkFaint,
    fontFamily: type.label,
    fontSize: 10,
    letterSpacing: 1,
    lineHeight: 16,
    marginBottom: spacing.xxl,
    marginTop: spacing.lg,
  },
});
