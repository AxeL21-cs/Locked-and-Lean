import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "../design-system/tokens";

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
  value: T;
  onChange: (value: T) => void;
  error?: string;
}) {
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

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.md },
  label: { color: colors.ink, fontFamily: type.bodyStrong, fontSize: 13 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    borderColor: colors.rule,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: {
    color: colors.inkMuted,
    fontFamily: type.bodyStrong,
    fontSize: 12,
  },
  selectedText: { color: colors.calamansi },
  error: { color: "#9F2D17", fontFamily: type.bodyStrong, fontSize: 12 },
});
