import { SymbolView } from "expo-symbols";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AppTheme } from "../../design-system/theme";
import { useAppTheme } from "../../design-system/theme";

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
    meta: "External companion · preview still required",
    demoMessage:
      "Use Locked and Lean from ChatGPT for interpretation. The phone app never calls OpenAI model APIs.",
  },
] as const;

export type AddAction = (typeof ADD_ACTIONS)[number];

export function AddActionList({
  onSelect,
}: {
  onSelect: (action: AddAction) => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.list}>
      {ADD_ACTIONS.map((action, index) => {
        const companion = index === ADD_ACTIONS.length - 1;
        return (
          <Pressable
            accessibilityHint={action.demoMessage}
            accessibilityLabel={`${action.label}. ${action.meta}`}
            accessibilityRole="button"
            android_ripple={{ color: theme.colors.brandContainer }}
            key={action.label}
            onPress={() => onSelect(action)}
            style={({ pressed }) => [
              styles.row,
              companion && styles.companionRow,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[styles.glyphBox, companion && styles.companionGlyphBox]}
            >
              <SymbolView
                name={action.glyph}
                size={25}
                tintColor={
                  companion ? theme.colors.brandStrong : theme.colors.text
                }
              />
            </View>
            <View style={styles.copy}>
              <Text style={styles.index}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <Text style={styles.label}>{action.label}</Text>
              <Text style={styles.meta}>{action.meta}</Text>
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
                companion ? theme.colors.brandStrong : theme.colors.textFaint
              }
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = ({
  colors,
  elevation,
  radius,
  spacing,
  type,
  typeScale,
}: AppTheme) =>
  StyleSheet.create({
    list: { gap: spacing.sm, marginTop: spacing.md },
    row: {
      alignItems: "center",
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: "row",
      minHeight: 92,
      overflow: "hidden",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      ...elevation.card,
    },
    companionRow: {
      backgroundColor: colors.brandContainer,
      borderColor: colors.brandStrong,
    },
    pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
    glyphBox: {
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    companionGlyphBox: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.brandStrong,
    },
    copy: { flex: 1, marginLeft: spacing.md, minWidth: 0 },
    index: {
      color: colors.brandStrong,
      fontFamily: type.numeric,
      fontSize: typeScale.caption,
      letterSpacing: 0.7,
    },
    label: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: 17,
      lineHeight: 23,
      marginTop: 1,
    },
    meta: {
      color: colors.textMuted,
      fontFamily: type.body,
      fontSize: typeScale.label,
      lineHeight: 19,
      marginTop: 3,
    },
  });
