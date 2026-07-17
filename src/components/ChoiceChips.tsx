import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AppTheme } from "../design-system/theme";
import { useAppTheme } from "../design-system/theme";

export type Choice<T extends string> = { label: string; value: T };

export function ChoiceChips<T extends string>({
  label,
  choices,
  value,
  onChange,
  error,
}: {
  label: string;
  choices: readonly Choice<T>[];
  value?: T;
  onChange: (value: T) => void;
  error?: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.row}>
        {choices.map((choice) => {
          const selected = choice.value === value;
          return (
            <Pressable
              accessibilityLabel={`${label}: ${choice.label}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              android_ripple={{
                color: theme.isDark ? "#FFFFFF1F" : "#07182F1F",
              }}
              key={choice.value}
              onPress={() => onChange(choice.value)}
              style={[styles.chip, selected && styles.selected]}
            >
              <Text style={[styles.chipText, selected && styles.selectedText]}>
                {selected ? "● " : "○ "}
                {choice.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function createStyles({ colors, radius, spacing, type, typeScale }: AppTheme) {
  return StyleSheet.create({
    wrap: { gap: spacing.sm, marginTop: spacing.md },
    label: {
      color: colors.text,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.bodySmall,
    },
    row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.borderStrong,
      borderRadius: radius.pill,
      borderWidth: 1,
      minHeight: 48,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    selected: { backgroundColor: colors.brand, borderColor: colors.brand },
    chipText: {
      color: colors.textMuted,
      fontFamily: type.bodyStrong,
      fontSize: typeScale.label,
    },
    selectedText: { color: colors.onBrand },
    error: { color: colors.danger, fontFamily: type.bodyStrong, fontSize: 12 },
  });
}
