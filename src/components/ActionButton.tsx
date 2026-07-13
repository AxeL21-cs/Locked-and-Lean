import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import {
  colors,
  elevation,
  radius,
  spacing,
  type,
} from "../design-system/tokens";

export function ActionButton({
  label,
  onPress,
  busy = false,
  disabled = false,
  tone = "primary",
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger";
  accessibilityHint?: string;
}) {
  const blocked = busy || disabled;
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={busy ? `${label}, in progress` : label}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "secondary" && styles.secondary,
        tone === "danger" && styles.danger,
        blocked && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={tone === "secondary" ? colors.ink : colors.rice}
        />
      ) : null}
      <Text
        style={[styles.label, tone === "secondary" && styles.secondaryLabel]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    ...elevation.card,
  },
  secondary: {
    backgroundColor: colors.paperRaised,
    borderColor: colors.ruleStrong,
    elevation: 0,
    shadowOpacity: 0,
  },
  danger: { backgroundColor: colors.tomato, borderColor: colors.tomato },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.995 }] },
  label: {
    color: colors.rice,
    fontFamily: type.label,
    fontSize: 15,
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  secondaryLabel: { color: colors.ink },
});
