import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "../../design-system/tokens";

export const ADD_ACTIONS = [
  {
    glyph: "▣",
    label: "Scan Barcode",
    meta: "Package lookup · preview · confirm",
    demoMessage:
      "Open the package barcode scanner. A scan starts lookup only; nothing logs without preview confirmation.",
  },
  {
    glyph: "✎",
    label: "Manual Food Entry",
    meta: "Preview · review · confirm",
    demoMessage:
      "Open the manual entry form. Nothing logs before confirmation.",
  },
  {
    glyph: "◇",
    label: "Saved Foods",
    meta: "Your private reusable foods",
    demoMessage: "View your RLS-protected saved foods.",
  },
  {
    glyph: "↗",
    label: "Log with ChatGPT",
    meta: "Phase 6 · external handoff planned",
    demoMessage:
      "ChatGPT interpretation is external; this app never calls OpenAI model APIs.",
  },
] as const;

export type AddAction = (typeof ADD_ACTIONS)[number];

export function AddActionList({
  onSelect,
}: {
  onSelect: (action: AddAction) => void;
}) {
  return (
    <View style={styles.list}>
      {ADD_ACTIONS.map((action, index) => (
        <Pressable
          accessibilityHint={action.demoMessage}
          accessibilityLabel={`${action.label}. ${action.meta}`}
          accessibilityRole="button"
          key={action.label}
          onPress={() => onSelect(action)}
          style={({ pressed }) => [
            styles.row,
            index === ADD_ACTIONS.length - 1 && styles.chatRow,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.glyph,
              index === ADD_ACTIONS.length - 1 && styles.chatGlyph,
            ]}
          >
            {action.glyph}
          </Text>
          <View style={styles.copy}>
            <Text
              style={[
                styles.label,
                index === ADD_ACTIONS.length - 1 && styles.chatLabel,
              ]}
            >
              {action.label}
            </Text>
            <Text
              style={[
                styles.meta,
                index === ADD_ACTIONS.length - 1 && styles.chatMeta,
              ]}
            >
              {action.meta}
            </Text>
          </View>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={styles.chevron}
          >
            ›
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, marginTop: spacing.lg },
  row: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 82,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  chatRow: { backgroundColor: colors.ink, borderColor: colors.ink },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  glyph: {
    color: colors.calamansiDeep,
    fontFamily: type.label,
    fontSize: 22,
    textAlign: "center",
    width: 36,
  },
  chatGlyph: { color: colors.calamansi },
  copy: { flex: 1, marginLeft: spacing.md },
  label: { color: colors.ink, fontFamily: type.display, fontSize: 20 },
  chatLabel: { color: colors.rice },
  meta: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: 11,
    marginTop: 4,
  },
  chatMeta: { color: colors.riceDark },
  chevron: { color: colors.inkFaint, fontFamily: type.display, fontSize: 28 },
});
