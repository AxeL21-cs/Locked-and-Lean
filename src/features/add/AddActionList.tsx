import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  colors,
  elevation,
  radius,
  spacing,
  type,
  typeScale,
} from "../../design-system/tokens";

export const ADD_ACTIONS = [
  {
    glyph: {
      android: "barcode_scanner",
      ios: "barcode.viewfinder",
      web: "barcode_scanner",
    },
    label: "Scan Barcode",
    meta: "Package lookup · preview · confirm",
    demoMessage:
      "Open the package barcode scanner. A scan starts lookup only; nothing logs without preview confirmation.",
  },
  {
    glyph: {
      android: "edit_note",
      ios: "square.and.pencil",
      web: "edit_note",
    },
    label: "Manual Food Entry",
    meta: "Preview · review · confirm",
    demoMessage:
      "Open the manual entry form. Nothing logs before confirmation.",
  },
  {
    glyph: { android: "bookmark", ios: "bookmark.fill", web: "bookmark" },
    label: "Saved Foods",
    meta: "Your private reusable foods",
    demoMessage: "View your RLS-protected saved foods.",
  },
  {
    glyph: {
      android: "chat",
      ios: "bubble.left.and.text.bubble.right",
      web: "chat",
    },
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
          <View
            style={[
              styles.glyphBox,
              index === ADD_ACTIONS.length - 1 && styles.chatGlyphBox,
            ]}
          >
            <SymbolView
              name={action.glyph}
              size={25}
              tintColor={
                index === ADD_ACTIONS.length - 1 ? colors.calamansi : colors.ink
              }
            />
          </View>
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
          <SymbolView
            accessibilityElementsHidden
            importantForAccessibility="no"
            name={{
              android: "chevron_right",
              ios: "chevron.right",
              web: "chevron_right",
            }}
            size={23}
            tintColor={
              index === ADD_ACTIONS.length - 1
                ? colors.riceDark
                : colors.inkFaint
            }
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, marginTop: spacing.lg },
  row: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...elevation.card,
  },
  chatRow: { backgroundColor: colors.ink, borderColor: colors.ink },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  glyphBox: {
    alignItems: "center",
    backgroundColor: colors.calamansiWash,
    borderRadius: radius.md,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  chatGlyphBox: { backgroundColor: colors.inkRule },
  copy: { flex: 1, marginLeft: spacing.md },
  label: { color: colors.ink, fontFamily: type.bodyStrong, fontSize: 18 },
  chatLabel: { color: colors.rice },
  meta: {
    color: colors.inkFaint,
    fontFamily: type.body,
    fontSize: typeScale.label,
    lineHeight: 18,
    marginTop: 4,
  },
  chatMeta: { color: colors.riceDark },
});
